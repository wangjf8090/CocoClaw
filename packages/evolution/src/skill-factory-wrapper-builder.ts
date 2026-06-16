/**
 * 封装构建器 (Wrapper Builder)
 * 
 * 将垂类模板、数据源、行业大模型封装为可调用的 Skill。
 * 输出符合 Microsoft SKILL Pattern 6 章节格式的完整 Skill 包。
 * 
 * 核心能力：
 * 1. SKILL.md 生成 - 遵循 Microsoft SKILL Pattern 6 章节格式
 * 2. metadata 自动生成 - requires/capabilities/risk_level/pricing
 * 3. 目录结构生成 - SKILL.md + references/ + scripts/ + tests/
 * 4. 行业大模型封装 - 支持 OpenAI/Anthropic/Azure/Custom provider
 * 
 * 设计原则：
 * - 输出格式符合 Coze Skill 规范
 * - 合规声明自动化添加
 * - 风险等级自动评估
 * 
 * v3.6.0 新增模块
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  FieldType,
  FieldTemplate,
  DataSource,
  DomainModelConfig,
  SkillWrapperConfig,
  PricingConfig,
  WrapperResult,
  GeneratedFile,
  SkillMetadata,
} from "./types.js";
import { DOMAIN_AUDIT_RULES } from "./types.js";
import { getDefaultPricing } from "./template-matcher.js";

// ============================================================================
// SKILL Pattern 6 章节生成
// ============================================================================

/**
 * 生成 Microsoft SKILL Pattern 6 章节内容
 */
interface SKILLPatternSections {
  scope: string;
  idioms: string;
  patterns: string;
  fixtures: string;
  antiPatterns: string;
  heuristics: string;
}

/**
 * 生成垂类 6 章节内容
 */
function generatePatternSections(
  field: FieldType,
  template: FieldTemplate,
  intent: string,
  subDomain?: string
): SKILLPatternSections {
  const templates = getPatternTemplates(field);
  
  return {
    scope: generateScopeSection(field, template, intent, subDomain, templates),
    idioms: generateIdiomsSection(field, template, templates),
    patterns: generatePatternsSection(field, template, templates),
    fixtures: generateFixturesSection(field, template, templates),
    antiPatterns: generateAntiPatternsSection(field, template, templates),
    heuristics: generateHeuristicsSection(field, template, templates),
  };
}

/**
 * 获取垂类 Pattern 模板
 */
function getPatternTemplates(field: FieldType): Record<string, string[]> {
  const templates: Record<FieldType, Record<string, string[]>> = {
    financial: {
      scope: [
        "实时行情查询",
        "财务数据分析",
        "估值对比分析",
        "公告速读",
      ],
      antiPatterns: [
        "提供投资建议",
        "预测股价走势",
        "接入非授权数据源",
      ],
    },
    medical: {
      scope: [
        "药品信息查询",
        "体检报告解读",
        "疾病诊断参考",
        "医学文献检索",
      ],
      antiPatterns: [
        "提供最终诊断",
        "开具处方",
        "替代专业医疗",
      ],
    },
    academic: {
      scope: [
        "文献检索",
        "趋势分析",
        "引用分析",
        "论文写作辅助",
      ],
      antiPatterns: [
        "提供完整论文下载",
        "替代同行评审",
        "保证文献完整性",
      ],
    },
    legal: {
      scope: [
        "隐私政策生成",
        "Cookie政策",
        "数据处理协议",
        "合规检查清单",
      ],
      antiPatterns: [
        "提供法律咨询",
        "保证法律效力",
        "替代律师服务",
      ],
    },
  };
  
  return templates[field] ?? templates.financial;
}

/**
 * 生成 Scope 章节
 */
function generateScopeSection(
  field: FieldType,
  template: FieldTemplate,
  intent: string,
  subDomain?: string,
  templates?: Record<string, string[]>
): string {
  const scopeItems = templates?.scope ?? [];
  
  return `## 1. Scope（范围）

### 技能定义
${template.description}

### 核心能力
${scopeItems.map(item => `- **${item}**`).join("\n")}

### 使用边界（不做什么）
${(templates?.antiPatterns ?? []).map(item => `- ❌ ${item}`).join("\n")}

### 触发短语
- "帮我${intent}一下"
${subDomain ? `- "针对${subDomain}场景"` : ""}
`;
}

