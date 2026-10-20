import { probability, gammaPrices } from './prices';
/**
 * Market Summary Service
 * 从 Polymarket Data API / CLOB API / Kalshi API 获取数据，
 * 计算盘口结构、交易活跃度、风险评估，生成市场总结
 */

import type {
  MarketEvent,
  MarketSummaryData,
  MarketMicrostructure,
  MarketActivity,
  MarketRisks,
  RiskAlert,
  TopHolder,
  MarketTrade,
} from './types';

// API 端点
const POLYMARKET_DATA_API = 'https://data-api.polymarket.com';
const POLYMARKET_CLOB_API = 'https://clob.polymarket.com';
const POLYMARKET_GAMMA_API = 'https://gamma-api.polymarket.com';
const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2';

/**
 * 从 Gamma API 解析出的市场元数据
 * content script 传入的 market.conditionId 可能只是 slug，需要先解析
 */
interface ResolvedPolymarketIds {
  conditionId: string;    // 真正的 0x... conditionId
  tokenId: string;        // YES token 的 clobTokenId
  yesPrice: number | null;       // 从 outcomePrices 提取的 YES 价格
  noPrice: number | null;        // 从 outcomePrices 提取的 NO 价格
  volume: number;
  liquidity: number;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  endDate?: string;       // 市场结束日期
}

// ============================================
// 主入口
// ============================================

/**
 * 生成市场总结
 */
export async function generateMarketSummary(
  market: MarketEvent,
  language: 'zh' | 'en' = 'zh'
): Promise<MarketSummaryData> {
  const isPolymarket = market.source === 'polymarket';

  // 第一步：对 Polymarket 市场，先通过 Gamma API 解析出真正的 conditionId 和 tokenId
  // 因为 content script 传入的 market.conditionId 可能只是 slug
  let resolvedIds: ResolvedPolymarketIds | null = null;
  if (isPolymarket) {
    resolvedIds = await resolvePolymarketMarketIds(market);
    console.log('[MarketSummary] Resolved IDs:', resolvedIds ? {
      conditionId: resolvedIds.conditionId.substring(0, 20) + '...',
      tokenId: resolvedIds.tokenId.substring(0, 20) + '...',
      volume: resolvedIds.volume,
      liquidity: resolvedIds.liquidity,
    } : 'FAILED');

    // 用解析到的数据更新 market 对象（不修改原始引用）
    if (resolvedIds) {
      market = {
        ...market,
        conditionId: resolvedIds.conditionId,
        yesPrice: resolvedIds.yesPrice,
        noPrice: resolvedIds.noPrice,
        volume: resolvedIds.volume || market.volume,
        liquidity: resolvedIds.liquidity || market.liquidity,
        endDate: resolvedIds.endDate || market.endDate,
      };
      console.log('[MarketSummary] Market updated with resolved data:', {
        yesPrice: market.yesPrice,
        noPrice: market.noPrice,
        volume: market.volume,
        liquidity: market.liquidity,
        endDate: market.endDate,
      });
    }
  }

  // 第二步：顺序获取数据
  // Chrome MV3 service worker 对并行 fetch 有严格限制，
  // 同时发起多个请求会导致 "Failed to fetch" 错误
  // 所以改为顺序获取，每个请求完成后再发下一个
  let orderbook: OrderbookData | null = null;
  let trades: MarketTrade[] = [];
  let holders: TopHolder[] = [];
  let priceHistory: Array<{ t: number; p: number }> = [];

  if (isPolymarket) {
    // 按优先级顺序获取: orderbook → trades → holders → priceHistory
    try {
      orderbook = await fetchPolymarketOrderbook(resolvedIds?.tokenId || null);
    } catch (e) {
      console.error('[MarketSummary] Orderbook fetch failed:', e);
    }

    try {
      trades = await fetchPolymarketTrades(market.conditionId);
    } catch (e) {
      console.error('[MarketSummary] Trades fetch failed:', e);
    }

    // holders 和 priceHistory 可以并行（前两个已完成，释放了连接）
    const [holdersResult, priceHistoryResult] = await Promise.allSettled([
      fetchPolymarketHolders(market.conditionId),
      fetchPolymarketPriceHistory(resolvedIds?.tokenId || null),
    ]);

    holders = holdersResult.status === 'fulfilled' ? (holdersResult.value || []) : [];
    priceHistory = priceHistoryResult.status === 'fulfilled' ? (priceHistoryResult.value || []) : [];

    if (holdersResult.status === 'rejected') {
      console.error('[MarketSummary] Holders fetch rejected:', holdersResult.reason);
    }
    if (priceHistoryResult.status === 'rejected') {
      console.error('[MarketSummary] PriceHistory fetch rejected:', priceHistoryResult.reason);
    }
  } else {
    // Kalshi: 只获取 orderbook
    try {
      orderbook = await fetchKalshiOrderbook(market);
    } catch (e) {
      console.error('[MarketSummary] Kalshi orderbook fetch failed:', e);
    }
  }

  console.log('[MarketSummary] Data fetched:', {
    orderbookBids: orderbook?.bids?.length || 0,
    orderbookAsks: orderbook?.asks?.length || 0,
    topBid: orderbook?.bids?.[0] || null,
    topAsk: orderbook?.asks?.[0] || null,
    trades: trades.length,
    tradesSample: trades.length > 0 ? { side: trades[0].side, price: trades[0].price, size: trades[0].size } : null,
    holders: holders.length,
    holdersSample: holders.length > 0 ? { amount: holders[0].amount, name: holders[0].name } : null,
    priceHistory: priceHistory.length,
    latestPrice: priceHistory.length > 0 ? priceHistory[priceHistory.length - 1] : null,
  });

  // 第三步：如果有 Gamma API 返回的基础数据，注入到 market
  if (resolvedIds && !orderbook) {
    console.log('[MarketSummary] Orderbook unavailable, using Gamma API fallback data:', {
      bestBid: resolvedIds.bestBid,
      bestAsk: resolvedIds.bestAsk,
      spread: resolvedIds.spread,
      liquidity: resolvedIds.liquidity,
    });
    market = {
      ...market,
      liquidity: resolvedIds.liquidity || market.liquidity,
    };
  }

  // 计算各项指标
  const microstructure = computeMicrostructure(orderbook, market, resolvedIds);
  const activity = computeActivity(trades, priceHistory, market);
  const risks = assessRisks(microstructure, activity, holders, market, language);

  console.log('[MarketSummary] Computed metrics:', {
    micro: {
      spread: microstructure.spreadPercent.toFixed(2) + '%',
      bidDepth: microstructure.depth.bidDepth.toFixed(0),
      askDepth: microstructure.depth.askDepth.toFixed(0),
      liquidity: microstructure.liquidity.toFixed(0),
    },
    activity: {
      volume: activity.volume,
      volume24h: activity.volume24h.toFixed(0),
      trades: activity.recentTradeCount,
      avgSize: activity.avgTradeSize.toFixed(2),
      priceChange24h: activity.priceChange24h.toFixed(2) + '%',
      volatility: activity.volatility.toFixed(2) + '%',
    },
    risks: {
      level: risks.overallLevel,
      alertCount: risks.alerts.length,
      alerts: risks.alerts.map(a => `[${a.severity}] ${a.type}`),
    },
  });

  // 生成总体判断
  const { direction, confidence, oneLiner, keyDriver } = synthesizeConclusion(
    microstructure, activity, risks, market, language
  );

  console.log('[MarketSummary] Conclusion:', { direction, confidence, oneLiner });

  return {
    direction,
    confidence,
    oneLiner,
    keyDriver,
    microstructure,
    activity,
    risks,
    fetchedAt: new Date().toISOString(),
    source: market.source as 'polymarket' | 'kalshi',
  };
}

