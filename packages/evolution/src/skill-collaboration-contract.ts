/**
 * Skill Collaboration Contract - 协作契约模块
 * v3.5: 对标 CooperBench (Stanford HAI 2026) — 解决"协作诅咒"
 *
 * 核心问题（来自 CooperBench 研究）：
 * - 双 Agent 协作比单 Agent 性能下降 50%（GPT-5: 27.95% vs ~50%）
 * - 三维根因：预期失效 42% / 承诺失效 32% / 沟通失效 26%
 * - Git 访问边际改善仅 1-2%（无统计显著性）
 *
 * 论文核心建议：
 * - 承诺验证系统（Commitment Verification System）
 * - 类合同协议（含签名）
 * - 角色分工 / 资源切分 / 谈判共识 三种成功模式
 *
 * SelfClaw 适配设计：
 * - 每个 Plan → 1 个 CollaborationContract
 * - 每个 Task → 1 个 Commitment（自动创建）
 * - 4 类违约检测：空间冲突 / 语义冲突 / 承诺未兑现 / 时间冲突
 * - 协作分数 0-1：承诺履约率 × 0.6 + 无冲突率 × 0.4
 */

import type { Task, TaskType } from "./skill-orchestrator.js";

// ============================================================================
// 状态枚举
// ============================================================================

/** 契约状态 */
export type ContractStatus =
  | "PENDING"     // 契约已创建，待激活
  | "ACTIVE"      // 契约生效中
  | "PAUSED"      // 暂停（检测到违约风险）
  | "FULFILLED"   // 所有承诺履约完成
  | "BROKEN";     // 因严重违约而终止

/** 承诺类型（对标 CooperBench 成功模式） */
export type CommitmentType =
  | "ROLE_ASSIGNMENT"       // 角色/责任分配
  | "RESOURCE_BOUNDARY"     // 资源边界（只改 X 文件 Y 行）
  | "FEATURE_IMPLEMENTATION" // 功能实现
  | "SYNC_POINT";           // 等待/同步点

/** 承诺状态机：PENDING → ACKNOWLEDGED → IN_PROGRESS → VERIFIED | BROKEN */
export type CommitmentStatus =
  | "PENDING"
  | "ACKNOWLEDGED"
  | "IN_PROGRESS"
  | "VERIFIED"
  | "BROKEN"
  | "EXPIRED";  // 超时未确认

/** 违约类型 */
export type ViolationType = "SPATIAL" | "SEMANTIC" | "UNFULFILLED" | "TIMING";

// ============================================================================
// 核心类型
// ============================================================================

/** 资源边界（CooperBench 资源切分模式） */
export interface ResourceBoundary {
  /** 边界文件路径 */
  file?: string;
  /** 起始行号 */
  startLine?: number;
  /** 结束行号 */
  endLine?: number;
  /** 函数名/类名（更精确的边界） */
  symbol?: string;
}

/** 承诺 */
export interface Commitment {
  id: string;
  type: CommitmentType;
  /** 自然语言描述 */
  description: string;
  /** 资源边界（仅 RESOURCE_BOUNDARY 类型） */
  resourceBoundary?: ResourceBoundary;
  /** 承诺方（Task ID） */
  owner: string;
  /** 受益方（Task ID，可选） */
  assignee?: string;
  status: CommitmentStatus;
  createdAt: number;
  acknowledgedAt?: number;
  verifiedAt?: number;
  brokenAt?: number;
  breakReason?: string;
}

/** 冲突记录 */
export interface ConflictRecord {
  id: string;
  timestamp: number;
  type: ViolationType;
  involvedCommitments: string[];
  description: string;
  resolution?: string;
}

/** 协作契约 */
export interface CollaborationContract {
  id: string;
  /** 关联 Plan ID */
  planId: string;
  status: ContractStatus;
  /** 参与方（Task ID 列表） */
  parties: string[];
  commitments: Commitment[];
  /** 元数据 */
  metadata: {
    createdAt: number;
    activatedAt?: number;
    completedAt?: number;
    version: number;
  };
  /** 冲突历史 */
  conflictHistory: ConflictRecord[];
}

