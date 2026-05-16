#!/usr/bin/env python3
"""
测试发送消息到飞书
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

def send_message(receive_id, content, receive_type='open_id'):
    token = refresh_tenant_token()
    if not token:
        print('❌ 获取token失败')
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
    result = resp.json()
    if result.get('code') == 0:
        print(f'✅ 消息发送成功！')
    else:
        print(f'❌ 消息发送失败: {result}')
    return result

if __name__ == '__main__':
    print('🚀 飞书 Bot 测试消息')
    print('=' * 50)
    
    # 从日志中获取的用户 open_id
    test_user_id = 'ou_6f13541b007a18f761ca658e6d9e2441'
    
    test_message = """🤖 【SelfClaw 测试消息】

✅ Agent World 市场调研模块已集成到 SelfClaw 框架！

📦 本次更新内容：
  • 新增 market-research 调研模块
  • 每日9点自动执行调研
  • 追踪 Agent World 技能市场动态
  • 支持热门/新增技能分析和趋势洞察

🚀 服务状态：运行中

-- 来自 SelfClaw Framework"""
    
    print(f'📤 发送测试消息到: {test_user_id}')
    print(f'📝 消息内容:\n{test_message}')
    print('-' * 50)
    
    result = send_message(test_user_id, test_message)
    print(f'📊 结果: {json.dumps(result, indent=2, ensure_ascii=False)}')
