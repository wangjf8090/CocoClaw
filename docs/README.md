# SelfClaw 系统架构总览

## 定位

SelfClaw 是一个面向 AI Agent 的**技能质量保障与自我进化框架**。核心定位：**技能工坊**——用 Evolution 流水线把 Skill 打磨到上架标准，然后分发到各平台。

> SelfClaw 不是 Agent 市场，而是 npm 之于 Node.js 的角色——技能质量保障体系。

## 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                    SelfClaw Framework v3.0                    │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Evolution Harness (port 8084)               │ │
│  │                                                          │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │ │
│  │  │ Skill Audit  │  │Skill Optimize│  │ Skill Lifecycle │ │ │
│  │  │ Token预算    │  │ 描述精简     │  │ 健康评分        │ │ │
│  │  │ 重复检测     │  │ Meta-Skill   │  │ 负迁移防护      │ │ │
│  │  │ 负迁移风险   │  │ Rollout循环  │  │ 静默绕过检测    │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘ │ │
│  │                                                          │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │ │
│  │  │ Compliance  │  │  Template   │  │  Orchestrator   │ │ │
│  │  │ 行业合规     │  │ 行业模板    │  │ Plan→Exec→Verify│ │ │
│  │  │ 安全扫描     │  │ 上架包装    │  │ 依赖编排        │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘ │ │
│  │                                                          │ │
│  │  ┌─────────────────────────────────────────────────────┐│ │
│  │  │  SkillOpt Pipeline (6阶段)                          ││ │
│  │  │  Train → Meta-Skill → Evaluate → Gate → Deploy → Evolve││
│  │  └─────────────────────────────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │  Gateway   │  │   Memory   │  │    Market Research     │ │
│  │ (8080/9000)│  │  (8082)    │  │  Agent World Daily     │ │
│  │ HTTP/WS    │  │ 向量DB     │  │  Coze 3.0 Integration  │ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
│                                                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │ Permission │  │    SOUL    │  │     Infrastructure     │ │
│  │  (8083)    │  │  (8085)    │  │  PostgreSQL / Redis     │ │
│  │ RBAC/JWT   │  │ 人格模型   │  │  Prometheus / Grafana   │ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## 微服务清单

| 服务 | 端口 | 职责 | 状态 |
|------|------|------|------|
| Gateway | 8080/9000 | API 路由 / WebSocket / 限流 | ✅ 运行 |
| Evolution | 8084 | 技能进化引擎（6模块+Pipeline） | ✅ 运行 |
| Memory | 8082 | 记忆存储 / 向量检索 | ✅ 运行 |
| Permission | 8083 | 权限控制 / RBAC / JWT | ✅ 运行 |
| SOUL | 8085 | 人格建模 / 情感状态 | ✅ 运行 |
| Market Research | — | Agent World 日报 / 趋势分析 | ✅ 运行 |
| Redis | 6379 | 缓存 / 会话管理 | ✅ 运行 |
| PostgreSQL | 5432 | 持久化存储 | ✅ 运行 |

## 文档索引

### 架构设计
- [HARNESS_DESIGN.md](architecture/HARNESS_DESIGN.md) — Evolution Harness 设计文档（含 Coze 3.0 对接说明）
- [MEMORY_DESIGN.md](architecture/MEMORY_DESIGN.md) — 记忆系统设计文档
- [SECURITY_DESIGN.md](architecture/SECURITY_DESIGN.md) — 安全架构设计文档
- [ORCHESTRATOR_DESIGN.md](architecture/ORCHESTRATOR_DESIGN.md) — 编排引擎设计文档

### 技能体系
- [SKILL_ARCHITECTURE.md](skills/SKILL_ARCHITECTURE.md) — 技能架构总览
- [SKILL_PIPELINE.md](skills/SKILL_PIPELINE.md) — SkillOpt 6阶段 Pipeline
- [COZE3_COMPATIBILITY.md](skills/COZE3_COMPATIBILITY.md) — Coze 3.0 兼容性规范

### 评测体系
- [EVALUATION_FRAMEWORK.md](evaluation/EVALUATION_FRAMEWORK.md) — 评测框架设计
- [VALIDATION_REPORT.md](evaluation/VALIDATION_REPORT.md) — 验证报告

### 部署运维
- [DEPLOYMENT_GUIDE.md](deployment/DEPLOYMENT_GUIDE.md) — 部署指南

## 版本历史

| 版本 | 日期 | 关键变更 |
|------|------|---------|
| v3.0.0 | 2026-06-03 | +Orchestrator (Plan→Execute→Verify), +SkillOpt Pipeline |
| v2.1.0 | 2026-06-02 | +Compliance (行业合规), +Template (Coze 3.0模板) |
| v2.0.0 | 2026-05-29 | +Skill Audit/Optimize/Lifecycle, 双环架构重构 |
| v1.2.0 | 2026-05-28 | 集成 Skill Cleaner |
| v1.0.0 | 2026-05-11 | 初始版本，9服务微服务架构 |
