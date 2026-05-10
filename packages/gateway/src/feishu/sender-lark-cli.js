/**
 * Lark CLI Message Sender
 * 
 * Wraps lark-cli commands to send messages:
 * - Text messages
 * - Markdown messages
 * - Interactive cards
 * - Rich text with images
 */

const { execSync } = require('child_process');

class LarkCliSender {
  constructor(config = {}) {
    this.mode = 'cli';
    this.config = {
      defaultIdentity: config.defaultIdentity || process.env.FEISHU_DEFAULT_IDENTITY || 'bot',
      defaultReceiveIdType: config.defaultReceiveIdType || 'chat_id',
      cliPath: config.cliPath || process.env.FEISHU_CLI_PATH || 'lark-cli',
      ...config
    };
  }

  async send(chatId, content, options = {}) {
    const {
      msgType = 'text',
      as = this.config.defaultIdentity,
      receiveIdType = this.config.defaultReceiveIdType,
      dryRun = false
    } = options;

    const messageContent = this.buildContent(content, msgType);

    const command = this.buildSendCommand(chatId, messageContent, {
      msgType,
      as,
      receiveIdType,
      dryRun
    });

    if (dryRun) {
      return { command, status: 'dry_run', mode: this.mode };
    }

    try {
      const result = this.executeCommand(command);
      return { ...this.parseResult(result), mode: this.mode };
    } catch (error) {
      console.error('[LarkCliSender] Send error:', error.message);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  async reply(messageId, content, options = {}) {
    const {
      msgType = 'text',
      as = this.config.defaultIdentity,
      dryRun = false
    } = options;

    const messageContent = this.buildContent(content, msgType);

    const command = this.buildReplyCommand(messageId, messageContent, {
      msgType,
      as,
      dryRun
    });

    if (dryRun) {
      return { command, status: 'dry_run', mode: this.mode };
    }

    try {
      const result = this.executeCommand(command);
      return { ...this.parseResult(result), mode: this.mode };
    } catch (error) {
      console.error('[LarkCliSender] Reply error:', error.message);
      throw new Error(`Failed to reply to message: ${error.message}`);
    }
  }

  buildContent(content, msgType) {
    switch (msgType) {
      case 'text':
        return JSON.stringify({ text: content });

      case 'markdown':
      case 'interactive':
        return typeof content === 'string' ? content : JSON.stringify(content);

      case 'post':
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

      default:
        return JSON.stringify({ text: String(content) });
    }
  }

  buildSendCommand(chatId, content, options = {}) {
    const { msgType = 'text', as = 'bot', receiveIdType = 'chat_id' } = options;

    const params = {
      receive_id: chatId,
      msg_type: msgType
    };

    const data = {
      content: content
    };

    return [
      this.config.cliPath,
      'im',
      '+messages-send',
      `--params '${JSON.stringify(params)}'`,
      `--data '${JSON.stringify(data)}'`,
      `--as ${as}`,
      '--format json'
    ].join(' ');
  }

  buildReplyCommand(messageId, content, options = {}) {
    const { msgType = 'text', as = 'bot' } = options;

    const data = {
      content: content,
      msg_type: msgType
    };

    return [
      this.config.cliPath,
      'im',
      '+messages-reply',
      `--params '${JSON.stringify({ message_id: messageId })}'`,
      `--data '${JSON.stringify(data)}'`,
      `--as ${as}`,
      '--format json'
    ].join(' ');
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
    const content = JSON.stringify({ image_key: imageKey });
    return this.send(chatId, content, { ...options, msgType: 'image' });
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

  executeCommand(command) {
    try {
      const output = execSync(command, {
        encoding: 'utf8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return output;
    } catch (error) {
      throw new Error(`Command failed: ${error.stderr || error.message}`);
    }
  }

  parseResult(output) {
    try {
      const result = JSON.parse(output);
      return {
        success: result.code === 0 || result.code === undefined,
        messageId: result.data?.message_id,
        data: result.data,
        raw: result
      };
    } catch {
      return {
        success: true,
        rawOutput: output
      };
    }
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
    try {
      const result = this.executeCommand(`${this.config.cliPath} auth status --format json`);
      const status = this.parseResult(result);
      return {
        status: 'ok',
        mode: this.mode,
        authenticated: status.success
      };
    } catch (error) {
      return {
        status: 'error',
        mode: this.mode,
        authenticated: false,
        error: error.message
      };
    }
  }
}

module.exports = { LarkCliSender };
