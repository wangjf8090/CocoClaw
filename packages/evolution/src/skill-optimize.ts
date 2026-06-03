/**
 * Skill Optimize - 技能优化模块 v2.1
 * 
 * v2.0: 移植自 skill-cleaner 的描述精简引擎
 *       90词描述 → 40词以内，Agent选对率飙升
 * 
 * v2.1: 基于SkillOpt(arXiv:2605.23904)的文本空间优化增强
 *       - 文本学习率（Textual Learning Rate）: 每次最多lr个add/delete/replace操作
 *       - 被拒绝编辑缓冲区（Rejected-Edit Buffer）: 失败提案作为负反馈
 *       - 验证门控（Validation Gate）: held-out验证集严格提升才接受
 *       - 经历池成败比例配置
 */

import type { Skill } from "./skill-audit.js";
import { suggestDescription } from "./skill-audit.js";

// ============================================================================
// v2.0 Types (保留)
// ============================================================================

export interface OptimizationResult {
  skillName: string;
  original: string;
  suggested: string;
  originalChars: number;
  suggestedChars: number;
  savedChars: number;
  savedTokensEstimate: number;
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
// v2.1 新增类型
// ============================================================================

/**
 * 文本空间编辑操作
 * 
 * 来源: arXiv:2605.23904 (SkillOpt)
 * 模仿深度学习的参数更新，但作用于技能文档的文本空间
 */
export interface TextEdit {
  type: 'add' | 'delete' | 'replace';
  target: string;         // 目标位置描述
  content: string;        // 添加/替换的内容（delete时为空）
  reason: string;         // 编辑原因
  source: 'reflection' | 'slow_update' | 'meta_skill';
}

/**
 * 验证门控结果
 * 
 * 来源: arXiv:2605.23904
 * 候选编辑必须在held-out验证集上严格提升才被接受
 */
export interface GateResult {
  accepted: boolean;
  currentScore: number;
  candidateScore: number;
  delta: number;
  rejectionReason?: string;
}

/**
 * v2.1 优化配置
 */
export interface OptimizeConfigV2 {
  /** 文本学习率: 每步最多编辑操作数, 默认4 (SkillOpt论文验证) */
  textualLearningRate?: number;
  /** 是否启用验证门控, 默认true */
  enableGate?: boolean;
  /** 验证集任务数, 默认10 */
  heldOutTaskCount?: number;
  /** 门控指标: hard(精确匹配) / soft(部分分) / mixed, 默认hard */
  gateMetric?: 'hard' | 'soft' | 'mixed';
  /** 经历池成功占比, 默认0.75 (75%成功,25%失败) */
  experienceSuccessRatio?: number;
  /** 是否自适应调整经历池比例, 默认true */
  adaptiveExperienceRatio?: boolean;
}

const DEFAULT_OPTIMIZE_V2: Required<OptimizeConfigV2> = {
  textualLearningRate: 4,
  enableGate: true,
  heldOutTaskCount: 10,
  gateMetric: 'hard',
  experienceSuccessRatio: 0.75,
  adaptiveExperienceRatio: true,
};

/**
 * 被拒绝编辑缓冲区
 * 
 * 来源: arXiv:2605.23904
 * 失败的编辑提案不丢弃，作为后续反射的负反馈
 * 消融实验: 去掉缓冲区后SpreadsheetBench从77.5%降到72.9%
 */
export class RejectedEditBuffer {
  private buffer: Array<{ edit: TextEdit; rejectionReason: string; timestamp: string }> = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /** 添加被拒绝的编辑提案 */
  add(edit: TextEdit, reason: string): void {
    this.buffer.push({
      edit,
      rejectionReason: reason,
      timestamp: new Date().toISOString(),
    });
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  /** 获取所有被拒绝的编辑（供反射阶段参考） */
  getAll(): Array<{ edit: TextEdit; rejectionReason: string; timestamp: string }> {
    return [...this.buffer];
  }

  /** 检查类似的编辑是否之前被拒绝过 */
  wasRejectedBefore(target: string, type: TextEdit['type']): boolean {
    return this.buffer.some(
      (entry) => entry.edit.target === target && entry.edit.type === type
    );
  }

  /** 清空缓冲区 */
  clear(): void {
    this.buffer = [];
  }

  get size(): number {
    return this.buffer.length;
  }
}

// 全局被拒绝编辑缓冲区
const rejectedEditBuffer = new RejectedEditBuffer();

// ============================================================================
// v2.0 Optimization Rules (保留)
// ============================================================================

const REDUNDANCY_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /this skill (?:allows|enables|helps) (?:you )?to /gi, replacement: "" },
  { pattern: /use this (?:skill|tool) when /gi, replacement: "when " },
  { pattern: /it can also /gi, replacement: "" },
  { pattern: /provides (?:the ability|capabilities) to /gi, replacement: "" },
  { pattern: /automatically /gi, replacement: "" },
  { pattern: /comprehensive /gi, replacement: "" },
  { pattern: /powerful /gi, replacement: "" },
  { pattern: /seamlessly /gi, replacement: "" },
  { pattern: /intelligent /gi, replacement: "" },
  { pattern: /advanced /gi, replacement: "" },
  { pattern: /robust /gi, replacement: "" },
  { pattern: /efficient /gi, replacement: "" },
  { pattern: /including but not limited to /gi, replacement: "incl. " },
  { pattern: /in order to /gi, replacement: "to " },
  { pattern: /as well as /gi, replacement: "& " },
  { pattern: /\.$/, replacement: "" },
];

