/**
 * Skill Evolver
 * 技能进化器 — 四层递进式反馈机制
 *
 * Inspired by 科大讯飞招采AI智能体平台2.0:
 *   Layer 1: 复核判例（Case Review）— 收集使用失败/成功案例
 *   Layer 2: 标准演进层（Standard Evolution）— 基于案例更新审计规则
 *   Layer 3: 评审思维链（Chain Review）— 分析失败原因链路
 *   Layer 4: 智慧模型层（Wisdom Model）— 预测性优化建议
 *
 * 执行路径：
 *   1. Skill Cleaner 记录每次 skill 调用的成功/失败
 *   2. 累计 N 次同类失败 → 触发「标准演进层」更新审计规则
 *   3. 失败案例加入「复核判例库」供后续分析
 *   4. 定期生成「思维链分析报告」供开发者参考
 */

import {
  SkillEvolverConfig,
  SkillCaseReview,
  SkillContext,
  StandardEvolutionEntry,
  ChainOfThoughtEntry,
  WisdomPrediction,
  EvolutionChange,
  EvolutionResult,
  EvolutionCircuitType,
  EvolutionStatus,
} from './types.js';

export class SkillEvolver {
  private config: SkillEvolverConfig;

  /** 判例库 — Layer 1 数据 */
  private caseDatabase: SkillCaseReview[] = [];

  /** 标准演进记录 — Layer 2 数据 */
  private standards: StandardEvolutionEntry[] = [];

  /** 思维链分析记录 — Layer 3 数据 */
  private chainAnalyses: ChainOfThoughtEntry[] = [];

  /** 智慧预测记录 — Layer 4 数据 */
  private wisdomPredictions: WisdomPrediction[] = [];

  /** 按错误类型统计计数器 */
  private errorTypeCounts: Map<string, number> = new Map();

  constructor(config: SkillEvolverConfig) {
    this.config = config;
  }

  // ===========================================================================
  // Layer 1: 复核判例（Case Review）
  // 收集使用案例，识别失败模式
  // ===========================================================================

  /**
   * 记录一次 Skill 执行案例
   * Record a skill execution case for review
   *
   * @param caseReview - 执行案例详情
   */
  recordCaseReview(caseReview: SkillCaseReview): void {
    this.caseDatabase.push(caseReview);

    // 维护案例窗口（仅保留最近 N 条）
    if (this.caseDatabase.length > this.config.caseWindow) {
      this.caseDatabase.shift();
    }

    // 更新错误类型计数
    if (!caseReview.success && caseReview.errorType) {
      const key = caseReview.errorType;
      this.errorTypeCounts.set(key, (this.errorTypeCounts.get(key) ?? 0) + 1);
    }
  }

  /**
   * 批量记录案例
   * Batch record case reviews
   *
   * @param cases - 案例数组
   */
  recordCaseReviews(cases: SkillCaseReview[]): void {
    for (const c of cases) {
      this.recordCaseReview(c);
    }
  }

  /**
   * 获取判例库
   * Get the case review database
   */
  getCaseDatabase(): SkillCaseReview[] {
    return [...this.caseDatabase];
  }

  // ===========================================================================
  // Layer 2: 标准演进层（Standard Evolution）
  // 基于失败案例触发规则更新
  // ===========================================================================

  /**
   * 检查是否需要触发标准演进
   * Check if standard evolution should be triggered
   *
   * @param errorType - 错误类型
   * @returns 是否超过阈值
   */
  shouldEvolveStandard(errorType: string): boolean {
    const count = this.errorTypeCounts.get(errorType) ?? 0;
    return count >= this.config.standardThreshold;
  }

  /**
   * 获取当前标准演进记录
   * Get current standard evolution entries
   */
  getStandards(): StandardEvolutionEntry[] {
    return [...this.standards];
  }

  // ===========================================================================
  // Layer 3: 评审思维链（Chain Review）
  // 分析失败原因链路
  // ===========================================================================

  /**
   * 获取思维链分析记录
   * Get chain-of-thought analyses
   */
  getChainAnalyses(): ChainOfThoughtEntry[] {
    return [...this.chainAnalyses];
  }

