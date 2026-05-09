/**
 * Layer 6: Sandbox Isolation
 * 第6层：沙箱隔离
 * 
 * - Node.js vm模块隔离
 * - 子进程资源限制
 * - 文件系统访问隔离
 * - 网络访问控制
 */

import vm from 'vm';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  Operation,
  SecurityDecision,
  SandboxOptions,
  SandboxExecutionResult,
  DEFAULT_SANDBOX_OPTIONS,
  SecurityLevel,
} from './types.js';

export class SandboxLayer {
  private options: SandboxOptions;
  private workingDir: string;

  constructor(options?: Partial<SandboxOptions>) {
    this.options = { ...DEFAULT_SANDBOX_OPTIONS, ...options };
    this.workingDir = this.options.workingDirectory;
  }

  /**
   * 检查操作
   */
  check(operation: Operation): SecurityDecision {
    // 沙箱层只决定是否需要沙箱执行
    // 不直接阻止，而是标记需要沙箱
    let needsSandbox = false;
    const reasons: string[] = [];

    switch (operation.type) {
      case 'code_execute':
        needsSandbox = true;
        reasons.push('代码执行需要沙箱隔离');
        break;
      case 'shell_command':
      case 'process_management':
        needsSandbox = true;
        reasons.push('进程操作需要沙箱隔离');
        break;
      case 'network_request':
        if (!this.options.allowNetwork) {
          needsSandbox = true;
          reasons.push('网络访问需要沙箱控制');
        }
        break;
      case 'file_read':
      case 'file_write':
      case 'file_delete':
        if (!this.options.allowFs) {
          needsSandbox = true;
          reasons.push('文件操作需要沙箱控制');
        }
        break;
      default:
        break;
    }

    return {
      allowed: true,
      level: needsSandbox ? 'medium' : 'safe',
      score: needsSandbox ? 50 : 0,
      reasons: needsSandbox ? reasons : ['无需沙箱隔离'],
      layer: 'sandbox',
      requiresConfirmation: false,
    };
  }

  /**
   * 在沙箱中执行代码
   */
  async executeInSandbox(code: string): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    let timedOut = false;

    try {
      // 确保工作目录存在
      await this.ensureWorkingDir();

      // 创建沙箱上下文
      const context = this.createSandboxContext();

      // 执行代码
      const result = await this.runWithTimeout(
        () => this.runVmCode(code, context),
        this.options.timeout
      );

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        output: result ? String(result) : undefined,
        executionTime,
        memoryUsage: this.getMemoryUsage(),
        timedOut: false,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      if (error instanceof Error && error.message === 'Execution timed out') {
        timedOut = true;
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        memoryUsage: this.getMemoryUsage(),
        timedOut,
      };
    }
  }

  /**
   * 创建沙箱上下文
   */
  private createSandboxContext(): vm.Context {
    const context: vm.Context = {
      // 基础全局对象
      console: this.createSandboxedConsole(),
      setTimeout: this.createSandboxedTimeout(),
      setInterval: this.createSandboxedInterval(),
      clearTimeout: clearTimeout,
      clearInterval: clearInterval,
      
      // 限制的全局对象
      Buffer: this.options.allowFs ? Buffer : undefined,
      
      // 安全的工具函数
      JSON: JSON,
      Math: Math,
      Date: Date,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Array: Array,
      Object: Object,
      RegExp: RegExp,
      Error: Error,
      
      // 工作目录信息
      __dirname: this.workingDir,
      __filename: path.join(this.workingDir, 'sandbox.js'),
    };

    // 冻结上下文防止修改
    return vm.createContext(Object.freeze(context));
  }

  /**
   * 创建沙箱化的console
   */
  private createSandboxedConsole(): Console {
    const logs: string[] = [];
    return {
      log: (...args: any[]) => logs.push(args.map(a => String(a)).join(' ')),
      error: (...args: any[]) => logs.push(`ERROR: ${args.map(a => String(a)).join(' ')}`),
      warn: (...args: any[]) => logs.push(`WARN: ${args.map(a => String(a)).join(' ')}`),
      info: (...args: any[]) => logs.push(`INFO: ${args.map(a => String(a)).join(' ')}`),
      debug: (...args: any[]) => logs.push(`DEBUG: ${args.map(a => String(a)).join(' ')}`),
    } as unknown as Console;
  }

  /**
   * 创建沙箱化的setTimeout
   */
  private createSandboxedTimeout(): typeof setTimeout {
    return (callback: (...args: any[]) => void, ms: number, ...args: any[]) => {
      // 限制最大延迟
      const safeMs = Math.min(ms, this.options.timeout);
      return setTimeout(callback, safeMs, ...args);
    };
  }

  /**
   * 创建沙箱化的setInterval
   */
  private createSandboxedInterval(): typeof setInterval {
    return (callback: (...args: any[]) => void, ms: number, ...args: any[]) => {
      // 限制最大延迟
      const safeMs = Math.min(ms, this.options.timeout / 10);
      return setInterval(callback, safeMs, ...args);
    };
  }

  /**
   * 执行VM代码
   */
  private runVmCode(code: string, context: vm.Context): any {
    // 包装代码以提供更好的错误信息
    const wrappedCode = `
      'use strict';
      try {
        ${code}
      } catch (__e) {
        { error: __e.message, stack: __e.stack }
      }
    `;

    return vm.runInContext(wrappedCode, context, {
      timeout: Math.floor(this.options.timeout),
      displayErrors: true,
    });
  }

  /**
   * 带超时执行
   */
  private async runWithTimeout<T>(fn: () => T, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Execution timed out'));
      }, timeoutMs);

      try {
        const result = fn();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * 确保工作目录存在
   */
  private async ensureWorkingDir(): Promise<void> {
    try {
      await fs.access(this.workingDir);
    } catch {
      await fs.mkdir(this.workingDir, { recursive: true });
    }
  }

  /**
   * 获取内存使用
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    }
    return 0;
  }

  /**
   * 检查模块是否允许
   */
  isModuleAllowed(moduleName: string): boolean {
    if (this.options.blockedModules.includes(moduleName)) {
      return false;
    }
    if (this.options.allowedModules.length === 0) {
      return true;
    }
    return this.options.allowedModules.includes(moduleName);
  }

  /**
   * 更新沙箱选项
   */
  updateOptions(options: Partial<SandboxOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 获取当前选项
   */
  getOptions(): SandboxOptions {
    return { ...this.options };
  }

  /**
   * 清理工作目录
   */
  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.workingDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  }
}
