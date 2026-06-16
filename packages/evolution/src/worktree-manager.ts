/**
 * WorkTree Manager - Git Worktree 隔离管理器
 * SelfClaw v3.7.0 Loop Engineering 整合方案 M1
 *
 * 基于 simple-git 封装 git worktree 管理能力
 * 实现工作树隔离、工作树切换、工作树删除、工作树列表等核心功能
 *
 * 设计原则：
 * - 单例模式 + 依赖注入 git 实例
 * - 自定义 WorkTreeError 异常类
 * - Map 串行化同路径并发操作
 * - 与 evolution 包现有风格一致（轻量日志）
 */

import simpleGit, { type SimpleGit } from "simple-git";

// ============================================================================
// Types
// ============================================================================

/** 工作树信息 */
export interface WorktreeInfo {
  /** 工作树路径 */
  path: string;
  /** 分支名称 */
  branch: string;
  /** 当前 commit hash */
  commit: string;
  /** 是否主工作树 */
  isMain: boolean;
  /** 创建时间（ISO 字符串） */
  createdAt: string;
}

/** 工作树状态 */
export interface WorktreeStatus {
  /** 是否干净（无修改） */
  clean: boolean;
  /** 已修改的文件列表 */
  modifiedFiles: string[];
  /** 未跟踪的文件列表 */
  untrackedFiles: string[];
  /** 领先远程的 commit 数 */
  ahead: number;
  /** 落后远程的 commit 数 */
  behind: number;
}

/** 命令执行结果 */
export interface CommandResult {
  /** 标准输出 */
  stdout: string;
  /** 标准错误 */
  stderr: string;
  /** 退出码 */
  exitCode: number;
  /** 执行耗时（毫秒） */
  durationMs: number;
}

/** 工作树操作配置 */
export interface WorktreeOptions {
  /** 主仓库路径（默认当前目录） */
  basePath?: string;
  /** 创建分支时基于的起点 */
  startPoint?: string;
  /** 是否创建新分支 */
  createBranch?: boolean;
  /** 工作树目录名称（可选，默认使用分支名） */
  worktreeName?: string;
}

/** WorkTreeError 自定义异常 */
export class WorkTreeError extends Error {
  public readonly code: string;
  public readonly path?: string;
  public readonly operation: string;

  constructor(
    message: string,
    options: {
      code?: string;
      path?: string;
      operation?: string;
      cause?: unknown;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "WorkTreeError";
    this.code = options.code ?? "WORKTREE_ERROR";
    this.path = options.path;
    this.operation = options.operation ?? "unknown";

    // 保持 Error 的堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WorkTreeError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      path: this.path,
      operation: this.operation,
      stack: this.stack,
    };
  }
}

// ============================================================================
// WorkTree Manager
// ============================================================================

/**
 * Git Worktree 管理器（单例 + 依赖注入）
 *
 * 核心能力：
 * - 创建工作树
 * - 切换工作树
 * - 删除工作树
 * - 列出所有工作树
 * - 工作树内执行命令
 * - 获取工作树状态
 *
 * 并发安全：使用 Map 串行化同一路径的操作
 */
export class WorkTreeManager {
  /** 单例实例 */
  private static _instance: WorkTreeManager | null = null;

  /** Git 实例（可注入 mock） */
  private git: SimpleGit;

  /** 主仓库路径 */
  private basePath: string;

  /** 工作树目录映射（path -> worktree info） */
  private worktrees: Map<string, WorktreeInfo> = new Map();

  /** 操作锁（防止同一路径并发操作） */
  private operationLocks: Map<string, Promise<unknown>> = new Map();

  /** 日志函数（默认 console.log） */
  private log: (level: string, message: string, meta?: Record<string, unknown>) => void;

  /**
   * 私有构造函数（单例模式）
   */
  private constructor(git: SimpleGit, basePath: string, logger?: typeof console.log) {
    this.git = git;
    this.basePath = basePath;
    this.log = logger
      ? (level, msg, meta) => logger(`[WorkTree:${level}]`, msg, meta)
      : (level, msg) => console.log(`[WorkTree:${level}]`, msg);
  }

  /**
   * 获取单例实例
   *
   * @param basePath - 主仓库路径（可选，默认 .）
   * @param git - Git 实例（可选，默认 simpleGit()）
   * @param logger - 日志函数（可选）
   */
  static getInstance(
    basePath: string = ".",
    git?: SimpleGit,
    logger?: typeof console.log
  ): WorkTreeManager {
    if (!WorkTreeManager._instance) {
      const gitInstance = git ?? simpleGit(basePath);
      WorkTreeManager._instance = new WorkTreeManager(gitInstance, basePath, logger);
      WorkTreeManager._instance.log("info", `WorkTreeManager initialized for: ${basePath}`);
    }
    return WorkTreeManager._instance;
  }

