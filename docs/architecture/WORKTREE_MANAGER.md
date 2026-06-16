# WorkTree Manager API 文档

**SelfClaw v3.7.0 Loop Engineering 整合方案 M1**

## 概述

WorkTree Manager 是基于 `simple-git` 封装的 Git Worktree 隔离管理器，用于实现 Loop 六要素中的"工作树隔离"能力。

## 核心能力

| 方法 | 功能 |
|------|------|
| `createWorktree()` | 创建工作树 |
| `switchWorktree()` | 切换工作树 |
| `removeWorktree()` | 删除工作树 |
| `listWorktrees()` | 列出所有工作树 |
| `execInWorktree()` | 工作树内执行命令 |
| `getWorktreeStatus()` | 获取工作树状态 |

## 类型定义

### WorktreeInfo
```typescript
interface WorktreeInfo {
  path: string;       // 工作树路径
  branch: string;     // 分支名称
  commit: string;     // 当前 commit hash
  isMain: boolean;     // 是否主工作树
  createdAt: string;   // 创建时间（ISO 字符串）
}
```

### WorktreeStatus
```typescript
interface WorktreeStatus {
  clean: boolean;           // 是否干净（无修改）
  modifiedFiles: string[];   // 已修改的文件列表
  untrackedFiles: string[];  // 未跟踪的文件列表
  ahead: number;            // 领先远程的 commit 数
  behind: number;            // 落后远程的 commit 数
}
```

### CommandResult
```typescript
interface CommandResult {
  stdout: string;      // 标准输出
  stderr: string;      // 标准错误
  exitCode: number;    // 退出码
  durationMs: number;  // 执行耗时（毫秒）
}
```

### WorkTreeError
```typescript
class WorkTreeError extends Error {
  public readonly code: string;      // 错误码
  public readonly path?: string;       // 相关路径
  public readonly operation: string;  // 操作名称

  toJSON(): Record<string, unknown>;  // 序列化方法
}
```

### 错误码

| 错误码 | 含义 |
|--------|------|
| `ALREADY_EXISTS` | 工作树已存在 |
| `BRANCH_EXISTS` | 分支已存在 |
| `NOT_FOUND` | 工作树不存在 |
| `NOT_A_REPO` | 目录不是 Git 仓库 |
| `INVALID_START_POINT` | 无效的起点 |
| `UNCOMMITTED_CHANGES` | 有未提交的更改 |
| `LOCKED` | 工作树已锁定 |
| `CREATE_FAILED` | 创建工作树失败 |
| `REMOVE_FAILED` | 删除工作树失败 |
| `SWITCH_FAILED` | 切换工作树失败 |
| `STATUS_FAILED` | 获取状态失败 |
| `LIST_FAILED` | 列出工作树失败 |
| `EMPTY_COMMAND` | 命令为空 |

## 方法签名

### createWorktree()
```typescript
async createWorktree(
  branch: string,
  basePath?: string,
  options?: Partial<WorktreeOptions>
): Promise<WorktreeInfo>
```

**参数：**
- `branch` - 分支名称
- `basePath` - 工作树创建路径（可选，默认 `{basePath}/worktrees/{branch}`）
- `options` - 额外选项：
  - `startPoint` - 创建分支时基于的起点
  - `createBranch` - 是否创建新分支

**示例：**
```typescript
const manager = WorkTreeManager.getInstance("/path/to/repo");
const worktree = await manager.createWorktree("feature/new-feature");
// 或指定路径
const worktree2 = await manager.createWorktree("feature/other", "/custom/path");
```

---

### switchWorktree()
```typescript
async switchWorktree(path: string): Promise<void>
```

**参数：**
- `path` - 工作树路径

**示例：**
```typescript
await manager.switchWorktree("/path/to/worktree");
```

---

### removeWorktree()
```typescript
async removeWorktree(path: string, force?: boolean): Promise<void>
```

**参数：**
- `path` - 工作树路径
- `force` - 是否强制删除（忽略未提交的更改）

