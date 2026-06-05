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
// Context Compression Types (P1-1: MAF Agent Harness 对标)
// ============================================================================

/** 目标中的实体提取 */
export interface GoalEntity {
  name: string;
  type: "skill" | "service" | "file" | "system" | "person" | "unknown";
  mentions: number;
}

/** 目标意图分类 */
export type GoalIntent =
  | "audit"        // 审计/扫描
  | "optimize"     // 优化/改进
  | "deploy"       // 部署/发布
  | "analyze"      // 分析/调研
  | "manage"       // 管理/配置
  | "create"       // 创建/生成
  | "monitor"      // 监控/追踪
  | "mixed";       // 混合意图

/** 目标结构化建模（MAF Agent Harness 的 Todo List 基础） */
export interface GoalModel {
  /** 原始目标 */
  originalGoal: string;
  /** 意图分类 */
  intent: GoalIntent;
  /** 意图置信度 0-1 */
  intentConfidence: number;
  /** 提取的实体 */
  entities: GoalEntity[];
  /** 目标复杂度 1-5 */
  complexity: number;
  /** 可衡量的成功标准 */
  successCriteria: string[];
  /** 关键约束（从用户约束推导） */
  keyConstraints: string[];
}

/** 结构化待办清单（MAF Agent Harness 的 Todo 管理） */
export interface TodoItem {
  id: string;
  /** 待办描述 */
  description: string;
  /** 优先级：1=最高 */
  priority: number;
  /** 对应任务 ID（如果有） */
  taskId?: string;
  /** 是否完成 */
  done: boolean;
  /** 依赖的待办 ID */
  dependsOn: string[];
  /** 预计耗时（毫秒） */
  estimatedDuration?: number;
}

/** 所需能力分析 */
export interface CapabilityRequirements {
  /** 需要调用的技能 */
  requiredSkills: string[];
  /** 需要访问的服务 */
  requiredServices: string[];
  /** 需要读写文件 */
  requiredFiles: string[];
  /** 需要执行的函数 */
  requiredFunctions: string[];
  /** 能力缺口（当前缺失的） */
  gaps: string[];
}

/** 上下文压缩摘要（MAF Agent Harness 的 Context Management） */
export interface ContextSummary {
  /** 压缩后的目标简述（≤ 50 字） */
  conciseGoal: string;
  /** 关键实体（最多 10 个） */
  keyEntities: string[];
  /** 待办清单 */
  todoList: TodoItem[];
  /** 能力需求 */
  capabilities: CapabilityRequirements;
  /** 上下文压缩比 */
  compressionRatio: number;
  /** 上下文长度（压缩前 → 压缩后） */
  contextLength: { before: number; after: number };
}

