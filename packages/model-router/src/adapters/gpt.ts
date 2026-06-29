/**
 * OpenAI GPT Adapter
 * TODO: Full implementation
 */

import {
  ModelAdapter,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  HealthStatus,
} from '../types.js';

export interface GPTAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class GPTAdapter implements ModelAdapter {
  name = 'gpt-4o';
  provider = ModelProvider.OPENAI;
  priority = 2;
  costPerToken = 0.00001;
  maxTokens = 128000;
  supportsStreaming = true;

  private config: Required<GPTAdapterConfig>;

  constructor(config: GPTAdapterConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? 'https://api.openai.com/v1/chat/completions',
      model: config.model ?? 'gpt-4o',
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
      error: 'GPT adapter not fully implemented',
    };
  }
}

export function createGPTAdapter(config: GPTAdapterConfig): GPTAdapter {
  return new GPTAdapter(config);
}
