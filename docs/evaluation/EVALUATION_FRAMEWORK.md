# 评测框架设计

## 概述

SelfClaw 评测体系覆盖技能质量的三个维度：**审计评测**、**合规评测**、**编排评测**。

## 评测维度

### 1. 审计评测（Skill Audit）

**评测目标**：技能在上下文窗口中的资源效率

| 指标 | 计算方式 | 阈值 |
|------|---------|------|
| 预算使用率 | budgetedTokens / budgetTokens | ≤ 80% |
| 上下文占比 | budgetedTokens / contextTokens | ≤ 2% |
| 描述截断数 | 被截断的技能数 | 0 |
| 省略技能数 | 装不下的技能数 | 0 |
| 重复组数 | Jaccard ≥ 0.85 的组数 | 0 |

### 2. Meta-Skill 评测

基于 arXiv:2605.23899 三维度评测框架：

| 维度 | 指标 | 说明 |
|------|------|------|
| 一致性 (Consistency) | Skill 实际行为 vs 描述一致性 | 行为偏差率 |
| 安全性 (Safety) | 负迁移风险评估 | 技能间冲突/覆盖概率 |
| 可靠性 (Reliability) | 静默绕过检测 | 技能被默默跳过的概率 |

### 3. 合规评测（Skill Compliance）

**评测目标**：技能是否符合 Coze 3.0 上架标准

| 检查级别 | 条件 | 说明 |
|---------|------|------|
| pass | score = 100 | 完全合规 |
| warning | score ≥ 60 | 有改进空间 |
| fail | score < 60 或有 fail 级检查 | 不合规 |

**上架就绪标准**：score ≥ 80 且无 fail 级问题。

### 4. 编排评测（Skill Orchestrator）

**评测目标**：编排引擎的执行效率和正确性

| 指标 | 说明 | 基线 |
|------|------|------|
| goalScore | 目标达成度 0-1 | ≥ 0.7 |
| successRate | 成功任务占比 | ≥ 80% |
| parallelismEfficiency | 实际并行度 / 理论最大并行度 | ≥ 60% |
| scheduleLength | 执行总时长 / 最长路径时长 | ≤ 2.0 |

## SkillOpt Pipeline 评测

基于 arXiv:2605.23904 的 SkillOpt 训练循环评测：

### 6 阶段评测指标

| 阶段 | 评测内容 | 通过标准 |
|------|---------|---------|
| Train | 训练数据质量 | 样本数 ≥ 10 |
| Meta-Skill | 审计维度评分 | ≥ C 级 |
| Evaluate | 后端评估分数 | Mock: 恒定分 / 真实: 待对接 |
| Gate | 编辑验证门控 | acceptanceRate > 0 |
| Deploy | 部署决策 | 无负迁移风险 |
| Evolve | 进化指标 | performanceScore 递增 |

### 评估后端

当前使用 `MockEvaluationBackend`（固定评分），需要对接真实评估：

```typescript
interface EvaluationBackend {
  evaluate(skill: Skill, testData: unknown[]): Promise<number>;
  // 返回 0-1 分数，代表技能在测试数据上的表现
}
```

**待对接方案**：
1. **Test Harness** — 使用预定义测试用例自动评估技能行为
2. **A/B Testing** — 对比优化前后的真实使用效果
3. **人类反馈** — 收集用户对技能输出的满意度评分

## 评测流程

```
技能提交
   │
   ▼
┌──────────┐     不通过      ┌──────────┐
│ Audit     │ ──────────────▶ │ 优化循环  │
│ 评测      │                 │ Optimize │
└────┬─────┘                 └────┬─────┘
     │ 通过                       │ 优化完成
     ▼                            ▼
┌──────────┐     不通过      ┌──────────┐
│ Compliance│ ──────────────▶ │ AutoFix  │
│ 评测      │                 │ 自动修复  │
└────┬─────┘                 └────┬─────┘
     │ 通过                       │ 修复完成
     ▼                            ▼
┌──────────┐
│ Template  │ ──▶ 生成上架包
│ 打包评测  │
└──────────┘
```

## 评测报告格式

```json
{
  "timestamp": "2026-06-03T02:00:00Z",
  "skill": "skill-name",
  "audit": {
    "budgetUsedRatio": 0.078,
    "duplicateGroups": 0,
    "metaSkillGrade": "A",
    "negativeTransferRisk": "low"
  },
  "compliance": {
    "score": 85,
    "level": "warning",
    "marketplaceReady": true,
    "checks": [...]
  },
  "orchestration": {
    "goalScore": 0.92,
    "successRate": 1.0,
    "parallelismEfficiency": 0.75
  },
  "overallVerdict": "marketplace-ready"
}
```

## 与学术论文的对应关系

| 论文 | SelfClaw 实现 | 对应模块 |
|------|-------------|---------|
| arXiv:2605.23899 (Meta-Skill) | 三维度审计 + 负迁移防护 | skill-audit, skill-lifecycle |
| arXiv:2605.23904 (SkillOpt) | 6阶段 Pipeline | skill-pipeline, skill-optimize |
| arXiv:2605.10500 (Silent Bypass) | 静默绕过检测 | skill-lifecycle |
| Coze 3.0 行业标准 | 合规检查 + 模板生成 | skill-compliance, skill-template |
| Coze 3.0 双角色设计 | Plan→Execute→Verify | skill-orchestrator |

## 改进路线

| 阶段 | 目标 | 计划 |
|------|------|------|
| 短期 | MockEvaluationBackend → Test Harness | 实现真实评估函数 |
| 中期 | 离线评测 → 在线评测 | 对接用户使用数据 |
| 长期 | 单点评测 → 持续评测 | 编排引擎自动触发评测循环 |
