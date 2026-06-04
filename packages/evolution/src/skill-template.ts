/**
 * Skill Template - 行业技能包模板生成模块
 * 对标 Coze 3.0 + Microsoft SKILL Pattern 规范，自动生成可上架的技能包结构
 *
 * 核心能力：
 * 1. 行业模板生成 — 按 Coze 3.0 规范生成 SKILL.md + references/ + scripts/
 * 2. Microsoft SKILL Pattern — 按 BUILD 2026 规范生成 6 章节结构
 * 3. 描述包装 — 将优化后的描述包装为行业标准格式
 * 4. 批量模板化 — 一键将技能目录转换为 Coze 3.0 可上架结构
 */

import fs from "node:fs";
import path from "node:path";
import type { Skill } from "./skill-audit.js";
import { suggestDescription } from "./skill-audit.js";
import type { IndustryCategory } from "./skill-compliance.js";
import { detectIndustry } from "./skill-compliance.js";

// ============================================================================
// Types
// ============================================================================

/** 行业技能包模板配置 */
export interface IndustryTemplateConfig {
  industry: IndustryCategory;
  skillName: string;
  description: string;
  category?: string;
  tags?: string[];
  version?: string;
  author?: string;
  /** 是否生成 references/ 目录 */
  includeReferences?: boolean;
  /** 是否生成 scripts/ 目录 */
  includeScripts?: boolean;
}

/** 模板生成结果 */
export interface TemplateResult {
  skillName: string;
  industry: IndustryCategory;
  generatedFiles: string[];
  skillMdContent: string;
  /** 是否覆盖了已有文件 */
  overwritten: string[];
  /** Microsoft SKILL Pattern 内容（可选） */
  skillPatternContent?: string;
}

/** 批量模板生成报告 */
export interface TemplateReport {
  generated: string;
  totalSkills: number;
  templatedSkills: number;
  skippedSkills: number;
  results: TemplateResult[];
}

// ============================================================================
// Microsoft SKILL Pattern Types (BUILD 2026)
// ============================================================================

/** Microsoft SKILL Pattern 6 章节格式 */
export interface SKILLPatternFormat {
  /** 技能范围与边界 */
  scope: {
    description: string;
    useCases: string[];
    boundaries: string[];
    triggerPhrases: string[];
  };
  /** 惯用表达 */
  idioms: {
    instructionStyle: string;
    examplePhrases: string[];
    responseFormat: string;
  };
  /** 正确模式 */
  patterns: {
    happyPaths: string[];
    bestPractices: string[];
    chainOfThought?: string[];
  };
  /** 测试夹具 */
  fixtures: {
    testCases: {
      input: string;
      expectedOutput: string;
      notes?: string;
    }[];
    benchmarkTasks?: string[];
  };
  /** 反模式（不要做的事） */
  antiPatterns: {
    failureModes: string[];
    redFlags: string[];
    whatToAvoid: string[];
  };
  /** 启发式规则 */
  heuristics: {
    decisionRules: string[];
    priorityGuidelines: string[];
    edgeCaseHandling: string[];
  };
}

// ============================================================================
// 行业模板元数据
// ============================================================================

/** 行业默认标签 */
const INDUSTRY_DEFAULT_TAGS: Record<IndustryCategory, string[]> = {
  finance: ["投资", "股票", "A股", "财务分析", "数据驱动"],
  legal: ["法律", "合规", "案例检索", "合同审查", "风险评估"],
  "self-media": ["自媒体", "内容创作", "爆款", "运营", "传播"],
  medical: ["医疗", "健康", "临床", "诊断辅助", "药物"],
  tech: ["开发", "自动化", "代码", "部署", "架构"],
  education: ["教育", "学习", "考试", "课程", "知识"],
  general: ["工具", "效率", "自动化"],
};

/** 行业描述模板 */
const INDUSTRY_DESC_TEMPLATES: Record<IndustryCategory, (name: string) => string> = {
  finance: (name) => `${name}: analyze, track, alert. 数据驱动投资决策`,
  legal: (name) => `${name}: search, review, draft. 法律合规全流程`,
  "self-media": (name) => `${name}: create, optimize, publish. 爆款内容生产`,
  medical: (name) => `${name}: diagnose, research, summarize. 临床辅助决策`,
  tech: (name) => `${name}: build, deploy, verify. 工程自动化`,
  education: (name) => `${name}: teach, quiz, assess. 知识传递与检验`,
  general: (name) => `${name}: automate, streamline, deliver.`,
};

