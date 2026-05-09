/**
 * Layer 2: Tool Permission Model
 * 第2层：工具权限模型
 * 
 * - 每个工具的权限级别定义
 * - 角色基权限控制（RBAC）
 * - 细粒度权限矩阵
 */

import {
  Operation,
  OperationType,
  SecurityDecision,
  Role,
  ToolPermission,
  ToolPermissionModel,
  ROLE_PERMISSIONS,
  DEFAULT_TOOL_PERMISSIONS,
} from './types.js';

export class ToolPermissionLayer {
  private model: ToolPermissionModel;
  private currentRole: Role;
  private toolFrequency: Map<string, { count: number; startTime: number }> = new Map();

  constructor(
    defaultRole: Role = 'user',
    customPermissions?: Record<string, ToolPermission>
  ) {
    this.currentRole = defaultRole;
    
    const permissions = customPermissions || DEFAULT_TOOL_PERMISSIONS;
    this.model = {
      tools: new Map(Object.entries(permissions)),
      defaultRole,
    };
  }

  /**
   * 检查工具操作权限
   */
  check(operation: Operation, toolName?: string): SecurityDecision {
    const reasons: string[] = [];

    // 1. 检查是否有指定的工具
    if (toolName) {
      const permission = this.model.tools.get(toolName);
      
      if (permission) {
        // 检查角色权限
        if (!this.hasRolePermission(this.currentRole, permission.requiredRole)) {
          reasons.push(`角色 ${this.currentRole} 无权使用工具 ${toolName} (需要 ${permission.requiredRole})`);
        }

        // 检查操作类型权限
        if (!permission.allowedOperations.includes(operation.type)) {
          reasons.push(`工具 ${toolName} 不允许执行操作类型: ${operation.type}`);
        }

        // 检查频率限制
        if (!this.checkFrequency(toolName, permission.maxFrequency)) {
          reasons.push(`工具 ${toolName} 调用频率超过限制: ${permission.maxFrequency}/分钟`);
        }
      } else {
        // 未知工具，需要检查基本权限
        reasons.push(`未知工具: ${toolName}，应用默认权限检查`);
      }
    }

    // 2. 检查操作类型的基本权限
    if (!this.hasOperationPermission(this.currentRole, operation.type)) {
      reasons.push(`角色 ${this.currentRole} 无权执行操作类型: ${operation.type}`);
    }

    // 3. 决策
    if (reasons.length > 0) {
      return {
        allowed: false,
        level: 'high',
        score: 75,
        reasons,
        layer: 'tool-permission',
        requiresConfirmation: false,
        blockingLayer: 'tool-permission',
      };
    }

    // 检查是否需要审计
    const requiresAudit = toolName ? 
      this.model.tools.get(toolName)?.requiresAudit || false : 
      true;

    return {
      allowed: true,
      level: requiresAudit ? 'low' : 'safe',
      score: requiresAudit ? 10 : 0,
      reasons: requiresAudit ? ['操作需要审计记录'] : ['权限检查通过'],
      layer: 'tool-permission',
      requiresConfirmation: requiresAudit,
    };
  }

  /**
   * 检查角色权限等级
   */
  private hasRolePermission(currentRole: Role, requiredRole: Role): boolean {
    const roleHierarchy: Role[] = ['guest', 'user', 'developer', 'admin', 'owner'];
    const currentIndex = roleHierarchy.indexOf(currentRole);
    const requiredIndex = roleHierarchy.indexOf(requiredRole);
    return currentIndex >= requiredIndex;
  }

  /**
   * 检查操作类型权限
   */
  private hasOperationPermission(role: Role, operationType: OperationType): boolean {
    const permissions = ROLE_PERMISSIONS[role];
    
    // 完全控制
    if (permissions.includes('all')) {
      return true;
    }

    // 检查具体权限
    const operationToPermission: Record<OperationType, string> = {
      file_read: 'read',
      file_write: 'write',
      file_delete: 'write',
      file_execute: 'execute_safe',
      code_execute: 'execute_code',
      network_request: 'network',
      shell_command: 'execute_code',
      system_call: 'system_config',
      process_management: 'execute_code',
      env_access: 'execute_safe',
      tool_invocation: 'query',
    };

    const requiredPermission = operationToPermission[operationType];
    return permissions.includes(requiredPermission);
  }

  /**
   * 检查调用频率
   */
  private checkFrequency(toolName: string, maxFrequency: number): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1分钟窗口

    let frequency = this.toolFrequency.get(toolName);
    
    if (!frequency || now - frequency.startTime > windowMs) {
      // 新窗口或重置
      this.toolFrequency.set(toolName, {
        count: 1,
        startTime: now,
      });
      return true;
    }

    if (frequency.count >= maxFrequency) {
      return false;
    }

    frequency.count++;
    return true;
  }

  /**
   * 设置当前角色
   */
  setCurrentRole(role: Role): void {
    this.currentRole = role;
  }

  /**
   * 获取当前角色
   */
  getCurrentRole(): Role {
    return this.currentRole;
  }

  /**
   * 注册工具权限
   */
  registerTool(permission: ToolPermission): void {
    this.model.tools.set(permission.name, permission);
  }

  /**
   * 注销工具
   */
  unregisterTool(toolName: string): boolean {
    return this.model.tools.delete(toolName);
  }

  /**
   * 获取工具权限
   */
  getToolPermission(toolName: string): ToolPermission | undefined {
    return this.model.tools.get(toolName);
  }

  /**
   * 获取所有注册的工具
   */
  getAllTools(): string[] {
    return Array.from(this.model.tools.keys());
  }

  /**
   * 检查角色是否可以执行操作
   */
  canPerform(role: Role, operationType: OperationType): boolean {
    return this.hasOperationPermission(role, operationType);
  }

  /**
   * 获取角色的权限列表
   */
  getRolePermissions(role: Role): string[] {
    return [...ROLE_PERMISSIONS[role]];
  }

  /**
   * 重置频率统计
   */
  resetFrequency(toolName?: string): void {
    if (toolName) {
      this.toolFrequency.delete(toolName);
    } else {
      this.toolFrequency.clear();
    }
  }
}
