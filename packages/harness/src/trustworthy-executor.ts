/**
 * Trustworthy Executor
 * 可信执行引擎 — 三步法
 *
 * Inspired by 科大讯飞招采AI智能体平台2.0 Harness可信执行引擎:
 *   Step 1: 理解任务意图（Understand）— 大模型语义理解
 *   Step 2: 查找证据支撑（Find Evidence）— 规则引擎+检索
 *   Step 3: 完成判断校验（Make Judgment）— 综合判断+风险评估
 *
 * 关键特性：
 *   - 规则引擎强校验：不依赖大模型直接算分，而是用规则+公式双重校验
 *   - 可追溯证据链：每一步判断都有原始证据支撑
 *   - 可复算规则：支持独立验证计算过程
 *   - 可复核风险：标记潜在风险点供人工复核
 *
 * 执行路径：
 *   1. Skill 执行前 → 通过 TrustworthyExecutor 预处理输入
 *   2. Skill 执行中 → 记录每个关键步骤的 evidence
 *   3. Skill 执行后 → 生成完整证据链供审计
 *   4. 关键风险点 → 自动标记并触发人工复核
 */

import {
  TrustworthyExecutorConfig,
  ExecutionTask,
  ExecutionResult,
  ExecutionStep,
  Evidence,
  RiskLevel,
  RuleDefinition,
  ExecutionContext as TrustworthyExecutionContext,
} from './types.js';

export class TrustworthyExecutor {
  private config: TrustworthyExecutorConfig;

  /** 规则库 */
  private rules: Map<string, RuleDefinition> = new Map();

  /** 执行历史（证据链存储） */
  private executionHistory: Map<string, ExecutionResult> = new Map();

  constructor(config: TrustworthyExecutorConfig) {
    this.config = config;
  }

  // ===========================================================================
  // 主执行方法 — 三步法
  // ===========================================================================

  /**
   * 可信执行三步法
   * Execute a task using the trustworthy three-step method
   *
   * Step 1: 理解任务意图 — 语义理解
   * Step 2: 查找证据支撑 — 规则引擎+检索
   * Step 3: 完成判断校验 — 综合判断+风险评估
   *
   * @param task - 执行任务
   * @returns 执行结果（含证据链）
   */
  async execute(task: ExecutionTask): Promise<ExecutionResult> {
    const startedAt = Date.now();
    const steps: ExecutionStep[] = [];
    const allEvidence: Evidence[] = [];

    try {
      // Step 1: 理解任务意图 — 语义理解
      const understanding = this.understand(task);
      steps.push(understanding.step);
      allEvidence.push(...understanding.step.evidence);

      // Step 2: 查找证据支撑 — 规则引擎+检索
      const evidenceResult = this.findEvidence(understanding.output, task);
      steps.push(evidenceResult.step);
      allEvidence.push(...evidenceResult.step.evidence);

      // Step 3: 完成判断校验 — 综合判断+风险评估
      const judgment = this.makeJudgment(
        understanding.output,
        evidenceResult.output,
        evidenceResult.step.evidence,
        task
      );
      steps.push(judgment.step);
      allEvidence.push(...judgment.step.evidence);

      // 构建完整结果
      const result: ExecutionResult = {
        taskId: task.id,
        status: 'completed',
        conclusion: judgment.output,
        steps,
        evidenceChain: allEvidence,
        riskLevel: judgment.step.riskLevel ?? 'low',
        confidence: this.aggregateConfidence(steps),
        traceable: this.config.enableEvidenceChain,
        startedAt,
        completedAt: Date.now(),
      };

      // 存储到历史
      this.executionHistory.set(task.id, result);

      return result;
    } catch (error) {
      // 执行失败 — 生成失败结果（仍保留已有证据链）
      const result: ExecutionResult = {
        taskId: task.id,
        status: 'failed',
        conclusion: null,
        steps,
        evidenceChain: allEvidence,
        riskLevel: 'high',
        confidence: 0,
        traceable: this.config.enableEvidenceChain,
        startedAt,
        completedAt: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      };

      this.executionHistory.set(task.id, result);
      return result;
    }
  }