  // ===========================================================================
  // Layer 4: 智慧模型层（Wisdom Model）
  // 预测性优化建议
  // ===========================================================================

  /**
   * 获取智慧预测记录
   * Get wisdom predictions
   */
  getWisdomPredictions(): WisdomPrediction[] {
    return [...this.wisdomPredictions];
  }

  // ===========================================================================
  // 主进化方法
  // ===========================================================================

  /**
   * 运行四层递进式反馈进化
   * Run the four-layer progressive feedback evolution
   *
   * @param skillContext - 技能进化上下文
   * @returns 进化结果
   */
  async evolve(skillContext: SkillContext): Promise<EvolutionResult> {
    const startedAt = Date.now();
    const allChanges: EvolutionChange[] = [];

    // Layer 1: 复核判例 — 收集和分析失败模式
    const layer1Changes = this.layer1CaseReview(skillContext);
    allChanges.push(...layer1Changes);

    // Layer 2: 标准演进 — 基于案例更新审计规则
    const layer2Changes = this.layer2StandardEvolution(skillContext);
    allChanges.push(...layer2Changes);

    // Layer 3: 评审思维链 — 分析失败原因链路
    const layer3Changes = this.layer3ChainReview(skillContext);
    allChanges.push(...layer3Changes);

    // Layer 4: 智慧模型层 — 预测性优化建议
    const layer4Changes = this.layer4WisdomModel(skillContext);
    allChanges.push(...layer4Changes);

    return {
      circuit: EvolutionCircuitType.SKILL,
      status: EvolutionStatus.COMPLETED,
      changes: allChanges,
      metrics: {
        before: { caseCount: this.caseDatabase.length - allChanges.length },
        after: { caseCount: this.caseDatabase.length },
        improvement: { newStandards: layer2Changes.length },
      },
      startedAt,
      completedAt: Date.now(),
      version: skillContext.version ?? '1.0.0',
    };
  }

  // ===========================================================================
  // 私有方法 — 四层实现
  // ===========================================================================

  /**
   * Layer 1: 复核判例（Case Review）
   * 收集使用失败案例，识别错误模式
   */
  private layer1CaseReview(skillContext: SkillContext): EvolutionChange[] {
    const changes: EvolutionChange[] = [];

    // 分析最近案例中的失败模式
    const recentCases = this.caseDatabase.slice(-this.config.caseWindow);
    const failedCases = recentCases.filter((c) => !c.success);

    if (failedCases.length === 0) return changes;

    // 按错误类型分组
    const failuresByType = new Map<string, SkillCaseReview[]>();
    for (const c of failedCases) {
      const type = c.errorType ?? 'unknown';
      const list = failuresByType.get(type) ?? [];
      list.push(c);
      failuresByType.set(type, list);
    }

    // 为每种错误类型生成变更建议
    for (const [errorType, cases] of failuresByType.entries()) {
      const failureRate = cases.length / recentCases.length;

      changes.push({
        id: `skill-case-${Date.now()}-${errorType}`,
        type: 'rule',
        target: `skill.caseReview.${errorType}`,
        oldValue: failureRate,
        newValue: 'flagged',
        confidence: Math.min(failureRate * 2, 1), // 置信度随失败率增加
        reason: `Detected ${errorType} failure pattern: ${cases.length} failures in last ${recentCases.length} cases (${(failureRate * 100).toFixed(1)}%)`,
        rollbackable: true,
      });
    }

    return changes;
  }

