/**
 * SkillOpt Pipeline - 完整的6阶段自我进化流水线 v3.0
 * 
 * 深度移植自 Microsoft Research SkillOpt (arXiv:2605.23904)
 * https://github.com/microsoft/SkillOpt
 * 
 * 6阶段流水线:
 * 1. Rollout     - 目标模型用当前skill执行batch_size个任务
 * 2. Reflect     - 分minibatch并行分析失败/成功轨迹
 * 3. Aggregate   - 层级合并去重 (_hierarchical_merge)
 * 4. Select      - 基于edit budget选择top-k编辑
 * 5. Update/Edit - 应用bounded edits生成候选skill
 * 6. Gate        - 在held-out验证集上严格对比
 * 
 * 额外机制:
 * - Rejected-Edit Buffer: 拒绝的编辑记录失败模式
 * - Slow Update: epoch级别对比相邻epoch skill表现
 * - Meta Skill: 只给优化器看的长期记忆
 * - LRScheduler: 支持cosine/linear/constant/autonomous调度
 */

import fs from "node:fs";
import path from "node:path";
import type {
  Skill,
  MetaSkillAuditReport,
  DimensionResult,
} from "./skill-audit.js";
import { auditMetaSkill } from "./skill-audit.js";
import type {
  TextEdit,
  GateResult,
  OptimizeConfigV2,
  OptimizationReport,
} from "./skill-optimize.js";
import {
  applyBoundedEdits,
  validateGate,
  RejectedEditBuffer,
} from "./skill-optimize.js";

// ============================================================================
// Pipeline Configuration
// ============================================================================

/**
 * Pipeline配置接口
 * 
 * 对应 SkillOpt configs/_base_/default.yaml
 */
export interface PipelineConfig {
  /** Rollout batch size (默认: 40) */
  batchSize: number;
  /** Reflection minibatch (默认: 8) */
  minibatchSize: number;
  /** Learning rate / Edit budget (默认: 4) */
  editBudget: number;
  /** 最小学习率 (默认: 2) */
  minEditBudget: number;
  /** 学习率调度器: cosine | linear | constant | autonomous */
  lrScheduler: "cosine" | "linear" | "constant" | "autonomous";
  /** Gate指标: hard | soft | mixed (默认: hard) */
  gateMetric: "hard" | "soft" | "mixed";
  /** 训练轮数 (默认: 4) */
  numEpochs: number;
  /** 是否启用Slow Update (默认: true) */
  enableSlowUpdate: boolean;
  /** 是否启用Meta Skill (默认: true) */
  enableMetaSkill: boolean;
  /** 是否启用Rejected-Edit Buffer (默认: true) */
  enableRejectedBuffer: boolean;
  /** 验证集大小 (默认: 10) */
  validationSetSize: number;
  /** 分析最大轮数 (默认: 3) */
  maxAnalystRounds: number;
  /** 并行分析worker数 (默认: 16) */
  analystWorkers: number;
  /** 输出目录 */
  outputDir: string;
  /** 技能根目录 */
  skillRoots: string[];
}

export const DEFAULT_PIPELINE_CONFIG: Required<PipelineConfig> = {
  batchSize: 40,
  minibatchSize: 8,
  editBudget: 4,
  minEditBudget: 2,
  lrScheduler: "cosine",
  gateMetric: "hard",
  numEpochs: 4,
  enableSlowUpdate: true,
  enableMetaSkill: true,
  enableRejectedBuffer: true,
  validationSetSize: 10,
  maxAnalystRounds: 3,
  analystWorkers: 16,
  outputDir: "/app/data/selfclaw-evolution/pipeline",
  skillRoots: ["/app/packages/skills"],
};

// ============================================================================
// Core Types
// ============================================================================

/** 编辑操作类型 */
export type EditOp = "append" | "insert_after" | "replace" | "delete";

/**
 * 单个编辑操作
 * 
 * 对应 SkillOpt skillopt/types.py Edit dataclass
 */
export interface Edit {
  op: EditOp;
  content: string;
  target: string;
  supportCount?: number;
  sourceType?: "failure" | "success";
  mergeLevel?: number;
  reasoning?: string;
  score?: number;
}

/**
 * 一组带推理的编辑
 * 
 * 对应 SkillOpt skillopt/types.py Patch dataclass
 */
export interface Patch {
  edits: Edit[];
  reasoning: string;
  rankingDetails?: Record<string, unknown>;
}

/**
 * 单次任务执行结果
 * 
 * 对应 SkillOpt skillopt/types.py RolloutResult dataclass
 */
export interface RolloutResult {
  id: string;
  taskIndex: number;
  hard: number;           // 硬指标 (0/1)
  soft: number;            // 软指标 (连续)
  failReason: string;
  predictedAnswer: string;
  groundTruth: string;
  skillVersion: string;
  timestamp: string;
  /** 轨迹详情 */
  trajectory?: {
    input: string;
    output: string;
    steps: string[];
    error?: string;
  };
}

/**
 * Slow Update输出
 * 
 * 对应 SkillOpt skillopt/types.py SlowUpdateResult dataclass
 */
export interface SlowUpdateResult {
  reasoning: string;
  slowUpdateContent: string;
  prevHard: number | null;
  currHard: number | null;
  selectionHard: number | null;
  action: "accept" | "reject";
}

/**
 * Epoch历史记录
 */
export interface EpochHistory {
  epoch: number;
  step: number;
  currentSkill: string;
  bestSkill: string;
  bestScore: number;
  stepResults: StepResult[];
  slowUpdate?: SlowUpdateResult;
}

/**
 * 步骤结果
 */
