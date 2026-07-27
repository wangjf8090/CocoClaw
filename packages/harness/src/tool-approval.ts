/**
 * Tool Approval Module
 * 工具审批机制
 *
 * 为 SelfClaw 的 TrustworthyExecutor 提供高风险工具的人类确认机制。
 *
 * 核心功能：
 *   1. 工具风险分级：low / medium / high / critical 四级
 *   2. 预定义风险规则：基于工具操作类型的自动分级
 *   3. 审批流程：高风险工具自动挂起 → 等待人类确认 → 超时自动拒绝
 *   4. 审批会话管理：创建审批请求、查询状态、批准/拒绝
 *   5. 审批历史记录：谁审批了什么、何时审批、结果
 *   6. 白名单机制：用户可配置无需审批的工具列表
 *
 * 与 TrustworthyExecutor 集成方式：
 *   在 TrustworthyExecutor 执行工具前，调用 ToolApprovalManager.checkTool()
 *   若返回 needsApproval=true，则挂起执行并等待人类确认后再继续。
 */

import { RiskLevel } from './types.js';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Tool Risk Level — 工具风险等级
 * 在 TrustworthyExecutor 的 RiskLevel 基础上扩展 critical 级别
 */
export type ToolRiskLevel = RiskLevel | 'critical';

/**
 * Approval Status — 审批状态
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'timeout';

/**
 * Tool Risk Rule — 工具风险规则
 * 定义特定工具或操作模式的风险等级映射
 */
export interface ToolRiskRule {
  /** 规则 ID */
  id: string;
  /** 工具名称匹配模式（支持正则表达式） */
  toolPattern: string;
  /** 风险等级 */
  riskLevel: ToolRiskLevel;
  /** 规则描述 */
  description: string;
  /** 规则优先级（越大越优先，默认 0） */
  priority?: number;
}

/**
 * Tool Approval Config — 工具审批配置
 */
export interface ToolApprovalConfig {
  /** 审批超时时间（毫秒），超时后自动拒绝，默认 30000（30秒） */
  timeoutMs: number;
  /** 默认风险等级（未匹配规则时），默认 'medium' */
  defaultRiskLevel: ToolRiskLevel;
  /** 初始白名单 */
  whitelist?: string[];
  /** 自定义风险规则 */
  customRules?: ToolRiskRule[];
  /** 最大历史记录数，默认 1000 */
  maxHistorySize: number;
}

/**
 * Approval Session — 审批会话
 * 代表一次挂起等待人类确认的审批请求
 */
export interface ApprovalSession {
  /** 会话 ID（唯一标识） */
  sessionId: string;
  /** 触发的工具名称 */
  toolName: string;
  /** 工具输入参数 */
  toolInput?: unknown;
  /** 风险等级 */
  riskLevel: ToolRiskLevel;
  /** 匹配的规则 ID */
  ruleId: string;
  /** 审批状态 */
  status: ApprovalStatus;
  /** 审批人（批准/拒绝时填写） */
  approver?: string;
  /** 拒绝原因（拒绝时填写） */
  rejectReason?: string;
  /** 创建时间 */
  createdAt: number;
  /** 完成时间 */
  completedAt?: number;
  /** 超时定时器 ID（内部使用） */
  _timeoutId?: ReturnType<typeof setTimeout>;
}

/**
 * Approval Record — 审批历史记录
 * 已完成审批的会话归档
 */
export interface ApprovalRecord {
  /** 会话 ID */
  sessionId: string;
  /** 工具名称 */
  toolName: string;
  /** 风险等级 */
  riskLevel: ToolRiskLevel;
  /** 审批状态 */
  status: ApprovalStatus;
  /** 审批人 */
  approver?: string;
  /** 拒绝原因 */
  rejectReason?: string;
  /** 创建时间 */
  createdAt: number;
  /** 完成时间 */
  completedAt: number;
}

/**
 * Approval Check Result — 审批检查结果
 * checkTool() 的返回值，调用方据此决定是否挂起执行
 */
