/**
 * 启动 Feishu 长连接消息监听服务
 */

const { FeishuLongPoll } = require('./feishu/longpoll');

console.log('='.repeat(50));
console.log('SelfClaw Feishu 长连接消息监听服务');
console.log('='.repeat(50));

// 检查环境变量
if (!process.env.FEISHU_APP_ID || !process.env.FEISHU_APP_SECRET) {
  console.error('错误: 缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET 环境变量');
  process.exit(1);
}

console.log(`App ID: ${process.env.FEISHU_APP_ID.substring(0, 10)}...`);
console.log(`启动时间: ${new Date().toLocaleString()}`);
console.log('');

// 启动长连接监听
const poller = new FeishuLongPoll({
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET
});

poller.start();
