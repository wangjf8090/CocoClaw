/**
 * Self-Evolution Harness Types
 * 自我进化编排层类型定义
 *
 * Three evolution circuits:
 * 1. Permission Evolver - 权限进化器
 * 2. Performance Evolver - 性能进化器
 * 3. Memory Evolver - 记忆进化器
 */

/**
 * Evolution Circuit Type
 * 进化回路类型
 */
export enum EvolutionCircuitType {
  PERMISSION = 'permission',
  PERFORMANCE = 'performance',
  MEMORY = 'memory',
}

/**
 * Evolution Status
 * 进化状态
 */
export enum EvolutionStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused',
}

/**
 * Evolution Result
 * 进化结果
 */
export interface EvolutionResult {
  circuit: EvolutionCircuitType;
  status: EvolutionStatus;
  changes: EvolutionChange[];
  metrics: EvolutionMetrics;
  startedAt: number;
  completedAt: number;
  version: string;
}

/**
 * Evolution Change
 * 进化变更
 */
export interface EvolutionChange {
  id: string;
  type: 'parameter' | 'rule' | 'weight' | 'structure';
  target: string;
  oldValue: unknown;
  newValue: unknown;
  confidence: number;
  reason: string;
  rollbackable: boolean;
}

/**
 * Evolution Metrics
 * 进化指标
 */
export interface EvolutionMetrics {
  before: Record<string, number>;
  after: Record<string, number>;
  improvement: Record<string, number>;
}

/**
 * Harness Event Type
 * 编排事件类型
 */
export type HarnessEventType =
  | 'harness_start'
  | 'harness_complete'
  | 'evolution_cycle'
  | 'evolution_change'
  | 'permission_update'
  | 'performance_tuning'
  | 'memory_optimization'
  | 'ab_test_start'
  | 'ab_test_complete'
  | 'rollback_triggered';

/**
 * Harness Event
 * 编排事件
 */
export interface HarnessEvent {
  type: HarnessEventType;
  id: string;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Harness Event Emitter Interface
 * 编排事件发射器接口
 */
export interface HarnessEventEmitter {
  on(event: HarnessEventType, handler: (event: HarnessEvent) => void): void;
  off(event: HarnessEventType, handler: (event: HarnessEvent) => void): void;
  emit(event: HarnessEventType, eventData: HarnessEvent): void;
  removeAllListeners(): void;
}

/**
 * Harness Configuration
 * 编排配置
 */
export interface HarnessConfig {
  // Evolution cycle settings
  evolutionCycleInterval: number; // ms between evolution cycles
  maxChangesPerCycle: number;
  autoApplyChanges: boolean;

  // Permission evolver settings
  permission: PermissionEvolverConfig;

  // Performance evolver settings
  performance: PerformanceEvolverConfig;

  // Memory evolver settings
  memory: MemoryEvolverConfig;

  // Skill evolver settings (P1 新增)
  skill: SkillEvolverConfig;

  // Trustworthy executor settings (P1 新增)
  trustworthyExecution: TrustworthyExecutorConfig;

  // A/B testing settings
  abTesting: ABTestConfig;

