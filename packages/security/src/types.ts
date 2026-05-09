/**
 * SelfClaw 7-Layer Security System Types
 * 7层纵深防御权限系统类型定义
 */

import { EventEmitter } from 'eventemitter3';

// ==================== 安全级别 ====================

export type SecurityLevel =
  | 'safe'         // 完全安全，无风险
  | 'low'          // 低风险，影响有限
  | 'medium'       // 中等风险，需要注意
  | 'high'         // 高风险，需要确认
  | 'critical';    // 极高风险，严格限制

export const SECURITY_LEVEL_SCORES: Record<SecurityLevel, number> = {
  safe: 0,
  low: 25,
  medium: 50,
  high: 75,
  critical: 100,
};

// ==================== 权限角色 ====================

export type Role =
  | 'guest'        // 访客，只读访问
  | 'user'         // 普通用户，基本操作
  | 'developer'    // 开发者，代码执行
  | 'admin'        // 管理员，系统配置
  | 'owner';       // 所有者，完全控制

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  guest: ['read', 'query'],
  user: ['read', 'query', 'write', 'execute_safe'],
  developer: ['read', 'query', 'write', 'execute_safe', 'execute_code', 'network'],
  admin: ['read', 'query', 'write', 'execute_safe', 'execute_code', 'network', 'system_config'],
  owner: ['read', 'query', 'write', 'execute_safe', 'execute_code', 'network', 'system_config', 'all'],
};

// ==================== 操作类型 ====================

export type OperationType =
  | 'file_read'
  | 'file_write'
  | 'file_delete'
  | 'file_execute'
  | 'code_execute'
  | 'network_request'
  | 'shell_command'
  | 'system_call'
  | 'process_management'
  | 'env_access'
  | 'tool_invocation';

export interface Operation {
  type: OperationType;
  target?: string;
  content?: string;
  metadata: Record<string, unknown>;
  timestamp: number;
  sessionId?: string;
}

export interface SecurityDecision {
  allowed: boolean;
  level: SecurityLevel;
  score: number;
  reasons: string[];
  layer: string;
  requiresConfirmation: boolean;
  blockingLayer?: string;
}

// ==================== 第1层：应用配置规则 ====================

export interface ConfigRules {
  // 目录白名单/黑名单
  allowedDirectories: string[];
  blockedDirectories: string[];
  
  // 允许的命令列表
  allowedCommands: string[];
  blockedCommands: string[];
  
  // 文件限制
  maxFileSize: number; // bytes
  allowedFileTypes: string[];
  blockedFileTypes: string[];
  
  // 超时配置
  maxExecutionTime: number; // ms
  maxMemoryUsage: number; // MB
  
  // 网络限制
  allowedDomains: string[];
  blockedDomains: string[];
  maxNetworkRequests: number;
}

export const DEFAULT_CONFIG_RULES: ConfigRules = {
  allowedDirectories: ['./projects', './data', './workspace'],
  blockedDirectories: ['/etc', '/root', '/sys', '/proc', '~/.ssh', '~/.aws'],
  allowedCommands: ['ls', 'cat', 'echo', 'pwd', 'whoami', 'git', 'npm', 'node', 'tsx'],
  blockedCommands: ['rm -rf', 'sudo', 'su', 'chmod', 'chown', 'dd', 'mkfs', ':(){:|:&};:'],
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedFileTypes: ['.ts', '.js', '.json', '.md', '.txt', '.yaml', '.yml', '.toml'],
  blockedFileTypes: ['.exe', '.bin', '.sh', '.bat', '.cmd', '.ps1'],
  maxExecutionTime: 30000, // 30秒
  maxMemoryUsage: 512, // 512MB
  allowedDomains: ['localhost', '127.0.0.1', 'npmjs.com', 'github.com'],
  blockedDomains: [],
  maxNetworkRequests: 100,
};

// ==================== 第2层：工具权限模型 ====================

