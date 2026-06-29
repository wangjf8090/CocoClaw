/**
 * Health Check Monitor
 * 健康检查监控
 */

import {
  ModelAdapter,
  HealthCheckResult,
  HealthStatus,
} from './types.js';

export interface HealthMonitorConfig {
  checkIntervalMs: number;
  failureThreshold: number;
  recoveryIntervalMs: number;
  timeoutMs: number;
}

const DEFAULT_MONITOR_CONFIG: HealthMonitorConfig = {
  checkIntervalMs: 60000,
  failureThreshold: 3,
  recoveryIntervalMs: 120000,
  timeoutMs: 5000,
};

export class HealthMonitor {
  private adapters: Map<string, ModelAdapter> = new Map();
  private results: Map<string, HealthCheckResult> = new Map();
  private config: HealthMonitorConfig;
  private intervalId?: NodeJS.Timeout;
  private onHealthChange?: (name: string, status: HealthStatus, result: HealthCheckResult) => void;

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = { ...DEFAULT_MONITOR_CONFIG, ...config };
  }

  registerAdapter(adapter: ModelAdapter): void {
    this.adapters.set(adapter.name, adapter);
    this.results.set(adapter.name, {
      model: adapter.name,
      status: HealthStatus.UNKNOWN,
      lastChecked: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
    });
  }

  async checkHealth(name: string): Promise<HealthCheckResult> {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      return this.createUnknownResult(name);
    }

    const start = Date.now();
    
    try {
      const status = await Promise.race([
        adapter.healthCheck(),
        this.timeout(this.config.timeoutMs),
      ]) as HealthStatus;

      const latencyMs = Date.now() - start;
      return this.updateResult(name, status, latencyMs);
    } catch {
      return this.updateResult(name, HealthStatus.UNHEALTHY, Date.now() - start);
    }
  }

  async checkAllHealth(): Promise<Map<string, HealthCheckResult>> {
    const checks = Array.from(this.adapters.keys()).map(name => this.checkHealth(name));
    await Promise.all(checks);
    return this.results;
  }

  startMonitoring(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(async () => {
      await this.checkAllHealth();
    }, this.config.checkIntervalMs);
  }

  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  getHealth(name: string): HealthCheckResult | undefined {
    return this.results.get(name);
  }

  getAllHealth(): Map<string, HealthCheckResult> {
    return new Map(this.results);
  }

  isHealthy(name: string): boolean {
    const result = this.results.get(name);
    return result?.status === HealthStatus.HEALTHY;
  }

  isAvailable(name: string): boolean {
    const result = this.results.get(name);
    return result?.status === HealthStatus.HEALTHY || result?.status === HealthStatus.DEGRADED;
  }

  private updateResult(name: string, status: HealthStatus, latencyMs: number): HealthCheckResult {
    const existing = this.results.get(name);
    
    const consecutiveFailures = status === HealthStatus.UNHEALTHY
      ? (existing?.consecutiveFailures ?? 0) + 1
      : 0;
    
    const consecutiveSuccesses = status === HealthStatus.HEALTHY
      ? (existing?.consecutiveSuccesses ?? 0) + 1
      : 0;

    let finalStatus = status;
    
    if (consecutiveFailures >= this.config.failureThreshold) {
      finalStatus = HealthStatus.UNHEALTHY;
    } else if (consecutiveSuccesses >= 2 && status === HealthStatus.DEGRADED) {
      finalStatus = HealthStatus.HEALTHY;
    }

    const result: HealthCheckResult = {
      model: name,
      status: finalStatus,
      latencyMs,
      lastChecked: Date.now(),
      consecutiveFailures,
      consecutiveSuccesses,
    };

    this.results.set(name, result);

    if (existing?.status !== finalStatus) {
      this.onHealthChange?.(name, finalStatus, result);
    }

    return result;
  }

  private createUnknownResult(name: string): HealthCheckResult {
    return {
      model: name,
      status: HealthStatus.UNKNOWN,
      lastChecked: Date.now(),
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
    };
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), ms);
    });
  }
}
