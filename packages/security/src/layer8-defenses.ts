/**
 * Layer 8: 四大攻击防御
 * 
 * 防御目标（2026-07-23日报验证）：
 * 1. Friendly Fire：浏览器Agent被诱导点击恶意内容（CVE-2026-39861 CVSS 10.0）
 * 2. MemGhost：邮件中植入虚假记忆，跨会话操纵Agent行为
 * 3. GhostApproval：6大编码助手symlink漏洞，绕过审批
 * 4. PromptArmor：连接器平均每9分钟变化一次，931个连接器6周内变动
 * 
 * 设计原则：
 * - 每层防御独立，可单独启用/禁用
 * - 支持自定义规则
 * - 提供审计日志
 * - 与现有7层安全架构集成
 */

import { SecurityDecision, SecurityLevel, Operation } from './types';

// ==================== 类型定义 ====================

/**
 * 四大攻击防御配置
 */
export interface DefenseLayer8Config {
  /** 是否启用Friendly Fire防御 */
  enableFriendlyFireDefense: boolean;
  /** 是否启用MemGhost防御 */
  enableMemGhostDefense: boolean;
  /** 是否启用GhostApproval防御 */
  enableGhostApprovalDefense: boolean;
  /** 是否启用PromptArmor防御 */
  enablePromptArmorDefense: boolean;
  /** Friendly Fire检测规则 */
  friendlyFireRules: FriendlyFireRule[];
  /** MemGhost检测规则 */
  memGhostRules: MemGhostRule[];
  /** GhostApproval检测规则 */
  ghostApprovalRules: GhostApprovalRule[];
  /** PromptArmor监控配置 */
  promptArmorConfig: PromptArmorConfig;
}

/**
 * Friendly Fire规则
 * 防御：浏览器Agent被诱导点击恶意内容
 */
export interface FriendlyFireRule {
  /** 规则名称 */
  name: string;
  /** 恶意内容模式 */
  patterns: RegExp[];
  /** 风险级别 */
  riskLevel: SecurityLevel;
  /** 描述 */
  description: string;
}

/**
 * MemGhost规则
 * 防御：邮件中植入虚假记忆，跨会话操纵Agent行为
 */
export interface MemGhostRule {
  /** 规则名称 */
  name: string;
  /** 记忆注入模式 */
  pattern: RegExp;
  /** 风险级别 */
  riskLevel: SecurityLevel;
  /** 描述 */
  description: string;
}

/**
 * GhostApproval规则
 * 防御：symlink漏洞绕过审批
 */
export interface GhostApprovalRule {
  /** 规则名称 */
  name: string;
  /** symlink检测模式 */
  pattern: RegExp;
  /** 风险级别 */
  riskLevel: SecurityLevel;
  /** 描述 */
  description: string;
}

/**
 * PromptArmor配置
 * 防御：连接器权限漂移
 */
export interface PromptArmorConfig {
  /** 连接器变更监控间隔（秒） */
  monitorInterval: number;
  /** 工具数量变化阈值 */
  toolCountThreshold: number;
  /** 连接器变化历史记录 */
  connectorHistory: Map<string, ConnectorSnapshot>;
}

/**
 * 连接器快照
 */
export interface ConnectorSnapshot {
  /** 连接器名称 */
  name: string;
  /** 工具列表 */
  tools: string[];
  /** 快照时间戳 */
  timestamp: number;
  /** 权限级别 */
  permissionLevel: 'read' | 'write' | 'admin';
}

/**
 * 攻击检测结果
 */
export interface AttackDetectionResult {
  /** 攻击类型 */
  attackType: 'friendly_fire' | 'mem_ghost' | 'ghost_approval' | 'prompt_armor';
  /** 风险级别 */
  riskLevel: SecurityLevel;
  /** 检测描述 */
  description: string;
  /** 匹配的规则名称 */
  matchedRule: string;
  /** 可疑内容 */
  suspiciousContent?: string;
  /** 建议操作 */
  recommendedAction: 'allow' | 'review' | 'block';
}

// ==================== 默认规则 ====================

