# Self-Evolution Harness 设计文档

> **理论锚点**：Pydantic Logfire 于 2026 年 6 月发布 "The Harness Thesis"，提出：
> **"Harness 是让 Agent 对人类可理解、可传递、可持久化的外层系统。"**
> 长期 Agent 依赖 harness 超过依赖任何单一模型（Harness > Model）。
> 这与 SelfClaw Evolution 的核心定位高度一致——SelfClaw 是首个将 Harness Engineering 落地为可执行系统的开源实现。

## 概述

Self-Evolution Harness（自我进化编排层）是 SelfClaw 的核心创新，也是业界首个具备自我进化能力的 LLM 编排系统。

它通过三大进化回路持续优化系统自身的行为，实现真正的「自我完善」：

1. **权限进化器 (PermissionEvolver)** - 从审计日志中学习权限模式
2. **性能进化器 (PerformanceEvolver)** - 自动调整性能参数
3. **记忆进化器 (MemoryEvolver)** - 优化记忆索引结构和权重

v2.1 新增两个核心模块，对标 Coze 3.0 行业技能包生态：

4. **技能合规检查 (SkillCompliance)** - 检查 SKILL.md 是否符合上架规范
5. **行业模板生成 (SkillTemplate)** - 自动生成 Coze 3.0 可上架的技能包结构

### Pydantic Harness Thesis 四支柱 × Evolution 6 模块

| Pydantic 四大支柱 | SelfClaw Evolution 模块 | 成熟度 |
|---|---|---|
| **Durable Context** | skill-audit（Token预算） + memory | ✅ 稳定 |
| **Runtime Control** | skill-orchestrator v3.0（Plan→Execute→Verify） | ✅ 稳定 |
| **End-to-End Observability** | skill-compliance（合规检查） | ✅ 稳定 |
| **Evaluation & Governance** | skill-optimize（描述精简） | ✅ 稳定 |

