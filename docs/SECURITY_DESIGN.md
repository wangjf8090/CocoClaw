# SelfClaw 7-Layer Security System Design Document
# SelfClaw 7层纵深防御安全系统设计文档

## 1. 系统概述

### 1.1 设计目标

SelfClaw安全系统实现**7层纵深防御架构**，从配置规则到审计回滚，全方位保护AI Agent的安全执行。

**设计原则**:
- **分层防御**: 多层检查，层层过滤
- **最小权限**: RBAC角色基访问控制
- **默认安全**: 开箱即用的安全配置
- **可追溯**: 完整的操作审计日志
- **可恢复**: 自动快照与回滚机制

### 1.2 7层防御架构

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 7: Audit & Auto Rollback                              │
│  ───────────────────────────────────────────────────────    │
│  操作审计日志 / 文件变更快照 / 自动回滚机制                    │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Layer 6: Sandbox Isolation                                  │
│  ───────────────────────────────────────────────────────    │
│  Node.js vm隔离 / 资源限制 / 文件/网络访问控制                 │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Layer 5: User Confirmation                                  │
│  ───────────────────────────────────────────────────────    │
│  交互式确认 / 批量确认 / 超时处理                              │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Danger Classifier                                  │
│  ───────────────────────────────────────────────────────    │
│  正则模式匹配 / 危险命令检测 / 风险等级评估                    │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: AST Analysis                                       │
│  ───────────────────────────────────────────────────────    │
│  Tree-sitter解析 / 危险API检测 / 代码语义分析                  │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Tool Permission Model                              │
│  ───────────────────────────────────────────────────────    │
│  RBAC角色权限 / 工具级别定义 / 频率限制                        │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Config Rules                                       │
│  ───────────────────────────────────────────────────────    │
│  目录白名单/黑名单 / 命令白名单 / 文件大小限制 / 超时配置        │
└─────────────────────────────────────────────────────────────┘
                                 ↑
                          操作请求输入
```

---

## 2. Layer 1: 应用配置规则

### 2.1 核心功能

第1层是最基础的边界控制，通过配置规则过滤明显不符合安全策略的操作。

### 2.2 配置项详解

#### 目录控制

```typescript
interface DirectoryRules {
  allowedDirectories: string[];    // 允许访问的目录白名单
  blockedDirectories: string[];    // 阻止访问的目录黑名单
}

// 默认配置
DEFAULT = {
  allowedDirectories: ['./projects', './data', './workspace'],
  blockedDirectories: [
    '/etc',           // 系统配置
    '/root',          // root目录
    '/sys',           // 系统文件
    '/proc',          // 进程文件
    '~/.ssh',         // SSH密钥
    '~/.aws',         // AWS凭证
    '~/.git-credentials'
  ]
};
```

#### 命令控制

```typescript
interface CommandRules {
  allowedCommands: string[];   // 允许的命令
  blockedCommands: string[];   // 阻止的危险命令
}

// 默认阻止的危险命令
blockedCommands = [
  'rm -rf',      // 递归强制删除
  'sudo',        // 特权提升
  'su ',         // 切换用户
  'chmod 777',   // 全局可写
  'chown',       // 改变文件所有者
  'mkfs',        // 格式化磁盘
  'dd ',         // 底层磁盘写入
  ':(){:|:&};:'  // Fork炸弹
];
```

#### 资源限制

```typescript
interface ResourceLimits {
  maxFileSize: number;        // bytes (默认 100MB)
  maxExecutionTime: number;   // ms (默认 30秒)
  maxMemoryUsage: number;     // MB (默认 512MB)
  maxNetworkRequests: number; // per minute (默认 100)
}
```

#### 网络控制

```typescript
interface NetworkRules {
  allowedDomains: string[];  // 域名白名单
  blockedDomains: string[];  // 域名黑名单
}

DEFAULT.allowedDomains = [
  'localhost',
  '127.0.0.1',
  'npmjs.com',
  'github.com',
  'api.openai.com'
];
```

### 2.3 API 参考

```typescript
class ConfigRuleLayer {
  // 检查操作
  check(operation: Operation): SecurityDecision;

  // 动态更新规则
  addAllowedDirectory(dir: string): void;
  addBlockedDirectory(dir: string): void;
  addAllowedCommand(cmd: string): void;
  addBlockedCommand(cmd: string): void;

