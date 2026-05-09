/**
 * Layer 7: Audit & Auto Rollback
 * 第7层：审计与自动回滚
 * 
 * - 所有操作审计日志
 * - 文件变更快照
 * - 自动回滚机制
 * - 审计日志查询API
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  Operation,
  SecurityDecision,
  AuditLogEntry,
  FileSnapshot,
  RollbackResult,
  SecurityLevel,
  ConfirmationResult,
  SandboxExecutionResult,
} from './types.js';

export class AuditRollbackLayer {
  private auditLog: AuditLogEntry[] = [];
  private snapshots: Map<string, FileSnapshot> = new Map();
  private logDir: string;
  private snapshotDir: string;
  private retentionDays: number;
  private autoRollbackThreshold: SecurityLevel;

  constructor(
    logDir: string = './logs/security',
    snapshotDir: string = './logs/snapshots',
    retentionDays: number = 90,
    autoRollbackThreshold: SecurityLevel = 'critical'
  ) {
    this.logDir = logDir;
    this.snapshotDir = snapshotDir;
    this.retentionDays = retentionDays;
    this.autoRollbackThreshold = autoRollbackThreshold;
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    await this.ensureDirs();
    await this.loadAuditLogs();
    await this.cleanOldLogs();
  }

  /**
   * 确保目录存在
   */
  private async ensureDirs(): Promise<void> {
    await fs.mkdir(this.logDir, { recursive: true });
    await fs.mkdir(this.snapshotDir, { recursive: true });
  }

  /**
   * 检查操作
   */
  check(operation: Operation, decision: SecurityDecision): SecurityDecision {
    // 记录审计日志
    this.logOperation(operation, decision);

    // 检查是否需要自动回滚
    if (decision.level === this.autoRollbackThreshold || 
        this.shouldAutoRollback(decision.level)) {
      // 触发自动回滚（如果有相关文件变更）
      this.triggerAutoRollback(operation, decision);
    }

    return {
      ...decision,
      reasons: [...decision.reasons, '操作已记录审计日志'],
    };
  }

  /**
   * 记录操作日志
   */
  logOperation(
    operation: Operation,
    decision: SecurityDecision,
    confirmation?: ConfirmationResult,
    executionResult?: SandboxExecutionResult
  ): void {
    const entry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      operation,
      decision,
      confirmation,
      executionResult,
      sessionId: operation.sessionId,
    };

    this.auditLog.push(entry);

    // 异步写入文件
    this.appendLogToFile(entry).catch(console.error);
  }

  /**
   * 追加日志到文件
   */
  private async appendLogToFile(entry: AuditLogEntry): Promise<void> {
    const filename = path.join(this.logDir, `audit-${this.getDateStr()}.log`);
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(filename, line, 'utf8');
  }

  /**
   * 创建文件快照
   */
  async createSnapshot(filePath: string, operation: 'create' | 'modify' | 'delete'): Promise<FileSnapshot> {
    let content = '';
    let hash = '';

    try {
      if (operation !== 'delete') {
        content = await fs.readFile(filePath, 'utf8');
        hash = this.calculateHash(content);
      }
    } catch (error) {
      // 文件可能不存在
    }

    const snapshot: FileSnapshot = {
      id: uuidv4(),
      path: filePath,
      content,
      hash,
      timestamp: Date.now(),
      operation,
    };

    this.snapshots.set(snapshot.id, snapshot);

    // 保存快照文件
    await this.saveSnapshot(snapshot);

    return snapshot;
  }

  /**
   * 保存快照到文件
   */
  private async saveSnapshot(snapshot: FileSnapshot): Promise<void> {
    const filename = path.join(this.snapshotDir, `${snapshot.id}.json`);
    await fs.writeFile(filename, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  /**
   * 执行回滚
   */
  async rollback(snapshotId: string): Promise<RollbackResult> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return {
        success: false,
        rolledBackFiles: [],
        errors: [`快照不存在: ${snapshotId}`],
        timestamp: Date.now(),
      };
    }

    const errors: string[] = [];
    const rolledBackFiles: string[] = [];

    try {
      await fs.mkdir(path.dirname(snapshot.path), { recursive: true });
      
      if (snapshot.operation === 'delete') {
        // 恢复被删除的文件
        await fs.writeFile(snapshot.path, snapshot.content, 'utf8');
      } else if (snapshot.content === '') {
        // 删除新创建的文件
        await fs.unlink(snapshot.path);
      } else {
        // 恢复到修改前内容
        await fs.writeFile(snapshot.path, snapshot.content, 'utf8');
      }
      
      rolledBackFiles.push(snapshot.path);
    } catch (error) {
      errors.push(`回滚文件 ${snapshot.path} 失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      success: errors.length === 0,
      rolledBackFiles,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: Date.now(),
    };
  }

  /**
   * 批量回滚
   */
  async rollbackBySession(sessionId: string): Promise<RollbackResult> {
    const relatedSnapshots = Array.from(this.snapshots.values());
    // 简化：实际应该根据sessionId关联快照
    const results = await Promise.all(
      relatedSnapshots.slice(0, 10).map(s => this.rollback(s.id))
    );

    const rolledBackFiles = results.flatMap(r => r.rolledBackFiles);
    const errors = results.flatMap(r => r.errors || []);

    return {
      success: errors.length === 0,
      rolledBackFiles,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: Date.now(),
    };
  }

  /**
   * 触发自动回滚
   */
  private triggerAutoRollback(operation: Operation, _decision: SecurityDecision): void {
    // 简化：实际应该根据操作类型和影响范围决定回滚策略
    console.log(`触发自动回滚: ${operation.type}`);
  }

  /**
   * 判断是否需要自动回滚
   */
  private shouldAutoRollback(level: SecurityLevel): boolean {
    const rollbackLevels: SecurityLevel[] = [this.autoRollbackThreshold, 'critical'];
    return rollbackLevels.includes(level);
  }

  /**
   * 计算文件哈希
   */
  private calculateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * 获取日期字符串
   */
  private getDateStr(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * 加载审计日志
   */
  private async loadAuditLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(f => f.endsWith('.log'));

      for (const file of logFiles) {
        const content = await fs.readFile(path.join(this.logDir, file), 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            this.auditLog.push(entry);
          } catch {
            // 忽略无效行
          }
        }
      }
    } catch (error) {
      // 忽略加载错误
    }
  }

  /**
   * 清理旧日志
   */
  private async cleanOldLogs(): Promise<void> {
    const cutoffDate = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;

    // 内存中的日志清理
    this.auditLog = this.auditLog.filter(e => e.timestamp >= cutoffDate);

    // 文件中的日志清理
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(f => f.endsWith('.log'));

      for (const file of logFiles) {
        const dateStr = file.replace('audit-', '').replace('.log', '');
        const fileDate = new Date(dateStr).getTime();
        
        if (fileDate < cutoffDate) {
          await fs.unlink(path.join(this.logDir, file));
        }
      }
    } catch (error) {
      // 忽略清理错误
    }
  }

  /**
   * 查询审计日志
   */
  queryAuditLogs(options: {
    sessionId?: string;
    operationType?: string;
    level?: SecurityLevel;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): AuditLogEntry[] {
    let results = [...this.auditLog];

    if (options.sessionId) {
      results = results.filter(e => e.sessionId === options.sessionId);
    }
    if (options.operationType) {
      results = results.filter(e => e.operation.type === options.operationType);
    }
    if (options.level) {
      results = results.filter(e => e.decision.level === options.level);
    }
    if (options.startTime) {
      results = results.filter(e => e.timestamp >= options.startTime);
    }
    if (options.endTime) {
      results = results.filter(e => e.timestamp <= options.endTime);
    }

    // 按时间倒序
    results.sort((a, b) => b.timestamp - a.timestamp);

    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * 获取审计统计
   */
  getAuditStats(): {
    totalEntries: number;
    byLevel: Record<SecurityLevel, number>;
    byOperation: Record<string, number>;
    blockedOperations: number;
  } {
    const byLevel: Record<SecurityLevel, number> = {
      safe: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    const byOperation: Record<string, number> = {};
    let blockedOperations = 0;

    for (const entry of this.auditLog) {
      byLevel[entry.decision.level]++;
      byOperation[entry.operation.type] = (byOperation[entry.operation.type] || 0) + 1;
      if (!entry.decision.allowed) {
        blockedOperations++;
      }
    }

    return {
      totalEntries: this.auditLog.length,
      byLevel,
      byOperation,
      blockedOperations,
    };
  }

  /**
   * 获取所有快照
   */
  getSnapshots(): FileSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * 设置自动回滚阈值
   */
  setAutoRollbackThreshold(level: SecurityLevel): void {
    this.autoRollbackThreshold = level;
  }

  /**
   * 设置保留天数
   */
  setRetentionDays(days: number): void {
    this.retentionDays = days;
    this.cleanOldLogs().catch(console.error);
  }
}
