/**
 * Skill Audit - 技能审计模块
 * 移植自 steipete/agent-scripts skill-cleaner，适配 SelfClaw Docker 架构
 *
 * 核心能力：
 * 1. Token 预算审计 — 计算技能描述占用上下文的比例
 * 2. 重复技能检测 — Jaccard 相似度 + body hash 去重
 * 3. 根目录审计 — 扫描技能来源和启用状态
 */

import fs from "node:fs";
import path from "node:path";

// ============================================================================
// Types
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
}

// ============================================================================
// Config
// ============================================================================

export interface AuditConfig {
  /** 模型上下文窗口大小，默认 272000 (GPT-5.5) */
  contextTokens?: number;
  /** 技能预算占上下文的百分比，默认 2 */
  budgetPercent?: number;
  /** 每字符 token 数，默认 4 (Codex 计费规则: ceil(utf8_bytes / 4)) */
  charsPerToken?: number;
  /** 技能根目录列表 */
  skillRoots: string[];
  /** 描述长度阈值，超过此值视为"过长"，默认 110 */
  longDescThreshold?: number;
}

const DEFAULT_CONFIG: Required<Omit<AuditConfig, "skillRoots">> = {
  contextTokens: 272_000,
  budgetPercent: 2,
  charsPerToken: 4,
  longDescThreshold: 110,
};

// ============================================================================
// Core Functions
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

/** 文本归一化：小写 + 去标点 + 压缩空格 */
function normalizeWords(input: string): string {
  return input
    .toLowerCase()
    .replace(/[`"'().,;:!?/\\[\]{}_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 构建词集合 */
function wordSet(input: string): Set<string> {
  return new Set(normalizeWords(input).split(" ").filter((w) => w.length >= 2));
}

/** Jaccard 相似度 */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

/** 单行文本清洗 */
function sanitizeSingleLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

/** YAML 标量解析 */
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

/** 解析 SKILL.md frontmatter */
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

/** 递归查找文件 */
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

/** 技能作用域判断 */
function skillRootScope(root: string): string {
  const normalized = root.split(path.sep).join("/");
  if (normalized.includes("/packages/skills/")) return "selfclaw-skills";
  if (normalized.includes("/.codex/skills/")) return "codex";
  if (normalized.includes("/.codex/plugins/cache")) return "codex-plugin";
  if (normalized.includes("/.agents/skills/")) return "repo";
  return "extra";
}

/** 技能渲染行：模拟 Agent 看到的格式 */
function renderSkillLine(skill: Skill, description: string): string {
  return description
    ? `- ${skill.name}: ${description} (file: ${skill.filePath})`
    : `- ${skill.name}: (file: ${skill.filePath})`;
}

/** 技能行 token 成本 */
function lineTokenCost(skill: Skill, description?: string): number {
  const line = renderSkillLine(skill, description ?? skill.description);
  return tokenCost(`${line}\n`);
}

/** 最小 token 成本（无描述） */
function minimumLineTokenCost(skill: Skill): number {
  return lineTokenCost(skill, "");
}

/** 完整 token 成本 */
function fullLineTokenCost(skill: Skill): number {
  return lineTokenCost(skill);
}

/**
 * Codex 预算分配算法
 * 模拟 Codex render.rs 的技能描述截断逻辑
 */
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
  // 按优先级排序: selfclaw-skills > codex > plugin > extra
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

  // Case 1: 全部装得下
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

  // Case 2: 最小行装得下，需要截断描述
  if (minimumTokens <= budgetTokens) {
    const remainingByIndex = ordered.map((s) => [...s.description].length);
    const allocatedByIndex = ordered.map(() => 0);
    let remaining = budgetTokens - minimumTokens;

    // 贪心分配描述字符
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

    // 计算实际使用的预算
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

  // Case 3: 连最小行都装不下，需要省略技能
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
// Description Suggestion Engine (场景关键词词库)
// ============================================================================

/** 场景关键词映射 — 移植自 skill-cleaner 的 suggestDescription */
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

/** 动作词映射 */
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

/** 生成精简描述建议 */
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
// Discovery & Audit
// ============================================================================

/** 从根目录发现所有技能 */
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

      // 去重（符号链接/重复路径）
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
        enabled: true, // SelfClaw 暂无禁用机制
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

/** 计算 Token 预算 */
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

/** 检测重复技能 */
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

  // 按名称分组（同名 > 1）
  const byName: DuplicateGroup[] = [];
  for (const [name, list] of byBaseName) {
    if (list.length <= 1) continue;

    // 选择保留优先级最高的
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

  // 按 body hash 分组
  const byBodyHash = new Map<string, Skill[]>();
  for (const skill of enabled) {
    if (skill.bodyHash === "811c9dc5") continue; // 空 body
    if (!byBodyHash.has(skill.bodyHash)) byBodyHash.set(skill.bodyHash, []);
    byBodyHash.get(skill.bodyHash)!.push(skill);
  }

  const byHash = [...byBodyHash.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([hash, skills]) => ({ hash, skills }));

  return { byName, byHash };
}

/** 生成完整审计报告 */
export function runAudit(config: AuditConfig): AuditReport {
  const skills = discoverSkills(config);
  const enabled = skills.filter((s) => s.enabled);
  const budget = computeBudget(enabled, config);
  const { byName, byHash } = detectDuplicates(skills);

  // 描述过长候选
  const longDescThreshold = config.longDescThreshold ?? DEFAULT_CONFIG.longDescThreshold;
  const descriptionCandidates = enabled
    .filter((s) => s.descChars >= longDescThreshold)
    .sort((a, b) => b.descChars - a.descChars)
    .slice(0, 30)
    .map((skill) => ({
      skill,
      suggested: suggestDescription(skill),
    }));

  // 根目录汇总
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

  return {
    generated: new Date().toISOString(),
    totalSkills: skills.length,
    enabledSkills: enabled.length,
    budget,
    descriptionCandidates,
    duplicatesByName: byName,
    duplicatesByHash: byHash,
    rootSummary,
  };
}
