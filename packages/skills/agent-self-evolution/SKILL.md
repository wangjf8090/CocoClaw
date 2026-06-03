---
name: self-improvement
description: "Captures learnings, errors, and corrections to enable continuous improvement. Use when: (1) A command or operation fails unexpectedly, (2) User corrects Claude ('No, that's wrong...', 'Actually...'), (3) User requests a capability that doesn't exist, (4) An external API or tool fails, (5) Claude realizes its knowledge is outdated or incorrect, (6) A better approach is discovered for a recurring task. Also review learnings before major tasks."
metadata:
---

# Self-Improvement Skill

Log learnings and errors to markdown files for continuous improvement. Coding agents can later process these into fixes, and important learnings get promoted to project memory.

## Quick Reference

| Situation | Action |
|-----------|--------|
| Command/operation fails | Log to `.learnings/ERRORS.md` |
| User corrects you | Log to `.learnings/LEARNINGS.md` with category `correction` |
| User wants missing feature | Log to `.learnings/FEATURE_REQUESTS.md` |
| API/external tool fails | Log to `.learnings/ERRORS.md` with integration details |
| Knowledge was outdated | Log to `.learnings/LEARNINGS.md` with category `knowledge_gap` |
| Found better approach | Log to `.learnings/LEARNINGS.md` with category `best_practice` |
| Simplify/Harden recurring patterns | Log/update `.learnings/LEARNINGS.md` with `Source: simplify-and-harden` and a stable `Pattern-Key` |
| Similar to existing entry | Link with `**See Also**`, consider priority bump |
| Broadly applicable learning | Promote to `CLAUDE.md`, `AGENTS.md`, and/or `.github/copilot-instructions.md` |
| Workflow improvements | Promote to `AGENTS.md` (OpenClaw workspace) |
| Tool gotchas | Promote to `TOOLS.md` (OpenClaw workspace) |
| Behavioral patterns | Promote to `SOUL.md` (OpenClaw workspace) |

## OpenClaw Setup (Recommended)

OpenClaw is the primary platform for this skill. It uses workspace-based prompt injection with automatic skill loading.

### Installation

**Via ClawdHub (recommended):**
```bash
clawdhub install self-improving-agent
```

**Manual:**
```bash
git clone https://github.com/peterskoett/self-improving-agent.git ~/.openclaw/skills/self-improving-agent
```

Remade for openclaw from original repo : https://github.com/pskoett/pskoett-ai-skills - https://github.com/pskoett/pskoett-ai-skills/tree/main/skills/self-improvement

### Workspace Structure

OpenClaw injects these files into every session:

```
~/.openclaw/workspace/
├── AGENTS.md          # Multi-agent workflows, delegation patterns
├── SOUL.md            # Behavioral guidelines, personality, principles
├── TOOLS.md           # Tool capabilities, integration gotchas
├── MEMORY.md          # Long-term memory (main session only)
├── memory/            # Daily memory files
│   └── YYYY-MM-DD.md
└── .learnings/        # This skill's log files
    ├── LEARNINGS.md
    ├── ERRORS.md
    └── FEATURE_REQUESTS.md
```

### Create Learning Files

```bash
mkdir -p ~/.openclaw/workspace/.learnings
```

Then create the log files (or copy from `assets/`):
- `LEARNINGS.md` — corrections, knowledge gaps, best practices
- `ERRORS.md` — command failures, exceptions
- `FEATURE_REQUESTS.md` — user-requested capabilities

### Promotion Targets

When learnings prove broadly applicable, promote them to workspace files:

| Learning Type | Promote To | Example |
|---------------|------------|---------|
| Behavioral patterns | `SOUL.md` | "Be concise, avoid disclaimers" |
| Workflow improvements | `AGENTS.md` | "Spawn sub-agents for long tasks" |
| Tool gotchas | `TOOLS.md` | "Git push needs auth configured first" |

### Inter-Session Communication

OpenClaw provides tools to share learnings across sessions:

- **sessions_list** — View active/recent sessions
- **sessions_history** — Read another session's transcript  
- **sessions_send** — Send a learning to another session
- **sessions_spawn** — Spawn a sub-agent for background work