  /**
   * 重置单例（用于测试）
   */
  static resetInstance(): void {
    WorkTreeManager._instance = null;
  }

  /**
   * 设置 Git 实例（用于动态切换仓库）
   */
  setGit(git: SimpleGit): void {
    this.git = git;
    this.log("info", "Git instance updated");
  }

  /**
   * 获取操作锁（防止并发）
   * 同一路径的操作会被串行化
   */
  private async acquireLock(path: string): Promise<() => void> {
    // 等待之前的操作完成
    while (this.operationLocks.has(path)) {
      try {
        await this.operationLocks.get(path);
      } catch {
        // 忽略之前的错误，继续等待
      }
    }

    // 创建新的锁
    let release: () => void;
    const lock = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.operationLocks.set(path, lock);

    return () => {
      this.operationLocks.delete(path);
      release!();
    };
  }

  /**
   * 执行带锁的操作
   */
  private async withLock<T>(path: string, operation: () => Promise<T>): Promise<T> {
    const release = await this.acquireLock(path);
    try {
      return await operation();
    } finally {
      release();
    }
  }

  // ==========================================================================
  // Core Operations
  // ==========================================================================

  /**
   * 创建工作树
   *
   * @param branch - 分支名称
   * @param basePath - 工作树创建路径（可选，默认 {basePath}/worktrees/{branch}）
   * @param options - 额外选项
   * @returns 工作树信息
   */
  async createWorktree(
    branch: string,
    basePath?: string,
    options: Partial<WorktreeOptions> = {}
  ): Promise<WorktreeInfo> {
    const worktreePath = basePath ?? `${this.basePath}/worktrees/${branch}`;

    this.log("info", `Creating worktree: ${branch} at ${worktreePath}`, { branch, basePath: worktreePath });

    return this.withLock(worktreePath, async () => {
      try {
        // 构建 git worktree add 命令参数
        const args: string[] = ["add"];

        // 处理强制创建新分支
        if (options.createBranch) {
          args.push("-b", branch);
          if (options.startPoint) {
            args.push(options.startPoint);
          }
        }

        // 添加工作树路径和分支名
        args.push(worktreePath);
        if (!options.createBranch) {
          args.push(branch);
        }

        // 执行 git worktree add
        const result = await this.git.raw(["worktree", ...args]);

        this.log("info", `Worktree created successfully: ${worktreePath}`, { result });

        // 创建工作树信息
        const worktreeInfo: WorktreeInfo = {
          path: worktreePath,
          branch,
          commit: "", // 需要通过后续操作获取
          isMain: false,
          createdAt: new Date().toISOString(),
        };

        // 缓存工作树信息
        this.worktrees.set(worktreePath, worktreeInfo);

        return worktreeInfo;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // 解析常见错误
        if (errorMessage.includes("already exists")) {
          throw new WorkTreeError(
            `工作树已存在: ${worktreePath}`,
            { code: "ALREADY_EXISTS", path: worktreePath, operation: "createWorktree", cause: error }
          );
        }
        if (errorMessage.includes("is not a commit")) {
          throw new WorkTreeError(
            `无效的起点: ${options.startPoint}`,
            { code: "INVALID_START_POINT", path: worktreePath, operation: "createWorktree", cause: error }
          );
        }
        if (errorMessage.includes("branch")) {
          throw new WorkTreeError(
            `分支已存在: ${branch}`,
            { code: "BRANCH_EXISTS", path: worktreePath, operation: "createWorktree", cause: error }
          );
        }

        throw new WorkTreeError(
          `创建工作树失败: ${errorMessage}`,
          { code: "CREATE_FAILED", path: worktreePath, operation: "createWorktree", cause: error }
        );
      }
    });
  }

  /**
   * 切换工作树
   *
   * @param path - 工作树路径
   * @returns void
   */
  async switchWorktree(path: string): Promise<void> {
    this.log("info", `Switching to worktree: ${path}`, { path });

    return this.withLock(path, async () => {
      try {
        // 验证工作树存在
        const worktrees = await this.listWorktrees();
        const target = worktrees.find((wt) => wt.path === path);

        if (!target) {
          throw new WorkTreeError(
            `工作树不存在: ${path}`,
            { code: "NOT_FOUND", path, operation: "switchWorktree" }
          );
        }

        // 验证工作树目录存在
        const git = simpleGit(path);
        const isRepo = await git.checkIsRepo();

        if (!isRepo) {
          throw new WorkTreeError(
            `工作树目录不是 Git 仓库: ${path}`,
            { code: "NOT_A_REPO", path, operation: "switchWorktree" }
          );
        }

        this.log("info", `Successfully switched to worktree: ${path}`, { branch: target.branch });

        // 注意：实际的 "切换" 需要在外部执行 cd 或 path change
        // 这里只是验证和记录
      } catch (error) {
        if (error instanceof WorkTreeError) throw error;

        throw new WorkTreeError(
          `切换工作树失败: ${error instanceof Error ? error.message : String(error)}`,
          { code: "SWITCH_FAILED", path, operation: "switchWorktree", cause: error }
        );
      }
    });
  }

