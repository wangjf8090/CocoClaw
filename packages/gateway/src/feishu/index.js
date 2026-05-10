/**
 * Feishu/Lark Adapter for SelfClaw (Dual Mode)
 * 
 * Follows OpenClaw Plugin Architecture:
 * - Exports register(api) function
 * - Registers HTTP routes for webhook
 * - Registers commands for CLI interaction
 * - Integrates with SelfClaw Query Engine
 * 
 * Supports two authentication modes:
 * - native: Use app_id + app_secret with native HTTP API (recommended for production)
 * - cli: Use lark-cli tool (suitable for local development/testing)
 */

const { WebhookHandler } = require('./webhook');
const { MessageSender } = require('./sender');
const { CommandRouter } = require('./commands');
const { FeishuAuth } = require('./auth');
const { AUTH_MODES } = require('./sender-factory');

class FeishuAdapter {
  constructor(config = {}) {
    this.config = {
      enabled: process.env.FEISHU_ENABLED === 'true',
      webhookSecret: process.env.FEISHU_WEBHOOK_SECRET || '',
      appId: process.env.FEISHU_APP_ID || '',
      appSecret: process.env.FEISHU_APP_SECRET || '',
      authMode: process.env.FEISHU_AUTH_MODE || AUTH_MODES.NATIVE,
      defaultIdentity: process.env.FEISHU_DEFAULT_IDENTITY || 'bot',
      cliPath: process.env.FEISHU_CLI_PATH || 'lark-cli',
      ...config
    };

    this.auth = new FeishuAuth(this.config);
    this.sender = new MessageSender(this.config);
    this.webhook = new WebhookHandler(this.config, this);
    this.commands = new CommandRouter(this);
    this.queryEngine = null;

    console.log(`[FeishuAdapter] Initialized with mode: ${this.config.authMode}`);
  }

  setQueryEngine(engine) {
    this.queryEngine = engine;
    this.commands.setQueryEngine(engine);
  }

  async handleMessage(message) {
    if (!this.queryEngine) {
      throw new Error('QueryEngine not set. Call setQueryEngine() first.');
    }

    if (this.commands.isCommand(message)) {
      return this.commands.execute(message);
    }

    const response = await this.queryEngine.query({
      content: message.content,
      userId: message.sender.id,
      chatId: message.chat.id,
      platform: 'feishu',
      metadata: message.metadata
    });

    return response;
  }

  async sendMessage(chatId, content, options = {}) {
    return this.sender.send(chatId, content, options);
  }

  async replyToMessage(messageId, content, options = {}) {
    return this.sender.reply(messageId, content, options);
  }

  registerRoutes(router) {
    this.webhook.registerRoutes(router);
  }

  registerCommands(api) {
    api.registerCommand({
      name: 'feishu:send',
      description: 'Send a message to Feishu chat',
      options: [
        { name: 'chat-id', description: 'Chat ID to send to' },
        { name: 'text', description: 'Message text' },
        { name: 'as', description: 'Identity: user|bot|auto', default: this.config.defaultIdentity }
      ],
      handler: async (args) => {
        return this.sender.send(args['chat-id'], args.text, { as: args.as });
      }
    });

    api.registerCommand({
      name: 'feishu:mode',
      description: 'Show current authentication mode and status',
      handler: async () => {
        const health = await this.sender.healthCheck();
        return {
          mode: this.config.authMode,
          health: health
        };
      }
    });

    api.registerCommand({
      name: 'feishu:webhook:test',
      description: 'Test webhook endpoint configuration',
      handler: async () => {
        return {
          status: 'ok',
          endpoint: '/api/v1/feishu/webhook',
          secretConfigured: !!this.config.webhookSecret
        };
      }
    });
  }
}

function register(api) {
  const adapter = new FeishuAdapter();

  if (api.registerRoute) {
    adapter.registerRoutes(api);
  }

  adapter.registerCommands(api);

  api.set('feishuAdapter', adapter);

  return {
    id: 'feishu-adapter',
    name: 'Feishu/Lark Adapter (Dual Mode)',
    version: '2.0.0',
    adapter,
    activate: (gateway) => {
      adapter.setQueryEngine(gateway.queryEngine);
      console.log('[FeishuAdapter] Activated successfully');
    }
  };
}

module.exports = {
  FeishuAdapter,
  register,
  default: register
};
