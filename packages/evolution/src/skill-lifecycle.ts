/**
 * Skill Lifecycle - 技能生命周期管理 v2.1
 * 
 * v2.0: 替代 skill-cleaner 的日志扫描，通过 Memory 服务 (Postgres) 查询使用频率
 *       使用频率追踪 + 闲置技能识别 + 技能健康评分
 * 
 * v2.1: 基于论文群的生命周期增强
 *       - arXiv:2605.23899: 负迁移防护（部署前沙箱测试 + 部署后监控 + 自动回滚）
 *       - arXiv:2605.10500: 静默绕过检测（Silent Bypass）+ 运行时调用率追踪
 *       - arXiv:2605.23899: 跨模型技能移植兼容性评估
 *       - MUSE-Autoskill: 技能级记忆（per-skill .memory.md）
 *       - arXiv:2605.23899: 角色分离策略（Extractor≠Consumer）
 */

import type { Skill, SkillBudget, DomainType } from "./skill-audit.js";

// ============================================================================
// v2.0 Types (保留)
// ============================================================================

export interface SkillUsageRecord {
  skillName: string;
  invocationCount: number;
  lastUsed: string | null;
  firstUsed: string | null;
  errorCount: number;
  avgLatencyMs: number;
}

export interface SkillHealthScore {
  skillName: string;
  score: number;
  factors: {
    usage: number;
    recency: number;
    efficiency: number;
    costEfficiency: number;
  };
  status: "active" | "idle" | "zombie" | "unused";
  recommendation: string;
}

export interface LifecycleReport {
  generated: string;
  totalSkills: number;
  activeSkills: number;
  idleSkills: number;
  zombieSkills: number;
  unusedSkills: number;
  healthScores: SkillHealthScore[];
  recommendations: Array<{
    skillName: string;
    action: "keep" | "review" | "archive" | "delete";
    reason: string;
  }>;
}

export interface MemoryServiceConfig {
  baseUrl: string;
  timeout?: number;
}

// ============================================================================
// v2.1 新增类型
// ============================================================================

/**
 * 静默绕过检测结果
 * 
 * 来源: arXiv:2605.10500 (SkillEvolver)
 * 技能"看起来有效"但运行时从未被调用
 */
export interface SilentBypassResult {
  skillName: string;
  totalTasksEvaluated: number;
  invocationCount: number;
  silentBypassRate: number;      // 1 - invocationCount/totalTasks
  detectedPatterns: BypassPattern[];
  status: 'healthy' | 'warning' | 'critical' | 'no_data';
}

export interface BypassPattern {
  pattern: string;
  description: string;
  occurrences: number;
}

/**
 * 负迁移防护配置
 * 
 * 来源: arXiv:2605.23899
 * 25%的组合出现负迁移，需要部署前/后的防护
 */
export interface NegativeTransferGuard {
  /** 部署前沙箱测试 */
  preDeployment: {
    enabled: boolean;
    sandboxEnvironment: boolean;
    testTasks: number;         // 验证集任务数
    toleranceThreshold: number; // 允许最大性能下降(pp)
    action: 'block' | 'warn' | 'conditional_deploy';
  };
  /** 部署后监控 */
  postDeployment: {
    enabled: boolean;
    trackPerformanceDelta: boolean;
    alertOnNegativeTransfer: boolean;
    autoRollback: boolean;
    monitoringWindowDays: number;
  };
  /** 领域风险评级 */
  domainRiskProfile: Record<DomainType, 'low' | 'medium' | 'high'>;
}

/**
 * 技能级记忆
 * 
 * 来源: MUSE-Autoskill
 * 每个技能维护独立的记忆，积累跨任务经验
 */
export interface SkillMemory {
  skillId: string;
  failureModes: string[];
  performanceCaveats: string[];
  successPatterns: string[];
  usageHistory: {
    tasksCompleted: number;
    tasksFailed: number;
    lastUsed: string;
    avgImprovement: number;  // pp
  };
  updatedAt: string;
}

/**
 * 跨模型技能移植兼容性
 * 
 * 来源: arXiv:2605.23899
 * 强池技能对所有模型有益，弱池技能可能对部分模型有害
 */
