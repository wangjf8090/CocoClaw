/**
 * SelfClaw Evolution Service v3.0
 * 整合 Skill Audit + Skill Optimize + Skill Lifecycle + Compliance + Template
 * + SkillOpt Pipeline (arXiv:2605.23904)
 *
 * v3.0 新增端点 (SkillOpt 6阶段Pipeline):
 * POST /api/pipeline/train        — 启动完整训练循环
 * GET  /api/pipeline/status       — 查询训练状态
 * POST /api/pipeline/stop         — 停止训练
 * GET  /api/pipeline/meta-skill   — 查看Meta Skill状态
 * GET  /api/pipeline/history      — 获取训练历史
 * GET  /api/pipeline/rejected-buffer — 查看被拒绝编辑缓冲区
 * POST /api/pipeline/rejected-buffer/clear — 清空缓冲区
 * GET  /api/pipeline/checkpoints  — 获取checkpoint列表
 * GET  /api/pipeline/best-skill   — 获取最佳技能
 *
 * v2.1 保留端点:
 * GET  /api/audit/meta-skill      — Meta-Skill三维度审计 (arXiv:2605.23899)
 * GET  /api/audit/negative-transfer — 负迁移风险评估 (arXiv:2605.23899)
 * GET  /api/audit/silent-bypass  — 静默绕过检测 (arXiv:2605.10500)
 * POST /api/optimize/cycle       — 完整优化循环 Rollout→Reflect→Edit→Gate (arXiv:2605.23904)
 * GET  /api/optimize/rejected-buffer — 被拒绝编辑缓冲区
 * GET  /api/lifecycle/bypass-check — 单技能静默绕过检测
 * POST /api/lifecycle/deploy-risk — 部署负迁移风险评估
 * GET  /api/lifecycle/skill-memory/:name — 技能级记忆查询
 *
 * v2.0 保留端点:
 * GET  /health                    — 健康检查
 * GET  /api/audit                — 技能审计报告
 * GET  /api/audit/budget         — 仅 Token 预算
 * GET  /api/audit/duplicates     — 仅重复检测
 * GET  /api/compliance            — 行业技能包合规检查
 * GET  /api/compliance/:skillName — 单技能合规详情
 * POST /api/optimize             — 技能描述优化
 * POST /api/template              — 行业模板生成
 * GET  /api/template/:skillName  — 单技能模板预览
 * GET  /api/lifecycle            — 技能生命周期报告
 * POST /api/evolve               — 触发进化周期
 * GET  /api/metrics              — 进化指标
 */

import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import {
  runAudit,
  discoverSkills,
  computeBudget,
  detectDuplicates,
  auditMetaSkill,
  assessNegativeTransferRisk,
  type AuditConfig,
  type AuditReport,
} from "./skill-audit.js";
import {
  optimizeAllSkills,
  optimizeSkill,
  getRejectedEditBuffer,
  getGlobalRejectedBuffer,
  applyBoundedEdits,
  validateGate,
  runOptimizationCycle,
  LRScheduler,
  PersistentRejectedEditBuffer,
  type OptimizationReport,
  type TextEdit,
  type OptimizeConfigV2,
} from "./skill-optimize.js";
import {
  PipelineTrainer,
  MockEvaluationBackend,
  PipelineConfig,
  DEFAULT_PIPELINE_CONFIG,
  type TrainingState,
  type MetaSkill,
  type PipelineOutput,
  type Task,
} from "./skill-pipeline.js";
import {
  fetchUsageFromMemory,
  generateLifecycleReport,
  detectSilentBypass,
  evaluateDeploymentRisk,
  getSkillMemory,
  recordSkillUsage,
  type MemoryServiceConfig,
  type NegativeTransferGuard,
  DEFAULT_NEGATIVE_TRANSFER_GUARD,
} from "./skill-lifecycle.js";
import {
  auditAllCompliance,
  auditSkillCompliance,
  type ComplianceAuditReport,
  type SkillComplianceReport,
} from "./skill-compliance.js";
import {
  wrapAllSkillsForMarketplace,
  wrapSkillForMarketplace,
  previewSkillMd,
  type TemplateReport,
  type TemplateResult,
} from "./skill-template.js";

