/**
 * SelfClaw 7-Layer Security System
 * 7层纵深防御权限系统
 * 
 * 第1层: 应用配置规则 (Config Rules)
 *   - 白名单/黑名单目录
 *   - 允许的命令列表
 *   - 文件大小限制
 *   - 超时时间配置
 * 
 * 第2层: 工具权限模型 (Tool Permission Model)
 *   - 每个工具的权限级别定义
 *   - 角色基权限控制（RBAC）
 *   - 细粒度权限矩阵
 * 
 * 第3层: Tree-sitter AST分析 (AST Analyzer)
 *   - JavaScript/TypeScript解析
 *   - 危险模式检测
 *   - 命令语义分析
 *   - 风险评分计算
 * 
 * 第4层: 危险模式分类器 (Danger Classifier)
 *   - 基于规则的危险操作分类
 *   - 正则表达式模式匹配
 *   - 风险等级评估
 * 
 * 第5层: 用户确认机制 (User Confirmation)
 *   - 交互式确认对话框
 *   - 批量操作确认
 *   - 确认超时处理
 * 
 * 第6层: 沙箱隔离 (Sandbox)
 *   - Node.js vm模块隔离
 *   - 子进程资源限制
 *   - 文件系统访问隔离
 *   - 网络访问控制
 * 
 * 第7层: 审计与自动回滚 (Audit & Rollback)
 *   - 所有操作审计日志
 *   - 文件变更快照
 *   - 自动回滚机制
 *   - 审计日志查询API
 */

// Types
export * from './types.js';

// Layers
export { ConfigRuleLayer } from './layer1-config.js';
export { ToolPermissionLayer } from './layer2-tool-permission.js';
export { AstAnalyzerLayer } from './layer3-ast-analyzer.js';
export { DangerClassifierLayer } from './layer4-classifier.js';
export { ConfirmationLayer } from './layer5-confirmation.js';
export { SandboxLayer } from './layer6-sandbox.js';
export { AuditRollbackLayer } from './layer7-audit-rollback.js';

// Security Manager
export { SecurityManager } from './security-manager.js';

// Default export
import { SecurityManager } from './security-manager.js';
export default SecurityManager;

/**
 * 创建安全管理器实例
 */
export function createSecurityManager(config?: any): SecurityManager {
  return new SecurityManager(config);
}

/**
 * 版本信息
 */
export const VERSION = '0.1.0';

/**
 * 安全层信息
 */
export const SECURITY_LAYERS = [
  {
    name: 'Config Rules',
    description: '应用配置规则 - 白名单/黑名单检查',
    level: 1,
  },
  {
    name: 'Tool Permission',
    description: '工具权限模型 - RBAC角色基访问控制',
    level: 2,
  },
  {
    name: 'AST Analyzer',
    description: 'Tree-sitter AST分析 - 危险代码检测',
    level: 3,
  },
  {
    name: 'Danger Classifier',
    description: '危险模式分类器 - 规则+正则匹配',
    level: 4,
  },
  {
    name: 'User Confirmation',
    description: '用户确认机制 - 交互式确认',
    level: 5,
  },
  {
    name: 'Sandbox',
    description: '沙箱隔离 - 代码执行环境隔离',
    level: 6,
  },
  {
    name: 'Audit & Rollback',
    description: '审计与自动回滚 - 日志+快照',
    level: 7,
  },
];