### Optional: Enable Hook

For automatic reminders at session start:

```bash
# Copy hook to OpenClaw hooks directory
cp -r hooks/openclaw ~/.openclaw/hooks/self-improvement

# Enable it
openclaw hooks enable self-improvement
```

See `references/openclaw-integration.md` for complete details.

---

## Generic Setup (Other Agents)

For Claude Code, Codex, Copilot, or other agents, create `.learnings/` in your project:

```bash
mkdir -p .learnings
```

Copy templates from `assets/` or create files with headers.

### Add reference to agent files AGENTS.md, CLAUDE.md, or .github/copilot-instructions.md to remind yourself to log learnings. (this is an alternative to hook-based reminders)

#### Self-Improvement Workflow

When errors or corrections occur:
1. Log to `.learnings/ERRORS.md`, `LEARNINGS.md`, or `FEATURE_REQUESTS.md`
2. Review and promote broadly applicable learnings to:
   - `CLAUDE.md` - project facts and conventions
   - `AGENTS.md` - workflows and automation
   - `.github/copilot-instructions.md` - Copilot context

## Logging Format

### Learning Entry

Append to `.learnings/LEARNINGS.md`:

```markdown
## [LRN-YYYYMMDD-XXX] category

**Logged**: ISO-8601 timestamp
**Priority**: low | medium | high | critical
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config

### Summary
One-line description of what was learned

### Details
Full context: what happened, what was wrong, what's correct

### Suggested Action
Specific fix or improvement to make

### Metadata
- Source: conversation | error | user_feedback
- Related Files: path/to/file.ext
- Tags: tag1, tag2
- See Also: LRN-20250110-001 (if related to existing entry)
- Pattern-Key: simplify.dead_code | harden.input_validation (optional, for recurring-pattern tracking)
- Recurrence-Count: 1 (optional)
- First-Seen: 2025-01-15 (optional)
- Last-Seen: 2025-01-15 (optional)

---
```

### Error Entry

Append to `.learnings/ERRORS.md`:

```markdown
## [ERR-YYYYMMDD-XXX] skill_or_command_name

**Logged**: ISO-8601 timestamp
**Priority**: high
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config

### Summary
Brief description of what failed

### Error
```
Actual error message or output
```

### Context
- Command/operation attempted
- Input or parameters used
- Environment details if relevant

### Suggested Fix
If identifiable, what might resolve this

### Metadata
- Reproducible: yes | no | unknown
- Related Files: path/to/file.ext
- See Also: ERR-20250110-001 (if recurring)

---
```

### Feature Request Entry

Append to `.learnings/FEATURE_REQUESTS.md`:

```markdown
## [FEAT-YYYYMMDD-XXX] capability_name

**Logged**: ISO-8601 timestamp
**Priority**: medium
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config

### Requested Capability
What the user wanted to do

### User Context
Why they needed it, what problem they're solving

### Complexity Estimate
simple | medium | complex

### Suggested Implementation
How this could be built, what it might extend

### Metadata
- Frequency: first_time | recurring
- Related Features: existing_feature_name

---
```

## ID Generation

Format: `TYPE-YYYYMMDD-XXX`
- TYPE: `LRN` (learning), `ERR` (error), `FEAT` (feature)
- YYYYMMDD: Current date
- XXX: Sequential number or random 3 chars (e.g., `001`, `A7B`)

Examples: `LRN-20250115-001`, `ERR-20250115-A3F`, `FEAT-20250115-002`

## Resolving Entries

When an issue is fixed, update the entry:

1. Change `**Status**: pending` → `**Status**: resolved`
2. Add resolution block after Metadata:

```markdown
### Resolution
- **Resolved**: 2025-01-16T09:00:00Z
- **Commit/PR**: abc123 or #42
- **Notes**: Brief description of what was done
```

Other status values:
- `in_progress` - Actively being worked on
- `wont_fix` - Decided not to address (add reason in Resolution notes)
- `promoted` - Elevated to CLAUDE.md, AGENTS.md, or .github/copilot-instructions.md

