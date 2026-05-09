/**
 * Security Manager - 7 Layer Defense
 * 安全管理器 - 7层纵深防御
 * 
 * 集成所有7层安全检查，提供统一的安全检查接口
 */

import { EventEmitter } from 'eventemitter3';
import {
  Operation,
  SecurityDecision,
  SecurityConfig,
  DEFAULT_SECURITY_CONFIG,
  SecurityEventType,
  SecurityEvent,
  SecurityManagerEvents,
  Role,
} from './types.js';

import { ConfigRuleLayer } from './layer1-config.js';
import { ToolPermissionLayer } from './layer2-tool-permission.js';
import { AstAnalyzerLayer } from './layer3-ast-analyzer.js';
import { DangerClassifierLayer } from './layer4-classifier.js';
import { ConfirmationLayer } from './layer5-confirmation.js';
import { SandboxLayer } from './layer6-sandbox.js';
import { AuditRollbackLayer } from './layer7-audit-rollback.js';

export class SecurityManager {
  private config: SecurityConfig;
  private emitter: SecurityManager['emitter'] = new EventEmitter();
  private initialized = false;

  // 7层防御
  layer1: ConfigRuleLayer;
  layer2: ToolPermissionLayer;
  layer3: AstAnalyzerLayer;
  layer4: DangerClassifierLayer;
  layer5: ConfirmationLayer;
  layer6: SandboxLayer;
  layer7: AuditRollbackLayer;

  constructor(config?: Partial<SecurityConfig>) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };

    // 初始化各层
    this.layer1 = new ConfigRuleLayer(this.config.configRules);
    this.layer2 = new ToolPermissionLayer(this.config.defaultRole);
    this.layer3 = new AstAnalyzerLayer();
    this.layer4 = new DangerClassifierLayer(this.config.dangerPatterns);
    this.layer5 = new ConfirmationLayer(this.config.confirmationTimeout);
    this.layer6 = new SandboxLayer(this.config.sandboxOptions);
    this.layer7 = new AuditRollbackLayer();
  }

  /**
   * 初始化安全管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.layer3.initialize();
    await this.layer7.initialize();

    this.initialized = true;
    this.emit('operation_checked', { message: '安全管理器初始化完成' });
  }

  /**
   * 执行完整的7层安全检查
   */
  async checkOperation(operation: Operation, toolName?: string): Promise<SecurityDecision> {
    // Layer 1: 配置规则检查
    let decision = this.layer1.check(operation);
    if (!decision.allowed) {
      this.logDecision(operation, decision);
      return decision;
    }

    // Layer 2: 工具权限检查
    decision = this.layer2.check(operation, toolName);
    if (!decision.allowed) {
      this.logDecision(operation, decision);
      return decision;
    }

    // Layer 3: AST分析
    decision = this.layer3.check(operation);
    if (!decision.allowed) {
      this.logDecision(operation, decision);
      return decision;
    }

    // Layer 4: 危险模式分类器
    decision = this.layer4.check(operation);
    if (!decision.allowed) {
      this.logDecision(operation, decision);
      return decision;
    }

    // Layer 5: 用户确认
    decision = this.layer5.check(operation, decision);

    // Layer 6: 沙箱检查（决定是否需要沙箱执行）
    const sandboxDecision = this.layer6.check(operation);
    decision.reasons.push(...sandboxDecision.reasons);
    decision.score = Math.max(decision.score, sandboxDecision.score);

    // Layer 7: 审计日志
    decision = this.layer7.check(operation, decision);

    this.logDecision(operation, decision);

    return decision;
  }

  /**
   * 记录决策
   */
  private logDecision(operation: Operation, decision: SecurityDecision): void {
    this.layer7.logOperation(operation, decision);

    if (!decision.allowed) {
      this.emit('operation_blocked', {
        operation: operation.type,
        reason: decision.reasons[0],
        layer: decision.blockingLayer,
      });
    } else {
      this.emit('operation_allowed', {
        operation: operation.type,
        level: decision.level,
        requiresConfirmation: decision.requiresConfirmation,
      });
    }
  }

  /**
   * 设置当前角色
   */
  setCurrentRole(role: Role): void {
    this.layer2.setCurrentRole(role);
  }

  /**
   * 获取当前角色
   */
  getCurrentRole(): Role {
    return this.layer2.getCurrentRole();
  }

  /**
   * 确认操作
   */
  confirmOperation(requestId: string, confirmedBy?: string) {
    return this.layer5.confirm(requestId, confirmedBy);
  }

  /**
   * 拒绝操作
   */
  denyOperation(requestId: string, deniedBy?: string) {
    return this.layer5.deny(requestId, deniedBy);
  }

  /**
   * 获取待确认的请求
   */
  getPendingConfirmations() {
    return this.layer5.getPendingRequests();
  }

  /**
   * 在沙箱中执行代码
   */
  async executeInSandbox(code: string) {
    return this.layer6.executeInSandbox(code);
  }

  /**
   * 创建文件快照
   */
  async createSnapshot(filePath: string, operation: 'create' | 'modify' | 'delete') {
    return this.layer7.createSnapshot(filePath, operation);
  }

  /**
   * 回滚到快照
   */
  async rollback(snapshotId: string) {
    return this.layer7.rollback(snapshotId);
  }

  /**
   * 查询审计日志
   */
  queryAuditLogs(options: any) {
    return this.layer7.queryAuditLogs(options);
  }

  /**
   * 获取安全统计
   */
  getStats() {
    return {
      audit: this.layer7.getAuditStats(),
      classifier: this.layer4.getStats(),
      confirmations: this.layer5.getStats(),
      currentRole: this.getCurrentRole(),
    };
  }

  /**
   * 获取代码分析报告
   */
  getCodeAnalysisReport(code: string): string {
    return this.layer3.getAnalysisReport(code);
  }

  /**
   * 获取分类报告
   */
  getClassificationReport(content: string): string {
    return this.layer4.generateReport(content);
  }

  /**
   * 事件监听
   */
  on(event: SecurityEventType, handler: (event: SecurityEvent) => void): void {
    this.emitter.on(event, handler);
  }

  /**
   * 移除事件监听
   */
  off(event: SecurityEventType, handler: (event: SecurityEvent) => void): void {
    this.emitter.off(event, handler);
  }

  /**
   * 发射事件
   */
  private emit(type: SecurityEventType, data: Record<string, unknown>): void {
    this.emitter.emit(type, {
      type,
      timestamp: Date.now(),
      data,
    });
  }

  /**
   * 获取配置
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