export interface ApprovalCheckResult {
  /** 是否需要审批 */
  needsApproval: boolean;
  /** 风险等级 */
  riskLevel: ToolRiskLevel;
  /** 匹配的规则 ID */
  ruleId: string;
  /** 匹配的规则描述 */
  ruleDescription: string;
  /** 审批会话（仅 needsApproval=true 时有值） */
  session?: ApprovalSession;
}

// ============================================================================
// 预定义风险规则
// ============================================================================

/**
 * 预定义风险规则表
 * 基于工具操作类型的内置风险分级
 */
export const PREDEFINED_RISK_RULES: ToolRiskRule[] = [
  // === Critical: 破坏性操作 ===
  {
    id: 'critical-file-delete',
    toolPattern: '^(delete|remove|rm|unlink|rmdir|purge|wipe|shred|trash|destroy).*',
    riskLevel: 'critical',
    description: 'File/directory deletion: permanent data loss risk',
    priority: 100,
  },
  {
    id: 'critical-system-modify',
    toolPattern: '^(systemctl|service|chmod|chown|mount|umount|format|mkfs|fdisk|dd).*',
    riskLevel: 'critical',
    description: 'System modification: OS-level configuration changes',
    priority: 100,
  },
  {
    id: 'critical-db-drop',
    toolPattern: '^(drop_|drop-|truncat|DROP|TRUNCATE).*',
    riskLevel: 'critical',
    description: 'Database destructive operations: table/collection drop or truncate',
    priority: 100,
  },

  // === High: 高风险操作 ===
  {
    id: 'high-code-exec',
    toolPattern: '^(exec|execute|eval|run|bash|shell|cmd|spawn|fork|subprocess|terminal).*',
    riskLevel: 'high',
    description: 'Code/command execution: arbitrary code execution capability',
    priority: 90,
  },
  {
    id: 'high-file-write',
    toolPattern: '^(write|overwrite|save|create|touch|mkdir|mv|rename|copy|cp|install|deploy).*',
    riskLevel: 'high',
    description: 'File write/modification: can alter system state',
    priority: 90,
  },
  {
    id: 'high-config-change',
    toolPattern: '^(set_config|update_config|write_config|configure|settings).*',
    riskLevel: 'high',
    description: 'Configuration change: can alter system behavior',
    priority: 90,
  },
  {
    id: 'high-auth-change',
    toolPattern: '^(grant|revoke|authorize|permission|role|acl|policy).*',
    riskLevel: 'high',
    description: 'Authorization/permission change: security boundary modification',
    priority: 90,
  },

  // === Medium: 中等风险操作 ===
  {
    id: 'medium-network',
    toolPattern: '^(fetch|request|http|curl|wget|api_call|send|publish|upload|download|post|put|patch).*',
    riskLevel: 'medium',
    description: 'Network request: external communication, data exfiltration risk',
    priority: 50,
  },
  {
    id: 'medium-email',
    toolPattern: '^(email|mail|send_mail|send_email|notify|alert).*',
    riskLevel: 'medium',
    description: 'Email/notification sending: external communication',
    priority: 50,
  },
  {
    id: 'medium-db-write',
    toolPattern: '^(insert|update|upsert|merge|replace|delete_from|modify).*',
    riskLevel: 'medium',
    description: 'Database write operations: data mutation',
    priority: 50,
  },

  // === Low: 低风险操作 ===
  {
    id: 'low-file-read',
    toolPattern: '^(read|cat|head|tail|less|open|view|list|ls|dir|stat|get|show|display|print|echo).*',
    riskLevel: 'low',
    description: 'File read/display: read-only operations',
    priority: 10,
  },
  {
    id: 'low-db-read',
    toolPattern: '^(select|find|query|search|aggregate|count|scan|describe).*',
    riskLevel: 'low',
    description: 'Database read operations: data retrieval only',
    priority: 10,
  },
  {
    id: 'low-info',
    toolPattern: '^(help|info|version|status|ping|health|check|whoami|env|pwd|date|time).*',
    riskLevel: 'low',
    description: 'Informational queries: no side effects',
    priority: 10,
  },
];

/**
 * 默认审批配置
 */