/** 行业 references 模板内容 */
const INDUSTRY_REFERENCES: Record<IndustryCategory, string> = {
  finance: `# 参考资料

## 数据来源
- 恒生聚源 A股数据库
- 上交所/深交所公告
- 上市公司财报

## 分析框架
- PESTLE 宏观分析
- 杜邦分析法
- DCF 估值模型
`,
  legal: `# 参考资料

## 法律法规
- 《民法典》
- 《刑法》
- 最高人民法院指导案例

## 检索来源
- 中国裁判文书网
- 北大法宝
- 国家法律法规数据库
`,
  "self-media": `# 参考资料

## 平台规范
- 抖音创作者学院
- 小红书社区规范
- B站创作指南

## 爆款方法论
- SEC语义熵增量控制
- 情绪价值锚定模型
- 非对称句式优化
`,
  medical: `# 参考资料

## 临床指南
- 中国临床指南库
- Cochrane Library

## 药物数据
- 国家药监局药品数据库
- 临床用药指南
`,
  tech: `# 参考资料

## 开发规范
- Git Flow 工作流
- 语义化版本规范
- Docker 最佳实践

## 架构模式
- 微服务架构
- 事件驱动架构
- Harness Engineering
`,
  education: `# 参考资料

## 教学设计
- 布鲁姆教育目标分类
- 间隔重复学习法
- 主动回忆策略

## 评估框架
- 形成性评估
- 总结性评估
`,
  general: `# 参考资料

## 通用方法论
- PDCA 循环
- SMART 原则
- 第一性原理思维
`,
};

// ============================================================================
// Core Functions
// ============================================================================

/** 生成行业标准 SKILL.md 内容 */
export function generateSkillMd(config: IndustryTemplateConfig): string {
  const tags = config.tags ?? INDUSTRY_DEFAULT_TAGS[config.industry];
  const version = config.version ?? "1.0.0";
  const author = config.author ?? "SelfClaw Team";

  let content = `---\n`;
  content += `name: ${config.skillName}\n`;
  content += `description: ${config.description}\n`;
  content += `category: ${config.category ?? config.industry}\n`;
  content += `tags: ${JSON.stringify(tags)}\n`;
  content += `version: "${version}"\n`;
  content += `author: "${author}"\n`;
  content += `license: MIT\n`;
  content += `coze_compatible: true\n`;
  content += `coze_version: "3.0"\n`;
  content += `---\n\n`;

  // 正文模板
  content += `# ${config.skillName}\n\n`;
  content += `${config.description}\n\n`;

  content += `## 使用场景\n\n`;
  content += `<!-- 描述此技能的典型使用场景 -->\n\n`;

  content += `## 快速参考\n\n`;
  content += `| 情况 | 动作 |\n`;
  content += `|------|------|\n`;
  content += `| TODO | TODO |\n\n`;

  content += `## 约束\n\n`;
  content += `- 必须结合用户上下文和记忆进行判断\n`;
  content += `- 不得泄露用户隐私或敏感信息\n`;
  content += `- 输出内容必须清晰、简洁\n`;

  return content;
}

/** 为已有技能生成行业包装 */
export function wrapSkillForMarketplace(
  skill: Skill,
  outputDir?: string
): TemplateResult {
  const industry = detectIndustry(skill);
  const targetDir = outputDir ?? skill.dir;

  const optimizedDesc = suggestDescription(skill);
  const industryDesc = INDUSTRY_DESC_TEMPLATES[industry](skill.baseName);
  const finalDesc = [...optimizedDesc].length <= 80 ? optimizedDesc : industryDesc;

  const config: IndustryTemplateConfig = {
    industry,
    skillName: skill.baseName,
    description: finalDesc,
    tags: INDUSTRY_DEFAULT_TAGS[industry],
    includeReferences: true,
    includeScripts: true,
  };

  const generatedFiles: string[] = [];
  const overwritten: string[] = [];

  // 1. 生成 SKILL.md（不覆盖已有内容，生成 .marketplace 版本）
  const skillMdPath = path.join(targetDir, "SKILL.marketplace.md");
  const skillMdContent = generateSkillMd(config);

  if (fs.existsSync(skillMdPath)) {
    overwritten.push(skillMdPath);
  }
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(skillMdPath, skillMdContent, "utf8");
  generatedFiles.push(skillMdPath);

  // 2. 生成 references/ 目录
  const refsDir = path.join(targetDir, "references");
  if (!fs.existsSync(refsDir)) {
    fs.mkdirSync(refsDir, { recursive: true });
    const refContent = INDUSTRY_REFERENCES[industry];
    const refPath = path.join(refsDir, "index.md");
    fs.writeFileSync(refPath, refContent, "utf8");
    generatedFiles.push(refPath);
  }

  // 3. 生成 scripts/ 目录（仅创建占位）
  const scriptsDir = path.join(targetDir, "scripts");
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
    const scriptReadme = `# Scripts\n\n此目录存放技能的可执行脚本。\n`;
    const scriptPath = path.join(scriptsDir, "README.md");
    fs.writeFileSync(scriptPath, scriptReadme, "utf8");
    generatedFiles.push(scriptPath);
  }

  return {
    skillName: skill.name,
    industry,
    generatedFiles,
    skillMdContent,
    overwritten,
  };
}