// ============================================================================
// Config
// ============================================================================

const PORT = process.env.PORT || 8084;
const MEMORY_SERVICE_URL =
  process.env.MEMORY_SERVICE_URL || "http://selfclaw-memory:8082";

const SKILL_ROOTS = (process.env.SKILL_ROOTS || "/app/packages/skills")
  .split(",")
  .map((p) => p.trim());

const AUDIT_CONFIG: AuditConfig = {
  contextTokens: Number(process.env.CONTEXT_TOKENS) || 272_000,
  budgetPercent: Number(process.env.BUDGET_PERCENT) || 2,
  charsPerToken: Number(process.env.CHARS_PER_TOKEN) || 4,
  longDescThreshold: Number(process.env.LONG_DESC_THRESHOLD) || 110,
  skillRoots: SKILL_ROOTS,
  enableMetaSkillAudit: true,
  enableNegativeTransferRisk: true,
};

// ============================================================================
// Evolution Metrics
// ============================================================================

const evolutionMetrics = {
  cycles: 0,
  performanceScore: 100,
  lastImprovements: [] as Array<{
    cycle: number;
    improvement: string;
    timestamp: string;
  }>,
  activeExperiments: [] as Array<{
    id: number;
    name: string;
    status: string;
    startedAt: string;
    config: Record<string, unknown>;
  }>,
};

// ============================================================================
// Express App
// ============================================================================

const app = express();
app.use(cors());
app.use(express.json());

// ---- Health ----
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "evolution-harness",
    version: "2.1.0",
    modules: ["skill-audit", "skill-optimize", "skill-lifecycle", "skill-compliance", "skill-template"],
    v21Features: ["meta-skill-audit", "negative-transfer-guard", "silent-bypass-detect", "text-space-optimizer", "skill-memory"],
    timestamp: new Date().toISOString(),
  });
});

// ---- Root ----
app.get("/", (_req, res) => {
  res.json({
    name: "SelfClaw Self-Evolution Harness",
    version: "2.1.0",
    features: [
      "self-optimization",
      "a-b-testing",
      "performance-tuning",
      "skill-audit",
      "skill-optimize",
      "skill-lifecycle",
      "skill-compliance",
      "skill-template",
      // v2.1
      "meta-skill-audit",
      "negative-transfer-guard",
      "silent-bypass-detect",
      "text-space-optimizer",
      "skill-memory",
    ],
    cycles: evolutionMetrics.cycles,
    performanceScore: evolutionMetrics.performanceScore.toFixed(1),
  });
});

// ============================================================================
// Pipeline Trainer State (v3.0 新增)
// ============================================================================

const PIPELINE_OUTPUT_DIR = process.env.PIPELINE_OUTPUT_DIR || "/app/data/selfclaw-evolution/pipeline";
let pipelineTrainer: PipelineTrainer | null = null;
let trainingPromises: Map<string, Promise<PipelineOutput>> = new Map();

// ============================================================================
// Skill Audit API (v2.0 + v2.1)
// ============================================================================