**示例：**
```typescript
// 普通删除（有未提交更改会报错）
await manager.removeWorktree("/path/to/worktree");

// 强制删除
await manager.removeWorktree("/path/to/worktree", true);
```

---

### listWorktrees()
```typescript
async listWorktrees(): Promise<WorktreeInfo[]>
```

**返回：** 所有工作树的列表，包括主仓库

**示例：**
```typescript
const worktrees = await manager.listWorktrees();
console.log(`共有 ${worktrees.length} 个工作树`);
for (const wt of worktrees) {
  console.log(`  ${wt.branch}: ${wt.path} (${wt.isMain ? "主" : "工作树"})`);
}
```

---

### execInWorktree()
```typescript
async execInWorktree(path: string, cmd: string): Promise<CommandResult>
```

**参数：**
- `path` - 工作树路径
- `cmd` - 要执行的命令（如 "status", "log -1"）

**返回：** 命令执行结果

**示例：**
```typescript
// 查看状态
const status = await manager.execInWorktree("/path/to/worktree", "status");
console.log(status.stdout);

// 查看最近一次提交
const log = await manager.execInWorktree("/path/to/worktree", "log -1");
console.log(log.stdout);
```

---

### getWorktreeStatus()
```typescript
async getWorktreeStatus(path: string): Promise<WorktreeStatus>
```

**参数：**
- `path` - 工作树路径

**返回：** 工作树状态

**示例：**
```typescript
const status = await manager.getWorktreeStatus("/path/to/worktree");
if (status.clean) {
  console.log("工作树是干净的");
} else {
  console.log(`有 ${status.modifiedFiles.length} 个修改文件`);
  console.log(`有 ${status.untrackedFiles.length} 个未跟踪文件`);
}
```

---

## 辅助方法

### branchExists()
```typescript
async branchExists(branch: string): Promise<boolean>
```
检查分支是否存在。

### worktreeExists()
```typescript
async worktreeExists(path: string): Promise<boolean>
```
检查工作树是否存在。

### clearCache()
```typescript
clearCache(): void
```
清理缓存的工作树数据。

### getCachedWorktrees()
```typescript
getCachedWorktrees(): WorktreeInfo[]
```
获取缓存的工作树信息列表。

### setGit()
```typescript
setGit(git: SimpleGit): void
```
设置 Git 实例（用于动态切换仓库）。

---

## 单例模式

```typescript
// 获取实例
const manager = WorkTreeManager.getInstance(basePath?, git?, logger?);

// 重置实例（测试用）
WorkTreeManager.resetInstance();
```

**参数：**
- `basePath` - 主仓库路径（可选，默认 "."）
- `git` - Git 实例（可选，默认 simpleGit()）
- `logger` - 日志函数（可选，默认 console.log）

---

## 并发安全

WorkTree Manager 使用 `Map<string, Promise>` 串行化同一路径的操作，防止并发冲突：

```typescript
// 这些操作会串行执行，不会同时操作同一路径
await manager.createWorktree("feature-a", "/path/a");
await manager.createWorktree("feature-b", "/path/b"); // 等待前者完成后执行

// 不同路径可以并发
await Promise.all([
  manager.createWorktree("feature-a", "/path/a"),
  manager.createWorktree("feature-b", "/path/b"),
]);
```

---

## 错误处理

所有方法在失败时会抛出 `WorkTreeError`，而不是裸的 `Error`：

```typescript
try {
  await manager.createWorktree("existing-branch", "/path");
} catch (error) {
  if (error instanceof WorkTreeError) {
    console.log(`错误码: ${error.code}`);
    console.log(`操作: ${error.operation}`);
    console.log(`路径: ${error.path}`);
    console.log(`详情: ${error.toJSON()}`);
  }
}
```

---

## 日志

WorkTree Manager 使用轻量级日志，默认输出到 console：

