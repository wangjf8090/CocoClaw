/**
 * Skill Audit - 技能审计模块 v2.1
 * 
 * v2.0: 移植自 steipete/agent-scripts skill-cleaner，适配 SelfClaw Docker 架构
 *       Token 预算审计 + 重复技能检测 + 根目录审计
 * 
 * v2.1: 基于论文群验证的实效性审计增强
 *       - arXiv:2605.23899: Meta-Skill三维度审计（失败机制编码/可操作具体性/高风险黑名单）
 *       - arXiv:2605.10500: 静默绕过检测（Silent Bypass）
 *       - arXiv:2605.23904: 验证门控（Validation Gate）支持
 */

import fs from "node:fs";
import path from "node:path";

// ============================================================================
// v2.0 Types (保留)
// ============================================================================

export interface Skill {
  name: string;
  baseName: string;
  description: string;
  filePath: string;
  dir: string;
  root: string;
  scope: string;
  enabled: boolean;
  descChars: number;
  lineChars: number;
  lineBytes: number;
  bodyHash: string;
  bodyKey: string;
  descKey: string;
}

export interface SkillBudget {
  model: string;
  contextTokens: number;
  contextSource: string;
  budgetPercent: number;
  budgetTokens: number;
  fullTokens: number;
  minimumTokens: number;
  budgetedTokens: number;
  budgetUsedRatio: number;
  contextUsedRatio: number;
  remainingBudgetTokens: number;
  includedSkills: number;
  omittedSkills: number;
  truncatedDescriptionChars: number;
  truncatedDescriptionCount: number;
}

export interface DuplicateGroup {
  name: string;
  skills: Skill[];
  keepSkill: Skill;
  deleteCandidates: Array<{ skill: Skill; similarity: { body: number; description: number } }>;
}

export interface AuditReport {
  generated: string;
  totalSkills: number;
  enabledSkills: number;
  budget: SkillBudget;
  descriptionCandidates: Array<{
    skill: Skill;
    suggested: string;
  }>;
  duplicatesByName: DuplicateGroup[];
  duplicatesByHash: Array<{ hash: string; skills: Skill[] }>;
  rootSummary: Array<{ root: string; count: number; disabled: number }>;
  // v2.1 新增
  metaSkillAudit?: MetaSkillAuditReport;
  negativeTransferRisk?: NegativeTransferRiskReport;
}

// ============================================================================
// v2.1 新增类型
// ============================================================================

/**
 * Meta-Skill三维度审计报告
 * 
 * 来源: arXiv:2605.23899
 * 论文验证了3个真正预测技能效果的维度:
 * - 失败机制编码(65.5%准确率): 说清"为什么失败"
 * - 可操作的具体性(66.0%): 步骤级操作指南
 * - 高风险操作黑名单(64.6%): 明确禁止有害操作
 * 
 * 对比: 7维"表面合理性"标准(清晰度/完整性/简洁性等)使用时6/9格性能下降
 */
export interface MetaSkillAuditReport {
  /** 失败机制编码评分 */
  failureMechanismEncoding: DimensionResult;
  /** 可操作的具体性评分 */
  actionableSpecificity: DimensionResult;
  /** 高风险操作黑名单评分 */
  highRiskBlacklist: DimensionResult;
  /** 三维度加权总分(0-100) */
  overallScore: number;
  /** 综合评级 */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** 改进建议 */
  improvementSuggestions: string[];
}

export interface DimensionResult {
  score: number;          // 0-100
  evidence: string[];     // 匹配到的证据行
  missing: string[];      // 缺失内容建议
  weight: number;         // 维度权重
}

/**
 * 负迁移风险评估报告
 * 
 * 来源: arXiv:2605.23899
 * 25%的组合出现负迁移，ALFWorld领域47%
 */
export interface NegativeTransferRiskReport {
  riskLevel: 'low' | 'medium' | 'high';
  domainType: DomainType;
  estimatedNegativeTransferRate: number;
  mitigationActions: string[];
}

export type DomainType = 'structured' | 'physical' | 'qa' | 'code' | 'unknown';

// ============================================================================
// Config (保留 + 扩展)
// ============================================================================