  // 获取当前规则
  getRules(): ConfigRules;
}
```

---

## 3. Layer 2: 工具权限模型

### 3.1 核心功能

第2层实现基于角色的访问控制（RBAC），为不同工具定义不同的权限级别。

### 3.2 角色层级

```
Owner (所有者)
    │
    ├─ Admin (管理员): 系统配置 + 所有权限
    │
    ├─ Developer (开发者): 代码执行 + 网络 + 文件
    │
    ├─ User (普通用户): 基本操作 + 安全工具
    │
    └─ Guest (访客): 只读查询

权限继承：高等级角色自动拥有低等级角色的所有权限
```

### 3.3 角色权限矩阵

| 权限 | Guest | User | Developer | Admin | Owner |
|------|-------|------|-----------|-------|-------|
| 只读访问 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 基础查询 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 文件写入 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 安全工具执行 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 代码执行 | ❌ | ❌ | ✅ | ✅ | ✅ |
| 网络访问 | ❌ | ❌ | ✅ | ✅ | ✅ |
| 系统配置 | ❌ | ❌ | ❌ | ✅ | ✅ |
| 所有权限 | ❌ | ❌ | ❌ | ❌ | ✅ |

### 3.4 工具权限定义

```typescript
interface ToolPermission {
  name: string;                    // 工具名称
  requiredRole: Role;              // 需要的最低角色
  allowedOperations: OperationType[]; // 允许的操作类型
  maxFrequency: number;            // 每分钟最大调用次数
  requiresAudit: boolean;          // 是否需要审计记录
}

// 内置工具权限示例
const DEFAULT_PERMISSIONS = {
  'memory.search': {
    name: 'memory.search',
    requiredRole: 'user',
    allowedOperations: ['tool_invocation'],
    maxFrequency: 60,
    requiresAudit: false
  },
  'file.write': {
    name: 'file.write',
    requiredRole: 'user',
    allowedOperations: ['file_write'],
    maxFrequency: 30,
    requiresAudit: true
  },
  'shell.exec': {
    name: 'shell.exec',
    requiredRole: 'developer',
    allowedOperations: ['shell_command'],
    maxFrequency: 10,
    requiresAudit: true
  },
  'code.run': {
    name: 'code.run',
    requiredRole: 'developer',
    allowedOperations: ['code_execute'],
    maxFrequency: 30,
    requiresAudit: true
  }
};
```

### 3.5 频率限制

使用滑动窗口算法实现调用频率限制：

```typescript
interface FrequencyTracker {
  toolId: string;
  windowStart: number;  // 窗口开始时间
  count: number;        // 当前窗口调用计数
  windowSize: number;   // 窗口大小 (ms), 默认 60000
}
```

### 3.6 API 参考

```typescript
class ToolPermissionLayer {
  // 角色管理
  setCurrentRole(role: Role): void;
  getCurrentRole(): Role;

  // 权限检查
  check(operation: Operation, toolName?: string): SecurityDecision;
  canPerform(role: Role, operationType: OperationType): boolean;

  // 工具注册
  registerTool(permission: ToolPermission): void;
  unregisterTool(toolName: string): boolean;
  getToolPermission(toolName: string): ToolPermission | undefined;
  getAllTools(): string[];

  // 频率管理
  resetFrequency(toolName?: string): void;
}
```

---

## 4. Layer 3: AST 代码分析

### 4.1 核心功能

第3层通过抽象语法树（AST）分析代码内容，检测潜在的危险模式和安全隐患。

### 4.2 检测的危险模式

#### 代码注入类

| 模式 | 风险 | 说明 |
|------|------|------|
| `eval()` | 高 | 执行任意代码 |
| `new Function()` | 高 | 动态代码构造 |
| `setTimeout(string)` | 中 | 延迟执行代码 |
| `setInterval(string)` | 中 | 周期执行代码 |

#### 进程操作类

| 模式 | 风险 | 说明 |
|------|------|------|
| `child_process` | 高 | 创建子进程 |
| `spawn()` / `exec()` | 高 | 执行系统命令 |
| `fork()` | 高 | 创建新进程 |
| `process.kill()` | 中 | 终止进程 |

#### 文件系统类

| 模式 | 风险 | 说明 |
|------|------|------|
| `require('fs')` | 中 | 文件系统访问 |
| `fs.writeFile()` | 中 | 文件写入 |
| `fs.unlink()` / `fs.rm()` | 高 | 文件删除 |

#### 网络访问类

| 模式 | 风险 | 说明 |
|------|------|------|
| `http` / `https` | 中 | HTTP请求 |
| `net` / `dgram` | 中 | 网络套接字 |
| `fetch()` / `axios` | 中 | 网络请求 |

#### 环境与系统类

| 模式 | 风险 | 说明 |
|------|------|------|
| `process.env` | 中 | 环境变量访问 |
| `process.exit()` | 中 | 进程退出 |
| `__proto__` | 中 | 原型污染风险 |

### 4.3 风险评分系统

```typescript
// 单项风险权重
const RISK_WEIGHTS = {
  EVAL: 30,
  CHILD_PROCESS: 35,
  FS_DELETE: 25,
  FS_WRITE: 15,
  NETWORK: 20,
  PROCESS_ACCESS: 15,
  ENV_ACCESS: 10,
  PROTO_POLLUTION: 20,
  INFINITE_LOOP: 15,
  DYNAMIC_REQUIRE: 25
};

