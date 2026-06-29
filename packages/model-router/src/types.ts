/**
 * Model Router Types
 * 多模型路由类型定义
 */

export enum ModelProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  ZHIPU = 'zhipu',
  DASHSCOPE = 'dashscope',
  DEEPSEEK = 'deepseek',
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

export interface ModelAdapter {
  name: string;
  provider: ModelProvider;
  priority: number;
  costPerToken: number;
  maxTokens: number;
  supportsStreaming: boolean;
  healthCheck(): Promise<HealthStatus>;
  invoke(request: ModelRequest): Promise<ModelResponse>;
}

export interface ModelRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  streaming?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ModelResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  error?: string;
}

export interface RouterConfig {
  primaryModel: string;
  fallbackChain: string[];
  healthCheckIntervalMs: number;
  failureThreshold: number;
  recoveryIntervalMs: number;
  enableStreaming?: boolean;
  defaultTemperature?: number;
}

export interface HealthCheckResult {
  model: string;
  status: HealthStatus;
  latencyMs?: number;
  lastChecked: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export interface FallbackStrategy {
  maxRetries: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
}

export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  primaryModel: 'claude-3.7-sonnet',
  fallbackChain: ['claude-3.7-sonnet', 'gpt-4o', 'glm-5.2', 'qwen-3-max', 'deepseek-v3'],
  healthCheckIntervalMs: 60000,
  failureThreshold: 3,
  recoveryIntervalMs: 120000,
  enableStreaming: false,
  defaultTemperature: 0.7,
};

export const DEFAULT_FALLBACK_STRATEGY: FallbackStrategy = {
  maxRetries: 5,
  retryDelayMs: 1000,
  circuitBreakerThreshold: 3,
};