  // ===========================================================================
  // Step 1: 理解任务意图（Understand）
  // 大模型语义理解
  // ===========================================================================

  /**
   * 理解任务意图
   * Understand the task intent through semantic analysis
   *
   * @param task - 执行任务
   * @returns 理解结果（含步骤和输出）
   */
  private understand(task: ExecutionTask): {
    step: ExecutionStep;
    output: string;
  } {
    const evidence: Evidence[] = [];

    // 提取任务关键语义信息
    const intentKeywords = this.extractIntentKeywords(task.input);
    const taskType = this.classifyTaskType(task.input);

    // 生成理解证据
    evidence.push({
      type: 'logic',
      source: 'understand',
      content: `Task intent: ${intentKeywords.join(', ')}`,
      confidence: 0.85,
    });

    evidence.push({
      type: 'reference',
      source: 'task_classifier',
      content: `Classified as task type: ${taskType}`,
      confidence: 0.8,
    });

    // 检查任务上下文
    if (task.context) {
      evidence.push({
        type: 'reference',
        source: 'task_context',
        content: `Context provided with ${Object.keys(task.context).length} keys`,
        confidence: 0.9,
      });
    }

    const step: ExecutionStep = {
      stepId: `step-understand-${Date.now()}`,
      type: 'understand',
      input: task.input,
      output: `Understood: type=${taskType}, intent=[${intentKeywords.join(', ')}]`,
      evidence,
      riskLevel: 'low',
    };

    return {
      step,
      output: `type=${taskType};intent=${intentKeywords.join(',')}`,
    };
  }

  // ===========================================================================
  // Step 2: 查找证据支撑（Find Evidence）
  // 规则引擎+检索
  // ===========================================================================

  /**
   * 查找证据支撑
   * Find supporting evidence through rule engine and retrieval
   *
   * @param understoodInput - 理解后的任务输入
   * @param task - 原始任务
   * @returns 证据查找结果（含步骤和输出）
   */
  private findEvidence(
    understoodInput: string,
    task: ExecutionTask
  ): {
    step: ExecutionStep;
    output: string;
  } {
    const evidence: Evidence[] = [];

    // 2a. 规则引擎查找匹配规则
    if (this.config.enableRuleValidation) {
      const matchedRules = this.findMatchingRules(understoodInput);
      for (const rule of matchedRules) {
        evidence.push({
          type: 'reference',
          source: `rule:${rule.id}`,
          content: rule.description,
          confidence: rule.confidence,
        });
      }
    }

    // 2b. 基于任务输入检索相关证据
    const retrievalEvidence = this.retrieveEvidence(task.input);
    evidence.push(...retrievalEvidence);

    // 2c. 逻辑推理证据
    evidence.push({
      type: 'logic',
      source: 'inference',
      content: `Evidence aggregation: ${evidence.length} pieces of evidence found for "${understoodInput}"`,
      confidence: this.aggregateEvidenceConfidence(evidence),
    });

    const step: ExecutionStep = {
      stepId: `step-evidence-${Date.now()}`,
      type: 'find_evidence',
      input: understoodInput,
      output: `Found ${evidence.length} pieces of evidence`,
      evidence,
      riskLevel: evidence.length > 0 ? 'low' : 'medium',
    };

    return {
      step,
      output: `evidence_count=${evidence.length};types=${[...new Set(evidence.map((e) => e.type))].join(',')}`,
    };
  }

  // ===========================================================================
  // Step 3: 完成判断校验（Make Judgment）
  // 综合判断+风险评估
  // ===========================================================================