// 总分 = Σ(匹配项权重)，归一化到 0-100
```

### 4.4 安全级别映射

| 分数范围 | 级别 | 颜色 | 动作 |
|---------|------|------|------|
| 0-10 | Safe | 🟢 | 允许执行 |
| 10-30 | Low | 🟢 | 允许，记录日志 |
| 30-60 | Medium | 🟡 | 需要用户确认 |
| 60-80 | High | 🟠 | 强烈警告，需要确认 |
| 80-100 | Critical | 🔴 | 默认阻止 |

### 4.5 API 参考

```typescript
class AstAnalyzerLayer {
  // 分析代码
  analyze(
    code: string,
    language?: 'javascript' | 'typescript'
  ): AstAnalysisResult;

  // 安全检查
  check(operation: Operation): SecurityDecision;

  // 生成详细报告
  getAnalysisReport(code: string): string;

  // 快速安全检查
  isSafeToExecute(code: string): {
    safe: boolean;
    level: SecurityLevel;
    reasons: string[];
  };
}
```

---

## 5. Layer 4: 危险模式分类器

### 5.1 核心功能

第4层使用正则表达式和规则库检测命令和代码中的危险模式，作为AST分析的补充。

### 5.2 内置危险模式库

#### 文件系统危险 (Category: filesystem)

```typescript
{
  id: 'FS001',
  pattern: /rm\s+-rf/,
  level: 'critical',
  description: '递归强制删除文件',
  category: 'filesystem'
},
{
  id: 'FS002',
  pattern: /mkfs|fdisk/,
  level: 'critical',
  description: '磁盘格式化操作',
  category: 'filesystem'
},
{
  id: 'FS003',
  pattern: /dd\s+(if|of)=/,
  level: 'high',
  description: '底层磁盘写入',
  category: 'filesystem'
}
```

#### 权限提升 (Category: privilege)

```typescript
{
  id: 'PR001',
  pattern: /sudo|su\s+/,
  level: 'high',
  description: '特权提升命令',
  category: 'privilege'
},
{
  id: 'PR002',
  pattern: /chmod\s+777|chown\s+/,
  level: 'medium',
  description: '权限修改操作',
  category: 'privilege'
}
```

#### 拒绝服务 (Category: dos)

```typescript
{
  id: 'DOS001',
  pattern: /:\(\)\s*\{:\s*\|\s*:\s*&\s*\};\s*:/,
  level: 'critical',
  description: 'Fork炸弹',
  category: 'dos'
},
{
  id: 'DOS002',
  pattern: /while\s*\(\s*true\s*\)|for\s*\(\s*;;\s*\)/,
  level: 'medium',
  description: '无限循环',
  category: 'dos'
}
```

#### 数据泄露 (Category: exfiltration)

```typescript
{
  id: 'EX001',
  pattern: /curl.*http|wget.*http/,
  level: 'medium',
  description: '可能的数据外泄',
  category: 'exfiltration'
},
{
  id: 'EX002',
  pattern: /nc\s+.*\d+\.\d+\.\d+\.\d+/,
  level: 'high',
  description: 'Netcat反向连接',
  category: 'exfiltration'
}
```

### 5.3 模式匹配算法

```typescript
function classify(content: string): ClassifierResult {
  const matched: DangerPattern[] = [];
  
  // 1. 精确字符串匹配
  // 2. 正则表达式匹配
  // 3. 多模式组合检测
  
  // 取最高风险级别作为最终级别
  const level = determineHighestLevel(matched);
  
  return {
    isDangerous: matched.length > 0,
    level,
    score: calculateScore(matched),
    matchedPatterns: matched,
    reasons: matched.map(p => p.description)
  };
}
```

### 5.4 API 参考

```typescript
class DangerClassifierLayer {
  // 检查操作
  check(operation: Operation): SecurityDecision;

