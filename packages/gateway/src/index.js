const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const WS_PORT = process.env.WS_PORT || 9001;

// ==================== Feishu Integration (Dual Mode) ====================
const FEISHU_ENABLED = process.env.FEISHU_ENABLED === 'true';
const FEISHU_AUTH_MODE = process.env.FEISHU_AUTH_MODE || 'native';
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_WEBHOOK_SECRET = process.env.FEISHU_WEBHOOK_SECRET;
const FEISHU_CLI_PATH = process.env.FEISHU_CLI_PATH || 'lark-cli';

let feishuSender = null;
let tenantAccessToken = null;
let tokenExpireTime = 0;

async function refreshTenantAccessToken() {
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) return null;
  
  const now = Date.now();
  if (tenantAccessToken && now < tokenExpireTime - 5 * 60 * 1000) {
    return tenantAccessToken;
  }
  
  try {
    const https = require('https');
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET
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
              tenantAccessToken = result.tenant_access_token;
              tokenExpireTime = now + result.expire * 1000;
              console.log('[Feishu] Tenant access token refreshed, expires in', result.expire, 's');
              resolve(tenantAccessToken);
            } else {
              console.error('[Feishu] Token refresh failed:', result.msg);
              resolve(null);
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
  } catch (error) {
    console.error('[Feishu] Token refresh error:', error.message);
    return null;
  }
}