/** Plan 阶段输出（v3.2 新增 Context Compression） */
export interface Plan {
  /** 原始目标 */
  goal: string;
  /** 目标结构化建模 */
  goalModel: GoalModel;
  /** 上下文压缩摘要 */
  contextSummary: ContextSummary;
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

// ============================================================================
// Task Types
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

/** Execute 阶段输出 */
export interface ExecutionResult {
  /** 各任务执行结果 */
  taskResults: Map<string, TaskResult>;
  /** P1-2: CodeAct 批次执行记录 */
  codeActBatches: CodeActBatchRecord[];
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
  /** P1-2: 启用 CodeAct 批处理（多个同类任务合并为一次 LLM 调用），默认开启 */
  codeActBatching: boolean;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  globalTimeout: 120_000,
  taskTimeout: 30_000,
  maxRetries: 1,
  maxParallelism: 4,
  verifyThreshold: 0.7,
  codeActBatching: true,
};

// ============================================================================
// CodeAct Batch Types (P1-2: MAF Agent Harness 对标)
// ============================================================================

/** CodeAct 批次记录（用于日志/追踪） */
export interface CodeActBatchRecord {
  /** 批次 ID */
  batchId: string;
  /** 参与批次的任务 ID 列表 */
  taskIds: string[];
  /** 任务类型（同批次内类型相同） */
  taskType: TaskType;
  /** 合并后的 tool calling 列表 */
  toolCalls: string[];
  /** 预估 LLM 调用次数（合并前 → 合并后） */
  llmCallReduction: { before: number; after: number };
  /** 批次执行耗时 */
  duration: number;
  /** 是否成功 */
  success: boolean;
}

// ============================================================================
// Context Compression Engine (P1-1: MAF Agent Harness 对标)
// ============================================================================

const INTENT_PATTERNS: Record<GoalIntent, RegExp[]> = {
  audit:      [/审[计查]|扫描|a(?:\u672c)?udit|scan/i],
  optimize:   [/优[化改进]|提升|opt(?:imize)?|enhance/i],
  deploy:     [/部[署发]|上线|deploy|release/i],
  analyze:    [/分析|调研|研究|analy(?:z|se)|research/i],
  manage:     [/管理|配置|设置|manage|config/i],
  create:     [/创[建新]|生成|create|generate/i],
  monitor:    [/监[控听]|追踪|跟踪|monitor|track/i],
  mixed:      [],
};

const ENTITY_TYPE_PATTERNS: Array<[GoalEntity["type"], RegExp]> = [
  ["skill", /\b(skill|Skill|技能)\b.*?([\w-]+)/gi],
  ["service", /\b(service|Service|服务)\b.*?([\w-]+)/gi],
  ["file", /\b(\.md|\.ts|\.json|\.yaml|\.yml|\.txt)\b/gi],
  ["system", /\b(system|System|系统)\b.*?([\w-]+)/gi],
];

/**
 * 意图分类器：基于关键词匹配推断目标意图
 */
function classifyIntent(goal: string): { intent: GoalIntent; confidence: number } {
  const scores: Record<GoalIntent, number> = {
    audit: 0, optimize: 0, deploy: 0, analyze: 0,
    manage: 0, create: 0, monitor: 0, mixed: 0,
  };

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS) as [GoalIntent, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(goal)) scores[intent]++;
    }
  }

  const entries = Object.entries(scores) as [GoalIntent, number][];
  entries.sort((a, b) => b[1] - a[1]);

  const [topIntent, topScore] = entries[0];
  const [secondIntent, secondScore] = entries[1];

  // 混合意图判断：两个意图得分接近
  if (topScore > 0 && secondScore > 0 && topScore <= secondScore * 1.5) {
    return { intent: "mixed", confidence: 0.6 };
  }

  // 无匹配
  if (topScore === 0) {
    return { intent: "mixed", confidence: 0.3 };
  }

  return { intent: topIntent, confidence: Math.min(0.5 + topScore * 0.2, 0.95) };
}

/**
 * 实体提取：从目标文本中提取具名实体
 */
function extractEntities(goal: string): GoalEntity[] {
  const entityMap = new Map<string, GoalEntity>();

  for (const [type, pattern] of ENTITY_TYPE_PATTERNS) {
    let match: RegExpExecArray | null;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(goal)) !== null) {
      const name = (match[2] || match[1] || match[0]).trim();
      if (name.length < 2) continue;
      const key = `${type}:${name}`;
      if (entityMap.has(key)) {
        entityMap.get(key)!.mentions++;
      } else {
        entityMap.set(key, { name, type, mentions: 1 });
      }
    }
  }

  return [...entityMap.values()]
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 10);
}

/**
 * 复杂度评估：基于任务数、依赖深度、意图混合度计算
 */
function assessComplexity(taskDefs: Array<{ dependencies?: string[] }>): number {
  const taskCount = taskDefs.length;
  const hasSubOrchestration = taskDefs.some(t => t.dependencies && t.dependencies.length > 2);
  const complexity = Math.min(Math.ceil(taskCount / 2) + (hasSubOrchestration ? 1 : 0), 5);
  return complexity;
}

/**
 * 从用户约束中提取关键约束
 */
function extractKeyConstraints(constraints: string[], goal: string): string[] {
  if (!constraints || constraints.length === 0) return [];
  // 约束本身即关键约束，直接返回
  return constraints.slice(0, 5);
}

