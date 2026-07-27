# SelfClaw P5 Implementation Plan: 7/23 Industry Insights Integration

> 日期：2026-07-24
> 输入源：7/23 AI日报（OpenAI沙箱逃逸/四大攻击/Cursor Swarm/微软Harness等）

---

## 📋 Task Overview

| Priority | Tasks | Target | Status |
|----------|-------|--------|--------|
| **P0** | 安全防护层 + Planner-Worker分层 | 本周完成 | ✅ Complete |
| **P1** | Context Engineering + 技能系统 + 国产模型Adapter | 下周完成 | ⏳ Pending |
| **P2** | 可观测性 + 工具审批 | 2周内完成 | ⏳ Pending |

---

## 🔴 P0 Tasks (This Week)

### P0-1: Skill Cleaner 审计模块
**目标**：实现Skill Cleaner独立验证层，防御Agent自主失对齐

**输入源**：
- Anthropic论文（14个模型4种自主失对齐行为）
- OpenAI沙箱逃逸事件
- 四大Agent攻击（Friendly Fire/MemGhost/GhostApproval/PromptArmor）

**实施**：
1. 新增 `packages/skills/src/skill-cleaner.ts`
   - Skill输入验证（防MemGhost记忆注入）
   - Skill输出审计（防目标偏差隐藏）
   - 7维度上下文质量评分（ProofAgent论文）
2. 集成到 `skill-evolver.ts`
3. 编写单元测试

**工作量**：3人天

### P0-2: 四大攻击防御点
**目标**：针对7/23日报中的4大攻击实现具体防御

**实施**：
1. `packages/security/src/layer8-defenses.ts`
   - Friendly Fire防御：浏览器内容预检
   - MemGhost防御：记忆输入验证（防跨会话注入）
   - GhostApproval防御：symlink防护
   - PromptArmor防御：连接器变更监控
2. 集成到 `security-manager.ts`
3. 编写单元测试

**工作量**：2人天

### P0-3: 行为审计链增强
**目标**：增强Harness的行为审计链，实现全链路trace

**输入源**：
- OpenAI沙箱逃逸（17000+自动化操作）
- 微软Harness OpenTelemetry

**实施**：
1. 增强 `packages/harness/src/trustworthy-executor.ts`
   - Agent→工具→输出全链路trace
   - 异常行为实时检测
   - 审计日志持久化
2. 集成OpenTelemetry标准
3. 编写单元测试

**工作量**：2人天

### P0-4: Planner-Worker分层
**目标**：实现强模型Planner + 廉价模型Worker分层

**输入源**：
- Cursor Swarm（成本降8倍）
- Cursor 2.4 Subagents

**实施**：
1. 增强 `packages/model-router/src/`
   - 新增 `planner-worker-router.ts`
   - 任务分解策略（强模型做规划）
   - 执行分发策略（廉价模型做执行）
2. 新增 `packages/multi-agent/src/subagent-coordinator.ts`
   - 子智能体并行协作
   - 独立上下文/工具/模型
3. 编写单元测试

**工作量**：3人天

### P0-5: Agent独立身份治理
**目标**：实现Agent独立身份 + 最小权限 + 审计追踪

**输入源**：
- Microsoft Entra Agent ID

**实施**：
1. 增强 `packages/permission/src/`
   - Agent身份管理
   - 最小权限策略
   - 审计追踪
2. 编写单元测试

**工作量**：2人天

---

## 🟡 P1 Tasks (Next Week)

### P1-1: Context Engineering 集成
**目标**：将7维度上下文质量评分集成到Skill Cleaner

**实施**：
1. 增强 `skill-cleaner.ts`
   - 7维度评分体系
   - 输入质量前置检查
2. 编写单元测试

**工作量**：1人天

### P1-2: 技能系统增强
**目标**：实现动态加载领域技能（SKILL.md + 斜杠命令）

**输入源**：
- Cursor Skills
- 微软Harness技能系统

**实施**：
1. 增强 `packages/skills/src/skill-standard.ts`
   - 斜杠命令调用
   - 动态加载机制
2. 编写单元测试

**工作量**：2人天

### P1-3: 国产模型Adapter
**目标**：实现Kimi K3和GLM-5.2适配器

**实施**：
1. 新增 `packages/model-router/src/adapters/kimi-k3-adapter.ts`
2. 新增 `packages/model-router/src/adapters/glm-5-2-adapter.ts`
3. 集成到ModelRouter
4. 编写单元测试

**工作量**：2人天

---

## 🟢 P2 Tasks (Within 2 Weeks)

### P2-1: OpenTelemetry集成
**目标**：实现Agent运行时遥测

**实施**：
1. 新增 `packages/observability/src/telemetry.ts`
2. 集成OpenTelemetry SDK
3. 编写单元测试

**工作量**：2人天

### P2-2: 工具审批机制
**目标**：实现高风险工具需人类确认

**实施**：
1. 增强 `packages/harness/src/trustworthy-executor.ts`
   - 工具风险分级
   - 审批流程
2. 编写单元测试

**工作量**：1人天

---

## 📊 Progress Tracking

| Task | Status | Started | Completed | Notes |
|------|--------|---------|-----------|-------|
| P0-1: Skill Cleaner | ✅ | 2026-07-24 | 2026-07-24 | `skills/src/skill-cleaner.ts` + 测试 |
| P0-2: 四大攻击防御 | ✅ | 2026-07-24 | 2026-07-24 | `security/src/layer8-defenses.ts` + 测试 |
| P0-3: 行为审计链 | ✅ | 2026-07-24 | 2026-07-24 | `harness/src/audit-trail.ts` |
| P0-4: Planner-Worker | ✅ | 2026-07-24 | 2026-07-24 | `model-router/src/planner-worker-router.ts` |
| P0-5: Agent身份治理 | ✅ | 2026-07-24 | 2026-07-24 | `permission/src/agent-identity-manager.ts` |
| P1-1: Context Engineering | ✅ | 2026-07-24 | 2026-07-24 | `skills/src/input-quality-gate.ts` + 测试 |
| P1-2: 技能系统增强 | ✅ | 2026-07-24 | 2026-07-24 | `skills/src/skill-registry.ts` + 测试 |
| P1-3: 国产模型Adapter | ✅ | 2026-07-24 | 2026-07-24 | `adapters/kimi-k3.ts` + `adapters/glm.ts`增强 + 测试 |
| P2-1: OpenTelemetry | ✅ | 2026-07-27 | 2026-07-27 | `observability/src/telemetry.ts` + 测试（79 tests） |
| P2-2: 工具审批 | ✅ | 2026-07-27 | 2026-07-27 | `harness/src/tool-approval.ts` + 测试（85 tests） |

---

## 🎯 Acceptance Criteria

### P0
- [ ] Skill Cleaner能检测并防御4大攻击
- [ ] 行为审计链能追踪Agent→工具→输出全链路
- [ ] Planner-Worker分层成本降50%+
- [ ] Agent独立身份治理支持最小权限

### P1
- [ ] Context Engineering 7维度评分集成
- [ ] 技能系统支持动态加载
- [ ] Kimi K3/GLM-5.2 adapter可用

### P2
- [ ] OpenTelemetry遥测数据可观测
- [ ] 高风险工具需审批

---

*文档创建时间：2026-07-24 10:00*