```
[WorkTree:info] WorkTreeManager initialized for: /path/to/repo
[WorkTree:info] Creating worktree: feature/test at /path/to/worktrees/test
[WorkTree:info] Worktree created successfully
[WorkTree:debug] Listing all worktrees
[WorkTree:info] Found 2 worktrees
```

可以使用自定义日志函数：

```typescript
const logger = (level: string, message: string) => {
  myLogger.log({ level, message, timestamp: Date.now() });
};

const manager = WorkTreeManager.getInstance(repoPath, undefined, logger);
```

---

## 使用示例

### 完整工作流

```typescript
import { WorkTreeManager, WorkTreeError } from "./worktree-manager.js";

async function main() {
  const manager = WorkTreeManager.getInstance("/path/to/repo");
  const baseWorktreePath = "/path/to/worktrees";

  try {
    // 1. 创建新功能分支的工作树
    const worktree = await manager.createWorktree("feature/new-feature", `${baseWorktreePath}/new-feature`);

    console.log(`✅ 工作树创建成功: ${worktree.path}`);

    // 2. 在工作树中执行一些操作
    const status = await manager.execInWorktree(worktree.path, "status");
    console.log(`工作树状态: ${status.stdout}`);

    // 3. 获取工作树状态
    const state = await manager.getWorktreeStatus(worktree.path);
    console.log(`干净: ${state.clean}`);
    console.log(`修改文件: ${state.modifiedFiles.join(", ") || "无"}`);

    // 4. 列出所有工作树
    const allWorktrees = await manager.listWorktrees();
    console.log(`共有 ${allWorktrees.length} 个工作树`);

    // 5. 完成后删除工作树
    await manager.removeWorktree(worktree.path, !state.clean);
    console.log("🗑️ 工作树已删除");

  } catch (error) {
    if (error instanceof WorkTreeError) {
      console.error(`❌ 操作失败: ${error.message}`);
      console.error(`   错误码: ${error.code}`);
      console.error(`   操作: ${error.operation}`);
    } else {
      console.error("❌ 未知错误:", error);
    }
  }
}

main();
```

### 批量创建多个工作树

```typescript
async function createMultipleWorktrees() {
  const manager = WorkTreeManager.getInstance("/path/to/repo");
  const branches = ["feature/a", "feature/b", "feature/c"];

  // 并发创建（不同路径可以并发）
  const results = await Promise.allSettled(
    branches.map(branch => 
      manager.createWorktree(branch, `/worktrees/${branch}`)
    )
  );

  // 统计结果
  const successes = results.filter(r => r.status === "fulfilled");
  const failures = results.filter(r => r.status === "rejected");

  console.log(`成功: ${successes.length}, 失败: ${failures.length}`);
}
```

### 检查并清理不干净的工作树

```typescript
async function cleanupDirtyWorktrees() {
  const manager = WorkTreeManager.getInstance("/path/to/repo");

  const worktrees = await manager.listWorktrees();

  for (const wt of worktrees) {
    if (wt.isMain) continue; // 跳过主仓库

    const status = await manager.getWorktreeStatus(wt.path);

    if (!status.clean) {
      console.log(`清理不干净的工作树: ${wt.path}`);
      console.log(`  修改: ${status.modifiedFiles}`);
      console.log(`  未跟踪: ${status.untrackedFiles}`);

      // 强制删除
      await manager.removeWorktree(wt.path, true);
      console.log(`已删除: ${wt.path}`);
    }
  }
}
```

---

## 依赖

```json
{
  "dependencies": {
    "simple-git": "^3.25.0"
  }
}
```

---

## 设计原则

1. **单例模式 + 依赖注入** - 便于测试和切换仓库
2. **自定义异常** - 使用 `WorkTreeError` 而非裸 `Error`
3. **并发安全** - Map 串行化同路径操作
4. **轻量日志** - 与 evolution 包现有风格一致
5. **TypeScript 类型** - 完整的类型定义和导出

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2025-01-01 | 初始版本 |