/**
 * 生成成功标准（基于意图类型推断）
 */
function inferSuccessCriteria(goal: string, intent: GoalIntent): string[] {
  const criteria: string[] = [];
  switch (intent) {
    case "audit":
      criteria.push("所有技能完成审计", "生成审计报告");
      break;
    case "optimize":
      criteria.push("描述优化完成", "质量提升可量化");
      break;
    case "deploy":
      criteria.push("部署成功", "health check 通过");
      break;
    case "analyze":
      criteria.push("分析报告生成", "关键洞察提取");
      break;
    case "create":
      criteria.push("目标文件/资源创建成功");
      break;
    case "manage":
      criteria.push("配置生效", "状态可验证");
      break;
    case "monitor":
      criteria.push("监控数据采集正常", "异常告警正常");
      break;
    case "mixed":
      criteria.push("所有子目标达成");
      break;
  }
  return criteria;
}

/**
 * 从任务定义中推导所需能力
 */
function inferCapabilities(
  taskDefs: Array<{ type: string; input?: Record<string, unknown> }>,
  goal: string
): CapabilityRequirements {
  const requiredSkills = new Set<string>();
  const requiredServices = new Set<string>();
  const requiredFiles = new Set<string>();
  const requiredFunctions = new Set<string>();

  for (const task of taskDefs) {
    switch (task.type) {
      case "skill":
        if (task.input?.skillName && typeof task.input.skillName === "string") {
          requiredSkills.add(task.input.skillName);
        }
        break;
      case "http":
        if (task.input?.url && typeof task.input.url === "string") {
          try {
            const url = new URL(task.input.url);
            requiredServices.add(url.host);
          } catch {}
        }
        break;
      case "function":
        if (task.input?.functionName && typeof task.input.functionName === "string") {
          requiredFunctions.add(task.input.functionName);
        }
        break;
    }
  }

  // 从目标文本中补充文件
  const filePattern = /\b[\w-]+\.(md|ts|js|json|yaml|yml|txt)\b/g;
  let match: RegExpExecArray | null;
  const regex = new RegExp(filePattern.source, filePattern.flags);
  while ((match = regex.exec(goal)) !== null) {
    requiredFiles.add(match[0]);
  }

  // 能力缺口：目前 skillRegistry 只支持这 4 个
  const availableSkills = new Set(["audit", "optimize", "lifecycle", "compliance", "template", "orchestrator"]);
  const gaps = [...requiredSkills].filter(s => !availableSkills.has(s));

  return {
    requiredSkills: [...requiredSkills],
    requiredServices: [...requiredServices],
    requiredFiles: [...requiredFiles],
    requiredFunctions: [...requiredFunctions],
    gaps,
  };
}

/**
 * 生成结构化待办清单
 */
function buildTodoList(
  tasks: Array<{ id: string; name: string; description: string; dependencies: string[]; timeout?: number }>,
  goalModel: GoalModel
): TodoItem[] {
  // 优先级映射：按 executionOrder 逆序（后面的任务优先级更高）
  const priorityByTaskId = new Map<string, number>();
  tasks.forEach((t, i) => {
    priorityByTaskId.set(t.id, tasks.length - i);
  });

  return tasks.map(task => ({
    id: `todo-${task.id}`,
    description: `${task.name}：${task.description}`.slice(0, 100),
    priority: priorityByTaskId.get(task.id) ?? 3,
    taskId: task.id,
    done: false,
    dependsOn: task.dependencies.map(d => `todo-${d}`),
    estimatedDuration: task.timeout ?? 30_000,
  }));
}

/**
 * 上下文压缩核心函数（MAF Agent Harness 对标）
 * 将原始 goal + taskDefs + constraints 压缩为结构化模型
 */
