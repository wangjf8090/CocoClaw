/**
 * OpenAPI Message Sender (Native Mode)
 * 
 * Uses Feishu OpenAPI directly via HTTP calls:
 * - Text messages
 * - Markdown messages
 * - Interactive cards
 * - Rich text with images
 */

const { FeishuApiClient } = require('./api-client');

class OpenApiSender {
  constructor(config = {}) {
    this.mode = 'native';
    this.config = {
      appId: config.appId || process.env.FEISHU_APP_ID || '',
      appSecret: config.appSecret || process.env.FEISHU_APP_SECRET || '',
      defaultReceiveIdType: config.defaultReceiveIdType || 'chat_id',
      baseUrl: config.baseUrl || 'https://open.feishu.cn',
      ...config
    };

    this.apiClient = new FeishuApiClient(this.config);
  }

  async send(chatId, content, options = {}) {
    const {
      msgType = 'text',
      receiveIdType = this.config.defaultReceiveIdType,
      dryRun = false
    } = options;

    return this.apiClient.sendMessage(chatId, content, {
      msgType,
      receiveIdType,
      dryRun
    });
  }

  async reply(messageId, content, options = {}) {
    const {
      msgType = 'text',
      dryRun = false
    } = options;

    return this.apiClient.replyMessage(messageId, content, {
      msgType,
      dryRun
    });
  }

  async sendMarkdown(chatId, markdown, options = {}) {
    const card = {
      config: { wide_screen_mode: true },
      elements: [
        {
          tag: 'markdown',
          content: markdown
        }
      ]
    };

    return this.send(chatId, card, { ...options, msgType: 'interactive' });
  }

  async sendCard(chatId, cardConfig, options = {}) {
    return this.send(chatId, cardConfig, { ...options, msgType: 'interactive' });
  }

  async sendImage(chatId, imageKey, options = {}) {
    return this.send(chatId, imageKey, { ...options, msgType: 'image' });
  }

  async sendTyping(chatId, duration = 3000) {
    const card = {
      config: { wide_screen_mode: true },
      elements: [
        {
          tag: 'markdown',
          content: '⏳ Processing...'
        }
      ]
    };

    const result = await this.send(chatId, card, { msgType: 'interactive' });
    return result;
  }

  async batchSend(chatIds, content, options = {}) {
    const results = [];
    for (const chatId of chatIds) {
      try {
        const result = await this.send(chatId, content, options);
        results.push({ chatId, success: true, result });
      } catch (error) {
        results.push({ chatId, success: false, error: error.message });
      }
    }
    return results;
  }

  async healthCheck() {
    return this.apiClient.healthCheck();
  }

  async getTenantAccessToken() {
    return this.apiClient.getTenantAccessToken();
  }
}

module.exports = { OpenApiSender };
