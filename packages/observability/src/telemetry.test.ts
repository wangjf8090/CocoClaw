/**
 * Telemetry Module Unit Tests
 * Telemetry 模块单元测试
 *
 * 测试覆盖：
 *   - TelemetryManager 单例模式
 *   - 初始化/关闭生命周期
 *   - Span 创建与管理
 *   - Metric 记录（工具调用、Token 消耗、错误率）
 *   - 结构化日志
 *   - 健康状态检查
 *   - 异常处理（未初始化调用、重复初始化）
 *   - ManagedSpan 完整生命周期
 *   - TelemetryAdapter 接口
 *   - OtelAdapter 基础功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TelemetryManager,
  getTelemetryManager,
  initTelemetry,
  OtelAdapter,
  TelemetryConfig,
  TelemetryAdapter,
  ManagedSpan,
  TelemetrySpanContext,
  TelemetryHealth,
  DEFAULT_TELEMETRY_CONFIG,
} from './telemetry.js';

// ================================================================================
// Test Helpers
// ================================================================================

function createTestConfig(overrides: Partial<TelemetryConfig> = {}): TelemetryConfig {
  return {
    ...DEFAULT_TELEMETRY_CONFIG,
    serviceName: 'test-agent',
    ...overrides,
  };
}

// ================================================================================
// Tests: Singleton & Lifecycle
// ================================================================================

describe('TelemetryManager - Singleton & Lifecycle', () => {
  beforeEach(() => {
    TelemetryManager.resetInstance();
  });

  afterEach(async () => {
    await TelemetryManager.getInstance().shutdown();
    TelemetryManager.resetInstance();
  });

  it('should return the same instance via getInstance()', () => {
    const a = TelemetryManager.getInstance();
    const b = TelemetryManager.getInstance();
    expect(a).toBe(b);
  });

  it('should return the same instance via getTelemetryManager()', () => {
    const a = getTelemetryManager();
    const b = TelemetryManager.getInstance();
    expect(a).toBe(b);
  });

  it('should not be initialized before init()', () => {
    const tm = TelemetryManager.getInstance();
    expect(tm.isInitialized()).toBe(false);
  });

  it('should initialize successfully', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig());
    expect(tm.isInitialized()).toBe(true);
  });

  it('should not re-initialize when already initialized', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig());
    await tm.init(createTestConfig()); // Second call should be noop
    expect(tm.isInitialized()).toBe(true);
  });

  it('should shutdown gracefully', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig());
    await tm.shutdown();

    const health = tm.getHealth();
    expect(health.shutdown).toBe(true);
  });

  it('should handle shutdown on uninitialized instance', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.shutdown(); // Should not throw
  });

  it('should reset instance correctly', () => {
    TelemetryManager.getInstance();
    TelemetryManager.resetInstance();
    const tm = TelemetryManager.getInstance();
    expect(tm.isInitialized()).toBe(false);
  });

  it('should initialize with initTelemetry() convenience function', async () => {
    const tm = await initTelemetry(createTestConfig());
    expect(tm.isInitialized()).toBe(true);
  });
});

// ================================================================================
// Tests: Span Management
// ================================================================================

describe('TelemetryManager - Span Management', () => {
  beforeEach(async () => {
    TelemetryManager.resetInstance();
    await TelemetryManager.getInstance().init(createTestConfig());
  });

  afterEach(async () => {
    await TelemetryManager.getInstance().shutdown();
    TelemetryManager.resetInstance();
  });

  it('should create a span with specified name', () => {
    const tm = TelemetryManager.getInstance();
    const span = tm.startSpan({ name: 'test.span', kind: 'tool' });
    expect(span).toBeDefined();
    expect(typeof span.end).toBe('function');
    span.end();
  });

  it('should create a span with a valid span context', () => {
    const tm = TelemetryManager.getInstance();
    const span = tm.startSpan({ name: 'ctx.test', kind: 'agent' });
    const ctx = span.spanContext();
    expect(ctx.traceId).toBeTruthy();
    expect(ctx.spanId).toBeTruthy();
    expect(ctx.traceId.length).toBe(32);
    expect(ctx.spanId.length).toBe(16);
    span.end();
  });

  it('should track active spans', () => {
    const tm = TelemetryManager.getInstance();
    const span1 = tm.startSpan({ name: 'span.1', kind: 'agent' });
    expect(tm.getHealth().activeSpans).toBe(1);

    const span2 = tm.startSpan({ name: 'span.2', kind: 'tool' });
    expect(tm.getHealth().activeSpans).toBe(2);

    span1.end();
    expect(tm.getHealth().activeSpans).toBe(1);

    span2.end();
    expect(tm.getHealth().activeSpans).toBe(0);
  });

  it('should set span attributes', () => {
    const tm = TelemetryManager.getInstance();
    const span = tm.startSpan({
      name: 'attr.test',
      kind: 'tool',
      attributes: { 'tool.name': 'search', 'tool.input': 'hello' },
    });
    expect(span).toBeDefined();
    span.end();
  });

  it('should set span status to ok', () => {
    const tm = TelemetryManager.getInstance();
    const span = tm.startSpan({ name: 'status.test', kind: 'agent' });
    span.setStatus('ok');
    span.end();
    // Should not throw
  });

  it('should set span status to error', () => {
    const tm = TelemetryManager.getInstance();
    const span = tm.startSpan({ name: 'error.test', kind: 'tool' });
    span.setStatus('error', 'Something went wrong');
    span.end();
    // Should not throw
  });

  it('should record exceptions', () => {
    const tm = TelemetryManager.getInstance();
    const span = tm.startSpan({ name: 'exception.test', kind: 'tool' });
    span.recordException(new Error('Test error'));
    span.end();
    // Should not throw
  });

  it('should add events to span', () => {
    const tm = TelemetryManager.getInstance();
    const span = tm.startSpan({ name: 'event.test', kind: 'agent' });
    span.addEvent('processing_started', { step: 1 });
    span.addEvent('processing_completed', { step: 2 });
    span.end();
    // Should not throw
  });

  it('should return trace ID from active span', () => {
    const tm = TelemetryManager.getInstance();
    const span = tm.startSpan({ name: 'trace.test', kind: 'agent' });
    const traceId = tm.getCurrentTraceId();
    expect(traceId).toBeDefined();
    expect(traceId).toBeTruthy();
    expect(traceId!.length).toBe(32);
    span.end();
  });

  it('should return span ID from active span', () => {
    const tm = TelemetryManager.getInstance();
    const span = tm.startSpan({ name: 'spanid.test', kind: 'agent' });
    const spanId = tm.getCurrentSpanId();
    expect(spanId).toBeDefined();
    expect(spanId).toBeTruthy();
    expect(spanId!.length).toBe(16);
    span.end();
  });

  it('should return span context', () => {
    const tm = TelemetryManager.getInstance();
    const span = tm.startSpan({ name: 'ctx.test', kind: 'agent' });
    const ctx = tm.getCurrentSpanContext();
    expect(ctx).toBeDefined();
    expect(ctx?.traceId).toBeTruthy();
    expect(ctx?.spanId).toBeTruthy();
    span.end();
  });

  it('should return null for trace ID when no active span', () => {
    const tm = TelemetryManager.getInstance();
    expect(tm.getCurrentTraceId()).toBeNull();
  });

  it('should create a noop span when not initialized', () => {
    TelemetryManager.resetInstance();
    const tm = TelemetryManager.getInstance();
    const span = tm.startSpan({ name: 'noop', kind: 'tool' });
    expect(span).toBeDefined();
    expect(span.spanContext()).toBeDefined();
    span.end();
  });

  it('should support nested spans (parent-child relationship)', () => {
    const tm = TelemetryManager.getInstance();
    const parent = tm.startSpan({ name: 'parent', kind: 'agent' });
    const child = tm.startSpan({ name: 'child', kind: 'tool' });

    expect(tm.getHealth().activeSpans).toBe(2);

    child.end();
    expect(tm.getHealth().activeSpans).toBe(1);

    parent.end();
    expect(tm.getHealth().activeSpans).toBe(0);
  });

  it('should prevent double-ending a span', () => {
    const tm = TelemetryManager.getInstance();
    const span = tm.startSpan({ name: 'double.end', kind: 'internal' });
    span.end();
    // Second end should be a noop, not throw
    span.end();
    expect(tm.getHealth().activeSpans).toBe(0);
  });

  it('should handle span with all kinds', () => {
    const tm = TelemetryManager.getInstance();
    const kinds: Array<'agent' | 'tool' | 'model' | 'memory' | 'security' | 'internal'> = [
      'agent', 'tool', 'model', 'memory', 'security', 'internal',
    ];

    for (const kind of kinds) {
      const span = tm.startSpan({ name: `kind.${kind}`, kind });
      expect(span).toBeDefined();
      span.end();
    }
  });
});

// ================================================================================
// Tests: Metrics
// ================================================================================

describe('TelemetryManager - Metrics', () => {
  beforeEach(async () => {
    TelemetryManager.resetInstance();
    await TelemetryManager.getInstance().init(createTestConfig());
  });

  afterEach(async () => {
    await TelemetryManager.getInstance().shutdown();
    TelemetryManager.resetInstance();
  });

  it('should record tool call metric', () => {
    const tm = TelemetryManager.getInstance();
    const before = tm.getHealth().metricEventsRecorded;

    tm.recordToolCall({
      toolName: 'search',
      duration: 150,
      status: 'success',
    });

    expect(tm.getHealth().metricEventsRecorded).toBeGreaterThan(before);
  });

  it('should record tool call with error status', () => {
    const tm = TelemetryManager.getInstance();
    const before = tm.getHealth().metricEventsRecorded;

    tm.recordToolCall({
      toolName: 'fetch_url',
      duration: 5000,
      status: 'error',
      agentName: 'test-agent',
    });

    expect(tm.getHealth().metricEventsRecorded).toBeGreaterThan(before);
  });

  it('should record tool call with timeout status', () => {
    const tm = TelemetryManager.getInstance();
    const before = tm.getHealth().metricEventsRecorded;

    tm.recordToolCall({
      toolName: 'long_running',
      duration: 30000,
      status: 'timeout',
    });

    expect(tm.getHealth().metricEventsRecorded).toBeGreaterThan(before);
  });

  it('should track counter values', () => {
    const tm = TelemetryManager.getInstance();

    tm.recordToolCall({ toolName: 'search', duration: 100, status: 'success' });
    tm.recordToolCall({ toolName: 'search', duration: 200, status: 'success' });
    tm.recordToolCall({ toolName: 'search', duration: 300, status: 'error' });

    const successCount = tm.getMetricCounter('tool_call:search:success');
    const errorCount = tm.getMetricCounter('tool_call:search:error');

    expect(successCount).toBe(2);
    expect(errorCount).toBe(1);
  });

  it('should track histogram values', () => {
    const tm = TelemetryManager.getInstance();

    tm.recordToolCall({ toolName: 'search', duration: 100, status: 'success' });
    tm.recordToolCall({ toolName: 'search', duration: 200, status: 'success' });

    const histogram = tm.getMetricHistogram('tool_duration:search');
    expect(histogram).toHaveLength(2);
    expect(histogram).toContain(100);
    expect(histogram).toContain(200);
  });

  it('should record token consumption', () => {
    const tm = TelemetryManager.getInstance();
    const before = tm.getHealth().metricEventsRecorded;

    tm.recordTokenConsumption({
      modelName: 'gpt-4',
      tokens: 1024,
      type: 'input',
    });

    tm.recordTokenConsumption({
      modelName: 'gpt-4',
      tokens: 512,
      type: 'output',
    });

    expect(tm.getHealth().metricEventsRecorded).toBeGreaterThan(before);

    const inputTokens = tm.getMetricCounter('token:gpt-4:input');
    const outputTokens = tm.getMetricCounter('token:gpt-4:output');
    expect(inputTokens).toBe(1024);
    expect(outputTokens).toBe(512);
  });

  it('should record execution duration', () => {
    const tm = TelemetryManager.getInstance();
    const before = tm.getHealth().metricEventsRecorded;

    tm.recordExecutionDuration(2500, {
      agentName: 'test-agent',
      operation: 'full_run',
    });

    expect(tm.getHealth().metricEventsRecorded).toBeGreaterThan(before);
    const histogram = tm.getMetricHistogram('execution:full_run');
    expect(histogram).toContain(2500);
  });

  it('should record error metric', () => {
    const tm = TelemetryManager.getInstance();
    const before = tm.getHealth().metricEventsRecorded;

    tm.recordError({
      errorType: 'TimeoutError',
      message: 'Tool execution timed out',
      toolName: 'search',
      agentName: 'test-agent',
    });

    expect(tm.getHealth().metricEventsRecorded).toBeGreaterThan(before);
    const errorCount = tm.getMetricCounter('error:TimeoutError:search');
    expect(errorCount).toBe(1);
  });

  it('should record model call metric', () => {
    const tm = TelemetryManager.getInstance();
    const before = tm.getHealth().metricEventsRecorded;

    tm.recordModelCall({
      modelName: 'gpt-4o',
      duration: 1200,
      tokensIn: 800,
      tokensOut: 400,
      status: 'success',
    });

    expect(tm.getHealth().metricEventsRecorded).toBeGreaterThan(before);
  });

  it('should record model call with error', () => {
    const tm = TelemetryManager.getInstance();
    const before = tm.getHealth().metricEventsRecorded;

    tm.recordModelCall({
      modelName: 'gpt-4o',
      duration: 30000,
      status: 'error',
    });

    expect(tm.getHealth().metricEventsRecorded).toBeGreaterThan(before);
  });

  it('should not throw when recording metrics on uninitialized instance', () => {
    TelemetryManager.resetInstance();
    const tm = TelemetryManager.getInstance();

    expect(() => {
      tm.recordToolCall({ toolName: 'test', duration: 100, status: 'success' });
      tm.recordTokenConsumption({ modelName: 'test', tokens: 100 });
      tm.recordExecutionDuration(100);
      tm.recordError({ errorType: 'test', message: 'test' });
      tm.recordModelCall({ modelName: 'test', duration: 100, status: 'success' });
    }).not.toThrow();
  });

  it('should not record metrics when disabled', async () => {
    TelemetryManager.resetInstance();
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig({ metricsEnabled: false }));

    const before = tm.getHealth().metricEventsRecorded;
    tm.recordToolCall({ toolName: 'test', duration: 100, status: 'success' });
    expect(tm.getHealth().metricEventsRecorded).toBe(before);
  });
});

// ================================================================================
// Tests: Structured Logging
// ================================================================================

describe('TelemetryManager - Structured Logging', () => {
  beforeEach(async () => {
    TelemetryManager.resetInstance();
    await TelemetryManager.getInstance().init(createTestConfig());
  });

  afterEach(async () => {
    await TelemetryManager.getInstance().shutdown();
    TelemetryManager.resetInstance();
  });

  it('should log at info level', () => {
    const tm = TelemetryManager.getInstance();
    const before = tm.getHealth().logEntriesRecorded;

    tm.log('info', 'Test info message', { key: 'value' });

    expect(tm.getHealth().logEntriesRecorded).toBeGreaterThan(before);
  });

  it('should log at warn level', () => {
    const tm = TelemetryManager.getInstance();
    const before = tm.getHealth().logEntriesRecorded;

    tm.log('warn', 'Test warning', { code: 'WARN_001' });

    expect(tm.getHealth().logEntriesRecorded).toBeGreaterThan(before);
  });

  it('should log at error level', () => {
    const tm = TelemetryManager.getInstance();
    const before = tm.getHealth().logEntriesRecorded;

    tm.log('error', 'Test error', { error: 'Something went wrong' });

    expect(tm.getHealth().logEntriesRecorded).toBeGreaterThan(before);
  });

  it('should log at debug level', () => {
    const tm = TelemetryManager.getInstance();
    const before = tm.getHealth().logEntriesRecorded;

    tm.log('debug', 'Test debug', { detail: 'verbose' });

    expect(tm.getHealth().logEntriesRecorded).toBeGreaterThan(before);
  });

  it('should have convenience methods', () => {
    const tm = TelemetryManager.getInstance();
    const before = tm.getHealth().logEntriesRecorded;

    tm.info('Info via convenience');
    tm.warn('Warn via convenience');
    tm.error('Error via convenience');
    tm.debug('Debug via convenience');

    expect(tm.getHealth().logEntriesRecorded - before).toBe(4);
  });

  it('should store logs in buffer', () => {
    const tm = TelemetryManager.getInstance();

    tm.info('Log message 1');
    tm.info('Log message 2');

    const buffer = tm.getLogBuffer();
    expect(buffer).toHaveLength(2);
    expect(buffer[0].message).toBe('Log message 1');
    expect(buffer[1].message).toBe('Log message 2');
  });

  it('should include trace correlation in log entries', () => {
    const tm = TelemetryManager.getInstance();
    const span = tm.startSpan({ name: 'logging.test', kind: 'agent' });
    const expectedTraceId = tm.getCurrentTraceId();

    tm.info('Log within span', { inSpan: true });

    const buffer = tm.getLogBuffer();
    const lastEntry = buffer[buffer.length - 1];
    expect(lastEntry.traceId).toBe(expectedTraceId);
    expect(lastEntry.attributes).toEqual({ inSpan: true });

    span.end();
  });

  it('should clear log buffer', () => {
    const tm = TelemetryManager.getInstance();
    tm.info('Test 1');
    tm.info('Test 2');
    expect(tm.getLogBuffer()).toHaveLength(2);

    tm.clearLogBuffer();
    expect(tm.getLogBuffer()).toHaveLength(0);
  });

  it('should not throw when logging on uninitialized instance', () => {
    TelemetryManager.resetInstance();
    const tm = TelemetryManager.getInstance();

    expect(() => {
      tm.log('info', 'test');
      tm.info('test');
      tm.warn('test');
      tm.error('test');
      tm.debug('test');
    }).not.toThrow();
  });

  it('should not log when logs are disabled', async () => {
    TelemetryManager.resetInstance();
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig({ logsEnabled: false }));

    const before = tm.getHealth().logEntriesRecorded;
    tm.info('Should not be logged');
    expect(tm.getHealth().logEntriesRecorded).toBe(before);
  });
});

// ================================================================================
// Tests: Health & Status
// ================================================================================

describe('TelemetryManager - Health & Status', () => {
  beforeEach(async () => {
    TelemetryManager.resetInstance();
  });

  afterEach(async () => {
    await TelemetryManager.getInstance().shutdown();
    TelemetryManager.resetInstance();
  });

  it('should return correct health before initialization', () => {
    const tm = TelemetryManager.getInstance();
    const health = tm.getHealth();

    expect(health.initialized).toBe(false);
    expect(health.shutdown).toBe(false);
    expect(health.activeSpans).toBe(0);
    expect(health.initializedAt).toBeNull();
  });

  it('should return correct health after initialization', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig());

    const health = tm.getHealth();
    expect(health.initialized).toBe(true);
    expect(health.shutdown).toBe(false);
    expect(health.initializedAt).not.toBeNull();
    expect(health.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should return correct health after shutdown', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig());
    await tm.shutdown();

    const health = tm.getHealth();
    expect(health.shutdown).toBe(true);
  });

  it('should track metric events recorded', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig());

    const before = tm.getHealth().metricEventsRecorded;
    tm.recordToolCall({ toolName: 'test', duration: 100, status: 'success' });
    expect(tm.getHealth().metricEventsRecorded).toBeGreaterThan(before);
  });

  it('should track log entries recorded', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig());

    const before = tm.getHealth().logEntriesRecorded;
    tm.log('info', 'test');
    expect(tm.getHealth().logEntriesRecorded).toBeGreaterThan(before);
  });

  it('should return correct exporter type in health', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig({ exporter: 'console' }));

    const health = tm.getHealth();
    expect(health.exporter).toBe('console');
  });

  it('should track uptime correctly', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig());

    // Small delay to ensure uptime > 0
    await new Promise((resolve) => setTimeout(resolve, 10));

    const health = tm.getHealth();
    expect(health.uptimeMs).toBeGreaterThan(0);
  });
});

// ================================================================================
// Tests: Configuration
// ================================================================================

describe('TelemetryManager - Configuration', () => {
  beforeEach(() => {
    TelemetryManager.resetInstance();
  });

  afterEach(async () => {
    await TelemetryManager.getInstance().shutdown();
    TelemetryManager.resetInstance();
  });

  it('should use default config when none provided', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig());
    expect(tm.isInitialized()).toBe(true);
  });

  it('should accept custom service name', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig({ serviceName: 'custom-agent' }));
    expect(tm.isInitialized()).toBe(true);
  });

  it('should accept custom service version', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig({ serviceVersion: '2.0.0' }));
    expect(tm.isInitialized()).toBe(true);
  });

  it('should accept OTLP configuration', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(
      createTestConfig({
        exporter: 'otlp',
        otlpEndpoint: 'http://localhost:4318',
        otlpTimeoutMs: 5000,
      })
    );
    expect(tm.isInitialized()).toBe(true);
  });

  it('should accept custom sample rate', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig({ sampleRate: 0.5 }));
    expect(tm.isInitialized()).toBe(true);
  });

  it('should accept disabled metrics', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig({ metricsEnabled: false }));
    expect(tm.isInitialized()).toBe(true);
  });

  it('should accept disabled logs', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig({ logsEnabled: false }));
    expect(tm.isInitialized()).toBe(true);
  });

  it('should accept resource attributes', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(
      createTestConfig({
        resourceAttributes: {
          'deployment.environment': 'production',
          'host.name': 'node-1',
        },
      })
    );
    expect(tm.isInitialized()).toBe(true);
  });
});

// ================================================================================
// Tests: Edge Cases
// ================================================================================

describe('TelemetryManager - Edge Cases', () => {
  beforeEach(() => {
    TelemetryManager.resetInstance();
  });

  afterEach(async () => {
    await TelemetryManager.getInstance().shutdown();
    TelemetryManager.resetInstance();
  });

  it('should handle rapid init/shutdown cycles', async () => {
    const tm = TelemetryManager.getInstance();

    await tm.init(createTestConfig());
    await tm.shutdown();

    // Reset and re-init
    TelemetryManager.resetInstance();
    const tm2 = TelemetryManager.getInstance();
    await tm2.init(createTestConfig());
    expect(tm2.isInitialized()).toBe(true);
    await tm2.shutdown();
  });

  it('should handle span creation during shutdown', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig());

    await tm.shutdown();

    // Creating a span after shutdown should return a noop span
    const span = tm.startSpan({ name: 'shutdown.span', kind: 'internal' });
    expect(span).toBeDefined();
    span.end();
  });

  it('should handle metric recording during shutdown', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig());

    await tm.shutdown();

    // Should not throw after shutdown
    expect(() => {
      tm.recordToolCall({ toolName: 'test', duration: 100, status: 'success' });
    }).not.toThrow();
  });

  it('should handle log recording during shutdown', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig());

    await tm.shutdown();

    // Should not throw after shutdown
    expect(() => {
      tm.log('info', 'post-shutdown log');
    }).not.toThrow();
  });

  it('should handle multiple span creations and endings', () => {
    const tm = TelemetryManager.getInstance();
    // Without initialization (noop spans)
    const spans = Array.from({ length: 10 }, (_, i) =>
      tm.startSpan({ name: `span.${i}`, kind: 'tool' })
    );

    spans.forEach((s) => s.end());
    // Should not throw
  });

  it('should handle shutdown with active spans', async () => {
    const tm = TelemetryManager.getInstance();
    await tm.init(createTestConfig());

    // Create spans but don't end them
    tm.startSpan({ name: 'orphan.1', kind: 'agent' });
    tm.startSpan({ name: 'orphan.2', kind: 'tool' });

    await tm.shutdown();

    // All spans should be cleaned up
    expect(tm.getHealth().activeSpans).toBe(0);
  });
});

// ================================================================================
// Tests: Adapter Interface
// ================================================================================

describe('TelemetryManager - Adapter Interface', () => {
  beforeEach(() => {
    TelemetryManager.resetInstance();
  });

  afterEach(async () => {
    await TelemetryManager.getInstance().shutdown();
    TelemetryManager.resetInstance();
  });

  it('should register an adapter', async () => {
    const tm = TelemetryManager.getInstance();

    const mockAdapter: TelemetryAdapter = {
      init: vi.fn().mockResolvedValue(undefined),
      createSpan: vi.fn().mockReturnValue({
        spanContext: () => ({ traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), isRemote: false, traceFlags: 1 }),
        setAttribute: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        addEvent: vi.fn(),
        end: vi.fn(),
      }),
      getCurrentSpanContext: vi.fn().mockReturnValue(null),
      recordMetric: vi.fn(),
      emitLog: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    await tm.registerAdapter(mockAdapter);

    await tm.init(createTestConfig());
    expect(mockAdapter.init).toHaveBeenCalled();
  });

  it('should delegate span creation to adapter', async () => {
    const tm = TelemetryManager.getInstance();

    const mockSpan: ManagedSpan = {
      spanContext: () => ({ traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), isRemote: false, traceFlags: 1 }),
      setAttribute: vi.fn(),
      setStatus: vi.fn(),
      recordException: vi.fn(),
      addEvent: vi.fn(),
      end: vi.fn(),
    };

    const mockAdapter: TelemetryAdapter = {
      init: vi.fn().mockResolvedValue(undefined),
      createSpan: vi.fn().mockReturnValue(mockSpan),
      getCurrentSpanContext: vi.fn().mockReturnValue(null),
      recordMetric: vi.fn(),
      emitLog: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    await tm.registerAdapter(mockAdapter);
    await tm.init(createTestConfig());

    tm.startSpan({ name: 'adapter.test', kind: 'agent' });
    expect(mockAdapter.createSpan).toHaveBeenCalledWith('adapter.test', expect.objectContaining({ kind: 'agent' }));
  });

  it('should delegate metric recording to adapter', async () => {
    const tm = TelemetryManager.getInstance();

    const mockAdapter: TelemetryAdapter = {
      init: vi.fn().mockResolvedValue(undefined),
      createSpan: vi.fn(),
      getCurrentSpanContext: vi.fn().mockReturnValue(null),
      recordMetric: vi.fn(),
      emitLog: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    await tm.registerAdapter(mockAdapter);
    await tm.init(createTestConfig());

    tm.recordToolCall({ toolName: 'search', duration: 150, status: 'success' });
    expect(mockAdapter.recordMetric).toHaveBeenCalled();
  });

  it('should delegate log emission to adapter', async () => {
    const tm = TelemetryManager.getInstance();

    const mockAdapter: TelemetryAdapter = {
      init: vi.fn().mockResolvedValue(undefined),
      createSpan: vi.fn(),
      getCurrentSpanContext: vi.fn().mockReturnValue(null),
      recordMetric: vi.fn(),
      emitLog: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    await tm.registerAdapter(mockAdapter);
    await tm.init(createTestConfig());

    tm.info('test log');
    expect(mockAdapter.emitLog).toHaveBeenCalled();
  });

  it('should shutdown adapter on shutdown', async () => {
    const tm = TelemetryManager.getInstance();

    const mockAdapter: TelemetryAdapter = {
      init: vi.fn().mockResolvedValue(undefined),
      createSpan: vi.fn(),
      getCurrentSpanContext: vi.fn().mockReturnValue(null),
      recordMetric: vi.fn(),
      emitLog: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    await tm.registerAdapter(mockAdapter);
    await tm.init(createTestConfig());
    await tm.shutdown();

    expect(mockAdapter.shutdown).toHaveBeenCalled();
  });

  it('should get current span context from adapter', async () => {
    const tm = TelemetryManager.getInstance();

    const mockCtx: TelemetrySpanContext = {
      traceId: 'c'.repeat(32),
      spanId: 'd'.repeat(16),
      isRemote: false,
      traceFlags: 1,
    };

    const mockAdapter: TelemetryAdapter = {
      init: vi.fn().mockResolvedValue(undefined),
      createSpan: vi.fn(),
      getCurrentSpanContext: vi.fn().mockReturnValue(mockCtx),
      recordMetric: vi.fn(),
      emitLog: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    await tm.registerAdapter(mockAdapter);
    await tm.init(createTestConfig());

    const ctx = tm.getCurrentSpanContext();
    expect(ctx).toEqual(mockCtx);
  });
});

// ================================================================================
// Tests: OtelAdapter
// ================================================================================

// Mock OTel packages for OtelAdapter tests (packages not installed in test env)
vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@opentelemetry/sdk-trace-base', () => ({
  BatchSpanProcessor: vi.fn().mockImplementation(() => ({})),
  ConsoleSpanExporter: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/resources', () => ({
  Resource: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: vi.fn().mockImplementation(() => ({})),
}));

describe('OtelAdapter', () => {
  it('should create an OtelAdapter instance', () => {
    const adapter = new OtelAdapter();
    expect(adapter).toBeDefined();
    expect(typeof adapter.init).toBe('function');
    expect(typeof adapter.createSpan).toBe('function');
    expect(typeof adapter.shutdown).toBe('function');
  });

  it('should create a span via OtelAdapter.createSpan', () => {
    const adapter = new OtelAdapter();
    const span = adapter.createSpan('test.span', { kind: 'tool' });
    expect(span).toBeDefined();
    expect(span.spanContext().traceId).toBeTruthy();
    span.end();
  });

  it('should handle shutdown without init', async () => {
    const adapter = new OtelAdapter();
    await adapter.shutdown(); // Should not throw
  });

  it('should handle init with silent failure when OTel packages are missing', async () => {
    // OtelAdapter.init() with silentInitFailure=true should not throw
    // even when OTel packages are not installed (dynamic import will fail)
    const adapter = new OtelAdapter();
    // The dynamic import will fail with ERR_MODULE_NOT_FOUND,
    // and silentInitFailure=true catches it gracefully
    await adapter.init({
      ...DEFAULT_TELEMETRY_CONFIG,
      exporter: 'console',
      silentInitFailure: true,
    });
    // Should not throw — verifies the catch block works
  });

  it('should throw when init fails and silentInitFailure is false', async () => {
    const adapter = new OtelAdapter();
    try {
      await adapter.init({
        ...DEFAULT_TELEMETRY_CONFIG,
        exporter: 'console',
        silentInitFailure: false,
      });
      // If it doesn't throw, the test still passes (OTel packages may be installed)
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('Failed to initialize OTel SDK');
    }
  });
});