/**
 * 生成 Idioms 章节
 */
function generateIdiomsSection(
  field: FieldType,
  template: FieldTemplate,
  templates?: Record<string, string[]>
): string {
  const fieldSpecific = getIdiomsContent(field);
  
  return `## 2. Idioms（指令风格）

### 用户指令格式
\`\`\`json
{
  "intent": "${field}_query",
  "params": {}
}
\`\`\`

### 响应格式规范
\`\`\`json
{
  "status": "success | error | partial",
  "data": {},
  "source": "${fieldSpecific.source}",
  "timestamp": "ISO8601"
}
\`\`\`

### 错误处理规范
${fieldSpecific.errorHandling.map(item => `- ${item}`).join("\n")}
`;
}

/**
 * 获取垂类 Idioms 内容
 */
function getIdiomsContent(field: FieldType): {
  source: string;
  errorHandling: string[];
} {
  const content: Record<FieldType, { source: string; errorHandling: string[] }> = {
    financial: {
      source: "Wind金融终端",
      errorHandling: [
        "数据源超时：返回缓存数据 + 标注来源",
        "股票代码错误：返回相似股票建议",
        "权限不足：返回说明 + 升级链接",
      ],
    },
    medical: {
      source: "中康科技医疗数据库",
      errorHandling: [
        "药品未找到：返回相似药品建议",
        "指标异常：强烈提示"建议就医"",
        "权限不足：返回说明 + 合规提示",
      ],
    },
    academic: {
      source: "PubMed生物医学数据库",
      errorHandling: [
        "无搜索结果：建议扩展查询词",
        "API超时：降级到缓存结果",
        "导出失败：回退到JSON格式",
      ],
    },
    legal: {
      source: "GDPR/CCPA合规数据库",
      errorHandling: [
        "法规未覆盖：标注"需人工审核"",
        "模板缺失：返回通用模板",
        "版本过旧：提示更新",
      ],
    },
  };
  
  return content[field] ?? content.financial;
}

/**
 * 生成 Patterns 章节
 */
function generatePatternsSection(
  field: FieldType,
  template: FieldTemplate,
  templates?: Record<string, string[]>
): string {
  const patterns = getBestPractices(field);
  
  return `## 3. Patterns（成功路径）

### 最佳实践清单
${patterns.map((p, i) => `**Pattern ${i + 1}**\n${p}`).join("\n\n")}

### 思维链示例
\`\`\`
用户: "${getSampleQuery(field)}"
思维链:
1. 确认用户意图
2. 获取数据源
3. 分析处理
4. 生成报告
5. 添加合规声明
\`\`\`
`;
}

/**
 * 获取垂类最佳实践
 */
function getBestPractices(field: FieldType): string[] {
  const practices: Record<FieldType, string[]> = {
    financial: [
      "1. 解析股票代码（支持中文名/代码/WIND代码）\n2. 调用API获取实时数据\n3. 计算技术指标\n4. 生成分析报告\n5. 添加风险提示",
      "1. 获取财务数据\n2. 计算关键比率\n3. 与行业均值对比\n4. 标注异常波动\n5. 生成结构化摘要",
    ],
    medical: [
      "1. 解析药品/检查名称\n2. 查询数据库\n3. 检查禁忌症\n4. 生成用药建议\n5. 强制添加"建议就医"提示",
      "1. 提取指标数值\n2. 与参考范围对比\n3. 识别异常项\n4. 分级评估\n5. 生成健康建议",
    ],
    academic: [
      "1. 解析查询词\n2. 转换为MeSH术语\n3. 构建搜索查询\n4. 执行搜索\n5. 按相关性排序",
      "1. 收集文献列表\n2. 批量获取元数据\n3. 按主题聚类\n4. 生成摘要报告\n5. 导出为所需格式",
    ],
    legal: [
      "1. 收集业务场景\n2. 识别数据处理活动\n3. 确定法律依据\n4. 映射数据主体权利\n5. 验证必需条款",
      "1. 分类Cookie类型\n2. 说明用途\n3. 描述同意机制\n4. 提供拒绝选项\n5. 验证合规性",
    ],
  };
  
  return practices[field] ?? practices.financial;
}

