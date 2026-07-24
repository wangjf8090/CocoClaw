/**
 * Kimi K3 Adapter - Moonshot AI 模型适配器
 * 
 * P1-3: 国产模型Adapter
 * 
 * 设计灵感：
 * 1. Kimi K3（2026-07-23日报）：全球首个开源3T级模型
 *    - 2.8T参数 MoE架构
 *    - 100万token超长上下文
 *    - 7/27完整权重开源
 *    - 马斯克称赞
 * 2. SelfClaw M3路由层：跨模型迁移是具体落地场景
 *    - 需要国产模型adapter支持
 *    - 长上下文场景需要专门的adapter处理
 * 
 * SelfClaw定位：
 * KimiK3Adapter利用K3的100万token上下文优势，
 * 特别适合长文档分析、大规模代码理解等场景。
 */

import {
  ModelAdapter,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  HealthStatus,
} from '../types.js';

// ==================== 类型定义 ====================

export interface KimiK3AdapterConfig {
  /** API Key */
  apiKey: string;
  /** API基础URL */
  baseUrl?: string;
  /** 模型名称 */
  model?: string;
  /** 是否启用超长上下文模式 */
  enableLongContext?: boolean;
  /** MoE专家选择策略 */
  expertSelectionStrategy?: 'auto' | 'balanced' | 'specialized';
}

/**
 * K3 MoE专家配置
 */
export interface K3ExpertConfig {
  /** 活跃专家数量 */
  activeExperts: number;
  /** 总专家数量 */
  totalExperts: number;
  /** 路由策略 */
  routingStrategy: 'top_k' | 'hash' | 'learned';
}

// ==================== Kimi K3 Adapter ====================

export class KimiK3Adapter implements ModelAdapter {
  name = 'kimi-k3';
  provider = ModelProvider.MOONSHOT;
  priority = 2;  // 高优先级（国产模型优势）
  costPerToken = 0.000003;  // 开源模型，部署成本低
  maxTokens = 1000000;  // 100万token上下文
  supportsStreaming = true;

  private config: Required<KimiK3AdapterConfig>;
  private expertConfig: K3ExpertConfig;

  constructor(config: KimiK3AdapterConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? 'https://api.moonshot.cn/v1/chat/completions',
      model: config.model ?? 'kimi-k3',
      enableLongContext: config.enableLongContext ?? true,
      expertSelectionStrategy: config.expertSelectionStrategy ?? 'auto',
    };

    // K3 MoE配置（2.8T参数）
    this.expertConfig = {
      activeExperts: 32,  // 每次激活32个专家
      totalExperts: 256,  // 总共256个专家
      routingStrategy: 'learned',
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      // 轻量级API调用检测
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
        return HealthStatus.DEGRADED; // 限流
      } else {
        return HealthStatus.UNHEALTHY;
      }
    } catch {
      return HealthStatus.UNHEALTHY;
    }
  }

  /**
   * 调用Kimi K3
   */
  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
      // 处理超长上下文
      const processedPrompt = this.config.enableLongContext
        ? this.prepareLongContextInput(request.prompt)
        : request.prompt;

      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: this.buildMessages(request, processedPrompt),
          max_tokens: request.maxTokens ?? 8192,
          temperature: request.temperature ?? 0.7,
          stream: request.streaming ?? false,
          // K3特有参数
          top_k: this.expertConfig.activeExperts,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: '',
          model: this.name,
          latencyMs: Date.now() - startTime,
          error: `Kimi K3 API error (${response.status}): ${errorText}`,
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
        error: `Kimi K3 invoke failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 构建消息数组
   */
  private buildMessages(request: ModelRequest, processedPrompt: string): Array<{
    role: string;
    content: string;
  }> {
    const messages: Array<{ role: string; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    messages.push({ role: 'user', content: processedPrompt });

    return messages;
  }

  /**
   * 超长上下文输入预处理
   * 
   * K3支持100万token，但仍需要合理的输入处理：
   * 1. 分段标记：为长文本添加段落标记
   * 2. 关键区域标注：标记需要重点关注的区域
   * 3. 上下文窗口管理：避免超出有效注意力范围
   */
  private prepareLongContextInput(prompt: string): string {
    // 如果输入超过10万字符，进行分段处理
    if (prompt.length > 100000) {
      // 添加分段标记帮助模型定位
      const segments = this.segmentLongText(prompt, 50000);
      return segments.map((seg, i) => 
        `[Section ${i + 1}/${segments.length}]\n${seg}`
      ).join('\n\n---\n\n');
    }

    return prompt;
  }

  /**
   * 长文本分段
   */
  private segmentLongText(text: string, maxSegmentLength: number): string[] {
    const segments: string[] = [];
    const paragraphs = text.split(/\n\n+/);
    let currentSegment = '';

    for (const paragraph of paragraphs) {
      if (currentSegment.length + paragraph.length > maxSegmentLength) {
        if (currentSegment) {
          segments.push(currentSegment);
        }
        currentSegment = paragraph;
      } else {
        currentSegment += (currentSegment ? '\n\n' : '') + paragraph;
      }
    }

    if (currentSegment) {
      segments.push(currentSegment);
    }

    return segments;
  }

  /**
   * 获取模型能力信息
   */
  getCapabilities(): {
    maxContextLength: number;
    supportsFunctionCalling: boolean;
    supportsVision: boolean;
    supportsLongContext: boolean;
    moeExperts: number;
  } {
    return {
      maxContextLength: this.maxTokens,
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsLongContext: this.config.enableLongContext,
      moeExperts: this.expertConfig.totalExperts,
    };
  }
}

/**
 * 创建Kimi K3适配器
 */
export function createKimiK3Adapter(config: KimiK3AdapterConfig): KimiK3Adapter {
  return new KimiK3Adapter(config);
}

export default KimiK3Adapter;