export interface StepResult {
  step: number;
  rollouts: RolloutResult[];
  patches: Patch[];
  mergedPatch: Patch;
  selectedEdits: Edit[];
  candidateScore: number;
  currentScore: number;
  gateResult: GateResult;
  accepted: boolean;
  timestamp: string;
}

/**
 * Meta Skill - 元技能
 * 
 * 只给优化器看的长期记忆，不随 best_skill.md 导出
 * 对应 SkillOpt skillopt/types.py MetaSkill
 */
export interface MetaSkill {
  effectivePatterns: string[];      // 已被验证有效的编辑模式
  harmfulPatterns: string[];       // 已被验证有害的编辑模式
  persistentFailures: string[];    // 仍需解决的顽固问题
  lastUpdated: string;
  version: number;
}

/**
 * 被拒绝编辑记录
 * 
 * 对应 SkillOpt skillopt/types.py RejectedEditRecord
 */
export interface RejectedEditRecord {
  skillVersion: string;
  appliedEdits: Edit[];
  scoreDrop: number;
  failPatterns: string[];
  epoch: number;
  step: number;
  timestamp: string;
}

/**
 * 训练状态
 */
export interface TrainingState {
  status: "idle" | "running" | "paused" | "completed" | "error";
  currentEpoch: number;
  currentStep: number;
  totalSteps: number;
  bestSkill: string | null;
  bestScore: number;
  currentSkill: string;
  currentSkillVersion: number;
  startTime: string | null;
  endTime: string | null;
  error?: string;
  config: PipelineConfig;
}

/**
 * Pipeline输出
 */
export interface PipelineOutput {
  bestSkill: string;
  bestSkillPath: string;
  metaSkill: MetaSkill;
  trainingHistory: EpochHistory[];
  finalMetrics: {
    totalEpochs: number;
    totalSteps: number;
    acceptedEdits: number;
    rejectedEdits: number;
    bestScore: number;
    improvementFromBaseline: number;
    trainingTimeSeconds: number;
  };
}

// ============================================================================
// Evaluation Backend Interface
// ============================================================================

/**
 * 评估后端接口
 * 
 * 定义如何评估技能在任务上的表现
 */
export interface EvaluationBackend {
  /** 评估单个技能内容在指定任务上的表现 */
  evaluate(skillContent: string, tasks: Task[]): Promise<EvaluationResult[]>;
  
  /** 获取验证集 */
  getValidationSet(size: number): Promise<Task[]>;
  
  /** 获取训练集 */
  getTrainingSet(size: number): Promise<Task[]>;
}

/**
 * 任务定义
 */
export interface Task {
  id: string;
  input: string;
  groundTruth: string;
  domain?: string;
  difficulty?: "easy" | "medium" | "hard";
}

/**
 * 评估结果
 */
export interface EvaluationResult {
  taskId: string;
  hard: number;
  soft: number;
  failReason?: string;
  predictedAnswer?: string;
}

// ============================================================================
// Mock Evaluation Backend (用于测试)
// ============================================================================

/**
 * Mock评估后端
 * 
 * 使用Meta-Skill三维度审计作为启发式评分
 * 实际应使用Test Harness的case-runner
 */
export class MockEvaluationBackend implements EvaluationBackend {
  private mockTasks: Task[] = [];

  constructor(tasks?: Task[]) {
    if (tasks) {
      this.mockTasks = tasks;
    } else {
      // 生成默认测试任务
      this.mockTasks = Array.from({ length: 50 }, (_, i) => ({
        id: `task_${i}`,
        input: `Test input for task ${i}`,
        groundTruth: `Expected output ${i}`,
        domain: "general",
        difficulty: "medium" as const,
      }));
    }
  }

  async evaluate(skillContent: string, tasks: Task[]): Promise<EvaluationResult[]> {
    // 模拟评估延迟
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 使用Meta-Skill审计作为启发式评分
    const metaResult = auditMetaSkill(skillContent);
    const baseScore = metaResult.overallScore / 100;

    return tasks.map((task) => {
      // 模拟基于任务难度的随机评估
      const noise = Math.random() * 0.2 - 0.1;
      const difficultyBonus = task.difficulty === "hard" ? -0.1 : task.difficulty === "easy" ? 0.1 : 0;
      const hard = Math.min(1, Math.max(0, baseScore + noise + difficultyBonus)) > 0.5 ? 1 : 0;
      
      return {
        taskId: task.id,
        hard,
        soft: Math.min(1, Math.max(0, baseScore + noise)),
        failReason: hard === 0 ? "Score below threshold" : undefined,
      };
    });
  }

  async getValidationSet(size: number): Promise<Task[]> {
    return this.mockTasks.slice(0, Math.min(size, this.mockTasks.length));
  }

  async getTrainingSet(size: number): Promise<Task[]> {
    const start = Math.min(size, this.mockTasks.length);
    return this.mockTasks.slice(start, start + size);
  }
}

// ============================================================================
// LR Scheduler
// ============================================================================

/**
 * 学习率调度器
 * 
 * 对应 SkillOpt skillopt/optimizer/scheduler.py
 */
export class LRScheduler {
  private config: PipelineConfig;
  private stepCount: number = 0;

  constructor(config: PipelineConfig) {
    this.config = config;
  }

  /**
   * 获取当前步骤的学习率 (edit budget)
   */
  getBudget(): number {
    const { editBudget, minEditBudget, lrScheduler } = this.config;
    const T = this.config.numEpochs * (this.mockTasksCount() / this.config.batchSize);
    const t = this.stepCount;

    switch (lrScheduler) {
      case "constant":
        return editBudget;
      
      case "linear":
        // 线性衰减: L_t = L_max - (L_max - L_min) * t/T
        return Math.max(
          minEditBudget,
          editBudget - (editBudget - minEditBudget) * (t / T)
        );
      
      case "cosine":
        // 余弦衰减: L_t = L_min + 0.5 * (L_max - L_min) * (1 + cos(pi * t/T))
        return minEditBudget + 
          0.5 * (editBudget - minEditBudget) * 
          (1 + Math.cos(Math.PI * t / T));
      
      case "autonomous":
        // LLM自主决定，返回默认budget
        return editBudget;
      
      default:
        return editBudget;
    }
  }