/** 违约结果 */
export interface ViolationResult {
  type: ViolationType;
  /** 涉及的承诺 ID */
  commitmentId: string;
  /** 期望（契约） */
  expected: string;
  /** 实际 */
  actual: string;
  /** 严重度 */
  severity: "info" | "warn" | "critical";
  /** 检测时间 */
  detectedAt: number;
}

/** 承诺执行结果（每个 Task 完成后） */
export interface CommitmentExecution {
  commitmentId: string;
  taskId: string;
  fulfilled: boolean;
  evidence?: string;
  actualResourceBoundary?: ResourceBoundary;
}

/** 协调建议（对标 CooperBench 三种成功模式） */
export interface CoordinationSuggestion {
  type: "ROLE_DIVISION" | "RESOURCE_DIVISION" | "NEGOTIATION" | "SYNC_CHECK";
  priority: "LOW" | "MEDIUM" | "HIGH";
  suggestion: string;
  affectedTasks?: string[];
  expectedOutcome: string;
  /** 预期改善的失败类型 + 百分比 */
  expectedImprovement?: { failureType: string; reduction: string };
}

/** 协作分数（CooperBench 风格） */
export interface CollaborationScore {
  /** 总体分数 0-1 */
  overall: number;
  /** 承诺履约率（VERIFIED / 总承诺） */
  fulfillmentRate: number;
  /** 无冲突率（1 - 冲突数/总任务数） */
  conflictFreeRate: number;
  /** 警告/沟通响应率 */
  responseRate: number;
  /** 三类失败计数（对标 CooperBench 三维根因） */
  failureBreakdown: {
    expectation: number;  // 预期失效 42%
    commitment: number;   // 承诺失效 32%
    communication: number; // 沟通失效 26%
  };
  /** 评级 */
  rating: "excellent" | "good" | "fair" | "poor";
}

// ============================================================================
// 内部存储
// ============================================================================

const contracts = new Map<string, CollaborationContract>();
let contractCounter = 0;
let commitmentCounter = 0;
let conflictCounter = 0;
let violationCounter = 0;

/** 生成契约 ID */
function generateContractId(): string {
  return `contract-${Date.now()}-${(++contractCounter).toString().padStart(4, "0")}`;
}

/** 生成承诺 ID */
function generateCommitmentId(): string {
  return `commit-${Date.now()}-${(++commitmentCounter).toString().padStart(4, "0")}`;
}

/** 生成冲突 ID */
function generateConflictId(): string {
  return `conflict-${Date.now()}-${(++conflictCounter).toString().padStart(4, "0")}`;
}

/** 生成违约 ID（用于历史） */
function generateViolationId(): string {
  return `violation-${Date.now()}-${(++violationCounter).toString().padStart(4, "0")}`;
}

// ============================================================================
// 契约生命周期管理
// ============================================================================

/**
 * 创建协作契约
 */
export function createContract(planId: string, parties: string[]): CollaborationContract {
  const id = generateContractId();
  const contract: CollaborationContract = {
    id,
    planId,
    status: "PENDING",
    parties,
    commitments: [],
    metadata: {
      createdAt: Date.now(),
      version: 1,
    },
    conflictHistory: [],
  };
  contracts.set(id, contract);
  return contract;
}

/**
 * 激活契约
 */
export function activateContract(contractId: string): CollaborationContract | null {
  const contract = contracts.get(contractId);
  if (!contract) return null;
  contract.status = "ACTIVE";
  contract.metadata.activatedAt = Date.now();
  return contract;
}

/**
 * 暂停契约（检测到违约风险）
 */
export function pauseContract(contractId: string, reason: string): CollaborationContract | null {
  const contract = contracts.get(contractId);
  if (!contract) return null;
  contract.status = "PAUSED";
  contract.metadata.version++;
  contract.conflictHistory.push({
    id: generateConflictId(),
    timestamp: Date.now(),
    type: "SPATIAL",
    involvedCommitments: [],
    description: `契约暂停: ${reason}`,
  });
  return contract;
}

