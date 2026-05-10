#!/usr/bin/env node
const https = require('https');
const readline = require('readline');

const CONFIG = {
  appId: 'cli_a964a06697f8dbca',
  appSecret: '7LPnyPRF9o9pMBQnrLjT7cj2D44joZeB',
  botOpenId: 'ou_f61a856739c7c8de99529cac0c249960',
};

let tenantToken = null;
let tokenExpireTime = 0;

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

async function handleEvent(event) {
  if (!event || !event.header) return;
  
  if (event.header.event_type === 'im.message.receive_v1') {
    const message = event.event.message;
    const chatId = message.chat_id;
    const chatType = message.chat_type;
    const content = JSON.parse(message.content || '{}');
    const text = content.text || '';

    const isMentioned = message.mentions && message.mentions.some(m => m.id === CONFIG.botOpenId);
    const cleanText = text.replace(/@_self/g, '').replace(/@所有/g, '').trim();

    if (chatType === 'group' && !isMentioned) return;

    console.log(`[${new Date().toLocaleTimeString()}] ${chatType}: ${cleanText.substring(0, 50)}`);

    let replyText = '';
    
    if (cleanText.startsWith('/help') || cleanText === '帮助') {
      replyText = `🤖 你好！我是扣扣

可用命令：
/help / 帮助 - 显示此帮助
/status / 状态 - 显示系统状态

直接提问即可获得AI回答！`;
    } else if (cleanText.startsWith('/status') || cleanText === '状态') {
      replyText = `✅ SelfClaw 运行状态

服务：Feishu Bot 长连接监听
模式：lark-cli + 处理器脚本
状态：正常运行
时间：${new Date().toLocaleString()}`;
    } else if (cleanText) {
      replyText = `🤖 收到！

"${cleanText}"

这是自动回复，完整AI引擎正在集成中...

可用命令：
/help - 帮助
/status - 状态`;
    }

    if (replyText) {
      const result = await sendMessage(chatId, replyText);
      console.log(`  └─ 回复: ${result.code === 0 ? '✅' : '❌'}`);
    }
  }
}

console.log('='.repeat(50));
console.log('SelfClaw Feishu Bot 事件处理器启动');
console.log('='.repeat(50));
console.log('等待事件...');
console.log('');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  try {
    const event = JSON.parse(line);
    handleEvent(event).catch(err => {
      console.error('处理事件失败:', err.message);
    });
  } catch (e) {
  }
});