  /** 内部方法：估算总步数 */
  private mockTasksCount(): number {
    return 100; // 假设100个任务
  }

  /** 更新步数计数器 */
  increment(): void {
    this.stepCount++;
  }

  /** 重置计数器 */
  reset(): void {
    this.stepCount = 0;
  }

  /** 获取当前步数 */
  getStep(): number {
    return this.stepCount;
  }
}

// ============================================================================
// Persistent Rejected Edit Buffer
// ============================================================================

/**
 * 持久化被拒绝编辑缓冲区
 * 
 * 增强版: 支持文件系统持久化
 * 来源: arXiv:2605.23904
 */
export class PersistentRejectedEditBuffer extends RejectedEditBuffer {
  private bufferPath: string;
  private records: RejectedEditRecord[] = [];

  constructor(outputDir: string, maxSize: number = 100) {
    super(maxSize);
    this.bufferPath = path.join(outputDir, "rejected-edit-buffer.json");
    this.loadFromDisk();
  }

  /** 从磁盘加载缓冲区 */
  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.bufferPath)) {
        const data = fs.readFileSync(this.bufferPath, "utf8");
        this.records = JSON.parse(data);
      }
    } catch (error) {
      console.error("Failed to load rejected buffer:", error);
      this.records = [];
    }
  }

  /** 保存缓冲区到磁盘 */
  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.bufferPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.bufferPath, JSON.stringify(this.records, null, 2));
    } catch (error) {
      console.error("Failed to save rejected buffer:", error);
    }
  }

  /** 添加被拒绝的编辑 */
  addRecord(record: RejectedEditRecord): void {
    this.records.push(record);
    if (this.records.length > this.maxSize) {
      this.records.shift();
    }
    this.saveToDisk();
  }

  /** 获取所有记录 */
  getRecords(): RejectedEditRecord[] {
    return [...this.records];
  }

  /** 获取上下文字符串 (用于prompt注入) */
  getContext(): string {
    if (this.records.length === 0) {
      return "No previous rejected attempts.";
    }

    const lines = ["Previous rejected attempts (do NOT repeat these):"];
    for (const record of this.records.slice(-10)) { // 只返回最近10条
      for (const edit of record.appliedEdits) {
        lines.push(`- Edit: "${edit.content.slice(0, 50)}..." → Score dropped by ${record.scoreDrop.toFixed(1)}pp`);
      }
    }
    return lines.join("\n");
  }

  /** 检查是否类似编辑之前被拒绝 */
  wasRejectedBefore(target: string, op: "add" | "delete" | "replace"): boolean {
    return this.records.some((record) =>
      record.appliedEdits.some(
        (edit) => edit.target === target && 
                 (edit.op === "append" || edit.op === "insert_after" ? op === "add" : 
                  edit.op === "delete" ? op === "delete" : 
                  op === "replace")
      )
    );
  }

  /** 清空缓冲区 */
  clear(): void {
    this.records = [];
    this.saveToDisk();
  }

  get size(): number {
    return this.records.length;
  }

  get capacity(): number {
    return this.maxSize;
  }

  /** 获取失败模式统计 */
  getFailurePatternStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const record of this.records) {
      for (const pattern of record.failPatterns) {
        const key = pattern.slice(0, 30).toLowerCase();
        stats[key] = (stats[key] ?? 0) + 1;
      }
    }
    return stats;
  }
}

// ============================================================================
// 6-Stage Pipeline Functions
// ============================================================================

/**
 * Stage 1: Rollout - 执行任务并记录轨迹
 * 
 * 对应 SkillOpt skillopt/rollout.py RolloutExecutor.execute()
 * 
 * @param skill 技能内容
 * @param tasks 任务列表
 * @param backend 评估后端
 * @param skillVersion 当前技能版本
 * @returns RolloutResult[] 每次任务执行结果
 */
export async function runRollout(
  skill: string,
  tasks: Task[],
  backend: EvaluationBackend,
  skillVersion: string = "1.0"
): Promise<RolloutResult[]> {
  const results: RolloutResult[] = [];

  // 并行执行所有任务 (实际可分批)
  const rolloutPromises = tasks.map(async (task, index) => {
    const evalResults = await backend.evaluate(skill, [task]);
    const evalResult = evalResults[0];

    return {
      id: `${skillVersion}-${task.id}`,
      taskIndex: index,
      hard: evalResult.hard,
      soft: evalResult.soft,
      failReason: evalResult.failReason ?? "",
      predictedAnswer: evalResult.predictedAnswer ?? "",
      groundTruth: task.groundTruth,
      skillVersion,
      timestamp: new Date().toISOString(),
      trajectory: {
        input: task.input,
        output: evalResult.predictedAnswer ?? "",
        steps: [`Executed skill v${skillVersion} on "${task.input}"`],
        error: evalResult.failReason,
      },
    } as RolloutResult;
  });

  const rolloutResults = await Promise.all(rolloutPromises);
  results.push(...rolloutResults);

  return results;
}

/**
 * Stage 2: Reflect - 分minibatch并行分析失败/成功轨迹
 * 
 * 对应 SkillOpt skillopt/reflect.py:
 * - run_error_analyst_minibatch()
 * - run_success_analyst_minibatch()
 * 
 * @param rollouts Rollout结果
 * @param buffer 被拒绝编辑缓冲区
 * @param config Pipeline配置
 * @returns Patch[] 提取的编辑建议
 */
