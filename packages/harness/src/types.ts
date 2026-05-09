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
  maxIterations?: number;
  stream?: boolean;
  sessionId?: string;
  userId?: string;
  context?: Record<string, unknown>;
}
