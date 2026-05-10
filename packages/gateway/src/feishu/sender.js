/**
 * Message Sender (Compatibility Layer)
 * 
 * This file provides backward compatibility for existing code.
 * For new code, use sender-factory.js directly.
 */

const { createSender, getDefaultConfig } = require('./sender-factory');

class MessageSender {
  constructor(config = {}) {
    this.sender = createSender(config);
    this.mode = this.sender.mode;
  }

  async send(chatId, content, options = {}) {
    return this.sender.send(chatId, content, options);
  }

  async reply(messageId, content, options = {}) {
    return this.sender.reply(messageId, content, options);
  }

  async sendMarkdown(chatId, markdown, options = {}) {
    return this.sender.sendMarkdown(chatId, markdown, options);
  }

  async sendCard(chatId, cardConfig, options = {}) {
    return this.sender.sendCard(chatId, cardConfig, options);
  }

  async sendImage(chatId, imageKey, options = {}) {
    return this.sender.sendImage(chatId, imageKey, options);
  }

  async sendTyping(chatId, duration = 3000) {
    return this.sender.sendTyping(chatId, duration);
  }

  async batchSend(chatIds, content, options = {}) {
    return this.sender.batchSend(chatIds, content, options);
  }

  async healthCheck() {
    return this.sender.healthCheck();
  }
}

module.exports = { MessageSender };
