/**
 * Verification Model - 独立模型验证能力
 * 
 * Loop Engineering M1.3: 独立 Verification Model
 * 
 * 核心功能：
 * 1. 调用独立模型判定 Skill 执行结果是否符合预期
 * 2. 支持多模型冗余验证（多数投票）
 * 3. 返回结构化验证结果（pass/fail + 置信度 + 理由）
 * 4. 低置信度时触发人工确认
 * 
 * 设计原则：
 * - 独立类，不依赖 orchestrator
 * - 可插拔的 LLM 接口，支持 Claude Haiku / GPT-4o-mini 等
 * - 向后兼容：不配置时 fallback 到基于规则的验证
 * 
 * v3.7.0 新增
 */

import type { Task, ExecutionResult } from "./skill-orchestrator.js";

// ============================================================================
// Types
// ============================================================================

/** 支持的验证模型类型 */
export type VerificationModelType = 
  | "claude-haiku" 
  | "gpt-4o-mini" 
  | "claude-sonnet"
  | "custom";

/** LLM 调用接口（可注入任意 SDK） */
export interface LLMClient {
  /** 调用 LLM 并返回文本响应 */
  complete(prompt: string, options?: LLMCompleteOptions): Promise<LLMResponse>;
}

/** LLM 完成选项 */
export interface LLMCompleteOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

/** LLM 响应 */
export interface LLMResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/** 验证配置 */
export interface VerificationConfig {
  /** 主要验证模型（默认 claude-haiku） */
  model: VerificationModelType;
  /** 自定义模型名称（model=custom 时使用） */
  customModelName?: string;
  /** 自定义 LLM 客户端（若不提供则使用默认实现） */
  llmClient?: LLMClient;
  /** 启用多模型冗余验证 */
  requireMultiModelConsensus?: boolean;
  /** 多模型列表（requireMultiModelConsensus=true 时使用） */
  consensusModels?: VerificationModelType[];
  /** 置信度阈值：低于此值触发人工确认，默认 0.7 */
  confidenceThreshold?: number;
  /** 每 N 轮强制人工确认，默认 5（0 表示不触发） */
  humanCheckpointInterval?: number;
  /** 反合理化表路径（用于协同验证） */
  antiRationalizationTablePath?: string;
  /** 强制完整输出检查路径（用于协同验证） */
  forcedCompleteConfigPath?: string;
}

/** 默认配置 */
export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  model: "claude-haiku",
  requireMultiModelConsensus: false,
  consensusModels: ["claude-haiku", "gpt-4o-mini"],
  confidenceThreshold: 0.7,
  humanCheckpointInterval: 5,
};

/** 验证上下文 */
export interface VerificationContext {
  /** 技能名称 */
  skillName: string;
  /** 目标描述（原始 goal） */
  goal: string;
  /** 预期产出描述 */
  expectedOutput: string;
  /** 实际产出 */
  actualOutput: string;
  /** 上下文（可选） */
  historyContext?: string;
  /** 当前验证轮次（用于 humanCheckpointInterval） */
  verificationRound?: number;
  /** 执行元数据 */
  executionMeta?: {
    taskId: string;
    duration?: number;
    retries?: number;
    status?: string;
  };
}

/** 单模型验证结果 */
export interface SingleVerificationResult {
  /** 是否通过 */
  passed: boolean;
  /** 置信度 0-1 */
  confidence: number;
  /** 理由 */
  reason: string;
  /** 使用的模型 */
  modelUsed: string;
  /** 是否需要人工确认 */
  requireHumanReview: boolean;
}

/** 多模型验证结果 */
export interface MultiVerificationResult {
  /** 最终判定（多数投票） */
  passed: boolean;
  /** 综合置信度（平均） */
  confidence: number;
  /** 理由摘要 */
  reason: string;
  /** 各模型结果 */
  consensusResults: SingleVerificationResult[];
  /** 投票分布 */
  voteDistribution: {
    pass: number;
    fail: number;
  };
  /** 是否需要人工确认 */
  requireHumanReview: boolean;
}

