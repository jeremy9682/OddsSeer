// 插件全局类型定义

/**
 * 预测市场事件
 */
export interface MarketEvent {
  id: string;
  conditionId: string;
  title: string;
  description?: string;
  category?: string;
  endDate?: string;
  yesPrice: number | null;  // null 表示需要实时获取
  noPrice: number | null;   // null 表示需要实时获取
  isSnapshotPrice?: boolean;  // true 表示价格来自后端快照（可能过期），false/undefined 表示实时价格
  volume?: number;
  liquidity?: number;
  outcomes?: MarketOutcome[];
  isMultiOptionMarket?: boolean;
  source: 'polymarket' | 'kalshi' | 'metaculus';
  url: string;
}

export interface MarketOutcome {
  id: string;
  name: string;
  yesPrice: number | null;
  noPrice: number | null;
  marketTicker?: string;
}

/**
 * AI 分析结果
 */
export interface AIAnalysisResult {
  summary: string;
  reasoning: {
    questionBreakdown: string[];
    baseRateAnalysis: string;
    factors: AnalysisFactor[];
    detailedAnalysis: string;
  };
  probability: {
    yes: number;
    confidence: number;
  };
  marketAssessment: {
    currentPrice: number;
    fairValue: number;
    mispricing: number;
    direction: 'underpriced' | 'overpriced' | 'fair';
  };
  decision: {
    action: 'buy_yes' | 'buy_no' | 'sell_yes' | 'sell_no' | 'hold';
    confidence: number;
    reasoning: string;
    riskLevel: 'low' | 'medium' | 'high';
    suggestedPosition: number;
    selectedOutcome?: string;
    selectedOutcomeId?: string;
    outcomeSide?: 'yes' | 'no';
  };
  risks: string[];
  keyInsights: string[];
  multiOptionAnalysis?: {
    outcomes: MultiOptionOutcome[];
    bestPick?: string;
  };
}

export interface AnalysisFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  explanation: string;
}

export interface MultiOptionOutcome {
  name: string;
  id?: string;
  predictedProbability: number;
  currentPrice: number;
  recommendation: 'buy_yes' | 'buy_no' | 'hold';
  reasoning: string;
}

/**
 * 分析步骤
 */
export interface AnalysisStep {
  id: string;
  step: string;
  content: string;
  confidence: number;
  timestamp: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  data?: Record<string, any>;
}

/**
 * 用户设置
 */
export interface UserSettings {
  language: 'zh' | 'en';
  theme: 'light' | 'dark' | 'system';
  // 功能开关
  enableFloatingBall: boolean;
  enablePageEnhancement: boolean;
  enableTextSelection: boolean;
  enableNotifications: boolean;
  // 悬浮球位置
  floatingBallPosition: { x: number; y: number };
  // AI 模型
  preferredModel: string;
  // 监控设置
  priceAlertThreshold: number;  // 价格变动阈值 (%)
  // Pro 功能
  isPro: boolean;
  dailyAnalysisCount: number;
  dailyAnalysisLimit: number;
}

/**
 * 监控任务
 */
export interface MonitorTask {
  source?: MarketEvent['source'];
  id: string;
  marketId: string;
  marketTitle: string;
  type: 'price_change' | 'target_price' | 'ai_recommendation';
  condition: {
    threshold?: number;
    targetPrice?: number;
    direction?: 'above' | 'below';
  };
  createdAt: number;
  lastChecked?: number;
  lastPrice?: number;
  triggered?: boolean;
}

/**
 * 页面上下文
 */
export interface PageContext {
  url: string;
  domain: string;
  title: string;
  type: 'prediction_market' | 'news' | 'social' | 'other';
  detectedMarkets?: MarketEvent[];
  selectedText?: string;
  keywords?: string[];
}

/**
 * 消息类型
 */
export type MessageType =
  | 'GET_BACKEND_STATUS'
  | 'OPEN_SIDEPANEL'
  | 'ANALYZE_MARKET'
  | 'ANALYZE_TEXT'
  | 'GET_PAGE_CONTEXT'
  | 'SET_PAGE_CONTEXT'
  | 'MARKET_DETECTED'
  | 'MARKET_SELECTED'
  | 'TEXT_SELECTED'
  | 'TEXT_SEARCH'
  | 'PAGE_SCAN'
  | 'ANALYSIS_COMPLETE'
  | 'ANALYSIS_STEP'
  | 'PRICE_ALERT'
  | 'SETTINGS_UPDATED'
  | 'GET_SETTINGS'
  | 'SET_SETTINGS'
  | 'UPDATE_ICON_THEME'
  | 'GET_MONITORS'
  | 'ADD_MONITOR'
  | 'REMOVE_MONITOR'
  | 'GET_SELECTED_MARKET'
  | 'SET_SELECTED_MARKET'
  | 'GET_TRENDING_MARKETS'
  | 'SEARCH_MARKETS'
  // 事件详情页增强
  | 'GET_ARBITRAGE_DATA'
  | 'GET_SMART_MONEY_DATA'
  | 'GET_NEWS_SUMMARY'
  | 'GET_QUICK_AI_ANALYSIS'
  | 'GET_MARKET_SUMMARY'
  // 事件关系发现
  | 'GET_RELATED_EVENTS'
  // 时间线功能
  | 'GET_TIMELINE_DATA'
  // 社区情绪分析
  | 'GET_COMMUNITY_SENTIMENT'
  // 实时价格获取
  | 'FETCH_MARKET_REALTIME_PRICE';

