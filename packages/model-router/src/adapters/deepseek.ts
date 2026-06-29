/**
 * DeepSeek Adapter
 * TODO: Full implementation
 */

import {
  ModelAdapter,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  HealthStatus,
} from '../types.js';

export interface DeepSeekAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class DeepSeekAdapter implements ModelAdapter {
  name = 'deepseek-v3';
  provider = ModelProvider.DEEPSEEK;
  priority = 5;
  costPerToken = 0.000001;
  maxTokens = 64000;
  supportsStreaming = true;

  private config: Required<DeepSeekAdapterConfig>;

  constructor(config: DeepSeekAdapterConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? 'https://api.deepseek.com/v1/chat/completions',
      model: config.model ?? 'deepseek-chat',
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    // TODO: Implement actual health check
    return HealthStatus.HEALTHY;
  }

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    // TODO: Implement full API call
    return {
      content: '',
      model: this.name,
      latencyMs: 0,
      error: 'DeepSeek adapter not fully implemented',
    };
  }
}

export function createDeepSeekAdapter(config: DeepSeekAdapterConfig): DeepSeekAdapter {
  return new DeepSeekAdapter(config);
}