来源：[Pydantic The Harness Thesis](https://pydantic.dev/articles/the-harness-thesis)

### 第三方实证支撑：PawBench v1.0（2026-06-05）

> **Pydantic 提出的 "Harness > Model" 论断不再只是观点，而是被通义实验室发布的 PawBench v1.0 量化证实。**

**PawBench 是什么**

2026 年 6 月 5 日，通义实验室开源的通用智能体评测基准 v1.0。核心创新是把"**模型 × Harness × 任务**"做三维交叉评测：

- 覆盖 **9 个底座模型** × **3 款运行框架** × **150 道任务** = **4050 个测试单元**
- 首次把 Harness（运行框架）作为独立变量纳入评测体系

**三个硬核数据**

| 数据 | 数值 | 含义 |
|---|---|---|
| 框架间平均分差 | **6.4 分** | ≈ 一次模型小版本迭代 |
| 单模型跨框架最大分差 | **11.5 分** | ≈ 一次模型代际差距 |
| 反直觉结论 | 小模型 + 好框架 > 大模型 + 差框架 | Harness 工程设计的杠杆效应 |

**对 SelfClaw 的关键意义**

- 6.4 分 ≈ 一次模型迭代，意味着 Harness 设计每优化 1 分，相当于模型团队干一轮
- 11.5 分的最大差说明：**Agent 的最终表现不是由模型单点决定，而是由 Harness 工程的成熟度决定**
- SelfClaw 的 Pydantic Harness Thesis 路线从"理论假设"升级为"被工业级基准量化的工程结论"

**PawBench 四项 Harness 设计原则 × SelfClaw 对应**

| PawBench 原则 | SelfClaw 对应模块 | 现状 |
|---|---|---|
| **充分告知 (Full Disclosure)**：结构化状态注入，避免散落信息 | Pydantic Schema 状态传递 + Memory 服务 | ✅ 已落地 |
| **按需装备 (On-demand Equip)**：工具按任务阶段动态加载 | Orchestrator 的 Plan→Execute→Verify 分阶段暴露 | ✅ 已落地 |
| **主动监控 (Active Monitoring)**：执行/监控分离，设立检查站 | OpenTelemetry 可观测性 + Skill Compliance | ✅ 已落地（v3.4） |
| **弹性恢复 (Resilient Recovery)**：重试/熔断/回滚等纯工程能力 | SkillOpt Pipeline 的 Rollback Engine + 三大进化回路 | ✅ 已落地 |

**对项目定位的强化**

> SelfClaw 不再仅仅是"Pydantic Harness Thesis 的早期工程实践"，而是**首个以 Harness Engineering 为核心理念、并能拿出可量化对照的工程化 Agent 框架**。PawBench 的发布为整个社区建立了统一的对照基准，SelfClaw 可在下一阶段对接 PawBench 做第三方能力校验。

**未来动作**

- 在 Orchestrator 中暴露 PawBench 兼容的 Harness 描述接口
- 拉取 PawBench 任务集做最小子集回归，量化 SelfClaw Harness 的得分水位
- 在 evaluation 模块新增 `pawbench-compat` 适配器

来源：[PawBench 调研报告 2026-06-09](../../SelfClaw研究/PawBench调研_20260609.md)

## 核心架构

```
┌─────────────────────────────────────────────────────────┐
│                Self-Evolution Harness v2.1               │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Permission   │  │ Performance  │  │   Memory     │  │
│  │   Evolver    │  │   Evolver    │  │   Evolver    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│          │                 │                 │          │
│          └─────────────────┼─────────────────┘          │
│                            ▼                            │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ Skill Compliance │  │  Skill Template  │             │
│  │   (Coze 3.0)     │  │   (Coze 3.0)     │             │
│  └──────────────────┘  └──────────────────┘             │
│          │                     │                         │
│          └──────────┬──────────┘                         │
│                     ▼                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Skill Audit  │  │ Skill Optimize│  │Skill Lifecycle│  │
│  │  (Token预算) │  │  (描述精简)   │  │ (健康评分)    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
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

## Harness 4 大设计原则 × DuMate 5 大降耗手段（对照表）

> 验证 SelfClaw Harness 设计的工程化覆盖度，以及离 DuMate 75% 工业基准还有多远。

### 对照矩阵

| Pydantic 4 大原则 \ DuMate 5 大手段 | Token Factory | KV Cache 分层 | 上下文按需组装 | 渐进式工具发现 | 安全沙箱重构 |
|----------------------------------|------------|------------|----------|----------|----------|
| **Durable Context**（持久化上下文） | — | ✅ 已有 | ⚠️ P0 增强 | — | — |
| **Runtime Control**（运行时控制） | ❌ 模型侧 | — | ✅ 已有 | ✅ 已有 | — |
| **End-to-End Observability**（可观测） | — | ✅ 已有 | ✅ 已有 | ✅ 已有 | ✅ 已有 |
| **Evaluation & Governance**（评估治理） | — | — | ⚠️ P0 待补 | ✅ 已有（v3.7.0 M1） | ✅ 已有 |

**覆盖度统计**

- ✅ 已有：**9 / 20 = 45%**
- ⚠️ P0 待补：**3 / 20 = 15%**
- ❌ 不可达（模型侧）：**1 / 20 = 5%**
- — 不适用：**7 / 20 = 35%**

### 三个待补 P0 项拆解

| P0 项 | 对应手段 | 工程动作 | 预期收益 | 难度 |
|------|---------|---------|---------|------|
| **上下文按需组装深度优化** | 上下文按需组装 | MemoryEvolver 加意图识别 + 敏感度判断；Orchestrator 上下文注入分阶段 | 对话轮次 -23%（对齐 DuMate） | 中 |
| **渐进式工具发现 Token 节省量化** | 渐进式工具发现 | PerformanceEvolver 暴露每步工具调用的 Token 占比；Skill Cleaner 优化 MCP 包装 | Token 节省量化（DuMate 基准 98%） | 低 |
| **PerformanceEvolver Token 节省可观测** | 整体 | 新增 `token_saving_ratio` 指标 + Dashboard | 对标 DuMate 75% 持续可观测 | 低 |

### 与 DuMate 75% 的差距分析

- **可达成部分**（3/5 手段已落地 + 2 项 P0 待补）→ 理论上限 **接近 DuMate 75%**，但需要实际跑通后量化
- **不可达成部分**（Token Factory 推理侧优化）→ 需要模型厂商支持，harness 层只能做接口适配
- **PinchBench 93.3% 启示**：SelfClaw 后续应在自有评测集中跑出对照数据，作为 harness 优化效果的内部 baseline

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

---

## Coze 3.0 对接说明 (v2.1+)

### 背景

Coze 3.0 于 2026 年 6 月 1 日发布，推出了**行业技能包**生态，为金融、法律、自媒体、医疗等领域提供开箱即用的专家技能。SelfClaw Evolution v2.1 新增两个核心模块，直接对标 Coze 3.0 的技能包规范。

### 模块对比

| 模块 | 功能 | 对应 Coze 能力 |
|------|------|----------------|
| **SkillCompliance** | 行业合规检查 | 行业技能包上架标准 |
| **SkillTemplate** | 行业模板生成 | Coze 3.0 可上架技能包结构 |
| **SkillAudit** | Token 预算审计 | Codex 预算分配算法 |
| **SkillOptimize** | 描述精简优化 | 路标式描述规范（≤40 词） |
| **SkillLifecycle** | 健康评分与使用统计 | 技能使用数据追踪 |

### 行业分类

技能包支持 7 大行业分类：
- **finance** — 股票、基金、投资、财报、估值
- **legal** — 法律、法规、案例、合规、合同
- **self-media** — 自媒体、抖音、小红书、爆款、运营
- **medical** — 医疗、健康、临床、诊断、药物
- **tech** — 开发、自动化、代码、部署、架构
- **education** — 教育、学习、考试、课程、知识
- **general** — 通用工具、效率、自动化

### API 端点

```
# 技能合规检查
GET  /api/compliance           — 批量合规报告
GET  /api/compliance/:skillName — 单技能合规详情

# 行业模板生成
POST /api/template             — 批量生成 Coze 3.0 模板
GET  /api/template/:skillName  — 单技能模板预览

# 原有端点
GET  /api/audit                — 技能审计（Token 预算 + 重复检测）
POST /api/optimize             — 描述优化
GET  /api/lifecycle            — 生命周期报告
```

### 使用示例

```bash
# 1. 批量合规检查
curl http://localhost:8084/api/compliance | jq '.averageScore, .marketplaceReadyCount'

# 2. 单技能合规详情
curl http://localhost:8084/api/compliance/market-research | jq '.score, .checks[]'

# 3. 批量生成行业模板（生成 SKILL.marketplace.md + references/ + scripts/）
curl -X POST http://localhost:8084/api/template \
  -H 'Content-Type: application/json' \
  -d '{"outputDir": "/path/to/skills"}'

# 4. 预览单技能模板（不写文件）
curl http://localhost:8084/api/template/ai-text-detox | jq '.content'
```

### 合规评分体系

| 检查项 | 扣分 | 说明 |
|--------|------|------|
| 必填字段缺失 | -20 | name, description |
| 推荐字段缺失 | -5 | category, tags |
| 描述过长 | -5 | >150 字符 |
| 缺少动作词 | -5 | 不符合路标式规范 |
| 安全风险 | -20 | 硬编码密钥、危险命令 |
| 缺少目录结构 | -5 | references/, scripts/ |

**上架就绪标准**：评分 ≥80 且无 fail 级问题。

### 行业模板规范

生成的 SKILL.md 包含：
- Frontmatter：name, description, category, tags, version, author, license, coze_compatible, coze_version
- 使用场景模板
- 快速参考表格
- 约束说明

自动创建目录：
- `references/` — 行业参考资料（来源、框架、方法）
- `scripts/` — 可执行脚本占位

### 对接 Coze 3.0 上架流程

1. **合规检查**：`GET /api/compliance`，确保评分 ≥80
2. **自动修复**：合规报告中包含 `autoFixContent`，可直接替换 SKILL.md
3. **行业包装**：`POST /api/template`，生成 SKILL.marketplace.md
4. **人工审核**：检查生成的 frontmatter 和 references/ 内容
5. **上传 Coze**：在 Coze 3.0 技能商店创建技能，导入 SKILL.marketplace.md

### 技术细节

- **行业检测**：基于关键词映射 + Jaccard 相似度
- **描述生成**：复用 skill-audit 的 suggestDescription，按行业模板包装
- **安全扫描**：正则检测硬编码密钥、密码、危险命令
- **结构检查**：验证 SKILL.md frontmatter、references/、scripts/ 目录
- **自动修复**：在原 SKILL.md 基础上补充缺失字段和优化描述

### 未来扩展

- **Coze 3.0 Gateway 适配** — 让 SelfClaw 服务可被 Coze 项目空间直接 @调度
- **项目空间集成** — Context Relay 升级为项目级上下文隔离和共享
- **跨端同步** — Memory 服务支持设备级上下文快照
- **使用数据对接** — skill-lifecycle 连接 Coze Agent 的真实使用指标
- **PawBench 兼容与对标** — 在 Orchestrator 暴露 PawBench 兼容的 Harness 描述接口，evaluation 模块新增 `pawbench-compat` 适配器，量化 SelfClaw Harness 的得分水位（详见上文"第三方实证支撑"）
