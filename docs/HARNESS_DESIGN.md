# Self-Evolution Harness 设计文档

## 概述

Self-Evolution Harness（自我进化编排层）是 SelfClaw 的核心创新，也是业界首个具备自我进化能力的 LLM 编排系统。

它通过三大进化回路持续优化系统自身的行为，实现真正的「自我完善」：

1. **权限进化器 (PermissionEvolver)** - 从审计日志中学习权限模式
2. **性能进化器 (PerformanceEvolver)** - 自动调整性能参数
3. **记忆进化器 (MemoryEvolver)** - 优化记忆索引结构和权重

## 核心架构

```
┌─────────────────────────────────────────────────────────┐
│                Self-Evolution Harness                   │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Permission   │  │ Performance  │  │   Memory     │  │
│  │   Evolver    │  │   Evolver    │  │   Evolver    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│          │                 │                 │          │
│          └─────────────────┼─────────────────┘          │
│                            ▼                            │
│                  ┌──────────────────┐                   │
│                  │  A/B Test &      │                   │
│                  │  Rollback Engine │                   │
│                  └──────────────────┘                   │
│                            ▼                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │                  Event Bus                        │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                              ▼
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│ QueryEngine│  │   Memory   │  │  Security  │  │   Tools    │
└────────────┘  └────────────┘  └────────────┘  └────────────┘
```

## 三大进化回路详解

### 1. 权限进化器 (PermissionEvolver)

#### 功能
- 从审计日志中学习用户操作模式
- 自动优化白名单/黑名单规则
- 发现危险模式并自动更新
- 学习用户习惯，减少不必要的确认

#### 进化逻辑

```typescript
// 模式学习
for (const pattern of learnedPatterns) {
  if (pattern.frequency >= 100 && pattern.successRate > 0.95) {
    // 将该操作从「需要确认」降级为「自动批准」
    autoApprove(pattern);
  }
}

// 危险检测
if (failureRate > 0.3 && sampleSize > 10) {
  // 高失败率可能表示危险操作，加入黑名单
  blacklist(pattern);
}
```

#### 配置参数
```typescript
{
  autoOptimizeWhitelist: true,           // 自动优化白名单
  autoDetectDangerPatterns: true,        // 自动检测危险模式
  learnUserHabits: true,                 // 学习用户习惯
  confirmationReductionThreshold: 0.95,  // 减少确认的成功率阈值
  habitLearningSamples: 100,             // 学习所需样本数
}
```

---

### 2. 性能进化器 (PerformanceEvolver)

#### 功能
- Token 使用统计与优化
- 自动调整上下文压缩策略
- 热记忆缓存策略优化
- 并行度自动调优

#### 进化逻辑

**上下文窗口调优：**
```typescript
if (avgTokenUsage < contextWindow * 0.5 && latency > target) {
  // 利用率低但延迟高 - 减小窗口降低开销
  contextWindow *= 0.75;
}
if (avgTokenUsage > contextWindow * 0.9) {
  // 利用率高 - 增大窗口
  contextWindow *= 1.25;
}
```

**缓存策略优化：**
```typescript
if (cacheHitRate < 0.5) {
  // 命中率低 - 增大缓存
  cacheSize *= 1.5;
}
if (cacheHitRate > 0.95) {
  // 命中率极高 - 可以缩小节省内存
  cacheSize *= 0.75;
}
```

**并行度调优：**
```typescript
if (avgLatency > targetLatency * 2) {
  // 延迟过高 - 增加并行度
  maxParallelism *= 2;
}
```

#### 配置参数
```typescript
{
  autoTuneContextWindow: true,        // 自动调整上下文窗口
  autoOptimizeCacheStrategy: true,    // 自动优化缓存策略
  autoTuneParallelism: true,          // 自动调整并行度
  tokenUsageOptimization: true,       // Token 使用优化
  targetLatencyMs: 1000,              // 目标延迟
  compressionThreshold: 0.7,          // 启用压缩的阈值
}
```

---

### 3. 记忆进化器 (MemoryEvolver)

#### 功能
- 记忆索引结构参数自动优化
- 重要记忆自动提升权重
- 冗余记忆自动清理
- 检索算法参数自动调优

#### 进化逻辑

**索引参数调优：**
```typescript
if (searchLatency > 100 && avgRelevance > 0.85) {
  // 延迟高但相关性好 - 可以降低搜索质量换取速度
  efSearch *= 0.75;
}
if (avgRelevance < 0.6 && searchLatency < 200) {
  // 相关性低但延迟低 - 提高搜索质量
  efSearch *= 1.5;
}
```

