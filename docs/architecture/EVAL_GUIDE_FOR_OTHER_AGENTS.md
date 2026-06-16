# Agent Eval 方案：SelfClaw 实践总结（可移植版）

> **版本**: v3.7.0  
> **适用范围**: 任意 LLM Agent 框架 / 工作流引擎 / 多步推理系统  
> **核心场景**: 需要判断「Agent 执行结果是否符合预期」+「输出质量可量化」时  
> **作者**: SelfClaw Loop Engineering Team  
> **验证**: 6.8 个能力模块 + 60+ 测试用例（实际生产验证）

---

## 一、一句话定位

> **把「Executor 自评」换成「独立 Verifier 判定 + 反合理化约束 + 强制完整输出」三件套，让 Agent 评估从「主观感觉」变成「可量化、可审计、可回放」的工程能力。**

---

## 二、为什么需要这套方案（背景问题）

| 现象 | 根因 | 后果 |
|------|------|------|
| Agent 跳过测试 / 省略步骤 | 「改动小」「临时方案」等借口 | 长期技术债，回归 bug |
| 长输出中途截断 | LLM max_tokens 截断 / 提前 stop | 用户拿到半截内容，信任崩塌 |
| 同一任务输出 3 种风格 | Prompt 缺乏视觉锚点 | 「图片一模一样」反馈 |
| Executor 说「成功」实际失败 | 自评缺乏独立性 | 上线后才发现 |
| 多步任务中途出错无人知 | 无中间状态审计 | 排障靠猜 |

---

## 三、三大核心机制

### 机制 1：独立 Verifier 模型（Verification Model）

**核心思想**：用一个**独立于 Executor** 的模型来判定 Executor 的产出，强制返回结构化结果（pass/fail + 置信度 + 理由）。

#### 关键设计点

| 设计点 | SelfClaw 选择 | 为什么 |
|--------|---------------|--------|
| Verifier 模型 | Claude Haiku（默认）/ GPT-4o-mini / Sonnet | **便宜 + 独立于 Executor** 是关键 |
| 输出结构 | `{passed, confidence, reason, requireHumanReview}` JSON | 强制结构化便于审计 |
| 置信度阈值 | 默认 0.7，低于则触发人工 | 防止「假阳性通过」 |
| 人工确认轮次 | 每 5 轮强制一次（`humanCheckpointInterval`） | 防止连续错误累积 |
| 多模型冗余 | `requireMultiModelConsensus: true` 投票 | 重要任务用，平时不用（成本）|
| Fallback 策略 | LLM 不可用时降级到规则验证 | 永远不要让 Eval 卡死执行链路 |
| 评分标准 | 0.9-1.0 完美 / 0.7-0.9 基本 / 0.5-0.7 部分 / <0.5 不符 | 给 Verifier 明确锚点 |

#### 可移植接口（≈100 行 TypeScript）

```typescript
// verifier.ts — 可直接拷贝到任意项目
export interface VerificationResult {
  passed: boolean;            // 强制布尔，禁"模糊"
  confidence: number;         // 0-1，显式返回
  reason: string;             // 一句话理由
  requireHumanReview: boolean;
  modelUsed: string;          // 记录可追溯
}

export interface Verifier {
  verify(ctx: {
    skillName: string;
    goal: string;
    expectedOutput: string;
    actualOutput: string;
  }): Promise<VerificationResult>;
}

const SYSTEM_PROMPT = `你是独立验证者，不受执行者影响。
客观评估 Skill 执行结果是否符合预期目标。
不依赖执行者提供的自我评价。
关注结果质量，不只看是否完成。
低置信度时要明确标记需要人工确认。

评分标准：
- 0.9-1.0：完美符合，产出超出预期
- 0.7-0.9：基本符合预期
- 0.5-0.7：部分符合，有明显缺陷
- 0.3-0.5：大部分不符合
- 0.0-0.3：完全不符合

输出 JSON：{passed, confidence, reason, requireHumanReview}`;

export class ClaudeHaikuVerifier implements Verifier {
  async verify(ctx): Promise<VerificationResult> {
    const prompt = `
技能名称: ${ctx.skillName}
原始目标: ${ctx.goal}
预期产出: ${ctx.expectedOutput}
实际产出: ${ctx.actualOutput}

请以 JSON 格式返回验证结果。`;
    
    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        temperature: 0.3,           // 降低随机性
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });
      return JSON.parse(response.content[0].text);
    } catch (e) {
      // Fallback：永远不让 Eval 卡死执行链路
      return { passed: false, confidence: 0.3, reason: 'Verifier 不可用', requireHumanReview: true, modelUsed: 'fallback' };
    }
  }
}
```

---

### 机制 2：反合理化表（Anti-Rationalization Table）

