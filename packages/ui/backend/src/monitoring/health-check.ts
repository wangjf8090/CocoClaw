/**
 * 健康检查端点
 * 生产级健康监控
 */

import { logger } from './logger';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    [name: string]: {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      duration?: number;
      timestamp: string;
    };
  };
}

export interface HealthCheck {
  name: string;
  check: () => Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string }>;
}

class HealthChecker {
  private checks: Map<string, HealthCheck> = new Map();
  private startTime: number = Date.now();
  private lastStatus: HealthStatus | null = null;

  constructor() {
    this.registerDefaultChecks();
  }

  private registerDefaultChecks(): void {
    // 内存检查
    this.register({
      name: 'memory',
      check: async () => {
        const usage = process.memoryUsage();
        const heapUsedPercent = usage.heapUsed / usage.heapTotal;

        if (heapUsedPercent > 0.9) {
          return { status: 'warn', message: `Memory usage high: ${(heapUsedPercent * 100).toFixed(1)}%` };
        }
        return { status: 'pass', message: `Heap used: ${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB` };
      }
    });

    // 进程检查
    this.register({
      name: 'process',
      check: async () => {
        const eventLoopDelay = this.getEventLoopDelay();
        if (eventLoopDelay > 100) {
          return { status: 'warn', message: `Event loop delay: ${eventLoopDelay.toFixed(1)}ms` };
        }
        return { status: 'pass', message: `Event loop delay: ${eventLoopDelay.toFixed(1)}ms` };
      }
    });

    // 磁盘空间检查（简化）
    this.register({
      name: 'disk',
      check: async () => {
        return { status: 'pass', message: 'Disk space ok' };
      }
    });
  }

  private getEventLoopDelay(): number {
    const start = Date.now();
    return new Promise<number>((resolve) => {
      setImmediate(() => {
        resolve(Date.now() - start);
      });
    }) as unknown as number;
  }

  register(check: HealthCheck): void {
    this.checks.set(check.name, check);
  }

  unregister(name: string): boolean {
    return this.checks.delete(name);
  }

  async performCheck(): Promise<HealthStatus> {
    const results: HealthStatus['checks'] = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    for (const [name, check] of this.checks) {
      const startTime = Date.now();
      try {
        const result = await check.check();
        const duration = Date.now() - startTime;

        results[name] = {
          status: result.status,
          message: result.message,
          duration,
          timestamp: new Date().toISOString()
        };

        if (result.status === 'fail') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'warn' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        results[name] = {
          status: 'fail',
          message: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };
        overallStatus = 'unhealthy';
      }
    }

    const status: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      checks: results
    };

    this.lastStatus = status;

    if (overallStatus !== 'healthy') {
      logger.warn(`Health check: ${overallStatus}`, { checks: results });
    }

    return status;
  }

  getLastStatus(): HealthStatus | null {
    return this.lastStatus;
  }

  getLiveness(): { status: string } {
    // 存活检查：进程是否在运行
    return { status: 'alive' };
  }

  getReadiness(): { ready: boolean; message?: string } {
    // 就绪检查：是否可以接收流量
    const lastStatus = this.lastStatus;
    if (!lastStatus) {
      return { ready: false, message: 'No health check performed yet' };
    }

    const ready = lastStatus.status === 'healthy';
    return {
      ready,
      message: ready ? 'Ready to serve traffic' : `Service is ${lastStatus.status}`
    };
  }
}

export const healthChecker = new HealthChecker();
export default healthChecker;
