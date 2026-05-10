# SelfClaw Feishu/Lark Adapter (Dual Mode)

Feishu/Lark 平台适配器，支持**原生OpenAPI模式**和**Lark CLI模式**，集成 SelfClaw 网关。

## 架构概览

```
SelfClaw Gateway
    └── Feishu Adapter (Dual Mode)
        ├── Webhook Handler - 接收飞书消息事件
        ├── Sender Factory - 根据配置选择发送模式
        │   ├── OpenAPI Sender - 原生HTTP调用（生产推荐）
        │   └── Lark CLI Sender - 子进程调用lark-cli（开发调试）
        ├── API Client - 原生OpenAPI调用，含Token自动刷新
        ├── Command Router - 处理 @bot 触发的命令
        └── Auth Manager - 认证管理
```

## 功能特性

- ✅ **双模式支持** - 原生OpenAPI / Lark CLI，无缝切换
- ✅ **消息接收** - 通过 Webhook 接收飞书消息
- ✅ **@机器人触发** - 群聊中 @SelfClaw 自动响应
- ✅ **私聊支持** - 一对一对话自动响应
- ✅ **消息发送** - 发送文本、Markdown、卡片、图片
- ✅ **命令系统** - 支持 `/help`、`/clear`、`/memory` 等命令
- ✅ **签名验证** - Webhook 请求签名验证
- ✅ **Token自动刷新** - 原生模式下自动管理tenant_access_token
- ✅ **OpenClaw 插件兼容** - 遵循 OpenClaw 插件架构

## 模式对比

| 特性 | 原生API模式 | Lark CLI模式 |
|------|------------|-------------|
| 配置方式 | `app_id` + `app_secret` | `lark-cli` 登录 |
| 部署复杂度 | ✅ 只需配置凭证 | ⚠️ 需CLI环境+登录状态 |
| 生产就绪 | ✅ 推荐 | ⚠️ 适合开发 |
| 性能 | ✅ 直接HTTP调用 | ⚠️ 子进程开销 |
| 错误处理 | ✅ 精细控制 | ⚠️ 依赖CLI输出解析 |
| Token管理 | ✅ 自动刷新 | ⚠️ CLI管理 |
| Docker部署 | ✅ 开箱即用 | ⚠️ 需配置CLI环境 |
| 适用场景 | 生产环境、服务器部署 | 本地开发、快速测试 |

## 快速开始

### 模式选择

**生产环境推荐使用「原生API模式」**，只需配置环境变量即可，无需额外安装工具。

**本地开发**可使用「Lark CLI模式」便于调试和快速验证。

### 1. 配置环境变量

复制 `.env.example` 到 `.env` 并填写：

```bash
# ========== 基础配置 ==========
FEISHU_ENABLED=true
FEISHU_WEBHOOK_SECRET=your_webhook_secret

# ========== 认证模式选择 ==========
# native: 使用app_id+app_secret原生API调用（推荐生产环境）
# cli: 使用lark-cli（适合本地开发测试）
FEISHU_AUTH_MODE=native

# ========== 原生API模式配置（推荐）==========
FEISHU_APP_ID=cli_xxxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ========== Lark CLI模式配置 ==========
# FEISHU_CLI_PATH=lark-cli
# FEISHU_DEFAULT_IDENTITY=bot
```

### 2. 飞书开放平台配置

1. 进入 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 配置凭证：
   - App ID 和 App Secret（用于原生模式）
   - Encrypt Key（用于Webhook验证）
4. 事件订阅：
   - 请求地址：`https://your-domain.com/api/v1/feishu/webhook`
   - 添加事件：
     - `im.message.receive_v1` - 接收消息
     - `im.message.bot_talked_v1` - 机器人被提及
5. 权限管理（确保应用拥有以下权限）：
   - `im:message` - 发送消息
   - `im:message.group_at_msg` - 获取群组@机器人消息
   - `im:message.p2p_msg` - 获取私聊消息

### 3. 在 Gateway 中集成

```javascript
const { setupFeishuAdapter } = require('@selfclaw/feishu-adapter/gateway-integration');

const feishuAdapter = setupFeishuAdapter(gateway, {
  // authMode: 'native'  // 覆盖默认模式
  // appId: '...',
  // appSecret: '...'
});
```

## 详细配置指南

### 原生API模式 (Native)

**优点：**
- 无需安装额外工具
- 性能更好，无进程创建开销
- 错误处理更精细
- Docker部署更简单