/**
 * 获取垂类示例查询
 */
function getSampleQuery(field: FieldType): string {
  const queries: Record<FieldType, string> = {
    financial: "分析贵州茅台最近30天股价走势",
    medical: "解读我的体检报告",
    academic: "检索2026年阿尔茨海默病最新文献",
    legal: "生成GDPR隐私政策模板",
  };
  
  return queries[field] ?? "帮我分析一下";
}

/**
 * 生成 Fixtures 章节
 */
function generateFixturesSection(
  field: FieldType,
  template: FieldTemplate,
  templates?: Record<string, string[]>
): string {
  const testCases = getTestCases(field);
  
  return `## 4. Fixtures（测试用例）

| ID | 输入 | 预期输出 | 备注 |
|----|------|---------|------|
${testCases.map(tc => `| ${tc.id} | ${tc.input} | ${tc.output} | ${tc.notes} |`).join("\n")}

### 基准任务
- **BT-1**：${getBenchmark1(field)}
- **BT-2**：${getBenchmark2(field)}
`;
}

/**
 * 获取垂类测试用例
 */
function getTestCases(field: FieldType): Array<{ id: string; input: string; output: string; notes: string }> {
  const cases: Record<FieldType, Array<{ id: string; input: string; output: string; notes: string }>> = {
    financial: [
      { id: "F01", input: "查贵州茅台实时行情", output: "股票信息/价格/涨跌幅", notes: "验证实时数据" },
      { id: "F02", input: "分析宁德时代财务数据", output: "财务指标摘要", notes: "验证年报解析" },
      { id: "F03", input: "对比苹果和微软估值", output: "PE/PB/ROE对比表", notes: "验证多标的" },
    ],
    medical: [
      { id: "M01", input: "查询阿莫西林的用法", output: "完整药品信息", notes: "验证药品数据库" },
      { id: "M02", input: "解读血糖7.2mmol/L", output: "糖尿病前期评估", notes: "验证指标解读" },
      { id: "M03", input: "药物相互作用分析", output: "相互作用说明", notes: "验证相互作用库" },
    ],
    academic: [
      { id: "A01", input: "搜索深度学习医学影像", output: "文献列表+影响因子", notes: "验证搜索能力" },
      { id: "A02", input: "导出BibTeX格式", output: "BibTeX文件", notes: "验证导出功能" },
      { id: "A03", input: "分析CRISPR趋势", output: "趋势分析报告", notes: "验证趋势分析" },
    ],
    legal: [
      { id: "L01", input: "生成GDPR隐私政策", output: "完整政策文档", notes: "验证生成能力" },
      { id: "L02", input: "Cookie政策", output: "Cookie分类+同意机制", notes: "验证Cookie策略" },
      { id: "L03", input: "合规检查", output: "合规差距报告", notes: "验证检查功能" },
    ],
  };
  
  return cases[field] ?? cases.financial;
}

/**
 * 获取基准任务1
 */
function getBenchmark1(field: FieldType): string {
  const benchmarks: Record<FieldType, string> = {
    financial: "单股票实时行情查询 < 2秒",
    medical: "单药品查询 < 3秒",
    academic: "单次搜索（100条） < 5秒",
    legal: "基础隐私政策生成 < 30秒",
  };
  return benchmarks[field] ?? "查询 < 5秒";
}

/**
 * 获取基准任务2
 */
function getBenchmark2(field: FieldType): string {
  const benchmarks: Record<FieldType, string> = {
    financial: "财务分析报告生成 < 10秒",
    medical: "体检报告解读 < 10秒",
    academic: "批量导出100篇文献 < 30秒",
    legal: "Cookie政策生成 < 20秒",
  };
  return benchmarks[field] ?? "批量处理 < 30秒";
}

