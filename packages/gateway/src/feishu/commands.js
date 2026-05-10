/**
 * Command Router for Feishu Messages
 * 
 * Handles slash commands and @bot triggered commands:
 * - /help - Show help information
 * - /clear - Clear conversation context
 * - /memory - Access memory system
 * - /agent - Switch agent mode
 */

class CommandRouter {
  constructor(adapter) {
    this.adapter = adapter;
    this.commands = new Map();
    this.queryEngine = null;
    this.setupDefaultCommands();
  }

  setQueryEngine(engine) {
    this.queryEngine = engine;
  }

  setupDefaultCommands() {
    // Help command
    this.register('/help', async (args, context) => {
      const helpText = `
🤖 **SelfClaw Feishu Bot**

Available commands:
- \`/help\` - Show this help message
- \`/clear\` - Clear conversation context
- \`/memory [query]\` - Search or manage memory
- \`/agent [name]\` - Switch agent mode
- \`/status\` - Show bot status
- \`@bot [message]\` - Chat with AI

Just mention me or send a direct message to chat!
      `.trim();

      return {
        type: 'interactive',
        content: {
          config: { wide_screen_mode: true },
          header: {
            template: 'blue',
            title: { tag: 'plain_text', content: '🤖 SelfClaw Help' }
          },
          elements: [
            { tag: 'markdown', content: helpText }
          ]
        }
      };
    });

    // Clear context command
    this.register('/clear', async (args, context) => {
      if (this.queryEngine && this.queryEngine.clearContext) {
        await this.queryEngine.clearContext(context.userId);
      }

      return {
        type: 'text',
        content: '✅ Conversation context cleared!'
      };
    });

    // Memory command
    this.register('/memory', async (args, context) => {
      const subCommand = args[0];
      const query = args.slice(1).join(' ');

      if (!this.queryEngine || !this.queryEngine.memory) {
        return { type: 'text', content: '⚠️ Memory system not available' };
      }

      try {
        switch (subCommand) {
          case 'search':
          case 'find':
            const results = await this.queryEngine.memory.search(query, { limit: 5 });
            return this.formatMemoryResults(results);

          case 'add':
          case 'save':
            await this.queryEngine.memory.add(query, { source: 'feishu', userId: context.userId });
            return { type: 'text', content: '✅ Memory saved!' };

          default:
            return {
              type: 'text',
              content: 'Usage: /memory search|add [query]\nExample: /memory search project ideas'
            };
        }
      } catch (error) {
        return { type: 'text', content: `❌ Memory error: ${error.message}` };
      }
    });

    // Status command
    this.register('/status', async (args, context) => {
      return {
        type: 'interactive',
        content: {
          config: { wide_screen_mode: true },
          header: {
            template: 'green',
            title: { tag: 'plain_text', content: '📊 SelfClaw Status' }
          },
          elements: [
            {
              tag: 'markdown',
              content: `
**Status**: Online 🟢
**Platform**: Feishu/Lark
**Version**: 1.0.0
**Query Engine**: ${this.queryEngine ? 'Ready' : 'Pending'}
**Time**: ${new Date().toLocaleString('zh-CN')}
              `.trim()
            }
          ]
        }
      };
    });

    // Agent switch command
    this.register('/agent', async (args, context) => {
      const agentName = args[0];

      if (!agentName) {
        return {
          type: 'text',
          content: 'Usage: /agent [name]\nExample: /agent assistant'
        };
      }

      if (this.queryEngine && this.queryEngine.setAgent) {
        await this.queryEngine.setAgent(context.userId, agentName);
        return { type: 'text', content: `✅ Switched to agent: ${agentName}` };
      }

      return { type: 'text', content: '⚠️ Agent switching not available' };
    });
  }

  register(command, handler) {
    this.commands.set(command.toLowerCase(), handler);
  }

  isCommand(message) {
    const content = message.content?.trim() || '';
    
    // Check for slash commands
    if (content.startsWith('/')) {
      const firstWord = content.split(' ')[0].toLowerCase();
      return this.commands.has(firstWord);
    }

    return false;
  }

  async execute(message) {
    const content = message.content.trim();
    const parts = content.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    const handler = this.commands.get(command);
    if (!handler) {
      return { type: 'text', content: `Unknown command: ${command}` };
    }

    const context = {
      userId: message.sender?.id,
      chatId: message.chat?.id,
      messageId: message.id,
      platform: 'feishu'
    };

    try {
      return await handler(args, context);
    } catch (error) {
      console.error('[CommandRouter] Execution error:', error);
      return { type: 'text', content: `❌ Command failed: ${error.message}` };
    }
  }

  formatMemoryResults(results) {
    if (!results || results.length === 0) {
      return { type: 'text', content: 'No memory entries found.' };
    }

    const items = results.map((r, i) => {
      const content = typeof r === 'string' ? r : (r.content || r.text || '');
      const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
      return `${i + 1}. ${preview}`;
    }).join('\n\n');

    return {
      type: 'interactive',
      content: {
        config: { wide_screen_mode: true },
        header: {
          template: 'purple',
          title: { tag: 'plain_text', content: '🧠 Memory Search Results' }
        },
        elements: [
          { tag: 'markdown', content: `Found ${results.length} entries:\n\n${items}` }
        ]
      }
    };
  }

  // Parse message for special keywords or triggers
  analyzeMessage(message) {
    const content = message.content?.toLowerCase() || '';
    
    return {
      isGreeting: /^(hi|hello|hey|你好|嗨)/.test(content),
      isQuestion: content.includes('?') || content.includes('？'),
      hasCode: content.includes('```'),
      mentionsEveryone: content.includes('@all') || content.includes('所有人'),
      urgency: this.detectUrgency(content)
    };
  }

  detectUrgency(content) {
    const urgentKeywords = ['urgent', '紧急', 'asap', '立刻', '马上', 'now'];
    return urgentKeywords.some(kw => content.includes(kw)) ? 'high' : 'normal';
  }
}

module.exports = { CommandRouter };
