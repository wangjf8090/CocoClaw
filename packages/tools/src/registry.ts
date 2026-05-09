/**
 * Tool Registry
 * 工具注册表
 * 管理工具的注册、调用、生命周期
 */

import EventEmitter from 'eventemitter3';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  ToolDefinition,
  ToolHandler,
  RegisteredTool,
  ToolEvent,
  ToolEventEmitter,
  ToolExecutionContext,
  ToolRegistryOptions,
  ToolMetrics,
  ToolResult,
  ToolCall,
  ToolParameterSchema,
} from './types.js';

export class ToolRegistry extends (EventEmitter as new () => ToolEventEmitter) {
  private tools: Map<string, RegisteredTool> = new Map();
  private options: Required<ToolRegistryOptions>;
  private metrics: Map<string, ToolMetrics> = new Map();

  constructor(options: ToolRegistryOptions = {}) {
    super();
    this.options = {
      validateInputs: true,
      trackMetrics: true,
      timeout: 30000,
      maxRetries: 2,
      ...options,
    };
  }

  /**
   * Register a new tool
   * 注册新工具
   */
  register<T extends ToolParameterSchema>(
    definition: ToolDefinition<T>,
    handler: ToolHandler<z.infer<T>>,
    enabled = true
  ): void {
    if (this.tools.has(definition.name)) {
      throw new Error(`Tool "${definition.name}" is already registered`);
    }

    const registered: RegisteredTool = {
      definition,
      handler: handler as ToolHandler,
      enabled,
      createdAt: Date.now(),
      callCount: 0,
    };

    this.tools.set(definition.name, registered);
    this.metrics.set(definition.name, {
      callCount: 0,
      successCount: 0,
      errorCount: 0,
      avgExecutionTime: 0,
      totalExecutionTime: 0,
    });

    this.emit('tool_registered', {
      type: 'tool_registered',
      timestamp: Date.now(),
      toolName: definition.name,
      data: { definition },
    });
  }

  /**
   * Unregister a tool
   * 注销工具
   */
  unregister(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      this.metrics.delete(name);
      this.emit('tool_unregistered', {
        type: 'tool_unregistered',
        timestamp: Date.now(),
        toolName: name,
        data: {},
      });
    }
    return removed;
  }

  /**
   * Get a registered tool
   * 获取已注册的工具
   */
  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tool definitions
   * 获取所有工具定义
   */
  getDefinitions(onlyEnabled = true): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter((t) => !onlyEnabled || t.enabled)
      .map((t) => t.definition);
  }

  /**
   * Execute a tool call
   * 执行工具调用
   */
  async execute(
    toolCall: ToolCall,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const registered = this.tools.get(toolCall.name);

    if (!registered) {
      return {
        success: false,
        error: `Tool "${toolCall.name}" not found`,
      };
    }

    if (!registered.enabled) {
      return {
        success: false,
        error: `Tool "${toolCall.name}" is disabled`,
      };
    }

    // Validate input if enabled
    if (this.options.validateInputs) {
      try {
        registered.definition.parameters.parse(toolCall.arguments);
      } catch (error) {
        return {
          success: false,
          error: `Invalid parameters: ${(error as Error).message}`,
        };
      }
    }

    const startTime = Date.now();
    let attempt = 0;
    let lastError: Error | null = null;

    this.emit('tool_called', {
      type: 'tool_called',
      timestamp: startTime,
      toolName: toolCall.name,
      data: { toolCall, context },
    });

    // Execute with retry
    while (attempt <= this.options.maxRetries) {
      attempt++;

      try {
        const resultPromise = registered.handler(toolCall.arguments);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Tool execution timeout')), this.options.timeout);
        });

        const result = await Promise.race([resultPromise, timeoutPromise]);

        // Update metrics
        const executionTime = Date.now() - startTime;
        this.updateMetrics(toolCall.name, true, executionTime);

        registered.callCount++;

        this.emit('tool_completed', {
          type: 'tool_completed',
          timestamp: Date.now(),
          toolName: toolCall.name,
          data: { toolCall, result, executionTime, attempt },
        });

        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt <= this.options.maxRetries) {
          console.warn(`Tool "${toolCall.name}" failed (attempt ${attempt}), retrying...`);
          continue;
        }

        // Update metrics for final failure
        const executionTime = Date.now() - startTime;
        this.updateMetrics(toolCall.name, false, executionTime);

        this.emit('tool_failed', {
          type: 'tool_failed',
          timestamp: Date.now(),
          toolName: toolCall.name,
          data: { toolCall, error: lastError.message, executionTime },
        });

        return {
          success: false,
          error: lastError.message,
        };
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
    };
  }

  /**
   * Update tool metrics
   * 更新工具指标
   */
  private updateMetrics(name: string, success: boolean, executionTime: number): void {
    if (!this.options.trackMetrics) return;

    const metrics = this.metrics.get(name);
    if (!metrics) return;

    metrics.callCount++;
    if (success) {
      metrics.successCount++;
    } else {
      metrics.errorCount++;
    }
    metrics.totalExecutionTime += executionTime;
    metrics.avgExecutionTime = metrics.totalExecutionTime / metrics.callCount;
    metrics.lastCalledAt = Date.now();
  }

  /**
   * Get tool metrics
   * 获取工具指标
   */
  getMetrics(name: string): ToolMetrics | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get all metrics
   * 获取所有指标
   */
  getAllMetrics(): Map<string, ToolMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Enable a tool
   * 启用工具
   */
  enable(name: string): boolean {
    const tool = this.tools.get(name);
    if (tool && !tool.enabled) {
      tool.enabled = true;
      this.emit('tool_enabled', {
        type: 'tool_enabled',
        timestamp: Date.now(),
        toolName: name,
        data: {},
      });
      return true;
    }
    return false;
  }

  /**
   * Disable a tool
   * 禁用工具
   */
  disable(name: string): boolean {
    const tool = this.tools.get(name);
    if (tool && tool.enabled) {
      tool.enabled = false;
      this.emit('tool_disabled', {
        type: 'tool_disabled',
        timestamp: Date.now(),
        toolName: name,
        data: {},
      });
      return true;
    }
    return false;
  }

  /**
   * Check if tool is registered
   * 检查工具是否已注册
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get registered tool count
   * 获取已注册工具数量
   */
  size(): number {
    return this.tools.size;
  }

  /**
   * Clear all tools
   * 清除所有工具
   */
  clear(): void {
    const names = Array.from(this.tools.keys());
    this.tools.clear();
    this.metrics.clear();

    for (const name of names) {
      this.emit('tool_unregistered', {
        type: 'tool_unregistered',
        timestamp: Date.now(),
        toolName: name,
        data: {},
      });
    }
  }
}

/**
 * Define a tool with type inference
 * 定义工具（带类型推断）
 */
export function defineTool<T extends ToolParameterSchema>(config: {
  name: string;
  description: string;
  parameters: T;
  category?: string;
  handler: ToolHandler<z.infer<T>>;
}): { definition: ToolDefinition<T>; handler: ToolHandler<z.infer<T>> } {
  return {
    definition: {
      name: config.name,
      description: config.description,
      parameters: config.parameters,
      category: config.category,
    },
    handler: config.handler,
  };
}