  /**
   * Layer 2: 标准演进层（Standard Evolution）
   * 基于累计同类错误触发规则更新
   */
  private layer2StandardEvolution(skillContext: SkillContext): EvolutionChange[] {
    const changes: EvolutionChange[] = [];

    // 检查每种错误类型是否超过演进阈值
    for (const [errorType, count] of this.errorTypeCounts.entries()) {
      if (count >= this.config.standardThreshold) {
        // 生成新的标准演进条目
        const newStandard: StandardEvolutionEntry = {
          id: `std-${Date.now()}-${errorType}`,
          errorType: errorType as SkillCaseReview['errorType'],
          triggerCount: count,
          threshold: this.config.standardThreshold,
          newRule: `Auto-generated rule for ${errorType} errors after ${count} occurrences`,
          createdAt: Date.now(),
        };
        this.standards.push(newStandard);

        changes.push({
          id: `skill-std-${Date.now()}-${errorType}`,
          type: 'rule',
          target: `skill.standard.${errorType}`,
          oldValue: `threshold=${this.config.standardThreshold}`,
          newValue: `rule_applied_after_${count}_errors`,
          confidence: Math.min(count / (this.config.standardThreshold * 2), 1),
          reason: `Standard evolved: ${count} ${errorType} errors exceeded threshold ${this.config.standardThreshold}`,
          rollbackable: true,
        });

        // 重置计数器（标准已演进，重新计数）
        this.errorTypeCounts.set(errorType, 0);
      }
    }

    return changes;
  }

  /**
   * Layer 3: 评审思维链（Chain Review）
   * 分析失败原因链路，生成思维链分析报告
   */
  private layer3ChainReview(skillContext: SkillContext): EvolutionChange[] {
    const changes: EvolutionChange[] = [];

    // 获取失败案例用于思维链分析
    const failedCases = this.caseDatabase.filter((c) => !c.success);
    if (failedCases.length === 0) return changes;

    // 构建思维链：按时间排序分析关联的失败案例
    const sortedCases = [...failedCases].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // 按思维链深度分组分析
    const chainDepth = this.config.chainDepth;
    for (let depth = 1; depth <= chainDepth; depth++) {
      // 在每层深度分析不同的关联模式
      const segmentSize = Math.max(1, Math.floor(sortedCases.length / depth));
      const segment = sortedCases.slice(0, segmentSize);

      if (segment.length === 0) continue;

      // 提取该层深度的错误类型链
      const errorChain = segment
        .map((c) => c.errorType ?? 'unknown')
        .join(' → ');

      const chainEntry: ChainOfThoughtEntry = {
        id: `chain-${Date.now()}-d${depth}`,
        depth,
        errorChain,
        caseIds: segment.map((c) => c.skillId),
        analysis: `Depth-${depth} analysis: ${segment.length} related failures forming chain: ${errorChain}`,
        createdAt: Date.now(),
      };
      this.chainAnalyses.push(chainEntry);

      changes.push({
        id: `skill-chain-${Date.now()}-d${depth}`,
        type: 'structure',
        target: `skill.chainOfThought.depth${depth}`,
        oldValue: null,
        newValue: errorChain,
        confidence: 0.7 + depth * 0.05, // 更深层分析置信度略高
        rollbackable: false,
      });
    }

    return changes;
  }

