/**
 * Skill Compliance - 行业技能包合规检查模块
 * 对标 Coze 3.0 行业技能包标准，检查 SKILL.md 是否符合上架规范
 *
 * 合规维度：
 * 1. Frontmatter 必填字段检查 (name, description)
 * 2. 描述质量检查 (长度、可读性、路标式)
 * 3. 行业标签检查 (category, tags, industry)
 * 4. 安全合规检查 (无硬编码密钥、无危险操作)
 * 5. Coze 3.0 技能包结构规范
 */

import fs from "node:fs";
import path from "node:path";
import type { Skill } from "./skill-audit.js";
import { suggestDescription } from "./skill-audit.js";

// ============================================================================
// Types
// ============================================================================

/** 行业分类 */
export type IndustryCategory =
  | "finance"
  | "legal"
  | "self-media"
  | "medical"
  | "tech"
  | "education"
  | "general";

/** 合规检查级别 */
export type ComplianceLevel = "pass" | "warning" | "fail";

/** 单项合规检查结果 */
export interface ComplianceCheck {
  /** 检查项名称 */
  rule: string;
  /** 检查结果 */
  level: ComplianceLevel;
  /** 说明 */
  message: string;
  /** 修复建议 */
  suggestion?: string;
}

/** 技能合规报告 */
export interface SkillComplianceReport {
  skillName: string;
  filePath: string;
  industry: IndustryCategory;
  overallLevel: ComplianceLevel;
  score: number; // 0-100
  checks: ComplianceCheck[];
  /** Coze 3.0 上架就绪 */
  marketplaceReady: boolean;
  /** 自动修复后的 SKILL.md 内容（如果可自动修复） */
  autoFixContent?: string;
}

/** 批量合规报告 */
export interface ComplianceAuditReport {
  generated: string;
  totalSkills: number;
  passCount: number;
  warningCount: number;
  failCount: number;
  marketplaceReadyCount: number;
  averageScore: number;
  reports: SkillComplianceReport[];
  /** 行业分布 */
  industryDistribution: Record<IndustryCategory, number>;
}

// ============================================================================
// Coze 3.0 行业技能包规范
// ============================================================================

/** 行业标签关键词映射 */
const INDUSTRY_KEYWORDS: Record<IndustryCategory, string[]> = {
  finance: ["stock", "invest", "trad", "fund", "etf", "a-share", "financial", "portfolio", "证券", "股票", "基金", "投资", "财报", "估值"],
  legal: ["law", "legal", "court", "case", "compliance", "contract", "litigation", "法律", "法规", "案例", "合规", "合同", "诉讼"],
  "self-media": ["抖音", "小红书", "视频", "文案", "爆款", "标题", "播放", "涨粉", "douyin", "tiktok", "content", "viral", "thumbnail"],
  medical: ["medical", "health", "clinical", "drug", "patient", "diagnosis", "医疗", "健康", "临床", "药品", "诊断"],
  tech: ["code", "debug", "deploy", "api", "docker", "git", "cicd", "代码", "部署", "开发", "编程", "架构"],
  education: ["teach", "learn", "study", "course", "exam", "quiz", "教育", "学习", "考试", "课程"],
  general: [],
};

/** Coze 3.0 技能包 SKILL.md 必填字段 */
const REQUIRED_FRONTMATTER_FIELDS = ["name", "description"];

/** Coze 3.0 推荐字段（缺失为 warning） */
const RECOMMENDED_FRONTMATTER_FIELDS = ["category", "tags"];

/** 描述长度规范 */
const DESC_LENGTH = {
  /** 最优描述长度上限（字符） */
  optimal: 80,
  /** 最大可接受长度 */
  maxAcceptable: 150,
  /** 路标式描述目标（词/词组数） */
  signpostWords: 40,
};

/** 安全敏感关键词 */
const SECURITY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /(?:api[_-]?key|apikey|access[_-]?token|secret[_-]?key)\s*[:=]\s*['"]?[a-zA-Z0-9]{10,}/i, label: "硬编码密钥/Token" },
  { pattern: /password\s*[:=]\s*['"]?[^\s'"<>]{6,}/i, label: "硬编码密码" },
  { pattern: /rm\s+-rf\s+\//i, label: "危险删除命令" },
  { pattern: /curl\s+.*\|\s*sh/i, label: "远程脚本执行" },
  { pattern: /eval\s*\(/i, label: "eval() 调用" },
];

// ============================================================================
// Core Functions
// ============================================================================

/** 检测技能所属行业 */
export function detectIndustry(skill: Skill): IndustryCategory {
  const text = `${skill.baseName} ${skill.description} ${skill.bodyKey}`.toLowerCase();

  let bestIndustry: IndustryCategory = "general";
  let bestScore = 0;

  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    if (industry === "general") continue;
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndustry = industry as IndustryCategory;
    }
  }

  return bestIndustry;
}

/** 解析 SKILL.md 全部 frontmatter 字段 */
function parseAllFrontmatter(filePath: string): Record<string, string> {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    const lines = text.split(/\r?\n/);
    if (lines[0]?.trim() !== "---") return {};

    const fields: Record<string, string> = {};
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === "---") break;
      const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i] ?? "");
      if (match) {
        const key = match[1];
        const raw = (match[2] ?? "").trim();
        // Handle block scalars
        if (raw === "|" || raw === ">") {
          const block: string[] = [];
          for (let j = i + 1; j < lines.length; j++) {
            if (/^[A-Za-z0-9_-]+:\s*/ .test(lines[j] ?? "")) break;
            if ((lines[j] ?? "").trim() === "---") break;
            block.push((lines[j] ?? "").replace(/^\s{2}/, ""));
          }
          fields[key] = block.join(" ").trim();
        } else {
          fields[key] = raw.replace(/^['"]|['"]$/g, "");
        }
      }
    }
    return fields;
  } catch {
    return {};
  }
}