**自动提升权重：**
```typescript
if (memory.accessFrequency > threshold && memory.importanceScore > 0.8) {
  // 频繁访问且重要的记忆 - 提升权重并移入热缓存
  boostWeight(memory);
  moveToHotCache(memory);
}
```

**冗余清理：**
```typescript
if (similarityScore > redundancyThreshold) {
  // 相似度极高的冗余记忆 - 保留最完整的版本
  keepMostCompleteVersion();
}
```

#### 配置参数
```typescript
{
  autoCleanRedundant: true,             // 自动清理冗余
  autoBoostImportant: true,             // 自动提升重要记忆
  autoTuneIndexParameters: true,        // 自动调优索引参数
  redundancyThreshold: 0.9,             // 冗余判定阈值
  importanceBoostThreshold: 0.8,        // 重要性提升阈值
}
```

---

## 安全机制

### A/B 测试框架

为了确保进化的安全性，所有变更都通过 A/B 测试验证：

```typescript
{
  enabled: true,
  trafficSplit: 0.1,           // 10% 流量用于测试
  minConfidenceLevel: 0.9,     // 需要 90% 置信度
  maxTestDuration: 86400000,   // 最长测试 24 小时
}
```

### 回滚机制

每次进化都会创建回滚点，确保可以随时安全回滚：

```typescript
interface RollbackPoint {
  id: string;
  version: string;
  timestamp: number;
  circuit: EvolutionCircuitType;
  state: Record<string, unknown>;  // 完整状态快照
  changes: EvolutionChange[];
}
```

最大保留 100 个回滚点，确保系统安全性。

---

## 事件流

Harness 发出以下关键事件：

| 事件类型 | 触发时机 | 数据 |
|---------|---------|------|
| `harness_start` | 编排层启动 | 版本号 |
| `evolution_cycle` | 进化周期开始/结束 | 状态、变更数 |
| `evolution_change` | 产生进化变更 | 进化回路、变更详情 |
| `permission_update` | 权限规则更新 | 新规则 |
| `performance_tuning` | 性能参数调整 | 新旧参数 |
| `memory_optimization` | 记忆优化执行 | 优化详情 |
| `ab_test_start` | A/B 测试开始 | 测试配置 |
| `ab_test_complete` | A/B 测试完成 | 测试结果 |
| `rollback_triggered` | 回滚触发 | 回滚点ID |

---

## 使用示例

### 基础使用

```typescript
import { createSelfEvolutionHarness } from '@selfclaw/harness';

// 创建编排层
const harness = createSelfEvolutionHarness(
  queryEngine,
  memoryManager,
  securityManager,
  toolRegistry,
  {
    autoApplyChanges: true,           // 自动应用变更
    evolutionCycleInterval: 60000,    // 每分钟进化一次
  }
);

// 初始化
await harness.initialize();

// 执行查询（自动注入记忆上下文）
for await (const event of harness.execute('Hello, how can you help?')) {
  console.log(event);
}
```

### 手动触发进化

```typescript
// 手动运行一次进化周期
const results = await harness.runEvolutionCycle();

for (const result of results) {
  console.log(`[${result.circuit}] ${result.changes.length} changes`);
}

// 获取当前进化统计
const stats = harness.getStats();
console.log(`Current version: ${stats.version}`);
console.log(`Rollback points: ${stats.rollbackPoints}`);
```

### 回滚操作

```typescript
// 列出最近的回滚点
const recentRollbacks = harness.getRecentRollbacks(10);

// 回滚到指定版本
const success = harness.rollback('rollback-point-id');
if (success) {
  console.log('Rollback successful');
}
```

---

## 设计原则

### 1. 安全优先
- 所有自动变更必须可回滚
- 高风险变更默认不自动应用
- A/B 测试验证后才能全量推广

### 2. 渐进式进化
- 小步快跑，每次变更不超过 5 项
- 有数据支持才变更，避免瞎猜
- 变更后必须验证效果

### 3. 透明度
- 所有变更都有明确的原因记录
- 置信度评分便于人工审核
- 完整的审计日志

### 4. 可解释性
- 每个进化决策都有解释
- 记录为什么做这个变更
- 记录变更后的效果

---

## 未来扩展

### 计划中的进化回路
- **工具选择进化器** - 学习选择最优工具组合
- **Prompt 工程进化器** - 自动优化系统提示词
- **模型路由进化器** - 根据任务自动选择最佳模型

### 高级功能
- 跨实例进化知识共享
- 进化策略元学习
- 对抗性测试自动生成
- 进化影响预测模拟

---

## 总结

Self-Evolution Harness 代表了 LLM 编排系统的新范式：

> **不是静态配置的工具，而是能够从自身运行中学习、持续优化自身行为的活系统。**

它实现了真正的「越用越好用」，为构建真正的自主智能系统奠定了基础。
