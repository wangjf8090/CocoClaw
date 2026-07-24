/**
 * Skill Registry - 动态技能注册与斜杠命令路由
 * 
 * P1-2: 技能系统增强
 * 
 * 设计灵感：
 * 1. Cursor Skills：动态加载领域技能（SKILL.md定义 + 斜杠命令调用）
 *    - 技能按SKILL.md标准定义
 *    - 通过斜杠命令（如 /skill-name）快速调用
 *    - 支持技能热加载和卸载
 * 2. 微软Harness技能系统：文件记忆 + 技能系统一体化
 *    - 技能可持久化到文件系统
 *    - 支持技能版本管理和依赖解析
 * 3. SelfClaw Self-Evolution：技能自动发现和进化
 *    - 自动扫描技能目录
 *    - 技能能力自动分类（Capability Bucket）
 *    - 技能质量自动评估
 * 
 * SelfClaw定位：
 * SkillRegistry是技能系统的核心管理器，提供：
 * - 技能注册/注销/热加载
 * - 斜杠命令解析和路由
 * - 技能搜索和发现
 * - 依赖解析
 * - 技能执行生命周期管理
 */

import { EventEmitter } from 'eventemitter3';
import {
  type SkillStandard,
  parseSkillMarkdown,
  validateSkillStandard,
} from './skill-standard.js';

// ==================== 类型定义 ====================

/**
 * 注册的技能信息
 */
export interface RegisteredSkill {
  /** 技能标准定义 */
  standard: SkillStandard;
  /** 注册来源 */
  source: SkillSource;
  /** 注册时间 */
  registeredAt: number;
  /** 最后使用时间 */
  lastUsedAt?: number;
  /** 使用次数 */
  useCount: number;
  /** 是否已加载到内存 */
  loaded: boolean;
  /** 技能文件路径（可选） */
  filePath?: string;
  /** 执行器（可选） */
  executor?: SkillExecutor;
}

/**
 * 技能来源
 */
export type SkillSource =
  | 'built-in'     // 内置技能
  | 'user'         // 用户安装
  | 'auto-evolved' // 自动进化
  | 'imported';    // 外部导入

/**
 * 技能执行器
 */
export type SkillExecutor = (
  input: string,
  context?: Record<string, unknown>
) => Promise<SkillExecutionResult>;

/**
 * 技能执行结果
 */
export interface SkillExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 输出内容 */
  output: string;
  /** 错误信息 */
  error?: string;
  /** 执行时间（ms） */
  latencyMs: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 斜杠命令
 */
export interface SlashCommand {
  /** 命令名称（不含/前缀） */
  name: string;
  /** 关联的技能名称 */
  skillName: string;
  /** 命令描述 */
  description: string;
  /** 命令参数定义 */
  args?: SlashCommandArg[];
  /** 别名 */
  aliases?: string[];
}

/**
 * 斜杠命令参数
 */
export interface SlashCommandArg {
  /** 参数名称 */
  name: string;
  /** 参数描述 */
  description: string;
  /** 是否必填 */
  required: boolean;
  /** 默认值 */
  defaultValue?: string;
}

/**
 * 命令解析结果
 */
export interface ParsedCommand {
  /** 是否为斜杠命令 */
  isCommand: boolean;
  /** 命令名称 */
  commandName?: string;
  /** 关联的技能名称 */
  skillName?: string;
  /** 解析后的参数 */
  args: Record<string, string>;
  /** 原始参数文本 */
  rawArgs: string;
  /** 解析错误 */
  error?: string;
}

/**
 * 技能搜索结果
 */
export interface SkillSearchResult {
  /** 匹配的技能 */
  skill: RegisteredSkill;
  /** 匹配分数（0-1） */
  relevanceScore: number;
  /** 匹配原因 */
  matchReasons: string[];
}

/**
 * 技能注册表配置
 */
