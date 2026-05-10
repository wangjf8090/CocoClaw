/**
 * SelfClaw Feishu Bot - 独立运行版
 * 
 * 功能：
 * 1. ✅ 发送消息
 * 2. ✅ 提供Webhook端点接收飞书事件
 * 3. ✅ 处理消息并自动回复
 * 
 * 用法：node standalone-bot.js
 * 然后在飞书开放平台配置 Webhook: http://你的IP:9999/webhook
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');

// ============ 配置 ============
const CONFIG = {
  port: process.env.PORT || 9999,
  appId: process.env.FEISHU_APP_ID || 'cli_a964a06697f8dbca',
  appSecret: process.env.FEISHU_APP_SECRET || '7LPnyPRF9o9pMBQnrLjT7cj2D44joZeB',
  botOpenId: 'ou_f61a856739c7c8de99529cac0c249960',
  webhookSecret: process.env.FEISHU_WEBHOOK_SECRET || 'acd0cca004133e3353bb9db9c094c65d',
};

let tenantToken = null;
let tokenExpireTime = 0;

// ============ Token 管理 ============
async function refreshTenantToken() {
  const now = Date.now();
  if (tenantToken && now < tokenExpireTime - 300000) {
    return tenantToken;
  }

  return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        app_id: CONFIG.appId,
        app_secret: CONFIG.appSecret
      });

      const options = {
        hostname: 'open.feishu.cn',
        port: 443,
        path: '/open-apis/auth/v3/tenant_access_token/internal',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            if (result.code === 0) {
              tenantToken = result.tenant_access_token;
              tokenExpireTime = now + result.expire * 1000;
              resolve(tenantToken);
            } else {
              console.error('获取Token失败:', result.msg);
              reject(new Error(result.msg));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
}

// ============ 发送消息 ============
async function sendMessage(receiveId, content, type = 'chat_id') {
  const token = await refreshTenantToken();
  
  return new Promise((resolve, reject) => {
    const msgContent = JSON.stringify({ text: content });
    const data = JSON.stringify({
      receive_id: receiveId,
      msg_type: 'text',
      content: msgContent
    });

    const options = {
      hostname: 'open.feishu.cn',
      port: 443,
      path: `/open-apis/im/v1/messages?receive_id_type=${type}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ============ 处理消息 ============
async function handleMessage(event) {
  if (!event || !event.message) return;

  const message = event.message;
  const chatId = message.chat_id;
  const chatType = message.chat_type;
  const content = JSON.parse(message.content || '{}');
  const text = content.text || '';
  const senderName = event.sender?.sender_id?.open_id || 'unknown';

  console.log(`[${new Date().toLocaleTimeString()}] ${chatType} - ${senderName}: ${text.substring(0, 50)}`);

  const isMentioned = message.mentions && message.mentions.some(m => m.id === CONFIG.botOpenId);
  const cleanText = text.replace(/@_self/g, '').replace(/@所有/g, '').trim();

  if (chatType === 'group' && !isMentioned) {
    console.log('  └─ 群聊未@机器人，忽略');
    return;
  }

  let replyText = '';

  if (cleanText.startsWith('/help') || cleanText === '帮助') {
    replyText = `🤖 你好！我是SelfClaw AI Agent "扣扣"

可用命令：
/help / 帮助 - 显示此帮助
/status / 状态 - 显示系统状态

直接提问即可获得AI回答！`;
  } 
  else if (cleanText.startsWith('/status') || cleanText === '状态') {
    replyText = `✅ SelfClaw 运行状态

服务：独立飞书Bot服务
模式：Webhook + 原生API
状态：正常运行
时间：${new Date().toLocaleString()}`;
  }
  else if (cleanText) {
    replyText = `🤖 收到你的消息啦！

"${cleanText}"

这是自动回复，完整AI引擎正在集成中...

当前支持的命令：
/help - 帮助
/status - 状态`;
  }

  if (replyText) {
    const result = await sendMessage(chatId, replyText);
    if (result.code === 0) {
      console.log(`  └─ ✅ 已回复');
    } else {
      console.log(`  └─ ❌ 回复失败:`, result.msg);
    }
  }
}

// ============ Webhook 服务器 ============
function verifySignature(body, signature, timestamp, nonce) {
  const stringToSign = `${timestamp}\n${nonce}\n${CONFIG.webhookSecret}\n${body}\n`;
  const hash = crypto.createHash('sha256').update(stringToSign).digest('hex');
  return hash === signature;
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const signature = req.headers['x-lark-signature'] || req.headers['x-feishu-signature'];
        const timestamp = req.headers['x-lark-request-timestamp'] || req.headers['x-feishu-request-timestamp'];
        const nonce = req.headers['x-lark-nonce'] || req.headers['x-feishu-nonce'];

        const event = JSON.parse(body);

        // URL 验证请求
        if (event.type === 'url_verification') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ challenge: event.challenge }));
          console.log('[Webhook] URL 验证成功');
          return;
        }

        // 消息事件
        if (event.header && event.header.event_type === 'im.message.receive_v1') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 0, message: 'success' }));
          
          handleMessage(event.event).catch(err => {
            console.error('处理消息失败:', err.message);
          });
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 0 }));

      } catch (error) {
        console.error('Webhook 处理错误:', error.message);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'SelfClaw Feishu Bot',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// ============ 启动！ ============
async function start() {
  await refreshTenantToken();
  
  console.log('='.repeat(60));
  console.log('SelfClaw Feishu Bot - 独立服务版');
  console.log('='.repeat(60));
  console.log(`Bot: 扣扣 (${CONFIG.appId})`);
  console.log(`Webhook地址: http://0.0.0.0:${CONFIG.port}/webhook`);
  console.log(`健康检查: http://0.0.0.0:${CONFIG.port}/health`);
  console.log('');
  console.log('📋 下一步操作:');
  console.log('1. 确保云主机安全组/防火墙开放端口:', CONFIG.port);
  console.log('2. 登录飞书开放平台 -> 事件订阅');
  console.log('3. 配置请求地址: http://<你的公网IP>:${CONFIG.port}/webhook');
  console.log('4. 启用 im.message.receive_v1 事件');
  console.log('');
  console.log('🚀 Bot 已启动，等待消息...');
  console.log('');

  server.listen(CONFIG.port, '0.0.0.0');
}

start().catch(err => {
  console.error('启动失败:', err.message);
  process.exit(1);
});
