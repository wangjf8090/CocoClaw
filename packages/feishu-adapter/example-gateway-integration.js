/**
 * Example: Gateway Integration with Feishu Adapter
 * 
 * This file shows how to integrate the Feishu Adapter
 * into a typical Express.js-based SelfClaw Gateway.
 */

const express = require('express');
const { FeishuAdapter } = require('./index');

// Mock Query Engine (replace with your actual implementation)
class MockQueryEngine {
  async query({ content, userId, chatId }) {
    console.log(`[QueryEngine] Processing query from ${userId}: ${content}`);
    
    // Simulate AI response
    return {
      type: 'text',
      content: `🤖 SelfClaw received your message: "${content}"\nThis is a mock response.`,
      metadata: { userId, chatId }
    };
  }

  async clearContext(userId) {
    console.log(`[QueryEngine] Clearing context for ${userId}`);
    return true;
  }

  get memory() {
    return {
      async search(query, options = {}) {
        return [
          `Memory entry 1 for: ${query}`,
          `Memory entry 2 for: ${query}`
        ];
      },
      async add(content, metadata = {}) {
        console.log('[Memory] Added:', content, metadata);
        return true;
      }
    };
  }
}

async function main() {
  const app = express();
  const port = process.env.PORT || 8080;

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Create Query Engine
  const queryEngine = new MockQueryEngine();

  // Initialize Feishu Adapter
  const feishuAdapter = new FeishuAdapter({
    enabled: process.env.FEISHU_ENABLED === 'true',
    webhookSecret: process.env.FEISHU_WEBHOOK_SECRET,
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    defaultIdentity: 'bot'
  });

  // Connect Query Engine to Adapter
  feishuAdapter.setQueryEngine(queryEngine);

  // Register Feishu routes
  feishuAdapter.registerRoutes(app);

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'selfclaw-gateway',
      feishuEnabled: feishuAdapter.config.enabled,
      timestamp: new Date().toISOString()
    });
  });

  // Example: Send message programmatically
  app.post('/api/v1/send-test', async (req, res) => {
    try {
      const { chatId, message } = req.body;
      
      if (!chatId || !message) {
        return res.status(400).json({ error: 'chatId and message required' });
      }

      const result = await feishuAdapter.sendMessage(chatId, message, {
        msgType: 'text'
      });

      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Start server
  app.listen(port, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║            SelfClaw Gateway Started                         ║
╠════════════════════════════════════════════════════════════╣
║  Port: ${port}                                                         ║
║  Feishu Adapter: ${feishuAdapter.config.enabled ? 'Enabled ✅' : 'Disabled ❌'}              ║
║  Webhook: http://localhost:${port}/api/v1/feishu/webhook              ║
║  Health: http://localhost:${port}/health                               ║
╚════════════════════════════════════════════════════════════╝
    `);
  });

  // Initialize Feishu Auth
  if (feishuAdapter.config.enabled) {
    try {
      await feishuAdapter.auth.init();
      console.log('[Feishu] Adapter initialized successfully');
      
      const health = await feishuAdapter.auth.healthCheck();
      console.log('[Feishu] Health check:', health.healthy ? 'OK' : 'WARNING');
      
    } catch (error) {
      console.warn('[Feishu] Initialization warning:', error.message);
      console.log('[Feishu] Run `lark-cli config init` to set up credentials');
    }
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run
main().catch(console.error);
