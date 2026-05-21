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

/================================================================================
 * Test Harness Types (融合新增)
 * 测试与治理系统类型定义
 * OpenClaw Runtime = Agent OS, Harness = QA + Replay + Safety Lab
================================================================================/

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
 * EvolutionCircuitType 扩展 - 支持 Test 触发
 */
export enum EvolutionCircuitType {
  PERMISSION = 'permission',
  PERFORMANCE = 'performance',
  MEMORY = 'memory',
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
  | 'ab_test_start'
  | 'ab_test_complete'
  | 'rollback_triggered'
  | 'test_run_started'
  | 'test_run_complete'
  | 'test_failed'
  | 'regression_detected'
  | 'evolution_triggered'
  | 'safety_gate_triggered';
