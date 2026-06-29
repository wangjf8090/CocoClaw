/**
 * Model Router Tests
 */

import { ModelRouter } from '../src/router.js';
import { HealthMonitor } from '../src/health-check.js';
import { createFallbackChain, FallbackManager } from '../src/fallback.js';
import {
  ModelAdapter,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  HealthStatus,
} from '../src/types.js';

class MockAdapter implements ModelAdapter {
  name: string;
  provider = ModelProvider.OPENAI;
  priority: number;
  costPerToken = 0.00001;
  maxTokens = 10000;
  supportsStreaming = false;
  private shouldFail = false;
  private latency = 10;

  constructor(name: string, priority: number) {
    this.name = name;
    this.priority = priority;
  }

  setFail(fail: boolean) { this.shouldFail = fail; }
  setLatency(ms: number) { this.latency = ms; }

  async healthCheck(): Promise<HealthStatus> {
    return this.shouldFail ? HealthStatus.UNHEALTHY : HealthStatus.HEALTHY;
  }

  async invoke(_request: ModelRequest): Promise<ModelResponse> {
    await new Promise(r => setTimeout(r, this.latency));
    if (this.shouldFail) {
      return { content: '', model: this.name, latencyMs: this.latency, error: 'mock error' };
    }
    return { content: `response from ${this.name}`, model: this.name, latencyMs: this.latency };
  }
}

function test(name: string, fn: () => void): void {
  try { fn(); console.log(`✅ ${name}`); }
  catch (e: any) { console.error(`❌ ${name}: ${e.message}`); throw e; }
}

// ModelRouter Tests
test('Router.registerAdapter works', () => {
  const router = new ModelRouter();
  const adapter = new MockAdapter('test', 1);
  router.registerAdapter(adapter);
  const result = router.getAdapter('test');
  if (!result) throw new Error('Adapter not found');
});

test('Router.route returns first healthy adapter', async () => {
  const router = new ModelRouter();
  const a1 = new MockAdapter('primary', 1);
  router.registerAdapter(a1);
  const result = await router.route({ prompt: 'hello' });
  if (!result.content.includes('primary')) throw new Error('Wrong adapter');
});

test('Router.routeWithFallback skips failed adapter', async () => {
  const router = new ModelRouter();
  const a1 = new MockAdapter('first', 1);
  const a2 = new MockAdapter('second', 2);
  a1.setFail(true);
  router.registerAdapter(a1);
  router.registerAdapter(a2);
  const result = await router.routeWithFallback({ prompt: 'hello' });
  if (!result.content.includes('second')) throw new Error('Should fallback');
});

test('Router.listAdapters shows health', () => {
  const router = new ModelRouter();
  router.registerAdapter(new MockAdapter('a', 1));
  router.registerAdapter(new MockAdapter('b', 2));
  const list = router.listAdapters();
  if (list.length !== 2) throw new Error('Wrong count');
});

// HealthMonitor Tests
test('HealthMonitor.checkHealth works', async () => {
  const monitor = new HealthMonitor();
  const adapter = new MockAdapter('test', 1);
  monitor.registerAdapter(adapter);
  const result = await monitor.checkHealth('test');
  if (result.status !== HealthStatus.HEALTHY) throw new Error('Wrong status');
});

test('HealthMonitor.isHealthy returns correct value', async () => {
  const monitor = new HealthMonitor();
  const adapter = new MockAdapter('test', 1);
  monitor.registerAdapter(adapter);
  await monitor.checkHealth('test');
  if (!monitor.isHealthy('test')) throw new Error('Should be healthy');
});

// FallbackManager Tests
test('FallbackManager.getNextFallback returns next', () => {
  const manager = new FallbackManager();
  const a1 = new MockAdapter('first', 1);
  const a2 = new MockAdapter('second', 2);
  manager.registerModel(a1);
  manager.registerModel(a2);
  const next = manager.getNextFallback('first');
  if (next?.name !== 'second') throw new Error('Wrong next');
});

test('FallbackManager.circuitBreaker opens after failures', () => {
  const manager = new FallbackManager({ circuitBreakerThreshold: 2 });
  const a1 = new MockAdapter('first', 1);
  manager.registerModel(a1);
  manager.recordFailure('first');
  manager.recordFailure('first');
  if (!manager.isCircuitOpen('first')) throw new Error('Circuit should be open');
});

test('createFallbackChain works', async () => {
  const adapters = [new MockAdapter('a', 1), new MockAdapter('b', 2)];
  const chain = createFallbackChain(adapters);
  const result = await chain({ prompt: 'test' });
  if (result.successModel !== 'a') throw new Error('Should succeed on first');
});

console.log('\n✅ All router tests passed!');