export interface Message<T = any> {
  type: MessageType;
  payload?: T;
  timestamp?: number;
}

/**
 * 响应类型
 */
export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// 事件详情页增强面板类型
// ============================================

/**
 * 套利机会数据
 */
export interface ArbitrageOpportunity {
  source: 'polymarket' | 'kalshi' | 'opinion';
  eventTitle: string;
  yesPrice: number;
  noPrice: number;
  priceDiff: number;  // 与当前市场的价差
  url?: string;
}

/**
 * 聪明钱数据
 */
export interface SmartMoneyData {
  netFlow24h: number;  // 24小时净流入（正为买入）
  direction: 'bullish' | 'bearish' | 'neutral';
  whaleRatio: number;  // 大户/散户比
  recentTrades: SmartMoneyTrade[];
}

export interface SmartMoneyTrade {
  address: string;
  side: 'buy' | 'sell';
  outcome: 'yes' | 'no';
  amount: number;
  timestamp: number;
}

/**
 * 新闻摘要数据
 */
export interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

/**
 * 增强面板数据
 */
export interface EnhancementPanelData {
  market: MarketEvent;
  arbitrage?: ArbitrageOpportunity[];
  smartMoney?: SmartMoneyData;
  news?: NewsItem[];
  aiQuickAnalysis?: {
    confidence: number;
    direction: 'bullish' | 'bearish' | 'neutral';
    recommendation: string;
    reasoning: string;
  };
  marketSummary?: MarketSummaryData;
  loading: {
    arbitrage: boolean;
    smartMoney: boolean;
    news: boolean;
    ai: boolean;
  };
}

// ============================================
// Market Summary 市场总结类型
// ============================================

/**
 * 市场总结完整数据
 */
export interface MarketSummaryData {
  // 总体判断
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  oneLiner: string; // 一句话结论
  keyDriver: string; // 关键驱动因素

  // 盘口结构指标
  microstructure: MarketMicrostructure;

  // 交易活跃度
  activity: MarketActivity;

  // 风险提示
  risks: MarketRisks;

  // 元信息
  fetchedAt: string;
  source: 'polymarket' | 'kalshi';
}

/**
 * 盘口微观结构
 */
export interface MarketMicrostructure {
  bestBid: number;
  bestAsk: number;
  spread: number;         // 绝对价差
  spreadPercent: number;   // 百分比价差
  midPrice: number;
  depth: {
    bidDepth: number;      // 买盘总挂单量 (USD)
    askDepth: number;      // 卖盘总挂单量 (USD)
    imbalance: number;     // 挂单不平衡度 (-1 到 1, 正为买盘偏重)
  };
  slippage: {
    buy100: number;        // 买入 $100 的滑点 %
    buy500: number;        // 买入 $500 的滑点 %
    sell100: number;       // 卖出 $100 的滑点 %
    sell500: number;       // 卖出 $500 的滑点 %
  };
  liquidity: number;       // 流动性 (USD)
}

/**
 * 交易活跃度
 */
export interface MarketActivity {
  volume: number;          // 总成交量
  volume24h: number;       // 24h 成交量
  recentTradeCount: number; // 近期交易笔数
  avgTradeSize: number;    // 平均交易规模
  largeTradeCount: number; // 大额交易数 (>$500)
  priceChange1h: number;   // 1h 价格变化 %
  priceChange24h: number;  // 24h 价格变化 %
  volatility: number;      // 波动率 %
}

/**
 * 风险评估
 */
export interface MarketRisks {
  overallLevel: 'low' | 'medium' | 'high';
  alerts: RiskAlert[];
}

