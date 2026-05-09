/**
 * Layer 5: User Confirmation Mechanism
 * 第5层：用户确认机制
 * 
 * - 交互式确认对话框
 * - 批量操作确认
 * - 确认超时处理
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  Operation,
  SecurityDecision,
  ConfirmationRequest,
  ConfirmationResult,
  SecurityLevel,
} from './types.js';

type ConfirmationEventType = 'request_created' | 'request_confirmed' | 'request_denied' | 'request_timeout';

interface ConfirmationEvents {
  request_created: (request: ConfirmationRequest) => void;
  request_confirmed: (request: ConfirmationRequest, result: ConfirmationResult) => void;
  request_denied: (request: ConfirmationRequest, result: ConfirmationResult) => void;
  request_timeout: (request: ConfirmationRequest) => void;
}

export class ConfirmationLayer {
  private pendingRequests: Map<string, ConfirmationRequest> = new Map();
  private timeout: number; // 确认超时时间（毫秒）
  private emitter: EventEmitter<ConfirmationEvents> = new EventEmitter();

  constructor(timeout: number = 60000) {
    this.timeout = timeout;
  }

  /**
   * 检查操作是否需要确认
   */
  check(operation: Operation, decision: SecurityDecision): SecurityDecision {
    // 如果已经被阻止，直接返回
    if (!decision.allowed) {
      return decision;
    }

    // 根据安全级别决定是否需要确认
    const needsConfirmation = this.needsConfirmation(decision.level);
    
    if (needsConfirmation) {
      // 创建确认请求
      const request = this.createRequest(operation, decision);
      
      return {
        ...decision,
        allowed: false, // 暂时阻止，等待确认
        requiresConfirmation: true,
        reasons: [...decision.reasons, `需要用户确认 (请求ID: ${request.id})`],
      };
    }

    return decision;
  }

  /**
   * 判断是否需要确认
   */
  private needsConfirmation(level: SecurityLevel): boolean {
    // high和critical级别总是需要确认
    // medium级别可选
    switch (level) {
      case 'critical':
      case 'high':
        return true;
      case 'medium':
        return true; // 可以配置为false
      case 'low':
      case 'safe':
      default:
        return false;
    }
  }

  /**
   * 创建确认请求
   */
  createRequest(operation: Operation, decision: SecurityDecision): ConfirmationRequest {
    const now = Date.now();
    const request: ConfirmationRequest = {
      id: uuidv4(),
      operation,
      level: decision.level,
      reasons: decision.reasons,
      createdAt: now,
      expiresAt: now + this.timeout,
      sessionId: operation.sessionId,
    };

    this.pendingRequests.set(request.id, request);
    this.emitter.emit('request_created', request);

    // 设置超时清理
    setTimeout(() => {
      this.checkTimeout(request.id);
    }, this.timeout);

    return request;
  }

  /**
   * 确认操作
   */
  confirm(requestId: string, confirmedBy?: string): ConfirmationResult {
    const request = this.pendingRequests.get(requestId);
    
    if (!request) {
      throw new Error(`确认请求不存在: ${requestId}`);
    }

    // 检查是否超时
    if (Date.now() > request.expiresAt) {
      this.pendingRequests.delete(requestId);
      this.emitter.emit('request_timeout', request);
      throw new Error(`确认请求已超时: ${requestId}`);
    }

    const result: ConfirmationResult = {
      confirmed: true,
      timestamp: Date.now(),
      confirmedBy,
      sessionId: request.sessionId,
    };

    this.pendingRequests.delete(requestId);
    this.emitter.emit('request_confirmed', request, result);

    return result;
  }

  /**
   * 拒绝操作
   */
  deny(requestId: string, deniedBy?: string): ConfirmationResult {
    const request = this.pendingRequests.get(requestId);
    
    if (!request) {
      throw new Error(`确认请求不存在: ${requestId}`);
    }

    const result: ConfirmationResult = {
      confirmed: false,
      timestamp: Date.now(),
      confirmedBy: deniedBy,
      sessionId: request.sessionId,
    };

    this.pendingRequests.delete(requestId);
    this.emitter.emit('request_denied', request, result);

    return result;
  }

  /**
   * 检查并处理超时
   */
  private checkTimeout(requestId: string): void {
    const request = this.pendingRequests.get(requestId);
    if (request && Date.now() > request.expiresAt) {
      this.pendingRequests.delete(requestId);
      this.emitter.emit('request_timeout', request);
    }
  }

  /**
   * 获取待处理的请求
   */
  getPendingRequests(): ConfirmationRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * 获取会话的待处理请求
   */
  getSessionRequests(sessionId: string): ConfirmationRequest[] {
    return this.getPendingRequests().filter(r => r.sessionId === sessionId);
  }

  /**
   * 批量确认会话的所有请求
   */
  batchConfirm(sessionId: string, confirmedBy?: string): { confirmed: number; errors: string[] } {
    const requests = this.getSessionRequests(sessionId);
    const errors: string[] = [];
    let confirmed = 0;

    for (const request of requests) {
      try {
        this.confirm(request.id, confirmedBy);
        confirmed++;
      } catch (e) {
        errors.push(`${request.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { confirmed, errors };
  }

  /**
   * 批量拒绝会话的所有请求
   */
  batchDeny(sessionId: string, deniedBy?: string): { denied: number } {
    const requests = this.getSessionRequests(sessionId);
    let denied = 0;

    for (const request of requests) {
      this.deny(request.id, deniedBy);
      denied++;
    }

    return { denied };
  }

  /**
   * 检查请求是否待处理
   */
  isPending(requestId: string): boolean {
    return this.pendingRequests.has(requestId);
  }

  /**
   * 获取请求
   */
  getRequest(requestId: string): ConfirmationRequest | undefined {
    return this.pendingRequests.get(requestId);
  }

  /**
   * 清理过期请求
   */
  cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, request] of this.pendingRequests) {
      if (now > request.expiresAt) {
        this.pendingRequests.delete(id);
        this.emitter.emit('request_timeout', request);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 设置超时时间
   */
  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  /**
   * 获取超时时间
   */
  getTimeout(): number {
    return this.timeout;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    pending: number;
    byLevel: Record<SecurityLevel, number>;
  } {
    const byLevel: Record<SecurityLevel, number> = {
      safe: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const request of this.pendingRequests.values()) {
      byLevel[request.level]++;
    }

    return {
      pending: this.pendingRequests.size,
      byLevel,
    };
  }

  /**
   * 事件监听
   */
  on(event: ConfirmationEventType, handler: (...args: any[]) => void): void {
    this.emitter.on(event, handler);
  }

  /**
   * 移除事件监听
   */
  off(event: ConfirmationEventType, handler: (...args: any[]) => void): void {
    this.emitter.off(event, handler);
  }
}
