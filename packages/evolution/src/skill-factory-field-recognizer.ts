/**
 * 垂类识别引擎 (Field Recognizer)
 * 
 * 基于 SelfClaw v3.2.0 Context Compression 的意图识别能力扩展，
 * 为金融、医疗、学术、法律四大垂直领域提供智能识别能力。
 * 
 * 核心能力：
 * 1. 垂类分类 - 根据用户输入识别所属垂直领域
 * 2. 意图识别 - 继承 v3.2.0 的 8 类意图分类
 * 3. 子领域识别 - 识别具体子领域（如"股票分析"、"药品检索"）
 * 4. 能力建议 - 根据垂类建议所需能力
 * 5. 复杂度评估 - 评估任务复杂度
 * 
 * 设计原则：
 * - 中文正则不使用 \b 边界，改用字符类
 * - 支持多候选结果返回
 * - 置信度阈值可配置
 * 
 * v3.6.0 新增模块
 */

import type {
  FieldType,
  FieldClassification,
  FieldCandidate,
  FieldIntent,
  IntentRecognition,
  ConfidenceThresholds,
  ComplexityLevel,
  ComplexityEstimate,
} from "./types.js";
import { 
  DEFAULT_CONFIDENCE_THRESHOLDS, 
  FIELD_CAPABILITY_SUGGESTIONS,
  DEFAULT_COMPLEXITY_MAP 
} from "./types.js";

// ============================================================================
// 垂类识别正则规则
// ============================================================================

/**
 * 垂类关键词正则（中文不用 \b 边界，使用字符类）
 * 
 * 注意：中文词没有空格分隔，\b 边界对中文无效
 * 解决：使用字符类 + 前后文判断
 */
interface FieldPatterns {
  /** 金融关键词 */
  financial: RegExp[];
  /** 医疗关键词 */
  medical: RegExp[];
  /** 学术关键词 */
  academic: RegExp[];
  /** 法律关键词 */
  legal: RegExp[];
}

/**
 * 金融垂类关键词正则
 * 
 * 匹配场景：
 * - 股票相关："股票"、"A股"、"港股"、"美股"、"股价"、"K线"
 * - 基金相关："基金"、"净值"、"申购"、"赎回"
 * - 财报相关："财报"、"年报"、"季报"、"净利润"、"营收"
 * - 行情相关："实时行情"、"涨跌"、"成交量"
 * - 数据源相关："万得"、"Wind"
 */
const FINANCIAL_PATTERNS: RegExp[] = [
  // 股票/基金
  /股[票市]|[AB]股|港[股市]|美[股市]|创[业板]|科创板|沪深/,
  /[涨跌跌]幅|[股基]价|[股基]指|指[数点]/,
  /K[线图]|MACD|BOLL|MA[5-60]?|KDJ|RSI/,
  /量[子化]|换[手率]|市[值盈率]|PE|PB|RO[ES]/,
  // 基金
  /基[金净值]|申[购赎]|定[投开]|封[闭开]式/,
  /净[值增长]|分红|规[模模]/,
  // 财报
  /[年季中]报|财[务报]|资产[负债]?|利润[表]|现金流[量]/,
  /[净]利[润息]|营[收收]|同[比增]?长|[毛]利[率]?/,
  // 行情
  /实时|当[前日昨]|开[盘收]|最高|最低/,
  // 数据源
  /万[得得]|Wind|WIN[DD]/,
  // 证券
  /券[商商]|托管|承销|[公私]募|衍[生生品]|期[货权]/,
];

/**
 * 医疗垂类关键词正则
 * 
 * 匹配场景：
 * - 药品相关："药品"、"药物"、"吃药"、"服药"、"药名"、"剂量"
 * - 诊断相关："诊断"、"症状"、"检查"、"报告"、"指标"
 * - 体检相关："体检"、"报告解读"、"血常规"、"尿检"
 * - 疾病相关："疾病"、"病症"、"治疗"、"疗法"、"手术"
 * - 医学文献："PubMed"、"医学"、"临床"、"指南"
 * - 数据源相关："中康"、"卓睦鸟"
 */