export interface SkillRegistryConfig {
  /** 技能扫描目录列表 */
  scanDirectories: string[];
  /** 是否启用热加载 */
  enableHotReload: boolean;
  /** 热加载检查间隔（ms） */
  hotReloadIntervalMs: number;
  /** 是否启用自动发现 */
  enableAutoDiscovery: boolean;
  /** 最大技能数量 */
  maxSkills: number;
  /** 是否启用命令别名 */
  enableAliases: boolean;
}

/**
 * 技能注册表事件
 */
export interface SkillRegistryEvents {
  'skill.registered': [skill: RegisteredSkill];
  'skill.unregistered': [skillName: string];
  'skill.loaded': [skillName: string];
  'skill.unloaded': [skillName: string];
  'skill.executed': [skillName: string, result: SkillExecutionResult];
  'command.parsed': [command: ParsedCommand];
  'command.executed': [commandName: string, result: SkillExecutionResult];
  'discovery.found': [skills: SkillStandard[]];
}

// ==================== 默认配置 ====================

const DEFAULT_REGISTRY_CONFIG: SkillRegistryConfig = {
  scanDirectories: ['./skills'],
  enableHotReload: false,
  hotReloadIntervalMs: 30000,
  enableAutoDiscovery: true,
  maxSkills: 100,
  enableAliases: true,
};

// ==================== Skill Registry 主类 ====================

/**
 * Skill Registry - 动态技能注册与斜杠命令路由
 * 
 * 核心功能：
 * 1. 技能注册/注销/热加载
 * 2. 斜杠命令解析和路由
 * 3. 技能搜索和发现
 * 4. 依赖解析
 * 5. 技能执行生命周期管理
 */
export class SkillRegistry extends EventEmitter<SkillRegistryEvents> {
  private config: SkillRegistryConfig;
  
  /** 已注册技能（name → RegisteredSkill） */
  private skills: Map<string, RegisteredSkill> = new Map();
  
  /** 斜杠命令映射（command → skillName） */
  private commands: Map<string, SlashCommand> = new Map();
  
  /** 命令别名映射（alias → commandName） */
  private aliases: Map<string, string> = new Map();
  
  /** 热加载定时器 */
  private hotReloadTimer?: ReturnType<typeof setInterval>;
  
  /** 文件修改时间缓存 */
  private fileModTimes: Map<string, number> = new Map();

  constructor(config: Partial<SkillRegistryConfig> = {}) {
    super();
    this.config = { ...DEFAULT_REGISTRY_CONFIG, ...config };
  }

  // ===========================================================================
  // 技能注册与注销
  // ===========================================================================

  /**
   * 注册技能
   * 
   * @param standard - 技能标准定义
   * @param source - 注册来源
   * @param executor - 可选的执行器
   * @param filePath - 可选的文件路径
   * @returns 注册的技能信息
   */
  register(
    standard: SkillStandard,
    source: SkillSource = 'user',
    executor?: SkillExecutor,
    filePath?: string
  ): RegisteredSkill {
    // 验证技能标准
    const validation = validateSkillStandard(standard);
    if (!validation.valid) {
      throw new Error(`Invalid skill standard: ${validation.errors.join(', ')}`);
    }

    // 检查是否已存在
    if (this.skills.has(standard.name)) {
      // 如果已存在，更新
      const existing = this.skills.get(standard.name)!;
      existing.standard = standard;
      existing.executor = executor ?? existing.executor;
      existing.filePath = filePath ?? existing.filePath;
      this.emit('skill.registered', existing);
      return existing;
    }

    // 检查最大数量
    if (this.skills.size >= this.config.maxSkills) {
      throw new Error(`Maximum skill limit reached (${this.config.maxSkills})`);
    }

    // 注册
    const registered: RegisteredSkill = {
      standard,
      source,
      registeredAt: Date.now(),
      useCount: 0,
      loaded: true,
      filePath,
      executor,
    };

    this.skills.set(standard.name, registered);

    // 自动注册斜杠命令
    this.autoRegisterCommand(standard);

    this.emit('skill.registered', registered);
    return registered;
  }

