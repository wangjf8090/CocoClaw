#!/bin/sh

echo "🚀 Starting SelfClaw Market Research Service..."

cd /app/packages/market-research

# 立即执行一次调研
echo "📊 Running initial research..."
node src/researcher.js

echo "✅ Market Research service started!"
echo "⏰ Scheduled to run daily at 9:00 AM"

# 保持容器运行
tail -f /dev/null
