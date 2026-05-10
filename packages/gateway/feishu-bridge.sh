#!/bin/bash
# Feishu事件桥接器：把lark-cli收到的事件POST到Gateway webhook

GATEWAY_URL="http://localhost:8080/api/v1/feishu/webhook"

echo "Feishu事件桥接器启动"
echo "转发到: $GATEWAY_URL"
echo ""

lark-cli event +subscribe --event-types im.message.receive_v1 | while read -r line; do
  if echo "$line" | grep -q '^{'; then
    echo "收到事件，转发到Gateway..."
    curl -s -X POST "$GATEWAY_URL" \
      -H "Content-Type: application/json" \
      -d "$line" > /dev/null 2>&1 && echo "✅ 已转发" || echo "❌ 转发失败"
  fi
done