  /**
   * 从SKILL.md内容注册技能
   * 
   * @param markdownContent - SKILL.md文件内容
   * @param source - 注册来源
   * @param executor - 可选的执行器
   * @param filePath - 可选的文件路径
   * @returns 注册的技能信息
   */
  registerFromMarkdown(
    markdownContent: string,
    source: SkillSource = 'user',
    executor?: SkillExecutor,
    filePath?: string
  ): RegisteredSkill {
    const standard = parseSkillMarkdown(markdownContent);
    return this.register(standard, source, executor, filePath);
  }

  /**
   * 注销技能
   * 
   * @param skillName - 技能名称
   * @returns 是否成功注销
   */
  unregister(skillName: string): boolean {
    const skill = this.skills.get(skillName);
    if (!skill) return false;

    // 移除关联的命令
    for (const [cmdName, cmd] of this.commands.entries()) {
      if (cmd.skillName === skillName) {
        this.commands.delete(cmdName);
        // 移除别名
        if (cmd.aliases) {
          for (const alias of cmd.aliases) {
            this.aliases.delete(alias);
          }
        }
      }
    }

    this.skills.delete(skillName);
    this.emit('skill.unregistered', skillName);
    return true;
  }

  /**
   * 获取已注册技能
   */
  getSkill(skillName: string): RegisteredSkill | undefined {
    return this.skills.get(skillName);
  }

  /**
   * 获取所有已注册技能
   */
  getAllSkills(): RegisteredSkill[] {
    return Array.from(this.skills.values());
  }

  /**
   * 获取技能数量
   */
  get size(): number {
    return this.skills.size;
  }

  // ===========================================================================
  // 斜杠命令
  // ===========================================================================

  /**
   * 注册斜杠命令
   * 
   * @param command - 命令定义
   */
  registerCommand(command: SlashCommand): void {
    this.commands.set(command.name, command);

    // 注册别名
    if (this.config.enableAliases && command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }
  }

  /**
   * 自动为技能注册斜杠命令
   */
  private autoRegisterCommand(standard: SkillStandard): void {
    const command: SlashCommand = {
      name: standard.name,
      skillName: standard.name,
      description: standard.description,
      aliases: standard.tags?.filter(t => t.startsWith('/')).map(t => t.slice(1)),
    };

    this.registerCommand(command);
  }