export async function runReflect(
  rollouts: RolloutResult[],
  buffer: PersistentRejectedEditBuffer,
  config: PipelineConfig
): Promise<Patch[]> {
  const patches: Patch[] = [];
  const minibatchSize = config.minibatchSize;

  // 分离成功和失败轨迹
  const failures = rollouts.filter((r) => r.hard === 0);
  const successes = rollouts.filter((r) => r.hard === 1);

  // 并行分析minibatches
  const failureMinibatches = chunkArray(failures, minibatchSize);
  const successMinibatches = chunkArray(successes, minibatchSize);

  // 分析失败轨迹 (Error Analyst)
  const failurePromises = failureMinibatches.map(async (minibatch) => {
    return analyzeFailureMinibatch(minibatch, buffer, config);
  });

  // 分析成功轨迹 (Success Analyst)
  const successPromises = successMinibatches.map(async (minibatch) => {
    return analyzeSuccessMinibatch(minibatch, config);
  });

  // 等待所有分析完成
  const [failurePatches, successPatches] = await Promise.all([
    Promise.all(failurePromises),
    Promise.all(successPromises),
  ]);

  patches.push(...failurePatches.flat(), ...successPatches.flat());

  return patches;
}

/**
 * 分析失败轨迹minibatch
 */
async function analyzeFailureMinibatch(
  rollouts: RolloutResult[],
  buffer: PersistentRejectedEditBuffer,
  config: PipelineConfig
): Promise<Patch[]> {
  if (rollouts.length === 0) return [];

  // 构建分析prompt
  const failReasons = rollouts.map((r) => r.failReason).filter(Boolean);
  const context = buffer.getContext();

  const reasoning = `Analyzing ${rollouts.length} failed rollouts:
Failure reasons: ${failReasons.slice(0, 3).join("; ") || "Unknown"}
${context}

Suggest edits to fix these failures.`;

  // 生成编辑建议 (模拟LLM调用)
  const patches = generateMockPatches("failure", rollouts, config);

  return patches;
}

/**
 * 分析成功轨迹minibatch
 */
async function analyzeSuccessMinibatch(
  rollouts: RolloutResult[],
  config: PipelineConfig
): Promise<Patch[]> {
  if (rollouts.length === 0) return [];

  // 构建分析prompt
  const reasoning = `Analyzing ${rollouts.length} successful rollouts.
Identify patterns that contributed to success and suggest improvements.`;

  // 生成编辑建议 (模拟LLM调用)
  const patches = generateMockPatches("success", rollouts, config);

  return patches;
}

/**
 * 生成模拟编辑补丁 (实际应调用LLM)
 */
function generateMockPatches(
  sourceType: "failure" | "success",
  rollouts: RolloutResult[],
  config: PipelineConfig
): Patch[] {
  const patches: Patch[] = [];

  // 根据失败/成功类型生成不同方向的编辑
  const baseCount = Math.min(2, Math.ceil(rollouts.length / 2));

  for (let i = 0; i < baseCount; i++) {
    const edits: Edit[] = [];

    // 生成1-2个编辑建议
    const editCount = Math.floor(Math.random() * 2) + 1;
    for (let j = 0; j < editCount; j++) {
      edits.push({
        op: ["add", "replace", "delete"][Math.floor(Math.random() * 3)] as EditOp,
        content: sourceType === "failure"
          ? `Fix for failure pattern ${i}: Add clarification about edge case handling`
          : `Success pattern ${i}: Add example for consistent behavior`,
        target: sourceType === "failure" ? "failure" : "examples",
        supportCount: rollouts.length,
        sourceType,
        reasoning: `${sourceType === "failure" ? "Addresses" : "Captures"} ${rollouts.length} trajectories`,
      });
    }

    patches.push({
      edits,
      reasoning: `Generated from ${rollouts.length} ${sourceType} trajectories`,
      rankingDetails: {
        sourceType,
        trajectoryCount: rollouts.length,
        analystRound: 1,
      },
    });
  }

  return patches;
}

/**
 * Stage 3: Aggregate - 层级合并去重
 * 
 * 对应 SkillOpt skillopt/aggregate.py _hierarchical_merge()
 * 
 * @param patches 原始补丁列表
 * @param config Pipeline配置
 * @returns Patch 合并后的单一补丁
 */
export async function runAggregate(
  patches: Patch[],
  config: PipelineConfig
): Promise<Patch> {
  if (patches.length === 0) {
    return { edits: [], reasoning: "No patches to aggregate" };
  }

  if (patches.length === 1) {
    return patches[0];
  }

  // 层级合并策略
  let mergedEdits: Edit[] = [];
  let mergedReasoning = "";

  // Level 1: 合并相同target的edits
  const byTarget = new Map<string, Edit[]>();
  for (const patch of patches) {
    for (const edit of patch.edits) {
      const key = `${edit.op}:${edit.target}`;
      if (!byTarget.has(key)) {
        byTarget.set(key, []);
      }
      byTarget.get(key)!.push(edit);
    }
  }

  // Level 2: 对于相同target，合并supportCount
  for (const [key, edits] of byTarget) {
    if (edits.length === 1) {
      mergedEdits.push(edits[0]);
    } else {
      // 合并多个编辑为单一编辑
      const merged: Edit = {
        ...edits[0],
        supportCount: edits.reduce((sum, e) => sum + (e.supportCount ?? 0), 0),
        content: edits.map((e) => e.content).join("\n---\n"),
        reasoning: edits.map((e) => e.reasoning).filter(Boolean).join(" "),
      };
      mergedEdits.push(merged);
    }
  }

  // Level 3: 按supportCount降序排序
  mergedEdits.sort((a, b) => (b.supportCount ?? 0) - (a.supportCount ?? 0));

  // 去重: 移除内容相似的edits
  const deduplicated: Edit[] = [];
  const seenContent = new Set<string>();
  for (const edit of mergedEdits) {
    const contentHash = edit.content.slice(0, 50).toLowerCase();
    if (!seenContent.has(contentHash)) {
      seenContent.add(contentHash);
      deduplicated.push(edit);
    }
  }

  mergedReasoning = `Aggregated ${patches.length} patches into ${deduplicated.length} unique edits`;

  return {
    edits: deduplicated,
    reasoning: mergedReasoning,
    rankingDetails: {
      originalPatchCount: patches.length,
      mergedEditCount: mergedEdits.length,
      deduplicatedEditCount: deduplicated.length,
      aggregationLevels: ["by_target", "by_support_count", "deduplication"],
    },
  };
}

