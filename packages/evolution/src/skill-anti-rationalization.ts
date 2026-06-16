/**
 * 反合理化表（Anti-Rationalization Table）模块 v3.6.1
 * 
 * 来源：addyosmani/agent-skills（TDD/Code Review 技能集 + 反合理化表机制）
 * 
 * 核心机制：
 * - Agent 在「跳过测试」「省略步骤」「忽略 lint」等场景下，必须从「反合理化表」里选一句自证
 * - 显式写入审计日志
 * - 解决 Agent 用"改动小"跳测试的问题
 */

// ============================================================================
// Types
// ============================================================================

/**
 * 反合理化表条目
 */
export interface AntiRationalizationEntry {
  /** 借口模式（用于匹配） */
  excusePattern: RegExp;
  /** 借口描述 */
  excuseDescription: string;
  /** 反证话术（Agent 必须引用） */
  counterArgument: string;
  /** 优先级（数字越小优先级越高） */
  priority: number;
  /** 类型 */
  type: 'skip_test' | 'omit_step' | 'ignore_lint' | 'assume_safe' | 'copy_paste' | 'lazy';
}

/**
 * 反合理化检测结果
 */
export interface AntiRationalizationDetection {
  /** 是否检测到合理化行为 */
  detected: boolean;
  /** 匹配到的借口条目 */
  matchedEntry: AntiRationalizationEntry | null;
  /** 上下文片段 */
  context: string;
  /** 建议的反证话术 */
  suggestedArgument: string;
}

/**
 * 审计日志中的反合理化记录
 */
export interface AntiRationalizationLog {
  /** 时间戳 */
  timestamp: string;
  /** 技能名称 */
  skillName: string;
  /** 检测到的借口 */
  excuse: string;
  /** 引用的反证 */
  counterArgument: string;
  /** 最终判断 */
  decision: 'approved' | 'rejected';
  /** 判断理由 */
  reason: string;
}

/**
 * 反合理化审计报告
 */
export interface AntiRationalizationReport {
  /** 检测到的合理化行为总数 */
  totalDetections: number;
  /** 拒绝的合理化行为数 */
  rejectedCount: number;
  /** 审计日志 */
  logs: AntiRationalizationLog[];
  /** 按类型统计 */
  statistics: Record<string, number>;
}

// ============================================================================
// 反合理化表数据（至少 8-10 条）
// ============================================================================

