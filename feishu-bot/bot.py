#!/usr/bin/env python3
import os
import json
import time
import hmac
import hashlib
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler

CONFIG = {
    'port': 9999,
    'app_id': 'cli_a964a06697f8dbca',
    'app_secret': '7LPnyPRF9o9pMBQnrLjT7cj2D44joZeB',
    'bot_open_id': 'ou_f61a856739c7c8de99529cac0c249960',
    'webhook_secret': 'acd0cca004133e3353bb9db9c094c65d',
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
        print(f'✅ Token刷新成功，有效期: {result["expire"]}秒')
        return tenant_token
    else:
        print(f'❌ Token刷新失败: {result.get("msg")}')
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

def handle_message(event):
    message = event.get('message', {})
    chat_id = message.get('chat_id')
    chat_type = message.get('chat_type')
    content = json.loads(message.get('content', '{}'))
    text = content.get('text', '')
    sender = event.get('sender', {})
    sender_id = sender.get('sender_id', {}).get('open_id', 'unknown')

    print(f'[{time.strftime("%H:%M:%S")}] {chat_type} - {sender_id}: {text[:50]}')

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
模式：Webhook + 原生API
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

class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/webhook':
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length).decode('utf-8')
            
            try:
                event = json.loads(body)
                
                if event.get('type') == 'url_verification':
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'challenge': event.get('challenge')}).encode())
                    print('[Webhook] ✅ URL验证成功')
                    return

                if event.get('header', {}).get('event_type') == 'im.message.receive_v1':
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'code': 0, 'message': 'success'}).encode())
                    
                    try:
                        handle_message(event.get('event', {}))
                    except Exception as e:
                        print(f'处理消息异常: {e}')
                    return

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'code': 0}).encode())

            except Exception as e:
                print(f'Webhook处理错误: {e}')
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b'Internal Server Error')
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')

    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'healthy',
                'service': 'SelfClaw Feishu Bot',
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ')
            }).encode())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')

    def log_message(self, format, *args):
        pass

def main():
    refresh_tenant_token()
    
    print('=' * 60)
    print('SelfClaw Feishu Bot - 独立服务版')
    print('=' * 60)
    print(f'Bot: 扣扣 ({CONFIG["app_id"]})')
    print(f'Webhook地址: http://0.0.0.0:{CONFIG["port"]}/webhook')
    print(f'健康检查: http://0.0.0.0:{CONFIG["port"]}/health')
    print()
    print('📋 下一步操作:')
    print('1. 确保云主机安全组/防火墙开放端口:', CONFIG['port'])
    print('2. 登录飞书开放平台 -> 你的应用 -> 事件订阅')
    print(f'3. 请求地址: http://<你的公网IP>:{CONFIG["port"]}/webhook')
    print(f'4. Encrypt Key: {CONFIG["webhook_secret"]}')
    print('5. 添加事件: im.message.receive_v1 (接收消息)')
    print()
    print('🚀 Bot 已启动，等待消息...')
    print()

    server = HTTPServer(('0.0.0.0', CONFIG['port']), WebhookHandler)
    server.serve_forever()

if __name__ == '__main__':
    main()