/** 批量生成行业模板 */
export function wrapAllSkillsForMarketplace(
  skills: Skill[],
  outputDir?: string
): TemplateReport {
  const results = skills.map(s => {
    try {
      return wrapSkillForMarketplace(s, outputDir);
    } catch {
      return null;
    }
  });

  const successful = results.filter((r): r is TemplateResult => r !== null);

  return {
    generated: new Date().toISOString(),
    totalSkills: skills.length,
    templatedSkills: successful.length,
    skippedSkills: skills.length - successful.length,
    results: successful,
  };
}

/** 仅生成 SKILL.md 内容（不写文件） */
export function previewSkillMd(skill: Skill): { content: string; industry: IndustryCategory } {
  const industry = detectIndustry(skill);
  const desc = suggestDescription(skill);

  return {
    content: generateSkillMd({
      industry,
      skillName: skill.baseName,
      description: desc,
      tags: INDUSTRY_DEFAULT_TAGS[industry],
    }),
    industry,
  };
}

// ============================================================================
// Microsoft SKILL Pattern 生成 (BUILD 2026)
// ============================================================================

/** 生成 Microsoft SKILL Pattern 6 章节内容 */
export function generateSKILLPattern(
  skillName: string,
  description: string,
  patternData: Partial<SKILLPatternFormat>
): string {
  const p = patternData;

  let content = `# SKILL Pattern: ${skillName}\n\n`;
  content += `> Build-Time 与 Runtime 的版本化契约。\n`;
  content += `> 基于 Microsoft Agent Framework SKILL Pattern 规范 (BUILD 2026)\n\n`;

  // 1. Scope
  content += `## 1. Scope（范围）\n\n`;
  content += `${p.scope?.description ?? description}\n\n`;
  content += `### 使用场景\n`;
  if (p.scope?.useCases?.length) {
    p.scope.useCases.forEach((uc, i) => {
      content += `${i + 1}. ${uc}\n`;
    });
  } else {
    content += `- TODO: 补充典型使用场景\n`;
  }
  content += `\n`;
  content += `### 边界（不做什么）\n`;
  if (p.scope?.boundaries?.length) {
    p.scope.boundaries.forEach(b => {
      content += `- **NOT** ${b}\n`;
    });
  } else {
    content += `- **NOT** TODO: 补充边界\n`;
  }
  content += `\n`;
  content += `### 触发短语\n`;
  if (p.scope?.triggerPhrases?.length) {
    content += p.scope.triggerPhrases.map(tp => `- "${tp}"`).join("\n") + "\n";
  } else {
    content += `- "TODO": 补充触发短语\n`;
  }
  content += `\n`;

  // 2. Idioms
  content += `## 2. Idioms（惯用表达）\n\n`;
  content += `### 指令风格\n`;
  content += `${p.idioms?.instructionStyle ?? "简洁、直接、行动导向"}\n\n`;
  content += `### 示例表达\n`;
  if (p.idioms?.examplePhrases?.length) {
    p.idioms.examplePhrases.forEach(ep => {
      content += `- "${ep}"\n`;
    });
  } else {
    content += `- TODO: 补充示例表达\n`;
  }
  content += `\n`;
  content += `### 响应格式\n`;
  content += `${p.idioms?.responseFormat ?? "结构化 Markdown，必要时使用表格"}\n\n`;

  // 3. Patterns
  content += `## 3. Patterns（正确模式）\n\n`;
  content += `### 成功路径\n`;
  if (p.patterns?.happyPaths?.length) {
    p.patterns.happyPaths.forEach((hp, i) => {
      content += `${i + 1}. ${hp}\n`;
    });
  } else {
    content += `- TODO: 补充成功路径\n`;
  }
  content += `\n`;
  content += `### 最佳实践\n`;
  if (p.patterns?.bestPractices?.length) {
    p.patterns.bestPractices.forEach(bp => {
      content += `- ${bp}\n`;
    });
  } else {
    content += `- TODO: 补充最佳实践\n`;
  }
  content += `\n`;
  if (p.patterns?.chainOfThought?.length) {
    content += `### 思维链\n`;
    p.patterns.chainOfThought.forEach(ct => {
      content += `→ ${ct}\n`;
    });
    content += `\n`;
  }

  // 4. Fixtures
  content += `## 4. Fixtures（测试夹具）\n\n`;
  content += `### 测试用例\n`;
  if (p.fixtures?.testCases?.length) {
    p.fixtures.testCases.forEach((tc, i) => {
      content += `**Case ${i + 1}**\n`;
      content += `- Input: ${tc.input}\n`;
      content += `- Expected: ${tc.expectedOutput}\n`;
      if (tc.notes) content += `- Note: ${tc.notes}\n`;
      content += `\n`;
    });
  } else {
    content += `| Input | Expected | Notes |\n`;
    content += `|-------|----------|-------|\n`;
    content += `| TODO | TODO | TODO |\n\n`;
  }
  content += `\n`;
  if (p.fixtures?.benchmarkTasks?.length) {
    content += `### 基准任务\n`;
    p.fixtures.benchmarkTasks.forEach((bt, i) => {
      content += `${i + 1}. ${bt}\n`;
    });
    content += `\n`;
  }

  // 5. Anti-Patterns
  content += `## 5. Anti-Patterns（反模式）\n\n`;
  content += `### 失败模式\n`;
  if (p.antiPatterns?.failureModes?.length) {
    p.antiPatterns.failureModes.forEach(fm => {
      content += `- ❌ ${fm}\n`;
    });
  } else {
    content += `- ❌ TODO: 补充失败模式\n`;
  }
  content += `\n`;
  content += `### 危险信号\n`;
  if (p.antiPatterns?.redFlags?.length) {
    p.antiPatterns.redFlags.forEach(rf => {
      content += `- ⚠️ ${rf}\n`;
    });
  } else {
    content += `- ⚠️ TODO: 补充危险信号\n`;
  }
  content += `\n`;
  content += `### 应避免的情况\n`;
  if (p.antiPatterns?.whatToAvoid?.length) {
    p.antiPatterns.whatToAvoid.forEach(wa => {
      content += `- ✗ ${wa}\n`;
    });
  } else {
    content += `- ✗ TODO: 补充应避免的情况\n`;
  }
  content += `\n`;

  // 6. Heuristics
  content += `## 6. Heuristics（启发式规则）\n\n`;
  content += `### 决策规则\n`;
  if (p.heuristics?.decisionRules?.length) {
    p.heuristics.decisionRules.forEach(dr => {
      content += `- ${dr}\n`;
    });
  } else {
    content += `- TODO: 补充决策规则\n`;
  }
  content += `\n`;
  content += `### 优先级指南\n`;
  if (p.heuristics?.priorityGuidelines?.length) {
    p.heuristics.priorityGuidelines.forEach(pg => {
      content += `- ${pg}\n`;
    });
  } else {
    content += `- TODO: 补充优先级指南\n`;
  }
  content += `\n`;
  content += `### 边界情况处理\n`;
  if (p.heuristics?.edgeCaseHandling?.length) {
    p.heuristics.edgeCaseHandling.forEach(ec => {
      content += `- ${ec}\n`;
    });
  } else {
    content += `- TODO: 补充边界情况处理\n`;
  }
  content += `\n`;

  content += `---\n`;
  content += `*Generated by SelfClaw Evolution v2.2 | SKILL Pattern ${new Date().toISOString().split("T")[0]}*\n`;

  return content;
}