export interface ToolPermission {
  name: string;
  requiredRole: Role;
  allowedOperations: OperationType[];
  maxFrequency: number; // per minute
  requiresAudit: boolean;
}

export interface ToolPermissionModel {
  tools: Map<string, ToolPermission>;
  defaultRole: Role;
}

export const DEFAULT_TOOL_PERMISSIONS: Record<string, ToolPermission> = {
  'memory.search': {
    name: 'memory.search',
    requiredRole: 'user',
    allowedOperations: ['tool_invocation'],
    maxFrequency: 60,
    requiresAudit: false,
  },
  'file.read': {
    name: 'file.read',
    requiredRole: 'user',
    allowedOperations: ['file_read'],
    maxFrequency: 120,
    requiresAudit: false,
  },
  'file.write': {
    name: 'file.write',
    requiredRole: 'user',
    allowedOperations: ['file_write'],
    maxFrequency: 60,
    requiresAudit: true,
  },
  'shell.exec': {
    name: 'shell.exec',
    requiredRole: 'developer',
    allowedOperations: ['shell_command', 'process_management'],
    maxFrequency: 30,
    requiresAudit: true,
  },
  'code.run': {
    name: 'code.run',
    requiredRole: 'developer',
    allowedOperations: ['code_execute'],
    maxFrequency: 30,
    requiresAudit: true,
  },
  'network.fetch': {
    name: 'network.fetch',
    requiredRole: 'developer',
    allowedOperations: ['network_request'],
    maxFrequency: 60,
    requiresAudit: true,
  },
};

// ==================== 第3层：AST分析 ====================

export interface AstAnalysisResult {
  hasDangerPatterns: boolean;
  dangerPatterns: string[];
  riskScore: number; // 0-100
  level: SecurityLevel;
  details: {
    hasEval: boolean;
    hasChildProcess: boolean;
    hasFsAccess: boolean;
    hasNetworkAccess: boolean;
    hasProcessAccess: boolean;
    hasEnvAccess: boolean;
    hasUnsafeImports: boolean;
    suspiciousPatterns: string[];
  };
}

// ==================== 第4层：危险模式分类器 ====================

export interface DangerPattern {
  id: string;
  pattern: RegExp | string;
  level: SecurityLevel;
  description: string;
  category: string;
}

export interface ClassifierResult {
  isDangerous: boolean;
  level: SecurityLevel;
  score: number;
  matchedPatterns: DangerPattern[];
  reasons: string[];
}