export const DEFAULT_TOOL_APPROVAL_CONFIG: ToolApprovalConfig = {
  timeoutMs: 30000,
  defaultRiskLevel: 'medium',
  whitelist: [],
  customRules: [],
  maxHistorySize: 1000,
};

// ============================================================================
// ToolApprovalManager — 工具审批管理器
// ============================================================================

/**
 * Tool Approval Manager
 * 工具审批管理器
 *
 * 管理高风险工具的审批流程，包括：
 *   - 工具风险自动分级
 *   - 审批会话生命周期管理
 *   - 超时自动拒绝
 *   - 审批历史记录
 *   - 白名单管理
 *
 * @example
 * ```typescript
 * const manager = new ToolApprovalManager();
 *
 * // 检查工具是否需要审批
 * const result = manager.checkTool('delete_file', { path: '/important.txt' });
 * if (result.needsApproval) {
 *   console.log(`Pending approval: ${result.session!.sessionId}`);
 *   // 等待人类批准...
 *   manager.approve(result.session!.sessionId, 'admin-user');
 * }
 * ```
 */
export class ToolApprovalManager {
  private config: ToolApprovalConfig;

  /** 所有风险规则（预定义 + 自定义） */
  private rules: ToolRiskRule[] = [];

  /** 白名单工具名称集合 */
  private whitelist: Set<string> = new Set();

  /** 活跃审批会话（pending 状态） */
  private activeSessions: Map<string, ApprovalSession> = new Map();

  /** 审批历史记录 */
  private history: ApprovalRecord[] = [];

  /** 会话 ID 计数器 */
  private sessionCounter = 0;

  constructor(config?: Partial<ToolApprovalConfig>) {
    this.config = { ...DEFAULT_TOOL_APPROVAL_CONFIG, ...config };

    // 初始化规则：预定义规则 + 自定义规则
    this.rules = [...PREDEFINED_RISK_RULES];
    if (this.config.customRules && this.config.customRules.length > 0) {
      this.addCustomRules(this.config.customRules);
    }

    // 初始化白名单
    if (this.config.whitelist) {
      for (const tool of this.config.whitelist) {
        this.whitelist.add(tool.toLowerCase());
      }
    }
  }

  // ===========================================================================
  // 公共 API — 工具检查
  // ===========================================================================

  /**
   * 检查工具是否需要审批
   * Check if a tool call requires human approval
   *
   * 检查流程：
   *   1. 白名单检查 → 命中则直接放行
   *   2. 规则匹配 → 找到最高优先级匹配规则
   *   3. 风险判定 → high/critical 需审批，low/medium 直接放行
   *   4. 创建会话 → 需审批时创建 pending 会话并启动超时
   *
   * @param toolName - 工具名称
   * @param toolInput - 工具输入参数（可选，用于审批会话记录）
   * @returns 审批检查结果
   */
  checkTool(toolName: string, toolInput?: unknown): ApprovalCheckResult {
    // 1. 白名单检查
    if (this.whitelist.has(toolName.toLowerCase())) {
      return {
        needsApproval: false,
        riskLevel: 'low',
        ruleId: 'whitelist',
        ruleDescription: `"${toolName}" is whitelisted — auto-approved`,
      };
    }

    // 2. 规则匹配：找到优先级最高的匹配规则
    const matchedRule = this.findMatchingRule(toolName);

    const riskLevel = matchedRule?.riskLevel ?? this.config.defaultRiskLevel;
    const ruleId = matchedRule?.id ?? 'default';
    const ruleDescription = matchedRule?.description ?? 'No specific rule matched — using default risk level';

    // 3. 风险判定
    const needsApproval = riskLevel === 'high' || riskLevel === 'critical';

    if (!needsApproval) {
      return {
        needsApproval: false,
        riskLevel,
        ruleId,
        ruleDescription,
      };
    }

    // 4. 创建审批会话
    const session = this.createSession(toolName, toolInput, riskLevel, ruleId);

    return {
      needsApproval: true,
      riskLevel,
      ruleId,
      ruleDescription,
      session,
    };
  }

