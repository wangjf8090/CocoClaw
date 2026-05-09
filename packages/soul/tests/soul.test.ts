/**
 * SOUL 模块测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'node:test';
import { SOULCore, createSOUL } from '../src';

describe('SOULCore', () => {
  let soul: SOULCore;

  beforeEach(async () => {
    soul = new SOULCore({
      dataPath: './test-data/soul',
      autoSave: false
    });
    await soul.initialize();
  });

  afterEach(async () => {
    await soul.shutdown();
  });

  it('should initialize with default personality', () => {
    const personality = soul.getPersonality();
    expect(personality.name).toBe('Claw');
    expect(personality.nickname).toBe('小爪');
    expect(personality.catchphrases.length).toBeGreaterThan(0);
  });

  it('should have default core values', () => {
    const values = soul.getValues();
    expect(values.priorities.length).toBeGreaterThan(0);
    expect(values.boundaries.length).toBeGreaterThan(0);
  });

  it('should update personality traits', () => {
    soul.setPersonality({ name: 'NewName' });
    const personality = soul.getPersonality();
    expect(personality.name).toBe('NewName');
  });

  it('should update emotion state', () => {
    soul.updateEmotion('positive_feedback', 0.5);
    const emotion = soul.getEmotionState();
    expect(emotion.mood).toBeDefined();
  });

  it('should generate reply styles', () => {
    const style = soul.generateReplyStyle();
    expect(typeof style).toBe('string');
    expect(style.length).toBeGreaterThan(0);
  });

  it('should add catchphrases', () => {
    const newPhrase = '测试口头禅';
    soul.addCatchphrase(newPhrase);
    const personality = soul.getPersonality();
    expect(personality.catchphrases).toContain(newPhrase);
  });

  it('should manage user relationships', () => {
    const userId = 'test-user-1';
    soul.updateUserRelationship(userId, { tags: ['developer'] });
    const relationship = soul.getUserRelationship(userId);
    expect(relationship.userId).toBe(userId);
    expect(relationship.tags).toContain('developer');
  });

  it('should record interactions', () => {
    const userId = 'test-user-2';
    soul.recordInteraction(userId, 'positive');
    const relationship = soul.getUserRelationship(userId);
    expect(relationship.interactionCount).toBe(1);
    expect(relationship.trustLevel).toBeGreaterThan(50);
  });

  it('should create snapshots', async () => {
    const snapshot = await soul.createSnapshot('Test snapshot');
    expect(snapshot.id).toBeDefined();
    expect(snapshot.personality.name).toBe('Claw');
  });

  it('should validate actions', () => {
    const result1 = soul.validateAction('正常操作');
    expect(result1.allowed).toBe(true);

    const result2 = soul.validateAction('用户隐私保护');
    expect(result2.allowed).toBe(false);
  });
});