  /**
   * 删除工作树
   *
   * @param path - 工作树路径
   * @param force - 是否强制删除（忽略未提交的更改）
   * @returns void
   */
  async removeWorktree(path: string, force: boolean = false): Promise<void> {
    this.log("info", `Removing worktree: ${path}`, { path, force });

    return this.withLock(path, async () => {
      try {
        // 先检查工作树状态
        const status = await this.getWorktreeStatus(path);

        if (!status.clean && !force) {
          throw new WorkTreeError(
            `工作树有未提交的更改，请使用 force 选项强制删除`,
            {
              code: "UNCOMMITTED_CHANGES",
              path,
              operation: "removeWorktree",
              cause: {
                modifiedFiles: status.modifiedFiles,
                untrackedFiles: status.untrackedFiles,
              },
            }
          );
        }

        // 执行删除
        const args = force ? ["remove", "--force", path] : ["remove", path];
        await this.git.raw(["worktree", ...args]);

        // 清除缓存
        this.worktrees.delete(path);

        this.log("info", `Worktree removed: ${path}`, { forced: force });
      } catch (error) {
        if (error instanceof WorkTreeError) throw error;

        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes("no such worktree")) {
          throw new WorkTreeError(
            `工作树不存在: ${path}`,
            { code: "NOT_FOUND", path, operation: "removeWorktree", cause: error }
          );
        }

        if (errorMessage.includes("locked")) {
          throw new WorkTreeError(
            `工作树已锁定: ${path}`,
            { code: "LOCKED", path, operation: "removeWorktree", cause: error }
          );
        }

        throw new WorkTreeError(
          `删除工作树失败: ${errorMessage}`,
          { code: "REMOVE_FAILED", path, operation: "removeWorktree", cause: error }
        );
      }
    });
  }

  /**
   * 列出所有工作树
   *
   * @returns 工作树信息列表
   */
  async listWorktrees(): Promise<WorktreeInfo[]> {
    this.log("debug", "Listing all worktrees");

    try {
      // 使用 git worktree list --porcelain 获取详细输出
      const result = await this.git.raw(["worktree", "list", "--porcelain"]);

      const worktrees: WorktreeInfo[] = [];
      const lines = result.split("\n");

      let currentWorktree: Partial<WorktreeInfo> | null = null;

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith("worktree ")) {
          if (currentWorktree && currentWorktree.path) {
            worktrees.push(currentWorktree as WorktreeInfo);
          }
          currentWorktree = {
            path: trimmed.substring("worktree ".length).trim(),
            isMain: false,
            createdAt: new Date().toISOString(),
          };
        } else if (trimmed.startsWith("HEAD ")) {
          if (currentWorktree) {
            currentWorktree.commit = trimmed.substring("HEAD ".length).trim();
          }
        } else if (trimmed.startsWith("branch ")) {
          if (currentWorktree) {
            currentWorktree.branch = trimmed.substring("branch ".length).trim();
          }
        } else if (trimmed === "bare") {
          if (currentWorktree) {
            currentWorktree.isMain = false;
          }
        }
      }

      // 添加最后一个工作树
      if (currentWorktree && currentWorktree.path) {
        worktrees.push(currentWorktree as WorktreeInfo);
      }

      // 更新缓存
      for (const wt of worktrees) {
        this.worktrees.set(wt.path, wt);
      }

      this.log("info", `Found ${worktrees.length} worktrees`);

      return worktrees;
    } catch (error) {
      throw new WorkTreeError(
        `列出工作树失败: ${error instanceof Error ? error.message : String(error)}`,
        { code: "LIST_FAILED", operation: "listWorktrees", cause: error }
      );
    }
  }

  /**
   * 在指定工作树内执行命令
   *
   * @param path - 工作树路径
   * @param cmd - 要执行的命令（git 子命令，如 "status", "log -1"）
   * @returns 命令执行结果
   */
  async execInWorktree(path: string, cmd: string): Promise<CommandResult> {
    this.log("debug", `Executing command in worktree: ${path}`, { path, cmd });

    return this.withLock(path, async () => {
      const startTime = Date.now();

      try {
        // 创建工作树的 git 实例
        const worktreeGit = simpleGit(path);

        // 解析命令（支持 "log -1" 这种格式）
        const args = cmd.split(/\s+/).filter(Boolean);

        if (args.length === 0) {
          throw new WorkTreeError(
            `命令不能为空`,
            { code: "EMPTY_COMMAND", path, operation: "execInWorktree" }
          );
        }

        // 验证是 git 仓库
        const isRepo = await worktreeGit.checkIsRepo();
        if (!isRepo) {
          throw new WorkTreeError(
            `工作树目录不是 Git 仓库: ${path}`,
            { code: "NOT_A_REPO", path, operation: "execInWorktree" }
          );
        }

        // 执行命令
        const result = await worktreeGit.raw(args);
        const durationMs = Date.now() - startTime;

        this.log("debug", `Command executed successfully`, { path, cmd, durationMs });

        return {
          stdout: result,
          stderr: "",
          exitCode: 0,
          durationMs,
        };
      } catch (error) {
        const durationMs = Date.now() - startTime;

        if (error instanceof WorkTreeError) throw error;

        // 处理 simple-git 的错误
        const gitError = error as { message?: string; exitCode?: number };
        const errorMessage = gitError.message ?? String(error);
        const exitCode = gitError.exitCode ?? 1;

        this.log("error", `Command execution failed`, { path, cmd, error: errorMessage });

        return {
          stdout: "",
          stderr: errorMessage,
          exitCode,
          durationMs,
        };
      }
    });
  }

  /**
   * 获取工作树状态
   *
   * @param path - 工作树路径
   * @returns 工作树状态
   */
  async getWorktreeStatus(path: string): Promise<WorktreeStatus> {
    this.log("debug", `Getting worktree status: ${path}`, { path });

    return this.withLock(path, async () => {
      try {
        // 创建工作树的 git 实例
        const worktreeGit = simpleGit(path);

        // 验证是 git 仓库
        const isRepo = await worktreeGit.checkIsRepo();
        if (!isRepo) {
          throw new WorkTreeError(
            `工作树目录不是 Git 仓库: ${path}`,
            { code: "NOT_A_REPO", path, operation: "getWorktreeStatus" }
          );
        }

        // 并行获取状态信息
        const [status, branch, logResult] = await Promise.all([
          worktreeGit.status(),
          worktreeGit.branch(),
          worktreeGit.raw(["log", "@{u}..HEAD", "--oneline"]).catch(() => ""),
          // 获取 ahead/behind 信息
        ]);

        // 解析 ahead/behind
        let ahead = 0;
        let behind = 0;

        // 尝试获取远程分支信息
        const currentBranch = branch.current;
        if (currentBranch && branch.branches[currentBranch]) {
          const trackingBranch = branch.branches[currentBranch];
          ahead = (trackingBranch as unknown as { ahead?: number }).ahead ?? 0;
          behind = (trackingBranch as unknown as { behind?: number }).behind ?? 0;
        }

        // 如果没有 tracking 信息，从 status 获取
        if (ahead === 0 && status.tracking) {
          try {
            const aheadBehindResult = await worktreeGit.raw([
              "rev-list",
              "--left-right",
              "--count",
              `${status.tracking}...HEAD`,
            ]);
            const [a, b] = aheadBehindResult.trim().split(/\s+/).map(Number);
            ahead = a || 0;
            behind = b || 0;
          } catch {
            // 忽略错误
          }
        }

        return {
          clean: status.isClean(),
          modifiedFiles: status.modified,
          untrackedFiles: status.not_added,
          ahead,
          behind,
        };
      } catch (error) {
        if (error instanceof WorkTreeError) throw error;

        throw new WorkTreeError(
          `获取工作树状态失败: ${error instanceof Error ? error.message : String(error)}`,
          { code: "STATUS_FAILED", path, operation: "getWorktreeStatus", cause: error }
        );
      }
    });
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * 检查分支是否存在
   */
  async branchExists(branch: string): Promise<boolean> {
    try {
      const branches = await this.git.branchLocal();
      return branch in branches.branches || branches.all.includes(branch);
    } catch {
      return false;
    }
  }

  /**
   * 检查工作树是否存在
   */
  async worktreeExists(path: string): Promise<boolean> {
    const worktrees = await this.listWorktrees();
    return worktrees.some((wt) => wt.path === path);
  }

  /**
   * 清理缓存的工作树数据
   */
  clearCache(): void {
    this.worktrees.clear();
    this.log("info", "Worktree cache cleared");
  }

  /**
   * 获取缓存的工作树信息
   */
  getCachedWorktrees(): WorktreeInfo[] {
    return [...this.worktrees.values()];
  }
}

// ============================================================================
// Named Exports
// ============================================================================

export default WorkTreeManager;
