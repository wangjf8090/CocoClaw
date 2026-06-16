# Verification Model 独立验证模型

> **版本**: v3.7.0  
> **所属**: SelfClaw Loop Engineering  
> **任务编号**: M1.3  
> **主人决策**: D1 - 默认 Verification Model = Claude Haiku

## 概述

Verification Model 是 SelfClaw Loop Engineering M1 阶段的核心组件之一，负责**独立判定 Skill 执行结果是否符合预期**，避免执行方自评（Executor Self-Assessment）导致的主观偏差。

## 设计目标

1. **独立验证**: 使用独立模型（非 Executor 使用的模型）进行结果判定
2. **可插拔**: 支持 Claude Haiku / GPT-4o-mini / Claude Sonnet 等多种模型
3. **多模型冗余**: 可配置多模型投票机制，提高验证可靠性
4. **置信度评分**: 显式返回 0-1 置信度，低置信度触发人工确认
5. **向后兼容**: 不配置时 fallback 到原有的规则验证

## 核心 API

### VerificationModel 类

```typescript
import { VerificationModel } from '@selfclaw/evolution';

// 基础用法
const verifier = new VerificationModel({
  model: 'claude-haiku',  // 默认值
  confidenceThreshold: 0.7,
  humanCheckpointInterval: 5,
});

// 单模型验证
const result = await verifier.verify({
  skillName: 'audit',
  goal: '审计所有技能',
  expectedOutput: '生成完整审计报告',
  actualOutput: '审计报告已生成，包含 10 个技能',
});

// 多模型冗余验证
const multiVerifier = new VerificationModel({
  model: 'claude-haiku',
  requireMultiModelConsensus: true,
  consensusModels: ['claude-haiku', 'gpt-4o-mini'],
});
const multiResult = await multiVerifier.verifyMulti([context]);
```

### 验证结果

```typescript
interface VerificationResult {
  passed: boolean;                    // 是否通过
  confidence: number;                 // 置信度 0-1
  reason: string;                      // 理由
  modelUsed: string;                   // 使用的模型
  consensusResults?: SingleVerificationResult[];  // 多模型时
  requireHumanReview: boolean;         // 是否需要人工确认
  meta?: {
    verificationRound?: number;
    configSnapshot?: Partial<VerificationConfig>;
  };
}
```

### 配置参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `model` | `string` | `claude-haiku` | 验证模型类型 |
| `customModelName` | `string` | - | 自定义模型名称（model=custom 时） |
| `llmClient` | `LLMClient` | - | 自定义 LLM 客户端 |
| `requireMultiModelConsensus` | `boolean` | `false` | 启用多模型冗余验证 |
| `consensusModels` | `string[]` | `['claude-haiku', 'gpt-4o-mini']` | 多模型列表 |
| `confidenceThreshold` | `number` | `0.7` | 置信度阈值 |
| `humanCheckpointInterval` | `number` | `5` | 每 N 轮强制人工确认 |

## 与 v3.6.0+v3.6.1 的协同

Verification Model 与反合理化表（Anti-Rationalization）、强制完整输出（Forced Complete）协同工作：

### 反合理化表协同

```typescript
const verifier = new VerificationModel({
  model: 'claude-haiku',
  antiRationalizationTablePath: '/path/to/anti-rationalization.json',
  // 验证时会检查 Executor 的自我评价是否在反合理化表中
});
```

### 强制完整输出协同

```typescript
const verifier = new VerificationModel({
  model: 'claude-haiku',
  forcedCompleteConfigPath: '/path/to/forced-complete.json',
  // 验证前会检查实际产出是否被截断
});
```

## 集成到 Skill Orchestrator

### 通过配置启用

```typescript
import { orchestrate } from '@selfclaw/evolution';

const result = await orchestrate(
  '审计所有技能并生成报告',
  taskDefs,
  [],
  {
    // ...其他配置
    verificationModel: {
      enabled: true,
      model: 'claude-haiku',
      confidenceThreshold: 0.7,
    },
  }
);
```

### 通过环境变量配置

