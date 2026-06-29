/**
 * Capability Bucket 索引
 * 二级组织: domain → capability → skill
 * 提升技能发现效率，替代简单列表查询
 *
 * 设计参考 BrowserBC Capability Bucket 体系:
 *   domain (领域) → capability (能力) → skill (技能)
 *
 * 典型 domain:
 *   - browser: 浏览器自动化
 *   - file: 文件操作
 *   - api: API 调用
 *   - medical: 医疗
 *   - financial: 金融
 *   - communication: 通讯
 *   - data: 数据处理
 */

import type { SkillStandard } from './skill-standard.js';

// ============================================================================
// 核心类型定义
// ============================================================================

/**
 * 能力桶: domain → capability → skill names
 */
export interface CapabilityBucket {
  /** 领域名称 */
  domain: string;
  /** capability → skill names 映射 */
  capabilities: Map<string, Set<string>>;
}

/**
 * 注册条目: 技能到 domain/capability 的映射
 */
export interface RegistrationEntry {
  /** 技能名称 */
  skillName: string;
  /** 所属领域 */
  domain: string;
  /** 能力分类 */
  capability: string;
  /** 注册时间 */
  registeredAt: number;
}

/**
 * 查询选项
 */
export interface QueryOptions {
  /** 是否精确匹配 domain（默认 true） */
  exactDomain?: boolean;
  /** 是否精确匹配 capability（默认 true） */
  exactCapability?: boolean;
  /** 最大返回数量 */
  limit?: number;
}

/**
 * 智能匹配结果
 */
export interface SmartMatchResult {
  /** 匹配到的技能名称列表 */
  skillNames: string[];
  /** 匹配的 domain */
  matchedDomain: string;
  /** 匹配的 capability（可能为空） */
  matchedCapability?: string;
  /** 匹配置信度 0-1 */
  confidence: number;
  /** 匹配方法 */
  method: 'exact' | 'keyword' | 'fuzzy';
}

/**
 * 索引统计信息
 */
export interface IndexStats {
  /** 领域数量 */
  domainCount: number;
  /** 总能力数量 */
  totalCapabilities: number;
  /** 总技能数量 */
  totalSkills: number;
  /** 各领域详情 */
  domains: Array<{
    domain: string;
    capabilityCount: number;
    skillCount: number;
    capabilities: Array<{
      name: string;
      skillCount: number;
    }>;
  }>;
}

// ============================================================================
// 领域 → 能力 预设映射表
// ============================================================================

/**
 * 领域关键词映射
 * 用于从技能描述中推断 domain
 */
export const DOMAIN_KEYWORDS: Record<string, string[]> = {
  browser: ['browser', 'web', 'selenium', 'playwright', 'puppeteer', 'page', 'click', 'scrape', 'crawl', '网页', '浏览器', '抓取'],
  file: ['file', 'document', 'pdf', 'docx', 'xlsx', 'csv', 'read', 'write', 'parse', '文件', '文档', '表格'],
  api: ['api', 'rest', 'graphql', 'http', 'request', 'endpoint', '接口', '调用'],
  medical: ['medical', 'health', 'drug', 'medicine', 'pharmacy', 'clinical', 'diagnosis', 'patient', '医疗', '药品', '药店', '诊断'],
  financial: ['financial', 'stock', 'market', 'trading', 'investment', 'fund', '金融', '股票', '投资', '基金'],
  communication: ['email', 'message', 'chat', 'notification', 'feishu', 'slack', '通讯', '消息', '通知', '飞书'],
  data: ['data', 'database', 'sql', 'query', 'analytics', 'visualization', 'chart', '数据', '分析', '可视化'],
  legal: ['legal', 'law', 'contract', 'compliance', 'regulation', '法律', '合规', '合同'],
  academic: ['paper', 'research', 'citation', 'pubmed', 'arxiv', '论文', '研究', '文献'],
  content: ['content', 'writing', 'translation', 'summary', 'text', '写作', '翻译', '摘要', '文案'],
  evolution: ['evolution', 'self-improve', 'optimize', 'audit', 'skill', '进化', '优化', '审计'],
  security: ['security', 'permission', 'auth', 'sandbox', 'safety', '安全', '权限', '沙箱'],
  memory: ['memory', 'storage', 'recall', 'index', '记忆', '存储', '索引'],
};

/**
 * 能力关键词映射
 * 用于从技能描述中推断 capability
 */
export const CAPABILITY_KEYWORDS: Record<string, string[]> = {
  'web-automation': ['browser', 'selenium', 'playwright', 'click', 'navigate', 'automate', '自动化'],
  'data-extraction': ['scrape', 'extract', 'parse', 'crawl', '抓取', '提取', '解析'],
  'document-creation': ['create', 'generate', 'write', 'compose', '创建', '生成', '写作'],
  'document-analysis': ['analyze', 'audit', 'review', 'check', '分析', '审计', '检查'],
  'data-query': ['query', 'search', 'find', 'lookup', '查询', '搜索', '查找'],
  'data-visualization': ['chart', 'graph', 'plot', 'visualize', '图表', '可视化'],
  'notification': ['notify', 'alert', 'send', 'push', '通知', '提醒', '推送'],
  'text-processing': ['process', 'transform', 'format', 'convert', '处理', '转换', '格式化'],
  'health-consultation': ['diagnose', 'consult', 'advise', 'recommend', '诊断', '咨询', '建议'],
  'market-analysis': ['analyze', 'forecast', 'predict', 'trend', '分析', '预测', '趋势'],
  'compliance-check': ['compliance', 'audit', 'verify', 'validate', '合规', '验证'],
  'skill-optimization': ['optimize', 'evolve', 'improve', 'enhance', '优化', '进化', '提升'],
};