export const ANTI_RATIONALIZATION_TABLE: AntiRationalizationEntry[] = [
  {
    excusePattern: /改动小|小改动|轻微修改|简单调整|只是加点/,
    excuseDescription: "改动很小，不需要测试",
    counterArgument: "任何改动都可能引入 bug，无论改动大小。TDD 要求每次改动都必须有测试覆盖。",
    priority: 1,
    type: 'skip_test',
  },
  {
    excusePattern: /跳过.*测试|暂时不测|后续再加|稍后补/,
    excuseDescription: "暂时跳过测试，后续再加",
    counterArgument: "测试不能跳过。没有测试的代码是不可维护的。要么写测试，要么不写代码。",
    priority: 2,
    type: 'skip_test',
  },
  {
    excusePattern: /这个.*很明显|显而易见|不用测也能看出/,
    excuseDescription: "逻辑很简单，显而易见，不需要测试",
    counterArgument: "显而易见的逻辑往往是最容易出错的地方。自动化测试不是为了验证显而易见，而是为了防止意外退化。",
    priority: 1,
    type: 'skip_test',
  },
  {
    excusePattern: /省略.*步骤|简化.*流程|跳过.*环节/,
    excuseDescription: "省略某些步骤，简化流程",
    counterArgument: "每个步骤都有其存在的理由。省略步骤可能隐藏重要逻辑，导致生产环境问题。",
    priority: 3,
    type: 'omit_step',
  },
  {
    excusePattern: /忽略.*lint|暂时不管|以后再修|忽略警告/,
    excuseDescription: "忽略 lint 警告",
    counterArgument: "Lint 警告是代码质量的信号灯。忽略它们会积累技术债，最终导致难以维护的代码。",
    priority: 2,
    type: 'ignore_lint',
  },
  {
    excusePattern: /应该.*没问题|大概.*可以|相信.*没问题/,
    excuseDescription: "应该没问题，不用验证",
    counterArgument: "不能用'应该'来替代验证。计算机程序需要确定性，不能依赖模糊的信心。",
    priority: 4,
    type: 'assume_safe',
  },
  {
    excusePattern: /直接复制|抄一下|借鉴一下|类似.*就行/,
    excuseDescription: "复制粘贴代码，不做理解",
    counterArgument: "复制粘贴是技术债的源头。即使代码相似，也应该理解后重构，而不是盲目复制。",
    priority: 5,
    type: 'copy_paste',
  },
  {
    excusePattern: /懒得.*|太麻烦|以后再说|算了/,
    excuseDescription: "懒得写测试/文档，以后再说",
    counterArgument: "'懒得'是质量下降的开始。现在的懒惰会以加倍的维护成本偿还。",
    priority: 6,
    type: 'lazy',
  },
  {
    excusePattern: /临时.*方案|暂时的|很快会改|先这样/,
    excuseDescription: "这是临时方案，很快会改",
    counterArgument: "临时方案往往会变成永久方案。如果真的是临时的，应该设置过期时间或立即重构。",
    priority: 3,
    type: 'lazy',
  },
  {
    excusePattern: /不影响.*|没有.*影响|无关紧要/,
    excuseDescription: "改动不影响核心功能，不需要测试",
    counterArgument: "不影响核心功能的改动可能影响性能、安全性或边缘场景。全面测试是专业开发者的标准。",
    priority: 2,
    type: 'skip_test',
  },
];

// ============================================================================
// 核心功能
// ============================================================================

/**
 * 检测文本中的合理化行为
 */
export function detectRationalization(
  text: string,
  skillName: string = "unknown"
): AntiRationalizationDetection {
  // 按优先级排序（优先级高的先匹配）
  const sortedEntries = [...ANTI_RATIONALIZATION_TABLE].sort((a, b) => a.priority - b.priority);

  for (const entry of sortedEntries) {
    if (entry.excusePattern.test(text)) {
      // 提取匹配的上下文
      const lines = text.split('\n');
      const matchedLine = lines.find(line => entry.excusePattern.test(line)) || "";

      return {
        detected: true,
        matchedEntry: entry,
        context: matchedLine.trim(),
        suggestedArgument: entry.counterArgument,
      };
    }
  }

  return {
    detected: false,
    matchedEntry: null,
    context: "",
    suggestedArgument: "",
  };
}

/**
 * 验证 Agent 的自证是否充分
 */
