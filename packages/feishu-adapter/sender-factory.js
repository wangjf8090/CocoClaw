/**
 * Sender Factory - Creates the appropriate sender based on configuration
 * 
 * Supports two modes:
 * - native: Use app_id + app_secret with native HTTP API (recommended for production)
 * - cli: Use lark-cli tool (suitable for local development/testing)
 */

const { LarkCliSender } = require('./sender-lark-cli');
const { OpenApiSender } = require('./sender-openapi');

const AUTH_MODES = {
  NATIVE: 'native',
  CLI: 'cli'
};

/**
 * Create sender instance based on configuration
 * @param {Object} config - Configuration object
 * @param {string} config.authMode - 'native' or 'cli'
 * @param {string} config.appId - Feishu app ID (for native mode)
 * @param {string} config.appSecret - Feishu app secret (for native mode)
 * @param {string} config.cliPath - Path to lark-cli (for cli mode)
 * @param {string} config.defaultIdentity - Default sender identity
 * @returns {Object} Sender instance with unified interface
 */
function createSender(config = {}) {
  const authMode = config.authMode || process.env.FEISHU_AUTH_MODE || AUTH_MODES.NATIVE;
  
  console.log(`[SenderFactory] Creating sender with mode: ${authMode}`);

  switch (authMode) {
    case AUTH_MODES.CLI:
      return new LarkCliSender(config);

    case AUTH_MODES.NATIVE:
    default:
      return new OpenApiSender(config);
  }
}

/**
 * Get default configuration from environment variables
 */
function getDefaultConfig() {
  return {
    authMode: process.env.FEISHU_AUTH_MODE || AUTH_MODES.NATIVE,
    appId: process.env.FEISHU_APP_ID || '',
    appSecret: process.env.FEISHU_APP_SECRET || '',
    cliPath: process.env.FEISHU_CLI_PATH || 'lark-cli',
    defaultIdentity: process.env.FEISHU_DEFAULT_IDENTITY || 'bot',
    defaultReceiveIdType: process.env.FEISHU_RECEIVE_ID_TYPE || 'chat_id',
    enabled: process.env.FEISHU_ENABLED === 'true'
  };
}

module.exports = {
  createSender,
  getDefaultConfig,
  AUTH_MODES
};