// ============================================
// Polymarket ID 解析（Gamma API）
// ============================================

/**
 * 通过 Gamma API 将 slug 解析为真正的 conditionId 和 clobTokenId
 * 这是最关键的一步 — content script 传入的 conditionId 通常只是 slug
 */
async function resolvePolymarketMarketIds(
  market: MarketEvent
): Promise<ResolvedPolymarketIds | null> {
  try {
    // 从 URL 或 conditionId 提取 slug
    const slug = extractSlugFromMarket(market);
    if (!slug) {
      console.error('[MarketSummary] Cannot extract slug from market');
      return null;
    }

    console.log('[MarketSummary] Resolving market via Gamma API, slug:', slug);

    const response = await fetch(`${POLYMARKET_GAMMA_API}/events?slug=${encodeURIComponent(slug)}`);
    if (!response.ok) {
      console.error('[MarketSummary] Gamma API failed:', response.status);
      return null;
    }

    const events = await response.json();
    if (!Array.isArray(events) || events.length === 0) {
      console.error('[MarketSummary] No events found for slug:', slug);
      return null;
    }

    const event = events[0];
    const markets = event.markets || [];

    console.log('[MarketSummary] Event found:', {
      title: event.title?.substring(0, 50),
      slug: event.slug,
      marketsCount: markets.length,
    });

    if (markets.length === 0) {
      console.error('[MarketSummary] Event has no markets');
      return null;
    }

    // 选择目标 market:
    // 1. 过滤掉已结算的市场 (outcomePrices 为 ["0","1"] 或 ["1","0"] 的是已结算)
    // 2. 过滤掉没有 clobTokenIds 的市场
    // 3. 在剩余市场中选 volume 最大的
    let targetMarket = markets[0];

    if (markets.length > 1) {
      // 对每个 market 计算是否活跃
      const activeMarkets = markets.filter((m: any) => {
        // 检查是否有 clobTokenIds
        if (!m.clobTokenIds) return false;

        // 检查价格是否已结算 (0/1)
        const prices = m.outcomePrices;
        if (prices) {
          try {
            const parsed = typeof prices === 'string' ? JSON.parse(prices) : prices;
            if (Array.isArray(parsed) && parsed.length >= 2) {
              const p0 = parseFloat(parsed[0]);
              const p1 = parseFloat(parsed[1]);
              // 如果两个价格中有一个是 0 或 1（或非常接近），市场已结算
              if ((p0 <= 0.001 && p1 >= 0.999) || (p0 >= 0.999 && p1 <= 0.001)) {
                return false;
              }
            }
          } catch { /* ignore parse errors */ }
        }

        // 检查 active/closed 状态
        if (m.closed === true || m.active === false) return false;

        return true;
      });

      console.log('[MarketSummary] Market selection:', {
        total: markets.length,
        active: activeMarkets.length,
        resolved: markets.length - activeMarkets.length,
      });

      // 从活跃市场中选 volume 最大的
      const pool = activeMarkets.length > 0 ? activeMarkets : markets;
      targetMarket = pool.reduce((best: any, m: any) => {
        const vol = parseFloat(m.volume || '0');
        const bestVol = parseFloat(best.volume || '0');
        return vol > bestVol ? m : best;
      }, pool[0]);
    }

    // 提取 conditionId
    const conditionId = targetMarket.conditionId || targetMarket.condition_id || '';

    // 提取 clobTokenIds
    const rawClobTokenIds = targetMarket.clobTokenIds;
    let tokenId = '';
    if (rawClobTokenIds) {
      try {
        const ids = typeof rawClobTokenIds === 'string' ? JSON.parse(rawClobTokenIds) : rawClobTokenIds;
        tokenId = ids[0] || ''; // 第一个是 YES token
      } catch {
        tokenId = '';
      }
    }

    console.log('[MarketSummary] Selected market:', {
      question: (targetMarket.question || targetMarket.title || '').substring(0, 60),
      conditionId: conditionId ? conditionId.substring(0, 20) + '...' : 'MISSING',
      tokenId: tokenId ? tokenId.substring(0, 20) + '...' : 'MISSING',
      outcomePrices: targetMarket.outcomePrices,
      volume: targetMarket.volume,
      liquidity: targetMarket.liquidity,
      active: targetMarket.active,
      closed: targetMarket.closed,
    });

    if (!conditionId || !tokenId) {
      console.error('[MarketSummary] Missing conditionId or tokenId after selection');
      return null;
    }

    // 提取选中 market 的 YES/NO 价格
    const { yesPrice, noPrice } = gammaPrices(targetMarket.outcomePrices);

    // 聚合事件级别的 volume（所有 sub-markets 的总和）
    const totalVolume = markets.reduce(
      (sum: number, m: any) => sum + (parseFloat(m.volume || '0')), 0
    );

    // 提取结束日期
    const endDate = targetMarket.endDate || targetMarket.end_date_iso || event.endDate || '';

    console.log('[MarketSummary] Resolved prices:', { yesPrice, noPrice, volume: totalVolume, endDate });

    return {
      conditionId,
      tokenId,
      yesPrice,
      noPrice,
      volume: totalVolume || parseFloat(targetMarket.volume || '0'),
      liquidity: parseFloat(targetMarket.liquidity || '0'),
      bestBid: probability(targetMarket.bestBid),
      bestAsk: probability(targetMarket.bestAsk),
      spread: probability(targetMarket.spread),
      endDate,
    };
  } catch (error) {
    console.error('[MarketSummary] resolvePolymarketMarketIds error:', error);
    return null;
  }
}

