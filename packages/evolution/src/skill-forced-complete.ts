/**
 * 强制完整输出（Forced Complete Output）模块 v3.6.1
 * 
 * 来源：Leonxlnx/taste-skill（强制完整输出技能解决 LLM 中途截断）
 * 
 * 核心机制：
 * - 技能层提供「Continue 续写」机制
 * - 「输出完整性自检」启发式
 * - 解决 LLM 长输出中途截断的老大难
 */

// ============================================================================
// Types
// ============================================================================

/**
 * 完整性检查启发式类型
 */
export type HeuristicType = 
  | 'sentence_ending'     // 句末标点检查
  | 'code_block_closure'  // 代码块闭合检查
  | 'markdown_balance'     // Markdown 平衡检查
  | 'json_brace_balance'; // JSON 大括号平衡

/**
 * 完整性检查结果
 */
export interface CompletenessCheck {
  /** 是否完整 */
  isComplete: boolean;
  /** 检测到的问题列表 */
  issues: CompletenessIssue[];
  /** 完整性分数 (0-100) */
  score: number;
  /** 建议的操作 */
  suggestedAction: 'continue' | 'retry' | 'accept' | 'reject';
}

/**
 * 完整性问题
 */
export interface CompletenessIssue {
  /** 问题类型 */
  type: HeuristicType;
  /** 问题描述 */
  description: string;
  /** 上下文（问题附近的文本） */
  context: string;
  /** 严重程度 */
  severity: 'critical' | 'warning' | 'info';
}

/**
 * 续写结果
 */
export interface ContinueResult {
  /** 原始内容 */
  originalContent: string;
  /** 续写内容 */
  continuedContent: string;
  /** 合并后的完整内容 */
  fullContent: string;
  /** 是否成功续写 */
  success: boolean;
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * 强制完整输出配置
 */
export interface ForcedCompleteConfig {
  /** 是否启用句末标点检查 */
  enableSentenceEnding?: boolean;
  /** 是否启用代码块闭合检查 */
  enableCodeBlockClosure?: boolean;
  /** 是否启用 Markdown 平衡检查 */
  enableMarkdownBalance?: boolean;
  /** 是否启用 JSON 大括号平衡检查 */
  enableJsonBraceBalance?: boolean;
  /** 最大续写次数 */
  maxContinueAttempts?: number;
  /** 最小完整性分数阈值 */
  minCompletenessScore?: number;
}

const DEFAULT_CONFIG: Required<ForcedCompleteConfig> = {
  enableSentenceEnding: true,
  enableCodeBlockClosure: true,
  enableMarkdownBalance: true,
  enableJsonBraceBalance: true,
  maxContinueAttempts: 3,
  minCompletenessScore: 80,
};

// ============================================================================
// 启发式检查函数
// ============================================================================

/**
 * 句末标点检查
 * 
 * 检查输出是否以完整的句子结束（而非中途截断）
 */
export function checkSentenceEnding(text: string): CompletenessIssue | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const lastChar = trimmed[trimmed.length - 1];

  // 如果以标点符号结尾，认为是完整的
  const properEndings = ['。', '！', '？', '.', '!', '?', ':', '】', ')', ']', '}'];
  
  if (properEndings.includes(lastChar)) {
    return null; // 正常的句子结尾
  }

  // 常见截断模式检测
  const truncationPatterns = [
    // 中文截断 - 以汉字结尾
    /[\u4e00-\u9fa5]{2}$/,
    // 英文截断 - 以单词结尾
    /\w{3,}$/,
    // 列表项截断
    /\n\s*[-*]\s+\w+$/,
    // 逗号/顿号结尾
    /[,，、]$/,
  ];

  // 检查是否是截断模式
  for (const pattern of truncationPatterns) {
    if (pattern.test(trimmed)) {
      return {
        type: 'sentence_ending',
        description: `输出以不完整的句子结尾，可能被截断。当前结尾: "${lastChar}"`,
        context: trimmed.slice(-50),
        severity: 'critical',
      };
    }
  }

  return null;
}

/**
 * 代码块闭合检查
 * 
 * 检查 Markdown 代码块是否正确闭合
 */
export function checkCodeBlockClosure(text: string): CompletenessIssue[] {
  const issues: CompletenessIssue[] = [];
  
  // 计算 ``` 出现次数
  const codeBlockRegex = /```(\w*)/g;
  const matches = Array.from(text.matchAll(codeBlockRegex));
  
  let openCount = 0;
  let closeCount = 0;
  
  for (const match of matches) {
    const fullMatch = match[0];
    if (fullMatch.startsWith('```') && !fullMatch.includes('```', 3)) {
      openCount++;
    }
  }
  
  // 统计结束标记
  const closeRegex = /```\s*$/gm;
  const closeMatches = text.match(closeRegex);
  closeCount = closeMatches ? closeMatches.length : 0;
  
  if (openCount > closeCount) {
    const openBackticks = '```'.repeat(Math.min(openCount - closeCount, 3));
    issues.push({
      type: 'code_block_closure',
      description: `代码块未正确闭合。缺少 ${openCount - closeCount} 个结束标记`,
      context: `建议在末尾添加: ${openBackticks}`,
      severity: 'critical',
    });
  }
  
  return issues;
}