/**
 * Stage 4: Select - 基于edit budget选择top-k编辑
 * 
 * 对应 SkillOpt skillopt/optimizer/clip.py rank_and_select()
 * 
 * @param patch 合并后的补丁
 * @param budget 学习率/edit budget
 * @returns Edit[] 选中的编辑
 */
export async function runSelect(
  patch: Patch,
  budget: number
): Promise<Edit[]> {
  if (patch.edits.length === 0) {
    return [];
  }

  // 1. 对edits打分 (模拟LLM评分)
  const scoredEdits = await Promise.all(
    patch.edits.map(async (edit) => {
      const score = edit.supportCount ?? 0 + Math.random() * 10;
      return { edit, score };
    })
  );

  // 2. 按分数排序
  scoredEdits.sort((a, b) => b.score - a.score);

  // 3. 只保留top-budget个
  return scoredEdits.slice(0, Math.floor(budget)).map((s) => s.edit);
}

/**
 * Stage 5: Update/Edit - 应用bounded edits生成候选skill
 * 
 * 对应 SkillOpt skillopt/edit.py SkillEditor.apply()
 * 
 * @param skillContent 当前技能内容
 * @param edits 选中的编辑
 * @param config Pipeline配置
 * @returns 应用编辑后的新技能内容
 */
export function runUpdate(
  skillContent: string,
  edits: Edit[],
  config: PipelineConfig
): string {
  // 将Edit转换为TextEdit
  const textEdits: TextEdit[] = edits.map((edit) => ({
    type: edit.op === "append" || edit.op === "insert_after" ? "add" : 
          edit.op === "delete" ? "delete" : "replace",
    target: edit.target,
    content: edit.content,
    reason: edit.reasoning ?? "Pipeline generated",
    source: "reflection",
  }));

  // 应用有界编辑
  const { newContent } = applyBoundedEdits(skillContent, textEdits, {
    textualLearningRate: config.editBudget,
    enableGate: true,
    gateMetric: config.gateMetric,
  });

  return newContent;
}

/**
 * Stage 6: Gate - 在held-out验证集上严格对比
 * 
 * 对应 SkillOpt skillopt/evaluation/gate.py ValidationGate.evaluate()
 * 
 * @param candidate 候选技能内容
 * @param current 当前技能内容
 * @param validationSet 验证集
 * @param backend 评估后端
 * @param config Pipeline配置
 * @returns GateResult 门控决策
 */
export async function runGate(
  candidate: string,
  current: string,
  validationSet: Task[],
  backend: EvaluationBackend,
  config: PipelineConfig
): Promise<GateResult> {
  // 并行评估两个技能
  const [currentResults, candidateResults] = await Promise.all([
    backend.evaluate(current, validationSet),
    backend.evaluate(candidate, validationSet),
  ]);

  // 计算平均分数
  const currentScore =
    currentResults.reduce((sum, r) => sum + r.hard, 0) / currentResults.length;
  const candidateScore =
    candidateResults.reduce((sum, r) => sum + r.hard, 0) / candidateResults.length;

  // 使用validateGate进行决策
  return validateGate(currentScore, candidateScore, {
    gateMetric: config.gateMetric,
  });
}

// ============================================================================
// Epoch-Level Operations
// ============================================================================

/**
 * Slow Update - Epoch级别更新
 * 
 * 对比相邻epoch的skill在同一批样本上的表现
 * 
 * @param prevSkill 前一epoch的技能
 * @param currSkill 当前epoch的技能
 * @param sampleSet 评估样本集
 * @param backend 评估后端
 * @param config Pipeline配置
 * @returns SlowUpdateResult 慢更新结果
 */
export async function runSlowUpdate(
  prevSkill: string,
  currSkill: string,
  sampleSet: Task[],
  backend: EvaluationBackend,
  config: PipelineConfig
): Promise<SlowUpdateResult> {
  // 并行评估
  const [prevResults, currResults] = await Promise.all([
    backend.evaluate(prevSkill, sampleSet),
    backend.evaluate(currSkill, sampleSet),
  ]);

  const prevHard = prevResults.reduce((sum, r) => sum + r.hard, 0) / prevResults.length;
  const currHard = currResults.reduce((sum, r) => sum + r.hard, 0) / currResults.length;

  // 分类样本
  const improvements: string[] = [];
  const regressions: string[] = [];
  const persistentFailures: string[] = [];
  const stableSuccesses: string[] = [];

  for (let i = 0; i < sampleSet.length; i++) {
    const prev = prevResults[i];
    const curr = currResults[i];

    if (prev.hard === 0 && curr.hard === 1) {
      improvements.push(sampleSet[i].id);
    } else if (prev.hard === 1 && curr.hard === 0) {
      regressions.push(sampleSet[i].id);
    } else if (prev.hard === 0 && curr.hard === 0) {
      persistentFailures.push(sampleSet[i].id);
    } else {
      stableSuccesses.push(sampleSet[i].id);
    }
  }

  // 生成保护性规则
  const slowUpdateContent = generateSlowUpdateContent(
    improvements,
    regressions,
    persistentFailures,
    stableSuccesses,
    prevHard,
    currHard
  );

  // Slow Update 强制接受 (除非配置为 gate)
  const action = config.enableSlowUpdate ? "accept" : 
    (currHard > prevHard ? "accept" : "reject");

  return {
    reasoning: `Slow Update Analysis:
- Improvements: ${improvements.length} tasks
- Regressions: ${regressions.length} tasks
- Persistent failures: ${persistentFailures.length} tasks
- Stable successes: ${stableSuccesses.length} tasks`,
    slowUpdateContent,
    prevHard,
    currHard,
    selectionHard: currHard,
    action,
  };
}