## Promoting to Project Memory

When a learning is broadly applicable (not a one-off fix), promote it to permanent project memory.

### When to Promote

- Learning applies across multiple files/features
- Knowledge any contributor (human or AI) should know
- Prevents recurring mistakes
- Documents project-specific conventions

### Promotion Targets

| Target | What Belongs There |
|--------|-------------------|
| `CLAUDE.md` | Project facts, conventions, gotchas for all Claude interactions |
| `AGENTS.md` | Agent-specific workflows, tool usage patterns, automation rules |
| `.github/copilot-instructions.md` | Project context and conventions for GitHub Copilot |
| `SOUL.md` | Behavioral guidelines, communication style, principles (OpenClaw workspace) |
| `TOOLS.md` | Tool capabilities, usage patterns, integration gotchas (OpenClaw workspace) |

### How to Promote

1. **Distill** the learning into a concise rule or fact
2. **Add** to appropriate section in target file (create file if needed)
3. **Update** original entry:
   - Change `**Status**: pending` → `**Status**: promoted`
   - Add `**Promoted**: CLAUDE.md`, `AGENTS.md`, or `.github/copilot-instructions.md`

### Promotion Examples

**Learning** (verbose):
> Project uses pnpm workspaces. Attempted `npm install` but failed. 
> Lock file is `pnpm-lock.yaml`. Must use `pnpm install`.

**In CLAUDE.md** (concise):
```markdown
## Build & Dependencies
- Package manager: pnpm (not npm) - use `pnpm install`
```

**Learning** (verbose):
> When modifying API endpoints, must regenerate TypeScript client.
> Forgetting this causes type mismatches at runtime.

**In AGENTS.md** (actionable):
```markdown
## After API Changes
1. Regenerate client: `pnpm run generate:api`
2. Check for type errors: `pnpm tsc --noEmit`
```

## Recurring Pattern Detection

If logging something similar to an existing entry:

1. **Search first**: `grep -r "keyword" .learnings/`
2. **Link entries**: Add `**See Also**: ERR-20250110-001` in Metadata
3. **Bump priority** if issue keeps recurring
4. **Consider systemic fix**: Recurring issues often indicate:
   - Missing documentation (→ promote to CLAUDE.md or .github/copilot-instructions.md)
   - Missing automation (→ add to AGENTS.md)
   - Architectural problem (→ create tech debt ticket)

## Simplify & Harden Feed

Use this workflow to ingest recurring patterns from the `simplify-and-harden`
skill and turn them into durable prompt guidance.

### Ingestion Workflow

1. Read `simplify_and_harden.learning_loop.candidates` from the task summary.
2. For each candidate, use `pattern_key` as the stable dedupe key.
3. Search `.learnings/LEARNINGS.md` for an existing entry with that key:
   - `grep -n "Pattern-Key: <pattern_key>" .learnings/LEARNINGS.md`
4. If found:
   - Increment `Recurrence-Count`
   - Update `Last-Seen`
   - Add `See Also` links to related entries/tasks
5. If not found:
   - Create a new `LRN-...` entry
   - Set `Source: simplify-and-harden`
   - Set `Pattern-Key`, `Recurrence-Count: 1`, and `First-Seen`/`Last-Seen`

### Promotion Rule (System Prompt Feedback)

Promote recurring patterns into agent context/system prompt files when all are true:

- `Recurrence-Count >= 3`
- Seen across at least 2 distinct tasks
- Occurred within a 30-day window

Promotion targets:
- `CLAUDE.md`
- `AGENTS.md`
- `.github/copilot-instructions.md`
- `SOUL.md` / `TOOLS.md` for OpenClaw workspace-level guidance when applicable

Write promoted rules as short prevention rules (what to do before/while coding),
not long incident write-ups.

## Periodic Review

Review `.learnings/` at natural breakpoints:

### When to Review
- Before starting a new major task
- After completing a feature
- When working in an area with past learnings
- Weekly during active development

### Quick Status Check
```bash
# Count pending items
grep -h "Status\*\*: pending" .learnings/*.md | wc -l

# List pending high-priority items
grep -B5 "Priority\*\*: high" .learnings/*.md | grep "^## \["

# Find learnings for a specific area
grep -l "Area\*\*: backend" .learnings/*.md
```