/**
 * Markdown 平衡检查
 * 
 * 检查 Markdown 语法元素是否平衡
 */
export function checkMarkdownBalance(text: string): CompletenessIssue[] {
  const issues: CompletenessIssue[] = [];
  
  // 检查链接平衡
  const linkOpen = (text.match(/\[([^\]]+)\]\(([^)]+)$/gm) || []).length;
  
  if (linkOpen > 0) {
    issues.push({
      type: 'markdown_balance',
      description: `存在 ${linkOpen} 个未闭合的链接`,
      context: '链接语法应为 [text](url)，检查是否有未闭合的 )',
      severity: 'warning',
    });
  }
  
  // 检查列表是否完整
  const lines = text.split('\n');
  const lastLine = lines[lines.length - 1].trim();
  if (lastLine.startsWith('- ') || lastLine.startsWith('* ')) {
    issues.push({
      type: 'markdown_balance',
      description: '输出以列表项结尾，可能被截断',
      context: lastLine,
      severity: 'info',
    });
  }
  
  return issues;
}

/**
 * JSON 大括号平衡检查
 * 
 * 检查 JSON 格式是否平衡
 */
export function checkJsonBraceBalance(text: string): CompletenessIssue[] {
  const issues: CompletenessIssue[] = [];
  
  // 检测文本中是否包含 JSON
  const jsonPattern = /\{[\s\S]*$/;
  const potentialJson = text.match(jsonPattern);
  
  if (!potentialJson) return issues;
  
  const jsonContent = potentialJson[0];
  
  let braceCount = 0;
  let bracketCount = 0;
  
  for (const char of jsonContent) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
  }
  
  if (braceCount > 0) {
    issues.push({
      type: 'json_brace_balance',
      description: `JSON 对象缺少 ${braceCount} 个右大括号 }`,
      context: jsonContent.slice(-100),
      severity: 'critical',
    });
  }
  
  if (bracketCount > 0) {
    issues.push({
      type: 'json_brace_balance',
      description: `JSON 数组缺少 ${bracketCount} 个右方括号 ]`,
      context: jsonContent.slice(-100),
      severity: 'critical',
    });
  }
  
  return issues;
}

// ============================================================================
// 完整性检查主函数
// ============================================================================

/**
 * 执行完整性检查
 * 
 * 对输出内容执行多种启发式检查，判断是否完整
 */
export function checkCompleteness(
  text: string,
  config: ForcedCompleteConfig = {}
): CompletenessCheck {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const issues: CompletenessIssue[] = [];
  
  // 执行各项检查
  if (cfg.enableSentenceEnding) {
    const sentenceIssue = checkSentenceEnding(text);
    if (sentenceIssue) issues.push(sentenceIssue);
  }
  
  if (cfg.enableCodeBlockClosure) {
    issues.push(...checkCodeBlockClosure(text));
  }
  
  if (cfg.enableMarkdownBalance) {
    issues.push(...checkMarkdownBalance(text));
  }
  
  if (cfg.enableJsonBraceBalance) {
    issues.push(...checkJsonBraceBalance(text));
  }
  
  // 计算完整性分数
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;
  
  // 扣分规则
  const score = Math.max(0, 100 - criticalCount * 30 - warningCount * 10 - infoCount * 5);
  
  // 判断是否完整
  const isComplete = score >= cfg.minCompletenessScore;
  
  // 确定建议操作
  let suggestedAction: 'continue' | 'retry' | 'accept' | 'reject';
  if (criticalCount > 0) {
    suggestedAction = 'continue';
  } else if (warningCount > 0) {
    suggestedAction = 'retry';
  } else if (isComplete) {
    suggestedAction = 'accept';
  } else {
    suggestedAction = 'reject';
  }
  
  return {
    isComplete,
    issues,
    score,
    suggestedAction,
  };
}

// ============================================================================
// 续写机制
// ============================================================================

/**
 * 生成续写提示词
 * 
 * 根据检测到的问题，生成引导 LLM 继续输出的提示词
 */
