/**
 * Feishu Adapter Tests
 * 
 * Run: node test.js
 */

const { FeishuAdapter } = require('./index');
const { WebhookHandler } = require('./webhook');
const { MessageSender } = require('./sender');
const { CommandRouter } = require('./commands');
const { FeishuAuth } = require('./auth');

async function runTests() {
  console.log('🧪 Running Feishu Adapter Tests\n');

  const tests = [
    testAdapterCreation,
    testWebhookSignature,
    testCommandParsing,
    testMessageBuilding,
    testAuthHealthCheck
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      console.log(`✅ ${test.name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
}

async function testAdapterCreation() {
  const adapter = new FeishuAdapter({
    enabled: true,
    webhookSecret: 'test-secret'
  });

  if (!adapter || !adapter.config) {
    throw new Error('Adapter not created properly');
  }

  if (adapter.config.webhookSecret !== 'test-secret') {
    throw new Error('Config not applied correctly');
  }
}

async function testWebhookSignature() {
  const adapter = new FeishuAdapter({
    webhookSecret: 'test-secret-123'
  });

  // Test signature verification logic exists
  if (typeof adapter.webhook.verifySignature !== 'function') {
    throw new Error('Webhook verifySignature method missing');
  }

  // Test event parsing
  const testEvent = {
    challenge: 'test-challenge',
    token: 'test-token',
    type: 'url_verification'
  };

  const parsed = adapter.webhook.parseEvent(testEvent);
  if (!parsed || parsed.type !== 'url_verification') {
    throw new Error('Event parsing failed for URL verification');
  }
}

async function testCommandParsing() {
  const adapter = new FeishuAdapter();

  // Test command detection
  const commandMessage = {
    content: '/help'
  };

  if (!adapter.commands.isCommand(commandMessage)) {
    throw new Error('Failed to detect /help command');
  }

  // Test non-command message
  const normalMessage = {
    content: 'Hello, how are you?'
  };

  if (adapter.commands.isCommand(normalMessage)) {
    throw new Error('Incorrectly detected normal message as command');
  }
}

async function testMessageBuilding() {
  const sender = new MessageSender();

  // Test text content building
  const textContent = sender.buildContent('Hello World', 'text');
  const parsed = JSON.parse(textContent);
  
  if (parsed.text !== 'Hello World') {
    throw new Error('Text content building failed');
  }

  // Test command building (dry run)
  const command = sender.buildSendCommand('oc_test123', '{"text":"test"}', {
    msgType: 'text',
    as: 'bot',
    dryRun: true
  });

  if (!command.includes('lark-cli')) {
    throw new Error('Command does not include lark-cli');
  }
}

async function testAuthHealthCheck() {
  const auth = new FeishuAuth({
    appId: 'test-app-id',
    appSecret: 'test-app-secret'
  });

  // Test config is stored
  if (auth.config.appId !== 'test-app-id') {
    throw new Error('Auth config not stored correctly');
  }

  // Test identity switching
  await auth.switchIdentity('user');
  if (auth.getCurrentIdentity() !== 'user') {
    throw new Error('Identity switching failed');
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