/**
 * 生成 Anti-Patterns 章节
 */
function generateAntiPatternsSection(
  field: FieldType,
  template: FieldTemplate,
  templates?: Record<string, string[]>
): string {
  const antiPatterns = templates?.antiPatterns ?? [];
  
  return `## 5. Anti-Patterns（失败模式）

### 危险信号
| 危险信号 | 原因 | 修复方案 |
|---------|------|---------|
${getRedFlags(field).map(rf => `| ${rf.signal} | ${rf.cause} | ${rf.solution} |`).join("\n")}

### 应避免的情况
${antiPatterns.map(item => `- ❌ ${item}`).join("\n")}
`;
}

/**
 * 获取垂类危险信号
 */
function getRedFlags(field: FieldType): Array<{ signal: string; cause: string; solution: string }> {
  const flags: Record<FieldType, Array<{ signal: string; cause: string; solution: string }>> = {
    financial: [
      { signal: "股票代码无法识别", cause: "Wind代码/标准代码/中文名混淆", solution: "添加别名映射表" },
      { signal: "数据返回空值", cause: "接口权限不足/代码错误", solution: "检查权限+回退到缓存" },
      { signal: "响应超时", cause: "Wind服务器延迟", solution: "降级到异步模式" },
    ],
    medical: [
      { signal: "将辅助诊断当最终诊断", cause: "用户可能直接采纳", solution: "每次响应加强制免责声明" },
      { signal: "忽视药物过敏信息", cause: "导致严重后果", solution: "强制要求输入过敏史" },
      { signal: "报告紧急症状不提示就医", cause: "延误治疗", solution: "关键词触发Urgent级别" },
    ],
    academic: [
      { signal: "搜索结果过多无法处理", cause: "查询词过于宽泛", solution: "建议添加更多过滤条件" },
      { signal: "论文链接失效", cause: "开放获取时限", solution: "提供多个镜像源" },
      { signal: "引用数据不一致", cause: "不同数据库差异", solution: "标注数据来源" },
    ],
    legal: [
      { signal: "缺少必需条款", cause: "GDPR Art. 13/14 强制要求", solution: "添加缺失条款" },
      { signal: "模糊的数据处理描述", cause: "可能产生合规风险", solution: "具体化处理活动" },
      { signal: "不可执行的权利", cause: "声明权利但无实现机制", solution: "添加具体流程" },
    ],
  };
  
  return flags[field] ?? flags.financial;
}

/**
 * 生成 Heuristics 章节
 */
function generateHeuristicsSection(
  field: FieldType,
  template: FieldTemplate,
  templates?: Record<string, string[]>
): string {
  const heuristics = getHeuristics(field);
  
  return `## 6. Heuristics（决策规则）

### 优先级指南
${heuristics.priority.map(item => `- ${item}`).join("\n")}

### 边界情况处理
| 场景 | 决策规则 |
|------|---------|
${heuristics.edgeCases.map(ec => `| ${ec.scenario} | ${ec.rule} |`).join("\n")}

### 合规要求
${DOMAIN_AUDIT_RULES[field]?.mandatoryDisclaimers.map(d => `- ⚠️ ${d}`).join("\n")}
`;
}

/**
 * 获取垂类启发式规则
 */
