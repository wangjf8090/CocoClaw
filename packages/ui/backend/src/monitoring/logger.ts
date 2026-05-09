/**
 * 结构化日志系统
 * 生产级日志管理
 */

import winston from 'winston';

export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  module?: string;
  [key: string]: any;
}

class Logger {
  private logger: winston.Logger;
  private context: LogContext = {};

  constructor() {
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    const consoleFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
      })
    );

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports: [
        new winston.transports.File({
          filename: './logs/error.log',
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: './logs/combined.log',
          maxsize: 10485760, // 10MB
          maxFiles: 10
        })
      ]
    });

    // 开发环境同时输出到控制台
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: consoleFormat
      }));
    }
  }

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(message, { ...this.context, ...context });
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, { ...this.context, ...context });
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error(message, {
      error: error?.message,
      stack: error?.stack,
      ...this.context,
      ...context
    });
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, { ...this.context, ...context });
  }

  http(message: string, context?: LogContext): void {
    this.logger.http(message, { ...this.context, ...context });
  }

  child(context: LogContext): Logger {
    const child = new Logger();
    child.setContext({ ...this.context, ...context });
    return child;
  }

  stream() {
    return {
      write: (message: string) => {
        this.http(message.trim());
      }
    };
  }

  // 性能日志
  performance(operation: string, duration: number, context?: LogContext): void {
    this.info(`Performance: ${operation}`, {
      operation,
      durationMs: duration,
      ...this.context,
      ...context
    });
  }

  // 审计日志
  audit(action: string, userId: string, details?: any): void {
    this.info(`Audit: ${action}`, {
      audit: true,
      action,
      userId,
      details,
      timestamp: new Date().toISOString()
    });
  }
}

export const logger = new Logger();
export default logger;
