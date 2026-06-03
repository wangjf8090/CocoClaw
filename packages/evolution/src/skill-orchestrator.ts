/**
 * Skill Orchestrator - Plan→Execute→Verify 三阶段编排引擎
 * 参考 Coze 3.0 AI指挥官+调度官 双角色设计
 *
 * 核心能力：
 * 1. Plan — 目标建模、任务拆解、依赖分析、约束设定
 * 2. Execute — 拓扑排序、并行分组、资源调度、超时控制
 * 3. Verify — 结果校验、目标对比、重试决策、报告生成
 *
 * 设计原则：
 * - 单进程内闭环，不依赖外部调度器
 * - 复用现有 Evolution 服务的基础设施
 * - 每个 Task 可以是 Skill 调用 / HTTP 请求 / 本地函数
 */

// ============================================================================
// Types
// ============================================================================

/** 任务状态 */
export type TaskStatus = "pending" | "running" | "success" | "failed" | "skipped" | "retrying";

/** 任务类型 */
export type TaskType = "skill" | "http" | "function" | "sub-orchestration";

/** 任务定义 */
export interface Task {
  id: string;
  name: string;
  type: TaskType;
  /** 任务描述（给 AI 理解用） */
  description: string;
  /** 依赖的任务 ID 列表 */
  dependencies: string[];
  /** 约束条件 */
  constraints: string[];
  /** 任务输入 */
  input: Record<string, unknown>;
  /** 任务超时（毫秒），默认 30000 */
  timeout: number;
  /** 最大重试次数，默认 1 */
  maxRetries: number;
  /** 状态 */
  status: TaskStatus;
  /** 执行结果 */
  output?: unknown;
  /** 错误信息 */
  error?: string;
  /** 重试计数 */
  retryCount: number;
  /** 执行耗时（毫秒） */
  duration?: number;
}

/** Plan 阶段输出 */
export interface Plan {
  /** 原始目标 */
  goal: string;
  /** 全局约束 */
  constraints: string[];
  /** 拆解后的任务列表 */
  tasks: Task[];
  /** 依赖关系图 */
  dependencyGraph: Map<string, string[]>;
  /** 拓扑排序后的执行顺序 */
  executionOrder: string[];
  /** 可并行的任务分组 */
  parallelGroups: string[][];
  /** Plan 生成时间 */
  createdAt: string;
}

/** Execute 阶段输出 */
export interface ExecutionResult {
  /** 各任务执行结果 */
  taskResults: Map<string, TaskResult>;
  /** 执行耗时 */
  totalDuration: number;
  /** 成功任务数 */
  successCount: number;
  /** 失败任务数 */
  failedCount: number;
  /** 跳过任务数 */
  skippedCount: number;
}

/** 单任务执行结果 */
export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  output?: unknown;
  error?: string;
  duration: number;
  retries: number;
}

/** Verify 阶段输出 */
export interface VerificationResult {
  /** 目标是否达成 */
  goalAchieved: boolean;
  /** 目标达成度 0-1 */
  goalScore: number;
  /** 各任务验证详情 */
  taskVerifications: TaskVerification[];
  /** 需要重试的任务 */
  retryNeeded: string[];
  /** 验证报告 */
  report: string;
}

/** 单任务验证 */
export interface TaskVerification {
  taskId: string;
  passed: boolean;
  /** 与目标的关联度 0-1 */
  relevance: number;
  notes: string;
}

/** 完整编排结果 */
export interface OrchestrationResult {
  id: string;
  goal: string;
  plan: Plan;
  execution: ExecutionResult;
  verification: VerificationResult;
  /** 总耗时 */
  totalDuration: number;
  /** 最终状态 */
  status: "completed" | "partial" | "failed";
  createdAt: string;
  completedAt: string;
}

/** 编排配置 */
export interface OrchestratorConfig {
  /** 全局超时（毫秒），默认 120000 */
  globalTimeout: number;
  /** 单任务默认超时，默认 30000 */
  taskTimeout: number;
  /** 默认最大重试次数，默认 1 */
  maxRetries: number;
  /** 最大并行度，默认 4 */
  maxParallelism: number;
  /** Verify 阈值：goalScore >= 此值视为达成，默认 0.7 */
  verifyThreshold: number;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  globalTimeout: 120_000,
  taskTimeout: 30_000,
  maxRetries: 1,
  maxParallelism: 4,
  verifyThreshold: 0.7,
};