function getHeuristics(field: FieldType): {
  priority: string[];
  edgeCases: Array<{ scenario: string; rule: string }>;
} {
  const heuristics: Record<FieldType, { priority: string[]; edgeCases: Array<{ scenario: string; rule: string }> }> = {
    financial: {
      priority: [
        "数据准确性 > 响应速度",
        "权限提示优先",
        "结构化优于长文本",
      ],
      edgeCases: [
        { scenario: "股票停牌", rule: "明确标注'停牌'状态" },
        { scenario: "财报未发布", rule: "提示'数据暂未披露'" },
        { scenario: "美股节假日", rule: "标注'非交易日'" },
      ],
    },
    medical: {
      priority: [
        "安全 > 准确性 > 速度",
        "免责声明必须显著",
        "紧急症状立即提示",
      ],
      edgeCases: [
        { scenario: "胸痛/呼吸困难", rule: "立即建议拨打120" },
        { scenario: "药物过敏", rule: "强烈建议立即停药并就医" },
        { scenario: "多项指标异常", rule: "建议全面复查" },
      ],
    },
    academic: {
      priority: [
        "引用准确性 > 检索速度",
        "DOI/PMID必须完整",
        "开放获取优先",
      ],
      edgeCases: [
        { scenario: "无搜索结果", rule: "建议扩展查询词" },
        { scenario: "论文链接失效", rule: "提供多个镜像源" },
        { scenario: "批量导出失败", rule: "分批处理" },
      ],
    },
    legal: {
      priority: [
        "合规完整性 > 生成速度",
        "免责声明必须包含",
        "版本必须可追溯",
      ],
      edgeCases: [
        { scenario: "多司法管辖区", rule: "按优先级处理" },
        { scenario: "特殊数据类型", rule: "标注高风险" },
        { scenario: "政策过期", rule: "提示更新" },
      ],
    },
  };
  
  return heuristics[field] ?? heuristics.financial;
}

// ============================================================================
// 目录结构生成
// ============================================================================

/**
 * Skill 目录结构
 */
interface SkillDirectoryStructure {
  files: GeneratedFile[];
  skillMdContent: string;
}

/**
 * 生成 Skill 目录结构
 */
