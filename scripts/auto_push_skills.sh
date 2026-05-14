#!/bin/bash
#
# SelfClaw 技能自动推送脚本
# 在每日技能探索任务完成后自动提交和推送到 GitHub
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "=== SelfClaw 技能自动推送 ==="
echo "时间: $(date)"
echo ""

# 检查是否有变更
if git diff --quiet && git diff --cached --quiet; then
    echo "✅ 没有发现文件变更，无需提交"
    exit 0
fi

echo "📝 发现变更，准备提交..."

# 添加所有变更
git add .

# 获取新增的技能数量
NEW_SKILLS=$(git status --porcelain | grep "packages/skills/" | grep "^A" | wc -l)
UPDATED_SKILLS=$(git status --porcelain | grep "packages/skills/" | grep "^M" | wc -l)

# 提交信息
COMMIT_MSG="auto: 每日技能自动更新

- 新增技能: ${NEW_SKILLS} 个
- 更新技能: ${UPDATED_SKILLS} 个
- 更新 SKILLS_INDEX.md 索引
- 更新 DEVELOPMENT_PROGRESS.md 进度

自动提交时间: $(date '+%Y-%m-%d %H:%M:%S')"

# 提交
git commit -m "$COMMIT_MSG"

echo "✅ 提交成功"
echo ""

# 推送到 GitHub
echo "🚀 推送到 GitHub..."
GIT_SSH_COMMAND="ssh -i ~/.ssh/selfclaw_deploy_key" git push origin main

echo ""
echo "🎉 推送完成！"
echo "时间: $(date)"
