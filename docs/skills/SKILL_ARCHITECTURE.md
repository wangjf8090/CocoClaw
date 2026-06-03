# 技能架构总览

## 技能体系架构

SelfClaw 的技能体系围绕 **Evolution Harness** 构建，实现技能的完整生命周期管理：

```
发现 → 审计 → 优化 → 合规检查 → 模板生成 → 上架分发
```

## 模块清单

### 核心模块

| 模块 | 文件 | 版本 | 职责 |
|------|------|------|------|
| Skill Audit | skill-audit.ts | v2.0+ | Token 预算审计 / 重复检测 / Meta-Skill 审计 / 负迁移风险 |
| Skill Optimize | skill-optimize.ts | v2.0+ | 描述精简 / 冗余规则 / Rollout→Reflect→Edit→Gate 循环 |
| Skill Lifecycle | skill-lifecycle.ts | v2.0+ | 健康评分 / 静默绕过检测 / 部署风险 / 技能级记忆 |
| Skill Compliance | skill-compliance.ts | v2.1+ | 行业合规检查 / 安全扫描 / 自动修复 |
| Skill Template | skill-template.ts | v2.1+ | 行业模板生成 / Coze 3.0 上架包装 |
| Skill Orchestrator | skill-orchestrator.ts | v3.0+ | Plan→Execute→Verify 编排 |
| Skill Pipeline | skill-pipeline.ts | v3.0+ | SkillOpt 6阶段训练 Pipeline |

### Pipeline 6阶段

基于 arXiv:2605.23904 论文实现：

```
Train → Meta-Skill → Evaluate → Gate → Deploy → Evolve
  ↓        ↓            ↓        ↓       ↓        ↓
训练集   审计维度     后端评估  验证门控  部署决策  进化循环
```

## 技能质量评分

### Audit 评分维度

| 维度 | 权重 | 说明 |
|------|------|------|
| Token 预算占比 | 30% | 描述占上下文窗口的比例 |
| 描述质量 | 25% | 长度、路标式、动作词 |
| 重复度 | 20% | Jaccard 相似度 + body hash |
| 负迁移风险 | 15% | 技能间冲突/覆盖概率 |
| 静默绕过 | 10% | 技能是否被默默跳过 |

### Compliance 评分体系

| 检查项 | 扣分 | 说明 |
|--------|------|------|
| 必填字段缺失 | -20 | name, description |
| 推荐字段缺失 | -5 | category, tags |
| 描述过长 | -5 | >150 字符 |
| 缺少动作词 | -5 | 不符合路标式规范 |
| AI 味冗余词 | -5 | seamlessly, comprehensive 等 |
| 安全风险 | -20 | 硬编码密钥、危险命令 |
| 缺少目录结构 | -5 | references/, scripts/ |

**上架就绪标准**：评分 ≥80 且无 fail 级问题。

## 行业分类

| 行业 | 标识 | 关键词 | 默认标签 |
|------|------|--------|---------|
| 金融 | finance | 股票、基金、投资、财报 | 投资, 股票, A股, 财务分析 |
| 法律 | legal | 法律、法规、案例、合规 | 法律, 合规, 案例检索, 合同审查 |
| 自媒体 | self-media | 抖音、小红书、爆款 | 自媒体, 内容创作, 爆款, 运营 |
| 医疗 | medical | 医疗、健康、临床 | 医疗, 健康, 临床, 诊断辅助 |
| 技术 | tech | 代码、部署、架构 | 开发, 自动化, 代码, 部署 |
| 教育 | education | 教育、学习、考试 | 教育, 学习, 考试, 课程 |
| 通用 | general | 工具、效率 | 工具, 效率, 自动化 |

## 技能包结构规范（Coze 3.0）

```
skill-name/
├── SKILL.md              # 技能描述（必须）
│   ├── frontmatter:
│   │   ├── name          # 技能名称（必须）
│   │   ├── description   # 技能描述（必须，≤80字符）
│   │   ├── category      # 行业分类（推荐）
│   │   ├── tags          # 标签数组（推荐）
│   │   ├── version       # 版本号
│   │   ├── coze_compatible: true
│   │   └── coze_version: "3.0"
│   └── body:
│       ├── 使用场景
│       ├── 快速参考
│       └── 约束
├── SKILL.marketplace.md  # Coze 3.0 上架版本（skill-template 生成）
├── references/           # 参考文档（推荐）
│   └── index.md          # 行业参考资料
└── scripts/              # 可执行脚本（可选）
    └── README.md
```

## 技能流转流程

```
原始技能
   │
   ▼
skill-audit ──── Token审计 + 重复检测 + Meta-Skill审计
   │
   ▼
skill-optimize ── 描述精简 + Rollout循环
   │
   ▼
skill-compliance ─ 行业合规 + 安全扫描
   │
   ├── 评分 ≥80 ──▶ skill-template ──▶ SKILL.marketplace.md ──▶ 上架
   │
   └── 评分 <80 ──▶ autoFixContent ──▶ 修复后重新检查
```

## API 速查

```
# 审计
GET  /api/audit                  # 完整审计报告
GET  /api/audit/budget           # Token 预算
GET  /api/audit/duplicates       # 重复检测
GET  /api/audit/meta-skill       # Meta-Skill 三维度审计
GET  /api/audit/negative-transfer # 负迁移风险

# 优化
POST /api/optimize               # 批量优化
POST /api/optimize/cycle         # 完整 Rollout→Reflect→Edit→Gate 循环

# 合规
GET  /api/compliance             # 批量合规检查
GET  /api/compliance/:name       # 单技能合规

# 模板
POST /api/template               # 批量生成 Coze 3.0 模板
GET  /api/template/:name         # 单技能模板预览

# 生命周期
GET  /api/lifecycle              # 生命周期报告
GET  /api/lifecycle/bypass-check # 静默绕过检测
POST /api/lifecycle/deploy-risk  # 部署风险
GET  /api/lifecycle/skill-memory/:name # 技能级记忆

# 编排
POST /api/orchestrate            # Plan→Execute→Verify
POST /api/orchestrate/plan       # 仅 Plan 阶段

# Pipeline
POST /api/pipeline/train         # 启动 6 阶段训练
GET  /api/pipeline/status        # 训练状态
```
