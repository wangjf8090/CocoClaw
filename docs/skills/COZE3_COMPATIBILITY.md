# Coze 3.0 兼容性规范

## 版本兼容矩阵

| SelfClaw 版本 | Coze 兼容性 | 支持的 Coze 特性 |
|---------------|------------|-----------------|
| v3.0.0 | Coze 3.0 | Orchestrator (Plan→Exec→Verify), Pipeline |
| v2.1.0 | Coze 3.0 | Compliance, Template (行业技能包) |
| v2.0.0 | Coze 2.x | Audit, Optimize, Lifecycle |
| v1.x | Coze 2.x | 基础功能 |

## Coze 3.0 特性映射

### 已实现

| Coze 3.0 特性 | SelfClaw 模块 | API |
|---------------|--------------|-----|
| 行业技能包标准 | skill-compliance | GET /api/compliance |
| 行业模板生成 | skill-template | POST /api/template |
| AI指挥官(目标建模) | skill-orchestrator (Plan) | POST /api/orchestrate/plan |
| AI调度官(执行编排) | skill-orchestrator (Execute) | POST /api/orchestrate |
| 结果验证 | skill-orchestrator (Verify) | POST /api/orchestrate |

### 待实现

| Coze 3.0 特性 | 对应模块 | 优先级 | 说明 |
|---------------|---------|--------|------|
| 本地 Agent 接入 | Gateway | P1 | Token 认证 + Agent 注册接口 |
| 项目空间 | Context Relay | P1 | 项目级上下文隔离和共享 |
| 三端协同 | Memory | P2 | 设备级上下文快照 |
| 云端 Agent 在线 | Lifecycle | P2 | 实时健康监控 |

## 上架流程

### 1. 合规检查
```bash
curl http://localhost:8084/api/compliance
# 确保: score ≥ 80, marketplaceReady: true
```

### 2. 自动修复（如需）
合规报告中包含 `autoFixContent`，可直接写入 SKILL.md：
```bash
curl http://localhost:8084/api/compliance/skill-name | jq -r '.autoFixContent' > SKILL.md
```

### 3. 生成上架包
```bash
curl -X POST http://localhost:8084/api/template
# 生成: SKILL.marketplace.md + references/ + scripts/
```

### 4. 预览（不写文件）
```bash
curl http://localhost:8084/api/template/skill-name
```

### 5. 上传到 Coze
在 Coze 3.0 技能商店创建技能，导入 SKILL.marketplace.md 内容。

## SKILL.md Frontmatter 规范

Coze 3.0 要求的 frontmatter 字段：

| 字段 | 必须 | 说明 | 示例 |
|------|------|------|------|
| name | ✅ | 技能名称 | `investment-analyzer` |
| description | ✅ | 技能描述（≤80字符） | `Finance: analyze, track, alert` |
| category | 推荐 | 行业分类 | `finance` |
| tags | 推荐 | 标签数组 | `["投资","股票","A股"]` |
| version | 推荐 | 版本号 | `"1.0.0"` |
| author | 可选 | 作者 | `"SelfClaw Team"` |
| license | 可选 | 许可证 | `"MIT"` |
| coze_compatible | 可选 | Coze 兼容标记 | `true` |
| coze_version | 可选 | 兼容的 Coze 版本 | `"3.0"` |

## 分发策略

SelfClaw 定位**技能工坊**，不直接做市场，而是通过 skill-template 生成上架包后分发到各平台：

| 平台 | 类型 | 分发方式 |
|------|------|---------|
| Coze 技能商店 | 官方市场 | skill-template → 手动上传 |
| AgentBay | Agent 电商 | skill-template → API 上传（待对接） |
| LegalBot Hub | 法律垂直 | skill-template → 手动上传 |
| CodeHive | 开发垂直 | skill-template → 手动上传 |
| 虾评 | 口碑评测 | 自动同步 audit/compliance 评分（待对接） |
