#!/usr/bin/env python3
"""
用lark-cli长连接模式处理飞书消息
lark-cli event +subscribe -> 这个脚本 -> 处理并回复
"""

import sys
import json
import time
import requests

CONFIG = {
    'app_id': 'cli_a964a06697f8dbca',
    'app_secret': '7LPnyPRF9o9pMBQnrLjT7cj2D44joZeB',
    'bot_open_id': 'ou_f61a856739c7c8de99529cac0c249960',
}

tenant_token = None
token_expire_time = 0

def refresh_tenant_token():
    global tenant_token, token_expire_time
    now = time.time()
    if tenant_token and now < token_expire_time - 300:
        return tenant_token
    
    url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal'
    data = {'app_id': CONFIG['app_id'], 'app_secret': CONFIG['app_secret']}
    resp = requests.post(url, json=data)
    result = resp.json()
    if result.get('code') == 0:
        tenant_token = result['tenant_access_token']
        token_expire_time = now + result['expire']
        return tenant_token
    return None

def send_message(receive_id, content, receive_type='chat_id'):
    token = refresh_tenant_token()
    if not token:
        return None
    
    url = f'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type={receive_type}'
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }
    data = {
        'receive_id': receive_id,
        'msg_type': 'text',
        'content': json.dumps({'text': content}),
    }
    resp = requests.post(url, headers=headers, json=data)
    return resp.json()

def handle_event(event):
    try:
        if not event or 'header' not in event:
            return
        
        if event['header'].get('event_type') == 'im.message.receive_v1':
            event_data = event.get('event', {})
            message = event_data.get('message', {})
            chat_id = message.get('chat_id')
            chat_type = message.get('chat_type')
            content = json.loads(message.get('content', '{}'))
            text = content.get('text', '')
            sender = event_data.get('sender', {})
            sender_id = sender.get('sender_id', {}).get('open_id', 'unknown')

            print(f'[{time.strftime("%H:%M:%S")}] {chat_type} - {sender_id}: {text[:50]}')

            # 检查是否@了机器人
            is_mentioned = False
            mentions = message.get('mentions', [])
            for m in mentions:
                if m.get('id') == CONFIG['bot_open_id']:
                    is_mentioned = True
                    break
            
            clean_text = text.replace('@_self', '').replace('@所有', '').strip()

            if chat_type == 'group' and not is_mentioned:
                print('  └─ 群聊未@机器人，忽略')
                return

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
模式：lark-cli长连接模式
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
                if result and result.get('code') == 0:
                    print(f'  └─ ✅ 已回复')
                else:
                    print(f'  └─ ❌ 回复失败: {result.get("msg", "未知错误")}')

    except Exception as e:
        print(f'处理事件异常: {e}')

def main():
    refresh_tenant_token()
    print('=' * 60)
    print('SelfClaw Feishu Bot - lark-cli长连接模式')
    print('=' * 60)
    print(f'Bot: 扣扣 ({CONFIG["app_id"]})')
    print(f'模式: lark-cli event +subscribe 长连接')
    print()
    print('📋 优势:')
    print('  ✅ 无需公网IP')
    print('  ✅ 无需配置Webhook')
    print('  ✅ 无需开放端口')
    print('  ✅ 飞书官方工具，稳定可靠')
    print()
    print('🚀 等待长连接事件...')
    print()
    print('提示：去飞书 @扣扣 发消息测试！')
    print()

    # 从stdin读取lark-cli输出的JSON事件
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        
        # 跳过非JSON行（lark-cli的日志）
        if not line.startswith('{'):
            continue
        
        try:
            event = json.loads(line)
            handle_event(event)
        except json.JSONDecodeError:
            continue

if __name__ == '__main__':
    main()