/** 验证结果（对外统一接口） */
export interface VerificationResult {
  /** 是否通过 */
  passed: boolean;
  /** 置信度 0-1 */
  confidence: number;
  /** 理由 */
  reason: string;
  /** 使用的模型 */
  modelUsed: string;
  /** 多模型时的各模型结果 */
  consensusResults?: SingleVerificationResult[];
  /** 是否需要人工确认 */
  requireHumanReview: boolean;
  /** 验证元数据 */
  meta?: {
    verificationRound?: number;
    configSnapshot?: Partial<VerificationConfig>;
    antiRationalizationCheck?: boolean;
    forcedCompleteCheck?: boolean;
  };
}

/** 验证引擎统计 */
export interface VerificationStats {
  totalVerifications: number;
  passedCount: number;
  failedCount: number;
  humanReviewCount: number;
  averageConfidence: number;
  modelUsage: Record<string, number>;
}

// ============================================================================
// Verification Prompt Templates
// ============================================================================

/** 独立验证者系统提示词 */
const VERIFICATION_SYSTEM_PROMPT = `你是独立验证者（Verification Model），不受执行者（Executor）影响。

你的职责：
1. 客观评估 Skill 执行结果是否符合预期目标
2. 不依赖执行者提供的自我评价
3. 基于实际产出与预期目标的对比做出独立判断

关键原则：
- 你是独立的第三方，不受 Executor 影响
- 即使 Executor 声称成功，也要验证实际产出
- 关注结果质量，不只看是否完成
- 低置信度时要明确标记需要人工确认

评分标准：
- 0.9-1.0：完美符合，产出超出预期
- 0.7-0.9：基本符合预期
- 0.5-0.7：部分符合，有明显缺陷
- 0.3-0.5：大部分不符合
- 0.0-0.3：完全不符合

输出格式（JSON）：
{
  "passed": true/false,
  "confidence": 0.0-1.0,
  "reason": "详细理由",
  "requireHumanReview": true/false
}`;

/** 任务验证提示词模板 */
const TASK_VERIFICATION_PROMPT = `## 验证任务

**技能名称**: {skillName}
**原始目标**: {goal}
**预期产出**: {expectedOutput}
**实际产出**: {actualOutput}

{historyContext}

## 请评估

1. 实际产出是否满足预期？
2. 产出质量如何？
3. 是否有遗漏或错误？

请以 JSON 格式返回验证结果。`;

// ============================================================================
// Mock LLM Client（测试用）
// ============================================================================

/** Mock LLM 响应生成器 */
export interface MockLLMConfig {
  /** 固定响应（用于测试特定场景） */
  fixedResponse?: SingleVerificationResult;
  /** 模拟延迟（毫秒） */
  delay?: number;
  /** 错误率（0-1） */
  errorRate?: number;
  /** 默认置信度（用于随机响应） */
  defaultConfidence?: number;
}

/** 创建 Mock LLM 客户端 */
export function createMockLLMClient(config: MockLLMConfig = {}): LLMClient {
  const { fixedResponse, delay = 100, errorRate = 0, defaultConfidence = 0.8 } = config;

  return {
    async complete(prompt: string, _options?: LLMCompleteOptions): Promise<LLMResponse> {
      // 模拟延迟
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // 模拟错误
      if (errorRate > 0 && Math.random() < errorRate) {
        throw new Error("Mock LLM error: Simulated failure");
      }

      // 返回固定响应
      if (fixedResponse) {
        return {
          content: JSON.stringify(fixedResponse),
          usage: { inputTokens: prompt.length, outputTokens: 100 },
        };
      }

      // 智能解析 prompt 提取信息生成响应
      const passed = !prompt.includes("失败") && !prompt.includes("错误") && Math.random() > 0.2;
      const confidence = Math.random() * 0.3 + (passed ? 0.6 : 0.2);
      const reason = passed 
        ? "产出符合预期目标，质量良好"
        : "产出未达到预期，存在明显缺陷";

      return {
        content: JSON.stringify({
          passed,
          confidence: Math.round(confidence * 100) / 100,
          reason,
          requireHumanReview: confidence < 0.7,
        }),
        usage: { inputTokens: prompt.length, outputTokens: 100 },
      };
    },
  };
}

// ============================================================================
// VerificationModel Class
// ============================================================================

