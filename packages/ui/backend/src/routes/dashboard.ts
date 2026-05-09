/**
 * Dashboard 路由
 */

import { Router, Response } from 'express';
import { healthChecker } from '../monitoring/health-check';
import { metricsManager } from '../monitoring/metrics';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../monitoring/logger';

const router = Router();

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const health = await healthChecker.performCheck();
    const memoryUsage = process.memoryUsage();

    res.json({
      success: true,
      data: {
        health,
        system: {
          uptime: process.uptime(),
          memory: {
            rss: memoryUsage.rss,
            heapTotal: memoryUsage.heapTotal,
            heapUsed: memoryUsage.heapUsed,
            external: memoryUsage.external
          },
          platform: process.platform,
          nodeVersion: process.version
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error getting dashboard status', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error getting system status'
      }
    });
  }
});

router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const stats = {
      totalMemories: 0,
      totalSessions: 0,
      totalQueries: 0,
      avgResponseTime: 0,
      successRate: 100,
      soulStatus: {
        mood: 'neutral',
        energy: 5,
        trustLevel: 50
      },
      recentActivities: [
        {
          id: '1',
          type: 'system',
          action: 'Service started',
          timestamp: new Date().toISOString()
        }
      ]
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting dashboard stats', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error getting dashboard stats'
      }
    });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsManager.getContentType());
    res.end(await metricsManager.getMetrics());
  } catch (error) {
    logger.error('Error getting metrics', error instanceof Error ? error : new Error(String(error)));
    res.status(500).end('Error getting metrics');
  }
});

router.get('/health', async (req, res) => {
  const status = await healthChecker.performCheck();

  if (status.status === 'unhealthy') {
    res.status(503);
  }

  res.json(status);
});

router.get('/health/live', (req, res) => {
  res.json(healthChecker.getLiveness());
});

router.get('/health/ready', (req, res) => {
  const readiness = healthChecker.getReadiness();
  if (!readiness.ready) {
    res.status(503);
  }
  res.json(readiness);
});

export default router;
