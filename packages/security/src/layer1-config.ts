/**
 * Layer 1: Application Configuration Rules
 * 第1层：应用配置规则
 * 
 * - 白名单/黑名单目录
 * - 允许的命令列表
 * - 文件大小限制
 * - 超时时间配置
 */

import * as path from 'path';
import {
  ConfigRules,
  Operation,
  OperationType,
  SecurityDecision,
  SecurityLevel,
} from './types.js';

export class ConfigRuleLayer {
  private rules: ConfigRules;

  constructor(rules: Partial<ConfigRules> = {}) {
    this.rules = {
      allowedDirectories: rules.allowedDirectories || ['./projects', './data', './workspace'],
      blockedDirectories: rules.blockedDirectories || ['/etc', '/root', '/sys', '/proc', '~/.ssh', '~/.aws'],
      allowedCommands: rules.allowedCommands || ['ls', 'cat', 'echo', 'pwd', 'whoami', 'git', 'npm', 'node', 'tsx'],
      blockedCommands: rules.blockedCommands || ['rm -rf', 'sudo', 'su', 'chmod', 'chown', 'dd', 'mkfs', ':(){:|:&};:'],
      maxFileSize: rules.maxFileSize || 100 * 1024 * 1024,
      allowedFileTypes: rules.allowedFileTypes || ['.ts', '.js', '.json', '.md', '.txt', '.yaml', '.yml', '.toml'],
      blockedFileTypes: rules.blockedFileTypes || ['.exe', '.bin', '.sh', '.bat', '.cmd', '.ps1'],
      maxExecutionTime: rules.maxExecutionTime || 30000,
      maxMemoryUsage: rules.maxMemoryUsage || 512,
      allowedDomains: rules.allowedDomains || ['localhost', '127.0.0.1', 'npmjs.com', 'github.com'],
      blockedDomains: rules.blockedDomains || [],
      maxNetworkRequests: rules.maxNetworkRequests || 100,
    };
  }

  /**
   * 检查操作是否符合配置规则
   */
  check(operation: Operation): SecurityDecision {
    const reasons: string[] = [];
    let level: SecurityLevel = 'safe';

    // 根据操作类型进行检查
    switch (operation.type) {
      case 'file_read':
      case 'file_write':
      case 'file_delete':
        this.checkFileOperation(operation, reasons);
        break;

      case 'file_execute':
      case 'shell_command':
        this.checkCommandOperation(operation, reasons);
        break;

      case 'code_execute':
        this.checkCodeOperation(operation, reasons);
        break;

      case 'network_request':
        this.checkNetworkOperation(operation, reasons);
        break;

      case 'system_call':
      case 'process_management':
        reasons.push('系统操作默认被阻止');
        level = 'high';
        break;

      case 'env_access':
        this.checkEnvAccess(operation, reasons);
        break;

      default:
        break;
    }

    // 检查是否有阻止原因
    const isBlocked = reasons.some(r => r.includes('blocked') || r.includes('not allowed'));
    
    if (isBlocked) {
      return {
        allowed: false,
        level: this.determineLevel(reasons),
        score: this.calculateScore(reasons),
        reasons,
        layer: 'config-rules',
        requiresConfirmation: false,
        blockingLayer: 'config-rules',
      };
    }

    return {
      allowed: true,
      level,
      score: 0,
      reasons: reasons.length > 0 ? reasons : ['操作符合配置规则'],
      layer: 'config-rules',
      requiresConfirmation: reasons.length > 0,
    };
  }

  /**
   * 检查文件操作
   */
  private checkFileOperation(operation: Operation, reasons: string[]): void {
    const target = operation.target;
    if (!target) return;

    // 检查目录
    if (!this.isDirectoryAllowed(target)) {
      reasons.push(`目标路径不在允许的目录中: ${target}`);
    }
    if (this.isDirectoryBlocked(target)) {
      reasons.push(`目标路径在阻止目录列表中: ${target}`);
    }

    // 检查文件类型
    const ext = path.extname(target).toLowerCase();
    if (this.rules.blockedFileTypes.includes(ext)) {
      reasons.push(`不允许的文件类型: ${ext} (blocked)`);
    }

    // 检查文件大小（写入操作）
    if (operation.type === 'file_write' && operation.content) {
      const contentSize = Buffer.byteLength(operation.content, 'utf8');
      if (contentSize > this.rules.maxFileSize) {
        reasons.push(`文件大小超过限制: ${contentSize} > ${this.rules.maxFileSize}`);
      }
    }
  }