/**
 * 独立验证模型
 * 
 * 使用方法：
 * 
 * ```typescript
 * import { VerificationModel } from './verification-model.js';
 * 
 * // 基础用法（单模型）
 * const verifier = new VerificationModel({ model: 'claude-haiku' });
 * const result = await verifier.verify({
 *   skillName: 'audit',
 *   goal: '审计所有技能',
 *   expectedOutput: '生成完整审计报告',
 *   actualOutput: '审计报告已生成，包含 10 个技能',
 * });
 * 
 * // 多模型冗余验证
 * const multiVerifier = new VerificationModel({
 *   model: 'claude-haiku',
 *   requireMultiModelConsensus: true,
 *   consensusModels: ['claude-haiku', 'gpt-4o-mini'],
 * });
 * const multiResult = await multiVerifier.verifyMulti([ctx1, ctx2]);
 * 
 * // 自定义 LLM 客户端
 * const customVerifier = new VerificationModel({
 *   model: 'custom',
 *   customModelName: 'my-model',
 *   llmClient: myCustomLLMClient,
 * });
 * ```
 */
export class VerificationModel {
  private config: VerificationConfig;
  private llmClient: LLMClient | null;
  private stats: VerificationStats;

  constructor(config: Partial<VerificationConfig> = {}) {
    this.config = { ...DEFAULT_VERIFICATION_CONFIG, ...config };
    this.llmClient = this.config.llmClient ?? null;
    this.stats = {
      totalVerifications: 0,
      passedCount: 0,
      failedCount: 0,
      humanReviewCount: 0,
      averageConfidence: 0,
      modelUsage: {},
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VerificationConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.llmClient) {
      this.llmClient = config.llmClient;
    }
  }

