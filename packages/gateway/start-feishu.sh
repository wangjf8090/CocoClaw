#!/bin/bash
cd /app

# 设置环境变量
export FEISHU_ENABLED=true
export FEISHU_AUTH_MODE=native
export FEISHU_APP_ID=cli_a964a06697f8dbca
export FEISHU_APP_SECRET=7LPnyPRF9o9pMBQnrLjT7cj2D44joZeB
export FEISHU_WEBHOOK_SECRET=acd0cca004133e3353bb9db9c094c65d

echo "========================================"
echo "SelfClaw Feishu Bot 长连接监听服务"
echo "========================================"
echo "启动时间: $(date)"
echo ""

# 启动监听
node src/feishu/longpoll.js
