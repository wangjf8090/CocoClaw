/**
 * 卫健委公开数据适配器
 * 
 * v3.7.0 M1 药店经营辅助 Skill
 * 对接卫健委公开数据：药品目录/基药目录/医保目录
 * 
 * @version 1.0.0
 * @date 2026-06-15
 * 
 * @TODO 真实数据源接入
 *   - 国家药品监督管理局数据查询 API
 *   - 国家基本药物目录（公开数据）
 *   - 国家医保药品目录（公开数据）
 *   - 药品阳光采购平台数据
 */

import {
  PharmacyDataSource,
  PharmacyCapability,
  DrugInfo,
  InventoryAnalysis,
  InventoryAlert,
  ComplianceCheckResult,
  SubstituteRecommendation,
} from './interfaces';

// ============================================================================
// 常量定义
// ============================================================================

/** 禁售药品关键词（实际需要维护完整列表） */
const PROHIBITED_KEYWORDS = [
  '麻醉药品',
  '第一类精神药品',
  '放射性药品',
  '戒毒药品',
];

// ============================================================================
// 适配器实现
// ============================================================================

/**
 * 卫健委公开数据源适配器
 * 
 * Stub 实现，后续接入真实卫健委公开数据
 */
export class NHcDataSource implements PharmacyDataSource {
  readonly id = 'nhc';
  readonly name = '国家卫健委公开数据';
  readonly priority = 1;
  
  readonly capabilities: PharmacyCapability[] = [
    'drug-info',
    'compliance-check',
    'inventory-analysis',
    'substitute-recommend',
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
    switch (capability) {
      case 'drug-info':
        return this.queryDrugInfo(params) as Promise<T>;
      case 'compliance-check':
        return this.checkCompliance(params) as Promise<T>;
      case 'inventory-analysis':
        return this.analyzeInventory(params) as Promise<T>;
      case 'substitute-recommend':
        return this.getSubstitutes(params) as Promise<T>;
      default:
        throw new Error(`Unsupported capability: ${capability}`);
    }
  }

  /**
   * 查询药品信息
   */
  private async queryDrugInfo(params: Record<string, unknown>): Promise<DrugInfo> {
    const drugName = params.drugName as string;
    
    // TODO: 接入真实卫健委 API
    // 计划接入数据源：
    // 1. 国家药品监督管理局数据查询
    // 2. 国家基本药物目录
    // 3. 国家医保药品目录
    
    // Stub 返回示例数据
    return {
      id: `drug_${Date.now()}`,
      genericName: drugName || '未知药品',
      brandName: drugName,
      dosageForm: '胶囊剂',
      specifications: '0.25g×24粒',
      manufacturer: '某制药有限公司',
      approvalNumber: '国药准字H12345678',
      category: 'OTC-B',
      prescriptionRequired: false,
      medicalInsurance: true,
      essentialMedicine: true,
      indications: ['解热镇痛', '抗炎'],
      usage: '口服',
      contraindications: ['对本品过敏者禁用'],
      warnings: ['请在药师指导下使用'],
      adverseReactions: ['偶有胃肠道不适'],
      storage: '遮光，密封保存',
      priceRange: '15-30元',
      medicalInsurancePrice: '18元',
    };
  }

  /**
   * 合规检查
   */
  private async checkCompliance(params: Record<string, unknown>): Promise<ComplianceCheckResult> {
    const drugName = params.drugName as string;
    
    // TODO: 接入真实合规数据
    // 1. 处方药分类查询
    // 2. 禁售品名单查询
    // 3. 经营资质要求查询
    
    // 检查是否为禁售品
    const isProhibited = PROHIBITED_KEYWORDS.some(k => drugName?.includes(k));
    
    if (isProhibited) {
      return {
        drugName: drugName || '',
        status: 'violation',
        category: '禁售品',
        requirements: [
          {
            type: 'prohibited',
            required: true,
            description: '该药品属于国家禁止零售的类别',
            action: '禁止销售，立即上报',
          },
        ],
        recommendations: [
          '不得销售此类药品',
          '建议联系监管部门',
        ],
      };
    }
    
    // TODO: 实现更完整的合规检查逻辑
    return {
      drugName: drugName || '',
      status: 'compliant',
      category: 'OTC乙类',
      requirements: [
        {
          type: 'prescription',
          required: false,
          description: '非处方药，可直接销售',
          action: '正常销售',
        },
      ],
      recommendations: [
        '确认药品效期',
        '核对包装完整性',
      ],
    };
  }