  // Safety settings
  safetyThreshold: number;
  maxRollbackHistory: number;
}

/**
 * Default Harness Configuration
 * 默认编排配置
 */
export const DEFAULT_HARNESS_CONFIG: HarnessConfig = {
  evolutionCycleInterval: 60000, // 1 minute
  maxChangesPerCycle: 5,
  autoApplyChanges: false,

  permission: {
    autoOptimizeWhitelist: true,
    autoDetectDangerPatterns: true,
    learnUserHabits: true,
    confirmationReductionThreshold: 0.95,
    habitLearningSamples: 100,
  },

  performance: {
    autoTuneContextWindow: true,
    autoOptimizeCacheStrategy: true,
    autoTuneParallelism: true,
    tokenUsageOptimization: true,
    targetLatencyMs: 1000,
    compressionThreshold: 0.7,
  },

  memory: {
    autoCleanRedundant: true,
    autoBoostImportant: true,
    autoTuneIndexParameters: true,
    redundancyThreshold: 0.9,
    importanceBoostThreshold: 0.8,
  },

  skill: {
    caseWindow: 100,
    standardThreshold: 5,
    chainDepth: 3,
  },

  trustworthyExecution: {
    enableEvidenceChain: true,
    enableRuleValidation: true,
    enableRiskFlagging: true,
    maxRecursionDepth: 10,
  },

  abTesting: {
    enabled: true,
    trafficSplit: 0.1,
    minConfidenceLevel: 0.9,
    maxTestDuration: 86400000, // 24 hours
  },

  safetyThreshold: 0.9,
  maxRollbackHistory: 100,
};

/**
 * Permission Evolver Configuration
 * 权限进化器配置
 */
export interface PermissionEvolverConfig {
  autoOptimizeWhitelist: boolean;
  autoDetectDangerPatterns: boolean;
  learnUserHabits: boolean;
  confirmationReductionThreshold: number;
  habitLearningSamples: number;
}

/**
 * Performance Evolver Configuration
 * 性能进化器配置
 */
export interface PerformanceEvolverConfig {
  autoTuneContextWindow: boolean;
  autoOptimizeCacheStrategy: boolean;
  autoTuneParallelism: boolean;
  tokenUsageOptimization: boolean;
  targetLatencyMs: number;
  compressionThreshold: number;
}

/**
 * Memory Evolver Configuration
 * 记忆进化器配置
 */
export interface MemoryEvolverConfig {
  autoCleanRedundant: boolean;
  autoBoostImportant: boolean;
  autoTuneIndexParameters: boolean;
  redundancyThreshold: number;
  importanceBoostThreshold: number;
}

/**
 * A/B Test Configuration
 * A/B测试配置
 */
export interface ABTestConfig {
  enabled: boolean;
  trafficSplit: number;
  minConfidenceLevel: number;
  maxTestDuration: number;
}

/**
 * Active A/B Test
 * 活跃的A/B测试
 */
export interface ActiveABTest {
  id: string;
  name: string;
  circuit: EvolutionCircuitType;
  variantA: unknown;
  variantB: unknown;
  startedAt: number;
  metrics: {
    a: Record<string, number[]>;
    b: Record<string, number[]>;
  };
}

/**
 * Rollback Point
 * 回滚点
 */
export interface RollbackPoint {
  id: string;
  version: string;
  timestamp: number;
  circuit: EvolutionCircuitType;
  state: Record<string, unknown>;
  changes: EvolutionChange[];
}

/**
 * Permission Pattern
 * 权限模式（用于学习用户习惯）
 */
export interface PermissionPattern {
  toolName: string;
  operationType: string;
  frequency: number;
  successRate: number;
  avgConfirmationTime: number;
  lastUsed: number;
}

/**
 * Performance Stats
 * 性能统计
 */
export interface PerformanceStats {
  tokenUsage: {
    perQuery: number[];
    perTool: Record<string, number[]>;
  };
  latency: {
    perQuery: number[];
    perTool: Record<string, number[]>;
  };
  cacheHitRate: number;
  contextCompressionRatio: number;
  parallelismUtilization: number;
  tokenSaving?: TokenSavingMetrics;
}

/**
 * Token Saving Metrics
 * Token 节省指标（用于 PerformanceEvolver Dashboard，对标 DuMate 75% Token 降耗工业级基准）
 */
export interface TokenSavingMetrics {
  /** 基线 Token 消耗（首次调用 recordBaseline 设定） */
  baselineTokens: number;
  /** 当前平均 Token 消耗 */
  currentTokensAvg: number;
  /** Token 节省比例 = (baseline - currentAvg) / baseline，避免 baseline=0 时除零 */
  savingRatio: number;
  /** 样本数量 */
  sampleCount: number;
  /** 最后更新时间 */
  lastUpdatedAt: number;
  /** 按工具拆分的 Token 节省（可选） */
  perToolSaving?: Record<string, PerToolTokenSaving>;
}

/**
 * Per Tool Token Saving
 * 单工具 Token 节省明细
 */
export interface PerToolTokenSaving {
  baselineTokens: number;
  currentTokensAvg: number;
  savingRatio: number;
  sampleCount: number;
}

/**
 * Harness Dashboard
 * 编排 Dashboard（供 CLI / 前端消费）
 */
export interface HarnessDashboard {
  /** 统计摘要 */
  stats: {
    tokenUsageAvg: number;
    latencyAvg: number;
    cacheHitRate: number;
    sampleCount: number;
  };
  /** Token 节省指标 */
  tokenSaving: TokenSavingMetrics;
  /** 当前设置快照 */
  currentSettings: {
    contextWindowSize: number;
    cacheSize: number;
    maxParallelism: number;
    compressionEnabled: boolean;
  };
  /** 关键优化建议 */
  suggestions: string[];
  /** Dashboard 生成时间 */
  generatedAt: number;
}

/**
 * Memory Stats
 * 记忆统计
 */
export interface MemoryStats {
  totalMemories: number;
  indexSize: number;
  searchLatency: number[];
  relevanceScore: number[];
  redundancyRate: number;
  hotCacheHitRate: number;
}

/**
 * Harness Execution Options
 * 编排执行选项
 */
export interface HarnessExecutionOptions {
  enableEvolution?: boolean;
  enableTest?: boolean;
  maxIterations?: number;
  stream?: boolean;
  sessionId?: string;
  userId?: string;
  context?: Record<string, unknown>;
}

/* ================================================================================
 * Test Harness Types (融合新增)
 * 测试与治理系统类型定义
 * OpenClaw Runtime = Agent OS, Harness = QA + Replay + Safety Lab
 * ================================================================================ */

/**
 * ClawEventType - Runtime 暴露的核心事件类型
 * Runtime → Harness 的标准化事件流
 */
export type ClawEventType =
  // Run 级别
  | 'run_started'
  | 'run_finished'
  | 'run_failed'
  | 'run_cancelled'
  // Model 级别
  | 'model_call_started'
  | 'model_call_finished'
  | 'model_call_failed'
  // Tool 级别
  | 'tool_call_started'
  | 'tool_call_finished'
  | 'tool_call_failed'
  | 'tool_call_blocked'
  // Memory 级别
  | 'memory_read'
  | 'memory_write'
  | 'memory_promoted'
  | 'memory_evicted'
  // Policy / Safety 级别
  | 'policy_check_started'
  | 'policy_check_passed'
  | 'policy_check_failed'
  | 'safety_gate_triggered'
  // Human / Control 级别
  | 'human_confirmation_requested'
  | 'human_confirmation_received';

/**
 * ClawEvent - 标准事件结构
 */
export interface ClawEvent {
  event_id: string;
  run_id: string;
  session_id: string;
  type: ClawEventType;
  ts: string;
  payload: Record<string, unknown>;
}

/**
 * Tool Invocation Record - Tool 调用记录
 */
export interface ToolInvocation {
  tool_name: string;
  input: unknown;
  output?: unknown;
  started_at: string;
  finished_at?: string;
  error?: string;
  status: 'started' | 'finished' | 'failed' | 'blocked';
}

/**
 * RunSpec - Harness 驱动 Runtime 的统一输入
 */
export interface RunSpec {
  runId: string;
  userInput: string;
  context?: {
    sessionId?: string;
    userId?: string;
    locale?: string;
  };
  memorySeed?: {
    shortTerm?: Array<{ key: string; value: string }>;
    longTermRefs?: string[];
  };
  tools?: {
    allow: string[];
    deny?: string[];
    mode: 'prod' | 'mock' | 'replay';
  };
  toolFixtures?: Record<string, unknown>;
  faultInjection?: Array<{
    target: string;
    mode: 'timeout' | '429' | 'permission_denied' | 'invalid_payload' | 'empty_response' | 'dirty_data';
    rate?: number;
  }>;
  expectations?: {
    mustUseTools?: string[];
    mustNotUseTools?: string[];
    mustEmitEvents?: string[];
    answerAssertions?: string[];
    maxToolCalls?: number;
    maxLatencyMs?: number;
  };
}

/**
 * RunResult - 运行结果
 */
export interface RunResult {
  runId: string;
  status: 'success' | 'failed' | 'blocked' | 'timeout';
  finalAnswer?: string;
  error?: {
    code: string;
    message: string;
    stage?: 'model' | 'tool' | 'memory' | 'policy';
  };
  metrics: {
    latencyMs: number;
    tokenIn?: number;
    tokenOut?: number;
    toolCalls: number;
    toolErrors: number;
  };
  traceRef: string;
  memoryDiff?: {
    added: string[];
    updated: string[];
    removed: string[];
  };
}

/**
 * EvalScore - 五维评分
 */
export interface EvalScore {
  outcome: number;      // 最终结果 0-100
  process: number;       // 过程合理性 0-100
  safety: number;        // 安全性 0-100
  reliability: number;   // 容错性 0-100
  cost: number;          // 成本效率 0-100
}

/**
 * EvalResult - 评测结果
 */
export interface EvalResult {
  runId: string;
  caseName: string;
  passed: boolean;
  scores: EvalScore;
  overall: number;  // 综合评分 0-100
  findings: string[];
  warnings: string[];
  suggestions: string[];
  triggerEvolution?: {
    circuit: EvolutionCircuitType;
    reason: string;
    suggestedChanges: string[];
  };
  traceRef: string;
  evaluatedAt: string;
}

/**
 * CaseDefinition - 测试用例定义
 */
export interface CaseDefinition {
  caseId: string;
  name: string;
  description: string;
  category: 'regression' | 'benchmark' | 'safety' | 'reliability' | 'replay';
  spec: RunSpec;
  enabled: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * SuiteResult - 测试套件结果
 */
export interface SuiteResult {
  suiteName: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  blockedCases: number;
  results: EvalResult[];
  summary: {
    avgOutcome: number;
    avgProcess: number;
    avgSafety: number;
    avgReliability: number;
    avgCost: number;
    avgOverall: number;
    totalLatencyMs: number;
  };
  regressionDetected: boolean;
  triggerEvolutionRequired: boolean;
  executedAt: string;
}

/**
 * ToolAdapterMode - Tool 适配器模式
 */
export type ToolAdapterMode = 'prod' | 'mock' | 'replay';

/**
 * ToolAdapter - Tool 适配器接口
 */
export interface ToolAdapter {
  name: string;
  mode: ToolAdapterMode;
  invoke(input: unknown, ctx: ToolContext): Promise<unknown>;
}

export interface ToolContext {
  runId: string;
  sessionId?: string;
  userId?: string;
  mockOverrides?: Record<string, unknown>;
}

/**
 * EventSink - 事件接收器接口
 */
export interface EventSink {
  emit(event: ClawEvent): Promise<void>;
  flush(): Promise<void>;
}

/**
 * EventBusConfig - 事件总线配置
 */
export interface EventBusConfig {
  bufferSize: number;
  flushIntervalMs: number;
  enableReplay: boolean;
}

/**
 * Test Harness Event Types
 */
export type TestHarnessEventType =
  | 'test_suite_start'
  | 'test_suite_complete'
  | 'test_run_start'
  | 'test_run_complete'
  | 'test_failed'
  | 'regression_detected'
  | 'evolution_triggered'
  | 'case_added'
  | 'case_removed';

/**
 * Test Harness Event
 */
export interface TestHarnessEvent {
  type: TestHarnessEventType;
  id: string;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Test Harness 配置
 */
export interface TestHarnessConfig {
  enabled: boolean;
  autoTriggerEvolution: boolean;
  safetyGateThreshold: number;
  regressionThreshold: number;
  eventBus: EventBusConfig;
  caseStorePath: string;
  traceStorePath: string;
}

/**
 * Default Test Harness Configuration
 */
export const DEFAULT_TEST_HARNESS_CONFIG: TestHarnessConfig = {
  enabled: true,
  autoTriggerEvolution: true,
  safetyGateThreshold: 70,
  regressionThreshold: 10,
  eventBus: {
    bufferSize: 1000,
    flushIntervalMs: 5000,
    enableReplay: true,
  },
  caseStorePath: './cases',
  traceStorePath: './traces',
};

/**
 * EvolutionCircuitType 扩展 - 支持 Test 触发 + Skill 进化
 */
export enum EvolutionCircuitType {
  PERMISSION = 'permission',
  PERFORMANCE = 'performance',
  MEMORY = 'memory',
  SKILL = 'skill',
  TEST_TRIGGERED = 'test_triggered',
}

/**
 * EvolutionStatus 扩展 - 支持 Test 等待
 */
export enum EvolutionStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused',
  WAITING_TEST = 'waiting_test',
}

/**
 * HarnessEventType 扩展 - 支持 Test 事件
 */
export type HarnessEventType =
  | 'harness_start'
  | 'harness_complete'
  | 'evolution_cycle'
  | 'evolution_change'
  | 'permission_update'
  | 'performance_tuning'
  | 'memory_optimization'
  | 'skill_evolution'
  | 'trustworthy_execution'
  | 'ab_test_start'
  | 'ab_test_complete'
  | 'rollback_triggered'
  | 'test_run_started'
  | 'test_run_complete'
  | 'test_failed'
  | 'regression_detected'
  | 'evolution_triggered'
  | 'safety_gate_triggered';

// ================================================================================
// Budget & Usage Management Types (M3 新增)
// ================================================================================

export enum BudgetStatus {
  OK = 'ok',
  WARNING = 'warning',
  EXCEEDED = 'exceeded',
  DEPLETED = 'depleted',
}

export enum UsageStatus {
  OK = 'ok',
  RATE_LIMITED = 'rate_limited',
  THROTTLED = 'throttled',
  UNAVAILABLE = 'unavailable',
}

export interface BudgetConfig {
  dailyTokenLimit: number;
  weeklyTokenLimit?: number;
  monthlyTokenLimit?: number;
  perRequestLimit: number;
  warningThreshold?: number;
  criticalThreshold?: number;
}

export interface TokenUsage {
  consumed: number;
  requestCount: number;
  timestamp: number;
  dailyUsage?: number;
  weeklyUsage?: number;
  monthlyUsage?: number;
}

export interface BudgetCheckResult {
  status: BudgetStatus;
  consumedRatio: number;
  remaining: number;
  shouldDegrade: boolean;
  recommendedModel?: string;
  message: string;
}

export interface UsageCheckResult {
  status: UsageStatus;
  retryAfterMs?: number;
  shouldSwitchModel: boolean;
  fallbackModel?: string;
}

export interface ModelCapability {
  name: string;
  maxTokens: number;
  costPer1KTokens: number;
  priority: number;
  supportsStreaming: boolean;
  provider: 'openai' | 'anthropic' | 'zhipu' | 'dashscope' | 'deepseek';
}

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  dailyTokenLimit: 1000000,
  weeklyTokenLimit: 5000000,
  monthlyTokenLimit: 20000000,
  perRequestLimit: 32000,
  warningThreshold: 0.8,
  criticalThreshold: 0.95,
};

/* ================================================================================
 * Skill Evolver Types (P1 新增)
 * 技能进化器类型定义 — 四层递进式反馈机制
 * Inspired by 科大讯飞招采AI智能体平台2.0
 * ================================================================================ */

/**
 * Skill Evolver Configuration
 * 技能进化器配置
 */
export interface SkillEvolverConfig {
  /** 案例窗口（默认 100 次执行） */
  caseWindow: number;
  /** 标准演进阈值（默认 5 次同类错误触发更新） */
  standardThreshold: number;
  /** 思维链分析深度（默认 3 层） */
  chainDepth: number;
}

/**
 * Default Skill Evolver Configuration
 * 默认技能进化器配置
 */
export const DEFAULT_SKILL_EVOLVER_CONFIG: SkillEvolverConfig = {
  caseWindow: 100,
  standardThreshold: 5,
  chainDepth: 3,
};

/**
 * Skill Case Review
 * 技能执行案例复核记录
 */
export interface SkillCaseReview {
  /** 技能 ID */
  skillId: string;
  /** 执行时间 */
  timestamp: Date;
  /** 是否成功 */
  success: boolean;
  /** 错误类型（失败时填写） */
  errorType?: 'format' | 'dependency' | 'semantic' | 'runtime';
  /** 执行上下文快照 */
  context: ExecutionContext;
}

/**
 * Skill Context — SkillEvolver.evolve() 的输入
 * 技能进化上下文
 */
export interface SkillContext {
  /** 技能 ID */
  skillId: string;
  /** 版本号 */
  version?: string;
  /** 当前技能元数据 */
  metadata?: Record<string, unknown>;
  /** 最近的执行结果 */
  recentExecutions?: SkillCaseReview[];
}

/**
 * Standard Evolution Entry
 * 标准演进条目 — Layer 2 产出
 */
export interface StandardEvolutionEntry {
  /** 条目 ID */
  id: string;
  /** 触发的错误类型 */
  errorType: 'format' | 'dependency' | 'semantic' | 'runtime' | 'unknown';
  /** 触发次数 */
  triggerCount: number;
  /** 触发阈值 */
  threshold: number;
  /** 生成的新规则描述 */
  newRule: string;
  /** 创建时间 */
  createdAt: number;
}

/**
 * Chain of Thought Entry
 * 评审思维链条目 — Layer 3 产出
 */
export interface ChainOfThoughtEntry {
  /** 条目 ID */
  id: string;
  /** 分析深度（1 ~ chainDepth） */
  depth: number;
  /** 错误类型链 */
  errorChain: string;
  /** 关联的案例 ID */
  caseIds: string[];
  /** 分析描述 */
  analysis: string;
  /** 创建时间 */
  createdAt: number;
}

/**
 * Wisdom Prediction
 * 智慧预测条目 — Layer 4 产出
 */
export interface WisdomPrediction {
  /** 预测 ID */
  id: string;
  /** 预测类型 */
  type: 'warning' | 'improvement' | 'prediction';
  /** 预测描述 */
  description: string;
  /** 置信度 0-1 */
  confidence: number;
  /** 建议的行动 */
  suggestedActions: string[];
  /** 创建时间 */
  createdAt: number;
}

/* ================================================================================
 * Trustworthy Executor Types (P1 新增)
 * 可信执行引擎类型定义 — 三步法
 * Inspired by 科大讯飞招采AI智能体平台2.0
 * ================================================================================ */

/**
 * Risk Level
 * 风险等级
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Trustworthy Executor Configuration
 * 可信执行器配置
 */
export interface TrustworthyExecutorConfig {
  /** 生成可追溯证据链 */
  enableEvidenceChain: boolean;
  /** 启用规则引擎强校验 */
  enableRuleValidation: boolean;
  /** 启用风险标记 */
  enableRiskFlagging: boolean;
  /** 最大递归深度 */
  maxRecursionDepth: number;
}

/**
 * Default Trustworthy Executor Configuration
 * 默认可信执行器配置
 */
export const DEFAULT_TRUSTWORTHY_EXECUTOR_CONFIG: TrustworthyExecutorConfig = {
  enableEvidenceChain: true,
  enableRuleValidation: true,
  enableRiskFlagging: true,
  maxRecursionDepth: 10,
};

/**
 * Execution Task — TrustworthyExecutor.execute() 的输入
 * 执行任务
 */
export interface ExecutionTask {
  /** 任务 ID */
  id: string;
  /** 任务输入 */
  input: string;
  /** 任务上下文 */
  context?: Record<string, unknown>;
  /** 预期输出格式（可选） */
  expectedFormat?: string;
}

/**
 * Evidence — 可追溯证据
 * 证据条目
 */
export interface Evidence {
  /** 证据类型 */
  type: 'retrieval' | 'calculation' | 'reference' | 'logic';
  /** 证据来源 */
  source: string;
  /** 证据内容 */
  content: string;
  /** 证据置信度 0-1 */
  confidence: number;
}

/**
 * Execution Step — 单步执行记录
 * 执行步骤
 */
export interface ExecutionStep {
  /** 步骤 ID */
  stepId: string;
  /** 步骤类型 */
  type: 'understand' | 'find_evidence' | 'make_judgment';
  /** 步骤输入 */
  input: string;
  /** 步骤输出 */
  output: string;
  /** 支撑证据 */
  evidence: Evidence[];
  /** 应用的规则（可选） */
  ruleApplied?: string;
  /** 风险等级（可选） */
  riskLevel?: RiskLevel;
}

/**
 * Execution Result — TrustworthyExecutor.execute() 的输出
 * 执行结果
 */
export interface ExecutionResult {
  /** 任务 ID */
  taskId: string;
  /** 执行状态 */
  status: 'completed' | 'failed';
  /** 结论 */
  conclusion: string | null;
  /** 执行步骤 */
  steps: ExecutionStep[];
  /** 完整证据链 */
  evidenceChain: Evidence[];
  /** 风险等级 */
  riskLevel: RiskLevel;
  /** 综合置信度 */
  confidence: number;
  /** 是否可追溯 */
  traceable: boolean;
  /** 开始时间 */
  startedAt: number;
  /** 完成时间 */
  completedAt: number;
  /** 错误信息（失败时） */
  error?: string;
}

/**
 * Rule Definition — 规则定义
 * 可信执行规则
 */
export interface RuleDefinition {
  /** 规则 ID */
  id: string;
  /** 规则描述 */
  description: string;
  /** 匹配模式（正则表达式字符串，可选） */
  pattern?: string;
  /** 规则置信度 0-1 */
  confidence: number;
  /** 规则优先级（越大越优先） */
  priority?: number;
}

/**
 * Execution Context — 可信执行上下文
 * 与 SkillCaseReview.context 共享
 */
export interface ExecutionContext {
  /** 执行环境 */
  environment?: string;
  /** 调用者 ID */
  callerId?: string;
  /** 输入摘要 */
  inputSummary?: string;
  /** 额外数据 */
  extra?: Record<string, unknown>;
}