```bash
ORCHESTRATE_VERIFICATION_ENABLED=true
ORCHESTRATE_VERIFICATION_MODEL=claude-haiku
ORCHESTRATE_VERIFICATION_MULTI=false
ORCHESTRATE_VERIFICATION_CONFIDENCE=0.7
ORCHESTRATE_VERIFICATION_CHECKPOINT_INTERVAL=5
```

### 直接注入 VerificationModel 实例

```typescript
import { orchestrate, VerificationModel } from '@selfclaw/evolution';

const customVerifier = new VerificationModel({
  model: 'claude-haiku',
  llmClient: myCustomLLMClient,  // 自定义 LLM 客户端
});

const result = await orchestrate(
  goal,
  taskDefs,
  [],
  { verificationModel: { enabled: true, model: 'custom' } },
  customVerifier  // 直接注入实例
);
```

## 验证 Prompt 设计

### 系统提示词

```
你是独立验证者（Verification Model），不受执行者（Executor）影响。

你的职责：
1. 客观评估 Skill 执行结果是否符合预期目标
2. 不依赖执行者提供的自我评价
3. 基于实际产出与预期目标的对比做出独立判断

关键原则：
- 你是独立的第三方，不受 Executor 影响
- 即使 Executor 声称成功，也要验证实际产出
- 关注结果质量，不只看是否完成
- 低置信度时要明确标记需要人工确认
```

## 风险应对

### 1. humanCheckpointInterval

每 N 轮强制人工确认，防止模型连续错误：

```typescript
const verifier = new VerificationModel({
  humanCheckpointInterval: 5,  // 每 5 轮强制人工确认
});
```

### 2. requireMultiModelConsensus

多模型投票，减少单点错误：

```typescript
const verifier = new VerificationModel({
  requireMultiModelConsensus: true,
  consensusModels: ['claude-haiku', 'gpt-4o-mini', 'claude-sonnet'],
});
```

### 3. antiComfortZoneInterval

（可扩展）防止模型陷入舒适区：

```typescript
// 未来版本支持
const verifier = new VerificationModel({
  antiComfortZoneInterval: 10,  // 每 10 轮切换验证策略
});
```

## 测试覆盖

| 测试编号 | 描述 | 状态 |
|---------|------|------|
| 1 | 单模型验证通过（高置信度） | ✅ |
| 2 | 单模型验证失败 | ✅ |
| 3 | 低置信度触发人工确认 | ✅ |
| 4 | 多模型冗余验证（一致通过） | ✅ |
| 5 | 多模型冗余验证（不一致 → 拒绝） | ✅ |
| 6 | 模型调用失败 fallback | ✅ |
| 7 | 集成测试：skill-orchestrator 调用 verification-model | ✅ |
| 8 | 向后兼容：不传 verificationModel 时行为不变 | ✅ |

## 文件清单

```
packages/evolution/src/
├── verification-model.ts      # 独立验证模型实现
├── skill-orchestrator.ts      # 修改：verifyResult() 支持 verificationModel
└── index.ts                   # 修改：导出新 API

packages/evolution/tests/
└── verification-model.test.ts  # 测试套件（≥8 用例）
```

## 与 Loop 六要素的对应

| Loop 六要素 | Verification Model 实现 |
|------------|------------------------|
| **独立模型判定完成状态** | ✅ VerificationModel 独立于 Executor |
| **显式置信度** | ✅ confidence: 0-1 |
| **人工确认阈值** | ✅ confidenceThreshold + humanCheckpointInterval |
| **多模型冗余** | ✅ requireMultiModelConsensus |
| **反合理化协同** | ✅ antiRationalizationTablePath |
| **强制完整输出协同** | ✅ forcedCompleteConfigPath |

## 未来扩展

1. **动态模型切换**: 根据任务复杂度自动选择模型
2. **学习反馈**: 根据人工确认结果调整置信度阈值
3. **Anti-ComfortZone**: 定期切换验证策略，防止模型陷入固定模式
4. **可解释性**: 返回详细的验证理由和证据链
