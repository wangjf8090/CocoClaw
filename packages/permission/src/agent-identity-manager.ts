/**
 * Agent 独立身份治理
 * 
 * 设计灵感来源（2026-07-23行业验证）：
 * 1. Microsoft Entra Agent ID：企业Agent独立身份+最小权限+审计追踪
 *    - 为每个Agent分配独立身份（非共享服务账户）
 *    - 支持条件访问、最小权限、审计追踪、DLP策略
 *    - Agent 365将统一管理跨Microsoft和第三方Agent的清单、权限和行为
 * 
 * 2. AWS Loom：RFC 8693身份传播链
 *    - Agent→MCP→API每跳保留用户身份
 *    - 身份在整个调用链中不丢失
 * 
 * SelfClaw定位：
 * 实现Agent身份生命周期管理、最小权限策略、审计追踪，
 * 支持身份传播和委托，确保Agent行为可追溯。
 */

import { EventEmitter } from 'eventemitter3';

// ==================== 类型定义 ====================

/**
 * Agent身份
 */
export interface AgentIdentity {
  /** 唯一ID */
  id: string;
  /** Agent名称 */
  name: string;
  /** Agent类型 */
  type: AgentType;
  /** 创建时间 */
  createdAt: number;
  /** 最后活跃时间 */
  lastActiveAt: number;
  /** 状态 */
  status: 'active' | 'suspended' | 'revoked';
  /** 凭据（加密存储） */
  credentials: AgentCredentials;
  /** 权限列表 */
  permissions: string[];
  /** 角色列表 */
  roles: string[];
  /** 标签 */
  tags: string[];
  /** 元数据 */
  metadata: Record<string, any>;
}

/**
 * Agent类型
 */
export type AgentType =
  | 'assistant'      // 助手型Agent
  | 'worker'         // 工作型Agent
  | 'planner'        // 规划型Agent
  | 'coordinator'    // 协调型Agent
  | 'specialist'     // 专家型Agent
  | 'service';       // 服务型Agent

/**
 * Agent凭据
 */
export interface AgentCredentials {
  /** 认证类型 */
  authType: 'api_key' | 'oauth' | 'jwt' | 'certificate';
  /** API Key（加密） */
  apiKey?: string;
  /** OAuth Token（加密） */
  oauthToken?: string;
  /** JWT（加密） */
  jwt?: string;
  /** 证书路径 */
  certificatePath?: string;
  /** 过期时间 */
  expiresAt?: number;
  /** 刷新Token（加密） */
  refreshToken?: string;
}

/**
 * 权限定义
 */
export interface Permission {
  /** 权限名称 */
  name: string;
  /** 权限描述 */
  description: string;
  /** 资源类型 */
  resourceType: ResourceType;
  /** 操作类型 */
  actions: ActionType[];
  /** 条件（可选） */
  conditions?: PermissionCondition[];
}

/**
 * 资源类型
 */
export type ResourceType =
  | 'file'
  | 'network'
  | 'tool'
  | 'memory'
  | 'skill'
  | 'agent'
  | 'system';

/**
 * 操作类型
 */
export type ActionType = 'read' | 'write' | 'execute' | 'delete' | 'admin';

/**
 * 权限条件
 */
export interface PermissionCondition {
  /** 条件类型 */
  type: 'time' | 'location' | 'ip' | 'context';
  /** 条件值 */
  value: any;
  /** 操作符 */
  operator: 'eq' | 'ne' | 'in' | 'not_in' | 'gt' | 'lt';
}

/**
 * 角色定义
 */
export interface Role {
  /** 角色名称 */
  name: string;
  /** 角色描述 */
  description: string;
  /** 包含的权限 */
  permissions: string[];
  /** 是否可继承 */
  inheritable: boolean;
  /** 父角色 */
  parentRole?: string;
}

/**
 * 审计日志
 */
export interface IdentityAuditLog {
  /** 日志ID */
  id: string;
  /** 时间戳 */
  timestamp: number;
  /** Agent ID */
  agentId: string;
  /** 事件类型 */
  eventType: IdentityEventType;
  /** 事件描述 */
  description: string;
  /** 详细信息 */
  details?: Record<string, any>;
  /** 操作者（Agent或用户） */
  actor: string;
  /** IP地址 */
  ipAddress?: string;
}