export function generateContinuePrompt(
  originalText: string,
  issues: CompletenessIssue[]
): string {
  const contextLines = originalText.split('\n').slice(-10).join('\n');
  
  const instructions: string[] = [
    '请继续之前的输出，不要重复已写内容。',
  ];
  
  // 根据问题类型添加特定指令
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  
  if (criticalIssues.some(i => i.type === 'sentence_ending')) {
    instructions.push('确保以完整的句子结束，不要在句子中间截断。');
  }
  
  if (criticalIssues.some(i => i.type === 'code_block_closure')) {
    instructions.push('确保代码块正确闭合，添加必要的 ``` 结束标记。');
  }
  
  if (criticalIssues.some(i => i.type === 'json_brace_balance')) {
    instructions.push('确保 JSON 格式正确，闭合所有 { [ " 等标记。');
  }
  
  instructions.push('\n未完成的内容参考：');
  instructions.push('```');
  instructions.push(contextLines);
  instructions.push('```');
  
  return instructions.join('\n');
}

/**
 * 执行续写（需要外部 LLM 调用）
 * 
 * 这是一个同步包装器，实际续写需要由调用方使用 LLM API
 */
export function mergeContinuation(
  originalContent: string,
  continueContent: string
): ContinueResult {
  // 尝试找到合适的断点
  const lastParagraphBreak = Math.max(
    originalContent.lastIndexOf('\n\n'),
    originalContent.lastIndexOf('\n')
  );
  
  let mergePoint = originalContent.length;
  
  // 尝试找到自然断点
  if (lastParagraphBreak > originalContent.length * 0.5) {
    mergePoint = lastParagraphBreak + 1;
  }
  
  // 检查是否有重复内容
  const potentialDuplicate = continueContent.match(/^[\s\S]{1,100}/)?.[0];
  let finalContent: string;
  
  if (potentialDuplicate) {
    const duplicateIndex = originalContent.indexOf(potentialDuplicate.trim());
    if (duplicateIndex >= 0 && duplicateIndex < mergePoint - potentialDuplicate.length) {
      const skipLength = potentialDuplicate.trim().length;
      finalContent = originalContent + '\n' + continueContent.slice(skipLength);
    } else {
      finalContent = originalContent + '\n' + continueContent;
    }
  } else {
    finalContent = originalContent + '\n' + continueContent;
  }
  
  return {
    originalContent,
    continuedContent: continueContent,
    fullContent: finalContent,
    success: true,
  };
}

/**
 * 强制完整输出循环
 * 
 * 反复检查完整性并在必要时触发续写
 */
export async function forcedCompleteLoop(
  initialContent: string,
  continueFn: (prompt: string) => Promise<string>,
  config: ForcedCompleteConfig = {}
): Promise<{
  content: string;
  iterations: number;
  finalCheck: CompletenessCheck;
}> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  let content = initialContent;
  let iterations = 0;
  
  while (iterations < cfg.maxContinueAttempts) {
    const check = checkCompleteness(content, cfg);
    
    if (check.isComplete) {
      return { content, iterations, finalCheck: check };
    }
    
    const prompt = generateContinuePrompt(content, check.issues);
    const continuedContent = await continueFn(prompt);
    const mergeResult = mergeContinuation(content, continuedContent);
    content = mergeResult.fullContent;
    
    iterations++;
  }
  
  const finalCheck = checkCompleteness(content, cfg);
  return { content, iterations, finalCheck };
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 快速检查文本是否可能被截断
 */
export function quickTruncationCheck(text: string): boolean {
  if (!text) return false;
  
  const trimmed = text.trim();
  if (!trimmed) return false;
  
  const lastChar = trimmed[trimmed.length - 1];
  
  // 可能的截断信号
  const truncationSignals = [
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'that', 'this', 'which', 'what', 'who', 'how', 'and', 'but',
  ];
  
  const endsWithWord = /[a-zA-Z]{3,}$/.test(trimmed);
  const lowerText = trimmed.toLowerCase();
  const endsWithSignal = truncationSignals.some(signal => 
    lowerText.endsWith(signal)
  );
  
  return endsWithWord || endsWithSignal;
}

/**
 * 修复常见的截断问题
 */
export function autoFixTruncation(text: string): string {
  let fixed = text;
  
  // 移除可能的截断前缀
  if (fixed.startsWith('...') || fixed.startsWith('..')) {
    fixed = fixed.replace(/^\.{2,3}\s*/, '');
  }
  
  // 添加缺失的代码块结束标记
  const openBackticks = (fixed.match(/```(\w*)/g) || []).length;
  const closeBackticks = (fixed.match(/```$/gm) || []).length;
  
  if (openBackticks > closeBackticks) {
    const missingCount = openBackticks - closeBackticks;
    fixed += '\n' + '```'.repeat(missingCount);
  }
  
  // 添加缺失的 JSON 结束标记
  if (/\{[\s\S]*$/.test(fixed) && !fixed.trim().endsWith('}')) {
    fixed += '\n}';
  }
  
  return fixed;
}

/**
 * 获取所有支持的启发式检查类型
 */
export function getSupportedHeuristics(): HeuristicType[] {
  return ['sentence_ending', 'code_block_closure', 'markdown_balance', 'json_brace_balance'];
}