// ============================================================================
// Plan Engine
// ============================================================================

/** 拓扑排序（Kahn 算法） */
function topologicalSort(tasks: Task[]): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const task of tasks) {
    inDegree.set(task.id, task.dependencies.length);
    adjacency.set(task.id, []);
  }

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      adjacency.get(dep)?.push(task.id);
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  // 检测循环依赖
  if (order.length !== tasks.length) {
    const missing = tasks.filter(t => !order.includes(t.id)).map(t => t.id);
    throw new Error(`循环依赖检测: 任务 [${missing.join(", ")}] 存在循环引用`);
  }

  return order;
}

/** 计算并行分组 */
function computeParallelGroups(tasks: Task[], executionOrder: string[]): string[][] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const maxDepth = new Map<string, number>();

  // 计算每个任务的最大深度（依赖链中最长路径）
  function getDepth(id: string): number {
    if (maxDepth.has(id)) return maxDepth.get(id)!;
    const task = taskMap.get(id);
    if (!task || task.dependencies.length === 0) {
      maxDepth.set(id, 0);
      return 0;
    }
    const depth = Math.max(...task.dependencies.map(getDepth)) + 1;
    maxDepth.set(id, depth);
    return depth;
  }

  for (const id of executionOrder) getDepth(id);

  // 按深度分组
  const groups = new Map<number, string[]>();
  for (const [id, depth] of maxDepth) {
    if (!groups.has(depth)) groups.set(depth, []);
    groups.get(depth)!.push(id);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, ids]) => ids);
}

/** Plan 阶段：目标建模 + 任务拆解 + 依赖分析 */
export function createPlan(
  goal: string,
  taskDefs: Array<Omit<Task, "status" | "retryCount" | "output" | "error" | "duration">>,
  constraints: string[] = []
): Plan {
  const tasks: Task[] = taskDefs.map(def => ({
    ...def,
    timeout: def.timeout ?? DEFAULT_ORCHESTRATOR_CONFIG.taskTimeout,
    maxRetries: def.maxRetries ?? DEFAULT_ORCHESTRATOR_CONFIG.maxRetries,
    status: "pending",
    retryCount: 0,
  }));

  const dependencyGraph = new Map<string, string[]>();
  for (const task of tasks) {
    dependencyGraph.set(task.id, task.dependencies);
  }

  const executionOrder = topologicalSort(tasks);
  const parallelGroups = computeParallelGroups(tasks, executionOrder);

  return {
    goal,
    constraints,
    tasks,
    dependencyGraph,
    executionOrder,
    parallelGroups,
    createdAt: new Date().toISOString(),
  };
}

// ============================================================================
// Execute Engine
// ============================================================================

/** 模拟任务执行器（实际部署时可替换为真实执行逻辑） */
async function executeTask(task: Task, config: OrchestratorConfig): Promise<TaskResult> {
  const startTime = Date.now();

  // 根据任务类型执行不同逻辑
  // 生产环境可替换为：Skill 调用 / HTTP 请求 / sessions_spawn 等
  try {
    let output: unknown;

    switch (task.type) {
      case "skill": {
        // 模拟 Skill 调用：返回 audit/optimize 结果摘要
        output = { skillName: task.input.skillName, result: "executed", data: task.input };
        break;
      }
      case "http": {
        // 模拟 HTTP 请求
        output = { url: task.input.url, status: 200, body: "mock response" };
        break;
      }
      case "function": {
        // 模拟本地函数调用
        output = { functionName: task.input.functionName, result: "completed" };
        break;
      }
      case "sub-orchestration": {
        // 子编排递归调用（此处为占位）
        output = { subGoal: task.input.subGoal, status: "delegated" };
        break;
      }
      default:
        throw new Error(`未知任务类型: ${task.type}`);
    }

    return {
      taskId: task.id,
      status: "success",
      output,
      duration: Date.now() - startTime,
      retries: task.retryCount,
    };
  } catch (err) {
    return {
      taskId: task.id,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - startTime,
      retries: task.retryCount,
    };
  }
}

