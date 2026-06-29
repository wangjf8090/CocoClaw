/**
 * Claude Adapter
 * Anthropic Claude API 适配器
 */

import {
  ModelAdapter,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  HealthStatus,
} from '../types.js';

export interface ClaudeAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  maxRetries?: number;
}

const DEFAULT_MODEL = 'claude-3-7-sonnet-20250620';
const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1/messages';

export class ClaudeAdapter implements ModelAdapter {
  name = 'claude-3.7-sonnet';
  provider = ModelProvider.ANTHROPIC;
  priority = 1;
  costPerToken = 0.000015;
  maxTokens = 200000;
  supportsStreaming = true;

  private config: Required<ClaudeAdapterConfig>;
  private healthCache: { status: HealthStatus; timestamp: number } | null = null;

  constructor(config: ClaudeAdapterConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      model: config.model ?? DEFAULT_MODEL,
      maxRetries: config.maxRetries ?? 3,
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    if (this.healthCache && Date.now() - this.healthCache.timestamp < 30000) {
      return this.healthCache.status;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const status = response.ok ? HealthStatus.HEALTHY : HealthStatus.DEGRADED;
      this.healthCache = { status, timestamp: Date.now() };
      return status;
    } catch {
      this.healthCache = { status: HealthStatus.UNHEALTHY, timestamp: Date.now() };
      return HealthStatus.UNHEALTHY;
    }
  }

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const start = Date.now();

    try {
      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
          system: request.systemPrompt,
          messages: [{ role: 'user', content: request.prompt }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: '',
          model: this.name,
          latencyMs: Date.now() - start,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json() as {
        content: Array<{ text: string }>;
        usage?: { input_tokens: number; output_tokens: number };
      };

      const content = data.content?.[0]?.text ?? '';
      const usage = data.usage;

      return {
        content,
        model: this.name,
        usage: usage ? {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          totalTokens: usage.input_tokens + usage.output_tokens,
        } : undefined,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        content: '',
        model: this.name,
        latencyMs: Date.now() - start,
        error: `Invoke failed: ${err}`,
      };
    }
  }
}

export function createClaudeAdapter(config: ClaudeAdapterConfig): ClaudeAdapter {
  return new ClaudeAdapter(config);
}