/**
 * 身份事件类型
 */
export type IdentityEventType =
  | 'created'
  | 'updated'
  | 'suspended'
  | 'revoked'
  | 'permission_granted'
  | 'permission_revoked'
  | 'role_assigned'
  | 'role_revoked'
  | 'credential_rotated'
  | 'login'
  | 'logout'
  | 'access_denied';

/**
 * 身份传播上下文（RFC 8693 Token Exchange）
 */
export interface IdentityPropagationContext {
  /** 原始Agent ID */
  originalAgentId: string;
  /** 当前Agent ID */
  currentAgentId: string;
  /** 传播链 */
  propagationChain: string[];
  /** 委托权限 */
  delegatedPermissions: string[];
  /** 传播Token */
  propagationToken: string;
  /** 过期时间 */
  expiresAt: number;
}

/**
 * Agent身份管理器配置
 */
export interface AgentIdentityManagerConfig {
  /** 是否启用最小权限 */
  enableLeastPrivilege: boolean;
  /** 是否启用审计追踪 */
  enableAuditTrail: boolean;
  /** 是否启用身份传播 */
  enableIdentityPropagation: boolean;
  /** 凭据加密密钥（生产环境应使用KMS） */
  credentialEncryptionKey: string;
  /** Token过期时间（毫秒） */
  tokenExpiration: number;
  /** 最大传播深度 */
  maxPropagationDepth: number;
  /** 默认权限 */
  defaultPermissions: string[];
  /** 默认角色 */
  defaultRoles: string[];
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: AgentIdentityManagerConfig = {
  enableLeastPrivilege: true,
  enableAuditTrail: true,
  enableIdentityPropagation: true,
  credentialEncryptionKey: 'default-key-change-in-production',
  tokenExpiration: 3600000, // 1小时
  maxPropagationDepth: 5,
  defaultPermissions: ['read:own', 'execute:own'],
  defaultRoles: ['basic'],
};

// ==================== 默认角色定义 ====================

const DEFAULT_ROLES: Role[] = [
  {
    name: 'admin',
    description: '管理员，拥有所有权限',
    permissions: ['*'],
    inheritable: false,
  },
  {
    name: 'planner',
    description: '规划型Agent，可分解任务和协调其他Agent',
    permissions: [
      'read:tasks',
      'write:tasks',
      'execute:task_decomposition',
      'read:agents',
      'execute:coordinate',
    ],
    inheritable: true,
  },
  {
    name: 'worker',
    description: '工作型Agent，执行具体任务',
    permissions: [
      'read:assigned_tasks',
      'execute:tools',
      'read:files',
      'write:files',
    ],
    inheritable: true,
  },
  {
    name: 'specialist',
    description: '专家型Agent，提供专业领域知识',
    permissions: [
      'read:domain_knowledge',
      'execute:analysis',
      'read:files',
    ],
    inheritable: true,
  },
  {
    name: 'basic',
    description: '基础角色，最小权限',
    permissions: ['read:own', 'execute:own'],
    inheritable: true,
  },
];

// ==================== Agent Identity Manager 主类 ====================

/**
 * Agent 身份管理器
 * 
 * 核心功能：
 * 1. Agent身份生命周期管理（创建、更新、暂停、撤销）
 * 2. 最小权限策略（只授予必要权限）
 * 3. 审计追踪（所有身份相关操作都有记录）
 * 4. 身份传播（支持RFC 8693 Token Exchange）
 * 5. 凭据管理（加密存储、自动轮换）
 */
export class AgentIdentityManager extends EventEmitter {
  private config: AgentIdentityManagerConfig;
  
  /** Agent身份存储 */
  private identities: Map<string, AgentIdentity> = new Map();
  
  /** 角色定义 */
  private roles: Map<string, Role> = new Map();
  
  /** 审计日志 */
  private auditLogs: IdentityAuditLog[] = [];
  
  /** 活跃会话 */
  private activeSessions: Map<string, { agentId: string; startedAt: number; lastActivity: number }> = new Map();

