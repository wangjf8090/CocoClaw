/**
 * Zhipu GLM-5.2 Adapter
 * 
 * P1-3: 国产模型Adapter
 * 
 * 设计灵感：
 * 1. GLM-5.2实战验证（7/23日报）：智谱模型在安全分析场景已验证
 *    - 沙箱逃逸取证能力验证
 *    - 中文理解能力强
 * 2. SelfClaw M3路由层：国产模型adapter支持
 *    - GLM作为fallback chain中的重要一环
 *    - 国内部署低延迟优势
 */

import {
  ModelAdapter,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  HealthStatus,
} from '../types.js';

// ==================== 类型定义 ====================

export interface GLMAdapterConfig {
  /** API Key */
  apiKey: string;
  /** API基础URL */
  baseUrl?: string;
  /** 模型名称 */
  model?: string;
  /** 是否启用联网搜索增强 */
  enableWebSearch?: boolean;
  /** 是否启用代码执行 */
  enableCodeExecution?: boolean;
  /** 检索增强（RAG）配置 */
  ragConfig?: {
    enabled: boolean;
    knowledgeBaseId?: string;
  };
}

// ==================== GLM-5.2 Adapter ====================

export class GLMAdapter implements ModelAdapter {
  name = 'glm-5.2';
  provider = ModelProvider.ZHIPU;
  priority = 3;
  costPerToken = 0.000005;
  maxTokens = 128000;
  supportsStreaming = true;

  private config: Required<GLMAdapterConfig>;

  constructor(config: GLMAdapterConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      model: config.model ?? 'glm-5.2',
      enableWebSearch: config.enableWebSearch ?? false,
      enableCodeExecution: config.enableCodeExecution ?? false,
      ragConfig: config.ragConfig ?? { enabled: false },
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return HealthStatus.HEALTHY;
      } else if (response.status === 429) {
        return HealthStatus.DEGRADED;
      } else {
        return HealthStatus.UNHEALTHY;
      }
    } catch {
      return HealthStatus.UNHEALTHY;
    }
  }

  /**
   * 调用GLM-5.2
   */
  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
      // 构建请求体
      const requestBody: Record<string, unknown> = {
        model: this.config.model,
        messages: this.buildMessages(request),
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        stream: request.streaming ?? false,
      };

      // GLM特有功能
      if (this.config.enableWebSearch) {
        requestBody.tools = [
          ...(requestBody.tools as unknown[] ?? []),
          { type: 'web_search' },
        ];
      }

      if (this.config.enableCodeExecution) {
        requestBody.tools = [
          ...(requestBody.tools as unknown[] ?? []),
          { type: 'code_interpreter' },
        ];
      }

      if (this.config.ragConfig?.enabled && this.config.ragConfig.knowledgeBaseId) {
        requestBody.knowledge_id = this.config.ragConfig.knowledgeBaseId;
      }

      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: '',
          model: this.name,
          latencyMs: Date.now() - startTime,
          error: `GLM API error (${response.status}): ${errorText}`,
        };
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      const content = data.choices?.[0]?.message?.content ?? '';
      const usage = data.usage;

      return {
        content,
        model: this.name,
        usage: usage ? {
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        } : undefined,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        content: '',
        model: this.name,
        latencyMs: Date.now() - startTime,
        error: `GLM invoke failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 构建消息数组
   */
  private buildMessages(request: ModelRequest): Array<{
    role: string;
    content: string;
  }> {
    const messages: Array<{ role: string; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    messages.push({ role: 'user', content: request.prompt });

    return messages;
  }

  /**
   * 获取模型能力信息
   */
  getCapabilities(): {
    maxContextLength: number;
    supportsWebSearch: boolean;
    supportsCodeExecution: boolean;
    supportsRAG: boolean;
  } {
    return {
      maxContextLength: this.maxTokens,
      supportsWebSearch: this.config.enableWebSearch,
      supportsCodeExecution: this.config.enableCodeExecution,
      supportsRAG: this.config.ragConfig?.enabled ?? false,
    };
  }
}

/**
 * 创建GLM-5.2适配器
 */
export function createGLMAdapter(config: GLMAdapterConfig): GLMAdapter {
  return new GLMAdapter(config);
}

export default GLMAdapter;