  /**
   * 解析斜杠命令
   * 
   * 支持格式：
   * - /command-name
   * - /command-name arg1 arg2
   * - /command-name --key=value
   * - /command-name -k value
   * 
   * @param input - 用户输入文本
   * @returns 解析结果
   */
  parseCommand(input: string): ParsedCommand {
    const trimmed = input.trim();

    // 检查是否为斜杠命令
    if (!trimmed.startsWith('/')) {
      return {
        isCommand: false,
        args: {},
        rawArgs: '',
      };
    }

    // 分割命令和参数
    const parts = trimmed.slice(1).split(/\s+/);
    const rawCommandName = parts[0];
    const rawArgsText = parts.slice(1).join(' ');

    // 解析命令名称（支持别名）
    const commandName = this.aliases.get(rawCommandName) ?? rawCommandName;
    const command = this.commands.get(commandName);

    if (!command) {
      return {
        isCommand: true,
        commandName: rawCommandName,
        args: {},
        rawArgs: rawArgsText,
        error: `Unknown command: /${rawCommandName}`,
      };
    }

    // 解析参数
    const args: Record<string, string> = {};
    const argParts = rawArgsText.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
    
    let argIndex = 0;
    for (const part of argParts) {
      // --key=value 格式
      const longKvMatch = part.match(/^--(\w[\w-]*)=(.*)$/);
      if (longKvMatch) {
        args[longKvMatch[1]] = longKvMatch[2].replace(/^["']|["']$/g, '');
        continue;
      }

      // -k value 格式
      const shortKeyMatch = part.match(/^-(\w)$/);
      if (shortKeyMatch && argIndex < argParts.length - 1) {
        args[shortKeyMatch[1]] = argParts[argIndex + 1]?.replace(/^["']|["']$/g, '') ?? '';
        argIndex++;
        continue;
      }

      // 位置参数
      if (command.args && argIndex < command.args.length) {
        const argDef = command.args[argIndex];
        args[argDef.name] = part.replace(/^["']|["']$/g, '');
      }

      argIndex++;
    }

    // 填充默认值
    if (command.args) {
      for (const argDef of command.args) {
        if (!(argDef.name in args) && argDef.defaultValue !== undefined) {
          args[argDef.name] = argDef.defaultValue;
        }
      }
    }

    const result: ParsedCommand = {
      isCommand: true,
      commandName,
      skillName: command.skillName,
      args,
      rawArgs: rawArgsText,
    };

    this.emit('command.parsed', result);
    return result;
  }

  /**
   * 执行斜杠命令
   * 
   * @param input - 用户输入文本
   * @param context - 可选的上下文
   * @returns 执行结果
   */
  async executeCommand(
    input: string,
    context?: Record<string, unknown>
  ): Promise<SkillExecutionResult> {
    const parsed = this.parseCommand(input);

    if (!parsed.isCommand || !parsed.skillName) {
      return {
        success: false,
        output: '',
        error: parsed.error ?? 'Not a valid command',
        latencyMs: 0,
      };
    }

    const skill = this.skills.get(parsed.skillName);
    if (!skill) {
      return {
        success: false,
        output: '',
        error: `Skill not found: ${parsed.skillName}`,
        latencyMs: 0,
      };
    }

    if (!skill.executor) {
      return {
        success: false,
        output: '',
        error: `Skill has no executor: ${parsed.skillName}`,
        latencyMs: 0,
      };
    }

    // 构造执行输入
    const executionInput = this.buildExecutionInput(parsed, skill);
    
    // 执行
    const startTime = Date.now();
    const result = await skill.executor(executionInput, {
      ...context,
      _command: parsed,
      _skillName: parsed.skillName,
    });

    // 更新使用统计
    skill.useCount++;
    skill.lastUsedAt = Date.now();

    const finalResult = {
      ...result,
      latencyMs: Date.now() - startTime,
    };

    this.emit('skill.executed', parsed.skillName, finalResult);
    this.emit('command.executed', parsed.commandName!, finalResult);

    return finalResult;
  }

  /**
   * 构造执行输入
   */
  private buildExecutionInput(parsed: ParsedCommand, skill: RegisteredSkill): string {
    // 如果有原始参数，直接使用
    if (parsed.rawArgs) {
      return parsed.rawArgs;
    }
    // 否则返回空输入，让技能使用默认行为
    return '';
  }

  // ===========================================================================
  // 技能搜索与发现
  // ===========================================================================

  /**
   * 搜索技能
   * 
   * @param query - 搜索关键词
   * @param options - 搜索选项
   * @returns 搜索结果（按相关度排序）
   */
  search(
    query: string,
    options?: {
      domain?: string;
      capability?: string;
      tags?: string[];
      limit?: number;
    }
  ): SkillSearchResult[] {
    const results: SkillSearchResult[] = [];
    const queryLower = query.toLowerCase();
    const limit = options?.limit ?? 10;

    for (const skill of this.skills.values()) {
      const matchReasons: string[] = [];
      let relevanceScore = 0;

      // 名称匹配
      if (skill.standard.name.toLowerCase().includes(queryLower)) {
        relevanceScore += 0.4;
        matchReasons.push(`名称包含"${query}"`);
      }

      // 描述匹配
      if (skill.standard.description.toLowerCase().includes(queryLower)) {
        relevanceScore += 0.3;
        matchReasons.push(`描述包含"${query}"`);
      }

      // 标签匹配
      if (skill.standard.tags) {
        const matchedTags = skill.standard.tags.filter(t =>
          t.toLowerCase().includes(queryLower)
        );
        if (matchedTags.length > 0) {
          relevanceScore += 0.2;
          matchReasons.push(`标签匹配: ${matchedTags.join(', ')}`);
        }
      }

      // 域匹配
      if (options?.domain && skill.standard.domain === options.domain) {
        relevanceScore += 0.2;
        matchReasons.push(`域匹配: ${options.domain}`);
      }

      // 能力匹配
      if (options?.capability && skill.standard.capability === options.capability) {
        relevanceScore += 0.2;
        matchReasons.push(`能力匹配: ${options.capability}`);
      }

      // 指令匹配
      if (skill.standard.instructions.toLowerCase().includes(queryLower)) {
        relevanceScore += 0.1;
        matchReasons.push(`指令包含"${query}"`);
      }

      if (relevanceScore > 0) {
        results.push({
          skill,
          relevanceScore: Math.min(1, relevanceScore),
          matchReasons,
        });
      }
    }

    // 按相关度排序
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return results.slice(0, limit);
  }

  /**
   * 按域获取技能
   */
  getByDomain(domain: string): RegisteredSkill[] {
    return this.getAllSkills().filter(s => s.standard.domain === domain);
  }

  /**
   * 按能力分类获取技能
   */
  getByCapability(capability: string): RegisteredSkill[] {
    return this.getAllSkills().filter(s => s.standard.capability === capability);
  }

  // ===========================================================================
  // 依赖解析
  // ===========================================================================

  /**
   * 解析技能依赖
   * 
   * @param skillName - 技能名称
   * @returns 依赖链（拓扑排序）
   */
  resolveDependencies(skillName: string): string[] {
    const resolved: string[] = [];
    const visiting = new Set<string>();

    const visit = (name: string): void => {
      if (resolved.includes(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }

      const skill = this.skills.get(name);
      if (!skill) {
        throw new Error(`Dependency not found: ${name}`);
      }

      visiting.add(name);

      // 先解析依赖
      if (skill.standard.dependencies) {
        for (const dep of skill.standard.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(name);
      resolved.push(name);
    };

    visit(skillName);
    return resolved;
  }

  /**
   * 检查技能是否可以执行（所有依赖是否满足）
   */
  canExecute(skillName: string): { canExecute: boolean; missingDeps: string[] } {
    const skill = this.skills.get(skillName);
    if (!skill) {
      return { canExecute: false, missingDeps: [skillName] };
    }

    const missingDeps: string[] = [];
    if (skill.standard.dependencies) {
      for (const dep of skill.standard.dependencies) {
        if (!this.skills.has(dep)) {
          missingDeps.push(dep);
        }
      }
    }

    return {
      canExecute: missingDeps.length === 0,
      missingDeps,
    };
  }

  // ===========================================================================
  // 生命周期管理
  // ===========================================================================

  /**
   * 启动热加载
   */
  startHotReload(): void {
    if (!this.config.enableHotReload) return;
    if (this.hotReloadTimer) return;

    this.hotReloadTimer = setInterval(() => {
      this.checkForChanges();
    }, this.config.hotReloadIntervalMs);
  }

  /**
   * 停止热加载
   */
  stopHotReload(): void {
    if (this.hotReloadTimer) {
      clearInterval(this.hotReloadTimer);
      this.hotReloadTimer = undefined;
    }
  }

  /**
   * 检查文件变化（热加载）
   * 注意：实际文件扫描需要在Node.js环境中实现
   */
  private checkForChanges(): void {
    // 这个方法需要在实际的Node.js环境中实现文件系统扫描
    // 当前作为接口预留
    this.emit('discovery.found', []);
  }

  /**
   * 导出技能注册表状态
   */
  exportState(): {
    skills: Array<{ name: string; source: SkillSource; useCount: number }>;
    commands: Array<{ name: string; skillName: string }>;
    stats: { totalSkills: number; totalCommands: number };
  } {
    return {
      skills: this.getAllSkills().map(s => ({
        name: s.standard.name,
        source: s.source,
        useCount: s.useCount,
      })),
      commands: Array.from(this.commands.entries()).map(([name, cmd]) => ({
        name,
        skillName: cmd.skillName,
      })),
      stats: {
        totalSkills: this.skills.size,
        totalCommands: this.commands.size,
      },
    };
  }

  /**
   * 清空注册表
   */
  clear(): void {
    this.stopHotReload();
    this.skills.clear();
    this.commands.clear();
    this.aliases.clear();
    this.fileModTimes.clear();
  }
}

// ==================== 导出 ====================

export default SkillRegistry;