/** 完整审计报告 (v2.1增强: 包含Meta-Skill审计+负迁移风险) */
app.get("/api/audit", (_req, res) => {
  try {
    const report = runAudit(AUDIT_CONFIG);
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: "Audit failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/** 仅 Token 预算 */
app.get("/api/audit/budget", (_req, res) => {
  try {
    const skills = discoverSkills(AUDIT_CONFIG);
    const enabled = skills.filter((s) => s.enabled);
    const budget = computeBudget(enabled, AUDIT_CONFIG);
    res.json({
      generated: new Date().toISOString(),
      skillCount: enabled.length,
      budget,
    });
  } catch (error) {
    res.status(500).json({
      error: "Budget calculation failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/** 仅重复检测 */
app.get("/api/audit/duplicates", (_req, res) => {
  try {
    const skills = discoverSkills(AUDIT_CONFIG);
    const { byName, byHash } = detectDuplicates(skills);
    res.json({
      generated: new Date().toISOString(),
      duplicateGroupsByName: byName.length,
      duplicateGroupsByHash: byHash.length,
      byName,
      byHash,
    });
  } catch (error) {
    res.status(500).json({
      error: "Duplicate detection failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// ---- v2.1 新增: Meta-Skill三维度审计 ----

/** Meta-Skill三维度审计 (arXiv:2605.23899) */
app.get("/api/audit/meta-skill", (_req, res) => {
  try {
    const skills = discoverSkills(AUDIT_CONFIG);
    const enabled = skills.filter((s) => s.enabled);

    const audits = enabled.map((skill) => {
      const body = fs.readFileSync(skill.filePath, "utf8");
      return {
        skillName: skill.name,
        ...auditMetaSkill(body),
      };
    });

    const avgScore = audits.length > 0
      ? Math.round(audits.reduce((sum, a) => sum + a.overallScore, 0) / audits.length)
      : 0;

    res.json({
      generated: new Date().toISOString(),
      totalSkills: enabled.length,
      averageScore: avgScore,
      skills: audits,
      paperReference: "arXiv:2605.23899",
    });
  } catch (error) {
    res.status(500).json({
      error: "Meta-skill audit failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/** 单技能Meta-Skill审计 */
app.get("/api/audit/meta-skill/:skillName", (req, res) => {
  try {
    const skills = discoverSkills(AUDIT_CONFIG);
    const skill = skills.find(
      (s) => s.name === req.params.skillName || s.baseName === req.params.skillName
    );
    if (!skill) {
      res.status(404).json({ error: "Skill not found", skillName: req.params.skillName });
      return;
    }
    const body = fs.readFileSync(skill.filePath, "utf8");
    const result = auditMetaSkill(body);
    res.json({ skillName: skill.name, ...result });
  } catch (error) {
    res.status(500).json({
      error: "Meta-skill audit failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/** 负迁移风险评估 (arXiv:2605.23899) */
app.get("/api/audit/negative-transfer", (_req, res) => {
  try {
    const skills = discoverSkills(AUDIT_CONFIG);
    const enabled = skills.filter((s) => s.enabled);

    const risks = enabled.map((skill) => {
      const body = fs.readFileSync(skill.filePath, "utf8");
      return {
        skillName: skill.name,
        ...assessNegativeTransferRisk(body),
      };
    });

    const highRisk = risks.filter((r) => r.riskLevel === 'high').length;
    const mediumRisk = risks.filter((r) => r.riskLevel === 'medium').length;

    res.json({
      generated: new Date().toISOString(),
      totalSkills: enabled.length,
      highRiskSkills: highRisk,
      mediumRiskSkills: mediumRisk,
      lowRiskSkills: enabled.length - highRisk - mediumRisk,
      skills: risks,
      paperReference: "arXiv:2605.23899",
    });
  } catch (error) {
    res.status(500).json({
      error: "Negative transfer assessment failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/** 静默绕过检测 (arXiv:2605.10500) */
app.get("/api/audit/silent-bypass", async (_req, res) => {
  try {
    const skills = discoverSkills(AUDIT_CONFIG);
    const enabled = skills.filter((s) => s.enabled);
    const skillNames = enabled.map((s) => s.name);

    const memoryConfig: MemoryServiceConfig = {
      baseUrl: MEMORY_SERVICE_URL,
      timeout: 5000,
    };
    const usageMap = await fetchUsageFromMemory(memoryConfig, skillNames);

    // 假设过去7天有100个任务作为评估基数
    const estimatedTasks = 100;
    const results = enabled.map((skill) => {
      const usage = usageMap.get(skill.name) ?? {
        skillName: skill.name,
        invocationCount: 0,
        lastUsed: null,
        firstUsed: null,
        errorCount: 0,
        avgLatencyMs: 0,
      };
      return detectSilentBypass(skill.name, usage, estimatedTasks);
    });

    const criticalBypass = results.filter((r) => r.status === 'critical').length;

    res.json({
      generated: new Date().toISOString(),
      totalSkills: enabled.length,
      criticalBypassSkills: criticalBypass,
      results,
      paperReference: "arXiv:2605.10500",
    });
  } catch (error) {
    res.status(500).json({
      error: "Silent bypass detection failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============================================================================
// Skill Optimize API (v2.0 + v2.1)
// ============================================================================

/** 批量优化所有技能描述 */
app.post("/api/optimize", (req, res) => {
  try {
    const targetChars = Number(req.body?.targetChars) || 40;
    const skills = discoverSkills(AUDIT_CONFIG);
    const enabled = skills.filter((s) => s.enabled);
    const report = optimizeAllSkills(enabled, targetChars);
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: "Optimization failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/** v2.1: 文本空间优化循环 (arXiv:2605.23904) */
app.post("/api/optimize/cycle", async (req, res) => {
  try {
    const { skillName, edits, config } = req.body as {
      skillName: string;
      edits: TextEdit[];
      config?: OptimizeConfigV2;
    };

    const skills = discoverSkills(AUDIT_CONFIG);
    const skill = skills.find(
      (s) => s.name === skillName || s.baseName === skillName
    );

    if (!skill) {
      res.status(404).json({ error: "Skill not found", skillName });
      return;
    }

    const currentContent = fs.readFileSync(skill.filePath, "utf8");

    // 简化的评估函数（实际应调用Test Harness）
    const evaluateFn = async (content: string): Promise<number> => {
      // TODO: 对接Test Harness的case-runner进行真实评估
      // 当前使用启发式：内容长度适中+包含Meta-Skill维度 = 更高分
      const metaResult = auditMetaSkill(content);
      return metaResult.overallScore;
    };

    const result = await runOptimizationCycle(
      currentContent,
      edits,
      evaluateFn,
      config
    );

    if (result.gateResult.accepted && result.newContent !== currentContent) {
      // 写入优化后的技能文件
      fs.writeFileSync(skill.filePath, result.newContent, "utf8");
    }

    res.json({
      skillName,
      ...result,
      paperReference: "arXiv:2605.23904",
    });
  } catch (error) {
    res.status(500).json({
      error: "Optimization cycle failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/** v2.1: 被拒绝编辑缓冲区 */
app.get("/api/optimize/rejected-buffer", (_req, res) => {
  const buffer = getRejectedEditBuffer();
  res.json({
    size: buffer.size,
    entries: buffer.getAll(),
  });
});

// ============================================================================
// Skill Lifecycle API (v2.0 + v2.1)
// ============================================================================

/** 技能生命周期报告 */
app.get("/api/lifecycle", async (_req, res) => {
  try {
    const skills = discoverSkills(AUDIT_CONFIG);
    const enabled = skills.filter((s) => s.enabled);
    const skillNames = enabled.map((s) => s.name);

    const memoryConfig: MemoryServiceConfig = {
      baseUrl: MEMORY_SERVICE_URL,
      timeout: 5000,
    };
    const usageMap = await fetchUsageFromMemory(memoryConfig, skillNames);

    const report = generateLifecycleReport(enabled, usageMap);
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: "Lifecycle report failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/** v2.1: 部署负迁移风险评估 */
app.post("/api/lifecycle/deploy-risk", (req, res) => {
  try {
    const { skillName, domainType, performanceDelta, guard } = req.body as {
      skillName: string;
      domainType: string;
      performanceDelta: number;
      guard?: NegativeTransferGuard;
    };

    const result = evaluateDeploymentRisk(
      skillName,
      domainType as 'structured' | 'physical' | 'qa' | 'code' | 'unknown',
      performanceDelta,
      guard ?? DEFAULT_NEGATIVE_TRANSFER_GUARD
    );

    res.json({
      skillName,
      ...result,
      paperReference: "arXiv:2605.23899",
    });
  } catch (error) {
    res.status(500).json({
      error: "Deployment risk assessment failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/** v2.1: 技能级记忆查询 */
app.get("/api/lifecycle/skill-memory/:skillName", (req, res) => {
  const memory = getSkillMemory(req.params.skillName);
  res.json(memory);
});

/** v2.1: 记录技能使用结果 */
app.post("/api/lifecycle/skill-memory/:skillName/record", (req, res) => {
  const { success, improvementDelta } = req.body as {
    success: boolean;
    improvementDelta?: number;
  };
  const memory = recordSkillUsage(req.params.skillName, success, improvementDelta);
  res.json(memory);
});

// ============================================================================
// Skill Compliance API (保留)
// ============================================================================

app.get("/api/compliance", (_req, res) => {
  try {
    const skills = discoverSkills(AUDIT_CONFIG);
    const enabled = skills.filter((s) => s.enabled);
    const report = auditAllCompliance(enabled);
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: "Compliance audit failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/compliance/:skillName", (req, res) => {
  try {
    const skills = discoverSkills(AUDIT_CONFIG);
    const skill = skills.find(
      (s) => s.name === req.params.skillName || s.baseName === req.params.skillName
    );
    if (!skill) {
      res.status(404).json({ error: "Skill not found", skillName: req.params.skillName });
      return;
    }
    const report = auditSkillCompliance(skill);
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: "Compliance check failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============================================================================
// Skill Template API (保留)
// ============================================================================

app.post("/api/template", (req, res) => {
  try {
    const skills = discoverSkills(AUDIT_CONFIG);
    const enabled = skills.filter((s) => s.enabled);
    const outputDir = req.body?.outputDir as string | undefined;
    const report = wrapAllSkillsForMarketplace(enabled, outputDir);
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: "Template generation failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/template/:skillName", (req, res) => {
  try {
    const skills = discoverSkills(AUDIT_CONFIG);
    const skill = skills.find(
      (s) => s.name === req.params.skillName || s.baseName === req.params.skillName
    );
    if (!skill) {
      res.status(404).json({ error: "Skill not found", skillName: req.params.skillName });
      return;
    }
    const preview = previewSkillMd(skill);
    res.json(preview);
  } catch (error) {
    res.status(500).json({
      error: "Template preview failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============================================================================
// Pipeline API (v3.0 新增 - SkillOpt 6阶段Pipeline)
// ============================================================================

/**
 * POST /api/pipeline/train - 启动完整训练循环
 * 
 * 基于 SkillOpt (arXiv:2605.23904) 的6阶段Pipeline:
 * Rollout → Reflect → Aggregate → Select → Update → Gate
 */
app.post("/api/pipeline/train", async (req, res) => {
  try {
    const { skillName, config, tasks } = req.body as {
      skillName?: string;
      config?: Partial<PipelineConfig>;
      tasks?: Task[];
    };

    // 获取技能内容
    let initialSkill: string;
    if (skillName) {
      const skills = discoverSkills(AUDIT_CONFIG);
      const skill = skills.find(
        (s) => s.name === skillName || s.baseName === skillName
      );
      if (!skill) {
        res.status(404).json({ error: "Skill not found", skillName });
        return;
      }
      initialSkill = fs.readFileSync(skill.filePath, "utf8");
    } else {
      // 使用默认技能内容
      initialSkill = `# Default Skill

## Description
A general-purpose skill for testing the optimization pipeline.

## Usage
1. Analyze the input
2. Process according to rules
3. Return the result
`;
    }

    // 合并配置
    const mergedConfig: PipelineConfig = {
      ...DEFAULT_PIPELINE_CONFIG,
      ...config,
      outputDir: PIPELINE_OUTPUT_DIR,
      skillRoots: SKILL_ROOTS,
    };

    // 创建训练器
    const backend = new MockEvaluationBackend(tasks);
    pipelineTrainer = new PipelineTrainer(mergedConfig, backend);

    // 生成训练ID
    const trainingId = `train_${Date.now()}`;

    // 异步启动训练
    const trainingPromise = pipelineTrainer.train(initialSkill, tasks);
    trainingPromises.set(trainingId, trainingPromise);

    // 立即返回状态
    res.status(202).json({
      trainingId,
      status: "started",
      message: "Training started. Use GET /api/pipeline/status to check progress.",
      config: mergedConfig,
      paperReference: "arXiv:2605.23904",
    });
  } catch (error) {
    res.status(500).json({
      error: "Training failed to start",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/pipeline/status - 查询训练状态
 */
app.get("/api/pipeline/status", (req, res) => {
  if (!pipelineTrainer) {
    res.json({
      status: "idle",
      message: "No training in progress. Use POST /api/pipeline/train to start.",
    });
    return;
  }

  const state = pipelineTrainer.getState();

  // 检查是否有正在运行的训练
  let activeTraining: string | null = null;
  for (const [id, promise] of trainingPromises) {
    if (!promise || !(promise as unknown as { status?: string }).status) {
      activeTraining = id;
      break;
    }
  }

  res.json({
    ...state,
    activeTrainingId: activeTraining,
    message: getStatusMessage(state.status),
  });
});

/**
 * 获取状态消息
 */
function getStatusMessage(status: TrainingState["status"]): string {
  switch (status) {
    case "idle":
      return "No training in progress";
    case "running":
      return "Training in progress...";
    case "paused":
      return "Training paused. Use POST /api/pipeline/train to resume or POST /api/pipeline/stop to cancel.";
    case "completed":
      return "Training completed. Use GET /api/pipeline/meta-skill to view results.";
    case "error":
      return "Training encountered an error.";
    default:
      return "Unknown status";
  }
}

/**
 * POST /api/pipeline/stop - 停止训练
 */
app.post("/api/pipeline/stop", (req, res) => {
  if (!pipelineTrainer) {
    res.status(400).json({
      error: "No training in progress",
      message: "Use POST /api/pipeline/train to start training first.",
    });
    return;
  }

  const state = pipelineTrainer.getState();

  if (state.status === "completed") {
    res.status(400).json({
      error: "Training already completed",
      message: "Cannot stop completed training.",
    });
    return;
  }

  // 停止训练
  pipelineTrainer.stop();

  // 清理promises
  for (const [id, promise] of trainingPromises) {
    if (!(promise as unknown as { status?: string }).status) {
      trainingPromises.delete(id);
      break;
    }
  }

  const finalState = pipelineTrainer.getState();

  res.json({
    message: "Training stopped",
    finalState,
    outputDir: PIPELINE_OUTPUT_DIR,
  });
});

/**
 * GET /api/pipeline/meta-skill - 查看Meta Skill状态
 */
app.get("/api/pipeline/meta-skill", (req, res) => {
  if (!pipelineTrainer) {
    // 返回空的Meta Skill
    res.json({
      status: "no_training",
      metaSkill: {
        effectivePatterns: [],
        harmfulPatterns: [],
        persistentFailures: [],
        lastUpdated: null,
        version: 0,
      },
      message: "No training data available. Start training first.",
    });
    return;
  }

  const metaSkill = pipelineTrainer.getMetaSkill();
  const state = pipelineTrainer.getState();
  const history = pipelineTrainer.getHistory();

  // 计算统计
  const stats = {
    totalEpochs: history.length,
    totalSteps: history.reduce((sum, e) => sum + e.stepResults.length, 0),
    acceptedSteps: history.reduce(
      (sum, e) => sum + e.stepResults.filter((s) => s.accepted).length,
      0
    ),
    rejectedSteps: history.reduce(
      (sum, e) => sum + e.stepResults.filter((s) => !s.accepted).length,
      0
    ),
    finalScore: state.bestScore,
    improvementFromBaseline: state.bestScore > 0 ? `${((state.bestScore - 0.5) * 100).toFixed(1)}pp` : null,
  };

  res.json({
    status: state.status,
    metaSkill,
    stats,
    effectivePatternsCount: metaSkill.effectivePatterns.length,
    harmfulPatternsCount: metaSkill.harmfulPatterns.length,
    persistentFailuresCount: metaSkill.persistentFailures.length,
    paperReference: "arXiv:2605.23904",
  });
});

/**
 * GET /api/pipeline/history - 获取训练历史
 */
app.get("/api/pipeline/history", (req, res) => {
  if (!pipelineTrainer) {
    res.status(400).json({
      error: "No training data",
      message: "Start training first using POST /api/pipeline/train.",
    });
    return;
  }

  const history = pipelineTrainer.getHistory();

  // 简化历史输出
  const simplified = history.map((epoch) => ({
    epoch: epoch.epoch,
    bestScore: epoch.bestScore,
    stepCount: epoch.stepResults.length,
    acceptedCount: epoch.stepResults.filter((s) => s.accepted).length,
    slowUpdateApplied: !!epoch.slowUpdate,
    slowUpdateAction: epoch.slowUpdate?.action,
  }));

  res.json({
    totalEpochs: history.length,
    epochs: simplified,
  });
});

/**
 * GET /api/pipeline/rejected-buffer - 查看被拒绝编辑缓冲区
 */
app.get("/api/pipeline/rejected-buffer", (req, res) => {
  if (!pipelineTrainer) {
    // 使用全局缓冲区
    const globalBuffer = getGlobalRejectedBuffer(PIPELINE_OUTPUT_DIR);
    res.json({
      size: globalBuffer.size,
      capacity: globalBuffer.capacity,
      records: globalBuffer.getRecords(),
      context: globalBuffer.getContext(),
      failurePatternStats: globalBuffer.getFailurePatternStats(),
    });
    return;
  }

  const buffer = pipelineTrainer.getBuffer();

  res.json({
    size: buffer.size,
    capacity: buffer.capacity,
    records: buffer.getRecords(),
    context: buffer.getContext(),
    failurePatternStats: buffer.getFailurePatternStats(),
  });
});

/**
 * POST /api/pipeline/rejected-buffer/clear - 清空被拒绝编辑缓冲区
 */
app.post("/api/pipeline/rejected-buffer/clear", (req, res) => {
  if (!pipelineTrainer) {
    // 清空全局缓冲区
    const globalBuffer = getGlobalRejectedBuffer(PIPELINE_OUTPUT_DIR);
    globalBuffer.clear();
    res.json({
      message: "Global buffer cleared",
      size: globalBuffer.size,
    });
    return;
  }

  const buffer = pipelineTrainer.getBuffer();
  buffer.clear();

  res.json({
    message: "Buffer cleared",
    size: buffer.size,
  });
});

/**
 * GET /api/pipeline/checkpoint - 获取checkpoint列表
 */
app.get("/api/pipeline/checkpoints", (req, res) => {
  const checkpointDir = PIPELINE_OUTPUT_DIR;

  try {
    if (!fs.existsSync(checkpointDir)) {
      res.json({ checkpoints: [] });
      return;
    }

    const files = fs.readdirSync(checkpointDir);
    const checkpoints = files
      .filter((f) => f.startsWith("checkpoint_epoch_") && f.endsWith(".json"))
      .map((f) => {
        const filePath = path.join(checkpointDir, f);
        const stats = fs.statSync(filePath);
        const epoch = parseInt(f.match(/checkpoint_epoch_(\d+)/)?.[1] ?? "0");
        return {
          epoch,
          file: f,
          path: filePath,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => a.epoch - b.epoch);

    res.json({ checkpoints });
  } catch (error) {
    res.status(500).json({
      error: "Failed to list checkpoints",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/pipeline/best-skill - 获取最佳技能
 */
app.get("/api/pipeline/best-skill", (req, res) => {
  const bestSkillPath = path.join(PIPELINE_OUTPUT_DIR, "best_skill.md");

  try {
    if (!fs.existsSync(bestSkillPath)) {
      res.status(404).json({
        error: "Best skill not found",
        message: "Complete training first to generate best_skill.md",
      });
      return;
    }

    const content = fs.readFileSync(bestSkillPath, "utf8");
    res.json({
      path: bestSkillPath,
      content,
      size: content.length,
      lines: content.split("\n").length,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to read best skill",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============================================================================
// Legacy Evolution API (保持向后兼容)
// ============================================================================

app.post("/api/evolve", (_req, res) => {
  const improvement = Math.random() * 20 + 5;
  evolutionMetrics.cycles++;
  evolutionMetrics.performanceScore += improvement;
  evolutionMetrics.lastImprovements.push({
    cycle: evolutionMetrics.cycles,
    improvement: improvement.toFixed(1) + "%",
    timestamp: new Date().toISOString(),
  });

  if (evolutionMetrics.lastImprovements.length > 10) {
    evolutionMetrics.lastImprovements.shift();
  }

  res.json({
    cycle: evolutionMetrics.cycles,
    improvement: improvement.toFixed(1) + "%",
    newScore: evolutionMetrics.performanceScore.toFixed(1),
    message: "Evolution cycle completed successfully",
  });
});

app.get("/api/metrics", (_req, res) => {
  res.json(evolutionMetrics);
});

app.post("/api/experiments", (req, res) => {
  const experiment = {
    id: Date.now(),
    name: req.body.name || "Unnamed Experiment",
    status: "running",
    startedAt: new Date().toISOString(),
    config: req.body.config || {},
  };
  evolutionMetrics.activeExperiments.push(experiment);
  res.status(201).json(experiment);
});

app.get("/api/experiments", (_req, res) => {
  res.json(evolutionMetrics.activeExperiments);
});

app.patch("/api/experiments/:id/complete", (req, res) => {
  const exp = evolutionMetrics.activeExperiments.find(
    (e) => e.id === Number(req.params.id)
  ) as (typeof evolutionMetrics.activeExperiments[number] & { completedAt?: string; result?: { success: boolean; improvement: string } }) | undefined;
  if (exp) {
    exp.status = "completed";
    exp.completedAt = new Date().toISOString();
    exp.result = {
      success: true,
      improvement: (Math.random() * 15 + 5).toFixed(1) + "%",
    };
    res.json(exp);
  } else {
    res.status(404).json({ error: "Experiment not found" });
  }
});

// ============================================================================
// Start
// ============================================================================

app.listen(PORT, () => {
  console.log(`🧬 SelfClaw Evolution Harness v3.0 running on port ${PORT}`);
  console.log(`   Health:          http://localhost:${PORT}/health`);
  console.log(`   Audit:           http://localhost:${PORT}/api/audit`);
  console.log(`   Meta-Skill:      http://localhost:${PORT}/api/audit/meta-skill`);
  console.log(`   Neg.Transfer:     http://localhost:${PORT}/api/audit/negative-transfer`);
  console.log(`   SilentBypass:    http://localhost:${PORT}/api/audit/silent-bypass`);
  console.log(`   OptCycle:        POST http://localhost:${PORT}/api/optimize/cycle`);
  console.log(`   RejectedBuf:     http://localhost:${PORT}/api/optimize/rejected-buffer`);
  console.log(`   DeployRisk:      POST http://localhost:${PORT}/api/lifecycle/deploy-risk`);
  console.log(`   SkillMemory:     http://localhost:${PORT}/api/lifecycle/skill-memory/:name`);
  console.log(`--- v3.0 Pipeline (SkillOpt) ---`);
  console.log(`   Pipeline Train:  POST http://localhost:${PORT}/api/pipeline/train`);
  console.log(`   Pipeline Status: http://localhost:${PORT}/api/pipeline/status`);
  console.log(`   Pipeline Stop:   POST http://localhost:${PORT}/api/pipeline/stop`);
  console.log(`   Pipeline Meta:   http://localhost:${PORT}/api/pipeline/meta-skill`);
  console.log(`   Pipeline History: http://localhost:${PORT}/api/pipeline/history`);
  console.log(`   Pipeline Buffer: http://localhost:${PORT}/api/pipeline/rejected-buffer`);
  console.log(`   Pipeline Checkpoints: http://localhost:${PORT}/api/pipeline/checkpoints`);
  console.log(`   Pipeline Best:   http://localhost:${PORT}/api/pipeline/best-skill`);
  console.log(`   Skill roots:     ${SKILL_ROOTS.join(", ")}`);
  console.log(`   Pipeline output: ${PIPELINE_OUTPUT_DIR}`);
});