  /**
   * 完成判断校验
   * Make final judgment with risk assessment
   *
   * @param understoodInput - 理解后的输入
   * @param evidenceOutput - 证据查找结果
   * @param evidence - 收集到的证据
   * @param task - 原始任务
   * @returns 判断结果（含步骤和输出）
   */
  private makeJudgment(
    understoodInput: string,
    evidenceOutput: string,
    evidence: Evidence[],
    task: ExecutionTask
  ): {
    step: ExecutionStep;
    output: string;
  } {
    const judgmentEvidence: Evidence[] = [];

    // 3a. 计算综合置信度
    const overallConfidence = this.aggregateEvidenceConfidence(evidence);

    // 3b. 风险评估
    const riskLevel = this.assessRisk(evidence, overallConfidence);

    // 3c. 规则强校验（如果启用）
    if (this.config.enableRuleValidation) {
      const validationResult = this.validateWithRules(evidence);
      judgmentEvidence.push({
        type: 'calculation',
        source: 'rule_validator',
        content: `Rule validation: ${validationResult.passed ? 'PASSED' : 'FAILED'} (${validationResult.passedRules}/${validationResult.totalRules} rules passed)`,
        confidence: validationResult.passedRules / Math.max(validationResult.totalRules, 1),
      });
    }

    // 3d. 可复算检查
    judgmentEvidence.push({
      type: 'calculation',
      source: 'recompute_check',
      content: `Overall confidence: ${overallConfidence.toFixed(3)}, risk level: ${riskLevel}`,
      confidence: overallConfidence,
    });

    // 3e. 风险标记（如果启用）
    if (this.config.enableRiskFlagging && riskLevel !== 'low') {
      judgmentEvidence.push({
        type: 'logic',
        source: 'risk_flagger',
        content: `⚠ Risk flagged: level=${riskLevel}, requires human review`,
        confidence: 1.0,
      });
    }

    const conclusion = this.buildConclusion(
      understoodInput,
      overallConfidence,
      riskLevel,
      evidence
    );

    const step: ExecutionStep = {
      stepId: `step-judgment-${Date.now()}`,
      type: 'make_judgment',
      input: `${understoodInput} | ${evidenceOutput}`,
      output: conclusion,
      evidence: judgmentEvidence,
      riskLevel,
      ruleApplied: this.getAppliedRuleIds(evidence),
    };

    return {
      step,
      output: conclusion,
    };
  }

  // ===========================================================================
  // 辅助方法
  // ===========================================================================