/**
 * 终止契约
 */
export function terminateContract(contractId: string, reason: string): CollaborationContract | null {
  const contract = contracts.get(contractId);
  if (!contract) return null;
  contract.status = reason.includes("履约") ? "FULFILLED" : "BROKEN";
  contract.metadata.completedAt = Date.now();
  return contract;
}

/**
 * 获取契约
 */
export function getContract(contractId: string): CollaborationContract | null {
  return contracts.get(contractId) ?? null;
}

/**
 * 通过 planId 获取契约
 */
export function getContractByPlanId(planId: string): CollaborationContract | null {
  for (const contract of contracts.values()) {
    if (contract.planId === planId) return contract;
  }
  return null;
}

// ============================================================================
// 承诺管理
// ============================================================================

/**
 * 创建承诺
 */
export function createCommitment(
  contractId: string,
  type: CommitmentType,
  description: string,
  owner: string,
  options?: { assignee?: string; resourceBoundary?: ResourceBoundary }
): Commitment | null {
  const contract = contracts.get(contractId);
  if (!contract) return null;

  const commitment: Commitment = {
    id: generateCommitmentId(),
    type,
    description,
    resourceBoundary: options?.resourceBoundary,
    owner,
    assignee: options?.assignee,
    status: "PENDING",
    createdAt: Date.now(),
  };
  contract.commitments.push(commitment);
  return commitment;
}

/**
 * 确认承诺
 */
export function acknowledgeCommitment(contractId: string, commitmentId: string): Commitment | null {
  const contract = contracts.get(contractId);
  if (!contract) return null;
  const commitment = contract.commitments.find(c => c.id === commitmentId);
  if (!commitment) return null;
  commitment.status = "ACKNOWLEDGED";
  commitment.acknowledgedAt = Date.now();
  return commitment;
}

/**
 * 更新承诺状态为执行中
 */
export function markCommitmentInProgress(contractId: string, commitmentId: string): Commitment | null {
  const contract = contracts.get(contractId);
  if (!contract) return null;
  const commitment = contract.commitments.find(c => c.id === commitmentId);
  if (!commitment) return null;
  commitment.status = "IN_PROGRESS";
  return commitment;
}

/**
 * 验证承诺（任务完成后调用）
 */
export function verifyCommitment(
  contractId: string,
  commitmentId: string,
  result: { success: boolean; evidence?: string }
): Commitment | null {
  const contract = contracts.get(contractId);
  if (!contract) return null;
  const commitment = contract.commitments.find(c => c.id === commitmentId);
  if (!commitment) return null;

  if (result.success) {
    commitment.status = "VERIFIED";
    commitment.verifiedAt = Date.now();
  } else {
    commitment.status = "BROKEN";
    commitment.brokenAt = Date.now();
    commitment.breakReason = result.evidence ?? "任务失败";
  }
  return commitment;
}

/**
 * 标记承诺违约
 */
export function breakCommitment(contractId: string, commitmentId: string, reason: string): Commitment | null {
  const contract = contracts.get(contractId);
  if (!contract) return null;
  const commitment = contract.commitments.find(c => c.id === commitmentId);
  if (!commitment) return null;
  commitment.status = "BROKEN";
  commitment.brokenAt = Date.now();
  commitment.breakReason = reason;
  return commitment;
}

// ============================================================================
// 违约检测（4 类 — 对标 CooperBench 三维根因 + 时间维度）
// ============================================================================

/**
 * 检测空间冲突（资源边界违约）
 * CooperBench 失败模式：Agent 承诺只改 X 行，但实际改了 Y 行
 */
