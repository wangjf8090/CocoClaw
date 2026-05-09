/**
 * Layer 4: YOLO Classifier (Simplified)
 * 第4层：危险模式分类器（简化版）
 * 
 * - 基于规则的危险操作分类
 * - 正则表达式模式匹配
 * - 风险等级评估
 */

import {
  Operation,
  SecurityDecision,
  DangerPattern,
  ClassifierResult,
  SecurityLevel,
  DANGER_PATTERNS,
} from './types.js';

export class DangerClassifierLayer {
  private patterns: DangerPattern[];

  constructor(customPatterns?: DangerPattern[]) {
    this.patterns = customPatterns || [...DANGER_PATTERNS];
  }

  /**
   * 检查操作
   */
  check(operation: Operation): SecurityDecision {
    const content = operation.content || operation.target || '';
    const result = this.classify(content);

    if (result.isDangerous) {
      return {
        allowed: result.level !== 'critical',
        level: result.level,
        score: result.score,
        reasons: result.matchedPatterns.map(p => `${p.id}: ${p.description}`),
        layer: 'danger-classifier',
        requiresConfirmation: result.level === 'high' || result.level === 'medium',
        blockingLayer: result.level === 'critical' ? 'danger-classifier' : undefined,
      };
    }

    return {
      allowed: true,
      level: 'safe',
      score: 0,
      reasons: ['未匹配到危险模式'],
      layer: 'danger-classifier',
      requiresConfirmation: false,
    };
  }

  /**
   * 对内容进行分类
   */
  classify(content: string): ClassifierResult {
    const matchedPatterns: DangerPattern[] = [];
    const reasons: string[] = [];
    let maxScore = 0;

    for (const pattern of this.patterns) {
      if (this.matchesPattern(content, pattern)) {
        matchedPatterns.push(pattern);
        reasons.push(`[${pattern.category}] ${pattern.description}`);
        
        // 计算分数
        const score = this.levelToScore(pattern.level);
        if (score > maxScore) {
          maxScore = score;
        }
      }
    }

    // 确定最高风险级别
    const level = this.determineHighestLevel(matchedPatterns);

    return {
      isDangerous: matchedPatterns.length > 0,
      level,
      score: maxScore,
      matchedPatterns,
      reasons,
    };
  }

  /**
   * 检查内容是否匹配模式
   */
  private matchesPattern(content: string, pattern: DangerPattern): boolean {
    if (pattern.pattern instanceof RegExp) {
      return pattern.pattern.test(content);
    }
    return content.toLowerCase().includes(pattern.pattern.toLowerCase());
  }

  /**
   * 级别转分数
   */
  private levelToScore(level: SecurityLevel): number {
    const scores: Record<SecurityLevel, number> = {
      safe: 0,
      low: 25,
      medium: 50,
      high: 75,
      critical: 100,
    };
    return scores[level];
  }

  /**
   * 确定最高风险级别
   */
  private determineHighestLevel(patterns: DangerPattern[]): SecurityLevel {
    if (patterns.length === 0) return 'safe';

    const hierarchy: SecurityLevel[] = ['critical', 'high', 'medium', 'low', 'safe'];
    
    for (const level of hierarchy) {
      if (patterns.some(p => p.level === level)) {
        return level;
      }
    }

    return 'safe';
  }

  /**
   * 添加危险模式
   */
  addPattern(pattern: DangerPattern): void {
    // 检查是否已存在
    const existing = this.patterns.find(p => p.id === pattern.id);
    if (existing) {
      // 更新现有模式
      Object.assign(existing, pattern);
    } else {
      this.patterns.push(pattern);
    }
  }

  /**
   * 批量添加模式
   */
  addPatterns(patterns: DangerPattern[]): void {
    for (const pattern of patterns) {
      this.addPattern(pattern);
    }
  }

  /**
   * 删除模式
   */
  removePattern(patternId: string): boolean {
    const index = this.patterns.findIndex(p => p.id === patternId);
    if (index !== -1) {
      this.patterns.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 获取所有模式
   */
  getAllPatterns(): DangerPattern[] {
    return [...this.patterns];
  }

  /**
   * 按类别获取模式
   */
  getPatternsByCategory(category: string): DangerPattern[] {
    return this.patterns.filter(p => p.category === category);
  }

  /**
   * 按级别获取模式
   */
  getPatternsByLevel(level: SecurityLevel): DangerPattern[] {
    return this.patterns.filter(p => p.level === level);
  }

  /**
   * 获取分类统计
   */
  getStats(): {
    total: number;
    byCategory: Record<string, number>;
    byLevel: Record<SecurityLevel, number>;
  } {
    const byCategory: Record<string, number> = {};
    const byLevel: Record<SecurityLevel, number> = {
      safe: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const pattern of this.patterns) {
      byCategory[pattern.category] = (byCategory[pattern.category] || 0) + 1;
      byLevel[pattern.level]++;
    }

    return {
      total: this.patterns.length,
      byCategory,
      byLevel,
    };
  }

  /**
   * 测试模式
   */
  testPattern(patternId: string, content: string): boolean {
    const pattern = this.patterns.find(p => p.id === patternId);
    if (!pattern) return false;
    return this.matchesPattern(content, pattern);
  }

  /**
   * 批量测试
   */
  batchTest(content: string): { patternId: string; matched: boolean; description: string }[] {
    return this.patterns.map(p => ({
      patternId: p.id,
      matched: this.matchesPattern(content, p),
      description: p.description,
    }));
  }

  /**
   * 生成分类报告
   */
  generateReport(content: string): string {
    const result = this.classify(content);

    let report = `=== 危险模式分类报告 ===\n\n`;
    report += `是否危险: ${result.isDangerous ? '是' : '否'}\n`;
    report += `风险级别: ${result.level}\n`;
    report += `风险分数: ${result.score}/100\n\n`;

    if (result.matchedPatterns.length > 0) {
      report += `匹配的模式 (${result.matchedPatterns.length}):\n`;
      for (const pattern of result.matchedPatterns) {
        report += `  - [${pattern.level}] ${pattern.id}: ${pattern.description} (${pattern.category})\n`;
      }
    } else {
      report += `未匹配到任何危险模式\n`;
    }

    const stats = this.getStats();
    report += `\n模式库统计:\n`;
    report += `  总数: ${stats.total}\n`;
    report += `  按类别: ${JSON.stringify(stats.byCategory, null, 2)}\n`;

    return report;
  }
}
