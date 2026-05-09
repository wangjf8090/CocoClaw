/**
 * QueryEngine Types
 * Defines the streaming generation and LLM interaction types
 */

export type QueryEventType =
  | 'query_start'
  | 'token'
  | 'tool_use'
  | 'tool_result'
  | 'reasoning'
  | 'query_complete'
  | 'error';

export interface QueryEvent {
  type: QueryEventType;
  id: string;
  timestamp: number;
  queryId: string;
  data: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface QueryOptions {
  maxIterations?: number;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  stream?: boolean;
}

export interface QueryState {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  messages: LLMMessage[];
  iterations: number;
  maxIterations: number;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export const DEFAULT_QUERY_OPTIONS: Required<QueryOptions> = {
  maxIterations: 10,
  maxTokens: 4096,
  temperature: 0.7,
  systemPrompt: 'You are a helpful AI assistant. Use tools when necessary to help the user.',
  stream: true,
};
