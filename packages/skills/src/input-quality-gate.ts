/**
 * Input Quality Gate - 上下文质量前置门禁
 * 
 * P1-1: Context Engineering 集成
 * 
 * 设计灵感：
 * 1. ProofAgent论文：Agent失败主因是上下文质量，而非模型能力
 *    - 7维度上下文质量评分体系
 *    - Context Engineering将成为后模型时代核心能力
 * 2. Harness上下文压缩：历史持久化 + 自动压缩机制
 * 3. Cursor 2.4 Skills：高质量上下文是技能执行的前提
 * 
 * SelfClaw定位：
 * InputQualityGate是Skill执行前的质量门禁，在SkillCleaner的7维度评分基础上：
 * - 提供可配置的质量阈值和自动拒绝策略
 * - 支持上下文压缩和增强建议
 * - 追踪质量趋势，识别系统性质量问题
 * - 与SkillCleaner协作，形成完整的质量保障链路
 * 
 * 质量门禁流程：
 * Input → [QualityGate] → (通过) → Skill执行 → [SkillCleaner] → Output
 *                     ↘ (不通过) → 压缩/增强/拒绝
 */

import { EventEmitter } from 'eventemitter3';
import {
  SkillCleaner,
  type ContextQualityScore,
  type ContextQualityDimension,
  type InputValidationResult,
} from './skill-cleaner.js';

// ==================== 类型定义 ====================

/**
 * 质量门禁配置
 */
export interface QualityGateConfig {
  /** 各维度最低分数阈值（0-10），低于此分数触发干预 */
  dimensionThresholds: Partial<Record<ContextQualityDimension, number>>;
  /** 总体质量最低分数（0-100），低于此分数自动拒绝 */
  minimumOverallScore: number;
  /** 是否启用自动压缩（当输入过长时） */
  enableAutoCompression: boolean;
  /** 自动压缩阈值（字符数） */
  compressionThreshold: number;
  /** 压缩目标比例（0-1），如0.6表示压缩到原来的60% */
  compressionTargetRatio: number;
  /** 是否启用质量增强建议 */
  enableEnhancementSuggestions: boolean;
  /** 是否追踪质量趋势 */
  enableTrendTracking: boolean;
  /** 趋势追踪窗口大小 */
  trendWindowSize: number;
  /** 自动拒绝策略 */
  rejectionPolicy: RejectionPolicy;
}

/**
 * 拒绝策略
 */
export interface RejectionPolicy {
  /** 是否自动拒绝低于阈值的输入 */
  autoReject: boolean;
  /** 拒绝时是否尝试自动修复 */
  attemptAutoFix: boolean;
  /** 最大自动修复次数 */
  maxAutoFixAttempts: number;
  /** 拒绝后是否发送通知 */
  notifyOnReject: boolean;
}

/**
 * 质量门禁结果
 */
