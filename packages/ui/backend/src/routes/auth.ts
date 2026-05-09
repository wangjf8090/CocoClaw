/**
 * 认证路由
 */

import { Router, Request, Response } from 'express';
import { generateToken } from '../middleware/auth';
import { logger } from '../monitoring/logger';

const router = Router();

// 默认管理员账户（生产环境应从数据库获取）
const DEFAULT_USERS = {
  admin: {
    password: 'admin123',
    role: 'admin',
    permissions: ['read', 'write', 'delete', 'configure', 'manage_users']
  },
  user: {
    password: 'user123',
    role: 'user',
    permissions: ['read']
  }
};

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Username and password are required'
        }
      });
    }

    const user = DEFAULT_USERS[username as keyof typeof DEFAULT_USERS];

    if (!user || user.password !== password) {
      logger.warn('Failed login attempt', { username });
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password'
        }
      });
    }

    const token = generateToken({
      userId: username,
      username,
      role: user.role,
      permissions: user.permissions
    });

    logger.info('User logged in', { username, role: user.role });

    res.json({
      success: true,
      data: {
        accessToken: token,
        user: {
          username,
          role: user.role,
          permissions: user.permissions
        }
      }
    });
  } catch (error) {
    logger.error('Login error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  // 在实际应用中，这里会将 token 加入黑名单
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

router.get('/me', (req: Request, res: Response) => {
  // 这里应从 token 中解析用户信息
  res.json({
    success: true,
    data: {
      authenticated: true,
      message: 'Authenticated'
    }
  });
});

export default router;