  /**
   * 检查命令操作
   */
  private checkCommandOperation(operation: Operation, reasons: string[]): void {
    const command = operation.target || '';
    const commandLower = command.toLowerCase();

    // 检查阻止命令（精确匹配或部分匹配）
    for (const blocked of this.rules.blockedCommands) {
      if (commandLower.includes(blocked.toLowerCase())) {
        reasons.push(`命令被阻止: ${blocked}`);
      }
    }

    // 检查是否需要确认的命令
    const requiresConfirmationCommands = ['rm', 'sudo', 'chmod', 'chown'];
    for (const cmd of requiresConfirmationCommands) {
      if (commandLower.startsWith(cmd)) {
        reasons.push(`危险命令需要确认: ${cmd}`);
      }
    }
  }

  /**
   * 检查代码执行
   */
  private checkCodeOperation(_operation: Operation, _reasons: string[]): void {
    // 代码执行总是需要进一步检查
    // 这里只是第1层检查，更详细的检查在后面层
  }

  /**
   * 检查网络操作
   */
  private checkNetworkOperation(operation: Operation, reasons: string[]): void {
    const target = operation.target || '';
    
    // 检查域名白名单
    if (this.rules.allowedDomains.length > 0) {
      const domainMatch = this.rules.allowedDomains.some(domain => 
        target.includes(domain) || target.includes(`://${domain}`)
      );
      if (!domainMatch) {
        reasons.push(`域名不在白名单中: ${target}`);
      }
    }

    // 检查域名黑名单
    for (const blocked of this.rules.blockedDomains) {
      if (target.includes(blocked)) {
        reasons.push(`域名被阻止: ${blocked}`);
      }
    }
  }

  /**
   * 检查环境变量访问
   */
  private checkEnvAccess(operation: Operation, reasons: string[]): void {
    const target = operation.target || '';
    const sensitiveEnvVars = [
      'API_KEY', 'SECRET', 'PASSWORD', 'TOKEN', 'PRIVATE',
      'AWS_', 'GITHUB_', 'NPM_TOKEN', 'CI'
    ];

    for (const sensitive of sensitiveEnvVars) {
      if (target.toUpperCase().includes(sensitive)) {
        reasons.push(`可能访问敏感环境变量: ${sensitive}`);
      }
    }
  }

  /**
   * 检查目录是否允许
   */
  private isDirectoryAllowed(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);
    return this.rules.allowedDirectories.some(allowedDir => {
      const resolvedAllowed = path.resolve(allowedDir);
      return resolved.startsWith(resolvedAllowed);
    });
  }

  /**
   * 检查目录是否被阻止
   */
  private isDirectoryBlocked(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);
    return this.rules.blockedDirectories.some(blockedDir => {
      // 处理波浪号路径
      const expandedBlocked = blockedDir.replace('~', process.env.HOME || '');
      const resolvedBlocked = path.resolve(expandedBlocked);
      return resolved.startsWith(resolvedBlocked);
    });
  }

  /**
   * 根据原因确定安全级别
   */
  private determineLevel(reasons: string[]): SecurityLevel {
    // 简单的级别判断逻辑
    const hasBlocked = reasons.some(r => r.includes('blocked') || r.includes('not allowed'));
    if (hasBlocked) return 'high';
    
    if (reasons.length >= 3) return 'medium';
    if (reasons.length >= 1) return 'low';
    return 'safe';
  }

  /**
   * 计算风险分数
   */
  private calculateScore(reasons: string[]): number {
    let score = 0;
    for (const reason of reasons) {
      if (reason.includes('blocked') || reason.includes('not allowed')) {
        score += 30;
      } else if (reason.includes('危险') || reason.includes('dangerous')) {
        score += 25;
      } else {
        score += 10;
      }
    }
    return Math.min(100, score);
  }

  /**
   * 更新配置规则
   */
  updateRules(rules: Partial<ConfigRules>): void {
    this.rules = { ...this.rules, ...rules };
  }

  /**
   * 获取当前配置规则
   */
  getRules(): ConfigRules {
    return { ...this.rules };
  }

  /**
   * 添加允许的目录
   */
  addAllowedDirectory(dir: string): void {
    if (!this.rules.allowedDirectories.includes(dir)) {
      this.rules.allowedDirectories.push(dir);
    }
  }

  /**
   * 添加阻止的目录
   */
  addBlockedDirectory(dir: string): void {
    if (!this.rules.blockedDirectories.includes(dir)) {
      this.rules.blockedDirectories.push(dir);
    }
  }

  /**
   * 添加允许的命令
   */
  addAllowedCommand(cmd: string): void {
    if (!this.rules.allowedCommands.includes(cmd)) {
      this.rules.allowedCommands.push(cmd);
    }
  }

  /**
   * 添加阻止的命令
   */
  addBlockedCommand(cmd: string): void {
    if (!this.rules.blockedCommands.includes(cmd)) {
      this.rules.blockedCommands.push(cmd);
    }
  }
}