// ============================================================================
// CapabilityIndex 类
// ============================================================================

/**
 * Capability Bucket 索引
 * 二级组织: domain → capability → skill
 */
export class CapabilityIndex {
  /** domain → CapabilityBucket */
  private buckets: Map<string, CapabilityBucket> = new Map();

  /** skillName → RegistrationEntry 反向索引 */
  private skillRegistry: Map<string, RegistrationEntry> = new Map();

  // ===========================================================================
  // 注册
  // ===========================================================================

  /**
   * 注册技能到 Capability Bucket
   *
   * @param skillName - 技能名称
   * @param domain - 领域
   * @param capability - 能力分类
   */
  register(skillName: string, domain: string, capability: string): void {
    // 确保 bucket 存在
    if (!this.buckets.has(domain)) {
      this.buckets.set(domain, {
        domain,
        capabilities: new Map(),
      });
    }

    const bucket = this.buckets.get(domain)!;

    // 确保 capability 集合存在
    if (!bucket.capabilities.has(capability)) {
      bucket.capabilities.set(capability, new Set());
    }

    // 添加技能到 capability
    bucket.capabilities.get(capability)!.add(skillName);

    // 更新反向索引
    this.skillRegistry.set(skillName, {
      skillName,
      domain,
      capability,
      registeredAt: Date.now(),
    });
  }

  /**
   * 从 SkillStandard 对象注册
   * 使用 skill 中的 domain 和 capability 字段
   *
   * @param skill - SkillStandard 对象
   */
  registerFromStandard(skill: SkillStandard): void {
    const domain = skill.domain || this.inferDomain(skill.description);
    const capability = skill.capability || this.inferCapability(skill.description);
    this.register(skill.name, domain, capability);
  }

  /**
   * 批量注册
   *
   * @param entries - 注册条目列表
   */
  registerBatch(entries: Array<{ skillName: string; domain: string; capability: string }>): void {
    for (const entry of entries) {
      this.register(entry.skillName, entry.domain, entry.capability);
    }
  }

  /**
   * 注销技能
   *
   * @param skillName - 技能名称
   * @returns 是否成功注销
   */
  unregister(skillName: string): boolean {
    const entry = this.skillRegistry.get(skillName);
    if (!entry) return false;

    const bucket = this.buckets.get(entry.domain);
    if (!bucket) return false;

    const capabilitySet = bucket.capabilities.get(entry.capability);
    if (!capabilitySet) return false;

    capabilitySet.delete(skillName);

    // 清理空集合
    if (capabilitySet.size === 0) {
      bucket.capabilities.delete(entry.capability);
    }
    if (bucket.capabilities.size === 0) {
      this.buckets.delete(entry.domain);
    }

    this.skillRegistry.delete(skillName);
    return true;
  }

  // ===========================================================================
  // 查询
  // ===========================================================================

  /**
   * 根据领域和能力查询技能
   *
   * @param domain - 领域名称
   * @param capability - 可选的能力分类
   * @param options - 查询选项
   * @returns 技能名称列表
   */
  query(domain: string, capability?: string, options?: QueryOptions): string[] {
    const opts = { exactDomain: true, exactCapability: true, limit: 0, ...options };

    if (opts.exactDomain) {
      const bucket = this.buckets.get(domain);
      if (!bucket) return [];

      if (!capability) {
        // 返回该领域所有技能
        const all = Array.from(bucket.capabilities.values())
          .flatMap(skills => Array.from(skills));
        return opts.limit > 0 ? all.slice(0, opts.limit) : all;
      }

      if (opts.exactCapability) {
        const skills = Array.from(bucket.capabilities.get(capability) || []);
        return opts.limit > 0 ? skills.slice(0, opts.limit) : skills;
      }

      // 模糊匹配 capability
      const matched: string[] = [];
      for (const [cap, skillSet] of Array.from(bucket.capabilities.entries()) as [string, Set<string>][]) {
        if (cap.includes(capability) || capability.includes(cap)) {
          matched.push(...Array.from(skillSet));
        }
      }
      return opts.limit > 0 ? matched.slice(0, opts.limit) : matched;
    }

    // 模糊匹配 domain
    const matched: string[] = [];
    for (const [dom, bucket] of Array.from(this.buckets.entries()) as [string, CapabilityBucket][]) {
      if (dom.includes(domain) || domain.includes(dom)) {
        if (!capability) {
          matched.push(...this.query(dom, undefined, { limit: 0 }));
        } else {
          matched.push(...this.query(dom, capability, { limit: 0 }));
        }
      }
    }
    return opts.limit > 0 ? matched.slice(0, opts.limit) : matched;
  }