export const DANGER_PATTERNS: DangerPattern[] = [
  // 文件系统危险
  { id: 'FS001', pattern: /rm\s+-rf/, level: 'critical', description: '递归强制删除文件', category: 'filesystem' },
  { id: 'FS002', pattern: /mkfs|fdisk/, level: 'critical', description: '磁盘格式化操作', category: 'filesystem' },
  { id: 'FS003', pattern: /dd\s+if=|dd\s+of=/, level: 'high', description: '底层磁盘写入', category: 'filesystem' },
  
  // 权限提升
  { id: 'PR001', pattern: /sudo|su\s+/, level: 'high', description: '特权提升命令', category: 'privilege' },
  { id: 'PR002', pattern: /chmod\s+777|chown/, level: 'medium', description: '权限修改操作', category: 'privilege' },
  
  // 代码注入
  { id: 'CI001', pattern: /eval\s*\(/, level: 'high', description: 'eval代码执行', category: 'code_injection' },
  { id: 'CI002', pattern: /Function\s*\(/, level: 'medium', description: 'Function构造器执行', category: 'code_injection' },
  { id: 'CI003', pattern: /setTimeout\s*\(|setInterval\s*\(/, level: 'low', description: '定时执行代码', category: 'code_injection' },
  
  // 进程管理
  { id: 'PM001', pattern: /child_process|exec\s*\(|execSync\s*\(/, level: 'high', description: '子进程执行', category: 'process' },
  { id: 'PM002', pattern: /spawn\s*\(|fork\s*\(/, level: 'high', description: '进程创建', category: 'process' },
  
  // 网络
  { id: 'NW001', pattern: /http|https|fetch|axios|request/, level: 'medium', description: '网络请求', category: 'network' },
  { id: 'NW002', pattern: /net\.|socket|Server/, level: 'medium', description: '网络服务', category: 'network' },
  
  // Fork炸弹
  { id: 'FB001', pattern: /:\(\)\s*\{:\s*\|\s*:\s*&\s*};\s*:/, level: 'critical', description: 'Fork炸弹', category: 'dos' },
  
  // 环境变量
  { id: 'EV001', pattern: /process\.env|env\s+/, level: 'low', description: '环境变量访问', category: 'environment' },
];

// ==================== 第5层：用户确认 ====================

export interface ConfirmationRequest {
  id: string;
  operation: Operation;
  level: SecurityLevel;
  reasons: string[];
  createdAt: number;
  expiresAt: number;
  sessionId?: string;
}

export interface ConfirmationResult {
  confirmed: boolean;
  timestamp: number;
  confirmedBy?: string;
  sessionId?: string;
}

// ==================== 第6层：沙箱隔离 ====================

export interface SandboxOptions {
  timeout: number;
  memoryLimit: number;
  cpuLimit: number;
  allowFs: boolean;
  allowNetwork: boolean;
  allowProcess: boolean;
  allowedModules: string[];
  blockedModules: string[];
  workingDirectory: string;
}

export const DEFAULT_SANDBOX_OPTIONS: SandboxOptions = {
  timeout: 30000,
  memoryLimit: 512,
  cpuLimit: 1,
  allowFs: false,
  allowNetwork: false,
  allowProcess: false,
  allowedModules: ['path', 'util', 'events', 'buffer'],
  blockedModules: ['fs', 'child_process', 'net', 'http', 'https', 'process'],
  workingDirectory: './sandbox',
};

export interface SandboxExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
  memoryUsage: number;
  timedOut: boolean;
}

// ==================== 第7层：审计与回滚 ====================

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  operation: Operation;
  decision: SecurityDecision;
  confirmation?: ConfirmationResult;
  executionResult?: SandboxExecutionResult;
  sessionId?: string;
  userId?: string;
}

export interface FileSnapshot {
  id: string;
  path: string;
  content: string;
  hash: string;
  timestamp: number;
  operation: 'create' | 'modify' | 'delete';
}

export interface RollbackResult {
  success: boolean;
  rolledBackFiles: string[];
  errors?: string[];
  timestamp: number;
}

// ==================== 安全事件 ====================

export type SecurityEventType =
  | 'operation_checked'
  | 'operation_blocked'
  | 'operation_allowed'
  | 'confirmation_required'
  | 'confirmation_timeout'
  | 'sandbox_execution'
  | 'audit_log_created'
  | 'rollback_performed'
  | 'danger_detected';

export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface SecurityManagerEvents {
  [K in SecurityEventType]: (event: SecurityEvent) => void;
}

export type SecurityManagerEmitter = EventEmitter<SecurityManagerEvents>;

// ==================== 安全管理器配置 ====================

export interface SecurityConfig {
  configRules: ConfigRules;
  toolPermissionModel: ToolPermissionModel;
  dangerPatterns: DangerPattern[];
  sandboxOptions: SandboxOptions;
  confirmationTimeout: number;
  autoRollbackThreshold: SecurityLevel;
  auditLogRetentionDays: number;
  defaultRole: Role;
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  configRules: DEFAULT_CONFIG_RULES,
  toolPermissionModel: {
    tools: new Map(Object.entries(DEFAULT_TOOL_PERMISSIONS)),
    defaultRole: 'user',
  },
  dangerPatterns: DANGER_PATTERNS,
  sandboxOptions: DEFAULT_SANDBOX_OPTIONS,
  confirmationTimeout: 60000, // 60秒
  autoRollbackThreshold: 'critical',
  auditLogRetentionDays: 90,
  defaultRole: 'user',
};