  // 分类检测
  classify(content: string): ClassifierResult;

  // 模式管理
  addPattern(pattern: DangerPattern): void;
  addPatterns(patterns: DangerPattern[]): void;
  removePattern(patternId: string): boolean;
  getAllPatterns(): DangerPattern[];

  // 按类别查询
  getPatternsByCategory(category: string): DangerPattern[];
  getPatternsByLevel(level: SecurityLevel): DangerPattern[];

  // 测试
  testPattern(patternId: string, content: string): boolean;
  batchTest(content: string): { patternId: string; matched: boolean }[];

  // 报告
  generateReport(content: string): string;
  getStats(): { total: number; byCategory: Record<string, number>; byLevel: Record<SecurityLevel, number> };
}
```

---

## 6. Layer 5: 用户确认机制

### 6.1 核心功能

第5层对高风险操作要求用户交互式确认，提供人工把关机制。

### 6.2 确认触发条件

| 安全级别 | 是否需要确认 | 超时 |
|---------|------------|------|
| Safe | ❌ | - |
| Low | ❌ | - |
| Medium | ✅ | 60秒 |
| High | ✅ | 30秒 |
| Critical | ✅ | 15秒 |

### 6.3 确认请求生命周期

```
  操作请求
      │
      ▼
  安全检查 → 发现高风险
      │
      ▼
  创建ConfirmationRequest
      │
      ├─ 生成唯一ID
      ├─ 设置过期时间
      └─ 加入待处理队列
      │
      ▼
  用户确认？
   /      \
Yes        No
│           │
▼           ▼
继续执行   拒绝操作
清除请求   清除请求
记录审计   记录审计
```

### 6.4 数据结构

```typescript
interface ConfirmationRequest {
  id: string;                          // 请求ID (UUID)
  operation: Operation;                // 操作详情
  level: SecurityLevel;                // 风险级别
  reasons: string[];                   // 风险原因
  createdAt: number;                   // 创建时间
  expiresAt: number;                   // 过期时间
  sessionId?: string;                  // 关联会话
}

interface ConfirmationResult {
  confirmed: boolean;                  // 是否确认
  timestamp: number;                   // 确认时间
  confirmedBy?: string;                // 确认者
  sessionId?: string;                  // 会话ID
}
```

### 6.5 API 参考

```typescript
class ConfirmationLayer {
  // 检查
  check(operation: Operation, decision: SecurityDecision): SecurityDecision;

  // 确认操作
  confirm(requestId: string, confirmedBy?: string): ConfirmationResult;
  deny(requestId: string, deniedBy?: string): ConfirmationResult;

  // 查询
  getPendingRequests(): ConfirmationRequest[];
  getSessionRequests(sessionId: string): ConfirmationRequest[];
  isPending(requestId: string): boolean;
  getRequest(requestId: string): ConfirmationRequest | undefined;

  // 批量操作
  batchConfirm(sessionId: string, confirmedBy?: string): { confirmed: number; errors: string[] };
  batchDeny(sessionId: string, deniedBy?: string): { denied: number };

  // 清理
  cleanExpired(): number;

  // 超时配置
  setTimeout(timeout: number): void;
  getTimeout(): number;

  // 统计
  getStats(): { pending: number; byLevel: Record<SecurityLevel, number> };

  // 事件
  on(event: 'request_created' | 'request_confirmed' | 'request_denied' | 'request_timeout', 
     handler: Function): void;
}
```

---

## 7. Layer 6: 沙箱隔离

### 7.1 核心功能

第6层提供代码执行的隔离环境，限制资源访问，防止恶意代码影响主机系统。

### 7.2 Node.js VM 隔离

#### 沙箱上下文

```typescript
interface SandboxContext {
  // 限制的全局对象
  console: SandboxedConsole;          // 沙箱化console
  setTimeout: SandboxedTimeout;        // 有超时限制
  setInterval: SandboxedInterval;      // 有周期限制
  clearTimeout: typeof clearTimeout;
  clearInterval: typeof clearInterval;

