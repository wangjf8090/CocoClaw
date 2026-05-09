/**
 * 关系模型
 * 管理与不同用户的关系状态
 */

import { UserRelationship } from './types';

export class RelationshipModel {
  private relationships: Map<string, UserRelationship>;

  constructor() {
    this.relationships = new Map();
  }

  get(userId: string): UserRelationship {
    let relationship = this.relationships.get(userId);

    if (!relationship) {
      relationship = this.createDefaultRelationship(userId);
      this.relationships.set(userId, relationship);
    }

    return { ...relationship };
  }

  private createDefaultRelationship(userId: string): UserRelationship {
    return {
      userId,
      trustLevel: 50,
      familiarity: 0,
      interactionCount: 0,
      lastInteraction: new Date(),
      tags: [],
      notes: ''
    };
  }

  update(userId: string, updates: Partial<UserRelationship>): void {
    const current = this.get(userId);
    const updated: UserRelationship = {
      ...current,
      ...updates,
      userId // 确保 userId 不被覆盖
    };
    this.relationships.set(userId, updated);
  }

  recordInteraction(userId: string, interactionType: string): void {
    const relationship = this.get(userId);

    relationship.interactionCount++;
    relationship.lastInteraction = new Date();
    relationship.familiarity = Math.min(100, relationship.familiarity + 1);

    // 根据交互类型调整信任度
    if (interactionType === 'positive') {
      relationship.trustLevel = Math.min(100, relationship.trustLevel + 2);
    } else if (interactionType === 'negative') {
      relationship.trustLevel = Math.max(0, relationship.trustLevel - 5);
    } else if (interactionType === 'collaborative') {
      relationship.trustLevel = Math.min(100, relationship.trustLevel + 1);
    }

    this.relationships.set(userId, relationship);
  }

  addTag(userId: string, tag: string): void {
    const relationship = this.get(userId);
    if (!relationship.tags.includes(tag)) {
      relationship.tags.push(tag);
      this.relationships.set(userId, relationship);
    }
  }

  removeTag(userId: string, tag: string): void {
    const relationship = this.get(userId);
    relationship.tags = relationship.tags.filter(t => t !== tag);
    this.relationships.set(userId, relationship);
  }

  setNotes(userId: string, notes: string): void {
    const relationship = this.get(userId);
    relationship.notes = notes;
    this.relationships.set(userId, relationship);
  }

  getAll(): Record<string, UserRelationship> {
    const result: Record<string, UserRelationship> = {};
    for (const [userId, relationship] of this.relationships) {
      result[userId] = { ...relationship };
    }
    return result;
  }

  restore(relationships: Record<string, UserRelationship>): void {
    this.relationships.clear();
    for (const [userId, relationship] of Object.entries(relationships)) {
      this.relationships.set(userId, {
        ...relationship,
        lastInteraction: new Date(relationship.lastInteraction)
      });
    }
  }

  getTrustLevel(userId: string): number {
    return this.get(userId).trustLevel;
  }

  isTrusted(userId: string, threshold: number = 70): boolean {
    return this.getTrustLevel(userId) >= threshold;
  }

  getFamiliarity(userId: string): number {
    return this.get(userId).familiarity;
  }

  getRelationshipLevel(userId: string): 'stranger' | 'acquaintance' | 'friend' | 'partner' {
    const familiarity = this.getFamiliarity(userId);
    const trust = this.getTrustLevel(userId);
    const combined = (familiarity + trust) / 2;

    if (combined >= 80) return 'partner';
    if (combined >= 50) return 'friend';
    if (combined >= 20) return 'acquaintance';
    return 'stranger';
  }

  getGreetingStyle(userId: string): 'formal' | 'friendly' | 'casual' | intimate {
    const level = this.getRelationshipLevel(userId);

    switch (level) {
      case 'partner':
        return 'intimate';
      case 'friend':
        return 'casual';
      case 'acquaintance':
        return 'friendly';
      default:
        return 'formal';
    }
  }

  getTopUsers(limit: number = 10): UserRelationship[] {
    return Array.from(this.relationships.values())
      .sort((a, b) => {
        const aScore = (a.trustLevel + a.familiarity) * a.interactionCount;
        const bScore = (b.trustLevel + b.familiarity) * b.interactionCount;
        return bScore - aScore;
      })
      .slice(0, limit);
  }

  getUsersByTag(tag: string): UserRelationship[] {
    return Array.from(this.relationships.values())
      .filter(r => r.tags.includes(tag));
  }

  searchUsers(query: string): UserRelationship[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.relationships.values())
      .filter(r =>
        r.userId.toLowerCase().includes(lowerQuery) ||
        r.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
        r.notes.toLowerCase().includes(lowerQuery)
      );
  }

  deleteRelationship(userId: string): boolean {
    return this.relationships.delete(userId);
  }

  clear(): void {
    this.relationships.clear();
  }

  getStats(): {
    totalUsers: number;
    avgTrust: number;
    avgFamiliarity: number;
    totalInteractions: number;
  } {
    const relationships = Array.from(this.relationships.values());
    const totalUsers = relationships.length;

    if (totalUsers === 0) {
      return {
        totalUsers: 0,
        avgTrust: 0,
        avgFamiliarity: 0,
        totalInteractions: 0
      };
    }

    const avgTrust = relationships.reduce((sum, r) => sum + r.trustLevel, 0) / totalUsers;
    const avgFamiliarity = relationships.reduce((sum, r) => sum + r.familiarity, 0) / totalUsers;
    const totalInteractions = relationships.reduce((sum, r) => sum + r.interactionCount, 0);

    return {
      totalUsers,
      avgTrust: Math.round(avgTrust * 100) / 100,
      avgFamiliarity: Math.round(avgFamiliarity * 100) / 100,
      totalInteractions
    };
  }
}
