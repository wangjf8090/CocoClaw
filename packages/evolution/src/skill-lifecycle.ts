/**
 * Skill Lifecycle - 技能生命周期管理
 * 替代 skill-cleaner 的日志扫描，通过 Memory 服务 (Postgres) 查询使用频率
 *
 * 核心能力：
 * 1. 使用频率追踪 — 从数据库查询技能调用记录
 * 2. 闲置技能识别 — 标记长期未使用的技能
 * 3. 技能健康评分 — 综合使用频率、token 成本、错误率
 */

import type { Skill, SkillBudget } from "./skill-audit.js";

// ============================================================================
// Types
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
  score: number; // 0-100
  factors: {
    usage: number;       // 使用频率得分 0-100
    recency: number;     // 最近使用得分 0-100
    efficiency: number;  // 效率得分 (error rate) 0-100
    costEfficiency: number; // token 成本效率 0-100
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

// ============================================================================
// Memory Service Client (替代日志扫描)
// ============================================================================

export interface MemoryServiceConfig {
  baseUrl: string;
  timeout?: number;
}

/**
 * 从 Memory 服务查询技能使用记录
 * 替代 skill-cleaner 扫描 ~/.codex/sessions/ 日志的方式
 */
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
    // Memory 服务不可用时，返回空记录（降级模式）
    console.warn("Memory service unavailable, using degraded mode:", error);
  }

  // 填充无记录的技能
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

// ============================================================================
// Health Scoring
// ============================================================================

/** 计算使用频率得分 */
function scoreUsage(invocationCount: number): number {
  if (invocationCount === 0) return 0;
  if (invocationCount >= 100) return 100;
  if (invocationCount >= 50) return 80;
  if (invocationCount >= 20) return 60;
  if (invocationCount >= 10) return 40;
  if (invocationCount >= 5) return 25;
  return 10;
}

/** 计算最近使用得分（越近越高） */
function scoreRecency(lastUsed: string | null): number {
  if (!lastUsed) return 0;
  const daysSinceLastUse =
    (Date.now() - new Date(lastUsed).getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceLastUse <= 1) return 100;   // 24小时内
  if (daysSinceLastUse <= 7) return 80;    // 一周内
  if (daysSinceLastUse <= 30) return 50;   // 一个月内
  if (daysSinceLastUse <= 90) return 25;   // 三个月内
  return 5;                                 // 超过三个月
}

/** 计算效率得分（错误率越低越高） */
function scoreEfficiency(invocationCount: number, errorCount: number): number {
  if (invocationCount === 0) return 50; // 无数据给中间分
  const errorRate = errorCount / invocationCount;
  if (errorRate <= 0.01) return 100;
  if (errorRate <= 0.05) return 80;
  if (errorRate <= 0.1) return 60;
  if (errorRate <= 0.2) return 40;
  return 20;
}

/** 计算 token 成本效率 */
function scoreCostEfficiency(
  descChars: number,
  invocationCount: number
): number {
  // 描述越长、调用越少，成本效率越低
  if (invocationCount === 0) return descChars > 100 ? 10 : 30;
  const costPerUse = descChars / invocationCount;
  if (costPerUse <= 1) return 100;
  if (costPerUse <= 5) return 80;
  if (costPerUse <= 10) return 60;
  if (costPerUse <= 20) return 40;
  return 20;
}

/** 确定技能状态 */
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

/** 生成建议 */
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

// ============================================================================
// Public API
// ============================================================================

/** 计算单个技能的健康评分 */
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

  // 加权平均：使用频率 35%, 最近使用 30%, 效率 20%, 成本 15%
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

  const status = determineStatus(
    usage.invocationCount,
    daysSinceLastUse
  );

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

/** 生成完整生命周期报告 */
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