/** 为已有技能生成 SKILL Pattern 版本 */
export function wrapSkillForSKILLPattern(
  skill: Skill,
  patternData: Partial<SKILLPatternFormat>,
  outputDir?: string
): TemplateResult {
  const industry = detectIndustry(skill);
  const targetDir = outputDir ?? skill.dir;
  const optimizedDesc = suggestDescription(skill);

  const skillPatternContent = generateSKILLPattern(skill.baseName, optimizedDesc, patternData);

  const generatedFiles: string[] = [];
  const overwritten: string[] = [];

  // 生成 SKILL.pattern.md
  const patternPath = path.join(targetDir, "SKILL.pattern.md");
  if (fs.existsSync(patternPath)) {
    overwritten.push(patternPath);
  }
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(patternPath, skillPatternContent, "utf8");
  generatedFiles.push(patternPath);

  return {
    skillName: skill.name,
    industry,
    generatedFiles,
    skillMdContent: "",
    overwritten,
    skillPatternContent,
  };
}

/** 批量生成 SKILL Pattern */
export function wrapAllSkillsForSKILLPattern(
  skills: Skill[],
  patternData?: Partial<SKILLPatternFormat>,
  outputDir?: string
): TemplateReport {
  const results = skills.map(s => {
    try {
      return wrapSkillForSKILLPattern(s, patternData ?? {}, outputDir);
    } catch {
      return null;
    }
  });

  const successful = results.filter((r): r is TemplateResult => r !== null);

  return {
    generated: new Date().toISOString(),
    totalSkills: skills.length,
    templatedSkills: successful.length,
    skippedSkills: skills.length - successful.length,
    results: successful,
  };
}

/** 预览 SKILL Pattern 内容（不写文件） */
export function previewSKILLPattern(
  skill: Skill,
  patternData?: Partial<SKILLPatternFormat>
): string {
  const desc = suggestDescription(skill);
  return generateSKILLPattern(skill.baseName, desc, patternData ?? {});
}