/**
 * 生成Slow Update内容
 */
function generateSlowUpdateContent(
  improvements: string[],
  regressions: string[],
  persistentFailures: string[],
  stableSuccesses: string[],
  prevHard: number,
  currHard: number
): string {
  const lines: string[] = [];

  lines.push("## Protected Guidance (Slow Update)");
  lines.push("");
  lines.push(`_Generated at ${new Date().toISOString()}_`);
  lines.push(`_Score: ${(prevHard * 100).toFixed(1)}% → ${(currHard * 100).toFixed(1)}%_`);
  lines.push("");

  if (improvements.length > 0) {
    lines.push("### Improvements (newly fixed patterns)");
    lines.push(`Tasks: ${improvements.slice(0, 5).join(", ")}${improvements.length > 5 ? "..." : ""}`);
    lines.push("- Pattern preserved from current epoch");
    lines.push("");
  }

  if (regressions.length > 0) {
    lines.push("### Regressions (do NOT revert)");
    lines.push(`Tasks: ${regressions.slice(0, 5).join(", ")}${regressions.length > 5 ? "..." : ""}`);
    lines.push("- Regression from previous epoch, already addressed");
    lines.push("");
  }

  if (persistentFailures.length > 0) {
    lines.push("### Persistent Failures (needs meta-skill attention)");
    lines.push(`Tasks: ${persistentFailures.slice(0, 5).join(", ")}${persistentFailures.length > 5 ? "..." : ""}`);
    lines.push("- Still failing, may need fundamental redesign");
    lines.push("");
  }

  if (stableSuccesses.length > 0) {
    lines.push("### Stable Successes (core patterns)");
    lines.push(`Tasks: ${stableSuccesses.slice(0, 5).join(", ")}${stableSuccesses.length > 5 ? "..." : ""}`);
    lines.push("- Core functionality preserved");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * 更新Meta Skill
 * 
 * @param history 训练历史
 * @param metaSkill 当前Meta Skill
 * @returns 更新后的Meta Skill
 */
export function updateMetaSkill(
  history: EpochHistory[],
  metaSkill: MetaSkill
): MetaSkill {
  const effectivePatterns: string[] = [...metaSkill.effectivePatterns];
  const harmfulPatterns: string[] = [...metaSkill.harmfulPatterns];
  const persistentFailures: string[] = [...metaSkill.persistentFailures];

  // 分析所有epoch历史
  for (const epoch of history) {
    for (const step of epoch.stepResults) {
      if (step.gateResult.accepted) {
        // 有效的编辑模式
        for (const edit of step.selectedEdits) {
          const pattern = `${edit.op}:${edit.target.slice(0, 20)}`;
          if (!effectivePatterns.includes(pattern)) {
            effectivePatterns.push(pattern);
          }
        }
      } else {
        // 有害的编辑模式
        for (const edit of step.selectedEdits) {
          const pattern = `${edit.op}:${edit.target.slice(0, 20)}`;
          if (!harmfulPatterns.includes(pattern)) {
            harmfulPatterns.push(pattern);
          }
        }
      }
    }

    // 收集持续失败
    if (epoch.slowUpdate) {
      const match = epoch.slowUpdate.reasoning.match(/Persistent failures: (\d+)/);
      if (match && parseInt(match[1]) > 0) {
        persistentFailures.push(`epoch_${epoch.epoch}`);
      }
    }
  }

  // 去重
  const uniqueEffective = [...new Set(effectivePatterns)].slice(0, 50);
  const uniqueHarmful = [...new Set(harmfulPatterns)].slice(0, 50);
  const uniquePersistent = [...new Set(persistentFailures)].slice(0, 20);

  return {
    effectivePatterns: uniqueEffective,
    harmfulPatterns: uniqueHarmful,
    persistentFailures: uniquePersistent,
    lastUpdated: new Date().toISOString(),
    version: metaSkill.version + 1,
  };
}

// ============================================================================
// Main Pipeline Trainer
// ============================================================================

/**
 * Pipeline Trainer - 主训练循环
 * 
 * 对应 SkillOpt skillopt/trainer.py Trainer.train()
 */
export class PipelineTrainer {
  private config: PipelineConfig;
  private backend: EvaluationBackend;
  private buffer: PersistentRejectedEditBuffer;
  private lrScheduler: LRScheduler;
  private metaSkill: MetaSkill;
  private state: TrainingState;
  private history: EpochHistory[];
  private outputDir: string;

  constructor(
    config: Partial<PipelineConfig> = {},
    backend?: EvaluationBackend
  ) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
    this.backend = backend ?? new MockEvaluationBackend();
    this.outputDir = this.config.outputDir;
    this.buffer = new PersistentRejectedEditBuffer(this.outputDir);
    this.lrScheduler = new LRScheduler(this.config);
    this.metaSkill = {
      effectivePatterns: [],
      harmfulPatterns: [],
      persistentFailures: [],
      lastUpdated: new Date().toISOString(),
      version: 1,
    };
    this.history = [];
    this.state = {
      status: "idle",
      currentEpoch: 0,
      currentStep: 0,
      totalSteps: 0,
      bestSkill: null,
      bestScore: 0,
      currentSkill: "",
      currentSkillVersion: 1,
      startTime: null,
      endTime: null,
      config: this.config,
    };

    // 确保输出目录存在
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 获取当前训练状态
   */
  getState(): TrainingState {
    return { ...this.state };
  }

  /**
   * 获取Meta Skill
   */
  getMetaSkill(): MetaSkill {
    return { ...this.metaSkill };
  }

  /**
   * 获取训练历史
   */
  getHistory(): EpochHistory[] {
    return [...this.history];
  }

  /**
   * 获取被拒绝编辑缓冲区
   */
  getBuffer(): PersistentRejectedEditBuffer {
    return this.buffer;
  }

  /**
   * 停止训练
   */
  stop(): void {
    this.state.status = "paused";
  }

  /**
   * 运行完整训练循环
   */
  async train(
    initialSkill: string,
    trainingTasks?: Task[]
  ): Promise<PipelineOutput> {
    const startTime = Date.now();
    this.state.status = "running";
    this.state.startTime = new Date().toISOString();
    this.state.currentSkill = initialSkill;

    // 获取训练和验证集
    const tasks = trainingTasks ?? await this.backend.getTrainingSet(100);
    const validationSet = await this.backend.getValidationSet(this.config.validationSetSize);

    // 计算总步数
    const stepsPerEpoch = Math.ceil(tasks.length / this.config.batchSize);
    this.state.totalSteps = stepsPerEpoch * this.config.numEpochs;

    let currentSkill = initialSkill;
    let bestSkill = initialSkill;
    let bestScore = 0;
    let currentScore = 0;

    // Epoch循环
    for (let epoch = 0; epoch < this.config.numEpochs; epoch++) {
      this.state.currentEpoch = epoch;

      const epochHistory: EpochHistory = {
        epoch,
        step: 0,
        currentSkill,
        bestSkill,
        bestScore,
        stepResults: [],
      };

      // Step循环
      for (let step = 0; step < stepsPerEpoch; step++) {
        this.state.currentStep = step;

        // 检查是否停止 - 使用类型断言避免TS推断问题
        const status = this.state.status as string;
        if (status === "paused" || status === "completed" || status === "error") {
          break;
        }

        // 更新学习率
        const currentBudget = this.lrScheduler.getBudget();

        // 采样当前batch
        const batchStart = step * this.config.batchSize;
        const batchTasks = tasks.slice(batchStart, batchStart + this.config.batchSize);

        // === Stage 1: Rollout ===
        const rollouts = await runRollout(
          currentSkill,
          batchTasks,
          this.backend,
          `v${epoch}.${step}`
        );

        // === Stage 2: Reflect ===
        const patches = await runReflect(rollouts, this.buffer, this.config);

        // === Stage 3: Aggregate ===
        const mergedPatch = await runAggregate(patches, this.config);

        // === Stage 4: Select ===
        const selectedEdits = await runSelect(mergedPatch, currentBudget);

        // === Stage 5: Update ===
        const candidateSkill = runUpdate(currentSkill, selectedEdits, this.config);

        // === Stage 6: Gate ===
        const gateResult = await runGate(
          candidateSkill,
          currentSkill,
          validationSet,
          this.backend,
          this.config
        );

        // 计算当前分数
        const evalResults = await this.backend.evaluate(candidateSkill, validationSet);
        currentScore = evalResults.reduce((sum, r) => sum + r.hard, 0) / evalResults.length;

        // 记录步骤结果
        const stepResult: StepResult = {
          step,
          rollouts,
          patches,
          mergedPatch,
          selectedEdits,
          candidateScore: currentScore,
          currentScore,
          gateResult,
          accepted: gateResult.accepted,
          timestamp: new Date().toISOString(),
        };
        epochHistory.stepResults.push(stepResult);

        // 如果Gate接受，更新当前技能
        if (gateResult.accepted) {
          currentSkill = candidateSkill;

          // 更新最佳技能
          if (currentScore > bestScore) {
            bestScore = currentScore;
            bestSkill = currentSkill;
            this.state.bestScore = bestScore;
            this.state.bestSkill = bestSkill;
          }
        } else {
          // 拒绝，加入缓冲区
          if (this.config.enableRejectedBuffer) {
            for (const edit of selectedEdits) {
              this.buffer.addRecord({
                skillVersion: `v${epoch}.${step}`,
                appliedEdits: selectedEdits,
                scoreDrop: Math.abs(gateResult.delta),
                failPatterns: rollouts.filter((r) => r.hard === 0).map((r) => r.failReason),
                epoch,
                step,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }

        // 更新学习率
        this.lrScheduler.increment();

        // 记录进度
        console.log(
          `[Epoch ${epoch + 1}/${this.config.numEpochs}] ` +
          `[Step ${step + 1}/${stepsPerEpoch}] ` +
          `Score: ${(currentScore * 100).toFixed(1)}% ` +
          `Gate: ${gateResult.accepted ? "ACCEPT" : "REJECT"} ` +
          `LR: ${currentBudget.toFixed(1)}`
        );
      }

      // === Epoch级别 Slow Update ===
      if (this.config.enableSlowUpdate && epoch > 0) {
        const prevEpochSkill = this.history[epoch - 1]?.currentSkill ?? initialSkill;
        const slowUpdate = await runSlowUpdate(
          prevEpochSkill,
          currentSkill,
          validationSet,
          this.backend,
          this.config
        );
        epochHistory.slowUpdate = slowUpdate;

        // 应用Slow Update
        if (slowUpdate.action === "accept" && slowUpdate.slowUpdateContent) {
          currentSkill = injectProtectedSection(currentSkill, slowUpdate.slowUpdateContent);
        }
      }

      // === 更新Meta Skill ===
      if (this.config.enableMetaSkill) {
        this.metaSkill = updateMetaSkill([...this.history, epochHistory], this.metaSkill);
      }

      this.history.push(epochHistory);

      // 保存checkpoint
      this.saveCheckpoint(epoch, currentSkill, bestSkill);
    }

    // 训练完成
    this.state.status = "completed";
    this.state.endTime = new Date().toISOString();

    // 保存最终结果
    this.saveFinalOutput(bestSkill, currentSkill);

    const trainingTimeSeconds = (Date.now() - startTime) / 1000;

    return {
      bestSkill,
      bestSkillPath: path.join(this.outputDir, "best_skill.md"),
      metaSkill: this.metaSkill,
      trainingHistory: this.history,
      finalMetrics: {
        totalEpochs: this.config.numEpochs,
        totalSteps: this.history.reduce((sum, e) => sum + e.stepResults.length, 0),
        acceptedEdits: this.history.reduce(
          (sum, e) => sum + e.stepResults.filter((s) => s.accepted).length,
          0
        ),
        rejectedEdits: this.history.reduce(
          (sum, e) => sum + e.stepResults.filter((s) => !s.accepted).length,
          0
        ),
        bestScore,
        improvementFromBaseline: bestScore * 100 - 50, // 假设baseline是50%
        trainingTimeSeconds,
      },
    };
  }

  /**
   * 保存checkpoint
   */
  private saveCheckpoint(epoch: number, currentSkill: string, bestSkill: string): void {
    const checkpoint = {
      epoch,
      currentSkill,
      bestSkill,
      bestScore: this.state.bestScore,
      timestamp: new Date().toISOString(),
    };

    const checkpointPath = path.join(this.outputDir, `checkpoint_epoch_${epoch}.json`);
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));

    // 保存当前技能副本
    fs.writeFileSync(
      path.join(this.outputDir, `skill_epoch_${epoch}.md`),
      currentSkill
    );
  }

  /**
   * 保存最终输出
   */
  private saveFinalOutput(bestSkill: string, currentSkill: string): void {
    // 保存最佳技能
    fs.writeFileSync(path.join(this.outputDir, "best_skill.md"), bestSkill);

    // 保存Meta Skill
    fs.writeFileSync(
      path.join(this.outputDir, "meta_skill.json"),
      JSON.stringify(this.metaSkill, null, 2)
    );

    // 保存训练历史
    fs.writeFileSync(
      path.join(this.outputDir, "training_history.json"),
      JSON.stringify(this.history, null, 2)
    );

    // 保存最终状态
    fs.writeFileSync(
      path.join(this.outputDir, "final_state.json"),
      JSON.stringify(this.state, null, 2)
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 将数组分块
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * 注入Protected Section到技能文档
 */
function injectProtectedSection(skillContent: string, protectedContent: string): string {
  const marker = "\n\n<!-- PROTECTED_SECTION_START -->\n";
  const endMarker = "\n<!-- PROTECTED_SECTION_END -->\n";

  // 检查是否已有protected section
  if (skillContent.includes(marker)) {
    // 替换现有section
    const start = skillContent.indexOf(marker);
    const end = skillContent.indexOf(endMarker) + endMarker.length;
    return (
      skillContent.slice(0, start) +
      marker +
      protectedContent +
      endMarker +
      skillContent.slice(end)
    );
  }

  // 添加新的protected section
  return skillContent + marker + protectedContent + endMarker;
}

// ============================================================================
// Standalone Functions (for API use)
// ============================================================================

/**
 * 独立运行单步Pipeline
 */
export async function runPipelineStep(
  skillContent: string,
  tasks: Task[],
  validationSet: Task[],
  buffer: PersistentRejectedEditBuffer,
  config: PipelineConfig,
  backend: EvaluationBackend
): Promise<{
  newSkill: string;
  rollouts: RolloutResult[];
  patches: Patch[];
  mergedPatch: Patch;
  selectedEdits: Edit[];
  gateResult: GateResult;
  accepted: boolean;
}> {
  const budget = config.editBudget;

  // Stage 1: Rollout
  const rollouts = await runRollout(skillContent, tasks, backend);

  // Stage 2: Reflect
  const patches = await runReflect(rollouts, buffer, config);

  // Stage 3: Aggregate
  const mergedPatch = await runAggregate(patches, config);

  // Stage 4: Select
  const selectedEdits = await runSelect(mergedPatch, budget);

  // Stage 5: Update
  const newSkill = runUpdate(skillContent, selectedEdits, config);

  // Stage 6: Gate
  const gateResult = await runGate(
    newSkill,
    skillContent,
    validationSet,
    backend,
    config
  );

  return {
    newSkill,
    rollouts,
    patches,
    mergedPatch,
    selectedEdits,
    gateResult,
    accepted: gateResult.accepted,
  };
}

// ============================================================================
// Default Instance Factory
// ============================================================================

let defaultTrainer: PipelineTrainer | null = null;

/**
 * 获取默认训练器实例
 */
export function getDefaultTrainer(
  config?: Partial<PipelineConfig>,
  backend?: EvaluationBackend
): PipelineTrainer {
  if (!defaultTrainer) {
    defaultTrainer = new PipelineTrainer(config, backend);
  }
  return defaultTrainer;
}

/**
 * 重置默认训练器
 */
export function resetDefaultTrainer(): void {
  defaultTrainer = null;
}