export interface SkillTransferability {
  skillName: string;
  sourceModelCapability: 'strong' | 'weak' | 'unknown';
  targetCompatibility: Array<{
    modelId: string;
    expectedImpact: number;  // pp, 正=受益, 负=受损
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  overallTransferSafety: 'safe' | 'caution' | 'unsafe';
}

// ============================================================================
// v2.0 Core Functions (保留)
// ============================================================================

export async function fetchUsageFromMemory(
  config: MemoryServiceConfig,
  skillNames: string[]
): Promise<Map<string, SkillUsageRecord>> {
  const usageMap = new Map<string, SkillUsageRecord>();

  try {
    const response = await fetch(`${config.baseUrl}/api/skill-usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillNames }),
      signal: AbortSignal.timeout(config.timeout ?? 5000),
    });

    if (response.ok) {
      const data = await response.json() as { records: SkillUsageRecord[] };
      for (const record of data.records) {
        usageMap.set(record.skillName, record);
      }
    }
  } catch (error) {
    console.warn("Memory service unavailable, using degraded mode:", error);
  }

  for (const name of skillNames) {
    if (!usageMap.has(name)) {
      usageMap.set(name, {
        skillName: name,
        invocationCount: 0,
        lastUsed: null,
        firstUsed: null,
        errorCount: 0,
        avgLatencyMs: 0,
      });
    }
  }

  return usageMap;
}

function scoreUsage(invocationCount: number): number {
  if (invocationCount === 0) return 0;
  if (invocationCount >= 100) return 100;
  if (invocationCount >= 50) return 80;
  if (invocationCount >= 20) return 60;
  if (invocationCount >= 10) return 40;
  if (invocationCount >= 5) return 25;
  return 10;
}

function scoreRecency(lastUsed: string | null): number {
  if (!lastUsed) return 0;
  const daysSinceLastUse =
    (Date.now() - new Date(lastUsed).getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceLastUse <= 1) return 100;
  if (daysSinceLastUse <= 7) return 80;
  if (daysSinceLastUse <= 30) return 50;
  if (daysSinceLastUse <= 90) return 25;
  return 5;
}

function scoreEfficiency(invocationCount: number, errorCount: number): number {
  if (invocationCount === 0) return 50;
  const errorRate = errorCount / invocationCount;
  if (errorRate <= 0.01) return 100;
  if (errorRate <= 0.05) return 80;
  if (errorRate <= 0.1) return 60;
  if (errorRate <= 0.2) return 40;
  return 20;
}

function scoreCostEfficiency(descChars: number, invocationCount: number): number {
  if (invocationCount === 0) return descChars > 100 ? 10 : 30;
  const costPerUse = descChars / invocationCount;
  if (costPerUse <= 1) return 100;
  if (costPerUse <= 5) return 80;
  if (costPerUse <= 10) return 60;
  if (costPerUse <= 20) return 40;
  return 20;
}

function determineStatus(
  invocationCount: number,
  daysSinceLastUse: number | null
): "active" | "idle" | "zombie" | "unused" {
  if (invocationCount === 0) return "unused";
  if (daysSinceLastUse === null) return "unused";
  if (daysSinceLastUse <= 7) return "active";
  if (daysSinceLastUse <= 30) return "idle";
  return "zombie";
}

function generateRecommendation(
  status: "active" | "idle" | "zombie" | "unused",
  score: number,
  descChars: number
): { action: "keep" | "review" | "archive" | "delete"; reason: string } {
  switch (status) {
    case "active":
      return {
        action: "keep",
        reason: "高频活跃技能，保持现状" +
          (descChars > 110 ? "，建议精简描述" : ""),
      };
    case "idle":
      return {
        action: "review",
        reason: "近期使用减少，评估是否仍有需求" +
          (descChars > 80 ? "，可考虑精简描述" : ""),
      };
    case "zombie":
      return {
        action: "archive",
        reason: "超过30天未使用，建议归档以释放上下文预算",
      };
    case "unused":
      return {
        action: score >= 30 ? "review" : "delete",
        reason: "从未使用过" +
          (score >= 30 ? "，但可能为基础设施技能，需人工确认" : "，建议移除"),
      };
  }
}

export function computeHealthScore(
  skillName: string,
  usage: SkillUsageRecord,
  descChars: number
): SkillHealthScore {
  const usageScore = scoreUsage(usage.invocationCount);
  const recencyScore = scoreRecency(usage.lastUsed);
  const efficiencyScore = scoreEfficiency(
    usage.invocationCount,
    usage.errorCount
  );
  const costScore = scoreCostEfficiency(descChars, usage.invocationCount);

  const overall = Math.round(
    usageScore * 0.35 +
    recencyScore * 0.3 +
    efficiencyScore * 0.2 +
    costScore * 0.15
  );

  const daysSinceLastUse = usage.lastUsed
    ? (Date.now() - new Date(usage.lastUsed).getTime()) /
      (1000 * 60 * 60 * 24)
    : null;

  const status = determineStatus(usage.invocationCount, daysSinceLastUse);
  const rec = generateRecommendation(status, overall, descChars);

  return {
    skillName,
    score: overall,
    factors: {
      usage: usageScore,
      recency: recencyScore,
      efficiency: efficiencyScore,
      costEfficiency: costScore,
    },
    status,
    recommendation: `${rec.action}: ${rec.reason}`,
  };
}

export function generateLifecycleReport(
  skills: Skill[],
  usageMap: Map<string, SkillUsageRecord>
): LifecycleReport {
  const healthScores = skills.map((skill) => {
    const usage = usageMap.get(skill.name) ?? {
      skillName: skill.name,
      invocationCount: 0,
      lastUsed: null,
      firstUsed: null,
      errorCount: 0,
      avgLatencyMs: 0,
    };
    return computeHealthScore(skill.name, usage, skill.descChars);
  });

  const activeSkills = healthScores.filter((h) => h.status === "active").length;
  const idleSkills = healthScores.filter((h) => h.status === "idle").length;
  const zombieSkills = healthScores.filter((h) => h.status === "zombie").length;
  const unusedSkills = healthScores.filter((h) => h.status === "unused").length;

  const recommendations = healthScores.map((h) => {
    const actionMatch = h.recommendation.match(/^(\w+): /);
    const action = actionMatch
      ? (actionMatch[1] as "keep" | "review" | "archive" | "delete")
      : "review";
    return {
      skillName: h.skillName,
      action,
      reason: h.recommendation.replace(/^\w+: /, ""),
    };
  });

  return {
    generated: new Date().toISOString(),
    totalSkills: skills.length,
    activeSkills,
    idleSkills,
    zombieSkills,
    unusedSkills,
    healthScores,
    recommendations,
  };
}

// ============================================================================
// v2.1 新增: 静默绕过检测
// ============================================================================

/**
 * 检测技能的静默绕过率
 * 
 * 来源: arXiv:2605.10500 (SkillEvolver)
 * 技能文档"看起来有效"但运行时从未被调用
 */
export function detectSilentBypass(
  skillName: string,
  usage: SkillUsageRecord,
  totalTasksEvaluated: number
): SilentBypassResult {
  const invocationCount = usage.invocationCount;
  const bypassRate = totalTasksEvaluated > 0
    ? 1 - (invocationCount / totalTasksEvaluated)
    : 0;

  const patterns: BypassPattern[] = [];

  if (bypassRate > 0.8) {
    patterns.push({
      pattern: 'high_bypass_rate',
      description: `技能在${(bypassRate * 100).toFixed(0)}%的任务中未被调用，存在静默绕过`,
      occurrences: totalTasksEvaluated - invocationCount,
    });
  }

  // 检测"被提及但未使用"模式
  // 如果技能最近被加载但调用次数为0
  if (usage.lastUsed && invocationCount === 0) {
    patterns.push({
      pattern: 'mentioned_not_used',
      description: '技能已加载但从未被实际调用',
      occurrences: 1,
    });
  }

  const status = bypassRate > 0.8 ? 'critical' as const
    : bypassRate > 0.5 ? 'warning' as const
    : totalTasksEvaluated === 0 ? 'no_data' as const
    : 'healthy' as const;

  return {
    skillName,
    totalTasksEvaluated,
    invocationCount,
    silentBypassRate: bypassRate,
    detectedPatterns: patterns,
    status,
  };
}

// ============================================================================
// v2.1 新增: 负迁移防护
// ============================================================================

/**
 * 默认负迁移防护配置
 * 
 * 来源: arXiv:2605.23899
 * 25%负迁移率，ALFWorld 47%，SpreadsheetBench/SWE-bench 13%
 */
export const DEFAULT_NEGATIVE_TRANSFER_GUARD: NegativeTransferGuard = {
  preDeployment: {
    enabled: true,
    sandboxEnvironment: true,
    testTasks: 10,
    toleranceThreshold: -2,   // 允许最大-2pp的性能下降
    action: 'block',          // 负迁移时阻止部署
  },
  postDeployment: {
    enabled: true,
    trackPerformanceDelta: true,
    alertOnNegativeTransfer: true,
    autoRollback: true,
    monitoringWindowDays: 7,
  },
  domainRiskProfile: {
    structured: 'low',
    code: 'low',
    qa: 'medium',
    physical: 'high',
    unknown: 'medium',
  },
};

/**
 * 评估技能部署的负迁移风险
 */
export function evaluateDeploymentRisk(
  skillName: string,
  domainType: DomainType,
  performanceDelta: number,   // 有技能 vs 无技能的差异(pp)
  guard: NegativeTransferGuard = DEFAULT_NEGATIVE_TRANSFER_GUARD
): {
  canDeploy: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
  requiredActions: string[];
} {
  const domainRisk = guard.domainRiskProfile[domainType] ?? 'medium';
  const warnings: string[] = [];
  const requiredActions: string[] = [];

  // 检查性能下降
  if (performanceDelta < 0) {
    warnings.push(`技能导致性能下降${Math.abs(performanceDelta).toFixed(1)}pp（负迁移）`);
  }

  // 检查领域风险
  if (domainRisk === 'high') {
    warnings.push('该领域负迁移风险极高(47%)');
    requiredActions.push('必须在沙箱中验证');
    requiredActions.push('建议为不同模型提供差异化技能版本');
  } else if (domainRisk === 'medium') {
    warnings.push('该领域有一定负迁移风险(20%)');
    requiredActions.push('建议在目标模型上验证效果');
  }

  // 决定是否可以部署
  let canDeploy = true;
  if (guard.preDeployment.enabled) {
    if (performanceDelta < guard.preDeployment.toleranceThreshold) {
      canDeploy = guard.preDeployment.action !== 'block';
      if (guard.preDeployment.action === 'block') {
        requiredActions.push('性能下降超过容忍阈值，部署被阻止');
      }
    }
  }

  return {
    canDeploy,
    riskLevel: domainRisk,
    warnings,
    requiredActions,
  };
}

// ============================================================================
// v2.1 新增: 技能级记忆
// ============================================================================

const skillMemoryStore = new Map<string, SkillMemory>();

/**
 * 获取或创建技能级记忆
 * 
 * 来源: MUSE-Autoskill
 * 每个技能维护独立的记忆，积累跨任务经验
 */
export function getSkillMemory(skillId: string): SkillMemory {
  if (!skillMemoryStore.has(skillId)) {
    skillMemoryStore.set(skillId, {
      skillId,
      failureModes: [],
      performanceCaveats: [],
      successPatterns: [],
      usageHistory: {
        tasksCompleted: 0,
        tasksFailed: 0,
        lastUsed: new Date().toISOString(),
        avgImprovement: 0,
      },
      updatedAt: new Date().toISOString(),
    });
  }
  return skillMemoryStore.get(skillId)!;
}

/**
 * 更新技能记忆
 */
export function updateSkillMemory(
  skillId: string,
  update: Partial<Pick<SkillMemory, 'failureModes' | 'performanceCaveats' | 'successPatterns'>>
): SkillMemory {
  const memory = getSkillMemory(skillId);
  
  if (update.failureModes) {
    memory.failureModes = [...new Set([...memory.failureModes, ...update.failureModes])];
  }
  if (update.performanceCaveats) {
    memory.performanceCaveats = [...new Set([...memory.performanceCaveats, ...update.performanceCaveats])];
  }
  if (update.successPatterns) {
    memory.successPatterns = [...new Set([...memory.successPatterns, ...update.successPatterns])];
  }
  
  memory.updatedAt = new Date().toISOString();
  return memory;
}

/**
 * 记录技能使用结果
 */
export function recordSkillUsage(
  skillId: string,
  success: boolean,
  improvementDelta?: number
): SkillMemory {
  const memory = getSkillMemory(skillId);
  
  if (success) {
    memory.usageHistory.tasksCompleted++;
  } else {
    memory.usageHistory.tasksFailed++;
  }
  
  if (improvementDelta !== undefined) {
    const total = memory.usageHistory.tasksCompleted + memory.usageHistory.tasksFailed;
    const currentAvg = memory.usageHistory.avgImprovement;
    memory.usageHistory.avgImprovement = 
      (currentAvg * (total - 1) + improvementDelta) / total;
  }
  
  memory.usageHistory.lastUsed = new Date().toISOString();
  memory.updatedAt = new Date().toISOString();
  
  return memory;
}