  // 安全的内置对象
  JSON: JSON;
  Math: Math;
  Date: DateConstructor;
  String: StringConstructor;
  Number: NumberConstructor;
  Boolean: BooleanConstructor;
  Array: ArrayConstructor;
  Object: ObjectConstructor;
  RegExp: RegExpConstructor;
  Error: ErrorConstructor;

  // 工作目录信息
  __dirname: string;                   // 仅限沙箱目录
  __filename: string;                  // 仅限沙箱文件

  // 以下被禁用:
  // - require / import
  // - process
  // - Buffer (可选)
  // - fs / http / net 等模块
}
```

#### 模块白名单/黑名单

```typescript
interface ModuleAccess {
  allowedModules: string[];  // 允许导入的模块
  blockedModules: string[];  // 阻止导入的模块
}

DEFAULT = {
  allowedModules: ['path', 'util', 'events', 'buffer'],
  blockedModules: ['fs', 'child_process', 'net', 'http', 'https', 'process']
};
```

### 7.3 资源限制

```typescript
interface SandboxLimits {
  executionTimeout: number;   // 执行超时 (ms), 默认 30000
  memoryLimit: number;        // 内存限制 (MB), 默认 512
  cpuLimit: number;           // CPU使用率限制 (%), 默认 50
  maxOutputSize: number;      // 输出大小限制 (bytes), 默认 1MB
}
```

### 7.4 文件系统隔离

```
沙箱工作目录: ./sandbox/<session-id>/

该目录内:
- 允许读写
- 允许创建子目录
- 限制总大小

该目录外:
- 所有访问被阻止
```

### 7.5 网络访问控制

```typescript
interface NetworkPolicy {
  allowNetwork: boolean;          // 是否允许网络访问
  allowedOutboundPorts: number[]; // 允许的出站端口
  allowedDomains: string[];       // 允许的域名
  maxRequestsPerMinute: number;   // 每分钟最大请求数
}

// 默认: 禁止网络访问
DEFAULT.allowNetwork = false;
```

### 7.6 API 参考

```typescript
class SandboxLayer {
  // 检查
  check(operation: Operation): SecurityDecision;

  // 执行代码
  executeInSandbox(code: string): Promise<SandboxExecutionResult>;

  // 模块权限检查
  isModuleAllowed(moduleName: string): boolean;

  // 配置
  updateOptions(options: Partial<SandboxOptions>): void;
  getOptions(): SandboxOptions;

  // 清理
  cleanup(): Promise<void>;
}

// 执行结果
interface SandboxExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;      // ms
  memoryUsage: number;        // MB
  timedOut: boolean;
}
```

---

## 8. Layer 7: 审计与自动回滚

### 8.1 核心功能

第7层提供完整的审计追踪和自动恢复机制，确保所有操作可追溯，错误可回滚。

### 8.2 审计日志

#### 日志结构

```typescript
interface AuditLogEntry {
  id: string;                          // 日志ID
  timestamp: number;                   // 时间戳
  operation: Operation;                // 操作详情
  decision: SecurityDecision;          // 安全决策
  confirmation?: ConfirmationResult;   // 确认信息
  executionResult?: SandboxExecutionResult; // 执行结果
  sessionId?: string;                  // 会话ID
  userId?: string;                     // 用户ID
}
```

#### 持久化格式

使用按日期分割的JSONL格式：

```
logs/
  └─ security/
      ├─ audit-2024-01-15.log
      ├─ audit-2024-01-16.log
      └─ audit-2024-01-17.log
```

每条日志一行JSON：

```json
{"id":"abc123","timestamp":1705267200000,"operation":{...},"decision":{...}}
```

#### 日志保留策略

- 默认保留 90 天
- 超过保留期的日志自动归档或删除
- 可配置保留天数

### 8.3 文件快照与回滚

#### 快照结构

```typescript
interface FileSnapshot {
  id: string;                          // 快照ID
  path: string;                        // 文件路径
  content: string;                     // 文件内容快照
  hash: string;                        // SHA256内容哈希
  timestamp: number;                   // 创建时间
  operation: 'create' | 'modify' | 'delete'; // 触发快照的操作
}
```

#### 存储位置

```
logs/
  └─ snapshots/
      ├─ snapshot-uuid1.json
      ├─ snapshot-uuid2.json
      └─ ...