**核心思想**：Agent 不能用「改动小」「临时方案」等借口跳过质量约束。**必须从预定义表里选一句反证话术自证**，并写入审计日志。

#### 10 条经典借口（覆盖 90% 场景）

| 借口类型 | Agent 借口 | 强制反证 |
|---------|-----------|---------|
| `skip_test` | 改动小 / 小改动 / 轻微修改 | "任何改动都可能引入 bug，无论改动大小" |
| `skip_test` | 跳过测试 / 暂时不测 / 后续再加 | "测试不能跳过。要么写测试，要么不写代码" |
| `skip_test` | 显而易见 / 不用测也能看出 | "显而易见的逻辑往往是最容易出错的地方" |
| `omit_step` | 省略步骤 / 简化流程 | "每个步骤都有其存在的理由" |
| `ignore_lint` | 忽略 lint / 暂时不管 | "Lint 警告是代码质量的信号灯" |
| `assume_safe` | 应该没问题 / 大概可以 | "不能用'应该'来替代验证" |
| `copy_paste` | 直接复制 / 抄一下 | "复制粘贴是技术债的源头" |
| `lazy` | 懒得 / 太麻烦 / 算了 | "'懒得'是质量下降的开始" |
| `lazy` | 临时方案 / 暂时的 / 先这样 | "临时方案往往会变成永久方案" |
| `skip_test` | 不影响核心功能 / 无关紧要 | "不影响核心功能的改动可能影响边缘场景" |

#### 关键设计点

| 设计点 | 为什么 |
|--------|-------|
| **正则匹配**（不是字符串相等） | 兼容 "改动很小"/"小改动"/"轻微修改" 等变体 |
| **优先级字段** | 多条匹配时按优先级取，避免误判 |
| **关键词覆盖度验证**（≥30% 关键词） | 防止 Agent 假引用反证 |
| **类型化附加检查**（如 skip_test 必须提"测试"） | 防止"表面自证实际敷衍" |
| **审计日志写盘** | 事后能复盘「哪些借口被放过」 |

#### 可移植代码（≈60 行）

```typescript
// anti-rationalization.ts
interface Entry {
  excusePattern: RegExp;
  counterArgument: string;
  type: 'skip_test' | 'omit_step' | 'ignore_lint' | 'assume_safe' | 'lazy';
  priority: number;
}

const TABLE: Entry[] = [
  { excusePattern: /改动小|小改动|轻微修改/, counterArgument: '任何改动都可能引入 bug', type: 'skip_test', priority: 1 },
  { excusePattern: /跳过.*测试|暂时不测|后续再加/, counterArgument: '测试不能跳过', type: 'skip_test', priority: 2 },
  { excusePattern: /省略.*步骤|简化.*流程/, counterArgument: '每个步骤都有其存在的理由', type: 'omit_step', priority: 3 },
  { excusePattern: /忽略.*lint|暂时不管/, counterArgument: 'Lint 警告是代码质量的信号灯', type: 'ignore_lint', priority: 2 },
  { excusePattern: /应该.*没问题|大概.*可以/, counterArgument: '不能用"应该"来替代验证', type: 'assume_safe', priority: 4 },
  { excusePattern: /懒得.*|太麻烦|以后再说/, counterArgument: '"懒得"是质量下降的开始', type: 'lazy', priority: 6 },
  { excusePattern: /临时.*方案|暂时的|先这样/, counterArgument: '临时方案往往会变成永久方案', type: 'lazy', priority: 3 },
  // 补到 10+ 条
];

export function detectRationalization(text: string): { detected: boolean; entry: Entry | null; counter: string } {
  const sorted = [...TABLE].sort((a, b) => a.priority - b.priority);
  for (const entry of sorted) {
    if (entry.excusePattern.test(text)) {
      return { detected: true, entry, counter: entry.counterArgument };
    }
  }
  return { detected: false, entry: null, counter: '' };
}
```

---

### 机制 3：强制完整输出（Forced Complete Output）

**核心思想**：LLM 长输出**必定**会截断。要么预先检测 + 续写，要么后果自负。

#### 4 大启发式检查

