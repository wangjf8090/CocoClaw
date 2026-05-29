/**
 * SelfClaw Evolution Service v2.0
 * 整合 Skill Audit + Skill Optimize + Skill Lifecycle
 *
 * API 端点：
 * GET  /health                     — 健康检查
 * GET  /api/audit                  — 技能审计报告 (Token预算+重复检测+根目录)
 * GET  /api/audit/budget           — 仅 Token 预算
 * GET  /api/audit/duplicates       — 仅重复检测
 * POST /api/optimize               — 技能描述优化
 * GET  /api/lifecycle              — 技能生命周期报告
 * POST /api/evolve                 — 触发进化周期
 * GET  /api/metrics                — 进化指标
 */

import express from "express";
import cors from "cors";
import path from "node:path";
import {
  runAudit,
  discoverSkills,
  computeBudget,
  detectDuplicates,
  type AuditConfig,
  type AuditReport,
} from "./skill-audit.js";
import {
  optimizeAllSkills,
  optimizeSkill,
  type OptimizationReport,
} from "./skill-optimize.js";
import {
  fetchUsageFromMemory,
  generateLifecycleReport,
  type LifecycleReport,
  type MemoryServiceConfig,
} from "./skill-lifecycle.js";

// ============================================================================
// Config
// ============================================================================

const PORT = process.env.PORT || 8084;
const MEMORY_SERVICE_URL =
  process.env.MEMORY_SERVICE_URL || "http://selfclaw-memory:8082";

/** 技能根目录：SelfClaw Docker 容器内的路径 */
const SKILL_ROOTS = (process.env.SKILL_ROOTS || "/app/packages/skills")
  .split(",")
  .map((p) => p.trim());

const AUDIT_CONFIG: AuditConfig = {
  contextTokens: Number(process.env.CONTEXT_TOKENS) || 272_000,
  budgetPercent: Number(process.env.BUDGET_PERCENT) || 2,
  charsPerToken: Number(process.env.CHARS_PER_TOKEN) || 4,
  longDescThreshold: Number(process.env.LONG_DESC_THRESHOLD) || 110,
  skillRoots: SKILL_ROOTS,
};

// ============================================================================
// Evolution Metrics (保留原有逻辑)
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
    version: "2.0.0",
    modules: ["skill-audit", "skill-optimize", "skill-lifecycle"],
    timestamp: new Date().toISOString(),
  });
});

// ---- Root ----
app.get("/", (_req, res) => {
  res.json({
    name: "SelfClaw Self-Evolution Harness",
    version: "2.0.0",
    features: [
      "self-optimization",
      "a-b-testing",
      "performance-tuning",
      "skill-audit",
      "skill-optimize",
      "skill-lifecycle",
    ],
    cycles: evolutionMetrics.cycles,
    performanceScore: evolutionMetrics.performanceScore.toFixed(1),
  });
});

// ============================================================================
// Skill Audit API
// ============================================================================

/** 完整审计报告 */
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

// ============================================================================
// Skill Optimize API
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

// ============================================================================
// Skill Lifecycle API
// ============================================================================

/** 技能生命周期报告 */
app.get("/api/lifecycle", async (_req, res) => {
  try {
    const skills = discoverSkills(AUDIT_CONFIG);
    const enabled = skills.filter((s) => s.enabled);
    const skillNames = enabled.map((s) => s.name);

    // 从 Memory 服务获取使用记录
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
  console.log(`🧬 SelfClaw Evolution Harness v2.0 running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Audit:  http://localhost:${PORT}/api/audit`);
  console.log(`   Budget: http://localhost:${PORT}/api/audit/budget`);
  console.log(`   Lifecycle: http://localhost:${PORT}/api/lifecycle`);
  console.log(`   Skill roots: ${SKILL_ROOTS.join(", ")}`);
});
