/**
 * PerformanceEvolver Budget Tests
 */

import { PerformanceEvolver } from '../src/performance-evolver.js';
import { PerformanceEvolverConfig } from '../src/types.js';
import { BudgetStatus, DEFAULT_BUDGET_CONFIG } from '../src/types.js';

const config: PerformanceEvolverConfig = {
  autoTuneContextWindow: true,
  autoOptimizeCacheStrategy: true,
  autoTuneParallelism: true,
  tokenUsageOptimization: true,
  targetLatencyMs: 1000,
  compressionThreshold: 0.7,
};

function assertEqual<T>(actual: T, expected: T, msg: string): void {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (e: any) {
    console.error(`❌ ${name}: ${e.message}`);
    throw e;
  }
}

test('Budget OK when under limit', () => {
  const evolver = new PerformanceEvolver(config);
  const result = evolver.checkBudgetExceeded({ consumed: 500000 }, DEFAULT_BUDGET_CONFIG);
  assertEqual(result.status, BudgetStatus.OK, 'status');
  assertEqual(result.shouldDegrade, false, 'shouldDegrade');
});

test('Budget WARNING at 80% threshold', () => {
  const evolver = new PerformanceEvolver(config);
  const result = evolver.checkBudgetExceeded({ consumed: 800000 }, DEFAULT_BUDGET_CONFIG);
  assertEqual(result.status, BudgetStatus.WARNING, 'status');
  assertEqual(result.consumedRatio, 0.8, 'consumedRatio');
});

test('Budget DEPLETED at 95% threshold', () => {
  const evolver = new PerformanceEvolver(config);
  const result = evolver.checkBudgetExceeded({ consumed: 950000 }, DEFAULT_BUDGET_CONFIG);
  assertEqual(result.status, BudgetStatus.DEPLETED, 'status');
  assertEqual(result.shouldDegrade, true, 'shouldDegrade');
});

test('Budget EXCEEDED when over limit', () => {
  const evolver = new PerformanceEvolver(config);
  const result = evolver.checkBudgetExceeded({ consumed: 1100000 }, DEFAULT_BUDGET_CONFIG);
  assertEqual(result.status, BudgetStatus.EXCEEDED, 'status');
  assertEqual(result.shouldDegrade, true, 'shouldDegrade');
  assertEqual(result.recommendedModel, 'GLM-5.2', 'recommendedModel');
});

test('Custom budget config works', () => {
  const evolver = new PerformanceEvolver(config);
  const customBudget = {
    ...DEFAULT_BUDGET_CONFIG,
    dailyTokenLimit: 100000,
    warningThreshold: 0.5,
    criticalThreshold: 0.8,
  };
  const result = evolver.checkBudgetExceeded({ consumed: 60000 }, customBudget);
  assertEqual(result.status, BudgetStatus.WARNING, 'status at 60% with 50% warning');
});

test('recordTokenConsumption increments total', () => {
  const evolver = new PerformanceEvolver(config);
  evolver.recordTokenConsumption(1000);
  evolver.recordTokenConsumption(2000);
  assertEqual(evolver.getTotalConsumption(), 3000, 'totalConsumption');
});

test('resetConsumption clears counters', () => {
  const evolver = new PerformanceEvolver(config);
  evolver.recordTokenConsumption(5000);
  evolver.resetConsumption();
  assertEqual(evolver.getTotalConsumption(), 0, 'totalConsumption after reset');
});

test('checkUsageLimited detects rate limit', () => {
  const evolver = new PerformanceEvolver(config);
  const result = evolver.checkUsageLimited('429');
  assertEqual(result.isLimited, true, 'isLimited');
  assertEqual(result.fallbackModel, 'GPT-4o', 'fallbackModel');
});

test('checkUsageLimited returns OK for normal', () => {
  const evolver = new PerformanceEvolver(config);
  const result = evolver.checkUsageLimited('200');
  assertEqual(result.isLimited, false, 'isLimited');
});

test('getFallbackChain returns 5 models', () => {
  const evolver = new PerformanceEvolver(config);
  const chain = evolver.getFallbackChain();
  assertEqual(chain.length, 5, 'chain length');
  assertEqual(chain[0], 'Claude-3.7-Sonnet', 'first model');
  assertEqual(chain[4], 'DeepSeek-V3', 'last model');
});

console.log('\n✅ All budget tests passed!');