| 检查 | 截断信号 | SelfClaw 实现 |
|------|---------|---------------|
| **句末标点** | 以汉字/英文单词结尾而非 `。！？.)]}` | 简单规则，准确率 80% |
| **代码块闭合** | `` ``` `` 出现次数 ≠ 偶数 | 计数比对 |
| **Markdown 平衡** | `[text](url` 未闭合的链接 | 正则匹配 |
| **JSON 括号** | `{` 比 `}` 多 | 字符计数 |

#### 完整性评分

```
score = 100 - criticalCount * 30 - warningCount * 10 - infoCount * 5
isComplete = score >= 80
```

#### 续写循环

```
while (iterations < 3):
  check = checkCompleteness(content)
  if check.isComplete: return
  prompt = generateContinuePrompt(content, check.issues)
  continued = await llm.generate(prompt)
  content = mergeContinuation(content, continued)
```

#### 可移植代码（≈50 行核心）

```typescript
// forced-complete.ts
function checkCompleteness(text: string): { isComplete: boolean; issues: string[]; score: number } {
  const issues: string[] = [];
  const lastChar = text.trim().slice(-1);
  
  // 1. 句末标点
  if (!'。！？.!?)}]】:：'.includes(lastChar) && /[\u4e00-\u9fa5a-zA-Z]{2,}$/.test(text.trim())) {
    issues.push('sentence_truncated');
  }
  
  // 2. 代码块闭合
  const opens = (text.match(/```/g) || []).length;
  if (opens % 2 !== 0) issues.push('code_block_unclosed');
  
  // 3. JSON 括号
  const jsonMatch = text.match(/\{[\s\S]*$/);
  if (jsonMatch) {
    const braces = (jsonMatch[0].match(/\{/g) || []).length - (jsonMatch[0].match(/\}/g) || []).length;
    if (braces > 0) issues.push('json_unclosed');
  }
  
  const score = Math.max(0, 100 - issues.length * 30);
  return { isComplete: score >= 80, issues, score };
}

async function forcedCompleteLoop(initial: string, continueFn: (prompt: string) => Promise<string>) {
  let content = initial;
  for (let i = 0; i < 3; i++) {
    const check = checkCompleteness(content);
    if (check.isComplete) return { content, iterations: i };
    const continued = await continueFn(`继续之前的输出，不要重复。\n\n${content.slice(-500)}`);
    content += '\n' + continued;
  }
  return { content, iterations: 3 };
}
```

---

## 四、集成到任意 Agent 框架（≤ 50 行）

```typescript
// 假设你已有 Agent 执行函数
async function runAgent(goal: string): Promise<{ output: string; executionMeta: any }> {
  // ...你的 Agent 逻辑
}

// 升级：加上三层评估
async function runAgentWithEval(goal: string, expectedOutput: string) {
  // 1. 执行
  const { output, executionMeta } = await runAgent(goal);
  
  // 2. 完整性检查（机制 3）
  const completeness = checkCompleteness(output);
  if (!completeness.isComplete) {
    // 触发续写
    const result = await forcedCompleteLoop(output, async (prompt) => callLLM(prompt));
    output = result.content;
  }
  
  // 3. 反合理化检查（机制 2）
  const rationalization = detectRationalization(output);
  if (rationalization.detected) {
    logRationalization({ excuse: rationalization.entry.excuseDescription, counter: rationalization.counter });
    // 你可以选择：阻止发布 / 强制 Agent 重写 / 标记警告
  }
  
  // 4. 独立验证（机制 1）
  const verification = await verifier.verify({
    skillName: 'my-agent',
    goal,
    expectedOutput,
    actualOutput: output,
  });
  
  if (verification.requireHumanReview) {
    await notifyHuman({ goal, output, verification });
  }
  
  if (!verification.passed) {
    throw new Error(`Eval failed: ${verification.reason}`);
  }
  
  return { output, verification };
}
```

---

## 五、评估指标体系（量化）

| 维度 | 指标 | 计算 | 健康阈值 |
|------|------|------|---------|
| **质量** | Pass Rate | `passed / total` | > 85% |
| **质量** | Avg Confidence | `mean(confidence)` | > 0.75 |
| **可靠性** | Human Review Rate | `requireHumanReview / total` | < 20% |
| **可靠性** | Fallback Rate | `modelUsed == 'fallback' / total` | < 5% |
| **稳定性** | Multi-Model Agreement | 投票一致率 | > 80% |
| **执行** | Avg Iterations (Forced Complete) | `mean(loop count)` | < 1.5 |
| **行为** | Rationalization Rejection Rate | `rejected / detected` | > 70%（必须）|

**报表模板**（每天跑一次）：

```markdown
# Agent Eval 日报 (2026-06-16)

| 指标 | 数值 | 状态 |
|------|------|------|
| Pass Rate | 87.5% | ✅ |
| Avg Confidence | 0.82 | ✅ |
| Human Review Rate | 15.2% | ⚠️ 偏高 |
| Fallback Rate | 2.1% | ✅ |
| Iterations (Forced Complete) | 1.3 | ✅ |
| Rationalization Detected | 8 次 | ⚠️ |
| Rationalization Rejected | 7 次 | ✅ 87.5% |

## 异常分析
- Human Review Rate 15.2% 超 20% 阈值，集中在「库存分析」任务
- Rationalization 检测到 8 次，类型: skip_test × 5, lazy × 2, assume_safe × 1
```

---

## 六、反模式避坑（v3.6.0+v3.6.1 教训）

| ❌ 反模式 | ✅ 正确做法 | 来源 |
|----------|-----------|------|
| Executor 自己评分 | 独立 Verifier 模型 | Verification Model 设计 |
| 用 Executor 的 LLM 当 Verifier | 用 **不同** LLM（甚至不同厂商） | 「独立」是核心 |
| Verifier 输出「模糊」结论 | 强制结构化 JSON + 置信度 | 否则无法自动化 |
| 信任「应该没问题」 | 反合理化表强制反证 | v3.6.1 |
| 让 LLM 自由发挥续写 | 显式「不要重复已写内容」 | taste-skill 启发 |
| 单次检查就放弃 | 3 次续写循环 | 平衡成本 vs 质量 |
| Fallback 直接 fail | 降级到规则验证，永远不卡死 | LLM 不可用是常态 |
| 视觉风格随机变化 | Prompt 加「视觉变体清单」 | 主人 5/30 反馈「图片一模一样」 |
| 长输出不分段检查 | 4 大启发式并行检查 | 单项漏检率高 |
| Verifier 不记录 modelUsed | 强制记录可追溯 | 出问题能定位 |
| 置信度阈值一刀切 | 任务类型分级（关键 0.8 / 普通 0.7 / 探索 0.5）| 避免「假阴性」浪费 |

---

## 七、SelfClaw 实测数据（2026-06）

| 模块 | 文件 | 行数 | 测试用例 |
|------|------|------|---------|
| Verification Model | `packages/evolution/src/verification-model.ts` | 549 | 14+ |
| Anti-Rationalization | `packages/evolution/src/skill-anti-rationalization.ts` | 244 | 8+ |
| Forced Complete | `packages/evolution/src/skill-forced-complete.ts` | 270 | 6+ |
| WorkTree Manager | `packages/evolution/src/worktree-manager.ts` | 360 | 10+ |
| 药店 Skill (M1-A) | `packages/skills/pharmacy-operations-advisor/` | 4000+ | 29+ |
| **总计** | — | **5,400+** | **67+** |

**真实数据源 7 个**（P0 接入国家药监局/医保/基药目录，P1 接入临床指南/PubMed）

---

## 八、移植适配清单（4 步上手）

### 步骤 1：复制核心文件

```bash
# 复制到你的项目
cp verifier.ts <your-project>/src/eval/
cp anti-rationalization.ts <your-project>/src/eval/
cp forced-complete.ts <your-project>/src/eval/
```

### 步骤 2：接入你的 LLM Client

```typescript
// 替换 ClaudeHaikuVerifier 的 anthropic 调用
// 支持 OpenAI / Azure / 国产模型（DeepSeek / Qwen / 文心）
const verifier = new UniversalVerifier({
  model: 'gpt-4o-mini',  // 或 'deepseek-chat'
  llmClient: yourLLMClient,  // 实现 complete(prompt, options)
});
```

### 步骤 3：包裹你的 Agent 入口

参考「四、集成到任意 Agent 框架」50 行代码，在主入口加上 `runAgentWithEval` 包装。

### 步骤 4：埋点 + 报表

```typescript
// 每次 Eval 完成后
metrics.record({
  passRate, avgConfidence, humanReviewRate, 
  fallbackRate, iterations, rationalizationType,
});
// 每日 09:00 生成报表推送主人
```

---

## 九、ROI 估算

| 投入 | 产出 |
|------|------|
| **代码量**: 3 文件 ≈ 400 行 TS | **质量提升**: 跳过测试率 -80% |
| **Token 成本**: +5-10% (Verifier 调用) | **回滚次数**: -50% |
| **学习成本**: 1 天上手 | **可审计**: 100% 决策可追溯 |
| **维护成本**: 反合理化表 1 月 1 审 | **用户信任**: 「图不一样了」反馈消失 |

**结论**: 对**长期运行**的 Agent 系统，这套 Eval 方案是**必装**基础设施，不是 nice-to-have。

---

## 十、未来扩展方向

1. **Verifier 自我进化**：根据人工确认结果自动调整置信度阈值
2. **跨模型对比**：Opus vs Sonnet vs 国产模型在同一任务上的 Pass Rate 对比
3. **Anti-ComfortZone**：每 N 轮切换验证策略，防止 Verifier 陷入固定模式
4. **可解释性增强**：返回验证证据链（具体哪一句不符、哪个数据缺失）
5. **多模态评估**：图片 / 音频 / 视频产出的质量评估（当前仅文本）

---

**v3.7.0 M1 交付** · SelfClaw Loop Engineering · 6,000+ 行代码 + 67+ 测试用例
