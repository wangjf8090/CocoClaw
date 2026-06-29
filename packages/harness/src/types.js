"use strict";
/**
 * Self-Evolution Harness Types
 * 自我进化编排层类型定义
 *
 * Three evolution circuits:
 * 1. Permission Evolver - 权限进化器
 * 2. Performance Evolver - 性能进化器
 * 3. Memory Evolver - 记忆进化器
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BUDGET_CONFIG = exports.UsageStatus = exports.BudgetStatus = exports.DEFAULT_TEST_HARNESS_CONFIG = exports.DEFAULT_HARNESS_CONFIG = exports.EvolutionStatus = exports.EvolutionCircuitType = void 0;
/**
 * Evolution Circuit Type
 * 进化回路类型
 */
var EvolutionCircuitType;
(function (EvolutionCircuitType) {
    EvolutionCircuitType["PERMISSION"] = "permission";
    EvolutionCircuitType["PERFORMANCE"] = "performance";
    EvolutionCircuitType["MEMORY"] = "memory";
})(EvolutionCircuitType || (exports.EvolutionCircuitType = EvolutionCircuitType = {}));
/**
 * Evolution Status
 * 进化状态
 */
var EvolutionStatus;
(function (EvolutionStatus) {
    EvolutionStatus["IDLE"] = "idle";
    EvolutionStatus["RUNNING"] = "running";
    EvolutionStatus["COMPLETED"] = "completed";
    EvolutionStatus["FAILED"] = "failed";
    EvolutionStatus["PAUSED"] = "paused";
})(EvolutionStatus || (exports.EvolutionStatus = EvolutionStatus = {}));
/**
 * Default Harness Configuration
 * 默认编排配置
 */
exports.DEFAULT_HARNESS_CONFIG = {
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
 * Default Test Harness Configuration
 */
exports.DEFAULT_TEST_HARNESS_CONFIG = {
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
(function (EvolutionCircuitType) {
    EvolutionCircuitType["PERMISSION"] = "permission";
    EvolutionCircuitType["PERFORMANCE"] = "performance";
    EvolutionCircuitType["MEMORY"] = "memory";
    EvolutionCircuitType["TEST_TRIGGERED"] = "test_triggered";
})(EvolutionCircuitType || (exports.EvolutionCircuitType = EvolutionCircuitType = {}));
/**
 * EvolutionStatus 扩展 - 支持 Test 等待
 */
(function (EvolutionStatus) {
    EvolutionStatus["IDLE"] = "idle";
    EvolutionStatus["RUNNING"] = "running";
    EvolutionStatus["COMPLETED"] = "completed";
    EvolutionStatus["FAILED"] = "failed";
    EvolutionStatus["PAUSED"] = "paused";
    EvolutionStatus["WAITING_TEST"] = "waiting_test";
})(EvolutionStatus || (exports.EvolutionStatus = EvolutionStatus = {}));
// ================================================================================
// Budget & Usage Management Types (M3 新增)
// ================================================================================
var BudgetStatus;
(function (BudgetStatus) {
    BudgetStatus["OK"] = "ok";
    BudgetStatus["WARNING"] = "warning";
    BudgetStatus["EXCEEDED"] = "exceeded";
    BudgetStatus["DEPLETED"] = "depleted";
})(BudgetStatus || (exports.BudgetStatus = BudgetStatus = {}));
var UsageStatus;
(function (UsageStatus) {
    UsageStatus["OK"] = "ok";
    UsageStatus["RATE_LIMITED"] = "rate_limited";
    UsageStatus["THROTTLED"] = "throttled";
    UsageStatus["UNAVAILABLE"] = "unavailable";
})(UsageStatus || (exports.UsageStatus = UsageStatus = {}));
exports.DEFAULT_BUDGET_CONFIG = {
    dailyTokenLimit: 1000000,
    weeklyTokenLimit: 5000000,
    monthlyTokenLimit: 20000000,
    perRequestLimit: 32000,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
};