export interface AuditConfig {
  /** 模型上下文窗口大小，默认 272000 (GPT-5.5) */
  contextTokens?: number;
  /** 技能预算占上下文的百分比，默认 2 */
  budgetPercent?: number;
  /** 每字符 token 数，默认 4 */
  charsPerToken?: number;
  /** 技能根目录列表 */
  skillRoots: string[];
  /** 描述长度阈值，默认 110 */
  longDescThreshold?: number;
  // v2.1 新增
  /** 是否启用Meta-Skill三维度审计，默认 true */
  enableMetaSkillAudit?: boolean;
  /** 是否启用负迁移风险评估，默认 true */
  enableNegativeTransferRisk?: boolean;
}

const DEFAULT_CONFIG: Required<Omit<AuditConfig, "skillRoots">> = {
  contextTokens: 272_000,
  budgetPercent: 2,
  charsPerToken: 4,
  longDescThreshold: 110,
  enableMetaSkillAudit: true,
  enableNegativeTransferRisk: true,
};

// ============================================================================
// Meta-Skill 三维度检测规则
// ============================================================================

const META_SKILL_CRITERIA = {
  failureMechanismEncoding: {
    name: '失败机制编码',
    weight: 0.35,
    positivePatterns: [
      /因为.*失败|由于.*导致.*错误|.*不会被.*执行/,
      /因为.*不起作用|.*无法.*因为|.*导致.*无效/,
      /如果.*则.*失败|当.*时.*会出错|.*原因.*失败/,
      /不会.*计算|不会被.*处理|引擎.*不执行/,
      /失败原因|失败场景|失败模式|典型失败/,
      /修复流程|修复方法|解决方案.*失败|排查.*步骤/,
      /判断标准.*失败|错误.*原因|异常.*导致/,
      /failure.*because|fails.*when|due to.*error/i,
      /will not.*execute|cannot.*because|results in.*failure/i,
      /failure mode|troubleshooting|root cause/i,
    ],
    missingIndicators: [
      '技能缺少具体的失败原因说明——建议添加"因为/由于...导致失败"式的描述',
      '用具体的失败机制替代泛泛的"避免"建议',
    ],
  },
  actionableSpecificity: {
    name: '可操作的具体性',
    weight: 0.35,
    positivePatterns: [
      /使用.*命令|调用.*函数|执行.*脚本|运行.*工具/,
      /写入.*单元格|读取.*字段|检查.*表头|定位.*锚点/,
      /在.*中.*执行|通过.*方式|利用.*接口/,
      /修复流程|操作步骤|执行.*操作|检查.*位置/,
      /自检清单|验证.*结果|测试.*是否|确认.*成功/,
      /pip install|npm install|python3 |bash |curl |grep |cat /,
      /use.*command|call.*function|execute.*script|run.*tool/i,
      /write.*cell|read.*field|check.*header|anchor.*position/i,
      /step.*\d|follow.*these|run.*the.*command/i,
    ],
    missingIndicators: [
      '技能包含过多泛泛建议，缺少具体操作步骤',
      '建议用"使用X命令执行Y操作"替代"先明确任务要求"',
      '添加引用具体工具/对象名的操作指南',
    ],
  },
  highRiskBlacklist: {
    name: '高风险操作黑名单',
    weight: 0.30,
    positivePatterns: [
      /禁止.*|切勿.*|绝不.*|不可.*|不允许.*/,
      /不要.*重复|避免.*覆盖|禁止.*删除/,
      /NEVER|DO NOT|MUST NOT|FORBIDDEN|AVOID.*AT ALL COSTS/i,
      /黑名单|禁止列表|禁止操作|危险操作/,
    ],
    missingIndicators: [
      '技能缺少明确的高风险操作黑名单',
      '建议添加"禁止X"或"切勿Y"式的明确禁令',
    ],
  },
} as const;

// 领域负迁移风险映射 (来自2605.23899实验数据)
const DOMAIN_NEGATIVE_TRANSFER_RATES: Record<DomainType, { rate: number; level: 'low' | 'medium' | 'high' }> = {
  structured: { rate: 0.13, level: 'low' },
  code: { rate: 0.13, level: 'low' },
  qa: { rate: 0.20, level: 'medium' },
  physical: { rate: 0.47, level: 'high' },
  unknown: { rate: 0.25, level: 'medium' },
};