  /**
   * 库存分析
   */
  private async analyzeInventory(params: Record<string, unknown>): Promise<InventoryAnalysis> {
    const inventoryItems = params.inventory as Array<{
      drugName: string;
      quantity: number;
      expiryDate: string;
      dailySales?: number;
    }> || [];
    
    // TODO: 接入真实库存分析逻辑
    // 1. 效期预警（30天/90天阈值）
    // 2. 库存不足预警（基于日均销量计算）
    // 3. 滞销品识别
    
    const alerts: InventoryAlert[] = [];
    const now = new Date();
    
    for (const item of inventoryItems) {
      const expiryDate = new Date(item.expiryDate);
      const daysToExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // 过期检查
      if (daysToExpiry < 0) {
        alerts.push({
          drugName: item.drugName,
          type: 'expired',
          severity: 'urgent',
          description: `已过期 ${Math.abs(daysToExpiry)} 天`,
          recommendation: '立即下架，联系供应商退货',
          currentQuantity: item.quantity,
          expiryDate: item.expiryDate,
        });
      }
      // 效期预警（30天内）
      else if (daysToExpiry <= 30) {
        alerts.push({
          drugName: item.drugName,
          type: 'expiry',
          severity: 'urgent',
          description: `效期不足 ${daysToExpiry} 天`,
          recommendation: '优先销售，联系供应商处理',
          currentQuantity: item.quantity,
          expiryDate: item.expiryDate,
        });
      }
      // 效期警告（90天内）
      else if (daysToExpiry <= 90) {
        alerts.push({
          drugName: item.drugName,
          type: 'expiry',
          severity: 'warning',
          description: `效期不足 ${daysToExpiry} 天`,
          recommendation: '制定销售计划',
          currentQuantity: item.quantity,
          expiryDate: item.expiryDate,
        });
      }
      
      // 库存不足预警
      if (item.dailySales && item.dailySales > 0) {
        const safeStock = item.dailySales * 7; // 7天安全库存
        if (item.quantity <= safeStock && item.quantity > 0) {
          alerts.push({
            drugName: item.drugName,
            type: 'low-stock',
            severity: daysToExpiry <= 30 ? 'urgent' : 'warning',
            description: `库存 ${item.quantity}，可销售约 ${Math.floor(item.quantity / item.dailySales)} 天`,
            recommendation: '及时补货',
            currentQuantity: item.quantity,
            dailySales: item.dailySales,
          });
        }
      }
    }
    
    return {
      alerts,
      summary: {
        totalItems: inventoryItems.length,
        normalItems: inventoryItems.length - alerts.filter(a => a.severity !== 'info').length,
        warningItems: alerts.filter(a => a.severity === 'warning').length,
        urgentItems: alerts.filter(a => a.severity === 'urgent').length,
      },
    };
  }

  /**
   * 同品替换建议
   */
  private async getSubstitutes(params: Record<string, unknown>): Promise<SubstituteRecommendation> {
    const drugName = params.drugName as string;
    
    // TODO: 接入真实替换建议逻辑
    // 1. 集采药品查询
    // 2. 基药替换建议
    // 3. 同成分不同厂家建议
    
    return {
      originalDrug: drugName || '',
      substitutes: [
        {
          drugName: `${drugName}（集采）`,
          category: '集采',
          priceRange: '10-20元',
          medicalInsurancePrice: '12元',
          advantages: ['价格更低', '质量保证'],
          recommendation: '集采药品，性价比高',
        },
        {
          drugName: `${drugName}（基药）`,
          category: '基药',
          priceRange: '8-18元',
          medicalInsurancePrice: '10元',
          advantages: ['基药报销比例高', '供应稳定'],
          recommendation: '基本药物，优先推荐',
        },
      ],
    };
  }
}

// ============================================================================
// 导出
// ============================================================================

export { NHcDataSource };
export default NHcDataSource;
