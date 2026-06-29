/**
 * PerformanceEvolver Budget Tests (JS)
 */

const { PerformanceEvolver } = require('../src/performance-evolver.js');
const { DEFAULT_BUDGET_CONFIG } = require('../src/types.js');
const BudgetStatus = { OK: 'ok', WARNING: 'warning', EXCEEDED: 'exceeded', DEPLETED: 'depleted' };

const config = {
  autoTuneContextWindow: true,
  autoOptimizeCacheStrategy: true,
  autoTuneParallelism: true,
  tokenUsageOptimization: true,
  targetLatencyMs: 1000,
  compressionThreshold: 0.7,
};

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${expected}, got ${actual}`);
  }
}

function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); }
  catch (e) { console.error(`❌ ${name}: ${e.message}`); throw e; }
}

test('Budget OK when under limit', () => {
  const evolver = new PerformanceEvolver(config);
  const result = evolver.checkBudgetExceeded({ consumed: 500000 }, DEFAULT_BUDGET_CONFIG);
  assertEqual(result.status, BudgetStatus.OK, 'status');
  assertEqual(result.shouldDegrade, false, 'shouldDegrade');
});

test('Budget WARNING at 80%', () => {
  const evolver = new PerformanceEvolver(config);
  const result = evolver.checkBudgetExceeded({ consumed: 800000 }, DEFAULT_BUDGET_CONFIG);
  assertEqual(result.status, BudgetStatus.WARNING, 'status');
});

test('Budget DEPLETED at 95%', () => {
  const evolver = new PerformanceEvolver(config);
  const result = evolver.checkBudgetExceeded({ consumed: 950000 }, DEFAULT_BUDGET_CONFIG);
  assertEqual(result.status, BudgetStatus.DEPLETED, 'status');
  assertEqual(result.shouldDegrade, true, 'shouldDegrade');
});

test('Budget EXCEEDED when over', () => {
  const evolver = new PerformanceEvolver(config);
  const result = evolver.checkBudgetExceeded({ consumed: 1100000 }, DEFAULT_BUDGET_CONFIG);
  assertEqual(result.status, BudgetStatus.EXCEEDED, 'status');
  assertEqual(result.recommendedModel, 'GLM-5.2', 'recommendedModel');
});

test('recordTokenConsumption works', () => {
  const evolver = new PerformanceEvolver(config);
  evolver.recordTokenConsumption(1000);
  evolver.recordTokenConsumption(2000);
  assertEqual(evolver.getTotalConsumption(), 3000, 'totalConsumption');
});

test('resetConsumption works', () => {
  const evolver = new PerformanceEvolver(config);
  evolver.recordTokenConsumption(5000);
  evolver.resetConsumption();
  assertEqual(evolver.getTotalConsumption(), 0, 'totalConsumption');
});

test('checkUsageLimited detects 429', () => {
  const evolver = new PerformanceEvolver(config);
  const result = evolver.checkUsageLimited('429');
  assertEqual(result.isLimited, true, 'isLimited');
});

test('getFallbackChain has 5 models', () => {
  const evolver = new PerformanceEvolver(config);
  const chain = evolver.getFallbackChain();
  assertEqual(chain.length, 5, 'chain length');
  assertEqual(chain[0], 'Claude-3.7-Sonnet', 'first model');
  assertEqual(chain[4], 'DeepSeek-V3', 'last model');
});

console.log('\n✅ All budget tests passed!');