export interface QualityGateResult {
  /** 是否通过门禁 */
  passed: boolean;
  /** 门禁动作 */
  action: QualityGateAction;
  /** 各维度评分 */
  scores: ContextQualityScore[];
  /** 总体质量分数 */
  overallScore: number;
  /** 质量增强建议 */
  suggestions: QualityEnhancement[];
  /** 压缩后的输入（如果执行了压缩） */
  compressedInput?: string;
  /** 自动修复后的输入（如果执行了修复） */
  fixedInput?: string;
  /** 门禁执行时间（ms） */
  gateLatencyMs: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 门禁动作
 */
export type QualityGateAction =
  | 'pass'           // 通过，质量达标
  | 'pass_with_warn' // 通过但警告
  | 'compress'       // 压缩后通过
  | 'fix_and_pass'   // 修复后通过
  | 'reject';        // 拒绝

/**
 * 质量增强建议
 */
export interface QualityEnhancement {
  /** 目标维度 */
  dimension: ContextQualityDimension;
  /** 当前分数 */
  currentScore: number;
  /** 建议动作 */
  action: EnhancementAction;
  /** 建议描述 */
  description: string;
  /** 自动修复脚本（可选） */
  autoFixScript?: string;
}

/**
 * 增强动作类型
 */
export type EnhancementAction =
  | 'add_clarity'        // 添加明确指令
  | 'add_context'        // 补充上下文
  | 'remove_noise'       // 移除无关信息
  | 'resolve_conflict'   // 解决矛盾
  | 'add_specifics'      // 添加具体细节
  | 'update_timestamp'   // 更新时间信息
  | 'add_source'         // 添加来源引用
  | 'compress';          // 压缩内容

/**
 * 质量趋势数据点
 */
export interface QualityTrendPoint {
  /** 时间戳 */
  timestamp: number;
  /** 总体分数 */
  overallScore: number;
  /** 各维度分数 */
  dimensionScores: Record<ContextQualityDimension, number>;
  /** 输入来源标识 */
  source?: string;
}

/**
 * 质量趋势分析
 */
export interface QualityTrendAnalysis {
  /** 趋势方向 */
  direction: 'improving' | 'stable' | 'declining';
  /** 趋势斜率（正=改善，负=下降） */
  slope: number;
  /** 平均分数 */
  averageScore: number;
  /** 最弱维度 */
  weakestDimension: ContextQualityDimension;
  /** 建议改进方向 */
  recommendations: string[];
}

/**
 * 质量门禁事件
 */
export interface QualityGateEvents {
  'gate.passed': [result: QualityGateResult];
  'gate.rejected': [result: QualityGateResult];
  'gate.compressed': [originalLength: number, compressedLength: number];
  'gate.fixed': [fixType: string, fixedInput: string];
  'trend.updated': [analysis: QualityTrendAnalysis];
  'threshold.violated': [dimension: ContextQualityDimension, score: number, threshold: number];
}

// ==================== 默认配置 ====================

const DEFAULT_DIMENSION_THRESHOLDS: Partial<Record<ContextQualityDimension, number>> = {
  clarity: 5,
  completeness: 4,
  relevance: 5,
  consistency: 6,
  specificity: 4,
  timeliness: 3,
  trustworthiness: 4,
};

const DEFAULT_CONFIG: QualityGateConfig = {
  dimensionThresholds: DEFAULT_DIMENSION_THRESHOLDS,
  minimumOverallScore: 50,
  enableAutoCompression: true,
  compressionThreshold: 8000,
  compressionTargetRatio: 0.6,
  enableEnhancementSuggestions: true,
  enableTrendTracking: true,
  trendWindowSize: 20,
  rejectionPolicy: {
    autoReject: true,
    attemptAutoFix: true,
    maxAutoFixAttempts: 2,
    notifyOnReject: true,
  },
};

// ==================== Input Quality Gate 主类 ====================

/**
 * Input Quality Gate - 上下文质量前置门禁
 * 
 * 核心功能：
 * 1. 质量门禁：在Skill执行前检查输入质量
 * 2. 自动压缩：对过长输入进行智能压缩
 * 3. 自动修复：对低质量输入尝试自动修复
 * 4. 趋势追踪：追踪质量变化趋势
 * 5. 增强建议：提供具体的质量改进建议
 */
export class InputQualityGate extends EventEmitter<QualityGateEvents> {
  private config: QualityGateConfig;
  private cleaner: SkillCleaner;
  
  /** 质量趋势历史 */
  private trendHistory: QualityTrendPoint[] = [];
  
  /** 统计信息 */
  private stats = {
    totalChecks: 0,
    passed: 0,
    rejected: 0,
    compressed: 0,
    fixed: 0,
  };