const MEDICAL_PATTERNS: RegExp[] = [
  // 药品
  /[药藥品物]|吃[药服]|服[药用]|剂[量型]|处[方药]|适[应症]/,
  /不良?反[应应]|禁忌[症]|相互[作用]?|[浓]?度/,
  /阿[司匹林莫西林]|二甲双胍|布洛芬|头[孢孢]/,
  // 诊断/症状
  /诊[断断查]|症[状]|体[征温]|检[查验]|化[验检]/,
  /血[常规压糖脂]|尿[常规检]|心[电图电图]|CT|MRI|B超/,
  /[血尿]糖|[血胆]固[醇]|转氨酶|肌酐|尿素氮/,
  // 体检
  /体[检查]|报[告解]|健[康康]|[体身]高|体[重脂]/,
  /[异常正常]|临界|偏高|偏低|复查/,
  // 疾病
  /疾[病患]|病[情症]|治[疗法]|手[术术]|住[院院]/,
  /糖[尿病]|高[血壓脂]|肿[瘤癌]|感染|炎症/,
  /[肺心脑]部|[肝肾胃]功能|[免疫]?系统/,
  // 医学文献
  /PubMed|医学|临[床验]|指[南南]|共[识识]/,
  /临床[试验研究]|随机对照|meta分析/,
  // 数据源
  /中康|卓睦鸟|医[疗药]?[疗数据库]/,
  // 紧急症状
  /[胸剧]痛|呼[吸困]?难|昏[迷厥]|休克|高热/,
];

/**
 * 学术垂类关键词正则
 * 
 * 匹配场景：
 * - 论文相关："论文"、"文献"、"发表"、"期刊"、"会议"
 * - 研究相关："研究"、"实验"、"方法"、"结果"、"结论"
 * - 检索相关："检索"、"搜索"、"查询"、"DOI"、"PMID"
 * - 影响因子："影响因子"、"IF"、"JCR"、"分区"
 * - 引用相关："引用"、"参考文献"、"被引"、"影响"
 * - 数据源相关："PubMed"、"arXiv"、"IEEE"
 */
const ACADEMIC_PATTERNS: RegExp[] = [
  // 论文/文献
  /论[文文献]|文[献章稿]|发[表表]|期[刊物]|会[议论]|学[术报]/,
  /摘要|全文|[正]?引言|方[法论]|结[果论果]|讨[论文]|参[考献]/,
  /SCI|E[Ii]|S[Sc]i|C[Ss]ci|nature|science|cell/,
  // 研究/实验
  /研[究究]|实[验验]|方[法论]|数[据据]|结[果论果]|结[论]/,
  /对[照组]|样[本本]|p值|显著[性差]|置信区间/,
  /随[机对照]|双盲|前瞻|回顾|横断面/,
  // 检索
  /检[索索]|搜[索索]|查[找询]|索[引引]|关[键键]?词/,
  /[文文]献检[索索]|高级[搜检]|布尔|MeSH/,
  // DOI/PMID
  /DOI|PMID|PMCID|arXiv|bioRxiv/,
  // 影响因子
  /影响?因[子zi]|IF|JCR|分[区]|Q[1-4]|中[科核]心/,
  /[高顶尖]期刊|[权权]威期刊|[核心区]/?,
  // 引用
  /引[用文]|参[考献]|文献[综评述]|综[述评]|述评/,
  /被[引次]|影[响引]|引[用文]|参[考献]列表/,
  // 数据源
  /PubMed|Web of Science|Scopus|IEEE Xplore|arxiv/,
];

/**
 * 法律垂类关键词正则
 * 
 * 匹配场景：
 * - 合规相关："合规"、"GDPR"、"CCPA"、"隐私"、"数据保护"
 * - 合同相关："合同"、"协议"、"条款"、"约定"、"签署"
 * - 政策相关："政策"、"条款"、"声明"、"须知"
 * - 数据相关："个人数据"、"数据处理"、"Cookie"、"同意"
 * - 法律文书："法务"、"律师"、"法律意见"、"免责声明"
 * - 监管相关："监管"、"处罚"、"整改"、"合规检查"
 */
