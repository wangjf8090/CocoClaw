/**
 * Skill Optimize - 技能描述优化模块
 * 移植自 skill-cleaner 的描述精简引擎
 *
 * 核心理念：Skill 要像路标，不该把整本说明挂在路标上
 * 实证效果：90词描述 → 40词以内，Agent 选对率飙升
 */

import type { Skill } from "./skill-audit.js";
import { suggestDescription } from "./skill-audit.js";

// ============================================================================
// Types
// ============================================================================

export interface OptimizationResult {
  skillName: string;
  original: string;
  suggested: string;
  originalChars: number;
  suggestedChars: number;
  savedChars: number;
  savedTokensEstimate: number;
  /** 变更类型 */
  changeType: "compress" | "restructure" | "noop";
}

export interface OptimizationReport {
  generated: string;
  totalSkills: number;
  optimizableSkills: number;
  totalSavedChars: number;
  totalSavedTokensEstimate: number;
  results: OptimizationResult[];
}

// ============================================================================
// Optimization Rules
// ============================================================================

/** 冗余模式 → 精简替换 */
const REDUNDANCY_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  // "This skill allows you to" → 直接说做什么
  { pattern: /this skill (?:allows|enables|helps) (?:you )?to /gi, replacement: "" },
  // "Use this when" → 条件简写
  { pattern: /use this (?:skill|tool) when /gi, replacement: "when " },
  // "It can also" → 删除过渡词
  { pattern: /it can also /gi, replacement: "" },
  // "provides the ability to" → 直接动词
  { pattern: /provides (?:the ability|capabilities) to /gi, replacement: "" },
  // "automatically" → 通常冗余
  { pattern: /automatically /gi, replacement: "" },
  // "comprehensive" → 冗余形容词
  { pattern: /comprehensive /gi, replacement: "" },
  // "powerful" → 冗余形容词
  { pattern: /powerful /gi, replacement: "" },
  // "seamlessly" → 冗余副词
  { pattern: /seamlessly /gi, replacement: "" },
  // "intelligent" → 冗余
  { pattern: /intelligent /gi, replacement: "" },
  // "advanced" → 冗余
  { pattern: /advanced /gi, replacement: "" },
  // "robust" → 冗余
  { pattern: /robust /gi, replacement: "" },
  // "efficient" → 冗余
  { pattern: /efficient /gi, replacement: "" },
  // "including but not limited to" → 太长
  { pattern: /including but not limited to /gi, replacement: "incl. " },
  // "in order to" → 简写
  { pattern: /in order to /gi, replacement: "to " },
  // "as well as" → 简写
  { pattern: /as well as /gi, replacement: "& " },
  // 末尾句号 → 描述不需要
  { pattern: /\.$/, replacement: "" },
];

/** 估算 token 节省量 */
function estimateTokensSaved(chars: number): number {
  return Math.ceil(chars / 4);
}

/** 应用冗余精简规则 */
function applyRedundancyRules(description: string): string {
  let result = description;
  for (const { pattern, replacement } of REDUNDANCY_RULES) {
    result = result.replace(pattern, replacement);
  }
  // 清理多余空格
  return result.replace(/\s+/g, " ").trim();
}

/** 压缩描述到目标字符数内 */
function compressDescription(description: string, targetChars: number): string {
  if ([...description].length <= targetChars) return description;

  // Step 1: 应用冗余规则
  let compressed = applyRedundancyRules(description);
  if ([...compressed].length <= targetChars) return compressed;

  // Step 2: 保留核心动词短语（参考 suggestDescription）
  const suggested = suggestDescription({
    name: "",
    baseName: "",
    description,
    filePath: "",
    dir: "",
    root: "",
    scope: "",
    enabled: true,
    descChars: [...description].length,
    lineChars: 0,
    lineBytes: 0,
    bodyHash: "",
    bodyKey: "",
    descKey: "",
  });

  if ([...suggested].length <= targetChars) return suggested;

  // Step 3: 截断 + 省略号
  return [...compressed].slice(0, targetChars - 2).join("") + "…";
}

// ============================================================================
// Public API
// ============================================================================

/** 优化单个技能描述 */
export function optimizeSkill(
  skill: Skill,
  targetChars: number = 40
): OptimizationResult {
  const original = skill.description;
  const originalChars = [...original].length;

  if (originalChars <= targetChars) {
    return {
      skillName: skill.name,
      original,
      suggested: original,
      originalChars,
      suggestedChars: originalChars,
      savedChars: 0,
      savedTokensEstimate: 0,
      changeType: "noop",
    };
  }

  // 优先使用场景关键词建议
  const suggested = suggestDescription(skill);
  const suggestedChars = [...suggested].length;

  // 如果建议仍然太长，进一步压缩
  const finalSuggested =
    suggestedChars > targetChars
      ? compressDescription(original, targetChars)
      : suggested;

  const finalChars = [...finalSuggested].length;
  const savedChars = originalChars - finalChars;

  const changeType =
    finalSuggested === original
      ? "noop"
      : finalSuggested.split(" ").length < original.split(" ").length / 2
        ? "restructure"
        : "compress";

  return {
    skillName: skill.name,
    original,
    suggested: finalSuggested,
    originalChars,
    suggestedChars: finalChars,
    savedChars,
    savedTokensEstimate: estimateTokensSaved(savedChars),
    changeType,
  };
}

/** 批量优化所有技能 */
export function optimizeAllSkills(
  skills: Skill[],
  targetChars: number = 40
): OptimizationReport {
  const results = skills.map((s) => optimizeSkill(s, targetChars));
  const optimizable = results.filter((r) => r.changeType !== "noop");

  return {
    generated: new Date().toISOString(),
    totalSkills: skills.length,
    optimizableSkills: optimizable.length,
    totalSavedChars: optimizable.reduce((sum, r) => sum + r.savedChars, 0),
    totalSavedTokensEstimate: optimizable.reduce(
      (sum, r) => sum + r.savedTokensEstimate,
      0
    ),
    results,
  };
}