export function verifySelfJustification(
  detection: AntiRationalizationDetection,
  agentResponse: string
): {
  approved: boolean;
  reason: string;
} {
  if (!detection.detected) {
    return {
      approved: true,
      reason: "未检测到合理化行为",
    };
  }

  const { counterArgument, type } = detection.matchedEntry!;

  // 检查 Agent 是否引用了反证话术的关键部分
  const argumentKeywords = extractKeywords(counterArgument);
  const mentionedCount = argumentKeywords.filter(keyword =>
    agentResponse.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  const mentionRatio = mentionedCount / argumentKeywords.length;

  if (mentionRatio < 0.3) {
    return {
      approved: false,
      reason: `Agent 未充分引用反证话术。应提及：${argumentKeywords.slice(0, 3).join(' / ')}`,
    };
  }

  // 特定类型的额外检查
  if (type === 'skip_test') {
    if (!agentResponse.includes('测试') && !agentResponse.includes('test')) {
      return {
        approved: false,
        reason: "跳过测试的借口必须明确提及测试计划或测试覆盖",
      };
    }
  }

  if (type === 'ignore_lint') {
    if (!agentResponse.includes('重构') && !agentResponse.includes('修复')) {
      return {
        approved: false,
        reason: "忽略 lint 的借口必须包含后续修复计划",
      };
    }
  }

  return {
    approved: true,
    reason: "Agent 的自证充分，接受了反合理化约束",
  };
}

/**
 * 提取关键词（用于验证是否引用了反证话术）
 */
function extractKeywords(text: string): string[] {
  // 简单的关键词提取：过滤掉停用词，保留有意义的词汇
  const stopWords = ['的', '了', '是', '在', '和', '与', '或', '但', '不', '能', '会', '要', '都', '很', '也', '就', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'shall', 'can', 'cannot', 'can\'t', 'will', 'not', 'this', 'that', 'these', 'those', 'it', 'its'];
  
  return text
    .split(/[\s,.;:!?()\-]+/)
    .filter(word => word.length > 1 && !stopWords.includes(word.toLowerCase()))
    .slice(0, 10); // 保留前 10 个关键词
}

// ============================================================================
// 审计日志管理
// ============================================================================

const antiRationalizationLogs: AntiRationalizationLog[] = [];

/**
 * 记录反合理化审计
 */
export function logAntiRationalization(
  skillName: string,
  detection: AntiRationalizationDetection,
  agentResponse: string,
  decision: 'approved' | 'rejected',
  reason: string
): void {
  const logEntry: AntiRationalizationLog = {
    timestamp: new Date().toISOString(),
    skillName,
    excuse: detection.detected ? detection.matchedEntry!.excuseDescription : "无",
    counterArgument: detection.suggestedArgument,
    decision,
    reason,
  };

  antiRationalizationLogs.push(logEntry);
}

/**
 * 获取反合理化审计报告
 */
export function getAntiRationalizationReport(): AntiRationalizationReport {
  const rejectedCount = antiRationalizationLogs.filter(log => log.decision === 'rejected').length;

  // 按类型统计
  const statistics: Record<string, number> = {};
  for (const log of antiRationalizationLogs) {
    const entry = ANTI_RATIONALIZATION_TABLE.find(e => e.excuseDescription === log.excuse);
    if (entry) {
      statistics[entry.type] = (statistics[entry.type] || 0) + 1;
    }
  }

  return {
    totalDetections: antiRationalizationLogs.length,
    rejectedCount,
    logs: [...antiRationalizationLogs],
    statistics,
  };
}

/**
 * 清空审计日志
 */
export function clearAntiRationalizationLogs(): void {
  antiRationalizationLogs.length = 0;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成审计日志的 Markdown 报告
 */
export function generateMarkdownReport(): string {
  const report = getAntiRationalizationReport();
  
  if (report.totalDetections === 0) {
    return "# 反合理化审计报告\n\n未检测到合理化行为。✅";
  }

  const lines = [
    "# 反合理化审计报告",
    `生成时间: ${new Date().toISOString()}`,
    "",
    "## 概览",
    `- 总检测数: ${report.totalDetections}`,
    `- 拒绝数: ${report.rejectedCount}`,
    `- 通过率: ${((report.totalDetections - report.rejectedCount) / report.totalDetections * 100).toFixed(1)}%`,
    "",
    "## 按类型统计",
    ...Object.entries(report.statistics).map(([type, count]) => `- ${type}: ${count}`),
    "",
    "## 审计日志",
    ...report.logs.map(log => [
      `### ${log.skillName} (${log.timestamp})`,
      `- 借口: ${log.excuse}`,
      `- 反证: ${log.counterArgument}`,
      `- 判断: ${log.decision}`,
      `- 理由: ${log.reason}`,
      "",
    ].join("\n")),
  ];

  return lines.join("\n");
}

/**
 * 获取反合理化表的完整列表
 */
export function getAntiRationalizationTable(): AntiRationalizationEntry[] {
  return [...ANTI_RATIONALIZATION_TABLE];
}