/** Execute 阶段：按拓扑排序 + 并行分组调度执行 */
export async function executePlan(
  plan: Plan,
  config: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG
): Promise<ExecutionResult> {
  const taskResults = new Map<string, TaskResult>();
  const taskMap = new Map(plan.tasks.map(t => [t.id, t]));
  const startTime = Date.now();

  for (const group of plan.parallelGroups) {
    // 检查全局超时
    if (Date.now() - startTime > config.globalTimeout) {
      // 超时，将剩余任务标记为 skipped
      for (const taskId of group) {
        const task = taskMap.get(taskId);
        if (task && task.status === "pending") {
          task.status = "skipped";
          taskResults.set(taskId, {
            taskId,
            status: "skipped",
            duration: 0,
            retries: 0,
            error: "全局超时",
          });
        }
      }
      continue;
    }

    // 检查依赖是否都成功
    const executable = group.filter(taskId => {
      const task = taskMap.get(taskId);
      if (!task) return false;
      return task.dependencies.every(dep => {
        const result = taskResults.get(dep);
        return result && result.status === "success";
      });
    });

    // 依赖失败的任务标记为 skipped
    for (const taskId of group) {
      if (!executable.includes(taskId)) {
        const task = taskMap.get(taskId);
        if (task && task.status === "pending") {
          task.status = "skipped";
          taskResults.set(taskId, {
            taskId,
            status: "skipped",
            duration: 0,
            retries: 0,
            error: "依赖任务失败",
          });
        }
      }
    }

    // 并行执行（限制最大并行度）
    const batches: string[][] = [];
    for (let i = 0; i < executable.length; i += config.maxParallelism) {
      batches.push(executable.slice(i, i + config.maxParallelism));
    }

    for (const batch of batches) {
      const promises = batch.map(async taskId => {
        const task = taskMap.get(taskId)!;
        task.status = "running";

        // 重试逻辑
        let result: TaskResult;
        let attempts = 0;
        const maxAttempts = task.maxRetries + 1;

        do {
          attempts++;
          result = await executeTask(task, config);

          if (result.status === "failed" && attempts < maxAttempts) {
            task.retryCount++;
            task.status = "retrying";
          }
        } while (result.status === "failed" && attempts < maxAttempts);

        task.status = result.status;
        task.output = result.output;
        task.error = result.error;
        task.duration = result.duration;
        taskResults.set(taskId, result);
      });

      await Promise.all(promises);
    }
  }

  const results = [...taskResults.values()];
  return {
    taskResults,
    totalDuration: Date.now() - startTime,
    successCount: results.filter(r => r.status === "success").length,
    failedCount: results.filter(r => r.status === "failed").length,
    skippedCount: results.filter(r => r.status === "skipped").length,
  };
}

// ============================================================================
// Verify Engine
// ============================================================================