```

#### 自动回滚触发条件

当检测到以下情况时自动触发回滚：

1. **Critical 级别风险操作**
2. **检测到文件损坏**
3. **系统异常终止前**
4. **用户手动触发**

#### 回滚流程

```
  触发回滚
      │
      ▼
  查找相关快照
      │
      ▼
  验证快照完整性
      │
      ▼
  按时间逆序恢复
      │
      ├─ 恢复删除的文件
      ├─ 恢复修改的文件
      └─ 删除新建的文件
      │
      ▼
  记录回滚日志
      │
      ▼
  通知用户
```

### 8.4 API 参考

```typescript
class AuditRollbackLayer {
  // 初始化
  initialize(): Promise<void>;

  // 审计
  logOperation(operation: Operation, decision: SecurityDecision, ...): void;
  queryAuditLogs(options: {
    sessionId?: string;
    operationType?: string;
    level?: SecurityLevel;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): AuditLogEntry[];
  getAuditStats(): { totalEntries: number; /* ... */ };

  // 快照
  createSnapshot(filePath: string, operation: 'create' | 'modify' | 'delete'): Promise<FileSnapshot>;
  getSnapshots(): FileSnapshot[];

  // 回滚
  rollback(snapshotId: string): Promise<RollbackResult>;
  rollbackBySession(sessionId: string): Promise<RollbackResult>;

  // 自动回滚阈值
  setAutoRollbackThreshold(level: SecurityLevel): void;
  setRetentionDays(days: number): void;

  // 检查接口
  check(operation: Operation, decision: SecurityDecision): SecurityDecision;
}

interface RollbackResult {
  success: boolean;
  rolledBackFiles: string[];
  errors?: string[];
  timestamp: number;
}
```

---

## 9. Security Manager 统一接口

### 9.1 核心类

```typescript
class SecurityManager {
  // 分层实例
  layer1: ConfigRuleLayer;
  layer2: ToolPermissionLayer;
  layer3: AstAnalyzerLayer;
  layer4: DangerClassifierLayer;
  layer5: ConfirmationLayer;
  layer6: SandboxLayer;
  layer7: AuditRollbackLayer;

  // 初始化
  initialize(): Promise<void>;

  // 主检查入口 - 执行完整7层检查
  checkOperation(operation: Operation, toolName?: string): Promise<SecurityDecision>;

  // 快捷方法
  setCurrentRole(role: Role): void;
  getCurrentRole(): Role;
  confirmOperation(requestId: string, confirmedBy?: string): ConfirmationResult;
  denyOperation(requestId: string, deniedBy?: string): ConfirmationResult;
  getPendingConfirmations(): ConfirmationRequest[];
  executeInSandbox(code: string): Promise<SandboxExecutionResult>;
  createSnapshot(filePath: string, operation: 'create' | 'modify' | 'delete'): Promise<FileSnapshot>;
  rollback(snapshotId: string): Promise<RollbackResult>;
  queryAuditLogs(options: any): AuditLogEntry[];
  getStats(): any;

  // 报告
  getCodeAnalysisReport(code: string): string;
  getClassificationReport(content: string): string;

  // 事件
  on(event: SecurityEventType, handler: Function): void;
  off(event: SecurityEventType, handler: Function): void;