export interface RiskAlert {
  type: 'manipulation' | 'liquidity' | 'concentration' | 'rules' | 'info_lag';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

// ============================================
// 事件关系类型
// ============================================

/**
 * 事件关系类型
 */
export type RelationshipType = 'SIMILAR' | 'CAUSAL' | 'HEDGE' | 'CORRELATED' | 'PREREQUISITE';

/**
 * 事件关系
 */
export interface EventRelationship {
  type: RelationshipType;
  strength: number;        // 0-1 关系强度
  direction: 'forward' | 'reverse' | 'bidirectional';
  insight_en: string;      // 英文洞察
  insight_zh: string;      // 中文洞察
  targetEvent: MarketEvent;
}

/**
 * Top Holder 数据
 */
export interface TopHolder {
  address: string;
  name?: string;
  amount: number;
  outcomeIndex: number;
}

/**
 * 市场交易记录
 */
export interface MarketTrade {
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  timestamp: number;
  proxyWallet: string;
  name?: string;
}

// ============================================
// 时间线 Timeline 类型
// ============================================

/**
 * 时间线事件
 */
export interface TimelineEvent {
  id: string;
  timestamp: number;
  type: 'news' | 'social_media' | 'policy' | 'market_anomaly' | 'volume_surge' | 'whale_trade';
  title: string;
  summary: string;
  source: {
    name: string;
    type: 'news' | 'social' | 'official' | 'algorithm';
    icon: string;
  };
  sourceUrl: string;
  credibility: number;
  impact: {
    direction: 'bullish' | 'bearish' | 'neutral';
    magnitude: 'high' | 'medium' | 'low';
    priceChangePct: number;
  };
  relatedPricePoint: {
    price: number;
    priceBefore: number;
    priceAfter: number;
  } | null;
}

/**
 * 价格异动
 */
export interface PriceAnomaly {
  timestamp: number;
  time: string;
  type: 'price_spike' | 'volume_surge' | 'spike_with_volume';
  severity: number;
  priceChange: number;
  direction: 'up' | 'down' | 'flat';
  volumeRatio: number;
  zScore: number;
  price: number;
  priceBefore: number;
}

/**
 * K 线数据点
 */
export interface CandleData {
  timestamp: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * 时间线 API 响应
 */
export interface TimelineResponse {
  market: {
    conditionId: string;
    title: string;
  };
  priceData: CandleData[];
  events: TimelineEvent[];
  anomalies: PriceAnomaly[];
  priceAnalysis: {
    currentPrice: number;
    startPrice: number;
    priceChange: number;
    priceChangePercent: number;
    high: number;
    low: number;
    avgPrice: number;
    volatility: number;
    volatilityPercent: number;
    momentum: number;
    trend: 'bullish' | 'bearish' | 'stable';
    trendStrength: 'weak' | 'moderate' | 'strong';
    dataPoints: number;
    timeRangeHours: number;
  } | null;
  summary: {
    totalEvents: number;
    highImpactCount: number;
    overallSentiment: 'bullish' | 'bearish' | 'mixed';
    period: string;
  };
  fetchedAt: string;
}

// ============================================
// 社区情绪分析类型
// ============================================

/**
 * 社区情绪分析数据
 */
export interface CommunitySentimentData {
  // 整体情绪 (由 Wilson Score 客观计算)
  // Binary events: 'bullish' | 'bearish' | 'neutral' | 'divided' | 'uncertain'
  // Multi-option events: 'consensus' | 'divided' | 'uncertain'
  overallSentiment: 'bullish' | 'bearish' | 'neutral' | 'divided' | 'consensus' | 'uncertain';

  // 观点摘要 (由 LLM 生成)
  summary: string;

  // 多选事件：社区最看好的选项
  favoredOption?: string;

  // Wilson Score 统计数据
  stats: {
    // Binary events
    bullishCount?: number;
    bearishCount?: number;
    neutralCount?: number;
    totalOpinionated: number;
    bullishRate?: number;  // 0-1

    // Multi-option events
    optionCounts?: Record<string, number>;
    topOption?: string;
    topOptionRate?: number;
    leadGap?: number;  // percentage lead over second place (0-100)

    // Wilson Score confidence interval (95%)
    wilsonLower: number;  // 0-1
    wilsonUpper: number;  // 0-1

    // Sample reliability based on sample size
    reliability: 'high' | 'medium' | 'low';

    // Discussion velocity (acceleration/deceleration)
    velocity: {
      ratio: number;  // recent vs older normalized ratio
      trend: 'accelerating' | 'increasing' | 'stable' | 'slowing' | 'declining';
      recentCount: number;  // comments in last 3 days
      olderCount: number;   // comments 4-10 days ago
    };
  };

  // 关键论点
  keyArguments: Array<{
    point: string;
    sentiment: 'support' | 'oppose';
    // Multi-option events: which option this argument supports
    forOption?: string;
    mentions: number;
  }>;

  // 选项统计（多选事件）
  optionMentions: Array<{
    option: string;
    mentions: number;
    // Binary: 'bullish' | 'bearish' | 'neutral'
    // Multi-option: 'favored' | 'opposed' | 'neutral'
    sentiment: 'bullish' | 'bearish' | 'neutral' | 'favored' | 'opposed';
    supportRate: number;  // 0-1
    // Wilson Score confidence interval for this option (multi-option events)
    wilsonLower?: number;  // 0-1
    wilsonUpper?: number;  // 0-1
  }>;

  // 精选评论
  notableComments: Array<{
    text: string;
    reason: string;
    reactionCount: number;
    username: string;
  }>;

  // 元数据
  analyzedCount: number;
  totalComments: number;
  fetchedAt: string;

  // 是否为多选项事件（由后端分析决定）
  isMultiOption?: boolean;
}

/**
 * Gamma API 评论数据
 */
export interface GammaComment {
  id: string;
  body: string;
  username: string;
  reactionCount: number;
  createdAt: string;
  profileId?: string;
}

