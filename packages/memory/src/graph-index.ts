/**
 * Graph Relation Index
 * 实体-关系图建模
 * 使用 graphology 库，支持路径查询和邻接查询
 * 实体重要性排序（PageRank）
 */

import Graph from 'graphology';
import { pagerank } from 'graphology-metrics/centrality';
import { dijkstra } from 'graphology-shortest-path';
import {
  Entity,
  EntityType,
  Relation,
  RelationType,
  GraphSearchResult,
} from './types.js';

export class GraphIndex {
  private graph: Graph;
  private entities: Map<string, Entity> = new Map();
  private relations: Map<string, Relation> = new Map();
  private pagerankScores: Map<string, number> = new Map();

  constructor() {
    this.graph = new Graph({
      type: 'undirected',
      allowSelfLoops: false,
      multi: false,
    });
  }

  /**
   * 添加实体
   */
  addEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
    
    if (!this.graph.hasNode(entity.id)) {
      this.graph.addNode(entity.id, {
        name: entity.name,
        type: entity.type,
        importance: entity.importance,
        metadata: entity.metadata,
      });
    } else {
      this.graph.setNodeAttributes(entity.id, {
        name: entity.name,
        type: entity.type,
        importance: entity.importance,
        metadata: entity.metadata,
      });
    }
  }

  /**
   * 批量添加实体
   */
  addEntities(entities: Entity[]): void {
    for (const entity of entities) {
      this.addEntity(entity);
    }
  }

  /**
   * 添加关系
   */
  addRelation(relation: Relation): void {
    if (!this.entities.has(relation.source)) {
      throw new Error(`Source entity ${relation.source} does not exist`);
    }
    if (!this.entities.has(relation.target)) {
      throw new Error(`Target entity ${relation.target} does not exist`);
    }

    this.relations.set(relation.id, relation);

    if (!this.graph.hasEdge(relation.source, relation.target)) {
      this.graph.addEdge(relation.source, relation.target, {
        type: relation.type,
        weight: relation.weight,
        metadata: relation.metadata,
      });
    } else {
      const edge = this.graph.findEdge(relation.source, relation.target);
      this.graph.setEdgeAttributes(edge!, {
        type: relation.type,
        weight: relation.weight,
        metadata: relation.metadata,
      });
    }
  }

  /**
   * 批量添加关系
   */
  addRelations(relations: Relation[]): void {
    for (const relation of relations) {
      this.addRelation(relation);
    }
  }

  /**
   * 从文本中提取实体（简化版）
   */
  extractEntitiesFromText(text: string, memoryId: string): Entity[] {
    const entities: Entity[] = [];
    const foundEntities = new Set<string>();

    // 检查现有实体是否在文本中出现
    for (const [id, entity] of this.entities) {
      if (text.includes(entity.name)) {
        foundEntities.add(id);
        entities.push(entity);
      }
    }

    // 如果没有找到现有实体，可以尝试创建新实体
    // 这里简化处理，实际应该使用NER工具

    return entities;
  }

  /**
   * 计算PageRank重要性分数
   */
  computePagerank(): void {
    const scores = pagerank(this.graph, {
      getEdgeWeight: (edge) => this.graph.getEdgeAttribute(edge, 'weight') || 1,
    });

    this.pagerankScores = new Map(Object.entries(scores));
  }

  /**
   * 搜索相关实体
   */
  search(
    query: string,
    limit: number = 10,
    types?: EntityType[]
  ): GraphSearchResult[] {
    const results: GraphSearchResult[] = [];

    // 匹配实体名称
    for (const [id, entity] of this.entities) {
      let score = 0;

      // 字符串匹配分数
      if (entity.name.toLowerCase().includes(query.toLowerCase())) {
        const exactMatch = entity.name.toLowerCase() === query.toLowerCase();
        score = exactMatch ? 1.0 : 0.7 * (query.length / entity.name.length);
      }

      // 加上PageRank分数
      const pagerankScore = this.pagerankScores.get(id) || 0;
      score = score * 0.7 + pagerankScore * 0.3;

      // 类型过滤
      if (types && types.length > 0 && !types.includes(entity.type)) {
        continue;
      }

      if (score > 0) {
        results.push({
          entity,
          score,
        });
      }
    }

    // 按分数排序
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * 查找相邻实体
   */
  getNeighbors(entityId: string, depth: number = 1): Entity[] {
    if (!this.entities.has(entityId)) {
      return [];
    }

    const visited = new Set<string>([entityId]);
    const result: Entity[] = [];
    let currentLevel = [entityId];

    for (let d = 0; d < depth; d++) {
      const nextLevel: string[] = [];
      
      for (const currentId of currentLevel) {
        const neighbors = this.graph.neighbors(currentId);
        
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            nextLevel.push(neighborId);
            
            const entity = this.entities.get(neighborId);
            if (entity) {
              result.push(entity);
            }
          }
        }
      }
      
      currentLevel = nextLevel;
      if (currentLevel.length === 0) break;
    }

    return result;
  }

  /**
   * 查找两个实体之间的最短路径
   */
  findPath(sourceId: string, targetId: string): Entity[] | null {
    if (!this.entities.has(sourceId) || !this.entities.has(targetId)) {
      return null;
    }

    const path = dijkstra.bidirectional(this.graph, sourceId, targetId);
    
    if (!path) return null;

    return path
      .map(id => this.entities.get(id))
      .filter((e): e is Entity => e !== undefined);
  }

  /**
   * 获取社区/聚类
   */
  getCommunities(minSize: number = 3): Entity[][] {
    const visited = new Set<string>();
    const communities: Entity[][] = [];

    for (const entityId of this.graph.nodes()) {
      if (visited.has(entityId)) continue;

      // BFS查找连通分量
      const community: Entity[] = [];
      const queue = [entityId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        const entity = this.entities.get(current);
        if (entity) {
          community.push(entity);
        }

        for (const neighbor of this.graph.neighbors(current)) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }

      if (community.length >= minSize) {
        communities.push(community);
      }
    }

    return communities;
  }

  /**
   * 获取最具影响力的实体
   */
  getTopEntities(limit: number = 10, type?: EntityType): Entity[] {
    this.computePagerank();

    const sorted = Array.from(this.pagerankScores.entries())
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score);

    const result: Entity[] = [];
    for (const { id } of sorted) {
      const entity = this.entities.get(id);
      if (!entity) continue;
      if (type && entity.type !== type) continue;
      result.push(entity);
      if (result.length >= limit) break;
    }

    return result;
  }

  /**
   * 获取实体的关系
   */
  getEntityRelations(entityId: string): Relation[] {
    const relations: Relation[] = [];

    for (const [, relation] of this.relations) {
      if (relation.source === entityId || relation.target === entityId) {
        relations.push(relation);
      }
    }

    return relations;
  }

  /**
   * 删除实体
   */
  removeEntity(entityId: string): boolean {
    if (!this.entities.has(entityId)) return false;

    this.entities.delete(entityId);
    this.pagerankScores.delete(entityId);

    // 删除相关关系
    for (const [relationId, relation] of this.relations) {
      if (relation.source === entityId || relation.target === entityId) {
        this.relations.delete(relationId);
      }
    }

    if (this.graph.hasNode(entityId)) {
      this.graph.dropNode(entityId);
    }

    return true;
  }

  /**
   * 删除关系
   */
  removeRelation(relationId: string): boolean {
    const relation = this.relations.get(relationId);
    if (!relation) return false;

    this.relations.delete(relationId);

    const edge = this.graph.findEdge(relation.source, relation.target);
    if (edge) {
      this.graph.dropEdge(edge);
    }

    return true;
  }

  /**
   * 获取统计信息
   */
  getStats(): { entities: number; relations: number; density: number } {
    return {
      entities: this.entities.size,
      relations: this.relations.size,
      density: this.graph.density,
    };
  }

  /**
   * 清空图
   */
  clear(): void {
    this.entities.clear();
    this.relations.clear();
    this.pagerankScores.clear();
    this.graph.clear();
  }

  /**
   * 导出图数据
   */
  export(): { entities: Entity[]; relations: Relation[] } {
    return {
      entities: Array.from(this.entities.values()),
      relations: Array.from(this.relations.values()),
    };
  }

  /**
   * 导入图数据
   */
  import(data: { entities: Entity[]; relations: Relation[] }): void {
    this.clear();
    this.addEntities(data.entities);
    this.addRelations(data.relations);
    this.computePagerank();
  }

  /**
   * 获取所有实体
   */
  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  /**
   * 获取所有关系
   */
  getAllRelations(): Relation[] {
    return Array.from(this.relations.values());
  }
}