  // 配置
  getConfig(): SecurityConfig;
  updateConfig(config: Partial<SecurityConfig>): void;
}
```

### 9.2 安全决策数据结构

```typescript
interface SecurityDecision {
  allowed: boolean;                    // 是否允许
  level: SecurityLevel;                // 安全级别
  score: number;                       // 风险分数 0-100
  reasons: string[];                   // 原因说明
  layer: string;                       // 最后检查的层
  requiresConfirmation: boolean;       // 是否需要用户确认
  blockingLayer?: string;              // 阻止的层 (如果被阻止)
}
```

### 9.3 完整检查流程

```typescript
async checkOperation(operation, toolName) {
  // Layer 1: 配置规则检查
  let decision = this.layer1.check(operation);
  if (!decision.allowed) return decision;

  // Layer 2: 工具权限检查
  decision = this.layer2.check(operation, toolName);
  if (!decision.allowed) return decision;

  // Layer 3: AST分析
  decision = this.layer3.check(operation);
  if (!decision.allowed) return decision;

  // Layer 4: 危险模式分类
  decision = this.layer4.check(operation);
  if (!decision.allowed) return decision;

  // Layer 5: 用户确认检查
  decision = this.layer5.check(operation, decision);

  // Layer 6: 沙箱检查
  const sandboxDecision = this.layer6.check(operation);
  decision.reasons.push(...sandboxDecision.reasons);

  // Layer 7: 审计记录
  decision = this.layer7.check(operation, decision);

  return decision;
}
```

---

## 10. 事件系统

### 10.1 事件类型

```typescript
type SecurityEventType =
  | 'operation_checked'     // 操作已检查
  | 'operation_blocked'     // 操作被阻止
  | 'operation_allowed'     // 操作被允许
  | 'confirmation_required' // 需要确认
  | 'confirmation_timeout'  // 确认超时
  | 'sandbox_execution'     // 沙箱执行
  | 'audit_log_created'     // 审计日志创建
  | 'rollback_performed'    // 回滚执行
  | 'danger_detected';      // 检测到危险
```

### 10.2 使用示例

```typescript
// 监听操作阻止事件
security.on('operation_blocked', (event) => {
  console.warn(`操作被阻止: ${event.data.operation}`);
  console.warn(`原因: ${event.data.reason}`);
  console.warn(`阻止层: ${event.data.layer}`);
});

// 监听危险检测事件
security.on('danger_detected', (event) => {
  console.error(`检测到危险: level = ${event.data.level}`);
  console.error(`匹配模式: ${event.data.patterns}`);
});

// 监听回滚事件
security.on('rollback_performed', (event) => {
  console.log(`已回滚 ${event.data.rolledBackFiles.length} 个文件`);
});
```

---

## 11. 配置参考

### 完整配置结构

```typescript
interface SecurityConfig {
  configRules: ConfigRules;
  toolPermissionModel: {
    tools: Map<string, ToolPermission>;
    defaultRole: Role;
  };
  dangerPatterns: DangerPattern[];
  sandboxOptions: SandboxOptions;
  confirmationTimeout: number;
  autoRollbackThreshold: SecurityLevel;
  auditLogRetentionDays: number;
  defaultRole: Role;
}
```

### 推荐配置

#### 开发环境 (宽松)

```typescript
{
  defaultRole: 'developer',
  confirmationTimeout: 120000,  // 2分钟
  autoRollbackThreshold: 'critical'
}
```

#### 生产环境 (严格)

```typescript
{
  defaultRole: 'user',
  confirmationTimeout: 30000,   // 30秒
  autoRollbackThreshold: 'high'
}
```

#### 严格环境 (最安全)

```typescript
{
  defaultRole: 'guest',
  confirmationTimeout: 15000,   // 15秒
  autoRollbackThreshold: 'medium'
}
```

---

## 12. 最佳实践

### 12.1 安全检查清单

在执行高风险操作前，确保：

- [ ] 角色权限正确设置
- [ ] 文件操作在白名单目录内
- [ ] 代码经过AST分析检查
- [ ] 危险命令被过滤
- [ ] 高风险操作已获得用户确认
- [ ] 执行前已创建文件快照
- [ ] 所有操作将被审计记录

### 12.2 定期安全审计

- 每周审查审计日志，查找异常模式
- 每月更新危险模式库
- 每季度审查角色权限分配
- 定期清理过期快照和日志

### 12.3 性能优化建议

- 缓存静态检查结果
- 异步执行非关键层检查
- 批量操作共享检查结果
- 索引审计日志以加速查询

---

## 13. 扩展路线图

### 短期 (v0.3)
- [ ] 集成 web-tree-sitter 实现真实AST解析
- [ ] 添加更多危险模式
- [ ] 支持自定义检查插件

### 中期 (v0.4)
- [ ] WASM 沙箱隔离
- [ ] 机器学习恶意代码分类器
- [ ] 实时威胁情报馈送
- [ ] 异常行为检测

### 长期 (v1.0)
- [ ] 零信任安全模型
- [ ] 行为分析和评分
- [ ] 自动安全策略生成
- [ ] 渗透测试和红队演练

---

**文档版本**: 0.2.0
**最后更新**: ${new Date().toISOString()}
