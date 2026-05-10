/**
 * Feishu OpenAPI Native Client
 * 
 * Direct HTTP calls to Feishu OpenAPI:
 * - Tenant access token management with auto refresh
 * - Message sending API
 * - Core OpenAPI operations
 */

const https = require('https');

class FeishuApiClient {
  constructor(config = {}) {
    this.config = {
      appId: process.env.FEISHU_APP_ID || '',
      appSecret: process.env.FEISHU_APP_SECRET || '',
      baseUrl: 'https://open.feishu.cn',
      tokenExpireBuffer: 300, // Refresh token 5 minutes before expiry
      ...config
    };

    this.accessToken = null;
    this.tokenExpireTime = 0;
  }

  /**
   * Get tenant access token with auto refresh
   */
  async getTenantAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    
    // Return cached token if still valid
    if (this.accessToken && now < this.tokenExpireTime - this.config.tokenExpireBuffer) {
      return this.accessToken;
    }

    try {
      const response = await this.request({
        method: 'POST',
        path: '/open-apis/auth/v3/tenant_access_token/internal',
        body: {
          app_id: this.config.appId,
          app_secret: this.config.appSecret
        },
        needAuth: false
      });

      if (response.code !== 0) {
        throw new Error(`Token request failed: ${response.msg} (code: ${response.code})`);
      }

      this.accessToken = response.tenant_access_token;
      this.tokenExpireTime = now + response.expire;
      
      console.log('[FeishuApiClient] Tenant access token obtained');
      return this.accessToken;
    } catch (error) {
      console.error('[FeishuApiClient] Failed to get tenant access token:', error.message);
      throw error;
    }
  }

  /**
   * Send message using native OpenAPI
   */
  async sendMessage(receiveId, content, options = {}) {
    const {
      msgType = 'text',
      receiveIdType = 'chat_id',
      dryRun = false
    } = options;

    const messageContent = this.buildContent(content, msgType);

    if (dryRun) {
      return {
        method: 'POST',
        path: '/open-apis/im/v1/messages',
        params: { receive_id_type: receiveIdType },
        body: {
          receive_id: receiveId,
          msg_type: msgType,
          content: messageContent
        },
        status: 'dry_run'
      };
    }

    try {
      const response = await this.request({
        method: 'POST',
        path: '/open-apis/im/v1/messages',
        params: { receive_id_type: receiveIdType },
        body: {
          receive_id: receiveId,
          msg_type: msgType,
          content: messageContent
        }
      });

      return this.parseResult(response);
    } catch (error) {
      console.error('[FeishuApiClient] Send message error:', error.message);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Reply to message using native OpenAPI
   */
  async replyMessage(messageId, content, options = {}) {
    const {
      msgType = 'text',
      dryRun = false
    } = options;

    const messageContent = this.buildContent(content, msgType);

    if (dryRun) {
      return {
        method: 'POST',
        path: `/open-apis/im/v1/messages/${messageId}/reply`,
        body: {
          msg_type: msgType,
          content: messageContent
        },
        status: 'dry_run'
      };
    }

    try {
      const response = await this.request({
        method: 'POST',
        path: `/open-apis/im/v1/messages/${messageId}/reply`,
        body: {
          msg_type: msgType,
          content: messageContent
        }
      });

      return this.parseResult(response);
    } catch (error) {
      console.error('[FeishuApiClient] Reply message error:', error.message);
      throw new Error(`Failed to reply to message: ${error.message}`);
    }
  }

  /**
   * Build message content based on type
   */
  buildContent(content, msgType) {
    switch (msgType) {
      case 'text':
        return JSON.stringify({ text: content });

      case 'markdown':
      case 'interactive':
        // For cards and markdown, content should already be JSON
        return typeof content === 'string' ? content : JSON.stringify(content);

      case 'post':
        // Rich text format
        if (typeof content === 'string') {
          return JSON.stringify({
            post: {
              zh_cn: {
                title: '',
                content: [[{ tag: 'text', text: content }]]
              }
            }
          });
        }
        return JSON.stringify(content);

      case 'image':
        return typeof content === 'string' 
          ? JSON.stringify({ image_key: content })
          : JSON.stringify(content);

      default:
        return JSON.stringify({ text: String(content) });
    }
  }

  /**
   * Parse API response result
   */
  parseResult(response) {
    return {
      success: response.code === 0,
      messageId: response.data?.message_id,
      data: response.data,
      code: response.code,
      msg: response.msg,
      raw: response
    };
  }

  /**
   * Make HTTP request to Feishu OpenAPI
   */
  async request(options) {
    const {
      method = 'GET',
      path,
      params = {},
      body = null,
      needAuth = true
    } = options;

    // Build query string
    const queryString = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    const fullPath = queryString ? `${path}?${queryString}` : path;

    // Get auth token if needed
    const headers = {
      'Content-Type': 'application/json; charset=utf-8'
    };

    if (needAuth) {
      const token = await this.getTenantAccessToken();
      headers['Authorization'] = `Bearer ${token}`;
    }

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: this.config.baseUrl.replace('https://', ''),
        port: 443,
        path: fullPath,
        method: method,
        headers: headers
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(e);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Upload image to Feishu
   */
  async uploadImage(imageBuffer, fileName = 'image.png') {
    // This would be implemented with multipart/form-data upload
    // For now, return a placeholder
    throw new Error('Image upload not implemented in native mode yet');
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.getTenantAccessToken();
      return {
        status: 'ok',
        mode: 'native',
        authenticated: true
      };
    } catch (error) {
      return {
        status: 'error',
        mode: 'native',
        authenticated: false,
        error: error.message
      };
    }
  }
}

module.exports = { FeishuApiClient };