function generateSkillStructure(
  skillDir: string,
  name: string,
  field: FieldType
): SkillDirectoryStructure {
  const files: GeneratedFile[] = [];
  
  // 创建目录
  const dirs = [
    skillDir,
    path.join(skillDir, "references"),
    path.join(skillDir, "scripts"),
    path.join(skillDir, "tests"),
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  return { files, skillMdContent: "" };
}

// ============================================================================
// 元数据生成
// ============================================================================

/**
 * 生成 Skill 元数据
 */
function generateMetadata(config: SkillWrapperConfig): SkillMetadata {
  const pricing = config.pricing ?? getDefaultPricing(config.template.field);
  
  return {
    name: config.name,
    version: config.version ?? "1.0.0",
    description: config.description,
    author: config.author,
    createdAt: new Date().toISOString(),
    field: config.template.field,
    supportedIntents: config.template.supportedIntents,
    requires: config.dataSources.map(ds => ds.name),
    capabilities: getCapabilities(config.template.field),
    riskLevel: getRiskLevel(config.template.field),
    pricing,
    dataSources: config.dataSources.map(ds => ds.id),
    tags: getTags(config.template.field),
  };
}

/**
 * 获取能力列表
 */
function getCapabilities(field: FieldType): string[] {
  const capabilities: Record<FieldType, string[]> = {
    financial: ["实时行情查询", "财务数据分析", "估值对比", "公告速读", "技术指标计算"],
    medical: ["药品查询", "体检解读", "诊断参考", "药物相互作用", "健康建议"],
    academic: ["文献检索", "影响因子查询", "引用分析", "趋势追踪", "多格式导出"],
    legal: ["隐私政策生成", "Cookie政策", "DPA协议", "合规检查", "多语言支持"],
  };
  return capabilities[field] ?? [];
}

/**
 * 获取风险等级
 */
function getRiskLevel(field: FieldType): "low" | "medium" | "high" | "critical" {
  const riskLevels: Record<FieldType, "low" | "medium" | "high" | "critical"> = {
    financial: "high",
    medical: "critical",
    academic: "low",
    legal: "high",
  };
  return riskLevels[field] ?? "medium";
}

/**
 * 获取标签
 */
function getTags(field: FieldType): string[] {
  const tags: Record<FieldType, string[]> = {
    financial: ["金融", "投资", "股票", "A股", "财务分析"],
    medical: ["医疗", "健康", "临床", "诊断辅助", "药物"],
    academic: ["学术", "研究", "文献", "PubMed", "论文"],
    legal: ["法律", "合规", "GDPR", "隐私政策", "合同"],
  };
  return tags[field] ?? [];
}

// ============================================================================
// 封装构建器类
// ============================================================================

/**
 * 封装构建器
 * 
 * 将垂类模板、数据源、行业大模型封装为可调用的 Skill。
 */
export class WrapperBuilder {
  private outputDir: string;

  /**
   * 创建封装构建器
   * 
   * @param config 配置
   * @param config.outputDir 输出目录
   */
  constructor(config?: { outputDir?: string }) {
    this.outputDir = config?.outputDir ?? "./skills";
  }

  /**
   * 构建 Skill
   * 
   * @param config 包装配置
   * @param options 选项
   * @returns 包装结果
   */
  async build(
    config: SkillWrapperConfig,
    options?: {
      intent?: string;
      subDomain?: string;
      generatePattern?: boolean;
    }
  ): Promise<WrapperResult> {
    const startTime = Date.now();
    
    // 1. 生成 Skill 目录
    const skillDir = this.ensureSkillDir(config.name);
    
    // 2. 生成 SKILL.md 内容
    const skillMdContent = this.generateSkillMd(config, options);
    
    // 3. 生成 SKILL Pattern 内容（可选）
    let skillPatternContent: string | undefined;
    if (options?.generatePattern) {
      const sections = generatePatternSections(
        config.template.field,
        config.template,
        options.intent ?? "分析",
        options.subDomain
      );
      skillPatternContent = [
        sections.scope,
        sections.idioms,
        sections.patterns,
        sections.fixtures,
        sections.antiPatterns,
        sections.heuristics,
      ].join("\n\n");
    }
    
    // 4. 生成元数据
    const metadata = generateMetadata(config);
    
    // 5. 生成文件列表
    const generatedFiles: GeneratedFile[] = [
      {
        path: path.join(skillDir, "SKILL.md"),
        name: "SKILL.md",
        type: "skill_md",
        size: Buffer.byteLength(skillMdContent, "utf-8"),
        overwritten: false,
      },
    ];
    
    // 6. 写入文件
    await this.writeSkillFiles(skillDir, skillMdContent, skillPatternContent);
    
    // 7. 生成索引文件
    const indexContent = this.generateIndexTs(config);
    await this.writeFile(path.join(skillDir, "src", "index.ts"), indexContent);
    generatedFiles.push({
      path: path.join(skillDir, "src", "index.ts"),
      name: "index.ts",
      type: "index_ts",
      size: Buffer.byteLength(indexContent, "utf-8"),
      overwritten: false,
    });
    
    return {
      skillDir,
      generatedFiles,
      skillMdContent,
      skillPatternContent,
      metadata,
      estimatedDeployTime: this.estimateDeployTime(config),
    };
  }

  /**
   * 确保 Skill 目录存在
   */
  private ensureSkillDir(name: string): string {
    const skillDir = path.join(this.outputDir, name);
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }
    return skillDir;
  }

  /**
   * 生成 SKILL.md 内容
   */
  private generateSkillMd(
    config: SkillWrapperConfig,
    options?: { intent?: string; subDomain?: string }
  ): string {
    const { template, domainModel, dataSources } = config;
    const disclaimers = DOMAIN_AUDIT_RULES[template.field]?.mandatoryDisclaimers ?? [];
    
    return `# ${template.name}

> **版本**: ${config.version ?? "1.0.0"}
> **垂类**: ${template.field}
> **作者**: ${config.author ?? "SelfClaw Skill Factory"}
> **生成时间**: ${new Date().toISOString()}

## 描述

${config.description}

## 核心能力

${getCapabilities(template.field).map(c => `- ${c}`).join("\n")}

## 使用示例

\`\`\`
用户: "${options?.intent ? `帮我${options.intent}一下` : "帮我处理一下"}"
${options?.subDomain ? `场景: ${options.subDomain}` : ""}
\`\`\`

## 数据源

${dataSources.map(ds => `- **${ds.name}** (${ds.type})`).join("\n")}

## 模型配置

- **提供商**: ${domainModel.provider}
- **模型**: ${domainModel.model}
- **最大 Token**: ${domainModel.maxTokens ?? 4096}

## 合规声明

${disclaimers.map(d => `> ⚠️ **${d}**`).join("\n\n")}

## 元数据

| 属性 | 值 |
|------|-----|
| 风险等级 | ${getRiskLevel(template.field)} |
| 定价 | ${config.pricing?.type ?? "free"} |
| 标签 | ${getTags(template.field).join(", ")} |

---

*由 SelfClaw Skill Factory v3.6.0 自动生成*
`;
  }

  /**
   * 生成 index.ts 内容
   */
  private generateIndexTs(config: SkillWrapperConfig): string {
    const { name, template, domainModel, dataSources } = config;
    
    return `/**
 * ${template.name}
 * 
 * 垂类: ${template.field}
 * 版本: ${config.version ?? "1.0.0"}
 * 
 * ${config.description}
 */

import type { Skill } from "./types.js";

/**
 * Skill 配置
 */
export const ${name.replace(/-/g, "_")}_config: Skill = {
  name: "${name}",
  description: "${config.description}",
  field: "${template.field}",
  version: "${config.version ?? "1.0.0"}",
  capabilities: ${JSON.stringify(getCapabilities(template.field))},
  dataSources: ${JSON.stringify(dataSources.map(ds => ds.id))},
  model: {
    provider: "${domainModel.provider}",
    name: "${domainModel.model}",
    systemPrompt: "${domainModel.systemPrompt.replace(/"/g, '\\"')}",
  },
};

/**
 * Skill 入口函数
 */
export async function execute(input: Record<string, unknown>): Promise<unknown> {
  // TODO: 实现 Skill 逻辑
  return { status: "ok", skill: "${name}" };
}

export default { config: ${name.replace(/-/g, "_")}_config, execute };
`;
  }

  /**
   * 写入 Skill 文件
   */
  private async writeSkillFiles(
    skillDir: string,
    skillMdContent: string,
    skillPatternContent?: string
  ): Promise<void> {
    // 写入 SKILL.md
    await this.writeFile(path.join(skillDir, "SKILL.md"), skillMdContent);
    
    // 写入 SKILL.pattern.md（可选）
    if (skillPatternContent) {
      await this.writeFile(path.join(skillDir, "SKILL.pattern.md"), skillPatternContent);
    }
  }

  /**
   * 写入文件
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, "utf-8");
  }

  /**
   * 预估部署时间
   */
  private estimateDeployTime(config: SkillWrapperConfig): string {
    const baseTime = config.template.field === "legal" ? 30 : 10;
    const dataSourceCount = config.dataSources.filter(ds => ds.required).length;
    return `${baseTime + dataSourceCount * 5}-${baseTime * 2 + dataSourceCount * 10}秒`;
  }
}