### Review Actions
- Resolve fixed items
- Promote applicable learnings
- Link related entries
- Escalate recurring issues

## Detection Triggers

Automatically log when you notice:

**Corrections** (→ learning with `correction` category):
- "No, that's not right..."
- "Actually, it should be..."
- "You're wrong about..."
- "That's outdated..."

**Feature Requests** (→ feature request):
- "Can you also..."
- "I wish you could..."
- "Is there a way to..."
- "Why can't you..."

**Knowledge Gaps** (→ learning with `knowledge_gap` category):
- User provides information you didn't know
- Documentation you referenced is outdated
- API behavior differs from your understanding

**Errors** (→ error entry):
- Command returns non-zero exit code
- Exception or stack trace
- Unexpected output or behavior
- Timeout or connection failure

## Priority Guidelines

| Priority | When to Use |
|----------|-------------|
| `critical` | Blocks core functionality, data loss risk, security issue |
| `high` | Significant impact, affects common workflows, recurring issue |
| `medium` | Moderate impact, workaround exists |
| `low` | Minor inconvenience, edge case, nice-to-have |

## Area Tags

Use to filter learnings by codebase region:

| Area | Scope |
|------|-------|
| `frontend` | UI, components, client-side code |
| `backend` | API, services, server-side code |
| `infra` | CI/CD, deployment, Docker, cloud |
| `tests` | Test files, testing utilities, coverage |
| `docs` | Documentation, comments, READMEs |
| `config` | Configuration files, environment, settings |

## Best Practices

1. **Log immediately** - context is freshest right after the issue
2. **Be specific** - future agents need to understand quickly
3. **Include reproduction steps** - especially for errors
4. **Link related files** - makes fixes easier
5. **Suggest concrete fixes** - not just "investigate"
6. **Use consistent categories** - enables filtering
7. **Promote aggressively** - if in doubt, add to CLAUDE.md or .github/copilot-instructions.md
8. **Review regularly** - stale learnings lose value

## Gitignore Options

**Keep learnings local** (per-developer):
```gitignore
.learnings/
```

**Track learnings in repo** (team-wide):
Don't add to .gitignore - learnings become shared knowledge.

**Hybrid** (track templates, ignore entries):
```gitignore
.learnings/*.md
!.learnings/.gitkeep
```

## Hook Integration

Enable automatic reminders through agent hooks. This is **opt-in** - you must explicitly configure hooks.

### Quick Setup (Claude Code / Codex)

Create `.claude/settings.json` in your project:

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "./skills/self-improvement/scripts/activator.sh"
      }]
    }]
  }
}
```

This injects a learning evaluation reminder after each prompt (~50-100 tokens overhead).

### Full Setup (With Error Detection)

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "./skills/self-improvement/scripts/activator.sh"
      }]
    }],
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "./skills/self-improvement/scripts/error-detector.sh"
      }]
    }]
  }
}
```

### Available Hook Scripts

| Script | Hook Type | Purpose |
|--------|-----------|---------|
| `scripts/activator.sh` | UserPromptSubmit | Reminds to evaluate learnings after tasks |
| `scripts/error-detector.sh` | PostToolUse (Bash) | Triggers on command errors |

See `references/hooks-setup.md` for detailed configuration and troubleshooting.

## Automatic Skill Extraction

When a learning is valuable enough to become a reusable skill, extract it using the provided helper.

### Skill Extraction Criteria

A learning qualifies for skill extraction when ANY of these apply:

| Criterion | Description |
|-----------|-------------|
| **Recurring** | Has `See Also` links to 2+ similar issues |
| **Verified** | Status is `resolved` with working fix |
| **Non-obvious** | Required actual debugging/investigation to discover |
| **Broadly applicable** | Not project-specific; useful across codebases |
| **User-flagged** | User says "save this as a skill" or similar |

### Extraction Workflow