/**
 * 从 market 对象中提取 Polymarket 的 event slug
 */
function extractSlugFromMarket(market: MarketEvent): string | null {
  // 1. 从 URL 提取
  if (market.url) {
    // 标准事件页: /event/{slug}
    const eventMatch = market.url.match(/polymarket\.com\/event\/([^/?#]+)/);
    if (eventMatch) return eventMatch[1];

    // 体育赛事页: /sports/{sport}/games/week/{n}/{slug}
    const sportsMatch = market.url.match(/polymarket\.com\/sports\/[^/]+\/games\/[^/]+\/[^/]+\/([^/?#]+)/);
    if (sportsMatch) return sportsMatch[1];
  }

  // 2. conditionId 可能就是 slug（content script 设置的）
  if (market.conditionId && !market.conditionId.startsWith('0x')) {
    return market.conditionId;
  }

  // 3. id 可能是 slug
  if (market.id && !market.id.startsWith('0x') && !market.id.includes('-')) {
    return market.id;
  }

  return null;
}

// ============================================
// Polymarket API 数据获取
// ============================================

interface OrderbookData {
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
}

/**
 * 获取 Polymarket 挂单簿 (使用已解析的 tokenId)
 */
async function fetchPolymarketOrderbook(tokenId: string | null): Promise<OrderbookData | null> {
  if (!tokenId) {
    console.warn('[MarketSummary] No tokenId for orderbook');
    return null;
  }

  try {
    console.log('[MarketSummary] Fetching orderbook for tokenId:', tokenId.substring(0, 20) + '...');
    const response = await fetch(`${POLYMARKET_CLOB_API}/book?token_id=${encodeURIComponent(tokenId)}`);
    if (!response.ok) {
      console.error('[MarketSummary] Orderbook API failed:', response.status);
      return null;
    }

    const data = await response.json();
    const result = {
      bids: (data.bids || []).map((b: any) => ({
        price: parseFloat(b.price),
        size: parseFloat(b.size),
      })),
      asks: (data.asks || []).map((a: any) => ({
        price: parseFloat(a.price),
        size: parseFloat(a.size),
      })),
    };

    console.log('[MarketSummary] Orderbook fetched:', {
      bids: result.bids.length,
      asks: result.asks.length,
    });
    return result;
  } catch (error) {
    console.error('[MarketSummary] Orderbook fetch error:', error);
    return null;
  }
}

/**
 * 获取 Polymarket 市场交易记录 (Data API - 公开端点)
 * @param conditionId - 真正的 0x... conditionId (已通过 Gamma API 解析)
 */
async function fetchPolymarketTrades(conditionId: string): Promise<MarketTrade[]> {
  if (!conditionId || !conditionId.startsWith('0x')) {
    console.warn('[MarketSummary] Invalid conditionId for trades:', conditionId);
    return [];
  }

  try {
    console.log('[MarketSummary] Fetching trades for conditionId:', conditionId.substring(0, 20) + '...');
    const url = `${POLYMARKET_DATA_API}/trades?market=${encodeURIComponent(conditionId)}&limit=200`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[MarketSummary] Trades API failed:', response.status);
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    console.log('[MarketSummary] Trades fetched:', data.length);
    return data.map((t: any) => ({
      side: t.side === 'BUY' ? 'BUY' : 'SELL',
      price: parseFloat(t.price) || 0,
      size: parseFloat(t.size) || 0,
      timestamp: t.timestamp || 0,
      proxyWallet: t.proxyWallet || '',
      name: t.name || t.pseudonym || undefined,
    }));
  } catch (error) {
    console.error('[MarketSummary] Trades fetch error:', error);
    return [];
  }
}

/**
 * 获取 Polymarket Top Holders (Data API - 公开端点)
 * @param conditionId - 真正的 0x... conditionId (已通过 Gamma API 解析)
 */
async function fetchPolymarketHolders(conditionId: string): Promise<TopHolder[]> {
  if (!conditionId || !conditionId.startsWith('0x')) {
    console.warn('[MarketSummary] Invalid conditionId for holders:', conditionId);
    return [];
  }

  try {
    console.log('[MarketSummary] Fetching holders for conditionId:', conditionId.substring(0, 20) + '...');
    const url = `${POLYMARKET_DATA_API}/holders?market=${encodeURIComponent(conditionId)}&limit=20`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[MarketSummary] Holders API failed:', response.status);
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    // 数据结构: [{token, holders: [{proxyWallet, amount, outcomeIndex, name, ...}]}]
    const allHolders: TopHolder[] = [];
    for (const tokenGroup of data) {
      if (tokenGroup.holders && Array.isArray(tokenGroup.holders)) {
        for (const h of tokenGroup.holders) {
          allHolders.push({
            address: h.proxyWallet || '',
            name: h.name || h.pseudonym || undefined,
            amount: parseFloat(h.amount) || 0,
            outcomeIndex: h.outcomeIndex || 0,
          });
        }
      }
    }

    console.log('[MarketSummary] Holders fetched:', allHolders.length);
    return allHolders;
  } catch (error) {
    console.error('[MarketSummary] Holders fetch error:', error);
    return [];
  }
}

/**
 * 获取 Polymarket 价格历史 (CLOB API)
 * @param tokenId - YES token 的 clobTokenId (已通过 Gamma API 解析)
 */
async function fetchPolymarketPriceHistory(
  tokenId: string | null
): Promise<Array<{ t: number; p: number }>> {
  if (!tokenId) {
    console.warn('[MarketSummary] No tokenId for price history');
    return [];
  }

  try {
    // fidelity=60 = 每小时一个数据点
    const url = `${POLYMARKET_CLOB_API}/prices-history?market=${encodeURIComponent(tokenId)}&interval=all&fidelity=60`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[MarketSummary] Price history API failed:', response.status);
      return [];
    }

    const data = await response.json();
    const history = (data.history || []).map((h: any) => ({
      t: h.t,
      p: parseFloat(h.p),
    }));

    console.log('[MarketSummary] Price history fetched:', history.length, 'points');
    return history;
  } catch (error) {
    console.error('[MarketSummary] Price history fetch error:', error);
    return [];
  }
}

// ============================================
// Kalshi API 数据获取
// ============================================

/**
 * 获取 Kalshi 挂单簿
 */
async function fetchKalshiOrderbook(market: MarketEvent): Promise<OrderbookData | null> {
  try {
    // Kalshi 的 market ticker 存储在 outcomes[0].marketTicker 或 id 中
    const ticker = market.outcomes?.[0]?.marketTicker || market.id;
    if (!ticker) return null;

    const response = await fetch(`${KALSHI_API}/markets/${encodeURIComponent(ticker)}/orderbook`);
    if (!response.ok) return null;

    const data = await response.json();
    const ob = data.orderbook || data;

    // Kalshi 格式: { yes: [[price, qty], ...], no: [[price, qty], ...] }
    const bids = (ob.yes || []).map((level: number[]) => ({
      price: (level[0] || 0) / 100, // Kalshi 价格是 0-100 cents
      size: level[1] || 0,
    }));
    const asks = (ob.no || []).map((level: number[]) => ({
      price: 1 - (level[0] || 0) / 100,
      size: level[1] || 0,
    }));

    return { bids, asks };
  } catch (error) {
    console.error('[MarketSummary] Kalshi orderbook fetch error:', error);
    return null;
  }
}

// ============================================
// 计算引擎 - 盘口微观结构
// ============================================

function computeMicrostructure(
  orderbook: OrderbookData | null,
  market: MarketEvent,
  resolvedIds?: ResolvedPolymarketIds | null
): MarketMicrostructure {

  // 默认值 (无 orderbook 数据时)
  if (!orderbook || (orderbook.bids.length === 0 && orderbook.asks.length === 0)) {
    // 使用 Gamma API 返回的基础数据作为降级
    const gammaBid = resolvedIds?.bestBid;
    const gammaAsk = resolvedIds?.bestAsk;
    if (gammaBid == null || gammaAsk == null) throw new Error('Order book unavailable');
    const gammaSpread = resolvedIds?.spread ?? Math.max(0, gammaAsk - gammaBid);
    const gammaMid = (gammaBid + gammaAsk) / 2;

    return {
      bestBid: gammaBid,
      bestAsk: gammaAsk,
      spread: gammaSpread,
      spreadPercent: gammaMid > 0 ? (gammaSpread / gammaMid) * 100 : 0,
      midPrice: gammaMid,
      depth: { bidDepth: 0, askDepth: 0, imbalance: 0 },
      slippage: { buy100: 0, buy500: 0, sell100: 0, sell500: 0 },
      liquidity: market.liquidity || resolvedIds?.liquidity || 0,
    };
  }

  // 按价格排序: bids 降序, asks 升序
  const sortedBids = [...orderbook.bids].sort((a, b) => b.price - a.price);
  const sortedAsks = [...orderbook.asks].sort((a, b) => a.price - b.price);

  const bestBid = sortedBids[0]?.price;
  const bestAsk = sortedAsks[0]?.price;
  if (bestBid == null || bestAsk == null) throw new Error('Two-sided order book unavailable');
  const spread = Math.max(0, bestAsk - bestBid);
  const midPrice = (bestBid + bestAsk) / 2;
  const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 0;

  // 计算挂单深度 (USD 价值 = price * size)
  const bidDepth = sortedBids.reduce((sum, b) => sum + b.price * b.size, 0);
  const askDepth = sortedAsks.reduce((sum, a) => sum + a.price * a.size, 0);
  const totalDepth = bidDepth + askDepth;
  const imbalance = totalDepth > 0 ? (bidDepth - askDepth) / totalDepth : 0;

  // 计算滑点
  const slippage = {
    buy100: computeSlippage(sortedAsks, 100, bestAsk),
    buy500: computeSlippage(sortedAsks, 500, bestAsk),
    sell100: computeSlippage(sortedBids, 100, bestBid),
    sell500: computeSlippage(sortedBids, 500, bestBid),
  };

  return {
    bestBid,
    bestAsk,
    spread,
    spreadPercent,
    midPrice,
    depth: { bidDepth, askDepth, imbalance },
    slippage,
    liquidity: market.liquidity || totalDepth,
  };
}

/**
 * 计算给定下单量的滑点百分比
 * @param levels - 挂单列表（买入用 asks 升序，卖出用 bids 降序）
 * @param targetUsd - 目标下单金额 (USD)
 * @param bestPrice - 最优价格
 */
function computeSlippage(
  levels: Array<{ price: number; size: number }>,
  targetUsd: number,
  bestPrice: number
): number {
  if (levels.length === 0 || bestPrice <= 0) return 0;

  let remainingUsd = targetUsd;
  let totalCost = 0;
  let totalQty = 0;

  for (const level of levels) {
    const levelValue = level.price * level.size;
    const fillUsd = Math.min(remainingUsd, levelValue);
    const fillQty = fillUsd / level.price;

    totalCost += fillUsd;
    totalQty += fillQty;
    remainingUsd -= fillUsd;

    if (remainingUsd <= 0) break;
  }

  if (totalQty === 0) return 0;

  const avgPrice = totalCost / totalQty;
  return Math.abs((avgPrice - bestPrice) / bestPrice) * 100;
}

// ============================================
// 计算引擎 - 交易活跃度
// ============================================

function computeActivity(
  trades: MarketTrade[],
  priceHistory: Array<{ t: number; p: number }>,
  market: MarketEvent
): MarketActivity {
  const volume = market.volume || 0;

  // 无交易数据时的默认值
  if (trades.length === 0 && priceHistory.length === 0) {
    return {
      volume,
      volume24h: 0,
      recentTradeCount: 0,
      avgTradeSize: 0,
      largeTradeCount: 0,
      priceChange1h: 0,
      priceChange24h: 0,
      volatility: 0,
    };
  }

  // 交易统计
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 86400;
  const recentTrades = trades.filter((t) => t.timestamp >= oneDayAgo);

  const tradeSizes = trades.map((t) => t.price * t.size);
  const totalTradeValue = tradeSizes.reduce((s, v) => s + v, 0);
  const avgTradeSize = trades.length > 0 ? totalTradeValue / trades.length : 0;
  const largeTradeCount = tradeSizes.filter((v) => v >= 500).length;

  // 价格变化
  let priceChange1h = 0;
  let priceChange24h = 0;
  let volatility = 0;

  if (priceHistory.length >= 2) {
    const latest = priceHistory[priceHistory.length - 1];
    const currentP = latest.p;

    // 找到 1h 前和 24h 前的价格
    const oneHourAgo = latest.t - 3600;
    const oneDayAgoTs = latest.t - 86400;

    const price1hAgo = findClosestPrice(priceHistory, oneHourAgo);
    const price24hAgo = findClosestPrice(priceHistory, oneDayAgoTs);

    if (price1hAgo > 0) {
      priceChange1h = ((currentP - price1hAgo) / price1hAgo) * 100;
    }
    if (price24hAgo > 0) {
      priceChange24h = ((currentP - price24hAgo) / price24hAgo) * 100;
    }

    // 波动率 (最近 24h 数据的标准差)
    const recentPrices = priceHistory
      .filter((h) => h.t >= oneDayAgoTs)
      .map((h) => h.p);

    if (recentPrices.length >= 2) {
      const avg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
      const variance =
        recentPrices.reduce((sum, p) => sum + (p - avg) ** 2, 0) / recentPrices.length;
      volatility = avg > 0 ? (Math.sqrt(variance) / avg) * 100 : 0;
    }
  }

  return {
    volume,
    volume24h: recentTrades.reduce((s, t) => s + t.price * t.size, 0),
    recentTradeCount: recentTrades.length,
    avgTradeSize,
    largeTradeCount,
    priceChange1h,
    priceChange24h,
    volatility,
  };
}

function findClosestPrice(
  history: Array<{ t: number; p: number }>,
  targetTimestamp: number
): number {
  if (history.length === 0) return 0;

  let closest = history[0];
  let minDiff = Math.abs(history[0].t - targetTimestamp);

  for (const h of history) {
    const diff = Math.abs(h.t - targetTimestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closest = h;
    }
  }

  return closest.p;
}

// ============================================
// 风险评估
// ============================================

function assessRisks(
  micro: MarketMicrostructure,
  activity: MarketActivity,
  holders: TopHolder[],
  market: MarketEvent,
  language: 'zh' | 'en'
): MarketRisks {
  const isZh = language === 'zh';
  const alerts: RiskAlert[] = [];

  console.log('[MarketSummary] Risk assessment inputs:', {
    liquidity: micro.liquidity,
    spreadPercent: micro.spreadPercent,
    holdersCount: holders.length,
    imbalance: micro.depth.imbalance,
    volatility: activity.volatility,
    recentTradeCount: activity.recentTradeCount,
    slippageBuy500: micro.slippage.buy500,
    volume: market.volume,
    endDate: market.endDate,
  });

  // 1. 流动性风险
  // 预测市场中 $50K 以下就算低流动性，$10K 以下是极低
  if (micro.liquidity < 50000) {
    alerts.push({
      type: 'liquidity',
      severity: micro.liquidity < 10000 ? 'high' : 'medium',
      message: isZh
        ? `流动性 $${formatNum(micro.liquidity)}，${micro.liquidity < 10000 ? '大额交易将产生显著滑点' : '大额交易需注意滑点'}`
        : `Liquidity $${formatNum(micro.liquidity)}, ${micro.liquidity < 10000 ? 'large orders will cause significant slippage' : 'watch slippage on large orders'}`,
    });
  }

  // 2. 价差风险
  // 预测市场中 > 1% 已经偏高（相比传统金融更宽）
  if (micro.spreadPercent > 1) {
    alerts.push({
      type: 'liquidity',
      severity: micro.spreadPercent > 5 ? 'high' : 'medium',
      message: isZh
        ? `买卖价差 ${micro.spreadPercent.toFixed(1)}%，交易成本${micro.spreadPercent > 5 ? '很高' : '偏高'}`
        : `Spread at ${micro.spreadPercent.toFixed(1)}%, ${micro.spreadPercent > 5 ? 'very high' : 'elevated'} trading cost`,
    });
  }

  // 3. 滑点风险
  // $500 买入滑点 > 0.5% 就需要提示
  if (micro.slippage.buy500 > 0.5) {
    alerts.push({
      type: 'liquidity',
      severity: micro.slippage.buy500 > 2 ? 'high' : 'medium',
      message: isZh
        ? `$500 买入预计滑点 ${micro.slippage.buy500.toFixed(1)}%，建议拆分下单`
        : `Estimated ${micro.slippage.buy500.toFixed(1)}% slippage on $500 buy, consider splitting orders`,
    });
  }

  // 4. 持仓集中度风险
  // API 返回最多 20 个 holders，计算 top 3 在这批数据中的占比
  if (holders.length > 0) {
    const sortedHolders = [...holders].sort((a, b) => b.amount - a.amount);
    const totalHolding = sortedHolders.reduce((s, h) => s + h.amount, 0);
    const top3Amount = sortedHolders.slice(0, 3).reduce((s, h) => s + h.amount, 0);
    const concentrationRatio = totalHolding > 0 ? top3Amount / totalHolding : 0;

    // Top holder 单独检查
    const topHolderPct = totalHolding > 0 ? sortedHolders[0].amount / totalHolding : 0;

    console.log('[MarketSummary] Holder concentration:', {
      totalHolding: totalHolding.toFixed(0),
      top3Amount: top3Amount.toFixed(0),
      concentrationRatio: (concentrationRatio * 100).toFixed(1) + '%',
      topHolderPct: (topHolderPct * 100).toFixed(1) + '%',
      topHolder: sortedHolders[0]?.name || sortedHolders[0]?.address?.substring(0, 10),
    });

    // 前 3 名持仓超过 30% 就提示（API 只返回 top 20，所以 30% 已经很集中了）
    if (concentrationRatio > 0.3) {
      alerts.push({
        type: 'concentration',
        severity: concentrationRatio > 0.6 ? 'high' : 'medium',
        message: isZh
          ? `前 3 大持仓者占 Top20 的 ${(concentrationRatio * 100).toFixed(0)}%，持仓较集中`
          : `Top 3 holders own ${(concentrationRatio * 100).toFixed(0)}% among top 20, concentrated positions`,
      });
    }

    // 单一巨鲸检查: 最大持仓者占比 > 20%
    if (topHolderPct > 0.2) {
      alerts.push({
        type: 'manipulation',
        severity: topHolderPct > 0.4 ? 'high' : 'medium',
        message: isZh
          ? `最大持仓者持有 ${(topHolderPct * 100).toFixed(0)}%${sortedHolders[0]?.name ? ' (' + sortedHolders[0].name + ')' : ''}，鲸鱼风险`
          : `Largest holder owns ${(topHolderPct * 100).toFixed(0)}%${sortedHolders[0]?.name ? ' (' + sortedHolders[0].name + ')' : ''}, whale risk`,
      });
    }
  }

  // 5. 挂单不平衡风险
  // > 0.3 (30%) 就值得注意
  const absImbalance = Math.abs(micro.depth.imbalance);
  if (absImbalance > 0.3 && micro.depth.bidDepth + micro.depth.askDepth > 0) {
    const side = micro.depth.imbalance > 0 ? (isZh ? '买盘' : 'bid') : (isZh ? '卖盘' : 'ask');
    alerts.push({
      type: 'manipulation',
      severity: absImbalance > 0.6 ? 'high' : 'medium',
      message: isZh
        ? `挂单偏向${side}（不平衡 ${(absImbalance * 100).toFixed(0)}%），${absImbalance > 0.6 ? '可能存在操控' : '注意方向性风险'}`
        : `Order book skewed to ${side} (${(absImbalance * 100).toFixed(0)}% imbalance), ${absImbalance > 0.6 ? 'possible manipulation' : 'watch directional risk'}`,
    });
  }

  // 6. 波动率风险
  // 预测市场 > 3% 日波动率已算偏高（概率价格 0-1 区间，不像股票可以大幅波动）
  if (activity.volatility > 3) {
    alerts.push({
      type: 'manipulation',
      severity: activity.volatility > 10 ? 'high' : 'medium',
      message: isZh
        ? `24h 波动率 ${activity.volatility.toFixed(1)}%，价格波动${activity.volatility > 10 ? '剧烈' : '偏大'}`
        : `24h volatility ${activity.volatility.toFixed(1)}%, ${activity.volatility > 10 ? 'extreme' : 'elevated'} price movement`,
    });
  }

  // 7. 结算临近风险
  if (market.endDate) {
    const endTime = new Date(market.endDate).getTime();
    if (!isNaN(endTime)) {
      const daysToEnd = (endTime - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysToEnd <= 7 && daysToEnd > 0) {
        alerts.push({
          type: 'rules',
          severity: daysToEnd <= 1 ? 'high' : 'medium',
          message: isZh
            ? `距结算 ${daysToEnd < 1 ? '不到 1 天' : Math.ceil(daysToEnd) + ' 天'}，注意流动性撤离和结算规则`
            : `${daysToEnd < 1 ? '<1 day' : Math.ceil(daysToEnd) + ' days'} to settlement, watch liquidity withdrawal`,
        });
      }
    }
  }

  // 8. 交易活跃度风险
  // 有一定体量但近 24h 交易很少
  if (activity.recentTradeCount < 20 && (market.volume || 0) > 50000) {
    alerts.push({
      type: 'info_lag',
      severity: activity.recentTradeCount < 5 ? 'high' : 'medium',
      message: isZh
        ? `24h 仅 ${activity.recentTradeCount} 笔交易（总量 $${formatNum(market.volume || 0)}），价格可能滞后`
        : `Only ${activity.recentTradeCount} trades in 24h (total vol $${formatNum(market.volume || 0)}), price may be stale`,
    });
  }

  // 9. 大额交易占比风险
  if (activity.largeTradeCount > 0 && activity.recentTradeCount > 0) {
    const largeRatio = activity.largeTradeCount / activity.recentTradeCount;
    if (largeRatio > 0.1) {
      alerts.push({
        type: 'manipulation',
        severity: largeRatio > 0.3 ? 'high' : 'medium',
        message: isZh
          ? `${activity.largeTradeCount} 笔大额交易（>$500），占比 ${(largeRatio * 100).toFixed(0)}%，注意鲸鱼活动`
          : `${activity.largeTradeCount} large trades (>$500), ${(largeRatio * 100).toFixed(0)}% of activity, watch whale behavior`,
      });
    }
  }

  console.log('[MarketSummary] Risk alerts generated:', alerts.length, alerts.map(a => `[${a.severity}] ${a.type}: ${a.message.substring(0, 40)}`));

  // 综合风险等级
  const highCount = alerts.filter((a) => a.severity === 'high').length;
  const mediumCount = alerts.filter((a) => a.severity === 'medium').length;
  const overallLevel: 'low' | 'medium' | 'high' =
    highCount >= 1 ? 'high' : mediumCount >= 1 ? 'medium' : 'low';

  return { overallLevel, alerts };
}

// ============================================
// 综合判断
// ============================================

function synthesizeConclusion(
  micro: MarketMicrostructure,
  activity: MarketActivity,
  risks: MarketRisks,
  market: MarketEvent,
  language: 'zh' | 'en'
): {
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  oneLiner: string;
  keyDriver: string;
} {
  const isZh = language === 'zh';
  const yesPrice = market.yesPrice ?? micro.midPrice;

  // 基于多因子综合判断
  let bullishScore = 0;
  let bearishScore = 0;

  // 因子 1: 价格位置 (权重 40%)
  if (yesPrice > 0.65) bullishScore += 40;
  else if (yesPrice < 0.35) bearishScore += 40;
  else {
    bullishScore += 20;
    bearishScore += 20;
  }

  // 因子 2: 价格动量 (权重 25%)
  if (activity.priceChange24h > 3) bullishScore += 25;
  else if (activity.priceChange24h < -3) bearishScore += 25;
  else {
    bullishScore += 12;
    bearishScore += 12;
  }

  // 因子 3: 挂单不平衡 (权重 20%)
  if (micro.depth.imbalance > 0.2) bullishScore += 20;
  else if (micro.depth.imbalance < -0.2) bearishScore += 20;
  else {
    bullishScore += 10;
    bearishScore += 10;
  }

  // 因子 4: 大额交易方向信号 (权重 15%)
  if (activity.largeTradeCount > 3) {
    bullishScore += 10;
  }

  // 综合
  const totalScore = bullishScore + bearishScore;
  const bullishPct = totalScore > 0 ? bullishScore / totalScore : 0.5;

  let direction: 'bullish' | 'bearish' | 'neutral';
  let confidence: number;

  if (bullishPct > 0.58) {
    direction = 'bullish';
    confidence = Math.round(bullishPct * 100);
  } else if (bullishPct < 0.42) {
    direction = 'bearish';
    confidence = Math.round((1 - bullishPct) * 100);
  } else {
    direction = 'neutral';
    confidence = 50;
  }

  // 风险折损置信度
  if (risks.overallLevel === 'high') confidence = Math.max(30, confidence - 15);
  else if (risks.overallLevel === 'medium') confidence = Math.max(40, confidence - 5);

  // 生成一句话结论（不包含价格信息，用户在页面上已可见）
  let oneLiner: string;
  let keyDriver: string;

  if (direction === 'bullish') {
    oneLiner = isZh
      ? `市场偏多，买盘力量占优`
      : `Bullish bias, bid-side dominant`;
    keyDriver = isZh
      ? `挂单不平衡 ${(micro.depth.imbalance * 100).toFixed(0)}% 偏买方`
      : `Order imbalance ${(micro.depth.imbalance * 100).toFixed(0)}% bid-heavy`;
  } else if (direction === 'bearish') {
    oneLiner = isZh
      ? `市场偏空，卖盘力量占优`
      : `Bearish bias, ask-side dominant`;
    keyDriver = isZh
      ? `挂单不平衡 ${(Math.abs(micro.depth.imbalance) * 100).toFixed(0)}% 偏卖方`
      : `Order imbalance ${(Math.abs(micro.depth.imbalance) * 100).toFixed(0)}% ask-heavy`;
  } else {
    oneLiner = isZh
      ? `市场中性，多空平衡`
      : `Neutral, balanced market`;
    keyDriver = isZh
      ? `买卖力量均衡，等待方向性突破`
      : `Balanced order flow, awaiting directional breakout`;
  }

  return { direction, confidence, oneLiner, keyDriver };
}

// ============================================
// 工具函数
// ============================================

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
}