export function detectSpatialViolation(
  contract: CollaborationContract,
  executions: CommitmentExecution[]
): ViolationResult[] {
  const violations: ViolationResult[] = [];
  const resourceCommitments = contract.commitments.filter(
    c => c.type === "RESOURCE_BOUNDARY" && c.resourceBoundary
  );

  for (const commitment of resourceCommitments) {
    const execution = executions.find(e => e.commitmentId === commitment.id);
    if (!execution || !execution.actualResourceBoundary) continue;

    const expected = commitment.resourceBoundary!;
    const actual = execution.actualResourceBoundary;

    if (expected.file && actual.file && expected.file !== actual.file) {
      violations.push({
        type: "SPATIAL",
        commitmentId: commitment.id,
        expected: `文件 ${expected.file}`,
        actual: `文件 ${actual.file}`,
        severity: "critical",
        detectedAt: Date.now(),
      });
      continue;
    }

    if (expected.startLine !== undefined && actual.startLine !== undefined) {
      if (actual.startLine < expected.startLine) {
        violations.push({
          type: "SPATIAL",
          commitmentId: commitment.id,
          expected: `起始行 ≥ ${expected.startLine}`,
          actual: `起始行 = ${actual.startLine}`,
          severity: "warn",
          detectedAt: Date.now(),
        });
      }
    }

    if (expected.endLine !== undefined && actual.endLine !== undefined) {
      if (actual.endLine > expected.endLine) {
        violations.push({
          type: "SPATIAL",
          commitmentId: commitment.id,
          expected: `结束行 ≤ ${expected.endLine}`,
          actual: `结束行 = ${actual.endLine}`,
          severity: "warn",
          detectedAt: Date.now(),
        });
      }
    }
  }

  return violations;
}

/**
 * 检测语义冲突（功能未实现）
 * CooperBench 失败模式：Agent 声称"已完成"但代码/输出缺失
 */
export function detectSemanticViolation(
  contract: CollaborationContract,
  executions: CommitmentExecution[]
): ViolationResult[] {
  const violations: ViolationResult[] = [];
  const featureCommitments = contract.commitments.filter(
    c => c.type === "FEATURE_IMPLEMENTATION"
  );

  for (const commitment of featureCommitments) {
    const execution = executions.find(e => e.commitmentId === commitment.id);
    if (!execution) continue;

    if (!execution.fulfilled) {
      violations.push({
        type: "SEMANTIC",
        commitmentId: commitment.id,
        expected: commitment.description,
        actual: execution.evidence ?? "未提供实现",
        severity: "critical",
        detectedAt: Date.now(),
      });
    }
  }

  return violations;
}

/**
 * 检测承诺未兑现
 * CooperBench 失败模式：承诺 "我会添加 X" 但实际未做
 */
export function detectUnfulfilledCommitment(
  contract: CollaborationContract
): ViolationResult[] {
  const violations: ViolationResult[] = [];

  // 找出 PENDING/ACKNOWLEDGED/IN_PROGRESS 状态的承诺（任务完成后仍未 VERIFIED）
  if (contract.status !== "FULFILLED" && contract.status !== "BROKEN") return violations;

  const incompleteCommitments = contract.commitments.filter(
    c => c.status !== "VERIFIED" && c.status !== "BROKEN"
  );

  for (const commitment of incompleteCommitments) {
    violations.push({
      type: "UNFULFILLED",
      commitmentId: commitment.id,
      expected: commitment.description,
      actual: `承诺状态: ${commitment.status}`,
      severity: commitment.status === "IN_PROGRESS" ? "warn" : "critical",
      detectedAt: Date.now(),
    });
  }

  return violations;
}

/**
 * 检测时间冲突（同步点违约）
 * CooperBench 失败模式：Agent 承诺"等待"但立即行动
 */
export function detectTimingViolation(
  contract: CollaborationContract,
  taskDurations: Map<string, number>
): ViolationResult[] {
  const violations: ViolationResult[] = [];
  const syncCommitments = contract.commitments.filter(c => c.type === "SYNC_POINT");

  for (const commitment of syncCommitments) {
    if (commitment.status === "BROKEN" || commitment.status === "VERIFIED") continue;

    const taskDuration = taskDurations.get(commitment.owner);
    if (taskDuration === undefined) continue;

    // 同步点承诺应该有非零的等待时间（如果是 0ms 说明没有等待）
    if (taskDuration < 10 && /wait|hold|pause|sync/i.test(commitment.description)) {
      violations.push({
        type: "TIMING",
        commitmentId: commitment.id,
        expected: "等待队友完成",
        actual: `${taskDuration}ms 内执行`,
        severity: "warn",
        detectedAt: Date.now(),
      });
    }
  }

  return violations;
}