// ============================================================================
// v2.0 Core Functions (保留)
// ============================================================================

/** Codex 官方计费规则: ceil(utf8_bytes / 4) */
export function tokenCost(text: string): number {
  return Math.ceil(Buffer.byteLength(text, "utf8") / 4);
}

/** FNV-1a 32-bit hash */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** 文本归一化 */
function normalizeWords(input: string): string {
  return input
    .toLowerCase()
    .replace(/[`"'().,;:!?/\\[\]{}_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(input: string): Set<string> {
  return new Set(normalizeWords(input).split(" ").filter((w) => w.length >= 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

function sanitizeSingleLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function parseYamlScalar(raw: string): string {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseFrontmatter(
  file: string
): { name?: string; description?: string; body: string } | null {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;

  const fm: string[] = [];
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      end = i;
      break;
    }
    fm.push(lines[i] ?? "");
  }
  if (end < 0) return null;

  let name: string | undefined;
  let description: string | undefined;
  for (let i = 0; i < fm.length; i++) {
    const line = fm[i] ?? "";
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1];
    const raw = match[2] ?? "";
    if (key === "name") name = sanitizeSingleLine(parseYamlScalar(raw));
    if (key === "description") {
      if (raw.trim() === "|" || raw.trim() === ">") {
        const block: string[] = [];
        for (let j = i + 1; j < fm.length; j++) {
          if (/^[A-Za-z0-9_-]+:\s*/.test(fm[j] ?? "")) break;
          block.push((fm[j] ?? "").replace(/^\s{2}/, ""));
        }
        description = sanitizeSingleLine(block.join(" "));
      } else {
        description = sanitizeSingleLine(parseYamlScalar(raw));
      }
    }
  }

  return { name, description, body: lines.slice(end + 1).join("\n") };
}

function walkFiles(
  root: string,
  predicate: (file: string) => boolean,
  maxDepth = 8
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    let real: string;
    try {
      real = fs.realpathSync(dir);
    } catch {
      return;
    }
    if (seen.has(real)) return;
    seen.add(real);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        let stat: fs.Stats;
        try {
          stat = fs.statSync(file);
        } catch {
          continue;
        }
        if (stat.isDirectory()) walk(file, depth + 1);
      } else if (entry.isFile() && predicate(file)) {
        out.push(file);
      }
    }
  }

  try {
    if (fs.existsSync(root)) walk(root, 0);
  } catch {}
  return out;
}

function skillRootScope(root: string): string {
  const normalized = root.split(path.sep).join("/");
  if (normalized.includes("/packages/skills/")) return "selfclaw-skills";
  if (normalized.includes("/.codex/skills/")) return "codex";
  if (normalized.includes("/.codex/plugins/cache")) return "codex-plugin";
  if (normalized.includes("/.agents/skills/")) return "repo";
  return "extra";
}

function renderSkillLine(skill: Skill, description: string): string {
  return description
    ? `- ${skill.name}: ${description} (file: ${skill.filePath})`
    : `- ${skill.name}: (file: ${skill.filePath})`;
}

function lineTokenCost(skill: Skill, description?: string): number {
  const line = renderSkillLine(skill, description ?? skill.description);
  return tokenCost(`${line}\n`);
}

function minimumLineTokenCost(skill: Skill): number {
  return lineTokenCost(skill, "");
}

function fullLineTokenCost(skill: Skill): number {
  return lineTokenCost(skill);
}

function codexBudgetedSkillCost(
  skills: Skill[],
  budgetTokens: number
): {
  fullTokens: number;
  minimumTokens: number;
  budgetedTokens: number;
  includedSkills: number;
  omittedSkills: number;
  truncatedDescriptionChars: number;
  truncatedDescriptionCount: number;
} {
  const ordered = [...skills].sort((a, b) => {
    const scopeOrder: Record<string, number> = {
      "selfclaw-skills": 0,
      codex: 1,
      "codex-plugin": 2,
      repo: 3,
      extra: 4,
    };
    const byScope = (scopeOrder[a.scope] ?? 5) - (scopeOrder[b.scope] ?? 5);
    if (byScope !== 0) return byScope;
    return a.name.localeCompare(b.name);
  });

  const fullTokens = ordered.reduce((sum, s) => sum + fullLineTokenCost(s), 0);
  const minimumTokens = ordered.reduce(
    (sum, s) => sum + minimumLineTokenCost(s),
    0
  );

  if (fullTokens <= budgetTokens) {
    return {
      fullTokens,
      minimumTokens,
      budgetedTokens: fullTokens,
      includedSkills: ordered.length,
      omittedSkills: 0,
      truncatedDescriptionChars: 0,
      truncatedDescriptionCount: 0,
    };
  }

  if (minimumTokens <= budgetTokens) {
    const remainingByIndex = ordered.map((s) => [...s.description].length);
    const allocatedByIndex = ordered.map(() => 0);
    let remaining = budgetTokens - minimumTokens;

    for (let pass = 0; pass < 100; pass++) {
      let changed = false;
      for (let i = 0; i < ordered.length; i++) {
        if (allocatedByIndex[i] >= remainingByIndex[i]) continue;
        const nextChars = allocatedByIndex[i] + 1;
        const nextLine = renderSkillLine(
          ordered[i],
          [...ordered[i].description].slice(0, nextChars).join("")
        );
        const nextCost = tokenCost(`${nextLine}\n`);
        const currentLine = renderSkillLine(
          ordered[i],
          [...ordered[i].description]
            .slice(0, allocatedByIndex[i])
            .join("")
        );
        const currentCost = tokenCost(`${currentLine}\n`);
        const delta = nextCost - currentCost;
        if (delta <= remaining) {
          allocatedByIndex[i] = nextChars;
          remaining -= delta;
          changed = true;
        }
      }
      if (!changed) break;
    }

    const truncatedDescriptionChars = ordered.reduce(
      (sum, s, i) =>
        sum + Math.max(0, [...s.description].length - allocatedByIndex[i]),
      0
    );
    const truncatedDescriptionCount = ordered.filter(
      (s, i) => allocatedByIndex[i] < [...s.description].length
    ).length;

    const budgetedTokens = ordered.reduce((sum, s, i) => {
      const desc = [...s.description].slice(0, allocatedByIndex[i]).join("");
      return sum + lineTokenCost(s, desc);
    }, 0);

    return {
      fullTokens,
      minimumTokens,
      budgetedTokens,
      includedSkills: ordered.length,
      omittedSkills: 0,
      truncatedDescriptionChars,
      truncatedDescriptionCount,
    };
  }

  let budgetedTokens = 0;
  let includedSkills = 0;
  let omittedSkills = 0;

  for (const skill of ordered) {
    const cost = minimumLineTokenCost(skill);
    if (budgetedTokens + cost <= budgetTokens) {
      budgetedTokens += cost;
      includedSkills++;
    } else {
      omittedSkills++;
    }
  }

  return {
    fullTokens,
    minimumTokens,
    budgetedTokens,
    includedSkills,
    omittedSkills,
    truncatedDescriptionChars: ordered
      .slice(includedSkills)
      .reduce((sum, s) => sum + [...s.description].length, 0),
    truncatedDescriptionCount: ordered.slice(includedSkills).filter((s) => s.description.length > 0).length,
  };
}

// ============================================================================
// Description Suggestion Engine (保留)
// ============================================================================

const SCENE_KEYWORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bopenclaw|claw|clawd\b/, label: "OpenClaw" },
  { pattern: /\b(github|issue|pr|ci)\b|pull request/, label: "GitHub" },
  { pattern: /\bslack\b/, label: "Slack" },
  { pattern: /\bdiscord\b/, label: "Discord" },
  { pattern: /\bgmail|email\b/, label: "Gmail" },
  { pattern: /\b(google|drive|calendar|docs|sheets|slides)\b/, label: "Google" },
  { pattern: /\b(cloudflare|worker|wrangler)\b|durable object/, label: "Cloudflare" },
  { pattern: /\bfeishu|lark\b/, label: "Feishu" },
  { pattern: /\bselfclaw|self-evol|\bevolve\b/, label: "SelfClaw" },
  { pattern: /\bnews|aggregat|brief\b/, label: "News" },
  { pattern: /\bstock|invest|trad\b/, label: "Finance" },
  { pattern: /\bmemo|memory|remember\b/, label: "Memory" },
];

const ACTION_MAP: Array<{ pattern: RegExp; actions: string }> = [
  { pattern: /\btriage|review\b/, actions: "triage, review, proof" },
  { pattern: /\bdebug|diagnos|inspect\b/, actions: "debug, inspect, fix" },
  { pattern: /\bsearch|sync|archive\b/, actions: "search, sync, summarize" },
  { pattern: /\bdeploy|release|publish|ship\b/, actions: "deploy, release, verify" },
  { pattern: /\bcreate|scaffold|build\b/, actions: "create, build, validate" },
  { pattern: /\bnews|aggregat|brief\b/, actions: "aggregate, summarize, push" },
  { pattern: /\bstock|invest|trad\b/, actions: "analyze, track, alert" },
  { pattern: /\bmemo|memory|remember\b/, actions: "store, recall, evolve" },
  { pattern: /\bdetox|deodor|clean\b/, actions: "clean, humanize, verify" },
];

export function suggestDescription(skill: Skill): string {
  const source = normalizeWords(`${skill.baseName} ${skill.description}`);
  const cues: string[] = [];

  for (const { pattern, label } of SCENE_KEYWORDS) {
    if (pattern.test(source) && !cues.includes(label)) cues.push(label);
  }

  const verbs = cues.length
    ? cues.slice(0, 5).join(", ")
    : skill.baseName.replace(/-/g, " ");

  let action = "audit, clean, verify";
  for (const { pattern, actions } of ACTION_MAP) {
    if (pattern.test(source)) {
      action = actions;
      break;
    }
  }

  return `${verbs}: ${action}.`;
}

// ============================================================================
// Discovery & Audit (v2.0 保留)
// ============================================================================

export function discoverSkills(config: AuditConfig): Skill[] {
  const skills: Skill[] = [];
  const seen = new Set<string>();

  for (const root of config.skillRoots) {
    const files = walkFiles(
      root,
      (candidate) => path.basename(candidate) === "SKILL.md",
      10
    );

    for (const file of files) {
      const parsed = parseFrontmatter(file);
      if (!parsed) continue;

      const baseName = parsed.name || path.basename(path.dirname(file));
      const description = parsed.description ?? "";
      const rendered = description
        ? `- ${baseName}: ${description} (file: ${file})`
        : `- ${baseName}: (file: ${file})`;

      const bodyKey = normalizeWords(parsed.body);
      const scope = skillRootScope(root);

      let realPath: string;
      try {
        realPath = fs.realpathSync(file);
      } catch {
        realPath = file;
      }
      if (seen.has(realPath)) continue;
      seen.add(realPath);

      skills.push({
        name: baseName,
        baseName,
        description,
        filePath: file,
        dir: path.dirname(file),
        root,
        scope,
        enabled: true,
        descChars: [...description].length,
        lineChars: [...`${rendered}\n`].length,
        lineBytes: Buffer.byteLength(`${rendered}\n`, "utf8"),
        bodyHash: fnv1a(bodyKey),
        bodyKey,
        descKey: normalizeWords(description),
      });
    }
  }

  return skills;
}

export function computeBudget(skills: Skill[], config: AuditConfig): SkillBudget {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const budgetTokens = Math.floor(
    (cfg.contextTokens * cfg.budgetPercent) / 100
  );
  const codexCost = codexBudgetedSkillCost(skills, budgetTokens);

  return {
    model: "selfclaw",
    contextTokens: cfg.contextTokens,
    contextSource: "config",
    budgetPercent: cfg.budgetPercent,
    budgetTokens,
    fullTokens: codexCost.fullTokens,
    minimumTokens: codexCost.minimumTokens,
    budgetedTokens: codexCost.budgetedTokens,
    budgetUsedRatio: codexCost.budgetedTokens / budgetTokens,
    contextUsedRatio: codexCost.budgetedTokens / cfg.contextTokens,
    remainingBudgetTokens: budgetTokens - codexCost.budgetedTokens,
    includedSkills: codexCost.includedSkills,
    omittedSkills: codexCost.omittedSkills,
    truncatedDescriptionChars: codexCost.truncatedDescriptionChars,
    truncatedDescriptionCount: codexCost.truncatedDescriptionCount,
  };
}

export function detectDuplicates(skills: Skill[]): {
  byName: DuplicateGroup[];
  byHash: Array<{ hash: string; skills: Skill[] }>;
} {
  const enabled = skills.filter((s) => s.enabled);
  const byBaseName = new Map<string, Skill[]>();

  for (const skill of enabled) {
    const key = skill.baseName.toLowerCase();
    if (!byBaseName.has(key)) byBaseName.set(key, []);
    byBaseName.get(key)!.push(skill);
  }

  const byName: DuplicateGroup[] = [];
  for (const [name, list] of byBaseName) {
    if (list.length <= 1) continue;

    const keep = [...list].sort((a, b) => {
      const scopeOrder: Record<string, number> = {
        "selfclaw-skills": 0,
        codex: 1,
        "codex-plugin": 2,
        repo: 3,
        extra: 4,
      };
      return (scopeOrder[a.scope] ?? 5) - (scopeOrder[b.scope] ?? 5);
    })[0];

    const deleteCandidates = list
      .filter((s) => s.filePath !== keep.filePath)
      .map((s) => ({
        skill: s,
        similarity: {
          body: keep.bodyHash === s.bodyHash ? 1 : jaccard(wordSet(keep.bodyKey), wordSet(s.bodyKey)),
          description: jaccard(wordSet(keep.descKey), wordSet(s.descKey)),
        },
      }))
      .filter(({ similarity }) => similarity.body >= 0.85 || (similarity.body >= 0.7 && similarity.description >= 0.85));

    byName.push({ name, skills: list, keepSkill: keep, deleteCandidates });
  }

  const byBodyHash = new Map<string, Skill[]>();
  for (const skill of enabled) {
    if (skill.bodyHash === "811c9dc5") continue;
    if (!byBodyHash.has(skill.bodyHash)) byBodyHash.set(skill.bodyHash, []);
    byBodyHash.get(skill.bodyHash)!.push(skill);
  }

  const byHash = [...byBodyHash.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([hash, skills]) => ({ hash, skills }));

  return { byName, byHash };
}

// ============================================================================
// v2.1 新增: Meta-Skill 三维度审计
// ============================================================================

/**
 * 对技能body进行Meta-Skill三维度审计
 * 
 * 核心思想: 不是检查文本"看起来好不好"，而是检查是否包含
 * 论文验证的与实际效果相关的3个维度内容
 */
export function auditMetaSkill(skillBody: string): MetaSkillAuditReport {
  const lines = skillBody.split('\n');
  const dimensionResults: Record<string, DimensionResult> = {};
  const suggestions: string[] = [];

  for (const [key, criterion] of Object.entries(META_SKILL_CRITERIA)) {
    const evidence: string[] = [];
    let positiveHits = 0;

    for (const pattern of criterion.positivePatterns) {
      for (const line of lines) {
        if (pattern.test(line)) {
          positiveHits++;
          evidence.push(line.trim());
        }
      }
    }

    // 评分逻辑
    let score: number;
    if (positiveHits >= 3) {
      score = 90 + Math.min(10, (positiveHits - 3) * 2);
    } else if (positiveHits >= 1) {
      score = 60 + positiveHits * 10;
    } else {
      score = 20;
    }

    const missing = score < 70 ? criterion.missingIndicators.slice() : [];
    if (score < 50) {
      suggestions.push(...missing);
    }

    dimensionResults[key] = {
      score,
      evidence: evidence.slice(0, 10),
      missing,
      weight: criterion.weight,
    };
  }

  const fme = dimensionResults.failureMechanismEncoding!;
  const as = dimensionResults.actionableSpecificity!;
  const hrb = dimensionResults.highRiskBlacklist!;

  const overallScore = Math.round(
    fme.score * fme.weight +
    as.score * as.weight +
    hrb.score * hrb.weight
  );

  const grade = overallScore >= 90 ? 'A' : overallScore >= 75 ? 'B' : overallScore >= 60 ? 'C' : overallScore >= 40 ? 'D' : 'F';

  return {
    failureMechanismEncoding: fme,
    actionableSpecificity: as,
    highRiskBlacklist: hrb,
    overallScore,
    grade,
    improvementSuggestions: suggestions,
  };
}

/**
 * 推断技能所属领域类型
 */
function inferDomainType(skillBody: string): DomainType {
  const lower = skillBody.toLowerCase();
  if (/spreadsheet|表格|excel|单元格|公式/.test(lower)) return 'structured';
  if (/代码|修复|bug|漏洞|commit|pr/.test(lower)) return 'code';
  if (/搜索|问答|qa|query|检索/.test(lower)) return 'qa';
  if (/物体|移动|抓取|环境|alfworld|具身/.test(lower)) return 'physical';
  return 'unknown';
}

/**
 * 负迁移风险评估
 */
export function assessNegativeTransferRisk(skillBody: string): NegativeTransferRiskReport {
  const domainType = inferDomainType(skillBody);
  const domainRisk = DOMAIN_NEGATIVE_TRANSFER_RATES[domainType];
  const actions: string[] = [];

  if (domainRisk.level === 'high') {
    actions.push('该领域负迁移率高达47%，强烈建议部署前进行沙箱验证');
    actions.push('考虑为不同模型提供差异化的技能版本');
  } else if (domainRisk.level === 'medium') {
    actions.push('该领域有一定负迁移风险，建议在目标模型上验证效果');
  } else {
    actions.push('该领域负迁移风险较低，常规验证即可');
  }

  return {
    riskLevel: domainRisk.level,
    domainType,
    estimatedNegativeTransferRate: domainRisk.rate,
    mitigationActions: actions,
  };
}

// ============================================================================
// v2.1 增强的完整审计报告
// ============================================================================

/** 生成完整审计报告 (v2.1增强) */
export function runAudit(config: AuditConfig): AuditReport {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const skills = discoverSkills(config);
  const enabled = skills.filter((s) => s.enabled);
  const budget = computeBudget(enabled, config);
  const { byName, byHash } = detectDuplicates(skills);

  const longDescThreshold = config.longDescThreshold ?? DEFAULT_CONFIG.longDescThreshold;
  const descriptionCandidates = enabled
    .filter((s) => s.descChars >= longDescThreshold)
    .sort((a, b) => b.descChars - a.descChars)
    .slice(0, 30)
    .map((skill) => ({
      skill,
      suggested: suggestDescription(skill),
    }));

  const rootMap = new Map<string, { count: number; disabled: number }>();
  for (const skill of skills) {
    if (!rootMap.has(skill.root)) {
      rootMap.set(skill.root, { count: 0, disabled: 0 });
    }
    const entry = rootMap.get(skill.root)!;
    entry.count++;
    if (!skill.enabled) entry.disabled++;
  }

  const rootSummary = [...rootMap.entries()]
    .map(([root, { count, disabled }]) => ({ root, count, disabled }))
    .sort((a, b) => b.count - a.count);

  const report: AuditReport = {
    generated: new Date().toISOString(),
    totalSkills: skills.length,
    enabledSkills: enabled.length,
    budget,
    descriptionCandidates,
    duplicatesByName: byName,
    duplicatesByHash: byHash,
    rootSummary,
  };

  // v2.1: 对每个技能进行Meta-Skill审计和负迁移风险评估
  // 这里对全局做汇总：取所有技能的Meta-Skill平均分
  if (cfg.enableMetaSkillAudit && enabled.length > 0) {
    const allAudits = enabled.map((s) => {
      // 读取技能body用于审计
      const body = fs.readFileSync(s.filePath, "utf8");
      return auditMetaSkill(body);
    });

    const avgScore = Math.round(
      allAudits.reduce((sum, a) => sum + a.overallScore, 0) / allAudits.length
    );

    // 汇总各维度平均分
    const avgFME = Math.round(allAudits.reduce((s, a) => s + a.failureMechanismEncoding.score, 0) / allAudits.length);
    const avgAS = Math.round(allAudits.reduce((s, a) => s + a.actionableSpecificity.score, 0) / allAudits.length);
    const avgHRB = Math.round(allAudits.reduce((s, a) => s + a.highRiskBlacklist.score, 0) / allAudits.length);

    // 汇总改进建议(去重)
    const allSuggestions = [...new Set(allAudits.flatMap((a) => a.improvementSuggestions))];

    report.metaSkillAudit = {
      failureMechanismEncoding: {
        score: avgFME,
        evidence: [],
        missing: avgFME < 70 ? META_SKILL_CRITERIA.failureMechanismEncoding.missingIndicators.slice() : [],
        weight: 0.35,
      },
      actionableSpecificity: {
        score: avgAS,
        evidence: [],
        missing: avgAS < 70 ? META_SKILL_CRITERIA.actionableSpecificity.missingIndicators.slice() : [],
        weight: 0.35,
      },
      highRiskBlacklist: {
        score: avgHRB,
        evidence: [],
        missing: avgHRB < 70 ? META_SKILL_CRITERIA.highRiskBlacklist.missingIndicators.slice() : [],
        weight: 0.30,
      },
      overallScore: avgScore,
      grade: avgScore >= 90 ? 'A' : avgScore >= 75 ? 'B' : avgScore >= 60 ? 'C' : avgScore >= 40 ? 'D' : 'F',
      improvementSuggestions: allSuggestions,
    };
  }

  if (cfg.enableNegativeTransferRisk && enabled.length > 0) {
    // 取第一个技能的body推断领域（简化：取最常见领域）
    const domainCounts = new Map<DomainType, number>();
    for (const s of enabled) {
      const body = fs.readFileSync(s.filePath, "utf8");
      const domain = inferDomainType(body);
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    }
    const dominantDomain = [...domainCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';

    report.negativeTransferRisk = assessNegativeTransferRisk(
      // 用领域标识代替body
      dominantDomain === 'structured' ? 'spreadsheet' : dominantDomain
    );
  }

  return report;
}

// ============================================================================
// v3.6.1 新增: 反合理化表集成
// 来源: addyosmani/agent-skills（TDD/Code Review 技能集 + 反合理化表机制）
// ============================================================================

import {
  detectRationalization,
  verifySelfJustification,
  logAntiRationalization,
  getAntiRationalizationReport,
  clearAntiRationalizationLogs,
  generateMarkdownReport,
  getAntiRationalizationTable,
  type AntiRationalizationDetection,
  type AntiRationalizationLog,
  type AntiRationalizationReport,
} from "./skill-anti-rationalization.js";

export {
  detectRationalization,
  verifySelfJustification,
  logAntiRationalization,
  getAntiRationalizationReport,
  clearAntiRationalizationLogs,
  generateMarkdownReport,
  getAntiRationalizationTable,
};

export type {
  AntiRationalizationDetection,
  AntiRationalizationLog,
  AntiRationalizationReport,
};

/**
 * 检测技能描述中的合理化行为
 * 
 * 在审计流程中检测 Agent 是否使用了合理化借口（如"改动小"、"跳过测试"等）
 */
export function auditSkillRationalization(
  skillName: string,
  skillBody: string,
  agentResponse?: string
): {
  detection: AntiRationalizationDetection;
  verification?: { approved: boolean; reason: string };
} {
  const detection = detectRationalization(skillBody, skillName);
  
  if (!detection.detected) {
    return { detection };
  }
  
  // 如果提供了 Agent 响应，验证其自证是否充分
  if (agentResponse) {
    const verification = verifySelfJustification(detection, agentResponse);
    return { detection, verification };
  }
  
  return { detection };
}

/**
 * 在审计报告中包含反合理化审计结果
 */
export function runAuditWithRationalizationCheck(
  config: AuditConfig,
  agentResponses?: Map<string, string>
): AuditReport {
  // 执行常规审计
  const report = runAudit(config);
  
  // 对每个技能进行反合理化检查
  const skills = discoverSkills(config);
  
  for (const skill of skills) {
    const body = fs.readFileSync(skill.filePath, "utf8");
    const agentResponse = agentResponses?.get(skill.name);
    
    const { detection, verification } = auditSkillRationalization(
      skill.name,
      body,
      agentResponse
    );
    
    if (detection.detected) {
      // 记录到审计日志
      logAntiRationalization(
        skill.name,
        detection,
        agentResponse ?? "",
        verification?.approved ?? false ? 'approved' : 'rejected',
        verification?.reason ?? "未提供 Agent 自证"
      );
    }
  }
  
  return report;
}

/**
 * 获取反合理化审计报告（供 API 端点使用）
 */
export function getRationalizationAuditReport(): AntiRationalizationReport {
  return getAntiRationalizationReport();
}

/**
 * 生成反合理化 Markdown 报告（供 API 端点使用）
 */
export function getRationalizationMarkdownReport(): string {
  return generateMarkdownReport();
}