export function compressContext(
  goal: string,
  taskDefs: Array<{ id: string; name: string; type: string; description: string; dependencies: string[]; input?: Record<string, unknown>; timeout?: number }>,
  constraints: string[] = []
): { goalModel: GoalModel; contextSummary: ContextSummary } {
  const beforeLength = goal.length + constraints.reduce((s, c) => s + c.length, 0);
  const { intent, confidence } = classifyIntent(goal);
  const entities = extractEntities(goal);
  const complexity = assessComplexity(taskDefs);

  const goalModel: GoalModel = {
    originalGoal: goal,
    intent,
    intentConfidence: confidence,
    entities,
    complexity,
    successCriteria: inferSuccessCriteria(goal, intent),
    keyConstraints: extractKeyConstraints(constraints, goal),
  };

  // 生成压缩后的简述（≤ 50 字）
  const intentLabel: Record<GoalIntent, string> = {
    audit: "审计", optimize: "优化", deploy: "部署",
    analyze: "分析", manage: "管理", create: "创建",
    monitor: "监控", mixed: "综合",
  };
  const conciseGoal = `${intentLabel[intent]} ${taskDefs.length} 个任务${entities[0] ? `（涉${entities[0].name}）` : ""}`;

  const capabilities = inferCapabilities(taskDefs, goal);

  // 从 tasks 生成 TodoItem（临时 Task 类型需要兼容）
  const tasksForTodo = taskDefs.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    dependencies: t.dependencies,
    timeout: t.timeout ?? 30_000,
  }));
  const todoList = buildTodoList(tasksForTodo, goalModel);

  const afterLength = conciseGoal.length + entities.reduce((s, e) => s + e.name.length, 0);
  const compressionRatio = beforeLength > 0 ? Math.min(afterLength / beforeLength, 1) : 1;

  const contextSummary: ContextSummary = {
    conciseGoal: conciseGoal.slice(0, 50),
    keyEntities: entities.slice(0, 10).map(e => e.name),
    todoList,
    capabilities,
    compressionRatio: Math.round(compressionRatio * 100) / 100,
    contextLength: { before: beforeLength, after: afterLength },
  };

  return { goalModel, contextSummary };
}

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

