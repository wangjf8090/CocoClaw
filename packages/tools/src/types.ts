/**
 * Tool Abstraction Layer Types
 * 模型无关工具抽象层类型定义
 */

import { z } from 'zod';

// Tool parameter schema type
export type ToolParameterSchema = z.ZodObject<Record<string, z.ZodTypeAny>>;

/**
 * Tool definition structure
 * 工具定义结构
 */
export interface ToolDefinition<T extends ToolParameterSchema = ToolParameterSchema> {
  name: string;
  description: string;
  parameters: T;
  category?: string;
  icon?: string;
  tags?: string[];
}

/**
 * Tool execution result
 * 工具执行结果
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Tool call structure
 * 工具调用结构
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Tool handler function type
 * 工具处理函数类型
 */
export type ToolHandler<T = unknown> = (params: T) => Promise<ToolResult>;

/**
 * Registered tool
 * 已注册的工具
 */
export interface RegisteredTool<T extends ToolParameterSchema = ToolParameterSchema> {
  definition: ToolDefinition<T>;
  handler: ToolHandler<z.infer<T>>;
  enabled: boolean;
  createdAt: number;
  callCount: number;
}

/**
 * LLM Provider type enum
 * LLM 提供商类型
 */
export enum LLMProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  MISTRAL = 'mistral',
  CUSTOM = 'custom',
}

/**
 * OpenAI Function Calling format
 * OpenAI 函数调用格式
 */
export interface OpenAIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Anthropic Tool Use format
 * Anthropic 工具使用格式
 */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Google Gemini Tool format
 * Google Gemini 工具格式
 */
export interface GeminiTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Tool execution context
 * 工具执行上下文
 */
export interface ToolExecutionContext {
  sessionId: string;
  userId?: string;
  traceId: string;
  conversationId?: string;
  metadata: Record<string, unknown>;
}

/**
 * Tool event types
 * 工具事件类型
 */
export type ToolEventType =
  | 'tool_registered'
  | 'tool_unregistered'
  | 'tool_called'
  | 'tool_completed'
  | 'tool_failed'
  | 'tool_enabled'
  | 'tool_disabled';

/**
 * Tool event
 * 工具事件
 */
export interface ToolEvent {
  type: ToolEventType;
  timestamp: number;
  toolName: string;
  data: Record<string, unknown>;
}

/**
 * Tool event emitter interface
 * 工具事件发射器接口
 */
export interface ToolEventEmitter {
  on(event: 'tool_registered', handler: (event: ToolEvent) => void): void;
  on(event: 'tool_unregistered', handler: (event: ToolEvent) => void): void;
  on(event: 'tool_called', handler: (event: ToolEvent) => void): void;
  on(event: 'tool_completed', handler: (event: ToolEvent) => void): void;
  on(event: 'tool_failed', handler: (event: ToolEvent) => void): void;
  on(event: 'tool_enabled', handler: (event: ToolEvent) => void): void;
  on(event: 'tool_disabled', handler: (event: ToolEvent) => void): void;
  emit(event: 'tool_registered' | 'tool_unregistered' | 'tool_called' | 'tool_completed' | 'tool_failed' | 'tool_enabled' | 'tool_disabled', eventData: ToolEvent): void;
}

/**
 * Tool registry options
 * 工具注册选项
 */
export interface ToolRegistryOptions {
  validateInputs?: boolean;
  trackMetrics?: boolean;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Tool metrics
 * 工具指标
 */
export interface ToolMetrics {
  callCount: number;
  successCount: number;
  errorCount: number;
  avgExecutionTime: number;
  totalExecutionTime: number;
  lastCalledAt?: number;
}
