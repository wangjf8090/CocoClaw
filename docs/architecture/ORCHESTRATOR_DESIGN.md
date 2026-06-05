# 编排引擎设计文档

## 概述

Skill Orchestrator 是 SelfClaw v3.0 的核心编排引擎，实现了 **Plan→Execute→Verify** 三阶段编排模式，参考 Coze 3.0 的 AI指挥官+AI调度官 双角色设计。

## 设计理念

| Coze 3.0 角色 | 职责 | Orchestrator 对应 |
|---------------|------|-------------------|
| AI指挥官 | 目标建模、任务拆解、约束设定 | Plan 阶段 |
| AI调度官 | 节点触发、资源分配、执行时序 | Execute 阶段 |
| （隐含） | 质量检查、结果验收 | Verify 阶段 |

## 三阶段详解

### 1. Plan 阶段（v3.2 新增 Context Compression）

**输入**：目标（goal）+ 任务定义列表 + 约束条件

**核心逻辑**：
1. **Context Compression（MAF Agent Harness 对标）**：目标结构化建模
   - 意图分类：基于关键词推断 intent（audit/optimize/deploy/analyze/manage/create/monitor/mixed）
   - 实体提取：从目标文本中识别技能、服务、文件、系统等实体
   - 复杂度评估：基于任务数和依赖深度计算 1-5 级复杂度
   - 能力分析：推导 requiredSkills/Services/Files/Functions 及能力缺口
   - Todo 生成：每个任务生成结构化待办项（优先级/依赖/耗时）
2. 接收任务定义，构建任务图
3. **拓扑排序**（Kahn 算法）确定执行顺序
4. **并行分组**：基于依赖深度计算，同一深度的任务可并行执行
5. 循环依赖检测

**输出**：
```
Plan {
  goal, goalModel, contextSummary, constraints, tasks[],
  dependencyGraph, executionOrder, parallelGroups,
}
```

其中 `goalModel` = { intent, intentConfidence, entities, complexity, successCriteria, keyConstraints }
`contextSummary` = { conciseGoal, keyEntities, todoList, capabilities, compressionRatio, contextLength }

**示例**：
```
输入: 审计所有技能并优化描述
goalModel: { intent: "mixed", intentConfidence: 0.6, complexity: 1, ... }
contextSummary: {
  conciseGoal: "综合 2 个任务",
  todoList: [
    { id: "todo-audit", description: "技能审计：扫描所有技能文件", priority: 2, done: false },
    { id: "todo-optimize", description: "描述优化：优化过长描述", priority: 1, done: false }
  ],
  capabilities: { requiredSkills: ["all"], gaps: ["all"] },
  compressionRatio: 0.44
}
```

**示例**：
```
输入: 审计并优化所有技能
任务: t1(审计) → t2(合规) + t3(优化) → t4(模板生成)

执行顺序: t1 → t2 → t3 → t4
并行分组: [[t1], [t2,t3], [t4]]
         审计  并行执行   汇总
```

### 2. Execute 阶段（v3.3 新增 CodeAct Batching）

**输入**：Plan 阶段的输出

**核心逻辑**：
1. 按 parallelGroups 逐组执行
2. 每组内限制最大并行度（默认 4）
3. **CodeAct 批处理（MAF Agent Harness 对标）**：
   - 同 batch 内的任务按类型分组（skill/http/function 等）
   - 每组生成一个 CodeAct tool-calling 序列
   - 一次 LLM 调用执行整组（而非逐个调用）
   - 通过 `codeActBatching: boolean` 配置开关（默认开启）
4. 依赖检查：前序任务失败 → 后续任务标记 skipped
5. 全局超时控制
6. 失败重试：每个任务可配置最大重试次数

**CodeAct 批次记录示例**：
```
{
  batchId: "codeact-1780643034422",
  taskType: "skill",
  taskIds: ["t1", "t2", "t3"],
  toolCalls: ["skill(t1, t2, t3)"],
  llmCallReduction: { before: 3, after: 1 },  // 节省 2 次调用
  duration: 0ms,
  success: true
}
```

**执行流程**：
```
for each parallelGroup:
  ├── CodeAct Batching（按类型合并）
  │   ├── skill tasks → skill(group_id) 一次 LLM 调用
  │   └── http tasks → http(group_id) 一次 LLM 调用
  └── 失败 → 重试（≤ maxRetries）
```