function estimateTokensSaved(chars: number): number {
  return Math.ceil(chars / 4);
}

function applyRedundancyRules(description: string): string {
  let result = description;
  for (const { pattern, replacement } of REDUNDANCY_RULES) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s+/g, " ").trim();
}

function compressDescription(description: string, targetChars: number): string {
  if ([...description].length <= targetChars) return description;

  let compressed = applyRedundancyRules(description);
  if ([...compressed].length <= targetChars) return compressed;

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

  return [...compressed].slice(0, targetChars - 2).join("") + "…";
}

// ============================================================================
// v2.0 Public API (保留)
// ============================================================================

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

  const suggested = suggestDescription(skill);
  const suggestedChars = [...suggested].length;

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

// ============================================================================
// v2.1 新增: 文本空间优化器
// ============================================================================

/**
 * 应用有界编辑到技能文档
 * 
 * 核心机制：文本学习率约束每次最多lr个编辑操作
 * 来源: arXiv:2605.23904
 * 消融实验: 去掉学习率约束后SearchQA 87.1%→84.6%
 */
export function applyBoundedEdits(
  skillContent: string,
  edits: TextEdit[],
  config: OptimizeConfigV2 = {}
): { newContent: string; appliedEdits: TextEdit[]; skippedEdits: TextEdit[] } {
  const cfg = { ...DEFAULT_OPTIMIZE_V2, ...config };
  const lr = cfg.textualLearningRate;

  // 按优先级排序: replace > add > delete
  const priorityOrder: Record<TextEdit['type'], number> = { replace: 0, add: 1, delete: 2 };
  const sorted = [...edits].sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type]);

  const appliedEdits: TextEdit[] = [];
  const skippedEdits: TextEdit[] = [];
  let content = skillContent;

  for (const edit of sorted) {
    if (appliedEdits.length >= lr) {
      // 超过学习率限制，跳过
      skippedEdits.push(edit);
      continue;
    }

    // 检查被拒绝缓冲区中是否有类似编辑
    if (rejectedEditBuffer.wasRejectedBefore(edit.target, edit.type)) {
      skippedEdits.push(edit);
      continue;
    }

    // 应用编辑
    switch (edit.type) {
      case 'add':
        content = applyAddEdit(content, edit);
        break;
      case 'delete':
        content = applyDeleteEdit(content, edit);
        break;
      case 'replace':
        content = applyReplaceEdit(content, edit);
        break;
    }

    appliedEdits.push(edit);
  }

  return { newContent: content, appliedEdits, skippedEdits };
}

/**
 * 验证门控
 * 
 * 来源: arXiv:2605.23904
 * 候选技能必须在验证集上严格提升才被接受
 * 最佳运行全程只接受1-4次编辑
 */