  /**
   * 提取任务意图关键词
   * Extract intent keywords from task input
   *
   * @param input - 任务输入文本
   * @returns 关键词数组
   */
  private extractIntentKeywords(input: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'and', 'or', 'not', 'but', 'if',
      'then', 'else', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
      'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
      'only', 'own', 'same', 'so', 'than', 'too', 'very',
    ]);

    const words = input
      .toLowerCase()
      .split(/[\s,.;:!?(){}[\]]+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    // 取前 5 个关键词（去重）
    return [...new Set(words)].slice(0, 5);
  }

  /**
   * 分类任务类型
   * Classify the task type based on input keywords
   *
   * @param input - 任务输入文本
   * @returns 任务类型标识
   */
  private classifyTaskType(input: string): string {
    const lower = input.toLowerCase();

    // 基于关键词的简单分类器
    if (/evaluat|assess|review|judge|score|rank/.test(lower)) return 'evaluation';
    if (/generat|creat|build|compos|writ|draft/.test(lower)) return 'generation';
    if (/analyz|investigat|explor|exam/.test(lower)) return 'analysis';
    if (/validat|verify|check|confirm|certif/.test(lower)) return 'validation';
    if (/optimiz|improv|enhanc|refin|tun/.test(lower)) return 'optimization';
    if (/search|find|query|lookup|retriev/.test(lower)) return 'retrieval';
    if (/transform|convert|translat|format/.test(lower)) return 'transformation';

    return 'general';
  }

  /**
   * 查找匹配规则
   * Find rules matching the understood input
   *
   * @param input - 理解后的输入
   * @returns 匹配的规则数组
   */
  private findMatchingRules(input: string): RuleDefinition[] {
    const matched: RuleDefinition[] = [];

    for (const rule of this.rules.values()) {
      // 有模式 → 正则匹配
      if (rule.pattern && new RegExp(rule.pattern, 'i').test(input)) {
        matched.push(rule);
      }
      // 无模式 → 视为通用规则
      if (!rule.pattern) {
        matched.push(rule);
      }
    }

    return matched;
  }

  /**
   * 检索证据
   * Retrieve evidence based on task input
   *
   * @param input - 任务输入
   * @returns 证据数组
   */
  private retrieveEvidence(input: string): Evidence[] {
    const evidence: Evidence[] = [];

    // 基于 input 中的关键词检索相关规则产生的证据
    for (const rule of this.rules.values()) {
      if (rule.pattern && new RegExp(rule.pattern, 'i').test(input)) {
        evidence.push({
          type: 'retrieval',
          source: `rule_retrieval:${rule.id}`,
          content: rule.description,
          confidence: rule.confidence,
        });
      }
    }

    // 如果没有匹配的规则，生成通用检索证据
    if (evidence.length === 0) {
      evidence.push({
        type: 'retrieval',
        source: 'generic_retrieval',
        content: 'No specific rules matched for input, using general evidence',
        confidence: 0.5,
      });
    }

    return evidence;
  }

  /**
   * 规则强校验
   * Validate evidence against all registered rules
   *
   * @param evidence - 待校验证据
   * @returns 校验结果
   */
  private validateWithRules(evidence: Evidence[]): {
    passed: boolean;
    passedRules: number;
    totalRules: number;
  } {
    let passedRules = 0;
    const totalRules = this.rules.size;

    for (const rule of this.rules.values()) {
      // 检查是否有足够置信度的证据支撑该规则
      const supportingEvidence = evidence.filter(
        (e) => e.source.includes(rule.id) && e.confidence >= rule.confidence
      );
      if (supportingEvidence.length > 0) {
        passedRules++;
      }
    }

    return {
      passed: totalRules === 0 || passedRules === totalRules,
      passedRules,
      totalRules,
    };
  }

  /**
   * 风险评估
   * Assess risk level based on evidence and confidence
   *
   * @param evidence - 证据数组
   * @param overallConfidence - 综合置信度
   * @returns 风险等级
   */
  private assessRisk(evidence: Evidence[], overallConfidence: number): RiskLevel {
    // 置信度低 → 高风险
    if (overallConfidence < 0.3) return 'high';
    // 置信度中 → 中风险
    if (overallConfidence < 0.6) return 'medium';
    // 证据数量少 → 中风险
    if (evidence.length < 2) return 'medium';
    // 默认低风险
    return 'low';
  }

  /**
   * 聚合证据置信度
   * Aggregate confidence from multiple evidence (weighted average)
   *
   * @param evidence - 证据数组
   * @returns 聚合后的置信度
   */
  private aggregateEvidenceConfidence(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;

    // 加权平均：高置信度证据权重更大
    const totalWeight = evidence.reduce((sum, e) => sum + e.confidence, 0);
    const weightedSum = evidence.reduce(
      (sum, e) => sum + e.confidence * e.confidence,
      0
    );

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * 聚合步骤置信度
   * Aggregate confidence from execution steps (weakest-link principle)
   *
   * @param steps - 执行步骤数组
   * @returns 整体置信度（取最小值，木桶效应）
   */
  private aggregateConfidence(steps: ExecutionStep[]): number {
    const stepConfidences = steps.map((step) =>
      this.aggregateEvidenceConfidence(step.evidence)
    );

    if (stepConfidences.length === 0) return 0;

    // 取最小值（木桶效应：最弱环节决定整体置信度）
    return Math.min(...stepConfidences);
  }

  /**
   * 获取应用的规则 ID 列表
   * Get IDs of rules applied in the evidence
   *
   * @param evidence - 证据数组
   * @returns 规则 ID 逗号分隔字符串
   */
  private getAppliedRuleIds(evidence: Evidence[]): string {
    const ruleIds: string[] = [];

    for (const e of evidence) {
      if (e.source.startsWith('rule:') || e.source.startsWith('rule_retrieval:')) {
        const parts = e.source.split(':');
        if (parts.length >= 2) {
          ruleIds.push(parts[1]);
        }
      }
    }

    return ruleIds.length > 0 ? ruleIds.join(',') : 'none';
  }

  /**
   * 构建最终结论
   * Build the final conclusion string
   *
   * @param understoodInput - 理解后的输入
   * @param confidence - 综合置信度
   * @param riskLevel - 风险等级
   * @param evidence - 证据数组
   * @returns 结论字符串
   */
  private buildConclusion(
    understoodInput: string,
    confidence: number,
    riskLevel: RiskLevel,
    evidence: Evidence[]
  ): string {
    const evidenceTypes = [...new Set(evidence.map((e) => e.type))];
    return `Conclusion for [${understoodInput}]: confidence=${confidence.toFixed(3)}, risk=${riskLevel}, evidence_types=[${evidenceTypes.join(',')}], evidence_count=${evidence.length}`;
  }

  // ===========================================================================
  // 公共 API — 规则管理
  // ===========================================================================

  /**
   * 注册规则
   * Register a validation rule
   *
   * @param rule - 规则定义
   */
  registerRule(rule: RuleDefinition): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * 批量注册规则
   * Register multiple validation rules
   *
   * @param rules - 规则定义数组
   */
  registerRules(rules: RuleDefinition[]): void {
    for (const rule of rules) {
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * 移除规则
   * Remove a validation rule
   *
   * @param ruleId - 规则 ID
   * @returns 是否移除成功
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * 获取所有规则
   * Get all registered rules
   */
  getRules(): RuleDefinition[] {
    return Array.from(this.rules.values());
  }

  // ===========================================================================
  // 公共 API — 历史查询
  // ===========================================================================

  /**
   * 获取执行结果
   * Get execution result for a task
   *
   * @param taskId - 任务 ID
   * @returns 执行结果（含证据链）
   */
  getExecutionResult(taskId: string): ExecutionResult | undefined {
    return this.executionHistory.get(taskId);
  }

  /**
   * 获取证据链
   * Get evidence chain for a task
   *
   * @param taskId - 任务 ID
   * @returns 证据数组
   */
  getEvidenceChain(taskId: string): Evidence[] {
    const result = this.executionHistory.get(taskId);
    return result?.evidenceChain ?? [];
  }

  /**
   * 获取执行追踪
   * Get execution trace (steps) for a task
   *
   * @param taskId - 任务 ID
   * @returns 执行步骤数组
   */
  getExecutionTrace(taskId: string): ExecutionStep[] {
    const result = this.executionHistory.get(taskId);
    return result?.steps ?? [];
  }

  /**
   * 获取所有需要人工复核的执行结果
   * Get all execution results flagged for human review
   */
  getFlaggedForReview(): ExecutionResult[] {
    return Array.from(this.executionHistory.values()).filter(
      (r) => r.riskLevel === 'high' || r.riskLevel === 'medium'
    );
  }

  /**
   * 获取执行器统计
   * Get executor statistics
   */
  getStats(): {
    totalExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    registeredRules: number;
    flaggedForReview: number;
    avgConfidence: number;
  } {
    const results = Array.from(this.executionHistory.values());
    const completed = results.filter((r) => r.status === 'completed');
    const failed = results.filter((r) => r.status === 'failed');
    const flagged = results.filter(
      (r) => r.riskLevel === 'high' || r.riskLevel === 'medium'
    );

    const avgConfidence =
      completed.length > 0
        ? completed.reduce((sum, r) => sum + r.confidence, 0) / completed.length
        : 0;

    return {
      totalExecutions: results.length,
      completedExecutions: completed.length,
      failedExecutions: failed.length,
      registeredRules: this.rules.size,
      flaggedForReview: flagged.length,
      avgConfidence,
    };
  }
}