  constructor(config: Partial<QualityGateConfig> = {}, cleaner?: SkillCleaner) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      dimensionThresholds: { ...DEFAULT_DIMENSION_THRESHOLDS, ...config.dimensionThresholds },
      rejectionPolicy: { ...DEFAULT_CONFIG.rejectionPolicy, ...config.rejectionPolicy },
    };
    this.cleaner = cleaner ?? new SkillCleaner({
      enableInputValidation: false,  // 输入验证由Gate自己做
      enableOutputAudit: false,      // 输出审计不在Gate职责内
      enableContextScoring: true,
      enableBehaviorDetection: false,
    });
  }

  // ===========================================================================
  // 核心门禁检查
  // ===========================================================================

  /**
   * 执行质量门禁检查
   * 
   * 流程：
   * 1. 评估输入质量（7维度评分）
   * 2. 检查各维度是否达标
   * 3. 如果过低 → 尝试自动压缩/修复
   * 4. 生成增强建议
   * 5. 更新趋势追踪
   * 
   * @param input - 待检查的输入内容
   * @param context - 可选的上下文信息
   * @param source - 输入来源标识（用于趋势追踪）
   * @returns 门禁检查结果
   */
  async check(
    input: string,
    context?: Record<string, unknown>,
    source?: string
  ): Promise<QualityGateResult> {
    const startTime = Date.now();
    this.stats.totalChecks++;

    // 1. 评估输入质量
    const validationResult = await this.cleaner.validateInput(input, context);
    const scores = validationResult.contextScores ?? [];
    const overallScore = validationResult.overallQualityScore ?? 0;

    // 2. 检查各维度阈值
    const violations = this.checkDimensionThresholds(scores);
    
    // 3. 通知阈值违规
    for (const { dimension, score, threshold } of violations) {
      this.emit('threshold.violated', dimension, score, threshold);
    }

    // 4. 生成增强建议
    const suggestions = this.config.enableEnhancementSuggestions
      ? this.generateEnhancementSuggestions(scores, violations)
      : [];

    // 5. 判断门禁动作
    let action: QualityGateAction;
    let compressedInput: string | undefined;
    let fixedInput: string | undefined;

    if (overallScore >= this.config.minimumOverallScore && violations.length === 0) {
      // 质量达标，直接通过
      action = 'pass';
      this.stats.passed++;
    } else if (overallScore >= this.config.minimumOverallScore * 0.8 && violations.length <= 2) {
      // 质量基本达标，有轻微问题 → 通过但警告
      action = 'pass_with_warn';
      this.stats.passed++;
    } else if (this.config.enableAutoCompression && input.length > this.config.compressionThreshold) {
      // 输入过长，尝试压缩
      compressedInput = this.compressInput(input, this.config.compressionTargetRatio);
      action = 'compress';
      this.stats.compressed++;
      this.stats.passed++;
      this.emit('gate.compressed', input.length, compressedInput.length);
    } else if (this.config.rejectionPolicy.attemptAutoFix && violations.length > 0) {
      // 尝试自动修复
      const fixResult = await this.attemptAutoFix(input, violations, context);
      if (fixResult.fixed) {
        fixedInput = fixResult.fixedInput;
        action = 'fix_and_pass';
        this.stats.fixed++;
        this.stats.passed++;
        this.emit('gate.fixed', fixResult.fixType, fixedInput);
      } else if (this.config.rejectionPolicy.autoReject) {
        action = 'reject';
        this.stats.rejected++;
      } else {
        action = 'pass_with_warn';
        this.stats.passed++;
      }
    } else if (this.config.rejectionPolicy.autoReject) {
      action = 'reject';
      this.stats.rejected++;
    } else {
      action = 'pass_with_warn';
      this.stats.passed++;
    }

    // 6. 更新趋势追踪
    if (this.config.enableTrendTracking) {
      this.updateTrend(scores, overallScore, source);
    }

    const result: QualityGateResult = {
      passed: action !== 'reject',
      action,
      scores,
      overallScore,
      suggestions,
      compressedInput,
      fixedInput,
      gateLatencyMs: Date.now() - startTime,
      timestamp: Date.now(),
    };

    // 7. 发送事件
    if (result.passed) {
      this.emit('gate.passed', result);
    } else {
      this.emit('gate.rejected', result);
    }

    return result;
  }

  // ===========================================================================
  // 维度阈值检查
  // ===========================================================================

  /**
   * 检查各维度是否达到阈值
   */
  private checkDimensionThresholds(
    scores: ContextQualityScore[]
  ): Array<{ dimension: ContextQualityDimension; score: number; threshold: number }> {
    const violations: Array<{ dimension: ContextQualityDimension; score: number; threshold: number }> = [];

    for (const score of scores) {
      const threshold = this.config.dimensionThresholds[score.dimension];
      if (threshold !== undefined && score.score < threshold) {
        violations.push({
          dimension: score.dimension,
          score: score.score,
          threshold,
        });
      }
    }

    return violations;
  }

  // ===========================================================================
  // 增强建议生成
  // ===========================================================================

  /**
   * 生成质量增强建议
   */
  private generateEnhancementSuggestions(
    scores: ContextQualityScore[],
    violations: Array<{ dimension: ContextQualityDimension; score: number; threshold: number }>
  ): QualityEnhancement[] {
    const suggestions: QualityEnhancement[] = [];

    // 从评分结果中提取建议
    for (const score of scores) {
      if (score.suggestions && score.suggestions.length > 0) {
        suggestions.push({
          dimension: score.dimension,
          currentScore: score.score,
          action: this.dimensionToAction(score.dimension),
          description: score.suggestions.join('; '),
        });
      }
    }

    // 为违规维度添加额外建议
    for (const violation of violations) {
      const existingSuggestion = suggestions.find(s => s.dimension === violation.dimension);
      if (!existingSuggestion) {
        suggestions.push({
          dimension: violation.dimension,
          currentScore: violation.score,
          action: this.dimensionToAction(violation.dimension),
          description: `${violation.dimension}分数(${violation.score})低于阈值(${violation.threshold})，需要改进`,
        });
      }
    }

    return suggestions;
  }

  /**
   * 维度到增强动作的映射
   */
  private dimensionToAction(dimension: ContextQualityDimension): EnhancementAction {
    const mapping: Record<ContextQualityDimension, EnhancementAction> = {
      clarity: 'add_clarity',
      completeness: 'add_context',
      relevance: 'remove_noise',
      consistency: 'resolve_conflict',
      specificity: 'add_specifics',
      timeliness: 'update_timestamp',
      trustworthiness: 'add_source',
    };
    return mapping[dimension];
  }

  // ===========================================================================
  // 自动压缩
  // ===========================================================================

  /**
   * 智能压缩输入
   * 
   * 压缩策略：
   * 1. 移除重复内容
   * 2. 移除无关信息
   * 3. 缩短冗长句子
   * 4. 保留核心指令和关键数据
   * 
   * @param input - 原始输入
   * @param targetRatio - 目标压缩比例
   * @returns 压缩后的输入
   */
  private compressInput(input: string, targetRatio: number): string {
    const targetLength = Math.floor(input.length * targetRatio);
    let compressed = input;

    // 策略1：移除多余的空白和换行
    compressed = compressed.replace(/\n{3,}/g, '\n\n');
    compressed = compressed.replace(/ {2,}/g, ' ');

    // 策略2：移除HTML注释
    compressed = compressed.replace(/<!--[\s\S]*?-->/g, '');

    // 策略3：移除重复段落（简单的段落去重）
    const paragraphs = compressed.split('\n\n');
    const seen = new Set<string>();
    const uniqueParagraphs = paragraphs.filter(p => {
      const key = p.trim().toLowerCase();
      if (seen.has(key) || key.length === 0) return false;
      seen.add(key);
      return true;
    });
    compressed = uniqueParagraphs.join('\n\n');

    // 策略4：如果仍然过长，截断到目标长度
    if (compressed.length > targetLength) {
      compressed = compressed.substring(0, targetLength);
      // 确保在句子边界截断
      const lastPeriod = compressed.lastIndexOf('.');
      if (lastPeriod > targetLength * 0.8) {
        compressed = compressed.substring(0, lastPeriod + 1);
      }
    }

    return compressed;
  }

  // ===========================================================================
  // 自动修复
  // ===========================================================================

  /**
   * 尝试自动修复低质量输入
   * 
   * @param input - 原始输入
   * @param violations - 违规维度列表
   * @param context - 上下文信息
   * @returns 修复结果
   */
  private async attemptAutoFix(
    input: string,
    violations: Array<{ dimension: ContextQualityDimension; score: number; threshold: number }>,
    context?: Record<string, unknown>
  ): Promise<{ fixed: boolean; fixedInput?: string; fixType: string }> {
    let fixedInput = input;
    const fixTypes: string[] = [];

    for (const violation of violations) {
      switch (violation.dimension) {
        case 'clarity':
          // 尝试添加明确指令前缀
          if (!fixedInput.toLowerCase().includes('please') && 
              !fixedInput.toLowerCase().includes('create') &&
              !fixedInput.toLowerCase().includes('generate')) {
            fixedInput = `Please process the following: ${fixedInput}`;
            fixTypes.push('add_clarity_prefix');
          }
          break;

        case 'completeness':
          // 尝试补充缺失的上下文信息
          if (!context?.task_type) {
            fixedInput = `[Task: general_processing]\n${fixedInput}`;
            fixTypes.push('add_task_type');
          }
          break;

        case 'relevance':
          // 移除明显无关内容
          const irrelevantKeywords = ['weather', 'sports', 'entertainment', 'celebrity'];
          for (const keyword of irrelevantKeywords) {
            const regex = new RegExp(`[^.!?]*${keyword}[^.!?]*\\.?`, 'gi');
            fixedInput = fixedInput.replace(regex, '').trim();
          }
          fixTypes.push('remove_irrelevant');
          break;

        case 'specificity':
          // 不自动添加具体信息，这可能导致幻觉
          break;

        case 'timeliness':
          // 添加当前时间戳
          if (!context?.timestamp) {
            fixedInput = `[Timestamp: ${new Date().toISOString()}]\n${fixedInput}`;
            fixTypes.push('add_timestamp');
          }
          break;

        default:
          // 其他维度不自动修复
          break;
      }
    }

    if (fixTypes.length > 0) {
      return {
        fixed: true,
        fixedInput,
        fixType: fixTypes.join(','),
      };
    }

    return { fixed: false };
  }

  // ===========================================================================
  // 趋势追踪
  // ===========================================================================

  /**
   * 更新质量趋势
   */
  private updateTrend(
    scores: ContextQualityScore[],
    overallScore: number,
    source?: string
  ): void {
    const dimensionScores: Record<string, number> = {};
    for (const score of scores) {
      dimensionScores[score.dimension] = score.score;
    }

    this.trendHistory.push({
      timestamp: Date.now(),
      overallScore,
      dimensionScores: dimensionScores as Record<ContextQualityDimension, number>,
      source,
    });

    // 保持窗口大小
    if (this.trendHistory.length > this.config.trendWindowSize) {
      this.trendHistory = this.trendHistory.slice(-this.config.trendWindowSize);
    }

    // 分析趋势
    const analysis = this.analyzeTrend();
    if (analysis) {
      this.emit('trend.updated', analysis);
    }
  }

  /**
   * 分析质量趋势
   */
  analyzeTrend(): QualityTrendAnalysis | null {
    if (this.trendHistory.length < 3) return null;

    // 计算斜率（简单线性回归）
    const n = this.trendHistory.length;
    const xValues = this.trendHistory.map((_, i) => i);
    const yValues = this.trendHistory.map(p => p.overallScore);
    
    const xMean = xValues.reduce((a, b) => a + b, 0) / n;
    const yMean = yValues.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
      denominator += (xValues[i] - xMean) ** 2;
    }
    const slope = denominator === 0 ? 0 : numerator / denominator;

    // 确定趋势方向
    const direction: QualityTrendAnalysis['direction'] = 
      slope > 1 ? 'improving' : slope < -1 ? 'declining' : 'stable';

    // 找最弱维度
    const dimensionTotals: Record<string, number> = {};
    for (const point of this.trendHistory) {
      for (const [dim, score] of Object.entries(point.dimensionScores)) {
        dimensionTotals[dim] = (dimensionTotals[dim] ?? 0) + score;
      }
    }
    let weakestDimension: ContextQualityDimension = 'clarity';
    let lowestTotal = Infinity;
    for (const [dim, total] of Object.entries(dimensionTotals)) {
      if (total < lowestTotal) {
        lowestTotal = total;
        weakestDimension = dim as ContextQualityDimension;
      }
    }

    // 生成建议
    const recommendations: string[] = [];
    if (direction === 'declining') {
      recommendations.push('输入质量持续下降，建议检查输入源质量');
    }
    if (weakestDimension === 'completeness') {
      recommendations.push('完整性持续偏低，建议在输入模板中增加必填字段');
    } else if (weakestDimension === 'clarity') {
      recommendations.push('清晰度偏低，建议优化输入指令的表述方式');
    } else if (weakestDimension === 'trustworthiness') {
      recommendations.push('可信度偏低，建议增加来源引用和验证机制');
    }

    return {
      direction,
      slope,
      averageScore: yMean,
      weakestDimension,
      recommendations,
    };
  }

  // ===========================================================================
  // 统计与监控
  // ===========================================================================

  /**
   * 获取统计信息
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * 获取趋势历史
   */
  getTrendHistory(): QualityTrendPoint[] {
    return [...this.trendHistory];
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      totalChecks: 0,
      passed: 0,
      rejected: 0,
      compressed: 0,
      fixed: 0,
    };
    this.trendHistory = [];
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<QualityGateConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      dimensionThresholds: { ...this.config.dimensionThresholds, ...config.dimensionThresholds },
      rejectionPolicy: { ...this.config.rejectionPolicy, ...config.rejectionPolicy },
    };
  }
}

// ==================== 导出 ====================

export default InputQualityGate;