const LEGAL_PATTERNS: RegExp[] = [
  // 合规
  /[合规]|GDPR|CCPA|COPPA|隐私[政策保护]/,
  /[数据]保[护育]|个[人信息]|身[份]?识别|可[穿戴设备]/,
  /[数据]主体|数据[控制处理]者|数据保护官|DPO/,
  // 合同/协议
  /合[同协议]|协议|条[款款]|约[定定]|签[署订]/,
  /[服务用户]条款|使用协议|授权[协议书]|许可[证协议]/,
  /[终止解约]条款|违[约约]|赔[偿偿]|责任[范围限]/,
  // 政策/声明
  /政[策定]|声[明明]|须[知知]|注意[事项项]/,
  /Cookie|追[踪踪]|[同拒]?意|偏[好设置]|选择退出/,
  /[免职]责[声明]|风[险险]提[示示]|版权[声明]|知识产权/,
  // 数据处理
  /[数据]处[理]|跨境[传输]|数据[迁[移保留]|删除[权]/,
  /[访问更是正]?数据|数[据]?可携[带移]|限制[处理]/,
  /[泄露违规]?通知|72[小时]?内|数据[泄露安全]/,
  // 法律文书
  /法[务律]|律[师师]|法律[意见咨询]|诉讼|仲裁/,
  /免[责责]声明|风险[揭示]|不可抗力|争议解决/,
  // 监管
  /[监管督]|[处罚罚]|整[改顿]|合规[检审]?查|审计/,
  /[罚金款]|停业|[吊销]|营业[执照照]|行政处罚/,
];

/**
 * 所有垂类正则映射
 */
const FIELD_PATTERNS: FieldPatterns = {
  financial: FINANCIAL_PATTERNS,
  medical: MEDICAL_PATTERNS,
  academic: ACADEMIC_PATTERNS,
  legal: LEGAL_PATTERNS,
};

// ============================================================================
// 意图识别正则
// ============================================================================

/**
 * 8 类意图识别正则（中文不用 \b 边界）
 * 
 * 继承自 v3.2.0 Orchestrator 的 GoalIntent 类型
 * - audit: 审计/扫描
 * - optimize: 优化/改进
 * - deploy: 部署/发布
 * - analyze: 分析/调研
 * - manage: 管理/配置
 * - create: 创建/生成
 * - monitor: 监控/追踪
 * - mixed: 混合意图
 */
const INTENT_PATTERNS: Record<FieldIntent, RegExp[]> = {
  // 审计/扫描
  audit: [
    /审[计查核]|检[查验]|核[对对查]|扫[描描]|测[试试]|评[估审]/,
    /[合规]?检[查审]|风险[评审]?|漏洞[扫检]|安全[审检]/,
  ],
  // 优化/改进
  optimize: [
    /优[化改进]|提[升高]|增[强加]|完[善善]|调[整整]?/,
    /精简|压缩|简化|减少|降低|提速|加速/,
  ],
  // 部署/发布
  deploy: [
    /部[署署]|发[布布]|发[布布]|上[架线]|发[布布]/,
    /发[布布]|发[布布]|运[维维]|发[布布]|[运维]|发[布布]/,
  ],
  // 分析/调研
  analyze: [
    /分[析析]|研[究究]|调[研查]|评[估估]|考[察察]|研判/,
    /[对对]比|比[较析]|评[估判]|预[测判]|趋势|洞察/,
  ],
  // 管理/配置
  manage: [
    /管[理理]|配[置置]|设[置定]|调[整整]?|控[制制]|操[作纵]/,
    /[启停]用|开[启用]|禁[用止]|[启停]动|[启停]动/,
  ],
  // 创建/生成
  create: [
    /创[建造]|生[成成]|编[写辑]|制[作作]|写[作]/,
    /生成|创建|新建|起草|撰写|编写|制作/,
  ],
  // 监控/追踪
  monitor: [
    /监[控测]|追[踪踪]|跟[踪踪]|观[测察]|监[视看]|预警/,
    /报[警警]|告警|提醒|追[踪踪]|跟踪|实时/,
  ],
  // 混合意图
  mixed: [
    /.+[和与及加]\\s*.+|.+/,  // 多个动词组合
  ],
};

// ============================================================================
// 子领域识别
// ============================================================================

/**
 * 子领域关键词映射
 */
const SUB_DOMAIN_PATTERNS: Record<FieldType, Record<string, RegExp[]>> = {
  financial: {
    "股票分析": [/股[票分析]|K[线图]|技术[指标分析]|趋势[分析分析]/],
    "基金评估": [/基[金评]|净值[评分]|基金经理|业绩[比较评]/],
    "财报分析": [/财[报务]|[年季中]报|财务[指标分析]|盈利[预测析]/],
    "估值分析": [/估[值析]|PE|PB|[市账]值|[绝相]对估值/],
    "行业研究": [/行[业研]|板块[研究分析]|产业链|赛道/],
  },
  medical: {
    "药品查询": [/药[品查]|说明[书查]|适应症|禁忌|用法用量/],
    "诊断辅助": [/诊[断断]|[辅助参考]|鉴别[诊断]|诊疗/],
    "体检解读": [/体[检报]|报[告解]|指标[解读析]|健康[建议]/],
    "慢病管理": [/慢[性病]|糖[尿病]|高[血壓]|高[血壓脂]|管理/],
    "文献检索": [/医学[文献检索]|临床[指南研究]|PubMed/],
  },
  academic: {
    "文献检索": [/文献检[索]|论文检[索]|高级搜[索]|MeSH/],
    "趋势分析": [/趋势[分析]|研究热点|前沿[进展]|发展[动态]/],
    "引用分析": [/引[用文]|被引[次数]|影响[因子]|H指数/],
    "论文写作": [/论[文写]|摘要[写作]|参[考献]|投稿/],
  },
  legal: {
    "隐私政策": [/隐私[政策]|个人信息|数据保护|GDPR/],
    "服务条款": [/服务条款|使用协议|用户协议|授权/],
    "Cookie政策": [/Cookie|追踪|同意|选择退出/],
    "数据处理协议": [/DPA|数据处理[协议]|数据控制者|处理者/],
    "合规检查": [/合规[检查]|差距分析|风险评估|整改/],
  },
};

// ============================================================================
// 垂类识别引擎类
// ============================================================================

/**
 * 垂类识别引擎
 * 
 * 根据用户输入识别所属垂直领域，支持：
 * - 垂类分类（金融/医疗/学术/法律）
 * - 意图识别（继承 v3.2.0 的 8 类意图）
 * - 子领域识别
 * - 能力建议
 * - 复杂度评估
 */
export class FieldRecognizer {
  private confidenceThresholds: ConfidenceThresholds;
  private enableMultiCandidate: boolean;

  /**
   * 创建垂类识别引擎
   * 
   * @param config 配置
   * @param config.confidenceThresholds 置信度阈值配置
   * @param config.enableMultiCandidate 是否启用多候选结果
   */
  constructor(config?: {
    confidenceThresholds?: ConfidenceThresholds;
    enableMultiCandidate?: boolean;
  }) {
    this.confidenceThresholds = config?.confidenceThresholds ?? DEFAULT_CONFIDENCE_THRESHOLDS;
    this.enableMultiCandidate = config?.enableMultiCandidate ?? true;
  }

  /**
   * 识别垂类
   * 
   * @param userInput 用户输入
   * @param metadata 可选元数据
   * @returns 垂类识别结果
   */
  classify(userInput: string, metadata?: { context?: string }): FieldClassification {
    const input = this.preprocessInput(userInput, metadata?.context);
    
    // 1. 计算各垂类得分
    const fieldScores = this.calculateFieldScores(input);
    
    // 2. 获取最高得分垂类
    const topField = this.getTopField(fieldScores);
    
    // 3. 识别子领域
    const subDomain = this.identifySubDomain(input, topField.field);
    
    // 4. 收集识别证据
    const evidence = this.collectEvidence(input, topField.field);
    
    // 5. 建议所需能力
    const requiredCapabilities = this.suggestCapabilities(topField.field, subDomain);
    
    // 6. 构建结果
    const result: FieldClassification = {
      field: topField.field,
      confidence: topField.confidence,
      subDomain,
      requiredCapabilities,
      evidence,
    };

    // 7. 如果启用多候选且置信度低于阈值，添加候选列表
    if (this.enableMultiCandidate && topField.confidence < this.confidenceThresholds.high) {
      result.candidates = this.generateCandidates(fieldScores, topField.field);
    }

    return result;
  }

  /**
   * 识别意图
   * 
   * @param userInput 用户输入
   * @returns 意图识别结果
   */
  recognizeIntent(userInput: string): IntentRecognition {
    const input = this.preprocessInput(userInput);
    
    // 1. 计算各意图得分
    const intentScores = this.calculateIntentScores(input);
    
    // 2. 获取最高得分意图
    const topIntent = this.getTopIntent(intentScores);
    
    // 3. 检查是否混合意图
    const intents = this.detectMixedIntents(intentScores, topIntent.confidence);
    
    return {
      intent: topIntent.intent,
      confidence: topIntent.confidence,
      matchedKeywords: topIntent.matchedKeywords,
      intents: intents.length > 1 ? intents : undefined,
    };
  }

  /**
   * 建议所需能力
   * 
   * @param field 垂类
   * @param subDomain 子领域
   * @returns 能力列表
   */
  suggestCapabilities(field: FieldType, subDomain?: string): string[] {
    const baseCapabilities = FIELD_CAPABILITY_SUGGESTIONS[field] ?? [];
    
    // 如果有子领域，可以进一步细化
    if (subDomain) {
      // TODO: 根据子领域进一步细化能力列表
      return [...baseCapabilities];
    }
    
    return baseCapabilities;
  }

  /**
   * 评估复杂度
   * 
   * @param field 垂类
   * @param userInput 用户输入
   * @returns 复杂度评估结果
   */
  estimateComplexity(field: FieldType, userInput: string): ComplexityEstimate {
    const input = this.preprocessInput(userInput);
    
    // 基础复杂度
    const baseComplexity = DEFAULT_COMPLEXITY_MAP[field];
    const baseScore = { simple: 1, moderate: 3, complex: 5 }[baseComplexity];
    
    // 根据输入长度调整
    const lengthScore = Math.min(Math.floor(input.length / 100), 2);
    
    // 根据意图调整
    const intentRecognition = this.recognizeIntent(input);
    const intentComplexity = intentRecognition.intent === "mixed" ? 1 : 0;
    
    // 综合评分
    const totalScore = Math.min(baseScore + lengthScore + intentComplexity, 5);
    
    // 确定复杂度等级
    let level: ComplexityLevel;
    if (totalScore <= 2) {
      level = "simple";
    } else if (totalScore <= 4) {
      level = "moderate";
    } else {
      level = "complex";
    }
    
    // 预估 token 消耗
    const estimatedTokens = totalScore * 500 + input.length * 2;
    
    return {
      level,
      score: totalScore,
      reasons: [
        `基础${baseComplexity}复杂度`,
        lengthScore > 0 ? `输入长度较长（${input.length}字）` : undefined,
        intentComplexity > 0 ? "混合意图" : undefined,
      ].filter(Boolean) as string[],
      estimatedTokens,
    };
  }

  /**
   * 预处理输入
   * 
   * @param input 用户输入
   * @param context 上下文
   * @returns 预处理后的输入
   */
  private preprocessInput(input: string, context?: string): string {
    // 合并上下文
    const combined = context ? `${input} ${context}` : input;
    
    // 统一空白字符
    return combined.replace(/\s+/g, " ").trim().toLowerCase();
  }

  /**
   * 计算各垂类得分
   * 
   * @param input 预处理后的输入
   * @returns 各垂类得分
   */
  private calculateFieldScores(input: string): Map<FieldType, number> {
    const scores = new Map<FieldType, number>();

    for (const [field, patterns] of Object.entries(FIELD_PATTERNS) as [FieldType, RegExp[]][]) {
      let matchCount = 0;
      const matchedPatterns: string[] = [];

      for (const pattern of patterns) {
        if (pattern.test(input)) {
          matchCount++;
          matchedPatterns.push(pattern.source);
        }
      }

      // 计算置信度：匹配数 / 总模式数，并考虑匹配密度
      const baseConfidence = matchCount / patterns.length;
      const densityBonus = Math.min(matchCount * 0.05, 0.2); // 额外匹配给予加分
      const confidence = Math.min(baseConfidence + densityBonus, 1);

      scores.set(field, confidence);
    }

    return scores;
  }

  /**
   * 获取最高得分垂类
   * 
   * @param scores 各垂类得分
   * @returns 最高得分垂类
   */
  private getTopField(scores: Map<FieldType, number>): { field: FieldType; confidence: number } {
    let topField: FieldType = "financial";
    let maxScore = 0;

    for (const [field, score] of scores) {
      if (score > maxScore) {
        maxScore = score;
        topField = field;
      }
    }

    return { field: topField, confidence: maxScore };
  }

  /**
   * 识别子领域
   * 
   * @param input 预处理后的输入
   * @param field 垂类
   * @returns 子领域
   */
  private identifySubDomain(input: string, field: FieldType): string | undefined {
    const subDomainPatterns = SUB_DOMAIN_PATTERNS[field];
    if (!subDomainPatterns) return undefined;

    for (const [subDomain, patterns] of Object.entries(subDomainPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          return subDomain;
        }
      }
    }

    return undefined;
  }

  /**
   * 收集识别证据
   * 
   * @param input 预处理后的输入
   * @param field 垂类
   * @returns 证据列表
   */
  private collectEvidence(input: string, field: FieldType): string[] {
    const patterns = FIELD_PATTERNS[field];
    const evidence: string[] = [];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        evidence.push(`匹配模式: ${pattern.source}`);
      }
    }

    return evidence;
  }

  /**
   * 生成候选列表
   * 
   * @param scores 各垂类得分
   * @param excludeField 排除的垂类
   * @returns 候选列表
   */
  private generateCandidates(
    scores: Map<FieldType, number>,
    excludeField: FieldType
  ): FieldCandidate[] {
    const candidates: FieldCandidate[] = [];

    for (const [field, confidence] of scores) {
      if (field !== excludeField && confidence > 0) {
        candidates.push({
          field,
          confidence,
          reason: `置信度 ${(confidence * 100).toFixed(1)}%，可能需要人工确认`,
        });
      }
    }

    // 按置信度排序
    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 计算各意图得分
   * 
   * @param input 预处理后的输入
   * @returns 各意图得分
   */
  private calculateIntentScores(input: string): Map<FieldIntent, number> {
    const scores = new Map<FieldIntent, number>();

    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS) as [FieldIntent, RegExp[]][]) {
      let matchCount = 0;

      for (const pattern of patterns) {
        if (pattern.test(input)) {
          matchCount++;
        }
      }

      const confidence = Math.min(matchCount / patterns.length, 1);
      scores.set(intent, confidence);
    }

    return scores;
  }

  /**
   * 获取最高得分意图
   * 
   * @param scores 各意图得分
   * @returns 最高得分意图
   */
  private getTopIntent(scores: Map<FieldIntent, number>): {
    intent: FieldIntent;
    confidence: number;
    matchedKeywords: string[];
  } {
    let topIntent: FieldIntent = "analyze";
    let maxScore = 0;
    const matchedKeywords: string[] = [];

    for (const [intent, score] of scores) {
      if (score > maxScore) {
        maxScore = score;
        topIntent = intent;
      }
    }

    return { intent: topIntent, confidence: maxScore, matchedKeywords };
  }

  /**
   * 检测混合意图
   * 
   * @param scores 各意图得分
   * @param topConfidence 最高置信度
   * @returns 意图列表
   */
  private detectMixedIntents(
    scores: Map<FieldIntent, number>,
    topConfidence: number
  ): Array<{ intent: FieldIntent; confidence: number }> {
    const intents: Array<{ intent: FieldIntent; confidence: number }> = [];
    const threshold = topConfidence * 0.5; // 超过最高分 50% 的视为有效意图

    for (const [intent, score] of scores) {
      if (score >= threshold && intent !== "mixed") {
        intents.push({ intent, confidence: score });
      }
    }

    return intents.sort((a, b) => b.confidence - a.confidence);
  }
}