export function validateGate(
  currentScore: number,
  candidateScore: number,
  config: OptimizeConfigV2 = {}
): GateResult {
  const cfg = { ...DEFAULT_OPTIMIZE_V2, ...config };
  const delta = candidateScore - currentScore;

  let accepted: boolean;
  let rejectionReason: string | undefined;

  switch (cfg.gateMetric) {
    case 'hard':
      // 精确匹配准确率：必须严格提升
      accepted = delta > 0;
      if (!accepted && delta === 0) {
        rejectionReason = 'Tie rejected: candidate does not strictly improve over current';
      } else if (!accepted) {
        rejectionReason = `Performance regression: ${delta.toFixed(1)}pp`;
      }
      break;
    case 'soft':
      // 部分分评分：允许小幅提升即可
      accepted = delta >= 0.5;
      if (!accepted) {
        rejectionReason = `Insufficient improvement: ${delta.toFixed(2)}pp < 0.5pp threshold`;
      }
      break;
    case 'mixed':
      // 混合评分
      accepted = delta > 0;
      if (!accepted) {
        rejectionReason = `Mixed metric regression: ${delta.toFixed(1)}pp`;
      }
      break;
  }

  return { accepted, currentScore, candidateScore, delta, rejectionReason };
}

/**
 * 完整的优化循环 (Rollout → Reflect → Edit → Gate)
 * 
 * 来源: arXiv:2605.23904 (SkillOpt)
 * 
 * 这是SkillOpt核心循环的TypeScript移植版:
 * 1. Rollout: 用当前技能执行任务，记录轨迹
 * 2. Reflect: 分析成功/失败轨迹，提取差异
 * 3. Edit: 生成有界编辑操作
 * 4. Gate: 验证门控决定是否接受
 */
export async function runOptimizationCycle(
  currentSkillContent: string,
  edits: TextEdit[],
  evaluateFn: (content: string) => Promise<number>,
  config: OptimizeConfigV2 = {}
): Promise<{
  newContent: string;
  appliedEdits: TextEdit[];
  gateResult: GateResult;
  cycleComplete: boolean;
}> {
  const cfg = { ...DEFAULT_OPTIMIZE_V2, ...config };

  // Step 1 & 2: Rollout + Reflect (由外部提供edits)
  // Step 3: Apply bounded edits
  const { newContent, appliedEdits, skippedEdits } = applyBoundedEdits(
    currentSkillContent,
    edits,
    cfg
  );

  if (appliedEdits.length === 0) {
    return {
      newContent: currentSkillContent,
      appliedEdits: [],
      gateResult: { accepted: false, currentScore: 0, candidateScore: 0, delta: 0, rejectionReason: 'No edits applied' },
      cycleComplete: false,
    };
  }

  // Step 4: Gate - evaluate candidate
  if (cfg.enableGate && evaluateFn) {
    const [currentScore, candidateScore] = await Promise.all([
      evaluateFn(currentSkillContent),
      evaluateFn(newContent),
    ]);

    const gateResult = validateGate(currentScore, candidateScore, cfg);

    if (!gateResult.accepted) {
      // 编辑被拒绝，加入缓冲区
      for (const edit of appliedEdits) {
        rejectedEditBuffer.add(edit, gateResult.rejectionReason ?? 'Gate rejected');
      }
      return {
        newContent: currentSkillContent,  // 回滚
        appliedEdits: [],
        gateResult,
        cycleComplete: true,
      };
    }
  }

  return {
    newContent,
    appliedEdits,
    gateResult: { accepted: true, currentScore: 0, candidateScore: 0, delta: 0 },
    cycleComplete: true,
  };
}

/**
 * 获取被拒绝编辑缓冲区（供API端点使用）
 */
export function getRejectedEditBuffer(): RejectedEditBuffer {
  return rejectedEditBuffer;
}

// ============================================================================
// 编辑操作的辅助函数
// ============================================================================

function applyAddEdit(content: string, edit: TextEdit): string {
  // 在target描述的位置之后添加内容
  const lines = content.split('\n');
  const targetIndex = lines.findIndex((line) =>
    line.toLowerCase().includes(edit.target.toLowerCase())
  );

  if (targetIndex >= 0) {
    const newLines = edit.content.split('\n');
    lines.splice(targetIndex + 1, 0, ...newLines);
    return lines.join('\n');
  }

  // 找不到目标位置，追加到末尾
  return content + '\n' + edit.content;
}

function applyDeleteEdit(content: string, edit: TextEdit): string {
  const lines = content.split('\n');
  const filtered = lines.filter((line) =>
    !line.toLowerCase().includes(edit.target.toLowerCase())
  );
  return filtered.join('\n');
}

function applyReplaceEdit(content: string, edit: TextEdit): string {
  const lines = content.split('\n');
  const result = lines.map((line) => {
    if (line.toLowerCase().includes(edit.target.toLowerCase())) {
      return edit.content;
    }
    return line;
  });
  return result.join('\n');
}