  constructor(config: Partial<AgentIdentityManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 初始化默认角色
    this.initializeDefaultRoles();
  }

  // ===========================================================================
  // Agent 身份生命周期管理
  // ===========================================================================

  /**
   * 创建Agent身份
   */
  async createIdentity(
    name: string,
    type: AgentType,
    roles: string[] = [],
    metadata: Record<string, any> = {}
  ): Promise<AgentIdentity> {
    const id = this.generateId();
    const now = Date.now();
    
    // 解析角色权限
    const permissions = await this.resolvePermissions(roles);
    
    const identity: AgentIdentity = {
      id,
      name,
      type,
      createdAt: now,
      lastActiveAt: now,
      status: 'active',
      credentials: await this.generateCredentials(type),
      permissions: this.config.enableLeastPrivilege 
        ? [...this.config.defaultPermissions, ...permissions]
        : permissions,
      roles: [...this.config.defaultRoles, ...roles],
      tags: [],
      metadata,
    };
    
    this.identities.set(id, identity);
    
    // 记录审计日志
    this.addAuditLog({
      agentId: id,
      eventType: 'created',
      description: `Agent "${name}" (${type}) created`,
      actor: 'system',
      details: { type, roles, metadata },
    });
    
    this.emit('identity.created', identity);
    
    return identity;
  }

  /**
   * 更新Agent身份
   */
  async updateIdentity(agentId: string, updates: Partial<AgentIdentity>): Promise<AgentIdentity> {
    const identity = this.identities.get(agentId);
    if (!identity) {
      throw new Error(`Agent identity ${agentId} not found`);
    }
    
    const updated = { ...identity, ...updates, id: identity.id };
    this.identities.set(agentId, updated);
    
    // 记录审计日志
    this.addAuditLog({
      agentId,
      eventType: 'updated',
      description: `Agent "${updated.name}" updated`,
      actor: 'system',
      details: { updates },
    });
    
    this.emit('identity.updated', updated);
    
    return updated;
  }

  /**
   * 暂停Agent身份
   */
  async suspendIdentity(agentId: string, reason: string): Promise<void> {
    const identity = this.identities.get(agentId);
    if (!identity) {
      throw new Error(`Agent identity ${agentId} not found`);
    }
    
    identity.status = 'suspended';
    
    // 记录审计日志
    this.addAuditLog({
      agentId,
      eventType: 'suspended',
      description: `Agent "${identity.name}" suspended: ${reason}`,
      actor: 'system',
      details: { reason },
    });
    
    this.emit('identity.suspended', { agentId, reason });
  }

  /**
   * 撤销Agent身份
   */
  async revokeIdentity(agentId: string, reason: string): Promise<void> {
    const identity = this.identities.get(agentId);
    if (!identity) {
      throw new Error(`Agent identity ${agentId} not found`);
    }
    
    identity.status = 'revoked';
    
    // 清除活跃会话
    for (const [sessionId, session] of this.activeSessions) {
      if (session.agentId === agentId) {
        this.activeSessions.delete(sessionId);
      }
    }
    
    // 记录审计日志
    this.addAuditLog({
      agentId,
      eventType: 'revoked',
      description: `Agent "${identity.name}" revoked: ${reason}`,
      actor: 'system',
      details: { reason },
    });
    
    this.emit('identity.revoked', { agentId, reason });
  }

  // ===========================================================================
  // 权限管理
  // ===========================================================================

  /**
   * 授予权限
   */
  async grantPermission(agentId: string, permission: string): Promise<void> {
    const identity = this.identities.get(agentId);
    if (!identity) {
      throw new Error(`Agent identity ${agentId} not found`);
    }
    
    if (!identity.permissions.includes(permission)) {
      identity.permissions.push(permission);
      
      // 记录审计日志
      this.addAuditLog({
        agentId,
        eventType: 'permission_granted',
        description: `Permission "${permission}" granted to "${identity.name}"`,
        actor: 'system',
        details: { permission },
      });
      
      this.emit('permission.granted', { agentId, permission });
    }
  }