### 3. Verify 阶段

**输入**：原始 goal + Plan + ExecutionResult

**核心逻辑**：
1. 逐任务验证：检查执行状态是否 success
2. 关联度评估：任务描述与目标的关键词重叠度
3. 目标达成度计算：加权平均（成功任务按关联度加权）
4. 重试决策：失败但可重试的任务加入 retryNeeded
5. 生成人类可读的验证报告

**评分体系**：
```
goalScore = Σ(成功任务的关联度) / Σ(所有任务的关联度)
goalAchieved = goalScore >= verifyThreshold (默认 0.7)
```

**最终状态**：
| 状态 | 条件 |
|------|------|
| completed | goalAchieved = true |
| partial | 部分成功，goalAchieved < 阈值 |
| failed | 全部失败 |

## API 端点

### POST /api/orchestrate
完整编排流程（Plan→Execute→Verify）

```bash
curl -X POST http://localhost:8084/api/orchestrate \
  -H 'Content-Type: application/json' \
  -d '{
    "goal": "审计并优化所有技能",
    "tasks": [
      {
        "id": "audit",
        "name": "技能审计",
        "type": "skill",
        "description": "扫描所有技能生成审计报告",
        "dependencies": [],
        "constraints": [],
        "input": {"skillName": "all"},
        "timeout": 10000,
        "maxRetries": 1
      },
      {
        "id": "optimize",
        "name": "描述优化",
        "type": "skill",
        "description": "优化过长的技能描述",
        "dependencies": ["audit"],
        "constraints": [],
        "input": {"skillName": "all"},
        "timeout": 10000,
        "maxRetries": 1
      }
    ],
    "constraints": ["审计必须先完成"],
    "config": {
      "globalTimeout": 60000,
      "maxParallelism": 4,
      "verifyThreshold": 0.7
    }
  }'
```

### POST /api/orchestrate/plan
仅 Plan 阶段（不执行），用于预览执行计划

## 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| globalTimeout | 120000ms | 全局超时 |
| taskTimeout | 30000ms | 单任务超时 |
| maxRetries | 1 | 最大重试次数 |
| maxParallelism | 4 | 最大并行度 |
| verifyThreshold | 0.7 | Verify 达成阈值 |
| codeActBatching | true | P1-2: 启用 CodeAct 批处理 |

可通过环境变量覆盖：
```
ORCHESTRATE_GLOBAL_TIMEOUT=120000
ORCHESTRATE_TASK_TIMEOUT=30000
ORCHESTRATE_MAX_RETRIES=1
ORCHESTRATE_MAX_PARALLELISM=4
ORCHESTRATE_VERIFY_THRESHOLD=0.7
ORCHESTRATE_CODEACT_BATCHING=false
```

## 设计决策

### 为什么是单进程而非分布式调度？

1. SelfClaw 的编排粒度是 Skill 级别，不是大规模数据处理
2. 单进程避免网络开销和一致性复杂度
3. 后续可通过 sessions_spawn 扩展为多进程

### 为什么 Verify 是关键词重叠而非语义相似度？

1. 零依赖，不需要额外的 embedding 服务
2. 对于任务级别的验证，关键词覆盖已足够
3. 后续可升级为 Memory 服务的向量检索

### 为什么任务执行器是 Mock？

当前阶段 Orchestrator 的核心价值是**编排逻辑**（拓扑排序、并行分组、依赖检查、重试控制），而非具体执行。执行器设计为可插拔接口：

```typescript
// 未来替换为真实执行逻辑
async function executeTask(task: Task, config: OrchestratorConfig): Promise<TaskResult> {
  switch (task.type) {
    case "skill":
      // 真实调用: const result = await fetch(`http://localhost:8084/api/${task.input.endpoint}`);
    case "http":
      // 真实调用: const result = await fetch(task.input.url, task.input.options);
    case "sub-orchestration":
      // 真实调用: const result = await orchestrate(task.input.subGoal, task.input.tasks);
  }
}
```

## 未来扩展

1. **真实执行器** — 替换 Mock 为 Evolution API / sessions_spawn 调用
2. **条件分支** — 支持 if/else 逻辑，根据前序结果选择不同路径
3. **流式输出** — SSE 推送每个任务的实时状态
4. **持久化** — 编排结果存入 PostgreSQL，支持历史查询
5. **递归编排** — sub-orchestration 任务类型支持嵌套编排
