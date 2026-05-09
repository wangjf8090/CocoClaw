/**
 * SOUL 管理路由
 */

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../monitoring/logger';
import { SOULCore } from '@selfclaw/soul';

const router = Router();

// 全局 SOUL 实例（实际应用中应使用依赖注入）
let soulInstance: SOULCore | null = null;

export const setSoulInstance = (soul: SOULCore) => {
  soulInstance = soul;
};

const getSoul = (): SOULCore => {
  if (!soulInstance) {
    throw new Error('SOUL instance not initialized');
  }
  return soulInstance;
};

router.get('/personality', async (req: AuthRequest, res: Response) => {
  try {
    const soul = getSoul();
    const personality = soul.getPersonality();

    res.json({
      success: true,
      data: personality
    });
  } catch (error) {
    logger.error('Error getting personality', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error getting personality'
      }
    });
  }
});

router.put('/personality', async (req: AuthRequest, res: Response) => {
  try {
    const soul = getSoul();
    soul.setPersonality(req.body);

    logger.audit('update_personality', req.user?.userId || 'unknown', req.body);

    res.json({
      success: true,
      data: soul.getPersonality(),
      message: 'Personality updated successfully'
    });
  } catch (error) {
    logger.error('Error updating personality', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error updating personality'
      }
    });
  }
});

router.get('/values', async (req: AuthRequest, res: Response) => {
  try {
    const soul = getSoul();
    const values = soul.getValues();

    res.json({
      success: true,
      data: values
    });
  } catch (error) {
    logger.error('Error getting values', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error getting values'
      }
    });
  }
});

router.put('/values', async (req: AuthRequest, res: Response) => {
  try {
    const soul = getSoul();
    soul.setValues(req.body);

    logger.audit('update_values', req.user?.userId || 'unknown', req.body);

    res.json({
      success: true,
      data: soul.getValues(),
      message: 'Core values updated successfully'
    });
  } catch (error) {
    logger.error('Error updating values', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error updating values'
      }
    });
  }
});

router.get('/emotion', async (req: AuthRequest, res: Response) => {
  try {
    const soul = getSoul();
    const emotion = soul.getEmotionState();

    res.json({
      success: true,
      data: emotion
    });
  } catch (error) {
    logger.error('Error getting emotion', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error getting emotion state'
      }
    });
  }
});

router.post('/emotion/trigger', async (req: AuthRequest, res: Response) => {
  try {
    const soul = getSoul();
    const { stimulus, intensity } = req.body;
    soul.updateEmotion(stimulus, intensity);

    res.json({
      success: true,
      data: soul.getEmotionState(),
      message: 'Emotion updated'
    });
  } catch (error) {
    logger.error('Error triggering emotion', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error triggering emotion'
      }
    });
  }
});

router.get('/relationships', async (req: AuthRequest, res: Response) => {
  try {
    const soul = getSoul();
    const stats = {
      // @ts-ignore - 实际实现中需要调用 relationshipModel
      // stats: soul.relationshipModel.getStats()
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting relationships', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error getting relationships'
      }
    });
  }
});

router.get('/snapshots', async (req: AuthRequest, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    // @ts-ignore - 实际实现中需要调用 persistence
    // const snapshots = await soul.persistence.listSnapshots(limit);

    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    logger.error('Error getting snapshots', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error getting snapshots'
      }
    });
  }
});

router.post('/snapshots', async (req: AuthRequest, res: Response) => {
  try {
    const soul = getSoul();
    const snapshot = await soul.createSnapshot(req.body.description);

    logger.audit('create_snapshot', req.user?.userId || 'unknown', {
      snapshotId: snapshot.id
    });

    res.json({
      success: true,
      data: snapshot,
      message: 'Snapshot created successfully'
    });
  } catch (error) {
    logger.error('Error creating snapshot', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error creating snapshot'
      }
    });
  }
});

router.post('/snapshots/:id/rollback', async (req: AuthRequest, res: Response) => {
  try {
    const soul = getSoul();
    const success = await soul.rollbackToSnapshot(req.params.id);

    if (success) {
      logger.audit('rollback_snapshot', req.user?.userId || 'unknown', {
        snapshotId: req.params.id
      });

      res.json({
        success: true,
        message: 'Rollback successful'
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          code: 'SNAPSHOT_NOT_FOUND',
          message: 'Snapshot not found'
        }
      });
    }
  } catch (error) {
    logger.error('Error rolling back snapshot', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error rolling back snapshot'
      }
    });
  }
});

router.get('/evolution', async (req: AuthRequest, res: Response) => {
  try {
    const soul = getSoul();
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const history = soul.getEvolutionHistory(limit);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('Error getting evolution history', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error getting evolution history'
      }
    });
  }
});

router.post('/catchphrases', async (req: AuthRequest, res: Response) => {
  try {
    const soul = getSoul();
    const { phrase } = req.body;
    soul.addCatchphrase(phrase);

    res.json({
      success: true,
      data: soul.getPersonality().catchphrases,
      message: 'Catchphrase added'
    });
  } catch (error) {
    logger.error('Error adding catchphrase', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error adding catchphrase'
      }
    });
  }
});

export default router;