  /**
   * 批量检查多个工具
   * Check multiple tools in batch
   *
   * @param tools - 工具名称数组
   * @returns 每个工具的检查结果
   */
  checkTools(tools: Array<{ name: string; input?: unknown }>): ApprovalCheckResult[] {
    return tools.map((t) => this.checkTool(t.name, t.input));
  }

  // ===========================================================================
  // 公共 API — 审批操作
  // ===========================================================================

  /**
   * 批准审批会话
   * Approve a pending approval session
   *
   * @param sessionId - 会话 ID
   * @param approver - 审批人标识
   * @returns 是否批准成功
   */
  approve(sessionId: string, approver: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'pending') {
      return false;
    }

    // 清除超时定时器
    this.clearTimeout(session);

    // 更新会话状态
    session.status = 'approved';
    session.approver = approver;
    session.completedAt = Date.now();

    // 归档到历史记录
    this.archiveSession(session);

    // 从活跃会话中移除
    this.activeSessions.delete(sessionId);

    return true;
  }

  /**
   * 拒绝审批会话
   * Reject a pending approval session
   *
   * @param sessionId - 会话 ID
   * @param approver - 审批人标识
   * @param reason - 拒绝原因（可选）
   * @returns 是否拒绝成功
   */
  reject(sessionId: string, approver: string, reason?: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'pending') {
      return false;
    }

    // 清除超时定时器
    this.clearTimeout(session);

    // 更新会话状态
    session.status = 'rejected';
    session.approver = approver;
    session.rejectReason = reason;
    session.completedAt = Date.now();

    // 归档到历史记录
    this.archiveSession(session);

    // 从活跃会话中移除
    this.activeSessions.delete(sessionId);

    return true;
  }

  // ===========================================================================
  // 公共 API — 会话查询
  // ===========================================================================

  /**
   * 获取审批会话
   * Get an approval session by ID
   *
   * @param sessionId - 会话 ID
   * @returns 审批会话，不存在则返回 undefined
   */
  getSession(sessionId: string): ApprovalSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * 获取所有待审批的会话
   * Get all pending approval sessions
   *
   * @returns 待审批会话数组
   */
  getPendingSessions(): ApprovalSession[] {
    return Array.from(this.activeSessions.values()).filter(
      (s) => s.status === 'pending'
    );
  }

  /**
   * 获取活跃会话数量
   * Get count of active (pending) sessions
   */
  getPendingCount(): number {
    return this.getPendingSessions().length;
  }

  // ===========================================================================
  // 公共 API — 历史记录
  // ===========================================================================

  /**
   * 获取审批历史记录
   * Get approval history records
   *
   * @param limit - 返回记录数上限（默认 50）
   * @param offset - 偏移量（默认 0）
   * @returns 审批记录数组（按时间倒序）
   */
  getHistory(limit: number = 50, offset: number = 0): ApprovalRecord[] {
    return this.history.slice(offset, offset + limit);
  }

  /**
   * 按审批人筛选历史记录
   * Get approval history filtered by approver
   *
   * @param approver - 审批人标识
   * @param limit - 返回记录数上限（默认 50）
   * @returns 审批记录数组
   */
  getHistoryByApprover(approver: string, limit: number = 50): ApprovalRecord[] {
    return this.history.filter((r) => r.approver === approver).slice(0, limit);
  }

  /**
   * 按工具名筛选历史记录
   * Get approval history filtered by tool name
   *
   * @param toolName - 工具名称
   * @param limit - 返回记录数上限（默认 50）
   * @returns 审批记录数组
   */
  getHistoryByTool(toolName: string, limit: number = 50): ApprovalRecord[] {
    const lower = toolName.toLowerCase();
    return this.history.filter((r) => r.toolName.toLowerCase() === lower).slice(0, limit);
  }

  /**
   * 获取历史记录总数
   * Get total count of history records
   */
  getHistoryCount(): number {
    return this.history.length;
  }

  /**
   * 清空历史记录
   * Clear all history records
   */
  clearHistory(): void {
    this.history = [];
  }

  // ===========================================================================
  // 公共 API — 白名单管理
  // ===========================================================================

  /**
   * 添加工具到白名单
   * Add a tool to the whitelist
   *
   * @param toolName - 工具名称
   */
  addToWhitelist(toolName: string): void {
    this.whitelist.add(toolName.toLowerCase());
  }

  /**
   * 批量添加工具到白名单
   * Add multiple tools to the whitelist
   *
   * @param toolNames - 工具名称数组
   */
  addToWhitelistBatch(toolNames: string[]): void {
    for (const name of toolNames) {
      this.whitelist.add(name.toLowerCase());
    }
  }

  /**
   * 从白名单移除工具
   * Remove a tool from the whitelist
   *
   * @param toolName - 工具名称
   * @returns 是否移除成功
   */
  removeFromWhitelist(toolName: string): boolean {
    return this.whitelist.delete(toolName.toLowerCase());
  }

  /**
   * 检查工具是否在白名单中
   * Check if a tool is whitelisted
   *
   * @param toolName - 工具名称
   * @returns 是否在白名单中
   */
  isWhitelisted(toolName: string): boolean {
    return this.whitelist.has(toolName.toLowerCase());
  }

  /**
   * 获取白名单列表
   * Get all whitelisted tools
   */
  getWhitelist(): string[] {
    return Array.from(this.whitelist);
  }

  // ===========================================================================
  // 公共 API — 规则管理
  // ===========================================================================

  /**
   * 添加自定义风险规则
   * Add a custom risk rule
   *
   * 自定义规则会与预定义规则合并，优先级高的规则优先匹配。
   * 若自定义规则 ID 与预定义规则冲突，自定义规则覆盖预定义规则。
   *
   * @param rule - 自定义风险规则
   */
  addCustomRule(rule: ToolRiskRule): void {
    // 移除同 ID 的已有规则（自定义覆盖）
    this.rules = this.rules.filter((r) => r.id !== rule.id);
    this.rules.push(rule);
    // 按优先级降序排列
    this.rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * 批量添加自定义风险规则
   * Add multiple custom risk rules
   *
   * @param rules - 自定义规则数组
   */
  addCustomRules(rules: ToolRiskRule[]): void {
    for (const rule of rules) {
      this.rules = this.rules.filter((r) => r.id !== rule.id);
      this.rules.push(rule);
    }
    this.rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * 移除自定义风险规则
   * Remove a custom risk rule (cannot remove predefined rules)
   *
   * @param ruleId - 规则 ID
   * @returns 是否移除成功
   */
  removeCustomRule(ruleId: string): boolean {
    const predefinedIds = new Set(PREDEFINED_RISK_RULES.map((r) => r.id));
    if (predefinedIds.has(ruleId)) {
      return false; // 不允许移除预定义规则
    }
    const before = this.rules.length;
    this.rules = this.rules.filter((r) => r.id !== ruleId);
    return this.rules.length < before;
  }

  /**
   * 获取所有风险规则
   * Get all risk rules (predefined + custom)
   */
  getRules(): ToolRiskRule[] {
    return [...this.rules];
  }

  /**
   * 重置规则为预定义默认值
   * Reset rules to predefined defaults (removes all custom rules)
   */
  resetRules(): void {
    this.rules = [...PREDEFINED_RISK_RULES];
  }

  // ===========================================================================
  // 公共 API — 配置
  // ===========================================================================

  /**
   * 更新配置
   * Update manager configuration
   *
   * @param config - 部分配置
   */
  updateConfig(config: Partial<ToolApprovalConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   * Get current configuration
   */
  getConfig(): ToolApprovalConfig {
    return { ...this.config };
  }

  /**
   * 获取统计信息
   * Get approval statistics
   */
  getStats(): {
    totalRules: number;
    predefinedRules: number;
    customRules: number;
    whitelistSize: number;
    pendingSessions: number;
    totalHistory: number;
    approvedCount: number;
    rejectedCount: number;
    timeoutCount: number;
  } {
    const predefinedIds = new Set(PREDEFINED_RISK_RULES.map((r) => r.id));
    const approvedCount = this.history.filter((r) => r.status === 'approved').length;
    const rejectedCount = this.history.filter((r) => r.status === 'rejected').length;
    const timeoutCount = this.history.filter((r) => r.status === 'timeout').length;

    return {
      totalRules: this.rules.length,
      predefinedRules: predefinedIds.size,
      customRules: this.rules.length - predefinedIds.size,
      whitelistSize: this.whitelist.size,
      pendingSessions: this.getPendingCount(),
      totalHistory: this.history.length,
      approvedCount,
      rejectedCount,
      timeoutCount,
    };
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 查找匹配的风险规则
   * Find the highest-priority matching risk rule for a tool
   *
   * @param toolName - 工具名称
   * @returns 匹配的规则，无匹配则返回 undefined
   */
  private findMatchingRule(toolName: string): ToolRiskRule | undefined {
    const lower = toolName.toLowerCase();
    for (const rule of this.rules) {
      try {
        if (new RegExp(rule.toolPattern, 'i').test(lower)) {
          return rule;
        }
      } catch {
        // 正则表达式无效时跳过
        continue;
      }
    }
    return undefined;
  }

  /**
   * 创建审批会话
   * Create a new approval session and start timeout timer
   *
   * @param toolName - 工具名称
   * @param toolInput - 工具输入
   * @param riskLevel - 风险等级
   * @param ruleId - 匹配的规则 ID
   * @returns 新创建的审批会话
   */
  private createSession(
    toolName: string,
    toolInput: unknown,
    riskLevel: ToolRiskLevel,
    ruleId: string
  ): ApprovalSession {
    const sessionId = this.generateSessionId();
    const session: ApprovalSession = {
      sessionId,
      toolName,
      toolInput,
      riskLevel,
      ruleId,
      status: 'pending',
      createdAt: Date.now(),
    };

    // 启动超时定时器
    if (this.config.timeoutMs > 0) {
      session._timeoutId = setTimeout(() => {
        this.handleTimeout(sessionId);
      }, this.config.timeoutMs);
    }

    this.activeSessions.set(sessionId, session);
    return session;
  }

  /**
   * 处理审批超时
   * Handle approval timeout — auto-reject
   *
   * @param sessionId - 会话 ID
   */
  private handleTimeout(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'pending') {
      return;
    }

    session.status = 'timeout';
    session.completedAt = Date.now();
    session.rejectReason = `Auto-rejected: timeout after ${this.config.timeoutMs}ms`;

    this.archiveSession(session);
    this.activeSessions.delete(sessionId);
  }

  /**
   * 清除超时定时器
   * Clear the timeout timer for a session
   *
   * @param session - 审批会话
   */
  private clearTimeout(session: ApprovalSession): void {
    if (session._timeoutId) {
      clearTimeout(session._timeoutId);
      session._timeoutId = undefined;
    }
  }

  /**
   * 归档会话到历史记录
   * Archive a completed session to history
   *
   * @param session - 已完成的审批会话
   */
  private archiveSession(session: ApprovalSession): void {
    const record: ApprovalRecord = {
      sessionId: session.sessionId,
      toolName: session.toolName,
      riskLevel: session.riskLevel,
      status: session.status,
      approver: session.approver,
      rejectReason: session.rejectReason,
      createdAt: session.createdAt,
      completedAt: session.completedAt ?? Date.now(),
    };

    this.history.push(record);

    // 历史记录容量管理：超出上限时移除最旧的
    while (this.history.length > this.config.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * 生成唯一会话 ID
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    this.sessionCounter++;
    return `approval-${Date.now()}-${this.sessionCounter}`;
  }
}

// ============================================================================
// 便捷工厂函数
// ============================================================================

/**
 * 创建工具审批管理器
 * Create a configured ToolApprovalManager
 *
 * @param config - 审批配置（可选）
 * @returns ToolApprovalManager 实例
 */
export function createToolApprovalManager(
  config?: Partial<ToolApprovalConfig>
): ToolApprovalManager {
  return new ToolApprovalManager(config);
}