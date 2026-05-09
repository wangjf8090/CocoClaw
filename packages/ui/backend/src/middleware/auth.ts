/**
 * JWT 认证中间件
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../monitoring/logger';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: string;
    permissions: string[];
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'selfclaw-secret-change-in-production';

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'NO_TOKEN',
        message: 'Authentication token required'
      }
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      permissions: decoded.permissions || []
    };
    next();
  } catch (error) {
    logger.warn('Invalid authentication token', { error: error instanceof Error ? error.message : String(error) });
    return res.status(403).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
};

export const requireRole = (requiredRole: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    const roleHierarchy = ['user', 'admin', 'superadmin'];
    const userLevel = roleHierarchy.indexOf(req.user.role);
    const requiredLevel = roleHierarchy.indexOf(requiredRole);

    if (userLevel < requiredLevel) {
      logger.warn('Insufficient permissions', {
        userRole: req.user.role,
        requiredRole
      });
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to perform this action'
        }
      });
    }

    next();
  };
};

export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    if (req.user.role === 'superadmin') {
      return next();
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: `Required permission: ${permission}`
        }
      });
    }

    next();
  };
};

export const generateToken = (user: {
  userId: string;
  username: string;
  role: string;
  permissions?: string[];
}): string => {
  return jwt.sign(
    {
      userId: user.userId,
      username: user.username,
      role: user.role,
      permissions: user.permissions || []
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

export default {
  authenticateToken,
  requireRole,
  requirePermission,
  generateToken
};