  /**
   * 撤销权限
   */
  async revokePermission(agentId: string, permission: string): Promise<void> {
    const identity = this.identities.get(agentId);
    if (!identity) {
      throw new Error(`Agent identity ${agentId} not found`);
    }
    
    const index = identity.permissions.indexOf(permission);
    if (index !== -1) {
      identity.permissions.splice(index, 1);
      
      // 记录审计日志
      this.addAuditLog({
        agentId,
        eventType: 'permission_revoked',
        description: `Permission "${permission}" revoked from "${identity.name}"`,
        actor: 'system',
        details: { permission },
      });
      
      this.emit('permission.revoked', { agentId, permission });
    }
  }

  /**
   * 检查权限
   */
  async checkPermission(agentId: string, permission: string): Promise<boolean> {
    const identity = this.identities.get(agentId);
    if (!identity || identity.status !== 'active') {
      return false;
    }
    
    // 通配符权限
    if (identity.permissions.includes('*')) {
      return true;
    }
    
    // 精确匹配
    if (identity.permissions.includes(permission)) {
      return true;
    }
    
    // 通配符匹配（如 read:* 匹配 read:files）
    const [resource, action] = permission.split(':');
    for (const perm of identity.permissions) {
      const [permResource, permAction] = perm.split(':');
      if (permResource === resource && permAction === '*') {
        return true;
      }
      if (permResource === '*' && permAction === action) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 解析角色权限
   */
  private async resolvePermissions(roles: string[]): Promise<string[]> {
    const permissions = new Set<string>();
    
    for (const roleName of roles) {
      const role = this.roles.get(roleName);
      if (role) {
        for (const perm of role.permissions) {
          permissions.add(perm);
        }
      }
    }
    
    return Array.from(permissions);
  }

  // ===========================================================================
  // 身份传播（RFC 8693 Token Exchange）
  // ===========================================================================

  /**
   * 创建身份传播上下文
   */
  async createPropagationContext(
    originalAgentId: string,
    currentAgentId: string,
    delegatedPermissions: string[]
  ): Promise<IdentityPropagationContext> {
    const originalIdentity = this.identities.get(originalAgentId);
    if (!originalIdentity) {
      throw new Error(`Original agent ${originalAgentId} not found`);
    }
    
    const currentIdentity = this.identities.get(currentAgentId);
    if (!currentIdentity) {
      throw new Error(`Current agent ${currentAgentId} not found`);
    }
    
    // 检查传播深度
    const propagationChain = [originalAgentId, currentAgentId];
    if (propagationChain.length > this.config.maxPropagationDepth) {
      throw new Error(`Maximum propagation depth (${this.config.maxPropagationDepth}) exceeded`);
    }
    
    // 生成传播Token
    const propagationToken = await this.generatePropagationToken(
      originalAgentId,
      currentAgentId,
      delegatedPermissions
    );
    
    const context: IdentityPropagationContext = {
      originalAgentId,
      currentAgentId,
      propagationChain,
      delegatedPermissions,
      propagationToken,
      expiresAt: Date.now() + this.config.tokenExpiration,
    };
    
    this.emit('propagation.created', context);
    
    return context;
  }

  /**
   * 验证传播Token
   */
  async validatePropagationToken(token: string): Promise<IdentityPropagationContext | null> {
    // 简化实现：实际应该验证JWT签名
    // 这里只检查格式和过期时间
    
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      
      if (decoded.expiresAt < Date.now()) {
        return null; // Token已过期
      }
      
      return decoded as IdentityPropagationContext;
    } catch (e) {
      return null;
    }
  }

  /**
   * 生成传播Token
   */
  private async generatePropagationToken(
    originalAgentId: string,
    currentAgentId: string,
    delegatedPermissions: string[]
  ): Promise<string> {
    const payload = {
      originalAgentId,
      currentAgentId,
      delegatedPermissions,
      issuedAt: Date.now(),
      expiresAt: Date.now() + this.config.tokenExpiration,
    };
    
    // 简化实现：实际应该使用JWT签名
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  // ===========================================================================
  // 凭据管理
  // ===========================================================================

  /**
   * 生成凭据
   */
  private async generateCredentials(type: AgentType): Promise<AgentCredentials> {
    // 简化实现：实际应该使用安全的随机数生成器
    const apiKey = `agent_${this.generateId()}_${Date.now()}`;
    
    return {
      authType: 'api_key',
      apiKey: await this.encryptCredential(apiKey),
      expiresAt: Date.now() + this.config.tokenExpiration * 24 * 30, // 30天
    };
  }

  /**
   * 加密凭据
   */
  private async encryptCredential(credential: string): Promise<string> {
    // 简化实现：实际应该使用AES-256-GCM等强加密
    // 这里只做简单的Base64编码作为演示
    return Buffer.from(credential).toString('base64');
  }

  /**
   * 解密凭据
   */
  private async decryptCredential(encrypted: string): Promise<string> {
    return Buffer.from(encrypted, 'base64').toString();
  }

  /**
   * 轮换凭据
   */
  async rotateCredentials(agentId: string): Promise<void> {
    const identity = this.identities.get(agentId);
    if (!identity) {
      throw new Error(`Agent identity ${agentId} not found`);
    }
    
    identity.credentials = await this.generateCredentials(identity.type);
    
    // 记录审计日志
    this.addAuditLog({
      agentId,
      eventType: 'credential_rotated',
      description: `Credentials rotated for "${identity.name}"`,
      actor: 'system',
    });
    
    this.emit('credentials.rotated', { agentId });
  }

  // ===========================================================================
  // 审计追踪
  // ===========================================================================

  /**
   * 添加审计日志
   */
  private addAuditLog(entry: Omit<IdentityAuditLog, 'id' | 'timestamp'>): void {
    const log: IdentityAuditLog = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now(),
    };
    
    this.auditLogs.push(log);
  }

  /**
   * 获取审计日志
   */
  getAuditLogs(agentId?: string): IdentityAuditLog[] {
    if (agentId) {
      return this.auditLogs.filter(log => log.agentId === agentId);
    }
    return [...this.auditLogs];
  }

  // ===========================================================================
  // 会话管理
  // ===========================================================================

  /**
   * 创建会话
   */
  async createSession(agentId: string): Promise<string> {
    const identity = this.identities.get(agentId);
    if (!identity || identity.status !== 'active') {
      throw new Error(`Agent ${agentId} is not active`);
    }
    
    const sessionId = this.generateId();
    const now = Date.now();
    
    this.activeSessions.set(sessionId, {
      agentId,
      startedAt: now,
      lastActivity: now,
    });
    
    // 更新最后活跃时间
    identity.lastActiveAt = now;
    
    // 记录审计日志
    this.addAuditLog({
      agentId,
      eventType: 'login',
      description: `Agent "${identity.name}" logged in`,
      actor: agentId,
    });
    
    return sessionId;
  }

  /**
   * 更新会话活动
   */
  updateSessionActivity(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      
      // 更新Agent最后活跃时间
      const identity = this.identities.get(session.agentId);
      if (identity) {
        identity.lastActiveAt = session.lastActivity;
      }
    }
  }