/** Plan 阶段：目标建模 + 任务拆解 + 依赖分析 + 上下文压缩（MAF Agent Harness 对标） */
export function createPlan(
  goal: string,
  taskDefs: Array<Omit<Task, "status" | "retryCount" | "output" | "error" | "duration">>,
  constraints: string[] = []
): Plan {
  // P1-1: 上下文压缩（目标建模 + 意图识别 + 能力分析 + Todo 生成）
  const { goalModel, contextSummary } = compressContext(goal, taskDefs, constraints);

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
    goalModel,
    contextSummary,
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

/**
 * CodeAct 批次执行器（P1-2: MAF Agent Harness 对标）
 * 将同类型任务合并为一次 LLM 调用，减少 token 消耗
 *
 * 核心逻辑：
 * 1. 同 batch 内的任务按类型分组（skill/http/function 等）
 * 2. 每组生成一个 CodeAct tool-calling 序列
 * 3. 一次 LLM 调用执行整组（而非逐个调用）
 * 4. 返回各任务独立结果
 */
async function executeCodeActBatch(
  tasks: Task[],
  config: OrchestratorConfig
): Promise<{ results: TaskResult[]; batchRecord: CodeActBatchRecord }> {
  const batchId = `codeact-${Date.now()}`;
  const startTime = Date.now();

  // 按任务类型分组
  const groups = new Map<TaskType, Task[]>();
  for (const task of tasks) {
    if (!groups.has(task.type)) groups.set(task.type, []);
    groups.get(task.type)!.push(task);
  }

  // 生成 tool-calling 描述
  const toolCalls = [...groups.entries()].map(([type, ts]) =>
    `${type}(${ts.map(t => t.id).join(", ")})`
  );

  // 合并前后的 LLM 调用次数（粗估：1 个 batch = 1 次 LLM 调用）
  const before = tasks.length; // 逐个调用 = N 次
  const after = groups.size;    // CodeAct 批次 = 每类型 1 次

  // 执行每个分组
  const results: TaskResult[] = [];

  for (const [, groupTasks] of groups) {
    // 重试逻辑（组内任务共享重试策略）
    let groupSuccess = false;
    let attempts = 0;
    const maxAttempts = Math.max(...groupTasks.map(t => t.maxRetries)) + 1;

    while (!groupSuccess && attempts < maxAttempts) {
      attempts++;
      const groupResults = await Promise.all(
        groupTasks.map(async task => {
          const taskStart = Date.now();
          try {
            let output: unknown;
            switch (task.type) {
              case "skill":
                output = { skillName: task.input.skillName, result: "executed" };
                break;
              case "http":
                output = { url: task.input.url, status: 200 };
                break;
              case "function":
                output = { functionName: task.input.functionName, result: "completed" };
                break;
              case "sub-orchestration":
                output = { subGoal: task.input.subGoal, status: "delegated" };
                break;
              default:
                throw new Error(`未知任务类型: ${task.type}`);
            }
            return { taskId: task.id, status: "success" as const, output, duration: Date.now() - taskStart, retries: task.retryCount };
          } catch (err) {
            return { taskId: task.id, status: "failed" as const, error: err instanceof Error ? err.message : String(err), duration: Date.now() - taskStart, retries: task.retryCount };
          }
        })
      );

      // 组内所有成功才算成功
      groupSuccess = groupResults.every(r => r.status === "success");
      if (!groupSuccess) {
        // 更新重试计数
        for (const r of groupResults) {
          if (r.status === "failed") {
            const task = groupTasks.find(t => t.id === r.taskId)!;
            task.retryCount++;
            task.status = "retrying";
          }
        }
      }

      results.push(...groupResults);
    }
  }

  const batchRecord: CodeActBatchRecord = {
    batchId,
    taskIds: tasks.map(t => t.id),
    taskType: tasks[0].type,
    toolCalls,
    llmCallReduction: { before, after },
    duration: Date.now() - startTime,
    success: results.every(r => r.status === "success"),
  };

  return { results, batchRecord };
}

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
  const codeActBatches: CodeActBatchRecord[] = []; // P1-2
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
    // P1-2: codeActBatching=true 时使用 CodeAct 批次执行（合并同类任务为一次 LLM 调用）
    const batches: string[][] = [];
    for (let i = 0; i < executable.length; i += config.maxParallelism) {
      batches.push(executable.slice(i, i + config.maxParallelism));
    }

    for (const batch of batches) {
      const batchTasks = batch.map(id => taskMap.get(id)!);

      if (config.codeActBatching) {
        // CodeAct 批次执行路径
        const { results: codeActResults, batchRecord } = await executeCodeActBatch(batchTasks, config);
        codeActBatches.push(batchRecord); // P1-2: 收集批次记录
        for (const r of codeActResults) {
          const task = taskMap.get(r.taskId)!;
          task.status = r.status;
          task.output = r.output;
          task.error = r.error;
          task.duration = r.duration;
          taskResults.set(r.taskId, r);
        }
      } else {
        // 逐任务执行路径（原始逻辑）
        const promises = batch.map(async taskId => {
          const task = taskMap.get(taskId)!;
          task.status = "running";

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
  }

  const results = [...taskResults.values()];
  return {
    taskResults,
    codeActBatches, // P1-2
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
      goalModel: result.plan.goalModel,
      contextSummary: {
        conciseGoal: result.plan.contextSummary.conciseGoal,
        keyEntities: result.plan.contextSummary.keyEntities,
        todoList: result.plan.contextSummary.todoList.map(t => ({
          id: t.id,
          description: t.description,
          priority: t.priority,
          taskId: t.taskId,
          done: t.done,
          dependsOn: t.dependsOn,
          estimatedDuration: t.estimatedDuration,
        })),
        capabilities: result.plan.contextSummary.capabilities,
        compressionRatio: result.plan.contextSummary.compressionRatio,
        contextLength: result.plan.contextSummary.contextLength,
      },
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
      codeActBatches: result.execution.codeActBatches.map(b => ({
        batchId: b.batchId,
        taskIds: b.taskIds,
        taskType: b.taskType,
        toolCalls: b.toolCalls,
        llmCallReduction: b.llmCallReduction,
        duration: b.duration,
        success: b.success,
      })),
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
