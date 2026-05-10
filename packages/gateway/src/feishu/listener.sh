#!/bin/bash
# Feishu 事件监听器 - 通过 lark-cli WebSocket 订阅消息事件

echo "========================================"
echo "SelfClaw Feishu 事件监听器"
echo "========================================"
echo "启动时间: $(date)"
echo ""

# 监听消息事件
echo "开始订阅 im.message.receive_v1 事件..."
echo "按 Ctrl+C 停止监听"
echo ""

lark-cli event +subscribe \
  --types im.message.receive_v1 \
  --format pretty