/** 检查 Frontmatter 必填字段 */
function checkFrontmatter(skill: Skill, fields: Record<string, string>): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    if (!fields[field] || fields[field].trim() === "") {
      checks.push({
        rule: `frontmatter.required.${field}`,
        level: "fail",
        message: `缺少必填字段: ${field}`,
        suggestion: `在 SKILL.md frontmatter 中添加 ${field} 字段`,
      });
    }
  }

  for (const field of RECOMMENDED_FRONTMATTER_FIELDS) {
    if (!fields[field] || fields[field].trim() === "") {
      checks.push({
        rule: `frontmatter.recommended.${field}`,
        level: "warning",
        message: `缺少推荐字段: ${field}`,
        suggestion: `添加 ${field} 字段以符合 Coze 3.0 行业技能包规范`,
      });
    }
  }

  return checks;
}

/** 检查描述质量 */
function checkDescriptionQuality(skill: Skill): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];
  const desc = skill.description;
  const charCount = [...desc].length;

  // 长度检查
  if (charCount === 0) {
    checks.push({
      rule: "description.empty",
      level: "fail",
      message: "描述为空",
      suggestion: "添加简洁的技能描述，建议 40-80 字符",
    });
  } else if (charCount > DESC_LENGTH.maxAcceptable) {
    checks.push({
      rule: "description.tooLong",
      level: "warning",
      message: `描述过长 (${charCount} 字符，建议 ≤${DESC_LENGTH.maxAcceptable})`,
      suggestion: "精简描述，采用路标式格式: 平台/场景: 动作词",
    });
  } else if (charCount > DESC_LENGTH.optimal) {
    checks.push({
      rule: "description.suboptimal",
      level: "warning",
      message: `描述偏长 (${charCount} 字符，建议 ≤${DESC_LENGTH.optimal})`,
      suggestion: "进一步精简可提升 Agent 选对率",
    });
  }

  // 路标式检查：描述应包含动作词
  const actionVerbs = /\b(audit|analyze|search|create|build|deploy|review|fix|clean|track|monitor|fetch|push|alert|detect|optimize|generate|summarize|triage|debug|inspect)\b/i;
  if (desc && !actionVerbs.test(desc)) {
    checks.push({
      rule: "description.noActionVerb",
      level: "warning",
      message: "描述缺少动作词，不符合路标式规范",
      suggestion: "在描述开头加入动词，如 'audit', 'track', 'generate'",
    });
  }

  // AI 味检查
  const aiPatterns = /\b(seamlessly|comprehensive|powerful|intelligent|advanced|robust|cutting-edge|state-of-the-art)\b/i;
  if (aiPatterns.test(desc)) {
    checks.push({
      rule: "description.aiFluff",
      level: "warning",
      message: "描述包含 AI 味冗余词",
      suggestion: "删除 'seamlessly', 'comprehensive', 'powerful' 等冗余修饰",
    });
  }

  return checks;
}

/** 安全合规检查 */
function checkSecurity(skill: Skill): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  // 读取 SKILL.md 全文
  try {
    const fullText = fs.readFileSync(skill.filePath, "utf8");

    for (const { pattern, label } of SECURITY_PATTERNS) {
      if (pattern.test(fullText)) {
        checks.push({
          rule: `security.${label}`,
          level: "fail",
          message: `检测到安全风险: ${label}`,
          suggestion: "移除硬编码凭据，改用环境变量；避免危险命令",
        });
      }
    }
  } catch {
    // 无法读取文件，跳过
  }

  return checks;
}

/** Coze 3.0 结构规范检查 */
function checkCozeStructure(skill: Skill): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];
  const dir = skill.dir;

  // 检查是否包含必要的文件结构
  const requiredFiles = ["SKILL.md"];
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(dir, file))) {
      checks.push({
        rule: "structure.missingFile",
        level: "fail",
        message: `缺少必要文件: ${file}`,
        suggestion: `在技能目录中创建 ${file}`,
      });
    }
  }

  // 检查 references/ 目录（Coze 3.0 推荐结构）
  if (!fs.existsSync(path.join(dir, "references"))) {
    checks.push({
      rule: "structure.noReferences",
      level: "warning",
      message: "缺少 references/ 目录",
      suggestion: "创建 references/ 目录存放参考文档，符合 Coze 3.0 行业技能包规范",
    });
  }

  // 检查 scripts/ 目录
  if (!fs.existsSync(path.join(dir, "scripts"))) {
    checks.push({
      rule: "structure.noScripts",
      level: "warning",
      message: "缺少 scripts/ 目录",
      suggestion: "如技能包含可执行脚本，创建 scripts/ 目录",
    });
  }

  return checks;
}