// ============================================================================
// 导出
// ============================================================================

/**
 * 创建默认垂类识别引擎实例
 */
export function createFieldRecognizer(config?: {
  confidenceThresholds?: ConfidenceThresholds;
  enableMultiCandidate?: boolean;
}): FieldRecognizer {
  return new FieldRecognizer(config);
}

/**
 * 快捷函数：识别垂类
 * 
 * @param userInput 用户输入
 * @param metadata 可选元数据
 * @returns 垂类识别结果
 */
export function classifyField(
  userInput: string,
  metadata?: { context?: string }
): FieldClassification {
  const recognizer = createFieldRecognizer();
  return recognizer.classify(userInput, metadata);
}

/**
 * 快捷函数：识别意图
 * 
 * @param userInput 用户输入
 * @returns 意图识别结果
 */
export function recognizeFieldIntent(userInput: string): IntentRecognition {
  const recognizer = createFieldRecognizer();
  return recognizer.recognizeIntent(userInput);
}

/**
 * 快捷函数：评估复杂度
 * 
 * @param field 垂类
 * @param userInput 用户输入
 * @returns 复杂度评估结果
 */
export function estimateFieldComplexity(
  field: FieldType,
  userInput: string
): ComplexityEstimate {
  const recognizer = createFieldRecognizer();
  return recognizer.estimateComplexity(field, userInput);
}
