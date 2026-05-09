/**
 * SelfClaw Web UI Backend Server
 * 主服务器入口
 */

import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { logger } from './monitoring/logger';
import { metricsManager } from './monitoring/metrics';
import { healthChecker } from './monitoring/health-check';
import { authenticateToken } from './middleware/auth';
import { wsManager } from './websocket/server';

// 路由
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import soulRoutes from './routes/soul';
import memoryRoutes from './routes/memory';

// 配置
const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();
const server = http.createServer(app);

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

// CORS 配置
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 限制每个 IP 100 个请求
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests from this IP, please try again later'
    }
  }
});
app.use('/api', limiter);

// 解析中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 指标中间件
app.use(metricsManager.createMiddleware());

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// 静态文件服务（前端）
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/soul', authenticateToken, soulRoutes);
app.use('/api/memory', authenticateToken, memoryRoutes);

// 公开的健康检查和指标
app.use('/health', dashboardRoutes);
app.use('/metrics', dashboardRoutes);

// WebSocket
wsManager.attach(server);

// 单页应用回退
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found'
      }
    });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 全局错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Internal server error'
    }
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found'
    }
  });
});

// 优雅关闭
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  server.close(async () => {
    logger.info('HTTP server closed');

    await wsManager.close();
    logger.info('WebSocket server closed');

    process.exit(0);
  });

  // 强制关闭
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 启动服务器
server.listen(PORT, HOST, () => {
  logger.info(`SelfClaw Server started`, {
    host: HOST,
    port: PORT,
    environment: NODE_ENV,
    httpUrl: `http://${HOST}:${PORT}`,
    wsUrl: `ws://${HOST}:${PORT}/ws`
  });

  // 初始健康检查
  healthChecker.performCheck();
});

export default server;