/** 生成自动修复内容 */
function generateAutoFix(skill: Skill, fields: Record<string, string>, industry: IndustryCategory): string | undefined {
  const checks = [
    ...checkFrontmatter(skill, fields),
    ...checkDescriptionQuality(skill),
  ];

  // 只在有关键字段缺失或描述需要修复时才生成
  const hasFail = checks.some(c => c.level === "fail");
  const hasDescIssue = checks.some(c => c.rule.startsWith("description.") && c.level !== "pass");

  if (!hasFail && !hasDescIssue) return undefined;

  // 读取原始内容
  let original: string;
  try {
    original = fs.readFileSync(skill.filePath, "utf8");
  } catch {
    return undefined;
  }

  // 构建 frontmatter
  const fm: Record<string, string> = { ...fields };

  // 补充 name
  if (!fm.name || fm.name.trim() === "") {
    fm.name = skill.baseName;
  }

  // 补充 description（使用 suggestDescription 的结果）
  if (!fm.description || fm.description.trim() === "" || [...fm.description].length > DESC_LENGTH.optimal) {
    fm.description = suggestDescription(skill);
  }

  // 补充 category
  if (!fm.category) {
    fm.category = industry;
  }

  // 补充 tags
  if (!fm.tags) {
    const tags = [industry !== "general" ? industry : skill.baseName.split("-")[0] ?? "utility"];
    fm.tags = JSON.stringify(tags);
  }

  // 提取 body（去除旧 frontmatter）
  let body = original;
  const fmMatch = /^---\n([\s\S]*?)\n---\n?/;
  if (fmMatch.test(original)) {
    body = original.replace(fmMatch, "");
  }

  // 生成新的 SKILL.md
  let newFm = "---\n";
  for (const [key, value] of Object.entries(fm)) {
    if (value.includes("\n") || value.includes(":")) {
      newFm += `${key} |\n  ${value.replace(/\n/g, "\n  ")}\n`;
    } else {
      newFm += `${key}: ${value}\n`;
    }
  }
  newFm += "---\n\n";

  return newFm + body;
}

/** 计算合规评分 */
function computeScore(checks: ComplianceCheck[]): number {
  let score = 100;
  for (const check of checks) {
    if (check.level === "fail") score -= 20;
    else if (check.level === "warning") score -= 5;
  }
  return Math.max(0, score);
}

/** 确定总体合规级别 */
function overallLevel(checks: ComplianceCheck[]): ComplianceLevel {
  if (checks.some(c => c.level === "fail")) return "fail";
  if (checks.some(c => c.level === "warning")) return "warning";
  return "pass";
}

// ============================================================================
// Public API
// ============================================================================

/** 单技能合规检查 */
export function auditSkillCompliance(skill: Skill): SkillComplianceReport {
  const fields = parseAllFrontmatter(skill.filePath);
  const industry = detectIndustry(skill);

  const checks: ComplianceCheck[] = [
    ...checkFrontmatter(skill, fields),
    ...checkDescriptionQuality(skill),
    ...checkSecurity(skill),
    ...checkCozeStructure(skill),
  ];

  const score = computeScore(checks);
  const level = overallLevel(checks);
  const marketplaceReady = score >= 80 && !checks.some(c => c.level === "fail");

  let autoFixContent: string | undefined;
  try {
    autoFixContent = generateAutoFix(skill, fields, industry);
  } catch {
    // autoFix is best-effort
  }

  return {
    skillName: skill.name,
    filePath: skill.filePath,
    industry,
    overallLevel: level,
    score,
    checks,
    marketplaceReady,
    autoFixContent,
  };
}

/** 批量合规检查 */
export function auditAllCompliance(skills: Skill[]): ComplianceAuditReport {
  const reports = skills.map(s => auditSkillCompliance(s));

  const passCount = reports.filter(r => r.overallLevel === "pass").length;
  const warningCount = reports.filter(r => r.overallLevel === "warning").length;
  const failCount = reports.filter(r => r.overallLevel === "fail").length;
  const marketplaceReadyCount = reports.filter(r => r.marketplaceReady).length;
  const averageScore = reports.length > 0
    ? Math.round(reports.reduce((sum, r) => sum + r.score, 0) / reports.length)
    : 0;

  const industryDistribution: Record<IndustryCategory, number> = {
    finance: 0, legal: 0, "self-media": 0, medical: 0,
    tech: 0, education: 0, general: 0,
  };
  for (const r of reports) {
    industryDistribution[r.industry]++;
  }

  return {
    generated: new Date().toISOString(),
    totalSkills: skills.length,
    passCount,
    warningCount,
    failCount,
    marketplaceReadyCount,
    averageScore,
    reports,
    industryDistribution,
  };
}
