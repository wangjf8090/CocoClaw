/**
 * PubMed 文献检索适配器
 * 
 * v3.7.0 M1 药店经营辅助 Skill
 * 对接 PubMed 文献数据库（药物相互作用查询）
 * 
 * @version 1.0.0
 * @date 2026-06-15
 * 
 * @TODO 真实数据源接入
 *   - PubMed E-utilities API
 *   - DrugBank 公开数据
 *   - NCBI Drug Information Portal
 */

import {
  PharmacyDataSource,
  PharmacyCapability,
  DrugInteraction,
} from './interfaces';

// ============================================================================
// 常量定义
// ============================================================================

/** 常见药物相互作用数据库（Stub） */
const KNOWN_INTERACTIONS: Record<string, Record<string, DrugInteraction>> = {
  '阿司匹林': {
    '布洛芬': {
      drug1: '阿司匹林',
      drug2: '布洛芬',
      severity: 'moderate',
      description: '布洛芬可能降低阿司匹林的心血管保护作用',
      recommendation: '如需同时使用，请在医生指导下进行',
      mechanism: '竞争性抑制',
    },
    '华法林': {
      drug1: '阿司匹林',
      drug2: '华法林',
      severity: 'severe',
      description: '两药联用显著增加出血风险',
      recommendation: '禁止联用，或在严密监测下使用',
      mechanism: '抗凝作用叠加',
    },
  },
  '阿莫西林': {
    '甲硝唑': {
      drug1: '阿莫西林',
      drug2: '甲硝唑',
      severity: 'mild',
      description: '联用可增强抗感染效果',
      recommendation: '可按医嘱联用',
      mechanism: '协同作用',
    },
  },
  '二甲双胍': {
    '酒精': {
      drug1: '二甲双胍',
      drug2: '酒精',
      severity: 'severe',
      description: '酒精增加乳酸酸中毒风险',
      recommendation: '用药期间避免饮酒',
      mechanism: '抑制乳酸代谢',
    },
  },
};

// ============================================================================
// 适配器实现
// ============================================================================

/**
 * PubMed 数据源适配器
 * 
 * Stub 实现，后续接入真实 PubMed/DrugBank 数据
 */
export class PubMedDataSource implements PharmacyDataSource {
  readonly id = 'pubmed';
  readonly name = 'PubMed 文献数据库';
  readonly priority = 3;
  
  readonly capabilities: PharmacyCapability[] = [
    'drug-interaction',
  ];

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    // TODO: 接入真实 API 后实现
    return true;
  }

  /**
   * 查询数据
   */
  async query<T>(
    capability: PharmacyCapability,
    params: Record<string, unknown>
  ): Promise<T> {
    if (capability === 'drug-interaction') {
      return this.checkDrugInteraction(params) as Promise<T>;
    }
    throw new Error(`Unsupported capability: ${capability}`);
  }

  /**
   * 检查药物相互作用
   */
  private async checkDrugInteraction(params: Record<string, unknown>): Promise<DrugInteraction[]> {
    const drug1 = params.drug1 as string;
    const drug2 = params.drug2 as string;
    
    // TODO: 接入真实 PubMed E-utilities API
    // 计划接入数据源：
    // 1. PubMed Drug Information Portal
    // 2. DrugBank 公开数据
    // 3. NCBI APIs
    
    // 先查已知的相互作用
    const interactions: DrugInteraction[] = [];
    
    // 检查 drug1 对 drug2 的相互作用
    if (drug1 && KNOWN_INTERACTIONS[drug1]) {
      const interaction = KNOWN_INTERACTIONS[drug1][drug2];
      if (interaction) {
        interactions.push(interaction);
      }
    }
    
    // 检查 drug2 对 drug1 的相互作用（对称）
    if (drug2 && KNOWN_INTERACTIONS[drug2]) {
      const interaction = KNOWN_INTERACTIONS[drug2][drug1];
      if (interaction) {
        // 避免重复
        if (!interactions.some(i => i.drug1 === interaction.drug1 && i.drug2 === interaction.drug2)) {
          interactions.push({
            ...interaction,
            drug1: drug2,
            drug2: drug1,
          });
        }
      }
    }
    
    // 如果没有已知相互作用，返回空结果（后续可查询文献）
    if (interactions.length === 0) {
      return [];
    }
    
    return interactions;
  }
}

// ============================================================================
// 导出
// ============================================================================

export { PubMedDataSource };
export default PubMedDataSource;