const DEFAULT_FRIENDLY_FIRE_RULES: FriendlyFireRule[] = [
  {
    name: 'malicious_link',
    patterns: [
      /javascript:/i,
      /data:text\/html/i,
      /vbscript:/i,
    ],
    riskLevel: 'critical',
    description: '检测到恶意链接协议',
  },
  {
    name: 'clickbait_pattern',
    patterns: [
      /click\s+(here|now|immediately)/i,
      /urgent\s+action\s+required/i,
      /your\s+account\s+(will\s+be|is)\s+(suspended|locked)/i,
    ],
    riskLevel: 'high',
    description: '检测到诱导点击模式',
  },
  {
    name: 'hidden_iframe',
    patterns: [
      /<iframe[^>]*style=["'][^"']*display:\s*none/i,
      /<iframe[^>]*width=["']0/i,
      /<iframe[^>]*height=["']0/i,
    ],
    riskLevel: 'critical',
    description: '检测到隐藏iframe',
  },
];

const DEFAULT_MEM_GHOST_RULES: MemGhostRule[] = [
  {
    name: 'memory_injection_via_email',
    pattern: /(?:remember|note|save)\s+(?:that|this|to\s+memory)[:\s]+/i,
    riskLevel: 'high',
    description: '邮件中植入记忆指令',
  },
  {
    name: 'cross_session_manipulation',
    pattern: /(?:in\s+future|from\s+now\s+on|always|never)\s+(?:do|remember|forget)/i,
    riskLevel: 'high',
    description: '跨会话操纵指令',
  },
  {
    name: 'hidden_metadata',
    pattern: /<meta[^>]*name=["'](?:instruction|command|directive)["']/i,
    riskLevel: 'critical',
    description: 'HTML元数据隐藏指令',
  },
];

const DEFAULT_GHOST_APPROVAL_RULES: GhostApprovalRule[] = [
  {
    name: 'symlink_detection',
    pattern: /(?:ln\s+-s|symlink|symbolic\s+link)\s+/,
    riskLevel: 'critical',
    description: '检测到symlink创建',
  },
  {
    name: 'path_traversal',
    pattern: /\.\.[\\/]/,
    riskLevel: 'high',
    description: '路径遍历尝试',
  },
  {
    name: 'file_descriptor_leak',
    pattern: /\/proc\/\d+\/fd\/\d+/,
    riskLevel: 'critical',
    description: '文件描述符访问',
  },
];

const DEFAULT_PROMPT_ARMOR_CONFIG: PromptArmorConfig = {
  monitorInterval: 300, // 5分钟
  toolCountThreshold: 5,
  connectorHistory: new Map(),
};

// ==================== Layer 8 主类 ====================

/**
 * Layer 8: 四大攻击防御
 */
export class Layer8Defenses {
  private config: DefenseLayer8Config;
  
  /** 攻击检测历史 */
  private detectionHistory: AttackDetectionResult[] = [];
  
  /** 连接器变更历史 */
  private connectorChanges: Map<string, Array<{ timestamp: number; toolCount: number }>> = new Map();

  constructor(config: Partial<DefenseLayer8Config> = {}) {
    this.config = {
      enableFriendlyFireDefense: true,
      enableMemGhostDefense: true,
      enableGhostApprovalDefense: true,
      enablePromptArmorDefense: true,
      friendlyFireRules: DEFAULT_FRIENDLY_FIRE_RULES,
      memGhostRules: DEFAULT_MEM_GHOST_RULES,
      ghostApprovalRules: DEFAULT_GHOST_APPROVAL_RULES,
      promptArmorConfig: DEFAULT_PROMPT_ARMOR_CONFIG,
      ...config,
    };
  }

  // ===========================================================================
  // 主检测方法
  // ===========================================================================

  /**
   * 检测操作是否包含四大攻击
   */
  async check(operation: Operation): Promise<SecurityDecision> {
    const detections: AttackDetectionResult[] = [];

    // 1. Friendly Fire检测
    if (this.config.enableFriendlyFireDefense) {
      const friendlyFireDetection = this.detectFriendlyFire(operation);
      if (friendlyFireDetection) detections.push(friendlyFireDetection);
    }

    // 2. MemGhost检测
    if (this.config.enableMemGhostDefense) {
      const memGhostDetection = this.detectMemGhost(operation);
      if (memGhostDetection) detections.push(memGhostDetection);
    }

    // 3. GhostApproval检测
    if (this.config.enableGhostApprovalDefense) {
      const ghostApprovalDetection = this.detectGhostApproval(operation);
      if (ghostApprovalDetection) detections.push(ghostApprovalDetection);
    }

    // 4. PromptArmor检测
    if (this.config.enablePromptArmorDefense) {
      const promptArmorDetection = await this.detectPromptArmor(operation);
      if (promptArmorDetection) detections.push(promptArmorDetection);
    }

    // 保存检测历史
    this.detectionHistory.push(...detections);

    // 返回决策
    if (detections.length === 0) {
      return {
        allowed: true,
        level: 'safe',
        score: 0,
        reasons: ['No Layer 8 attacks detected'],
        layer: 'layer8-defenses',
        requiresConfirmation: false,
      };
    }

    // 确定最高风险级别
    const maxRisk = this.getMaxRiskLevel(detections.map(d => d.riskLevel));
    const hasCritical = detections.some(d => d.riskLevel === 'critical');
    const hasHigh = detections.some(d => d.riskLevel === 'high');

    return {
      allowed: !hasCritical,
      level: maxRisk,
      score: this.calculateRiskScore(detections),
      reasons: detections.map(d => `[${d.attackType}] ${d.description}`),
      layer: 'layer8-defenses',
      requiresConfirmation: hasHigh || hasCritical,
      blockingLayer: hasCritical ? 'layer8-defenses' : undefined,
    };
  }

  // ===========================================================================
  // Friendly Fire 防御
  // ===========================================================================

  /**
   * 检测Friendly Fire攻击
   * 
   * 攻击场景：浏览器Agent被诱导点击恶意内容
   * 防御要点：
   * 1. 检测恶意链接协议（javascript:, data:, vbscript:）
   * 2. 检测诱导点击模式（click here, urgent action）
   * 3. 检测隐藏iframe
   */
  private detectFriendlyFire(operation: Operation): AttackDetectionResult | null {
    if (operation.type !== 'network_request' && operation.type !== 'file_read') {
      return null;
    }

    const content = operation.content || '';

    for (const rule of this.config.friendlyFireRules) {
      for (const pattern of rule.patterns) {
        if (pattern.test(content)) {
          return {
            attackType: 'friendly_fire',
            riskLevel: rule.riskLevel,
            description: rule.description,
            matchedRule: rule.name,
            suspiciousContent: content.match(pattern)?.[0]?.substring(0, 100),
            recommendedAction: rule.riskLevel === 'critical' ? 'block' : 'review',
          };
        }
      }
    }

    return null;
  }

  // ===========================================================================
  // MemGhost 防御
  // ===========================================================================

  /**
   * 检测MemGhost攻击
   * 
   * 攻击场景：邮件中植入虚假记忆，跨会话操纵Agent行为
   * 防御要点：
   * 1. 检测记忆注入指令（remember, note, save to memory）
   * 2. 检测跨会话操纵（in future, from now on, always, never）
   * 3. 检测HTML元数据隐藏指令
   */
  private detectMemGhost(operation: Operation): AttackDetectionResult | null {
    // 主要针对邮件、文件读取等操作
    if (operation.type !== 'file_read' && operation.type !== 'network_request') {
      return null;
    }

    const content = operation.content || '';

    for (const rule of this.config.memGhostRules) {
      if (rule.pattern.test(content)) {
        return {
          attackType: 'mem_ghost',
          riskLevel: rule.riskLevel,
          description: rule.description,
          matchedRule: rule.name,
          suspiciousContent: content.match(rule.pattern)?.[0]?.substring(0, 100),
          recommendedAction: rule.riskLevel === 'critical' ? 'block' : 'review',
        };
      }
    }

    return null;
  }

  // ===========================================================================
  // GhostApproval 防御
  // ===========================================================================

  /**
   * 检测GhostApproval攻击
   * 
   * 攻击场景：6大编码助手symlink漏洞，绕过审批
   * 防御要点：
   * 1. 检测symlink创建（ln -s, symlink, symbolic link）
   * 2. 检测路径遍历（../）
   * 3. 检测文件描述符访问（/proc/[pid]/fd/[fd]）
   */
  private detectGhostApproval(operation: Operation): AttackDetectionResult | null {
    // 主要针对文件操作和shell命令
    if (operation.type !== 'file_write' && 
        operation.type !== 'file_execute' && 
        operation.type !== 'shell_command') {
      return null;
    }

    const content = operation.content || '';

    for (const rule of this.config.ghostApprovalRules) {
      if (rule.pattern.test(content)) {
        return {
          attackType: 'ghost_approval',
          riskLevel: rule.riskLevel,
          description: rule.description,
          matchedRule: rule.name,
          suspiciousContent: content.match(rule.pattern)?.[0]?.substring(0, 100),
          recommendedAction: rule.riskLevel === 'critical' ? 'block' : 'review',
        };
      }
    }

    // 额外检查：文件写入目标是否为敏感目录
    if (operation.type === 'file_write' && operation.target) {
      const sensitivePaths = ['/etc', '/usr', '/var', '/root', '/home'];
      for (const sensitivePath of sensitivePaths) {
        if (operation.target.startsWith(sensitivePath)) {
          return {
            attackType: 'ghost_approval',
            riskLevel: 'high',
            description: `尝试写入敏感目录: ${operation.target}`,
            matchedRule: 'sensitive_directory_write',
            suspiciousContent: operation.target,
            recommendedAction: 'block',
          };
        }
      }
    }

    return null;
  }

  // ===========================================================================
  // PromptArmor 防御
  // ===========================================================================

  /**
   * 检测PromptArmor攻击
   * 
   * 攻击场景：连接器平均每9分钟变化一次，931个连接器6周内变动
   * 防御要点：
   * 1. 监控连接器工具数量变化
   * 2. 检测权限级别提升
   * 3. 记录连接器变更历史
   */
  private async detectPromptArmor(operation: Operation): Promise<AttackDetectionResult | null> {
    // 主要针对工具调用操作
    if (operation.type !== 'tool_invocation') {
      return null;
    }

    const connectorName = operation.metadata?.connector as string || 'unknown';
    const tools = operation.metadata?.tools as string[] || [];

    // 获取当前连接器快照
    const currentSnapshot: ConnectorSnapshot = {
      name: connectorName,
      tools,
      timestamp: Date.now(),
      permissionLevel: (operation.metadata?.permissionLevel as 'read' | 'write' | 'admin') || 'read',
    };

    // 检查历史记录
    const history = this.connectorChanges.get(connectorName) || [];
    
    if (history.length > 0) {
      const lastSnapshot = history[history.length - 1];
      const toolCountDiff = Math.abs(tools.length - lastSnapshot.toolCount);
      
      // 检测工具数量异常变化
      if (toolCountDiff > this.config.promptArmorConfig.toolCountThreshold) {
        return {
          attackType: 'prompt_armor',
          riskLevel: 'high',
          description: `连接器"${connectorName}"工具数量异常变化: ${lastSnapshot.toolCount} → ${tools.length}`,
          matchedRule: 'tool_count_anomaly',
          suspiciousContent: `工具数量变化: ${toolCountDiff}`,
          recommendedAction: 'review',
        };
      }

      // 检测权限级别提升
      const lastPermission = lastSnapshot.metadata?.permissionLevel as string || 'read';
      if (this.permissionLevelRank(currentSnapshot.permissionLevel) > this.permissionLevelRank(lastPermission as any)) {
        return {
          attackType: 'prompt_armor',
          riskLevel: 'critical',
          description: `连接器"${connectorName}"权限级别提升: ${lastPermission} → ${currentSnapshot.permissionLevel}`,
          matchedRule: 'permission_escalation',
          suspiciousContent: `权限提升: ${lastPermission} → ${currentSnapshot.permissionLevel}`,
          recommendedAction: 'block',
        };
      }
    }

    // 更新历史记录
    history.push({
      timestamp: Date.now(),
      toolCount: tools.length,
    });
    
    // 只保留最近100条记录
    if (history.length > 100) {
      history.shift();
    }
    
    this.connectorChanges.set(connectorName, history);

    return null;
  }

  // ===========================================================================
  // 辅助方法
  // ===========================================================================

  /**
   * 权限级别排序
   */
  private permissionLevelRank(level: 'read' | 'write' | 'admin'): number {
    const ranks = { read: 0, write: 1, admin: 2 };
    return ranks[level];
  }

  /**
   * 获取最高风险级别
   */
  private getMaxRiskLevel(levels: SecurityLevel[]): SecurityLevel {
    const order: SecurityLevel[] = ['safe', 'low', 'medium', 'high', 'critical'];
    let maxIndex = 0;
    
    for (const level of levels) {
      const index = order.indexOf(level);
      if (index > maxIndex) maxIndex = index;
    }
    
    return order[maxIndex];
  }

  /**
   * 计算风险分数
   */
  private calculateRiskScore(detections: AttackDetectionResult[]): number {
    const scores: Record<SecurityLevel, number> = {
      safe: 0,
      low: 25,
      medium: 50,
      high: 75,
      critical: 100,
    };
    
    return detections.reduce((sum, d) => sum + scores[d.riskLevel], 0) / detections.length;
  }

  /**
   * 获取检测历史
   */
  getDetectionHistory(): AttackDetectionResult[] {
    return [...this.detectionHistory];
  }

  /**
   * 获取连接器变更历史
   */
  getConnectorChanges(): Map<string, Array<{ timestamp: number; toolCount: number }>> {
    return new Map(this.connectorChanges);
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.detectionHistory = [];
    this.connectorChanges.clear();
  }
}

export default Layer8Defenses;