  /**
   * 结束会话
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.activeSessions.delete(sessionId);
      
      // 记录审计日志
      this.addAuditLog({
        agentId: session.agentId,
        eventType: 'logout',
        description: `Agent logged out`,
        actor: session.agentId,
      });
    }
  }

  // ===========================================================================
  // 角色管理
  // ===========================================================================

  /**
   * 初始化默认角色
   */
  private initializeDefaultRoles(): void {
    for (const role of DEFAULT_ROLES) {
      this.roles.set(role.name, role);
    }
  }

  /**
   * 添加角色
   */
  addRole(role: Role): void {
    this.roles.set(role.name, role);
  }

  /**
   * 获取角色
   */
  getRole(name: string): Role | undefined {
    return this.roles.get(name);
  }

  // ===========================================================================
  // 查询
  // ===========================================================================

  /**
   * 获取Agent身份
   */
  getIdentity(agentId: string): AgentIdentity | undefined {
    return this.identities.get(agentId);
  }

  /**
   * 获取所有Agent身份
   */
  getAllIdentities(): AgentIdentity[] {
    return Array.from(this.identities.values());
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.auditLogs = [];
    this.activeSessions.clear();
  }

  // ===========================================================================
  // 辅助方法
  // ===========================================================================

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

export default AgentIdentityManager;
