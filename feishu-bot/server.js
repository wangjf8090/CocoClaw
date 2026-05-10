/**
 * SelfClaw Feishu Bot - 独立长连接消息监听服务
 * 专门处理 "扣扣" 机器人的消息
 */

const https = require('https');
const WebSocket = require('ws');

// ============ 配置 ============
const CONFIG = {
  appId: process.env.FEISHU_APP_ID || 'cli_a964a06697f8dbca',
  appSecret: process.env.FEISHU_APP_SECRET || '7LPnyPRF9o9pMBQnrLjT7cj2D44joZeB',
  botOpenId: 'ou_f61a856739c7c8de99529cac0c249960', // 扣扣的OpenID
};

let tenantToken = null;
let tokenExpireTime = 0;

// ============ Token 管理 ============
async function refreshTenantToken() {
  const now = Date.now();
  if (tenantToken && now < tokenExpireTime - 5 * 60 * 1000) {
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

// ============ 消息处理 ============
async function handleMessage(event) {
  const header = event.header;
  const eventData = event.event;

  if (!eventData || !eventData.message) {
    return;
  }

  const message = eventData.message;
  const chatId = message.chat_id;
  const chatType = message.chat_type;
  const content = JSON.parse(message.content || '{}');
  const text = content.text || '';
  const sender = eventData.sender;
  const senderName = sender && sender.sender_id ? sender.sender_id.open_id : 'unknown';

  console.log(`[${new Date().toLocaleTimeString()}] 收到消息 [${chatType}] ${senderName}: ${text.substring(0, 60)}`);

  // 检查是否@了机器人
  const isMentioned = message.mentions && message.mentions.some(m => m.id === CONFIG.botOpenId);
  const cleanText = text.replace(/@_self/g, '').replace(/@所有/g, '').trim();

  // 群聊但没有@机器人，忽略
  if (chatType === 'group' && !isMentioned) {
    console.log('  └─ 群聊未@机器人，忽略');
    return;
  }

  // 处理命令
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

服务：Feishu Bot 长连接监听
模式：原生API + WebSocket
状态：正常运行
监听：持续运行中
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
      console.log(`  └─ ✅ 已回复`);
    } else {
      console.log(`  └─ ❌ 回复失败:`, result.msg);
    }
  }
}

// ============ WebSocket 长连接监听 ============
async function startWebSocket() {
  await refreshTenantToken();
  console.log('='.repeat(60));
  console.log('SelfClaw Feishu Bot - 长连接消息监听服务');
  console.log('='.repeat(60));
  console.log(`Bot: 扣扣 (${CONFIG.appId})`);
  console.log(`启动时间: ${new Date().toLocaleString()}`);
  console.log('');
  console.log('正在建立 WebSocket 长连接...');

  // 获取 WebSocket 连接地址
  const wsUrl = await getWebSocketUrl();
  console.log(`WebSocket地址: ${wsUrl.substring(0, 50)}...`);

  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log('✅ WebSocket 连接成功！');
    console.log('开始监听消息事件...');
    console.log('');
    console.log('提示：去飞书 @扣扣 或私聊发消息测试！');
    console.log('');
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // 处理消息事件
      if (message.header && message.header.event_type === 'im.message.receive_v1') {
        handleMessage(message).catch(err => {
          console.error('处理消息失败:', err.message);
        });
      }
      // 心跳响应
      else if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (e) {
      // 忽略解析错误
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket 错误:', error.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`⚠️  WebSocket 断开: ${code} - ${reason}`);
    console.log('5秒后自动重连...');
    setTimeout(startWebSocket, 5000);
  });
}

// 获取 WebSocket 连接地址（简化版，实际需要调用飞书API获取）
async function getWebSocketUrl() {
  // 实际应该调用飞书API获取WebSocket地址
  // 这里先用占位符，实际需要用lark-cli的方式
  return 'wss://msg-frontier.feishu.cn/ws/v2';
}

// ============ 启动！ ============
async function main() {
  try {
    await startWebSocket();
  } catch (error) {
    console.error('启动失败:', error.message);
    process.exit(1);
  }
}

main();