async function sendFeishuMessage(receiveId, content, msgType = 'text', receiveIdType = 'chat_id') {
  if (FEISHU_AUTH_MODE === 'native') {
    const token = await refreshTenantAccessToken();
    if (!token) throw new Error('No tenant access token');
    
    const https = require('https');
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        receive_id: receiveId,
        msg_type: msgType,
        content: typeof content === 'string' ? content : JSON.stringify(content)
      });
      
      const options = {
        hostname: 'open.feishu.cn',
        port: 443,
        path: `/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`,
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
            const result = JSON.parse(body);
            if (result.code === 0) {
              resolve({ success: true, messageId: result.data.message_id, data: result.data });
            } else {
              console.error('[Feishu] Send message failed:', result.msg);
              resolve({ success: false, error: result.msg });
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
  } else {
    const { execSync } = require('child_process');
    const command = `${FEISHU_CLI_PATH} im +messages-send --params '{"receive_id":"${receiveId}","msg_type":"${msgType}"}' --data '{"content":${JSON.stringify(typeof content === 'string' ? content : JSON.stringify(content))}}' --as bot --format json`;
    try {
      const output = execSync(command, { encoding: 'utf8', timeout: 30000 });
      const result = JSON.parse(output);
      return { success: result.code === 0, data: result.data };
    } catch (error) {
      console.error('[Feishu] CLI send error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

function verifyFeishuSignature(body, signature, timestamp, nonce) {
  if (!FEISHU_WEBHOOK_SECRET) return true;
  const stringToSign = `${timestamp}\n${nonce}\n${FEISHU_WEBHOOK_SECRET}\n${body}\n`;
  const hash = crypto.createHash('sha256').update(stringToSign).digest('hex');
  return hash === signature;
}

async function handleFeishuEvent(event) {
  const eventType = event.header?.event_type;
  const eventData = event.event;
  
  if (eventType === 'im.message.receive_v1') {
    const message = eventData.message;
    const sender = eventData.sender;
    
    const chatId = message.chat_id;
    const messageId = message.message_id;
    const content = JSON.parse(message.content || '{}');
    const text = content.text || '';
    
    const isMention = message.mentions?.some(m => m.name === '_self') || false;
    const isGroup = message.chat_type === 'group';
    
    if (isGroup && !isMention) {
      return { handled: false, reason: 'not mentioned' };
    }
    
    const cleanText = text.replace(/@_self/g, '').replace(/@所有/g, '').trim();
    
    console.log(`[Feishu] Received message from ${sender.sender_id?.open_id || 'unknown'}:`, cleanText.substring(0, 50));
    
    if (cleanText.startsWith('/help') || cleanText === '帮助') {
      await sendFeishuMessage(chatId, {
        text: '🤖 SelfClaw AI Agent 帮助\n\n可用命令：\n/help / 帮助 - 显示此帮助\n/clear - 清除上下文\n/status - 系统状态\n/memory - 查看记忆系统\n\n直接提问即可获得AI回答！'
      });
      return { handled: true };
    }
    
    if (cleanText.startsWith('/status') || cleanText === '状态') {
      await sendFeishuMessage(chatId, {
        text: `✅ SelfClaw 运行状态正常\n\n模式: ${FEISHU_AUTH_MODE}\n服务: Gateway\n端口: ${PORT}\n时间: ${new Date().toISOString()}`
      });
      return { handled: true };
    }
    
    await sendFeishuMessage(chatId, { text: '⏳ 正在处理您的请求...' });
    
    const responseText = `你好！我是SelfClaw AI Agent。\n\n你的问题：${cleanText}\n\n这是一个演示响应，完整的AI推理引擎正在集成中。\n\n当前时间：${new Date().toLocaleString()}`;
    
    await sendFeishuMessage(chatId, { text: responseText });
    
    return { handled: true, query: cleanText };
  }
  
  return { handled: false, reason: 'unknown event type' };
}

if (FEISHU_ENABLED) {
  console.log(`[Feishu] Integration enabled, mode: ${FEISHU_AUTH_MODE}`);
  
  app.post('/api/v1/feishu/webhook', async (req, res) => {
    try {
      const signature = req.headers['x-lark-signature'] || req.headers['x-feishu-signature'];
      const timestamp = req.headers['x-lark-request-timestamp'] || req.headers['x-feishu-request-timestamp'];
      const nonce = req.headers['x-lark-nonce'] || req.headers['x-feishu-nonce'];
      
      const rawBody = JSON.stringify(req.body);
      if (FEISHU_WEBHOOK_SECRET && !verifyFeishuSignature(rawBody, signature, timestamp, nonce)) {
        console.warn('[Feishu] Invalid webhook signature');
        return res.status(403).json({ error: 'Invalid signature' });
      }
      
      if (req.body.type === 'url_verification') {
        return res.json({ challenge: req.body.challenge });
      }
      
      handleFeishuEvent(req.body).catch(error => {
        console.error('[Feishu] Event handler error:', error.message);
      });
      
      res.json({ code: 0, message: 'success' });
    } catch (error) {
      console.error('[Feishu] Webhook error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get('/api/v1/feishu/health', async (req, res) => {
    const token = await refreshTenantAccessToken();
    res.json({
      status: token ? 'healthy' : 'unhealthy',
      mode: FEISHU_AUTH_MODE,
      hasCredentials: !!(FEISHU_APP_ID && FEISHU_APP_SECRET),
      hasToken: !!token,
      timestamp: new Date().toISOString()
    });
  });
  
  console.log('[Feishu] Routes registered: POST /api/v1/feishu/webhook, GET /api/v1/feishu/health');
}

// ==================== End Feishu Integration ====================

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'gateway',
    feishu_enabled: FEISHU_ENABLED,
    feishu_mode: FEISHU_AUTH_MODE,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API endpoints
app.get('/', (req, res) => {
  const endpoints = {
    health: '/health',
    ws: 'ws://localhost:' + WS_PORT,
    query: '/api/v1/query',
    auth: '/api/v1/auth'
  };
  if (FEISHU_ENABLED) {
    endpoints.feishu_webhook = '/api/v1/feishu/webhook';
    endpoints.feishu_health = '/api/v1/feishu/health';
  }
  res.json({
    name: 'SelfClaw API Gateway',
    version: '1.0.0',
    feishu_integration: FEISHU_ENABLED ? `enabled (${FEISHU_AUTH_MODE} mode)` : 'disabled',
    endpoints
  });
});

app.post('/api/v1/query', (req, res) => {
  res.json({
    status: 'success',
    query: req.body.query || '',
    response: 'Query received and processed',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/auth/login', (req, res) => {
  res.json({
    status: 'success',
    token: 'demo-jwt-token-' + Date.now(),
    user: { id: 1, username: req.body.username || 'demo' }
  });
});

// Create WebSocket server
const wsServer = http.createServer();
const wss = new WebSocket.Server({ server: wsServer });

const activeConnections = new Set();

wss.on('connection', (ws) => {
  activeConnections.add(ws);
  console.log('WebSocket client connected. Total:', activeConnections.size);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      ws.send(JSON.stringify({
        type: 'response',
        received: data,
        timestamp: new Date().toISOString()
      }));
    } catch (e) {
      ws.send(JSON.stringify({ type: 'echo', message: message.toString() }));
    }
  });
  
  ws.on('close', () => {
    activeConnections.delete(ws);
    console.log('WebSocket client disconnected. Total:', activeConnections.size);
  });
  
  ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to SelfClaw Gateway' }));
});

// Start servers
app.listen(PORT, () => {
  console.log('Gateway API server running on port', PORT);
  console.log('   Health check: http://localhost:' + PORT + '/health');
  if (FEISHU_ENABLED) {
    console.log('   Feishu Webhook: http://localhost:' + PORT + '/api/v1/feishu/webhook');
    console.log('   Feishu Health: http://localhost:' + PORT + '/api/v1/feishu/health');
  }
});

wsServer.listen(WS_PORT, () => {
  console.log('WebSocket server running on port', WS_PORT);
  console.log('   Connect: ws://localhost:' + WS_PORT);
});

// ==================== Feishu 长连接消息监听 ====================
if (FEISHU_ENABLED && process.env.FEISHU_ENABLE_LONGPOLL === 'true') {
  const { FeishuLongPoll } = require('./feishu/longpoll');
  
  const longPoll = new FeishuLongPoll({
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET
  });
  
  longPoll.start();
  console.log('[Feishu] 长连接消息监听服务已启动');
}