// ============================================================================
// 导出
// ============================================================================

/**
 * 创建默认封装构建器实例
 */
export function createWrapperBuilder(config?: { outputDir?: string }): WrapperBuilder {
  return new WrapperBuilder(config);
}

/**
 * 快捷函数：构建 Skill
 * 
 * @param config 包装配置
 * @param options 选项
 * @returns 包装结果
 */
export async function wrapSkill(
  config: SkillWrapperConfig,
  options?: {
    intent?: string;
    subDomain?: string;
    generatePattern?: boolean;
  }
): Promise<WrapperResult> {
  const builder = createWrapperBuilder();
  return builder.build(config, options);
}

/**
 * 快捷函数：生成 SKILL Pattern
 * 
 * @param field 垂类
 * @param template 模板
 * @param intent 意图
 * @param subDomain 子领域
 * @returns 6 章节内容
 */
export function generateSKILLPattern(
  field: FieldType,
  template: FieldTemplate,
  intent: string,
  subDomain?: string
): string {
  const sections = generatePatternSections(field, template, intent, subDomain);
  return [
    `# ${template.name} - SKILL Pattern`,
    "",
    sections.scope,
    "",
    sections.idioms,
    "",
    sections.patterns,
    "",
    sections.fixtures,
    "",
    sections.antiPatterns,
    "",
    sections.heuristics,
  ].join("\n");
}
