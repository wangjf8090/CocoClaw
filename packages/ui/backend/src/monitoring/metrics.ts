/**
 * Prometheus Metrics 暴露
 * 生产级监控指标
 */

import client from 'prom-client';

export class MetricsManager {
  private registry: client.Registry;
  private httpRequestDuration: client.Histogram<'route' | 'method' | 'status'>;
  private httpRequestTotal: client.Counter<'route' | 'method' | 'status'>;
  private activeConnections: client.Gauge<'type'>;
  private memoryUsage: client.Gauge<'type'>;
  private soulMetrics: client.Gauge<'metric'>;
  private memoryEngineMetrics: client.Gauge<'metric'>;

  constructor() {
    this.registry = new client.Registry();

    // 设置默认标签
    this.registry.setDefaultLabels({
      app: 'selfclaw',
      version: process.env.npm_package_version || '1.0.0'
    });

    // HTTP 请求持续时间直方图
    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['route', 'method', 'status'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    });

    // HTTP 请求总数计数器
    this.httpRequestTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['route', 'method', 'status']
    });

    // 活跃连接数仪表
    this.activeConnections = new client.Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      labelNames: ['type']
    });

    // 内存使用仪表
    this.memoryUsage = new client.Gauge({
      name: 'memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type']
    });

    // SOUL 指标
    this.soulMetrics = new client.Gauge({
      name: 'soul_metrics',
      help: 'SOUL module metrics',
      labelNames: ['metric']
    });

    // 记忆引擎指标
    this.memoryEngineMetrics = new client.Gauge({
      name: 'memory_engine_metrics',
      help: 'Memory engine metrics',
      labelNames: ['metric']
    });

    // 注册指标
    this.registry.registerMetric(this.httpRequestDuration);
    this.registry.registerMetric(this.httpRequestTotal);
    this.registry.registerMetric(this.activeConnections);
    this.registry.registerMetric(this.memoryUsage);
    this.registry.registerMetric(this.soulMetrics);
    this.registry.registerMetric(this.memoryEngineMetrics);

    // 收集默认指标
    client.collectDefaultMetrics({ register: this.registry });
  }

  recordRequest(route: string, method: string, statusCode: number, duration: number): void {
    this.httpRequestDuration
      .labels({ route, method, status: statusCode.toString() })
      .observe(duration);

    this.httpRequestTotal
      .labels({ route, method, status: statusCode.toString() })
      .inc();
  }

  setActiveConnections(type: string, count: number): void {
    this.activeConnections.labels({ type }).set(count);
  }

  updateMemoryUsage(): void {
    const usage = process.memoryUsage();
    this.memoryUsage.labels({ type: 'rss' }).set(usage.rss);
    this.memoryUsage.labels({ type: 'heapTotal' }).set(usage.heapTotal);
    this.memoryUsage.labels({ type: 'heapUsed' }).set(usage.heapUsed);
    this.memoryUsage.labels({ type: 'external' }).set(usage.external);
  }

  setSoulMetric(metric: string, value: number): void {
    this.soulMetrics.labels({ metric }).set(value);
  }

  setMemoryEngineMetric(metric: string, value: number): void {
    this.memoryEngineMetrics.labels({ metric }).set(value);
  }

  incrementMetric(metric: string, value: number = 1): void {
    this.soulMetrics.labels({ metric }).inc(value);
  }

  async getMetrics(): Promise<string> {
    this.updateMemoryUsage();
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  createMiddleware() {
    return (req: any, res: any, next: any) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path || 'unknown';
        this.recordRequest(route, req.method, res.statusCode, duration);
      });

      next();
    };
  }
}

export const metricsManager = new MetricsManager();
