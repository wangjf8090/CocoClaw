/**
 * Tool Adapter
 * 支持 prod / mock / replay 三种模式
 * 
 * 职责：
 * 1. ProdToolAdapter - 调用真实工具
 * 2. MockToolAdapter - 使用预设返回值
 * 3. ReplayToolAdapter - 从历史 trace 回放
 */

import {
  ToolAdapter,
  ToolAdapterMode,
  ToolContext,
  ToolInvocation,
} from '../types';

/**
 * Tool Adapter 工厂
 */
export class ToolAdapterFactory {
  /**
   * 创建 Tool Adapter
   */
  static create(
    mode: ToolAdapterMode,
    options: ToolAdapterOptions = {}
  ): ToolAdapter {
    switch (mode) {
      case 'prod':
        return new ProdToolAdapter(options.realTools);
      case 'mock':
        return new MockToolAdapter(options.mockResponses);
      case 'replay':
        return new ReplayToolAdapter(options.replayTraces);
      default:
        throw new Error(`Unknown tool adapter mode: ${mode}`);
    }
  }
}

/**
 * Tool Adapter 选项
 */
export interface ToolAdapterOptions {
  realTools?: Record<string, (input: unknown) => Promise<unknown>>;
  mockResponses?: Record<string, unknown>;
  replayTraces?: Record<string, ToolInvocation[]>;
}

/**
 * ProdToolAdapter - 生产环境工具适配器
 * 调用真实工具服务
 */
export class ProdToolAdapter implements ToolAdapter {
  name = 'ProdToolAdapter';
  mode: ToolAdapterMode = 'prod';
  
  private tools: Map<string, (input: unknown) => Promise<unknown>>;

  constructor(
    tools?: Record<string, (input: unknown) => Promise<unknown>>
  ) {
    this.tools = new Map(Object.entries(tools || {}));
  }

  /**
   * 注册工具
   */
  register(name: string, handler: (input: unknown) => Promise<unknown>): void {
    this.tools.set(name, handler);
  }

  /**
   * 调用工具
   */
  async invoke(input: unknown, ctx: ToolContext): Promise<unknown> {
    const toolName = ctx.mockOverrides?.tool_name as string || input && (input as any).tool_name;
    
    if (!toolName) {
      throw new Error('Tool name is required');
    }

    const handler = this.tools.get(toolName);
    if (!handler) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return await handler(input);
  }

  /**
   * 获取已注册的工具列表
   */
  getRegisteredTools(): string[] {
    return Array.from(this.tools.keys());
  }
}

/**
 * MockToolAdapter - Mock 工具适配器
 * 使用预设返回值，不调用真实服务
 */
export class MockToolAdapter implements ToolAdapter {
  name = 'MockToolAdapter';
  mode: ToolAdapterMode = 'mock';
  
  private mockResponses: Map<string, unknown>;
  private mockErrors: Map<string, Error>;
  private callLog: Array<{ tool: string; input: unknown; output: unknown; ts: string }> = [];

  constructor(mockResponses?: Record<string, unknown>) {
    this.mockResponses = new Map(Object.entries(mockResponses || {}));
    this.mockErrors = new Map();
  }

  /**
   * 设置 Mock 返回值
   */
  setResponse(toolName: string, response: unknown): void {
    this.mockResponses.set(toolName, response);
  }

  /**
   * 设置 Mock 错误
   */
  setError(toolName: string, error: Error): void {
    this.mockErrors.set(toolName, error);
  }

  /**
   * 调用工具
   */
  async invoke(input: unknown, ctx: ToolContext): Promise<unknown> {
    const toolName = ctx.mockOverrides?.tool_name as string || input && (input as any).tool_name;
    
    if (!toolName) {
      throw new Error('Tool name is required');
    }

    const log = {
      tool: toolName,
      input,
      output: null,
      ts: new Date().toISOString(),
    };

    // 检查是否有预设错误
    const error = this.mockErrors.get(toolName);
    if (error) {
      log.output = { error: error.message };
      this.callLog.push(log);
      throw error;
    }

    // 检查是否有预设返回值
    const response = this.mockResponses.get(toolName);
    if (response !== undefined) {
      log.output = response;
      this.callLog.push(log);
      return response;
    }

    // 返回默认 mock 值
    const defaultResponse = this.getDefaultMockResponse(toolName);
    log.output = defaultResponse;
    this.callLog.push(log);
    return defaultResponse;
  }

  /**
   * 获取默认 mock 响应
   */
  private getDefaultMockResponse(toolName: string): unknown {
    // 根据工具名称返回合理的默认 mock 数据
    if (toolName.includes('search') || toolName.includes('query')) {
      return { results: [], total: 0 };
    }
    if (toolName.includes('get') || toolName.includes('fetch')) {
      return { data: null };
    }
    if (toolName.includes('create') || toolName.includes('post')) {
      return { id: 'mock_id', success: true };
    }
    if (toolName.includes('update') || toolName.includes('put')) {
      return { success: true, updated: true };
    }
    if (toolName.includes('delete')) {
      return { success: true, deleted: true };
    }
    return { success: true, mocked: true };
  }

  /**
   * 获取调用日志
   */
  getCallLog(): Array<{ tool: string; input: unknown; output: unknown; ts: string }> {
    return [...this.callLog];
  }

  /**
   * 清空调用日志
   */
  clearLog(): void {
    this.callLog = [];
  }

  /**
   * 清空所有 Mock 配置
   */
  clearAll(): void {
    this.mockResponses.clear();
    this.mockErrors.clear();
    this.callLog = [];
  }
}

/**
 * ReplayToolAdapter - 回放工具适配器
 * 从历史 trace 回放工具调用结果
 */
export class ReplayToolAdapter implements ToolAdapter {
  name = 'ReplayToolAdapter';
  mode: ToolAdapterMode = 'replay';
  
