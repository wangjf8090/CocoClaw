/**
 * 全局错误处理与熔断器模式
 * 生产级容错机制
 */

import { logger } from './logger';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private config: CircuitBreakerConfig;
  private name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
      resetTimeout: 60000,
      ...config
    };
  }

  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = 'half-open';
        logger.debug(`Circuit breaker '${this.name}' entering half-open state`);
      } else {
        if (fallback) {
          logger.warn(`Circuit breaker '${this.name}' is open, using fallback`);
          return fallback();
        }
        throw new Error(`Circuit breaker '${this.name}' is open`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      if (fallback) {
        logger.warn(`Circuit breaker '${this.name}' operation failed, using fallback`);
        return fallback();
      }
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
        logger.info(`Circuit breaker '${this.name}' reset to closed state`);
      }
    } else {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  private onFailure(error: any): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    logger.error(`Circuit breaker '${this.name}' operation failed`, error instanceof Error ? error : new Error(String(error)), {
      failureCount: this.failureCount,
      state: this.state
    });

    if (this.state === 'half-open' || this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      this.successCount = 0;
      logger.warn(`Circuit breaker '${this.name}' tripped to open state after ${this.failureCount} failures`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    logger.info(`Circuit breaker '${this.name}' manually reset`);
  }

  getMetrics() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// 全局错误处理器
export class GlobalErrorHandler {
  private static circuitBreakers: Map<string, CircuitBreaker> = new Map();

  static registerCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    const breaker = new CircuitBreaker(name, config);
    this.circuitBreakers.set(name, breaker);
    return breaker;
  }

  static getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  static handleUncaughtException(error: Error): void {
    logger.error('Uncaught Exception', error);
    // 在生产环境中，应该优雅关闭后重启
    if (process.env.NODE_ENV === 'production') {
      setTimeout(() => process.exit(1), 1000);
    }
  }

  static handleUnhandledRejection(reason: any, promise: Promise<any>): void {
    logger.error('Unhandled Rejection', reason instanceof Error ? reason : new Error(String(reason)), {
      promise: promise.toString()
    });
  }

  static getCircuitBreakerStatus() {
    const status: any = {};
    for (const [name, breaker] of this.circuitBreakers) {
      status[name] = breaker.getMetrics();
    }
    return status;
  }
}

// 注册全局错误监听
process.on('uncaughtException', GlobalErrorHandler.handleUncaughtException);
process.on('unhandledRejection', GlobalErrorHandler.handleUnhandledRejection);

export default GlobalErrorHandler;
