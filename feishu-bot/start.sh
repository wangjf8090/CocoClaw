#!/bin/bash
cd "$(dirname "$0")"
echo "========================================"
echo "SelfClaw Feishu Bot 长连接监听服务"
echo "========================================"
echo ""
echo "启动事件监听管道..."
echo "提示：去飞书 @扣扣 发消息测试！"
echo ""

lark-cli event +subscribe --event-types im.message.receive_v1 | node handler.js