  /**
   * 智能匹配: 根据描述自动推断 domain 和 capability
   *
   * @param description - 描述文本
   * @returns 匹配结果
   */
  smartMatch(description: string): SmartMatchResult[] {
    const results: SmartMatchResult[] = [];
    const descLower = description.toLowerCase();

    // 1. 精确匹配: 直接匹配到 domain 和 capability
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      if (keywords.some(kw => descLower.includes(kw))) {
        // 找到匹配的 domain，进一步匹配 capability
        let bestCapability: string | undefined;
        let bestCapScore = 0;

        for (const [cap, capKeywords] of Object.entries(CAPABILITY_KEYWORDS)) {
          const score = capKeywords.filter(kw => descLower.includes(kw)).length;
          if (score > bestCapScore) {
            bestCapScore = score;
            bestCapability = cap;
          }
        }

        const skills = this.query(domain, bestCapability);
        if (skills.length > 0) {
          results.push({
            skillNames: skills,
            matchedDomain: domain,
            matchedCapability: bestCapability,
            confidence: bestCapability ? 0.9 : 0.7,
            method: 'keyword',
          });
        }
      }
    }

    // 2. 如果没有精确匹配，尝试模糊匹配
    if (results.length === 0) {
      const words = descLower.split(/[\s,，.。;；:：!！?？/\\|]+/).filter(w => w.length > 2);

      for (const [domain, bucket] of Array.from(this.buckets.entries()) as [string, CapabilityBucket][]) {
        for (const word of words) {
          if (domain.includes(word) || word.includes(domain)) {
            results.push({
              skillNames: this.query(domain),
              matchedDomain: domain,
              confidence: 0.5,
              method: 'fuzzy',
            });
            break;
          }
        }

        // 也检查 capability 名称
        for (const [capability, skillSet] of Array.from(bucket.capabilities.entries()) as [string, Set<string>][]) {
          for (const word of words) {
            if (capability.includes(word) || word.includes(capability)) {
              results.push({
                skillNames: Array.from(skillSet),
                matchedDomain: domain,
                matchedCapability: capability,
                confidence: 0.6,
                method: 'fuzzy',
              });
              break;
            }
          }
        }
      }
    }

    // 按置信度排序
    results.sort((a, b) => b.confidence - a.confidence);

    return results;
  }

  // ===========================================================================
  // 推断方法
  // ===========================================================================

  /**
   * 从描述推断领域
   */
  inferDomain(description: string): string {
    const descLower = description.toLowerCase();

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      if (keywords.some(kw => descLower.includes(kw))) {
        return domain;
      }
    }

    return 'general';
  }

  /**
   * 从描述推断能力
   */
  inferCapability(description: string): string {
    const descLower = description.toLowerCase();

    let bestCapability = 'general';
    let bestScore = 0;

    for (const [capability, keywords] of Object.entries(CAPABILITY_KEYWORDS)) {
      const score = keywords.filter(kw => descLower.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestCapability = capability;
      }
    }

    return bestCapability;
  }

  // ===========================================================================
  // 信息查询
  // ===========================================================================

  /**
   * 获取技能的注册信息
   */
  getRegistration(skillName: string): RegistrationEntry | undefined {
    return this.skillRegistry.get(skillName);
  }

  /**
   * 获取所有领域列表
   */
  getDomains(): string[] {
    return Array.from(this.buckets.keys());
  }

  /**
   * 获取指定领域的所有能力
   */
  getCapabilities(domain: string): string[] {
    const bucket = this.buckets.get(domain);
    if (!bucket) return [];
    return Array.from(bucket.capabilities.keys());
  }

  /**
   * 获取索引统计信息
   */
  getStats(): IndexStats {
    const domains: IndexStats['domains'] = [];

    let totalCapabilities = 0;
    let totalSkills = 0;

    for (const [domain, bucket] of Array.from(this.buckets.entries()) as [string, CapabilityBucket][]) {
      const capabilities: Array<{ name: string; skillCount: number }> = [];
      let domainSkillCount = 0;

      for (const [cap, skillSet] of Array.from(bucket.capabilities.entries()) as [string, Set<string>][]) {
        capabilities.push({
          name: cap,
          skillCount: skillSet.size,
        });
        domainSkillCount += skillSet.size;
      }

      totalCapabilities += bucket.capabilities.size;
      totalSkills += domainSkillCount;

      domains.push({
        domain,
        capabilityCount: bucket.capabilities.size,
        skillCount: domainSkillCount,
        capabilities,
      });
    }

    return {
      domainCount: this.buckets.size,
      totalCapabilities,
      totalSkills,
      domains,
    };
  }

  /**
   * 清空索引
   */
  clear(): void {
    this.buckets.clear();
    this.skillRegistry.clear();
  }

  /**
   * 获取索引大小（技能数量）
   */
  get size(): number {
    return this.skillRegistry.size;
  }
}
