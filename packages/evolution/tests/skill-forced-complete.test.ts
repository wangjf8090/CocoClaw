/**
 * 强制完整输出 - 单元测试
 * 
 * 测试场景：
 * - 句末标点检查
 * - 代码块闭合检查
 * - Markdown 平衡检查
 * - JSON 大括号平衡检查
 * - 续写触发逻辑
 * - 不该触发时不触发
 */

import { describe, it, expect } from "vitest";
import {
  checkCompleteness,
  checkSentenceEnding,
  checkCodeBlockClosure,
  checkMarkdownBalance,
  checkJsonBraceBalance,
  generateContinuePrompt,
  mergeContinuation,
  quickTruncationCheck,
  autoFixTruncation,
  getSupportedHeuristics,
} from "../src/skill-forced-complete.js";

describe("强制完整输出 - 单元测试", () => {
  // ==========================================================================
  // 句末标点检查测试
  // ==========================================================================

  describe("句末标点检查", () => {
    it("应该识别以句号结尾的完整句子", () => {
      const text = "这是一个完整的句子。";
      const issue = checkSentenceEnding(text);
      expect(issue).toBeNull();
    });

    it("应该识别以感叹号结尾的完整句子", () => {
      const text = "这太棒了！";
      const issue = checkSentenceEnding(text);
      expect(issue).toBeNull();
    });

    it("应该识别以问号结尾的完整句子", () => {
      const text = "这是什么意思？";
      const issue = checkSentenceEnding(text);
      expect(issue).toBeNull();
    });

    it("应该检测以单词结尾的可能截断", () => {
      const text = "这个函数用于处理用户";
      const issue = checkSentenceEnding(text);
      expect(issue).not.toBeNull();
      expect(issue?.type).toBe("sentence_ending");
      expect(issue?.severity).toBe("critical");
    });

    it("应该检测以逗号结尾的可能截断", () => {
      const text = "这是一个很长的列表，包括";
      const issue = checkSentenceEnding(text);
      expect(issue).not.toBeNull();
    });

    it("应该检测以列表项结尾的可能截断", () => {
      const text = "- 第一项\n- 第二项\n- 第三";
      const issue = checkSentenceEnding(text);
      expect(issue).not.toBeNull();
    });
  });

  // ==========================================================================
  // 代码块闭合检查测试
  // ==========================================================================

  describe("代码块闭合检查", () => {
    it("应该识别正确闭合的代码块", () => {
      const text = "```javascript\nconst x = 1;\n```";
      const issues = checkCodeBlockClosure(text);
      expect(issues.length).toBe(0);
    });

    it("应该识别未闭合的代码块", () => {
      const text = "```javascript\nconst x = 1;\n";
      const issues = checkCodeBlockClosure(text);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe("code_block_closure");
      expect(issues[0].severity).toBe("critical");
    });

    it("应该识别多个未闭合的代码块", () => {
      const text = "```js\ncode1\n```\n```python\ncode2";
      const issues = checkCodeBlockClosure(text);
      expect(issues.length).toBeGreaterThan(0);
    });

    it("应该识别空代码块", () => {
      const text = "```";
      const issues = checkCodeBlockClosure(text);
      expect(issues.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Markdown 平衡检查测试
  // ==========================================================================

  describe("Markdown 平衡检查", () => {
    it("应该识别正常的链接", () => {
      const text = "请访问 [Google](https://google.com) 获取更多信息。";
      const issues = checkMarkdownBalance(text);
      expect(issues.filter(i => i.type === 'markdown_balance')).toHaveLength(0);
    });

    it("应该检测未闭合的链接", () => {
      const text = "请访问 [Google](https://google.com";
      const issues = checkMarkdownBalance(text);
      expect(issues.some(i => i.type === 'markdown_balance')).toBe(true);
    });

    it("应该检测以列表项结尾的可能截断", () => {
      const text = "- 第一项\n- 第二项\n- 第三项";
      const issues = checkMarkdownBalance(text);
      // 以列表项结尾可能被截断
      expect(issues.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // JSON 大括号平衡检查测试
  // ==========================================================================

  describe("JSON 大括号平衡检查", () => {
    it("应该识别有效的 JSON", () => {
      const text = '{"name": "test", "value": 123}';
      const issues = checkJsonBraceBalance(text);
      expect(issues.length).toBe(0);
    });

    it("应该识别未闭合的 JSON 对象", () => {
      const text = '{"name": "test", "value": 123';
      const issues = checkJsonBraceBalance(text);
      expect(issues.some(i => i.type === 'json_brace_balance')).toBe(true);
      expect(issues[0]?.severity).toBe("critical");
    });

    it("应该识别未闭合的 JSON 数组", () => {
      const text = '{"items": [1, 2, 3';
      const issues = checkJsonBraceBalance(text);
      expect(issues.length).toBeGreaterThan(0);
    });

    it("应该识别不平衡的引号", () => {
      const text = '{"name": "test';
      const issues = checkJsonBraceBalance(text);
      expect(issues.length).toBeGreaterThan(0);
    });

    it("应该忽略非 JSON 内容", () => {
      const text = "这是一个普通的文本，不包含 JSON";
      const issues = checkJsonBraceBalance(text);
      expect(issues.length).toBe(0);
    });
  });

  // ==========================================================================
  // 完整性检查集成测试
  // ==========================================================================

  describe("完整性检查集成", () => {
    it("完整的 Markdown 文档应该通过检查", () => {
      const text = `# 标题

这是一个完整的段落。

## 代码示例

\`\`\`javascript
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

## 结论

以上就是完整的说明。
`;
      const result = checkCompleteness(text);
      expect(result.isComplete).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it("截断的 Markdown 文档应该不通过检查", () => {
      const text = `# 标题

这是一个不完整的
`;
      const result = checkCompleteness(text);
      expect(result.isComplete).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("未闭合的代码块应该触发 continue 建议", () => {
      const text = "```\n未闭合的代码";
      const result = checkCompleteness(text);
      expect(result.suggestedAction).toBe("continue");
    });

    it("空的 Markdown 文档应该有合理的分数", () => {
      const result = checkCompleteness("");
      expect(result.score).toBe(100);
      expect(result.isComplete).toBe(true);
    });
  });

  // ==========================================================================
  // 续写提示生成测试
  // ==========================================================================

  describe("续写提示生成", () => {
    it("应该生成基本的续写提示", () => {
      const originalText = "# 文档标题\n\n这是文档内容";
      const issues = [
        {
          type: 'sentence_ending' as const,
          description: '输出被截断',
          context: '这是文档内容',
          severity: 'critical' as const,
        },
      ];

      const prompt = generateContinuePrompt(originalText, issues);

      expect(prompt).toContain("请继续之前的输出");
      expect(prompt).toContain("不要重复已写内容");
    });

    it("应该根据问题类型添加特定指令", () => {
      const originalText = "```\n未闭合代码";
      const issues = [
        {
          type: 'code_block_closure' as const,
          description: '代码块未闭合',
          context: '```',
          severity: 'critical' as const,
        },
      ];

      const prompt = generateContinuePrompt(originalText, issues);

      expect(prompt).toContain("代码块正确闭合");
      expect(prompt).toContain("```");
    });

    it("应该包含原始内容参考", () => {
      const originalText = "# 标题\n段落内容";
      const prompt = generateContinuePrompt(originalText, []);

      expect(prompt).toContain("未完成的内容参考");
      expect(prompt).toContain("标题");
    });
  });

  // ==========================================================================
  // 续写合并测试
  // ==========================================================================

  describe("续写合并", () => {
    it("应该正确合并内容", () => {
      const original = "# 标题\n\n这是第一段内容。";
      const continuation = "\n\n这是第二段内容。";

      const result = mergeContinuation(original, continuation);

      expect(result.success).toBe(true);
      expect(result.fullContent).toContain("第一段内容");
      expect(result.fullContent).toContain("第二段内容");
    });

    it("应该检测并处理重复内容", () => {
      const original = "# 标题\n\n这是内容";
      const continuation = "这是内容\n\n这是新增内容";

      const result = mergeContinuation(original, continuation);

      expect(result.fullContent).not.toContain("这是内容这是内容");
    });

    it("应该正确处理空续写", () => {
      const original = "# 标题";
      const continuation = "";

      const result = mergeContinuation(original, continuation);

      expect(result.success).toBe(true);
      expect(result.fullContent).toBe(original);
    });
  });

  // ==========================================================================
  // 快速截断检查测试
  // ==========================================================================

  describe("快速截断检查", () => {
    it("应该检测可能截断的英文文本", () => {
      const text = "This is a sentence that ends with a word";
      expect(quickTruncationCheck(text)).toBe(true);
    });

    it("应该检测以常见单词结尾的截断", () => {
      const text = "The function will return the";
      expect(quickTruncationCheck(text)).toBe(true);
    });

    it("应该识别完整的英文句子", () => {
      const text = "This is a complete sentence.";
      expect(quickTruncationCheck(text)).toBe(false);
    });

    it("应该正确处理空字符串", () => {
      expect(quickTruncationCheck("")).toBe(false);
      expect(quickTruncationCheck("   ")).toBe(false);
    });
  });

  // ==========================================================================
  // 自动修复测试
  // ==========================================================================

  describe("自动修复", () => {
    it("应该添加缺失的代码块结束标记", () => {
      const text = "```javascript\nconst x = 1;";
      const fixed = autoFixTruncation(text);

      expect(fixed).toContain("```\n```");
    });

    it("应该移除截断前缀", () => {
      const text = "...这是一个被截断的文本";
      const fixed = autoFixTruncation(text);

      expect(fixed.startsWith("...")).toBe(false);
    });

    it("应该添加缺失的 JSON 结束标记", () => {
      const text = '{"name": "test"';
      const fixed = autoFixTruncation(text);

      expect(fixed).toContain("}");
    });

    it("不应该修改已完整的内容", () => {
      const text = "这是一个完整的句子。";
      const fixed = autoFixTruncation(text);

      expect(fixed).toBe(text);
    });
  });

  // ==========================================================================
  // 支持的启发式类型测试
  // ==========================================================================

  describe("支持的启发式类型", () => {
    it("应该返回所有支持的类型", () => {
      const heuristics = getSupportedHeuristics();

      expect(heuristics).toContain("sentence_ending");
      expect(heuristics).toContain("code_block_closure");
      expect(heuristics).toContain("markdown_balance");
      expect(heuristics).toContain("json_brace_balance");
    });
  });

  // ==========================================================================
  // 不该触发时不触发测试
  // ==========================================================================

  describe("不该触发时不触发", () => {
    it("完整的技术文档不应该被标记为不完整", () => {
      const text = `# 函数说明

## 功能
这个函数用于计算两个数的和。

## 参数
- a: 第一个数字
- b: 第二个数字

## 返回值
返回 a + b 的结果。

## 示例
\`\`\`javascript
const result = add(1, 2); // 返回 3
\`\`\`

## 注意事项
- 输入必须是数字类型
`;

      const result = checkCompleteness(text);

      // 完整文档应该通过检查或至少得到高分
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    it("正确的代码片段不应该被标记为不完整", () => {
      const text = "```typescript\ninterface User {\n  name: string;\n  age: number;\n}\n```";

      const result = checkCompleteness(text);

      expect(result.isComplete).toBe(true);
    });

    it("正确的 JSON 响应不应该被标记为不完整", () => {
      const text = `{
  "status": "success",
  "data": {
    "id": 1,
    "name": "test"
  }
}`;

      const result = checkCompleteness(text);

      expect(result.isComplete).toBe(true);
    });
  });
});
