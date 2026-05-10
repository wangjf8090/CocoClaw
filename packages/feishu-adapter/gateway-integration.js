/**
 * Gateway Integration (Dual Mode Support)
 * 
 * This file demonstrates how to integrate the Feishu Adapter
 * into the SelfClaw Gateway service with support for both
 * Native API and Lark CLI modes.
 * 
 * Usage: Import and register in your Gateway bootstrap
 */

const { FeishuAdapter } = require('./index');
const { AUTH_MODES } = require('./sender-factory');

/**
 * Setup Feishu Adapter with Gateway
 * 
 * @param {Object} gateway - SelfClaw Gateway instance
 * @param {Object} config - Feishu configuration
 * @param {string} config.authMode - 'native' or 'cli' (default: native)
 * @param {string} config.appId - Feishu App ID (for native mode)
 * @param {string} config.appSecret - Feishu App Secret (for native mode)
 * @param {string} config.cliPath - Path to lark-cli (for cli mode)
 * @returns {FeishuAdapter} Initialized adapter instance
 */
function setupFeishuAdapter(gateway, config = {}) {
  const authMode = config.authMode || process.env.FEISHU_AUTH_MODE || AUTH_MODES.NATIVE;
  
  console.log(`[FeishuIntegration] Setting up adapter with mode: ${authMode}`);
  
  const adapter = new FeishuAdapter(config);
  
  adapter.setQueryEngine(gateway.queryEngine);
  
  if (gateway.router) {
    adapter.registerRoutes(gateway.router);
    console.log('[FeishuIntegration] Routes registered');
  }
  
  if (gateway.registerPlugin) {
    gateway.registerPlugin({
      id: 'feishu-adapter',
      name: 'Feishu/Lark Adapter (Dual Mode)',
      version: '2.0.0',
      adapter,
      mode: authMode,
      routes: [
        { method: 'POST', path: '/api/v1/feishu/webhook' },
        { method: 'GET', path: '/api/v1/feishu/health' }
      ]
    });
  }
  
  if (gateway.addHealthCheck) {
    gateway.addHealthCheck('feishu', async () => {
      return adapter.sender.healthCheck();
    });
  }
  
  console.log('[FeishuIntegration] Adapter setup complete');
  return adapter;
}

function expressWebhookMiddleware(adapter) {
  return (req, res) => {
    return adapter.webhook.handleWebhook(req, res);
  };
}

module.exports = {
  setupFeishuAdapter,
  expressWebhookMiddleware
};