  private traces: Map<string, ToolInvocation[]>;
  private currentIndex: Map<string, number>;
  private callLog: Array<{ tool: string; input: unknown; output: unknown; ts: string }> = [];

  constructor(traces?: Record<string, ToolInvocation[]>) {
    this.traces = new Map(Object.entries(traces || {}));
    this.currentIndex = new Map();
  }

  /**
   * 加载回放数据
   */
  loadTraces(runId: string, invocations: ToolInvocation[]): void {
    this.traces.set(runId, invocations);
    this.currentIndex.set(runId, 0);
  }

  /**
   * 调用工具
   */
  async invoke(input: unknown, ctx: ToolContext): Promise<unknown> {
    const toolName = ctx.mockOverrides?.tool_name as string || input && (input as any).tool_name;
    const runId = ctx.runId;

    if (!toolName || !runId) {
      throw new Error('Tool name and runId are required for replay');
    }

    const log = {
      tool: toolName,
      input,
      output: null,
      ts: new Date().toISOString(),
    };

    const invocations = this.traces.get(runId);
    if (!invocations) {
      log.output = { error: 'No replay data found', runId };
      this.callLog.push(log);
      return { error: 'No replay data found', runId };
    }

    const index = this.currentIndex.get(runId) || 0;
    
    // 找到匹配的调用
    let foundInvocation: ToolInvocation | null = null;
    for (let i = index; i < invocations.length; i++) {
      if (invocations[i].tool_name === toolName) {
        foundInvocation = invocations[i];
        this.currentIndex.set(runId, i + 1);
        break;
      }
    }

    if (foundInvocation) {
      if (foundInvocation.status === 'failed') {
        log.output = { error: foundInvocation.error };
        this.callLog.push(log);
        throw new Error(foundInvocation.error || 'Tool call failed in replay');
      }
      log.output = foundInvocation.output;
      this.callLog.push(log);
      return foundInvocation.output;
    }

    // 没有匹配的调用，返回警告
    log.output = { warning: 'No matching invocation in replay', toolName, runId };
    this.callLog.push(log);
    return { warning: 'No matching invocation in replay', toolName, runId };
  }

  /**
   * 重置回放索引
   */
  resetReplay(runId: string): void {
    this.currentIndex.set(runId, 0);
  }

  /**
   * 重置所有回放索引
   */
  resetAll(): void {
    for (const runId of this.currentIndex.keys()) {
      this.currentIndex.set(runId, 0);
    }
  }

  /**
   * 获取调用日志
   */
  getCallLog(): Array<{ tool: string; input: unknown; output: unknown; ts: string }> {
    return [...this.callLog];
  }

  /**
   * 清空调用日志
   */
  clearLog(): void {
    this.callLog = [];
  }
}

/**
 * FaultInjector - 故障注入器
 * 用于测试容错能力
 */
export class FaultInjector {
  private faults: Map<string, FaultConfig> = new Map();

  /**
   * 添加故障配置
   */
  addFault(target: string, config: FaultConfig): void {
    this.faults.set(target, config);
  }

  /**
   * 移除故障配置
   */
  removeFault(target: string): void {
    this.faults.delete(target);
  }

  /**
   * 清空所有故障配置
   */
  clearAll(): void {
    this.faults.clear();
  }

  /**
   * 检查是否应该注入故障
   */
  shouldInject(target: string): boolean {
    const config = this.faults.get(target);
    if (!config) return false;
    
    // 根据 rate 决定是否注入
    if (config.rate !== undefined) {
      return Math.random() < config.rate;
    }
    
    return true;
  }

  /**
   * 获取故障配置
   */
  getFault(target: string): FaultConfig | null {
    return this.faults.get(target) || null;
  }

  /**
   * 获取所有故障配置
   */
  getAllFaults(): Map<string, FaultConfig> {
    return new Map(this.faults);
  }
}

/**
 * 故障配置
 */
export interface FaultConfig {
  mode: 'timeout' | '429' | 'permission_denied' | 'invalid_payload' | 'empty_response' | 'dirty_data';
  rate?: number;
  delayMs?: number;
  message?: string;
}

/**
 * 创建带故障注入的工具适配器包装
 */
export function withFaultInjection(
  adapter: ToolAdapter,
  injector: FaultInjector
): ToolAdapter {
  return {
    name: `${adapter.name} + FaultInjection`,
    mode: adapter.mode,
    async invoke(input: unknown, ctx: ToolContext): Promise<unknown> {
      const toolName = ctx.mockOverrides?.tool_name as string || input && (input as any).tool_name;
      
      if (toolName && injector.shouldInject(toolName)) {
        const fault = injector.getFault(toolName);
        if (fault) {
          return await injectFault(fault, adapter, input, ctx);
        }
      }

      return adapter.invoke(input, ctx);
    },
  };
}

/**
 * 执行故障注入
 */
async function injectFault(
  fault: FaultConfig,
  adapter: ToolAdapter,
  input: unknown,
  ctx: ToolContext
): Promise<unknown> {
  // 延迟注入（如果配置了）
  if (fault.delayMs) {
    await new Promise(resolve => setTimeout(resolve, fault.delayMs));
  }

  switch (fault.mode) {
    case 'timeout':
      throw new Error('Request timeout');

    case '429':
      throw Object.assign(new Error('Rate limit exceeded'), { status: 429 });

    case 'permission_denied':
      throw Object.assign(new Error('Permission denied'), { status: 403 });

    case 'invalid_payload':
      throw new Error(fault.message || 'Invalid payload');

    case 'empty_response':
      return null;

    case 'dirty_data':
      return { data: 'dirty', corrupted: true };

    default:
      return adapter.invoke(input, ctx);
  }
}