  /**
   * 获取当前统计
   */
  getStats(): VerificationStats {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      totalVerifications: 0,
      passedCount: 0,
      failedCount: 0,
      humanReviewCount: 0,
      averageConfidence: 0,
      modelUsage: {},
    };
  }

  /**
   * 单模型验证
   */
  async verify(context: VerificationContext): Promise<VerificationResult> {
    const startTime = Date.now();

    // 更新统计
    this.stats.totalVerifications++;
    this.stats.modelUsage[this.config.model] = (this.stats.modelUsage[this.config.model] ?? 0) + 1;

    // 如果没有 LLM 客户端，使用 fallback 验证
    if (!this.llmClient) {
      return this.fallbackVerify(context);
    }

    try {
      const result = await this.callLLM(context);

      // 更新统计
      this.updateStatsWithResult(result);

      return {
        ...result,
        modelUsed: this.getModelIdentifier(),
        meta: {
          verificationRound: context.verificationRound,
          configSnapshot: {
            model: this.config.model,
            confidenceThreshold: this.config.confidenceThreshold,
          },
        },
      };
    } catch (error) {
      // LLM 调用失败，fallback 到基于规则的验证
      console.error(`[VerificationModel] LLM call failed: ${error}. Falling back to rule-based verification.`);
      return this.fallbackVerify(context);
    }
  }

  /**
   * 多模型冗余验证
   */
  async verifyMulti(contexts: VerificationContext[]): Promise<MultiVerificationResult> {
    if (!this.config.requireMultiModelConsensus || !this.config.consensusModels) {
      // 单模型模式
      const singleResult = await this.verify(contexts[0]);
      return {
        passed: singleResult.passed,
        confidence: singleResult.confidence,
        reason: singleResult.reason,
        consensusResults: [singleResult],
        voteDistribution: { pass: singleResult.passed ? 1 : 0, fail: singleResult.passed ? 0 : 1 },
        requireHumanReview: singleResult.requireHumanReview,
      };
    }

    const models = this.config.consensusModels;
    const results: SingleVerificationResult[] = [];

    // 并行调用多个模型
    const promises = models.map(async (model) => {
      const tempVerifier = new VerificationModel({
        ...this.config,
        model,
        llmClient: this.llmClient,
      });
      return tempVerifier.verify(contexts[0]);
    });

    const allResults = await Promise.all(promises);

    for (let i = 0; i < models.length; i++) {
      const result = allResults[i];
      results.push({
        passed: result.passed,
        confidence: result.confidence,
        reason: result.reason,
        modelUsed: models[i],
        requireHumanReview: result.requireHumanReview,
      });
    }

    // 统计投票
    const passCount = results.filter(r => r.passed).length;
    const failCount = results.filter(r => !r.passed).length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    // 多数一致才算通过
    const passed = passCount > failCount;

    // 更新统计
    this.stats.totalVerifications += models.length;
    for (const result of results) {
      this.updateStatsWithResult(result);
    }

    return {
      passed,
      confidence: Math.round(avgConfidence * 100) / 100,
      reason: this.summarizeReasons(results),
      consensusResults: results,
      voteDistribution: { pass: passCount, fail: failCount },
      requireHumanReview: passed && avgConfidence < (this.config.confidenceThreshold ?? 0.7),
    };
  }

  /**
   * 从 Task 和 ExecutionResult 构建验证上下文
   */
  buildContextFromExecution(
    task: Task,
    execution: ExecutionResult,
    goal: string
  ): VerificationContext {
    const result = execution.taskResults.get(task.id);
    
    return {
      skillName: task.input?.skillName as string ?? task.name,
      goal,
      expectedOutput: task.description,
      actualOutput: result?.output ? JSON.stringify(result.output) : (result?.error ?? "无输出"),
      historyContext: undefined,
      verificationRound: undefined,
      executionMeta: {
        taskId: task.id,
        duration: result?.duration,
        retries: result?.retries,
        status: result?.status,
      },
    };
  }

  /**
   * 调用 LLM 进行验证
   */
  private async callLLM(context: VerificationContext): Promise<SingleVerificationResult> {
    if (!this.llmClient) {
      throw new Error("No LLM client configured");
    }

    const prompt = this.buildPrompt(context);
    const response = await this.llmClient.complete(prompt, {
      systemPrompt: VERIFICATION_SYSTEM_PROMPT,
      temperature: 0.3, // 降低随机性，提高一致性
      maxTokens: 500,
    });

    return this.parseLLMResponse(response.content);
  }

  /**
   * 构建验证提示词
   */
  private buildPrompt(context: VerificationContext): string {
    let prompt = TASK_VERIFICATION_PROMPT
      .replace("{skillName}", context.skillName)
      .replace("{goal}", context.goal)
      .replace("{expectedOutput}", context.expectedOutput)
      .replace("{actualOutput}", context.actualOutput);

    if (context.historyContext) {
      prompt = prompt.replace("{historyContext}", `\n\n## 历史上下文\n${context.historyContext}`);
    } else {
      prompt = prompt.replace("{historyContext}", "");
    }

    // 添加执行元数据
    if (context.executionMeta) {
      const meta = context.executionMeta;
      prompt += `\n\n## 执行元数据
- Task ID: ${meta.taskId}
- 状态: ${meta.status ?? "未知"}
- 耗时: ${meta.duration ? `${meta.duration}ms` : "未知"}
- 重试: ${meta.retries ?? 0} 次`;
    }

    return prompt;
  }

  /**
   * 解析 LLM 响应
   */
  private parseLLMResponse(content: string): SingleVerificationResult {
    try {
      // 尝试解析 JSON
      const cleaned = content.replace(/```json\n?|```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return {
        passed: Boolean(parsed.passed),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        reason: String(parsed.reason || "无理由"),
        modelUsed: this.getModelIdentifier(),
        requireHumanReview: Boolean(parsed.requireHumanReview ?? (parsed.confidence < 0.7)),
      };
    } catch {
      // 解析失败，使用基于规则的 fallback
      return {
        passed: false,
        confidence: 0,
        reason: `LLM 响应解析失败: ${content.slice(0, 100)}...`,
        modelUsed: this.getModelIdentifier(),
        requireHumanReview: true,
      };
    }
  }

  /**
   * 基于规则的 fallback 验证
   */
  private fallbackVerify(context: VerificationContext): VerificationResult {
    const result: SingleVerificationResult = {
      passed: false,
      confidence: 0.3,
      reason: "LLM 不可用，使用基于规则的 fallback 验证",
      modelUsed: "fallback-rule-based",
      requireHumanReview: true,
    };

    // 简单的规则检查
    if (context.actualOutput && context.actualOutput !== "无输出" && !context.actualOutput.includes("错误")) {
      result.passed = true;
      result.confidence = 0.5;
      result.reason = "Fallback: 产出存在且无明显错误";
    }

    if (context.executionMeta?.status === "success") {
      result.passed = true;
      result.confidence = Math.max(result.confidence, 0.6);
    }

    this.updateStatsWithResult(result);

    return {
      ...result,
      modelUsed: "fallback-rule-based",
      meta: {
        verificationRound: context.verificationRound,
        configSnapshot: {
          model: this.config.model,
          confidenceThreshold: this.config.confidenceThreshold,
        },
      },
    };
  }

  /**
   * 更新统计
   */
  private updateStatsWithResult(result: SingleVerificationResult): void {
    if (result.passed) {
      this.stats.passedCount++;
    } else {
      this.stats.failedCount++;
    }
    if (result.requireHumanReview) {
      this.stats.humanReviewCount++;
    }
    // 移动平均计算置信度
    const n = this.stats.totalVerifications;
    this.stats.averageConfidence = 
      (this.stats.averageConfidence * (n - 1) + result.confidence) / n;
  }

  /**
   * 获取模型标识符
   */
  private getModelIdentifier(): string {
    if (this.config.model === "custom" && this.config.customModelName) {
      return this.config.customModelName;
    }
    return this.config.model;
  }

  /**
   * 汇总多个结果的理由
   */
  private summarizeReasons(results: SingleVerificationResult[]): string {
    const passCount = results.filter(r => r.passed).length;
    const failCount = results.filter(r => !r.passed).length;

    if (passCount > failCount) {
      return `${passCount}/${results.length} 模型判定通过。典型理由: ${results.find(r => r.passed)?.reason ?? "N/A"}`;
    } else if (failCount > passCount) {
      return `${failCount}/${results.length} 模型判定失败。典型理由: ${results.find(r => !r.passed)?.reason ?? "N/A"}`;
    } else {
      return `平票 (${passCount}/${results.length})，需要人工确认`;
    }
  }

  /**
   * 检查是否需要触发人工确认
   */
  shouldRequireHumanReview(confidence: number, verificationRound?: number): boolean {
    // 检查置信度阈值
    const threshold = this.config.confidenceThreshold ?? 0.7;
    if (confidence < threshold) {
      return true;
    }

    // 检查轮次间隔
    const interval = this.config.humanCheckpointInterval ?? 5;
    if (interval > 0 && verificationRound !== undefined && verificationRound % interval === 0) {
      return true;
    }

    return false;
  }

  /**
   * 获取配置摘要
   */
  getConfigSummary(): Record<string, unknown> {
    return {
      model: this.config.model,
      customModelName: this.config.customModelName,
      requireMultiModelConsensus: this.config.requireMultiModelConsensus,
      consensusModels: this.config.consensusModels,
      confidenceThreshold: this.config.confidenceThreshold,
      humanCheckpointInterval: this.config.humanCheckpointInterval,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * 创建 Claude Haiku 验证器
 */
export function createClaudeHaikuVerifier(config?: Partial<VerificationConfig>): VerificationModel {
  return new VerificationModel({
    model: "claude-haiku",
    ...config,
  });
}

/**
 * 创建多模型验证器
 */
export function createMultiModelVerifier(config?: Partial<VerificationConfig>): VerificationModel {
  return new VerificationModel({
    model: "claude-haiku",
    requireMultiModelConsensus: true,
    consensusModels: ["claude-haiku", "gpt-4o-mini"],
    ...config,
  });
}

/**
 * 创建带 Mock LLM 的验证器（用于测试）
 */
export function createMockVerifier(
  mockConfig?: MockLLMConfig,
  verificationConfig?: Partial<VerificationConfig>
): VerificationModel {
  return new VerificationModel({
    model: "custom", // mock 不在 VerificationModelType 中，使用 custom
    customModelName: "mock",
    llmClient: createMockLLMClient(mockConfig),
    ...verificationConfig,
  } as Partial<VerificationConfig>);
}

// ============================================================================
// Type exports (already defined above, re-exported for convenience)
// ============================================================================
