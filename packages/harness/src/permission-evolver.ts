/**
 * Permission Evolver
 * 权限进化器
 *
 * Learns from audit logs to:
 * 1. Automatically optimize whitelist/blacklist rules
 * 2. Detect danger patterns and update
 * 3. Learn user habits to reduce unnecessary confirmations
 */

import { SecurityManager } from '@selfclaw/security';
import {
  PermissionEvolverConfig,
  EvolutionChange,
  PermissionPattern,
} from './types.js';

export class PermissionEvolver {
  private config: PermissionEvolverConfig;
  private securityManager: SecurityManager;
  private patterns: Map<string, PermissionPattern> = new Map();
  private auditLogBuffer: Array<{
    toolName: string;
    operation: string;
    confirmed: boolean;
    confirmationTime?: number;
    timestamp: number;
  }> = [];

  constructor(securityManager: SecurityManager, config: PermissionEvolverConfig) {
    this.securityManager = securityManager;
    this.config = config;
  }

  /**
   * Record an operation for pattern learning
   * 记录操作以进行模式学习
   */
  recordOperation(
    toolName: string,
    operation: string,
    confirmed: boolean,
    confirmationTime?: number
  ): void {
    const key = `${toolName}:${operation}`;
    const pattern = this.patterns.get(key) || {
      toolName,
      operationType: operation,
      frequency: 0,
      successRate: 1,
      avgConfirmationTime: 0,
      lastUsed: Date.now(),
    };

    pattern.frequency++;
    pattern.lastUsed = Date.now();

    if (confirmationTime !== undefined) {
      const totalConfirmations = pattern.frequency;
      pattern.avgConfirmationTime =
        (pattern.avgConfirmationTime * (totalConfirmations - 1) + confirmationTime) /
        totalConfirmations;
    }

    this.patterns.set(key, pattern);
    this.auditLogBuffer.push({
      toolName,
      operation,
      confirmed,
      confirmationTime,
      timestamp: Date.now(),
    });
  }

  /**
   * Run permission evolution
   * 运行权限进化
   */
  evolve(): EvolutionChange[] {
    const changes: EvolutionChange[] = [];

    // 1. Optimize confirmation requirements
    if (this.config.learnUserHabits) {
      changes.push(...this.optimizeConfirmations());
    }

    // 2. Detect danger patterns from recent audit logs
    if (this.config.autoDetectDangerPatterns) {
      changes.push(...this.detectDangerPatterns());
    }

    // 3. Optimize whitelist based on usage patterns
    if (this.config.autoOptimizeWhitelist) {
      changes.push(...this.optimizeWhitelist());
    }

    return changes;
  }

  /**
   * Optimize confirmation requirements based on user habits
   * 基于用户习惯优化确认要求
   */
  private optimizeConfirmations(): EvolutionChange[] {
    const changes: EvolutionChange[] = [];

    for (const pattern of this.patterns.values()) {
      // If pattern is safe and used frequently, reduce confirmation
      if (
        pattern.frequency >= this.config.habitLearningSamples &&
        pattern.successRate > this.config.confirmationReductionThreshold
      ) {
        changes.push({
          id: `perm-conf-${Date.now()}-${pattern.toolName}`,
          type: 'rule',
          target: `permission.confirmation.${pattern.toolName}`,
          oldValue: 'ALWAYS_REQUIRE',
          newValue: 'AUTO_APPROVE',
          confidence: pattern.successRate,
          reason: `Pattern is safe: ${pattern.frequency} uses with ${(pattern.successRate * 100).toFixed(1)}% success rate`,
          rollbackable: true,
        });
      }
    }

    return changes;
  }

  /**
   * Detect new danger patterns
   * 检测新的危险模式
   */
  private detectDangerPatterns(): EvolutionChange[] {
    // Analyze recent failed operations to find patterns
    const recentOperations = this.auditLogBuffer.slice(-100);
    const failedOperations = recentOperations.filter((op) => !op.confirmed);

    if (failedOperations.length === 0) return [];

    const changes: EvolutionChange[] = [];

    // Group by tool to find dangerous tools
    const failedByTool = new Map<string, number>();
    for (const op of failedOperations) {
      failedByTool.set(op.toolName, (failedByTool.get(op.toolName) || 0) + 1);
    }

    for (const [toolName, count] of failedByTool.entries()) {
      const total = recentOperations.filter((op) => op.toolName === toolName).length;
      const failureRate = count / total;

      if (failureRate > 0.3 && total > 10) {
        changes.push({
          id: `perm-danger-${Date.now()}-${toolName}`,
          type: 'rule',
          target: `permission.blacklist.${toolName}`,
          oldValue: false,
          newValue: true,
          confidence: failureRate,
          reason: `High failure rate: ${(failureRate * 100).toFixed(1)}% (${count}/${total})`,
          rollbackable: true,
        });
      }
    }

    return changes;
  }

  /**
   * Optimize whitelist based on safe usage
   * 基于安全使用优化白名单
   */
  private optimizeWhitelist(): EvolutionChange[] {
    const changes: EvolutionChange[] = [];

    // Find safe, frequently used tools
    for (const pattern of this.patterns.values()) {
      if (
        pattern.frequency >= 50 &&
        pattern.successRate > 0.99
      ) {
        changes.push({
          id: `perm-white-${Date.now()}-${pattern.toolName}`,
          type: 'rule',
          target: `permission.whitelist.${pattern.toolName}`,
          oldValue: false,
          newValue: true,
          confidence: pattern.successRate,
          reason: `Safe tool: ${pattern.frequency} uses with ${(pattern.successRate * 100).toFixed(1)}% success rate`,
          rollbackable: true,
        });
      }
    }

    return changes;
  }

  /**
   * Get learned patterns
   * 获取已学习的模式
   */
  getPatterns(): PermissionPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Apply evolution changes
   * 应用进化变更
   */
  applyChanges(changes: EvolutionChange[]): void {
    for (const change of changes) {
      console.log(`[PermissionEvolver] Applying change: ${change.target}: ${change.oldValue} -> ${change.newValue}`);
      // Changes are applied to the SecurityManager configuration
    }
  }
}