  /**
   * Layer 4: 智慧模型层（Wisdom Model）
   * 基于历史数据生成预测性优化建议
   */
  private layer4WisdomModel(skillContext: SkillContext): EvolutionChange[] {
    const changes: EvolutionChange[] = [];

    // 统计成功/失败比
    const totalCases = this.caseDatabase.length;
    if (totalCases < 10) return changes; // 数据不足，不生成预测

    const successCount = this.caseDatabase.filter((c) => c.success).length;
    const successRate = successCount / totalCases;

    // 基于趋势生成预测建议
    const recentWindow = Math.min(50, totalCases);
    const recentCases = this.caseDatabase.slice(-recentWindow);
    const recentSuccessCount = recentCases.filter((c) => c.success).length;
    const recentSuccessRate = recentSuccessCount / recentWindow;

    // 检测趋势变化
    const trendDelta = recentSuccessRate - successRate;

    // 趋势下降 → 生成预警
    if (trendDelta < -0.1) {
      const prediction: WisdomPrediction = {
        id: `wisdom-${Date.now()}`,
        type: 'warning',
        description: `Success rate declining: recent ${(recentSuccessRate * 100).toFixed(1)}% vs overall ${(successRate * 100).toFixed(1)}% (Δ=${(trendDelta * 100).toFixed(1)}%)`,
        confidence: Math.min(Math.abs(trendDelta) * 5, 1),
        suggestedActions: [
          'Review recent changes to skill configurations',
          'Check for environmental changes affecting skill execution',
          'Consider rolling back recent standard evolution changes',
        ],
        createdAt: Date.now(),
      };
      this.wisdomPredictions.push(prediction);

      changes.push({
        id: `skill-wisdom-${Date.now()}-warning`,
        type: 'weight',
        target: 'skill.wisdomModel.trend',
        oldValue: successRate,
        newValue: recentSuccessRate,
        confidence: prediction.confidence,
        reason: prediction.description,
        rollbackable: true,
      });
    }

    // 趋势上升 → 记录正面信号
    if (trendDelta > 0.1) {
      const prediction: WisdomPrediction = {
        id: `wisdom-${Date.now()}`,
        type: 'improvement',
        description: `Success rate improving: recent ${(recentSuccessRate * 100).toFixed(1)}% vs overall ${(successRate * 100).toFixed(1)}% (Δ=+${(trendDelta * 100).toFixed(1)}%)`,
        confidence: Math.min(trendDelta * 5, 1),
        suggestedActions: [
          'Current evolution strategy is effective',
          'Consider expanding successful patterns to other skills',
        ],
        createdAt: Date.now(),
      };
      this.wisdomPredictions.push(prediction);

      changes.push({
        id: `skill-wisdom-${Date.now()}-improvement`,
        type: 'weight',
        target: 'skill.wisdomModel.trend',
        oldValue: successRate,
        newValue: recentSuccessRate,
        confidence: prediction.confidence,
        reason: prediction.description,
        rollbackable: false,
      });
    }

    // 生成通用预测性建议
    const dominantErrorType = this.getDominantErrorType();
    if (dominantErrorType) {
      const prediction: WisdomPrediction = {
        id: `wisdom-${Date.now()}-predict`,
        type: 'prediction',
        description: `Predicted dominant error: ${dominantErrorType.errorType} (${dominantErrorType.count} occurrences)`,
        confidence: 0.6,
        suggestedActions: [
          `Proactively add validation for ${dominantErrorType.errorType} errors`,
          `Consider adding pre-execution checks for ${dominantErrorType.errorType} patterns`,
        ],
        createdAt: Date.now(),
      };
      this.wisdomPredictions.push(prediction);
    }

    return changes;
  }

  /**
   * 获取主要错误类型
   * Get the dominant error type from case database
   */
  private getDominantErrorType(): { errorType: string; count: number } | null {
    let maxType: string | null = null;
    let maxCount = 0;

    for (const [errorType, count] of this.errorTypeCounts.entries()) {
      if (count > maxCount) {
        maxType = errorType;
        maxCount = count;
      }
    }

    return maxType ? { errorType: maxType, count: maxCount } : null;
  }

  // ===========================================================================
  // 公共辅助方法
  // ===========================================================================

  /**
   * 获取案例统计
   * Get case statistics
   */
  getStats(): {
    totalCases: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    errorTypeDistribution: Record<string, number>;
    standardsCount: number;
    chainAnalysesCount: number;
    wisdomPredictionsCount: number;
  } {
    const total = this.caseDatabase.length;
    const successCount = this.caseDatabase.filter((c) => c.success).length;
    const failureCount = total - successCount;

    const errorTypeDistribution: Record<string, number> = {};
    for (const [type, count] of this.errorTypeCounts.entries()) {
      errorTypeDistribution[type] = count;
    }

    return {
      totalCases: total,
      successCount,
      failureCount,
      successRate: total > 0 ? successCount / total : 0,
      errorTypeDistribution,
      standardsCount: this.standards.length,
      chainAnalysesCount: this.chainAnalyses.length,
      wisdomPredictionsCount: this.wisdomPredictions.length,
    };
  }

  /**
   * 应用进化变更
   * Apply evolution changes
   *
   * @param changes - 进化变更列表
   */
  applyChanges(changes: EvolutionChange[]): void {
    for (const change of changes) {
      console.log(
        `[SkillEvolver] Applying change: ${change.target}: ${JSON.stringify(change.oldValue)} -> ${JSON.stringify(change.newValue)}`
      );
    }
  }
}
