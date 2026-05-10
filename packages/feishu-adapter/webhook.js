/**
 * Webhook Handler for Feishu Events
 * 
 * Handles incoming Feishu webhook events:
 * - URL verification challenge
 * - Message received events
 * - Bot mentioned events
 */

const crypto = require('crypto');

class WebhookHandler {
  constructor(config, adapter) {
    this.config = config;
    this.adapter = adapter;
    this.eventHandlers = new Map();
    this.setupDefaultHandlers();
  }

  setupDefaultHandlers() {
    // Handle URL verification challenge
    this.on('url_verification', async (event) => {
      return { challenge: event.challenge };
    });

    // Handle message received event
    this.on('im.message.receive_v1', async (event) => {
      return this.handleMessageReceived(event);
    });

    // Handle bot mentioned event
    this.on('im.message.bot_talked_v1', async (event) => {
      return this.handleBotMentioned(event);
    });
  }

  on(eventType, handler) {
    this.eventHandlers.set(eventType, handler);
  }

  async verifySignature(req) {
    if (!this.config.webhookSecret) {
      return true; // Skip verification if no secret configured
    }

    const signature = req.headers['x-lark-signature'] || req.headers['x-feishu-signature'];
    const timestamp = req.headers['x-lark-request-timestamp'] || req.headers['x-feishu-request-timestamp'];
    const nonce = req.headers['x-lark-request-nonce'] || req.headers['x-feishu-request-nonce'];

    if (!signature || !timestamp || !nonce) {
      return false;
    }

    // Construct signature string
    const body = JSON.stringify(req.body);
    const stringToSign = `${timestamp}\n${nonce}\n${body}\n${this.config.webhookSecret}`;
    
    const computedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(stringToSign)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );
  }

  parseEvent(body) {
    // Feishu event v2 format
    if (body.header) {
      return {
        type: body.header.event_type,
        eventId: body.header.event_id,
        createTime: body.header.create_time,
        token: body.header.token,
        appId: body.header.app_id,
        tenantKey: body.header.tenant_key,
        event: body.event
      };
    }

    // Legacy format or URL verification
    if (body.challenge) {
      return {
        type: 'url_verification',
        challenge: body.challenge,
        token: body.token,
        type: body.type
      };
    }

    return null;
  }

  async handleMessageReceived(event) {
    const { message, sender } = event.event;

    // Parse message content
    let content = '';
    try {
      const contentObj = JSON.parse(message.content);
      content = contentObj.text || '';
    } catch (e) {
      content = message.content;
    }

    // Normalize message for SelfClaw
    const normalizedMessage = {
      id: message.message_id,
      content: content,
      type: message.message_type,
      chat: {
        id: message.chat_id,
        type: message.chat_type
      },
      sender: {
        id: sender.sender_id?.open_id || sender.id,
        name: sender.sender_name || '',
        type: sender.sender_type
      },
      createTime: message.create_time,
      metadata: {
        platform: 'feishu',
        rootId: message.root_id,
        parentId: message.parent_id,
        mentions: message.mentions || []
      }
    };

    // Check if bot is mentioned
    const botMentioned = this.isBotMentioned(message);

    // Only process if bot is mentioned or it's a private chat
    if (botMentioned || message.chat_type === 'p2p') {
      // Remove @bot mention from content
      if (botMentioned) {
        normalizedMessage.content = this.removeBotMention(content, message.mentions);
      }

      // Process through adapter
      const response = await this.adapter.handleMessage(normalizedMessage);

      // Send response back
      if (response) {
        await this.adapter.replyToMessage(message.message_id, response.content, {
          msgType: response.type || 'text'
        });
      }
    }

    return { status: 'processed' };
  }

  async handleBotMentioned(event) {
    // Alias for message received for backward compatibility
    return this.handleMessageReceived(event);
  }

  isBotMentioned(message) {
    if (!message.mentions || message.mentions.length === 0) {
      return false;
    }
    return message.mentions.some(m => m.id === 'selfclaw_bot' || m.name === 'SelfClaw');
  }

  removeBotMention(content, mentions) {
    if (!mentions) return content;

    let result = content;
    mentions.forEach(mention => {
      if (mention.key) {
        result = result.replace(new RegExp(`@${mention.key}\\s?`, 'g'), '');
      }
    });

    return result.trim();
  }

  registerRoutes(router) {
    // Main webhook endpoint
    router.post('/api/v1/feishu/webhook', async (req, res) => {
      try {
        // Verify signature if enabled
        if (this.config.webhookSecret) {
          const isValid = await this.verifySignature(req);
          if (!isValid) {
            return res.status(403).json({ error: 'Invalid signature' });
          }
        }

        // Parse event
        const event = this.parseEvent(req.body);
        if (!event) {
          return res.status(400).json({ error: 'Invalid event format' });
        }

        // Find handler
        const handler = this.eventHandlers.get(event.type);
        if (handler) {
          const result = await handler(event);
          return res.json(result);
        }

        // No handler found, return success to acknowledge
        res.json({ status: 'acknowledged', type: event.type });

      } catch (error) {
        console.error('[FeishuWebhook] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Health check endpoint
    router.get('/api/v1/feishu/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'feishu-adapter',
        enabled: this.config.enabled,
        secretConfigured: !!this.config.webhookSecret,
        timestamp: new Date().toISOString()
      });
    });

    console.log('[FeishuWebhook] Routes registered');
  }
}

module.exports = { WebhookHandler };
