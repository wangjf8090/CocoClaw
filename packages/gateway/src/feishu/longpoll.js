/**
 * Feishu/Lark 长连接消息监听服务
 */

const https = require('https');

class FeishuLongPoll {
  constructor(config) {
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.tenantToken = null;
    this.tokenExpireTime = 0;
    this.running = false;
  }

  async refreshToken() {
    const now = Date.now();
    if (this.tenantToken && now < this.tokenExpireTime - 300000) {
      return this.tenantToken;
    }

    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret
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
              this.tenantToken = result.tenant_access_token;
              this.tokenExpireTime = now + result.expire * 1000;
              resolve(this.tenantToken);
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

  async sendMessage(receiveId, content, type = 'chat_id') {
    const token = await this.refreshToken();
    
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

  async handleMessageEvent(event) {
    const message = event.message;
    const chatId = message.chat_id;
    const chatType = message.chat_type;
    const content = JSON.parse(message.content || '{}');
    const text = content.text || '';
    const senderId = event.sender ? event.sender.sender_id.open_id : 'unknown';

    console.log(`[Feishu] 收到消息 [${chatType}] ${senderId}: ${text.substring(0, 50)}`);

    const isMentioned = message.mentions && message.mentions.some(m => m.id === 'ou_f61a856739c7c8de99529cac0c249960');
    const cleanText = text.replace(/@_self/g, '').replace(/@所有/g, '').trim();

    if (chatType === 'group' && !isMentioned) {
      return { handled: false, reason: 'not mentioned' };
    }

    let replyText = '';

    if (cleanText.startsWith('/help') || cleanText === '帮助') {
      replyText = `🤖 SelfClaw AI Agent 帮助

可用命令：
/help / 帮助 - 显示此帮助
/status / 状态 - 显示系统状态

直接提问即可获得AI回答！`;
    } else if (cleanText.startsWith('/status') || cleanText === '状态') {
      replyText = `✅ SelfClaw 运行状态

服务：Gateway v1.0.0
模式：原生API
状态：正常运行
时间：${new Date().toLocaleString()}`;
    } else if (cleanText) {
      replyText = `🤖 收到你的消息啦！

"${cleanText}"

这是自动回复，完整AI引擎正在集成中...

当前支持的命令：
/help - 帮助
/status - 状态`;
    }

    if (replyText) {
      const result = await this.sendMessage(chatId, replyText);
      return { handled: result.code === 0, query: cleanText };
    }

    return { handled: false };
  }

  async start() {
    console.log('[Feishu] 长连接服务启动中...');
    await this.refreshToken();
    console.log('[Feishu] 长连接服务已启动，开始监听消息...');
    console.log('[Feishu] 注意：飞书事件需要通过webhook或官方长连接SDK接收');
    console.log('[Feishu] 当前版本仅实现发送功能，完整消息监听需要配合webhook或官方SDK');
    
    this.running = true;
  }
}

module.exports = { FeishuLongPoll };