1. **Identify candidate**: Learning meets extraction criteria
2. **Run helper** (or create manually):
   ```bash
   ./skills/self-improvement/scripts/extract-skill.sh skill-name --dry-run
   ./skills/self-improvement/scripts/extract-skill.sh skill-name
   ```
3. **Customize SKILL.md**: Fill in template with learning content
4. **Update learning**: Set status to `promoted_to_skill`, add `Skill-Path`
5. **Verify**: Read skill in fresh session to ensure it's self-contained

### Manual Extraction

If you prefer manual creation:

1. Create `skills/<skill-name>/SKILL.md`
2. Use template from `assets/SKILL-TEMPLATE.md`
3. Follow [Agent Skills spec](https://agentskills.io/specification):
   - YAML frontmatter with `name` and `description`
   - Name must match folder name
   - No README.md inside skill folder

### Extraction Detection Triggers

Watch for these signals that a learning should become a skill:

**In conversation:**
- "Save this as a skill"
- "I keep running into this"
- "This would be useful for other projects"
- "Remember this pattern"

**In learning entries:**
- Multiple `See Also` links (recurring issue)
- High priority + resolved status
- Category: `best_practice` with broad applicability
- User feedback praising the solution

### Skill Quality Gates

Before extraction, verify:

- [ ] Solution is tested and working
- [ ] Description is clear without original context
- [ ] Code examples are self-contained
- [ ] No project-specific hardcoded values
- [ ] Follows skill naming conventions (lowercase, hyphens)

## Multi-Agent Support

This skill works across different AI coding agents with agent-specific activation.

### Claude Code

**Activation**: Hooks (UserPromptSubmit, PostToolUse)
**Setup**: `.claude/settings.json` with hook configuration
**Detection**: Automatic via hook scripts

### Codex CLI

**Activation**: Hooks (same pattern as Claude Code)
**Setup**: `.codex/settings.json` with hook configuration
**Detection**: Automatic via hook scripts

### GitHub Copilot

**Activation**: Manual (no hook support)
**Setup**: Add to `.github/copilot-instructions.md`:

```markdown
## Self-Improvement

After solving non-obvious issues, consider logging to `.learnings/`:
1. Use format from self-improvement skill
2. Link related entries with See Also
3. Promote high-value learnings to skills

Ask in chat: "Should I log this as a learning?"
```

**Detection**: Manual review at session end

### OpenClaw

**Activation**: Workspace injection + inter-agent messaging
**Setup**: See "OpenClaw Setup" section above
**Detection**: Via session tools and workspace files

### Agent-Agnostic Guidance

Regardless of agent, apply self-improvement when you:

1. **Discover something non-obvious** - solution wasn't immediate
2. **Correct yourself** - initial approach was wrong
3. **Learn project conventions** - discovered undocumented patterns
4. **Hit unexpected errors** - especially if diagnosis was difficult
5. **Find better approaches** - improved on your original solution

### Copilot Chat Integration

For Copilot users, add this to your prompts when relevant:

> After completing this task, evaluate if any learnings should be logged to `.learnings/` using the self-improvement skill format.

Or use quick prompts:
- "Log this to learnings"
- "Create a skill from this solution"
- "Check .learnings/ for related issues"

## ⚠️ Failure Modes & Troubleshooting

本章节记录学习记录系统的**典型失败场景**、**失败原因**和**具体修复方法**。

### 场景1：学习条目写入后，后续对话无法检索到该记录

**失败原因**：`.learnings/` 目录未被 OpenClaw 或 Agent 正确加载；或文件命名不符合规范（如使用了中文文件名）。

**判断标准**：
- 文件存在于 `.learnings/` 目录
- 但 `memory_search` 或 `grep` 均找不到相关内容
- hook 脚本执行时无报错但记录未生效

**修复流程**：
```bash
# 1. 检查 .learnings/ 目录位置
ls -la ~/.openclaw/workspace/.learnings/  # OpenClaw
ls -la ./.learnings/  # 项目根目录

# 2. 检查文件是否可读
cat .learnings/LEARNINGS.md | head -20

# 3. 确认文件名符合规范（纯英文，无空格）
# 如果有中文文件名，重命名
mv "学习笔记.md" LEARNINGS.md

# 4. 检查 OpenClaw 配置是否包含 .learnings/
# 查看 ~/.openclaw/config.yaml 或 workspace 配置
grep -r "learnings" ~/.openclaw/

# 5. 如果是路径问题，在正确位置创建链接
ln -sf /absolute/path/to/.learnings ~/.openclaw/workspace/.learnings
```

### 场景2：用户纠正后忘记记录，事后想补录但上下文已丢失

**失败原因**：未使用即时记录习惯；或在长对话的后期才想起需要补录，此时 AI 已无法准确回忆"哪个纠正对应哪个问题"。

**判断标准**：
- 用户说"上次我纠正过你 XXX，但现在你又犯了"
- 试图补录但无法准确描述当时的上下文

**修复流程**：
```bash
# 1. 先承认遗漏，不要虚构内容
# 在对话中明确说明："抱歉没有记录，让我根据现有理解补充"

# 2. 记录时使用模糊但诚实的描述
# 在 LEARNINGS.md 中添加：
cat >> .learnings/LEARNINGS.md << 'EOF'
## [LRN-$(date +%Y%m%d)-XXX] correction

**Logged**: $(date -Iseconds)
**Priority**: medium
**Status**: pending
**Area**: unknown

### Summary
用户曾纠正过 [根据残余记忆描述]

### Details
具体纠正内容已无法准确回忆。建议在后续对话中留意相关场景。

### Suggested Action
如果再次遇到类似场景，主动请求用户确认正确做法

### Metadata
- Source: user_feedback (retroactive - context lost)
- Note: "此条目为事后补录，可能不完整"
EOF

# 3. 在 hook 配置中添加更强的提醒
# 编辑 hooks/activator.sh，添加提醒：
echo 'echo "⚠️ 提醒：检查是否需要记录学习条目"' >> ~/.bashrc
```

### 场景3：错误日志写入 `.learnings/ERRORS.md` 但重复出现相同错误

**失败原因**：只记录了"错误是什么"，未记录"如何修复"；或修复方案已被遗忘，未promote到 CLAUDE.md/AGENTS.md。

**判断标准**：
- `ERRORS.md` 中出现相同错误 3 次以上
- 或同一 `See Also` 链接指向的条目越来越多

**修复流程**：
```bash
# 1. 搜索重复错误
grep -B3 "Summary" .learnings/ERRORS.md | grep -A3 "git push"

# 2. 如果确认是同一错误，检查是否有 Suggested Fix
# 编辑该条目，补充完整修复步骤

# 3. 检查是否需要 promote
# 如果该错误涉及特定命令或环境，执行：
# 在 CLAUDE.md 或 AGENTS.md 中添加预防规则

# 例如：如果 git push 需要先设置 remote
cat >> CLAUDE.md << 'EOF'
## Git 操作
- 首次 push 前必须检查 remote 是否配置：`git remote -v`
- 如果没有 remote，先添加：`git remote add origin <url>`
EOF

# 4. 更新 ERRORS.md 条目状态
sed -i 's/Status\*\*: pending/Status**: promoted/' .learnings/ERRORS.md
echo "### Resolution" >> .learnings/ERRORS.md
echo "- **Promoted**: CLAUDE.md" >> .learnings/ERRORS.md
```

### 场景4：promote 操作后，原条目状态未更新，导致维护混乱

**失败原因**：人工promote后忘记更新原条目的 `Status` 和 `Promoted` 字段，导致后续审查时仍将其视为"待处理"。

**判断标准**：
- CLAUDE.md 中已有某条规则
- 但 ERRORS.md/LEARNINGS.md 中相同主题的条目仍显示 `pending`

**修复流程**：
```bash
# 1. 搜索 CLAUDE.md 中的规则来源
grep -n "git.*push" CLAUDE.md

# 2. 找到对应行后，搜索 ERRORS.md 中的相关条目
grep -B10 "git push" .learnings/ERRORS.md | grep "^## \[ERR-"

# 3. 更新原条目状态
# 手动编辑或使用脚本：
sed -i '/^## \[ERR-.*git.*push\]$/,/^---$/{
  s/\*\*Status\*\*: pending/**Status**: promoted/
  /\*\*Promoted\*\*:/!a\**Promoted**: CLAUDE.md
}' .learnings/ERRORS.md

# 4. 添加 Resolution 说明
# 在该条目 Metadata 后添加：
# ### Resolution
# - **Promoted**: 2025-01-15T10:00:00Z
# - **To**: CLAUDE.md (Git 操作章节)
```

### 场景5：`.learnings/` 文件膨胀失控，超过 500 行

**失败原因**：所有条目都标记为 `pending` 且从不审查；或 promote 操作遗漏了过时条目。

**判断标准**：
- `wc -l .learnings/*.md` 显示文件超过 500 行
- `grep -c "Status\*\*: pending" .learnings/*.md` 显示大量待处理条目

**修复流程**：
```bash
# 1. 统计各类条目数量
echo "=== 统计 ===" && \
echo "LEARNINGS pending: $(grep -c 'Status\*\*: pending' .learnings/LEARNINGS.md)" && \
echo "ERRORS pending: $(grep -c 'Status\*\*: pending' .learnings/ERRORS.md)" && \
echo "LEARNINGS resolved: $(grep -c 'Status\*\*: resolved' .learnings/LEARNINGS.md)"

# 2. 批量审查 30 天以上的 pending 条目
find .learnings/ -name "*.md" -mtime +30 -exec grep -l "Status\*\*: pending" {} \;

# 3. 导出待审查条目到临时文件
grep -B2 "Status\*\*: pending" .learnings/LEARNINGS.md > /tmp/pending_review.txt

# 4. 批量更新策略：
# - 超过 60 天的 resolved 条目：考虑归档或删除
# - 超过 60 天的 pending 条目：主动 resolve 或 promote
```

### 场景6：hook 脚本执行失败，导致错误未被自动捕获

**失败原因**：hook 脚本没有执行权限；或环境变量配置缺失；或 agent 不支持该 hook 类型。

**判断标准**：
- `scripts/error-detector.sh` 执行时报错
- hook 配置正确但错误仍然发生

**修复流程**：
```bash
# 1. 测试 hook 脚本是否可执行
./scripts/error-detector.sh  # 如果报错 Permission denied
chmod +x scripts/error-detector.sh

# 2. 检查脚本依赖
head -20 scripts/error-detector.sh | grep "^#!"

# 3. 如果依赖 bash，检查系统 bash 路径
which bash
# 编辑脚本第一行：
# !/usr/bin/env bash  # 改用 env 查找

# 4. 测试输出是否正确
bash -c 'source scripts/error-detector.sh && echo "OK"'

# 5. 检查 JSON 配置格式
cat .claude/settings.json | python3 -m json.tool > /dev/null && echo "JSON OK"
```

### 场景7：使用 `sessions_send` 发送学习条目后，接收方无法解析

**失败原因**：发送的内容格式与接收方 skill 的预期格式不匹配；或消息过长被截断。

**判断标准**：
- 发送成功但接收方回复"无法理解"
- 或接收方忽略消息内容

**修复流程**：
```bash
# 1. 检查 sessions_send 的消息格式限制
# 消息应简洁，突出关键信息

# 2. 使用标准格式发送：
sessions_send --session-id <target_session_id> --message '
📚 学习记录同步

## 关键学习
- 项目使用 pnpm 而非 npm
- API 变更后需重新生成 client

## 来源
详见 .learnings/LEARNINGS.md [LRN-20250115-001]
'

# 3. 如果需要发送完整条目，使用文件引用而非内联
# 先导出到临时文件
grep -A30 "LRN-20250115-001" .learnings/LEARNINGS.md > /tmp/learning.txt
# 然后通过其他方式（git commit、文件同步）共享
```

## 🔒 Safety & High-Risk Operations

以下操作具有**不可逆性**或**高风险性**，执行前必须确认条件。

### 风险操作1：批量 promote 所有 pending 条目到 CLAUDE.md

**风险等级**：🔴 高风险

**为什么危险**：
- 大量条目同时写入会导致 CLAUDE.md 结构混乱
- 低质量/错误的条目会被固化，误导后续决策
- 无法准确定位是哪条条目导致的问题

**禁止行为**：
```bash
# 不要使用循环批量 promote
for entry in $(grep -l "Status: pending" .learnings/*.md); do
  cat "$entry" >> CLAUDE.md  # 危险！
done
```

**安全执行流程**：
```bash
# 1. 逐条审查，只 promote 高置信度条目
# 标准：高 priority + 具体 Suggested Action + 跨任务验证

# 2. 每次 promote 限制数量（最多 3 条）
grep -B5 "Priority\*\*: high" .learnings/LEARNINGS.md | grep "^## \[LRN-"

# 3. 在 CLAUDE.md 中使用明确分组
# 如：
# ## 🚨 高优先级规则（来自学习记录）
# ## 📝 中优先级规则
```

### 风险操作2：删除 `.learnings/` 中的 resolved 条目

**风险等级**：🟠 中高风险

**为什么危险**：
- resolved 条目仍包含上下文信息，对调试有价值
- 如果其他条目有 `See Also` 链接指向它，会产生悬空引用
- 无法追踪"这个问题最终是怎么解决的"

**禁止行为**：
```bash
# 不要直接删除所有 resolved 条目
sed -i '/Status\*\*: resolved/,/^---$/d' .learnings/LEARNINGS.md
```

**安全替代方案**：
```bash
# 1. 先检查是否有悬空引用
grep "See Also: LRN" .learnings/*.md | cut -d: -f2 | while read ref; do
  grep -q "## \[$ref\]" .learnings/LEARNINGS.md || echo "悬空引用: $ref"
done

# 2. 只归档旧条目，不删除
mkdir -p .learnings/archive/
mv .learnings/LEARNINGS.md .learnings/archive/LEARNINGS-$(date +%Y%m).md

# 3. 创建新文件，保留必要模板
cat > .learnings/LEARNINGS.md << 'EOF'
# Learnings Archive

> 历史记录已归档至 `.learnings/archive/` 目录

---
EOF
```

### 风险操作3：在 `SOUL.md` 中写入行为准则后永久生效

**风险等级**：🟠 中高风险

**为什么危险**：
- `SOUL.md` 影响 agent 的核心行为模式
- 一旦写入，可能导致 agent 在某些场景下表现过于死板
- 难以回滚到"没有这条规则"的状态

**禁止行为**：
```markdown
# 不要写入绝对化规则
## SOUL.md
- 永远不要使用 npm（应使用 pnpm）
- 所有 API 调用必须包含重试逻辑
```

**安全替代方案**：
```markdown
# SOUL.md 中使用建议性语言
## 构建工具
- 项目倾向于 pnpm，如果遇到特定场景不支持，可评估 npm 兼容性

## 错误处理
- 建议在关键 API 调用中加入重试逻辑
- 但应根据具体场景判断是否必要
```

### 风险操作4：自动提取学习条目为 skill 时未验证就发布

**风险等级**：🔴 高风险

**为什么危险**：
- 从单个错误场景提取的 skill 可能不完整
- 错误的 skill 被其他 agent 使用会导致连锁故障
- 一旦发布到共享目录，影响范围不可控

**禁止行为**：
```bash
# 不要在未测试的情况下直接发布
./scripts/extract-skill.sh buggy-fix
cd skills/buggy-fix && git add . && git commit -m "Add skill" && git push
```

**安全执行流程**：
```bash
# 1. 使用 --dry-run 验证
./scripts/extract-skill.sh buggy-fix --dry-run

# 2. 在隔离环境测试
# 复制 skill 到测试 workspace
cp -r skills/buggy-fix /tmp/test-workspace/skills/

# 3. 手动执行 skill 验证输出
# 确保 skill 在独立运行时不依赖原始上下文

# 4. 添加测试用例（如果有）
# 创建 skills/buggy-fix/test_skill.py

# 5. 代码审查
# 让人类同事 review skill 内容

# 6. 确认无问题后再发布
./scripts/extract-skill.sh buggy-fix
```
