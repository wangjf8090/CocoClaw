#!/usr/bin/env python3
"""
SelfClaw Feishu Bot - 长连接模式
无需公网IP，无需Webhook，直接通过官方SDK长连接接收消息
"""

import os
import json
import time
import lark

# ============ 配置 ============
CONFIG = {
    'app_id': 'cli_a964a06697f8dbca',
    'app_secret': '7LPnyPRF9o9pMBQnrLjT7cj2D44joZeB',
    'bot_open_id': 'ou_f61a856739c7c8de99529cac0c249960',
}

client = lark.Client(app_id=CONFIG['app_id'], app_secret=CONFIG['app_secret'])

# ============ 发送消息 ============
def send_message(receive_id, content, receive_type='chat_id'):
    try:
        resp = client.im.message.create(
            receive_id_type=receive_type,
            msg_type='text',
            content=json.dumps({'text': content}),
            receive_id=receive_id,
        )
        return resp
    except Exception as e:
        print(f'发送消息失败: {e}')
        return None

# ============ 消息处理 ============
def handle_message(event):
    try:
        message = event.message
        chat_id = message.chat_id
        chat_type = message.chat_type
        content = json.loads(message.content or '{}')
        text = content.get('text', '')
        sender_id = event.sender.sender_id.open_id if event.sender else 'unknown'

        print(f'[{time.strftime("%H:%M:%S")}] {chat_type} - {sender_id}: {text[:50]}')

        # 检查是否@了机器人
        is_mentioned = False
        if message.mentions:
            for m in message.mentions:
                if m.id == CONFIG['bot_open_id']:
                    is_mentioned = True
                    break
        
        clean_text = text.replace('@_self', '').replace('@所有', '').strip()

        # 群聊但没@机器人，忽略
        if chat_type == 'group' and not is_mentioned:
            print('  └─ 群聊未@机器人，忽略')
            return

        # 处理命令
        reply_text = ''
        
        if clean_text.startswith('/help') or clean_text == '帮助':
            reply_text = """🤖 你好！我是SelfClaw AI Agent "扣扣"

可用命令：
/help / 帮助 - 显示此帮助
/status / 状态 - 显示系统状态

直接提问即可获得AI回答！"""
        elif clean_text.startswith('/status') or clean_text == '状态':
            reply_text = f"""✅ SelfClaw 运行状态

服务：独立飞书Bot服务
模式：官方SDK长连接模式
状态：正常运行
时间：{time.strftime('%Y-%m-%d %H:%M:%S')}"""
        elif clean_text:
            reply_text = f"""🤖 收到你的消息啦！

"{clean_text}"

这是自动回复，完整AI引擎正在集成中...

当前支持的命令：
/help - 帮助
/status - 状态"""

        if reply_text:
            result = send_message(chat_id, reply_text)
            if result and hasattr(result, 'code') and result.code == 0:
                print(f'  └─ ✅ 已回复')
            else:
                print(f'  └─ ❌ 回复失败')

    except Exception as e:
        print(f'处理消息异常: {e}')

# ============ 长连接事件处理器 ============
class FeishuEventHandler:
    @staticmethod
    def on_message_receive_v1(event_data):
        handle_message(event_data)

# ============ 启动长连接 ============
def main():
    print('=' * 60)
    print('SelfClaw Feishu Bot - 长连接模式')
    print('=' * 60)
    print(f'Bot: 扣扣 ({CONFIG["app_id"]})')
    print(f'模式: 官方SDK长连接 (无需Webhook，无需公网IP)')
    print()
    print('📋 优势:')
    print('  ✅ 无需公网IP')
    print('  ✅ 无需配置Webhook')
    print('  ✅ 无需开放端口')
    print('  ✅ 自动重连')
    print()
    print('🚀 正在启动长连接...')
    print()

    # 创建事件处理器
    handler = lark.EventDispatcherHandler.builder(
        CONFIG['app_id'], 
        CONFIG['app_secret'],
        encrypt_key=None  # 长连接模式不需要加密
    ).build()

    # 注册消息接收事件
    handler.register(lark.EventType.IM_MESSAGE_RECEIVE_V1, FeishuEventHandler.on_message_receive_v1)

    # 启动长连接
    ws_client = lark.WebSocketClient(
        app_id=CONFIG['app_id'],
        app_secret=CONFIG['app_secret'],
        event_handler=handler,
    )

    ws_client.start()
    print('长连接已建立，等待消息...')
    print()
    print('提示：去飞书 @扣扣 发消息测试！')
    print()

    # 保持运行
    try:
        while True:
            time.sleep(30)
    except KeyboardInterrupt:
        print('\n正在停止Bot...')
        ws_client.stop()

if __name__ == '__main__':
    main()