/**
 * 综合违约检测（调用全部 4 类）
 */
export function detectAllViolations(
  contractId: string,
  executions: CommitmentExecution[],
  taskDurations: Map<string, number>
): ViolationResult[] {
  const contract = contracts.get(contractId);
  if (!contract) return [];

  return [
    ...detectSpatialViolation(contract, executions),
    ...detectSemanticViolation(contract, executions),
    ...detectUnfulfilledCommitment(contract),
    ...detectTimingViolation(contract, taskDurations),
  ];
}

// ============================================================================
// 协作评估（CooperBench 风格评分）
// ============================================================================

/**
 * 评估协作质量（0-1 分 + 评级）
 *
 * 公式：
 * - 履约率 = VERIFIED 承诺数 / 总承诺数
 * - 无冲突率 = 1 - (冲突数 / 总任务数)
 * - 协作分 = 履约率 × 0.6 + 无冲突率 × 0.4
 */
export function evaluateCollaboration(contractId: string): CollaborationScore | null {
  const contract = contracts.get(contractId);
  if (!contract) return null;

  const totalCommitments = contract.commitments.length;
  const verifiedCommitments = contract.commitments.filter(c => c.status === "VERIFIED").length;
  const brokenCommitments = contract.commitments.filter(c => c.status === "BROKEN").length;
  const totalConflicts = contract.conflictHistory.length;
  const totalTasks = contract.parties.length;

  const fulfillmentRate = totalCommitments > 0 ? verifiedCommitments / totalCommitments : 1;
  const conflictFreeRate = totalTasks > 0 ? Math.max(0, 1 - totalConflicts / totalTasks) : 1;
  const responseRate = totalCommitments > 0
    ? contract.commitments.filter(c => c.acknowledgedAt !== undefined).length / totalCommitments
    : 1;

  const overall = fulfillmentRate * 0.6 + conflictFreeRate * 0.4;

  // 三维失败归因（对标 CooperBench 42%/32%/26%）
  const failureBreakdown = {
    expectation: contract.conflictHistory.filter(c => c.description.includes("预期")).length,
    commitment: brokenCommitments,
    communication: contract.conflictHistory.filter(c => c.description.includes("沟通")).length,
  };

  let rating: CollaborationScore["rating"];
  if (overall >= 0.9) rating = "excellent";
  else if (overall >= 0.75) rating = "good";
  else if (overall >= 0.5) rating = "fair";
  else rating = "poor";

  return {
    overall: Math.round(overall * 100) / 100,
    fulfillmentRate: Math.round(fulfillmentRate * 100) / 100,
    conflictFreeRate: Math.round(conflictFreeRate * 100) / 100,
    responseRate: Math.round(responseRate * 100) / 100,
    failureBreakdown,
    rating,
  };
}

// ============================================================================
// 协调建议生成（对标 CooperBench 三种成功模式）
// ============================================================================

/**
 * 生成协调建议
 *
 * 基于 CooperBench 观察到的三种自发涌现的协调模式：
 * 1. ROLE_DIVISION — "I'll add header; you add binary_str between them"
 * 2. RESOURCE_DIVISION — "I will modify ONLY lines 68-84. I will NOT touch anything else"
 * 3. NEGOTIATION — "Option 1 vs Option 2. Which do you prefer? I'll wait"
 */