/** Verify 阶段：结果校验 + 目标对比 */
export function verifyResult(
  goal: string,
  plan: Plan,
  execution: ExecutionResult,
  config: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG
): VerificationResult {
  const taskVerifications: TaskVerification[] = [];
  const retryNeeded: string[] = [];

  for (const task of plan.tasks) {
    const result = execution.taskResults.get(task.id);

    if (!result) {
      taskVerifications.push({
        taskId: task.id,
        passed: false,
        relevance: 0,
        notes: "无执行结果",
      });
      continue;
    }

    // 基础验证：任务是否成功
    const passed = result.status === "success";

    // 关联度评估：任务描述与目标的语义关联
    // 简化实现：检查任务名称/描述中的关键词是否出现在目标中
    const goalWords = new Set(goal.toLowerCase().split(/\s+/));
    const taskWords = `${task.name} ${task.description}`.toLowerCase().split(/\s+/);
    const overlap = taskWords.filter(w => goalWords.has(w)).length;
    const relevance = taskWords.length > 0 ? overlap / taskWords.length : 0.5;

    const notes = passed
      ? `任务成功完成${result.duration ? `，耗时 ${result.duration}ms` : ""}`
      : `任务失败: ${result.error ?? "未知错误"}`;

    taskVerifications.push({ taskId: task.id, passed, relevance, notes });

    // 失败但可重试的任务
    if (!passed && task.retryCount < task.maxRetries) {
      retryNeeded.push(task.id);
    }
  }

  // 计算目标达成度：加权平均（成功的任务按关联度加权）
  const weightedScores = taskVerifications
    .filter(v => v.passed)
    .map(v => v.relevance);
  const totalRelevance = taskVerifications.reduce((sum, v) => sum + v.relevance, 0);
  const achievedRelevance = weightedScores.reduce((sum, r) => sum + r, 0);
  const goalScore = totalRelevance > 0 ? achievedRelevance / totalRelevance : 0;

  const goalAchieved = goalScore >= config.verifyThreshold;

  // 生成验证报告
  const report = [
    `## 编排验证报告`,
    ``,
    `**目标**: ${goal}`,
    `**达成度**: ${(goalScore * 100).toFixed(1)}% (阈值: ${(config.verifyThreshold * 100).toFixed(0)}%)`,
    `**结论**: ${goalAchieved ? "✅ 目标达成" : "❌ 目标未达成"}`,
    ``,
    `### 任务详情`,
    ...taskVerifications.map(v =>
      `- ${v.passed ? "✅" : "❌"} ${v.taskId}: ${v.notes} (关联度: ${(v.relevance * 100).toFixed(0)}%)`
    ),
    ``,
    `### 统计`,
    `- 成功: ${execution.successCount} | 失败: ${execution.failedCount} | 跳过: ${execution.skippedCount}`,
    `- 总耗时: ${execution.totalDuration}ms`,
    `- 可重试: ${retryNeeded.length > 0 ? retryNeeded.join(", ") : "无"}`,
  ].join("\n");

  return {
    goalAchieved,
    goalScore,
    taskVerifications,
    retryNeeded,
    report,
  };
}

// ============================================================================
// Full Orchestration
// ============================================================================

/** 执行完整编排流程 */
export async function orchestrate(
  goal: string,
  taskDefs: Array<Omit<Task, "status" | "retryCount" | "output" | "error" | "duration">>,
  constraints: string[] = [],
  config: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG
): Promise<OrchestrationResult> {
  const id = `orch-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const startTime = Date.now();

  // Plan
  const plan = createPlan(goal, taskDefs, constraints);

  // Execute
  const execution = await executePlan(plan, config);

  // Verify
  const verification = verifyResult(goal, plan, execution, config);

  // 确定最终状态
  let status: OrchestrationResult["status"];
  if (verification.goalAchieved) {
    status = "completed";
  } else if (execution.successCount > 0) {
    status = "partial";
  } else {
    status = "failed";
  }

  return {
    id,
    goal,
    plan,
    execution,
    verification,
    totalDuration: Date.now() - startTime,
    status,
    createdAt,
    completedAt: new Date().toISOString(),
  };
}

/** 序列化编排结果为 JSON 友好格式（将 Map 转为 Record） */
export function serializeResult(result: OrchestrationResult): Record<string, unknown> {
  return {
    id: result.id,
    goal: result.goal,
    status: result.status,
    totalDuration: result.totalDuration,
    plan: {
      goal: result.plan.goal,
      constraints: result.plan.constraints,
      taskCount: result.plan.tasks.length,
      executionOrder: result.plan.executionOrder,
      parallelGroups: result.plan.parallelGroups,
      createdAt: result.plan.createdAt,
      tasks: result.plan.tasks.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        description: t.description,
        dependencies: t.dependencies,
        status: t.status,
        duration: t.duration,
        error: t.error,
      })),
    },
    execution: {
      totalDuration: result.execution.totalDuration,
      successCount: result.execution.successCount,
      failedCount: result.execution.failedCount,
      skippedCount: result.execution.skippedCount,
      taskResults: Object.fromEntries(result.execution.taskResults),
    },
    verification: {
      goalAchieved: result.verification.goalAchieved,
      goalScore: result.verification.goalScore,
      retryNeeded: result.verification.retryNeeded,
      report: result.verification.report,
    },
    createdAt: result.createdAt,
    completedAt: result.completedAt,
  };
}