**配置步骤：**
1. 设置 `FEISHU_AUTH_MODE=native`
2. 配置 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`
3. 在飞书开放平台配置应用权限

### Lark CLI模式 (CLI)

**优点：**
- 便于本地开发和调试
- CLI工具提供丰富的命令行交互
- 支持多种身份切换(user/bot/auto)

**配置步骤：**
1. 安装 Lark CLI：
   ```bash
   npm install -g @larksuite/cli
   ```
2. 初始化配置并登录：
   ```bash
   lark-cli config init
   lark-cli auth login --recommend
   lark-cli auth status
   ```
3. 设置 `FEISHU_AUTH_MODE=cli`
4. 配置 `FEISHU_CLI_PATH` 和 `FEISHU_DEFAULT_IDENTITY`

## 使用说明

### 基本对话

1. **群聊**：@SelfClaw + 消息内容
2. **私聊**：直接发送消息即可

### 命令系统

- `/help` - 显示帮助信息
- `/clear` - 清除当前会话上下文
- `/memory` - 查看当前对话历史
- `/mode` - 查看当前认证模式状态

### API使用

```javascript
const { FeishuAdapter } = require('@selfclaw/feishu-adapter');

const adapter = new FeishuAdapter({
  authMode: 'native',
  appId: 'cli_xxx',
  appSecret: 'xxx',
  webhookSecret: 'xxx'
});

// 发送文本消息
await adapter.sendMessage('oc_xxx', 'Hello World');

// 发送Markdown消息
await adapter.sender.sendMarkdown('oc_xxx', '# Hello\nThis is markdown.');

// 发送卡片
await adapter.sender.sendCard('oc_xxx', {
  config: { wide_screen_mode: true },
  elements: [{ tag: 'markdown', content: 'Hello Card!' }]
});

// 健康检查
const status = await adapter.sender.healthCheck();
```

## 健康检查

```bash
curl http://localhost:8080/api/v1/feishu/health
```

响应示例（原生模式）：
```json
{
  "status": "ok",
  "mode": "native",
  "authenticated": true
}
```

响应示例（CLI模式）：
```json
{
  "status": "ok",
  "mode": "cli",
  "authenticated": true
}
```

## Docker部署

### 原生API模式（推荐）

```yaml
version: '3.8'
services:
  selfclaw-gateway:
    image: selfclaw/gateway:latest
    environment:
      - FEISHU_ENABLED=true
      - FEISHU_AUTH_MODE=native
      - FEISHU_APP_ID=cli_xxx
      - FEISHU_APP_SECRET=xxx
      - FEISHU_WEBHOOK_SECRET=xxx
    ports:
      - "8080:8080"
```

### Lark CLI模式

```yaml
version: '3.8'
services:
  selfclaw-gateway:
    build: .
    environment:
      - FEISHU_ENABLED=true
      - FEISHU_AUTH_MODE=cli
      - FEISHU_CLI_PATH=lark-cli
      - FEISHU_DEFAULT_IDENTITY=bot
      - FEISHU_WEBHOOK_SECRET=xxx
    volumes:
      - ~/.lark-cli:/root/.lark-cli  # 挂载CLI配置
    ports:
      - "8080:8080"
```

## 模式切换测试

```javascript
// 测试原生模式
const nativeSender = createSender({
  authMode: 'native',
  appId: 'cli_xxx',
  appSecret: 'xxx'
});
console.log('Native mode:', await nativeSender.healthCheck());

// 测试CLI模式
const cliSender = createSender({
  authMode: 'cli',
  cliPath: 'lark-cli'
});
console.log('CLI mode:', await cliSender.healthCheck());
```

## 常见问题

### Q: 如何选择适合我的模式？

**原生API模式**适合：
- 生产环境部署
- Docker/Kubernetes容器化部署
- 对性能有要求的场景

**Lark CLI模式**适合：
- 本地开发和调试
- 需要使用CLI工具其他功能
- 快速原型验证

### Q: 两种模式可以同时使用吗？

不可以，每个适配器实例只能使用一种模式。如果需要同时使用，请创建多个适配器实例。

### Q: Token会自动刷新吗？

是的，在原生API模式下，tenant_access_token会在过期前5分钟自动刷新。

### Q: 如何切换模式？

只需要修改 `FEISHU_AUTH_MODE` 环境变量即可，无需修改代码。

## 更新日志

### v2.0.0
- ✨ 新增双模式架构支持
- ✨ 新增原生OpenAPI调用模式（生产推荐）
- ✨ 实现Token自动刷新机制
- ✨ 新增发送器工厂模式，统一接口
- 📝 更新文档，增加模式对比和部署指南
- 🧪 增加模式切换测试用例
- 🔄 保持向后兼容

## 许可证

MIT