export function generateCoordinationSuggestions(
  planId: string,
  tasks: Task[]
): CoordinationSuggestion[] {
  const suggestions: CoordinationSuggestion[] = [];

  // 1. 角色分工建议（如果有多个任务）
  if (tasks.length > 1) {
    const taskNames = tasks.map(t => t.name).slice(0, 5);
    suggestions.push({
      type: "ROLE_DIVISION",
      priority: "HIGH",
      suggestion: `建议明确角色分工：${taskNames.join(" / ")} 各负责独立功能模块`,
      affectedTasks: tasks.map(t => t.id),
      expectedOutcome: "减少 42% 的预期失效（Expectation Failures）",
      expectedImprovement: { failureType: "Expectation Failures", reduction: "42%" },
    });
  }

  // 2. 资源切分建议（如果多个任务有相同 input 文件）
  const fileUsage = new Map<string, string[]>();
  for (const task of tasks) {
    const inputFiles = extractInputFiles(task);
    for (const file of inputFiles) {
      if (!fileUsage.has(file)) fileUsage.set(file, []);
      fileUsage.get(file)!.push(task.id);
    }
  }
  const sharedFiles = [...fileUsage.entries()].filter(([, taskIds]) => taskIds.length > 1);
  if (sharedFiles.length > 0) {
    suggestions.push({
      type: "RESOURCE_DIVISION",
      priority: "HIGH",
      suggestion: `检测到 ${sharedFiles.length} 个共享文件：${sharedFiles.map(([f]) => f).slice(0, 3).join(", ")}。建议为每个任务精确指定行号范围，避免物理冲突`,
      affectedTasks: sharedFiles.flatMap(([, ids]) => ids),
      expectedOutcome: "物理上杜绝代码合并冲突",
      expectedImprovement: { failureType: "Spatial Conflicts", reduction: "100%" },
    });
  }

  // 3. 谈判共识建议（如果有依赖冲突）
  const conflictPairs = findDependencyConflicts(tasks);
  if (conflictPairs.length > 0) {
    suggestions.push({
      type: "NEGOTIATION",
      priority: "MEDIUM",
      suggestion: `检测到 ${conflictPairs.length} 对潜在任务冲突，建议在执行前协商先后顺序：${conflictPairs.slice(0, 2).map(p => `${p[0]} ↔ ${p[1]}`).join("; ")}`,
      affectedTasks: conflictPairs.flat(),
      expectedOutcome: "避免盲目行动导致的返工",
      expectedImprovement: { failureType: "Coordination Failures", reduction: "30%" },
    });
  }

  // 4. 同步点建议（如果有任务共享一个外部资源）
  const httpTasks = tasks.filter(t => t.type === "http");
  if (httpTasks.length > 1) {
    suggestions.push({
      type: "SYNC_CHECK",
      priority: "LOW",
      suggestion: `${httpTasks.length} 个 HTTP 任务可能需要串行化（共享外部服务），建议加入同步点承诺`,
      affectedTasks: httpTasks.map(t => t.id),
      expectedOutcome: "减少竞态条件和资源锁冲突",
      expectedImprovement: { failureType: "Timing Violations", reduction: "20%" },
    });
  }

  return suggestions;
}

// ============================================================================
// 辅助函数
// ============================================================================

/** 从 Task 的 input 提取文件路径 */
function extractInputFiles(task: Task): string[] {
  const files: string[] = [];
  const input = task.input as Record<string, unknown> | undefined;
  if (!input) return files;
  for (const value of Object.values(input)) {
    if (typeof value === "string" && /\.(md|ts|js|json|yaml|yml|txt|py|go|rs)$/i.test(value)) {
      files.push(value);
    }
  }
  return files;
}

/** 找出有依赖冲突的任务对 */
function findDependencyConflicts(tasks: Task[]): Array<[string, string]> {
  const conflicts: Array<[string, string]> = [];
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  for (const task of tasks) {
    for (const depId of task.dependencies) {
      const dep = taskMap.get(depId);
      if (!dep) continue;
      // 双向依赖 = 循环依赖 = 冲突
      if (dep.dependencies.includes(task.id)) {
        conflicts.push([task.id, depId]);
      }
    }
  }
  return conflicts;
}

/** 清空所有契约（仅用于测试） */
export function clearAllContracts(): void {
  contracts.clear();
  contractCounter = 0;
  commitmentCounter = 0;
  conflictCounter = 0;
  violationCounter = 0;
}

/** 获取所有契约 ID（用于 API） */
export function listContractIds(): string[] {
  return [...contracts.keys()];
}

/** 获取契约总数（用于 metrics） */
export function getContractCount(): number {
  return contracts.size;
}
