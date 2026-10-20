import { probability, gammaPrices, kalshiPrices } from '../utils/prices';
import { normalizeMarketIdentity } from '../utils/market-identity';
import { createMonitorMutator, mergeMonitorPrices } from '../utils/monitor-storage';
/**
 * Background Service Worker
 * 处理所有后台任务：消息路由、API 调用、定时任务、通知等
 */

import { createMessageListener, extStorage, createNotification, getCurrentTab, broadcastToExtensionPages } from '../utils/messaging';
import type { MarketEvent, UserSettings, MonitorTask, PageContext, MarketOutcome } from '../utils/types';
import { generateMarketSummary } from '../utils/market-summary';
import { defineBackground } from 'wxt/utils/define-background';

// API 配置
// 开发环境使用本地后端，生产环境使用线上 API
import { API_BASE_URL } from '../config/runtime';

// 默认设置
const DEFAULT_SETTINGS: UserSettings = {
  language: 'zh',
  theme: 'system',
  enableFloatingBall: true,
  enablePageEnhancement: true,
  enableTextSelection: true,
  enableNotifications: true,
  floatingBallPosition: { x: 20, y: 20 },
  preferredModel: 'deepseek/deepseek-chat',
  priceAlertThreshold: 5,
  isPro: false,
  dailyAnalysisCount: 0,
  dailyAnalysisLimit: 3
};

// 当前页面上下文缓存
let currentPageContext: PageContext | null = null;

// ============================================
// 价格缓存层（减少 API 调用）
// ============================================
interface MarketOutcomeCache {
  id: string;
  name: string;
  yesPrice: number | null;
  noPrice: number | null;
}

interface PriceCacheEntry {
  yesPrice: number | null;
  noPrice: number | null;
  outcomes?: MarketOutcomeCache[];
  isMultiOptionMarket?: boolean;
  timestamp: number;
}

const priceCache = new Map<string, PriceCacheEntry>();
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

interface MemoryCacheEntry<T> {
  value: T;
  timestamp: number;
}

function getFromMemoryCache<T>(
  cache: Map<string, MemoryCacheEntry<T>>,
  key: string,
  ttlMs: number
): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    cache.delete(key);
    return null;
  }
  // LRU: move key to tail
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function setToMemoryCache<T>(
  cache: Map<string, MemoryCacheEntry<T>>,
  key: string,
  value: T,
  maxSize: number
): void {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, { value, timestamp: Date.now() });
  if (cache.size > maxSize) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

const inFlightRequestMap = new Map<string, Promise<any>>();
async function withInFlightDedup<T>(key: string, producer: () => Promise<T>): Promise<T> {
  const existing = inFlightRequestMap.get(key);
  if (existing) return existing as Promise<T>;
  const promise = producer();
  inFlightRequestMap.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlightRequestMap.delete(key);
  }
}

const SEARCH_CACHE_TTL = 7 * 60 * 1000;
const SEARCH_CACHE_MAX_SIZE = 100;
const searchResultsCache = new Map<string, MemoryCacheEntry<{ markets: MarketEvent[]; metadata: any }>>();

const COMMUNITY_SENTIMENT_CACHE_TTL = 15 * 60 * 1000;
const COMMUNITY_SENTIMENT_CACHE_MAX_SIZE = 60;
const communitySentimentCache = new Map<string, MemoryCacheEntry<any>>();

const ARBITRAGE_CACHE_TTL = 5 * 60 * 1000;
const ARBITRAGE_CACHE_MAX_SIZE = 50;
const arbitrageCache = new Map<string, MemoryCacheEntry<{ success: boolean; markets: any[]; related: any[] }>>();

const NEWS_CACHE_TTL = 30 * 60 * 1000;
const NEWS_CACHE_MAX_SIZE = 50;
const newsSummaryCache = new Map<string, MemoryCacheEntry<{ success: boolean; articles: any[] }>>();

const SUMMARY_CACHE_TTL = 10 * 60 * 1000;
const SUMMARY_CACHE_MAX_SIZE = 50;
const marketSummaryCache = new Map<string, MemoryCacheEntry<any>>();

const TRENDING_CACHE_TTL = 2 * 60 * 1000;
const TRENDING_CACHE_MAX_SIZE = 20;
const trendingMarketsCache = new Map<string, MemoryCacheEntry<MarketEvent[]>>();

function normalizeTextForCache(text: string): string {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * 获取缓存的价格（如果未过期）
 */
function getCachedPrice(marketId: string, source: string): PriceCacheEntry | null {
  const key = `${source}:${marketId}`;
  const cached = priceCache.get(key);

  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
    console.log(`[PriceCache] ✅ Hit: ${key} (multi=${cached.isMultiOptionMarket}, outcomes=${cached.outcomes?.length || 0})`);
    return cached;
  }

  if (cached) {
    priceCache.delete(key); // 清理过期缓存
  }
  return null;
}

/**
 * 设置价格缓存（支持多选项市场）
 */
function setCachedPrice(
  marketId: string,
  source: string,
  yesPrice: number | null,
  noPrice: number | null,
  outcomes?: any[],
  isMultiOptionMarket?: boolean
): void {
  const key = `${source}:${marketId}`;
  priceCache.set(key, {
    yesPrice,
    noPrice,
    outcomes: outcomes?.map(o => ({
      id: o.id,
      name: o.name,
      yesPrice: o.yesPrice,
      noPrice: o.noPrice,
    })),
    isMultiOptionMarket,
    timestamp: Date.now()
  });
  console.log(`[PriceCache] 💾 Set: ${key} = ${yesPrice == null ? "unavailable" : (yesPrice * 100).toFixed(1)}% (multi=${isMultiOptionMarket}, outcomes=${outcomes?.length || 0})`);
}

// Keep-alive 机制：防止 Service Worker 在长时间操作期间被终止
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

function startKeepAlive() {
  if (keepAliveInterval) return;
  console.log('[Background] 🔄 Starting keep-alive...');
  keepAliveInterval = setInterval(() => {
    // 通过访问 chrome.runtime.id 保持 Service Worker 活跃
    if (chrome.runtime.id) {
      // 这个操作会重置 Service Worker 的 30 秒空闲计时器
    }
  }, 25000); // 每 25 秒执行一次（小于 30 秒的空闲超时）
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    console.log('[Background] ⏹️ Stopping keep-alive...');
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// ============================================
// 主题自适应图标
// ============================================

/**
 * 更新扩展图标以匹配系统主题
 * @param isDark 是否为暗色模式
 */
function updateIconForTheme(isDark: boolean): void {
  const iconFolder = isDark ? 'dark' : 'light';
  const iconPath = {
    16: `icon/${iconFolder}/16.png`,
    32: `icon/${iconFolder}/32.png`,
    48: `icon/${iconFolder}/48.png`,
    128: `icon/${iconFolder}/128.png`
  };

  chrome.action.setIcon({ path: iconPath })
    .then(() => console.log(`[Background] Icon updated for ${isDark ? 'dark' : 'light'} theme`))
    .catch((err) => console.error('[Background] Failed to update icon:', err));
}

const mutateMonitors = createMonitorMutator(
  async () => await extStorage.get<MonitorTask[]>('monitors') || [],
  items => extStorage.set('monitors', items)
);

async function saveSelectedMarket(market: MarketEvent, sender: chrome.runtime.MessageSender) {
  market = normalizeMarketIdentity(market);
  const tab = sender.tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (tab?.id == null) return;
  const page = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_STATE' }).catch(() => null);
  await chrome.storage.session.set({ [`selected:${tab.id}`]: { market, url: page?.url || sender.url } });
  void broadcastToExtensionPages('MARKET_SELECTED', {});
}

async function activeMarket() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return null;
  const page = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_STATE' }).catch(() => null);
  if (!page) return null;
  const key = `selected:${tab.id}`;
  const saved = (await chrome.storage.session.get(key))[key];
  return saved?.url === page.url ? saved.market : page.market;
}

export default defineBackground(() => {
  console.log('[Background] Service Worker started');

  // 点击扩展图标自动打开原生 Side Panel（用户维度：账号、监控、设置）
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .then(() => console.log('[Background] Side panel behavior set'))
    .catch((err) => console.error('[Background] Failed to set side panel behavior:', err));

  // 初始化
  initializeExtension();

  // 设置消息监听器
  setupMessageListeners();

  // 设置定时任务
  setupAlarms();

  // 设置右键菜单
  setupContextMenus();

  // 监听扩展图标点击 - 打开原生侧边栏
  // 注意：openPanelOnActionClick: true 时此监听器不会触发，保留作为 fallback
  chrome.action.onClicked.addListener(async (tab) => {
    console.log('[Background] Extension icon clicked, tab:', tab.id);
    if (tab.windowId) {
      try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        console.log('[Background] Side panel opened via icon click');
      } catch (err) {
        console.error('[Background] Failed to open side panel:', err);
      }
    }
  });

  chrome.tabs.onActivated.addListener(() => { void broadcastToExtensionPages('MARKET_SELECTED', {}); });
  chrome.tabs.onUpdated.addListener((_tabId, change) => {
    if (change.status === 'complete' || change.url) void broadcastToExtensionPages('MARKET_SELECTED', {});
  });
  chrome.tabs.onRemoved.addListener(tabId => { void chrome.storage.session.remove(`selected:${tabId}`); });
});

/**
 * 初始化扩展
 */
async function initializeExtension() {
  // 初始化默认设置
  const existingSettings = await extStorage.get<UserSettings>('settings');
  if (!existingSettings) {
    await extStorage.set('settings', DEFAULT_SETTINGS);
  }

  // 重置每日计数（如果是新的一天）
  const lastResetDate = await extStorage.get<string>('lastResetDate');
  const today = new Date().toDateString();
  if (lastResetDate !== today) {
    const settings = await extStorage.get<UserSettings>('settings') || DEFAULT_SETTINGS;
    await extStorage.set('settings', { ...settings, dailyAnalysisCount: 0 });
    await extStorage.set('lastResetDate', today);
  }

  console.log('[Background] Extension initialized');
}

/**
 * 设置消息监听器
 */
function setupMessageListeners() {
  createMessageListener({
    // 获取设置
    GET_SETTINGS: async () => {
      return await extStorage.get<UserSettings>('settings') || DEFAULT_SETTINGS;
    },

    // 保存设置
    SET_SETTINGS: async (payload) => {
      const currentSettings = await extStorage.get<UserSettings>('settings') || DEFAULT_SETTINGS;
      const newSettings = { ...currentSettings, ...payload };
      await extStorage.set('settings', newSettings);
      return newSettings;
    },

    // 更新图标主题
    UPDATE_ICON_THEME: async (payload) => {
      const isDark = payload?.isDark ?? true;
      updateIconForTheme(isDark);
      return { success: true, theme: isDark ? 'dark' : 'light' };
    },

    GET_BACKEND_STATUS: async () => {
      const response = await fetch(`${API_BASE_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('Backend unavailable');
      return response.json();
    },

    // 获取页面上下文
    GET_PAGE_CONTEXT: async () => {
      return currentPageContext;
    },

    // 设置页面上下文
    SET_PAGE_CONTEXT: async (payload) => {
      currentPageContext = payload.context;
      return currentPageContext;
    },

    // 分析市场 - 同时通知 Side Panel
    ANALYZE_MARKET: async (payload, sender) => {
      console.log('[Background] 📥 ANALYZE_MARKET received:', {
        hasMarket: !!payload?.market,
        marketTitle: payload?.market?.title?.substring(0, 50),
        model: payload?.model,
        language: payload?.language
      });
      
      const { market, model, language } = payload;
      
      // 如果只是传递市场数据（没有 model），则只存储并广播给 side panel
      if (!model) {
        // 存储当前选中的市场
        await saveSelectedMarket(market, sender);
        console.log('[Background] Market selected and stored:', market.title);
        
        // 广播给所有扩展页面（包括 side panel）
        broadcastToExtensionPages('MARKET_SELECTED', {});
        
        return { success: true, market };
      }
      
      throw new Error('Legacy paid analysis is not part of this local extension.');
    },

    // 获取当前选中的市场
    GET_SELECTED_MARKET: async () => {
      return activeMarket();
    },

    // 设置当前选中的市场
    SET_SELECTED_MARKET: async (payload, sender) => {
      const { market } = payload;
      await saveSelectedMarket(market, sender);
      // 广播给 side panel
      broadcastToExtensionPages('MARKET_SELECTED', {});
      return { success: true };
    },

    // 获取热门市场
    GET_TRENDING_MARKETS: async (payload) => {
      const { limit = 20, category } = payload || {};
      return await fetchTrendingMarkets(limit, category);
    },

    // 搜索市场
    SEARCH_MARKETS: async (payload) => {
      const { query, limit = 20 } = payload || {};
      const searchResult = await searchMarketsWithMetadata(query, limit);
      return {
        markets: searchResult.markets,
        metadata: searchResult.metadata,
      };
    },

    // 划词搜索 - 直接返回结果给 Content Script
    TEXT_SEARCH: async (payload) => {
      const { text, limit = 5 } = payload || {};
      const settings = await extStorage.get<UserSettings>('settings') || DEFAULT_SETTINGS;
      
      // TODO: 开发阶段暂时移除搜索次数限制，上线前恢复
      // const dailySearchCount = await extStorage.get<number>('dailySearchCount') || 0;
      // const DAILY_SEARCH_LIMIT = settings.isPro ? Infinity : 10;
      // if (dailySearchCount >= DAILY_SEARCH_LIMIT) { ... }
      
      try {
        console.log('[Background] TEXT_SEARCH:', text);
        
        // 搜索市场
        const searchResult = await searchMarketsWithMetadata(text, limit);
        const markets = searchResult.markets;
        
        return {
          success: true,
          markets,
          metadata: searchResult.metadata,
          remainingSearches: undefined  // 开发阶段不显示剩余次数
        };
      } catch (error) {
        console.error('[Background] TEXT_SEARCH error:', error);
        return {
          success: false,
          error: settings.language === 'zh' 
            ? '搜索失败，请重试'
            : 'Search failed, please try again'
        };
      }
    },

    // 页面扫描 - 批量处理文本块，为每个块搜索相关预测市场
    // 输入：{ blocks: [{ index, text }], url }
    // 输出：{ blockResults: [{ blockIndex, markets }] }
    PAGE_SCAN: async (payload) => {
      const { url, blocks } = payload || {};
      const settings = await extStorage.get<UserSettings>('settings') || DEFAULT_SETTINGS;

      try {
        if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
          return {
            success: false,
            error: settings.language === 'zh'
              ? '未提供文本块'
              : 'No text blocks provided'
          };
        }

        console.log('[Background] PAGE_SCAN:', {
          blocksCount: blocks.length,
          url
        });

        // 过滤有效的 blocks（长度 > 20）
        const validBlocks = blocks.filter((b: { index: number; text: string }) =>
          b.text && b.text.length > 20
        ).slice(0, 8); // 最多处理 8 个 blocks

        if (validBlocks.length === 0) {
          return {
            success: false,
            error: settings.language === 'zh'
              ? '未找到有效内容'
              : 'No valid content found'
          };
        }

        let blockResults: Array<{ blockIndex: number; markets: MarketEvent[] }> = [];

        try {
          // 优先 batch：一次请求处理多个 blocks
          const batchResponse = await fetch(`${API_BASE_URL}/api/search/quick-batch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              blocks: validBlocks.map((b: { index: number; text: string }) => ({
                id: b.index,
                text: b.text
              })),
              limit: 10,
            })
          });

          if (!batchResponse.ok) {
            throw new Error(`Batch search API error: ${batchResponse.status}`);
          }

          const batchData = await batchResponse.json();
          if (!batchData.success || !Array.isArray(batchData.blockResults)) {
            throw new Error('Batch search API returned invalid data');
          }

          blockResults = batchData.blockResults.map((item: any) => ({
            blockIndex: Number(item.blockId),
            markets: mapQuickSearchResultsToMarketEvents(item.results || []).slice(0, 3),
          }));
        } catch (batchError) {
          console.warn('[Background] PAGE_SCAN batch failed, fallback to per-block search:', batchError);

          // 回退到旧逻辑
          const searchPromises = validBlocks.map(async (block: { index: number; text: string }) => {
            try {
              const result = await scanPageContent(block.text, url);
              return {
                blockIndex: block.index,
                markets: result.markets.slice(0, 3), // 每个 block 最多返回 3 个市场
              };
            } catch (err) {
              console.error(`[Background] Block ${block.index} search error:`, err);
              return { blockIndex: block.index, markets: [] };
            }
          });

          blockResults = await Promise.all(searchPromises);
        }

        // 过滤掉没有结果的 blocks
        const resultsWithMarkets = blockResults.filter(r => r.markets.length > 0);

        console.log('[Background] PAGE_SCAN results:', {
          totalBlocks: validBlocks.length,
          blocksWithMarkets: resultsWithMarkets.length
        });

        return {
          success: true,
          blockResults: resultsWithMarkets
        };
      } catch (error) {
        console.error('[Background] PAGE_SCAN error:', error);
        return {
          success: false,
          error: settings.language === 'zh'
            ? '扫描失败，请重试'
            : 'Scan failed, please try again'
        };
      }
    },

    // 分析文本
    ANALYZE_TEXT: async () => { throw new Error('Legacy analysis unavailable'); },

    // 获取监控列表
    GET_MONITORS: async () => {
      return await extStorage.get<MonitorTask[]>('monitors') || [];
    },

    // 添加监控
    ADD_MONITOR: async (payload) => mutateMonitors(items => {
      if (!payload?.id || !payload?.marketId) throw new Error('Invalid monitor');
      return [...items.filter(item => item.id !== payload.id), payload];
    }),

    REMOVE_MONITOR: async (payload) => mutateMonitors(items => items.filter(item => item.id !== payload.id)),

    // Invoke before any await so the content-script click retains its user gesture.
    OPEN_SIDEPANEL: async (_, sender) => {
      if (sender.tab?.id == null) throw new Error('No originating tab');
      await chrome.sidePanel.open({ tabId: sender.tab.id });
      return { opened: true };
    },

    // ============================================
    // 事件详情页增强面板 API
    // ============================================

    // 获取相关市场数据 - 合并跨市场比价和关联事件
    // 一次搜索，按相似度分流到两个区域
    GET_ARBITRAGE_DATA: async (payload) => {
      const { market, searchQuery, forceRefresh = false } = payload || {};
      const title = searchQuery || market?.title || '';
      const cacheKey = `arbitrage:${market?.id || 'unknown'}:${normalizeTextForCache(title)}`;

      try {
        if (!forceRefresh) {
          const cached = getFromMemoryCache(arbitrageCache, cacheKey, ARBITRAGE_CACHE_TTL);
          if (cached) {
            return {
              ...cached,
              metadata: { fromCache: true },
            };
          }
        }

        console.log('[Background] GET_ARBITRAGE_DATA (unified):', {
          title,
          source: market?.source,
          id: market?.id
        });

        return await withInFlightDedup(`inflight:${cacheKey}`, async () => {
        // ============================================
        // 阶段 1: 语义搜索匹配事件
        // ============================================

        // 提取关键词（去除常见词）
        const stopWords = ['the', 'a', 'an', 'is', 'are', 'will', 'be', 'to', 'of', 'in', 'on', 'at', 'for', 'by', 'with'];
        const keywords = title
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .split(/\s+/)
          .filter((w: string) => w.length > 2 && !stopWords.includes(w));

        // 策略 1: 先用完整标题搜索（精确匹配）
        let allMarkets: any[] = [];
        const exactResults = await searchMarkets(title, 15);
        if (exactResults && exactResults.length > 0) {
          allMarkets = exactResults;
        }

        // 策略 2: 用关键词组合搜索（补充结果）
        if (keywords.length >= 3) {
          const keywordQuery = keywords.slice(0, 5).join(' ');
          const keywordResults = await searchMarkets(keywordQuery, 10);
          if (keywordResults && keywordResults.length > 0) {
            // 合并结果，去重
            keywordResults.forEach((m: any) => {
              if (!allMarkets.find((existing: any) => existing.id === m.id)) {
                allMarkets.push(m);
              }
            });
          }
        }

        // 过滤掉当前事件自身
        const otherMarkets = allMarkets.filter((m: any) =>
          m.id !== market?.id && m.conditionId !== market?.conditionId
        );

        console.log('[Background] Search results:', {
          total: allMarkets.length,
          afterFilter: otherMarkets.length,
          keywords,
          results: otherMarkets.slice(0, 5).map((m: any) => ({
            title: m.title?.substring(0, 40),
            source: m.source,
            id: m.id
          }))
        });

        // 计算相似度
        const marketsWithSimilarity = otherMarkets.map((m: any) => {
          const otherTitle = (m.title || '').toLowerCase();
          const currentTitle = title.toLowerCase();

          // 简单的相似度计算：匹配的关键词数量
          const matchedKeywords = keywords.filter((kw: string) => otherTitle.includes(kw));
          const similarity = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0;

          // 检查是否是精确匹配（标题几乎相同）
          const isExactMatch = similarity > 0.8 ||
            otherTitle.includes(currentTitle.substring(0, 30)) ||
            currentTitle.includes(otherTitle.substring(0, 30));

          return {
            ...m,
            similarity,
            isExactMatch,
            matchedKeywords: matchedKeywords.length
          };
        });

        // ============================================
        // 阶段 2: 按相似度分流
        // ============================================

        // 高相似度 (>= 50%) → 跨市场比价 (优先不同平台)
        const highSimilarity = marketsWithSimilarity
          .filter((m: any) => m.similarity >= 0.5 || m.isExactMatch)
          .sort((a: any, b: any) => {
            // 不同平台优先
            const aDiffPlatform = a.source !== market?.source ? 1 : 0;
            const bDiffPlatform = b.source !== market?.source ? 1 : 0;
            if (aDiffPlatform !== bDiffPlatform) return bDiffPlatform - aDiffPlatform;
            // 然后按相似度
            if (a.isExactMatch && !b.isExactMatch) return -1;
            if (!a.isExactMatch && b.isExactMatch) return 1;
            return b.similarity - a.similarity;
          })
          .slice(0, 5);

        // 低相似度 (< 50%) → 关联事件
        const lowSimilarity = marketsWithSimilarity
          .filter((m: any) => m.similarity < 0.5 && !m.isExactMatch)
          .sort((a: any, b: any) => b.similarity - a.similarity)
          .slice(0, 5);

        console.log('[Background] Similarity results:', marketsWithSimilarity.slice(0, 5).map((m: any) => ({
          title: m.title?.substring(0, 40),
          source: m.source,
          similarity: m.similarity?.toFixed(2),
          matchedKeywords: m.matchedKeywords,
          isExactMatch: m.isExactMatch
        })));

        console.log('[Background] Split results:', {
          highSimilarity: highSimilarity.length,
          lowSimilarity: lowSimilarity.length,
          highItems: highSimilarity.map((m: any) => ({ title: m.title?.substring(0, 30), source: m.source, sim: m.similarity?.toFixed(2) })),
          lowItems: lowSimilarity.map((m: any) => ({ title: m.title?.substring(0, 30), source: m.source, sim: m.similarity?.toFixed(2) }))
        });

        // ============================================
        // 阶段 3: 对高相似度结果获取实时价格
        // ============================================

        const enrichedArbitrage = await enrichMarketsWithLatestData(highSimilarity);

        console.log('[Background] Enriched arbitrage markets:', enrichedArbitrage.map((m: any) => ({
          title: m.title?.substring(0, 40),
          source: m.source,
          yesPrice: m.yesPrice,
          isExactMatch: m.isExactMatch
        })));

        const result = {
          success: true,
          // 跨市场比价 (高相似度，实时价格)
          markets: enrichedArbitrage,
          // 关联事件 (低相似度，快照价格)
          related: lowSimilarity
        };
        setToMemoryCache(arbitrageCache, cacheKey, result, ARBITRAGE_CACHE_MAX_SIZE);
        return {
          ...result,
          metadata: { fromCache: false },
        };
        });
      } catch (error) {
        console.error('[Background] GET_ARBITRAGE_DATA error:', error);
        return { success: false, error: String(error), markets: [], related: [] };
      }
    },

    // 获取聪明钱数据 (TODO: 实现链上数据查询)
    GET_SMART_MONEY_DATA: async () => { throw new Error('Smart money analysis is not implemented'); },

    // 获取新闻摘要
    GET_NEWS_SUMMARY: async () => { throw new Error('Standalone news summaries unavailable; use the news/price timeline.'); },

    GET_TIMELINE_DATA: (() => {
      // 缓存已解析的 slug → { conditionId, tokenId }，避免切换 period 时重复调 Gamma API
      const resolvedCache = new Map<string, { conditionId: string; tokenId: string }>();
      const timelineDataCache = new Map<string, MemoryCacheEntry<any>>();
      const TIMELINE_DATA_CACHE_TTL = 3 * 60 * 1000;
      const TIMELINE_DATA_CACHE_MAX_SIZE = 40;

      return async (payload: any) => {
      const startTime = performance.now();
      const {
        conditionId: rawConditionId,
        title,
        period = '7d',
        impactFilter = 'all',
        market,
        forceRefresh = false,
      } = payload || {};
      const timelineCacheKey = `timeline:${rawConditionId || 'unknown'}:${period}:${impactFilter}`;

      try {
        console.log('[Background] GET_TIMELINE_DATA:', title, 'period:', period, 'rawConditionId:', rawConditionId?.substring(0, 30));

        if (!rawConditionId) {
          console.error('[Background] GET_TIMELINE_DATA: Missing conditionId');
          return null;
        }

        if (!forceRefresh) {
          const cachedTimeline = getFromMemoryCache(timelineDataCache, timelineCacheKey, TIMELINE_DATA_CACHE_TTL);
          if (cachedTimeline) {
            console.log('[Background][TimelineCache] cache=hit', {
              key: timelineCacheKey,
              period,
              impactFilter,
            });
            return cachedTimeline;
          }
          console.log('[Background][TimelineCache] cache=miss', {
            key: timelineCacheKey,
            period,
            impactFilter,
          });
        } else {
          console.log('[Background][TimelineCache] cache=skip(forceRefresh)', {
            key: timelineCacheKey,
            period,
            impactFilter,
          });
        }

        // 如果 conditionId 不是 0x... 格式，说明是 slug，需要先通过 Gamma API 解析
        let realConditionId = rawConditionId;
        let tokenId = '';

        // 检查缓存
        const cached = resolvedCache.get(rawConditionId);
        if (cached) {
          realConditionId = cached.conditionId;
          tokenId = cached.tokenId;
          console.log('[Background] GET_TIMELINE_DATA: Using cached IDs for', rawConditionId.substring(0, 20));
        } else if (!rawConditionId.startsWith('0x')) {
          console.log('[Background] GET_TIMELINE_DATA: conditionId is a slug, resolving via Gamma API...');

          const slug = rawConditionId;
          const gammaStart = performance.now();
          try {
            const gammaResp = await fetch(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`);
            if (gammaResp.ok) {
              const events = await gammaResp.json();
              if (Array.isArray(events) && events.length > 0) {
                const eventMarkets = events[0].markets || [];
                // 找到活跃且 volume 最大的子市场
                const activeMarkets = eventMarkets.filter((m: any) => {
                  if (!m.conditionId) return false;
                  if (m.closed === true || m.active === false) return false;
                  const prices = m.outcomePrices;
                  if (prices) {
                    try {
                      const parsed = typeof prices === 'string' ? JSON.parse(prices) : prices;
                      if (Array.isArray(parsed) && parsed.length >= 2) {
                        const p0 = parseFloat(parsed[0]);
                        const p1 = parseFloat(parsed[1]);
                        if ((p0 <= 0.001 && p1 >= 0.999) || (p0 >= 0.999 && p1 <= 0.001)) return false;
                      }
                    } catch { /* ignore */ }
                  }
                  return true;
                });
                const pool = activeMarkets.length > 0 ? activeMarkets : eventMarkets;
                const bestMarket = pool.reduce((best: any, m: any) => {
                  return parseFloat(m.volume || '0') > parseFloat(best.volume || '0') ? m : best;
                }, pool[0]);
                realConditionId = bestMarket?.conditionId || rawConditionId;

                // 提取 tokenId (clobTokenIds[0] = YES token)
                const rawClobIds = bestMarket?.clobTokenIds;
                if (rawClobIds) {
                  try {
                    const ids = typeof rawClobIds === 'string' ? JSON.parse(rawClobIds) : rawClobIds;
                    tokenId = ids[0] || '';
                  } catch { /* ignore */ }
                }

                const gammaTime = performance.now() - gammaStart;
                console.log(`[Background] ⏱️ Gamma API: ${gammaTime.toFixed(0)}ms - Resolved conditionId:`, realConditionId.substring(0, 20) + '..., tokenId:', tokenId.substring(0, 20) + '...');

                // 缓存结果
                resolvedCache.set(rawConditionId, { conditionId: realConditionId, tokenId });
              }
            }
          } catch (e) {
            const gammaTime = performance.now() - gammaStart;
            console.error(`[Background] ⏱️ Gamma API failed after ${gammaTime.toFixed(0)}ms:`, e);
          }
        }

        // 并行: 1) 从 CLOB API 获取价格历史 (浏览器直接调用)  2) 从后端获取事件数据
        const params = new URLSearchParams({
          title: title || '',
          period,
          impactFilter,
          ...(tokenId ? { tokenId } : {})
        });

        const backendUrl = `${API_BASE_URL}/api/polymarket/timeline/${encodeURIComponent(realConditionId)}?${params}`;
        console.log('[Background] GET_TIMELINE_DATA: Fetching in parallel - CLOB price + backend events');

        // CLOB 价格历史的粒度配置
        const clobConfig: Record<string, { interval: string; fidelity: number }> = {
          '24h': { interval: '1d', fidelity: 5 },
          '7d':  { interval: '1w', fidelity: 60 },
          '30d': { interval: '1m', fidelity: 360 },
        };
        const clobCfg = clobConfig[period] || clobConfig['7d'];

        const apiStart = performance.now();
        const [clobResult, backendResult] = await Promise.allSettled([
          // CLOB 价格数据 — 从浏览器直接调用（绕过后端网络问题）
          tokenId ? (async () => {
            const clobStart = performance.now();
            try {
              const resp = await fetch(
                `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(tokenId)}&interval=${clobCfg.interval}&fidelity=${clobCfg.fidelity}`
              );
              const clobTime = performance.now() - clobStart;
              console.log(`[Background] ⏱️ CLOB API: ${clobTime.toFixed(0)}ms`);
              return resp.ok ? resp.json() : null;
            } catch (e) {
              console.log(`[Background] ⏱️ CLOB API failed: ${performance.now() - clobStart}ms`);
              return null;
            }
          })() : Promise.resolve(null),

          // 后端事件数据（新闻 + 异动检测）
          (async () => {
            const backendStart = performance.now();
            try {
              const resp = await fetch(backendUrl, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
              });
              const backendTime = performance.now() - backendStart;
              console.log(`[Background] ⏱️ Backend API: ${backendTime.toFixed(0)}ms`);
              return resp.ok ? resp.json() : null;
            } catch (e) {
              console.log(`[Background] ⏱️ Backend API failed: ${performance.now() - backendStart}ms`);
              return null;
            }
          })(),
        ]);
        const parallelTime = performance.now() - apiStart;
        console.log(`[Background] ⏱️ Parallel API calls completed in ${parallelTime.toFixed(0)}ms`);

        // 解析 CLOB 价格数据
        const clobData = clobResult.status === 'fulfilled' ? clobResult.value : null;
        const clobHistory = clobData?.history || [];
        const priceData = clobHistory.map((h: any, i: number) => {
          const price = parseFloat(h.p);
          const prevPrice = i > 0 ? parseFloat(clobHistory[i - 1].p) : price;
          return {
            timestamp: h.t,
            time: new Date(h.t * 1000).toISOString(),
            open: prevPrice,
            high: Math.max(price, prevPrice),
            low: Math.min(price, prevPrice),
            close: price,
            volume: 0
          };
        });

        // 解析后端事件数据
        const backendData = backendResult.status === 'fulfilled' ? backendResult.value : null;
        const timeline = backendData?.data || {};
        timeline.capabilities = { ...timeline.capabilities, events: backendData?.success === true && timeline.capabilities?.events === 'available' ? 'available' : 'unavailable' };

        // 合并: 用浏览器获取的价格数据覆盖后端的空数据
        if (priceData.length > 0) {
          timeline.priceData = priceData;

          // 简单异动检测（Z-score）
          const anomalies: any[] = [];
          const lookback = period === '24h' ? 6 : period === '7d' ? 12 : 20;
          for (let i = lookback; i < priceData.length; i++) {
            const window = priceData.slice(i - lookback, i);
            const current = priceData[i];
            const prev = priceData[i - 1];
            if (!prev.close || prev.close === 0) continue;

            const currentChange = Math.abs(current.close - prev.close) / prev.close;
            const changes = [];
            for (let j = 1; j < window.length; j++) {
              if (window[j - 1].close > 0) {
                changes.push(Math.abs(window[j].close - window[j - 1].close) / window[j - 1].close);
              }
            }
            if (changes.length < 3) continue;

            const avg = changes.reduce((a: number, b: number) => a + b, 0) / changes.length;
            const std = Math.sqrt(changes.reduce((sum: number, c: number) => sum + Math.pow(c - avg, 2), 0) / changes.length);
            const zScore = std > 0 ? (currentChange - avg) / std : 0;

            if (zScore > 1.8) {
              const pctChange = ((current.close - prev.close) / prev.close) * 100;
              anomalies.push({
                timestamp: current.timestamp,
                time: current.time,
                type: 'price_spike',
                severity: Math.min(100, Math.round(zScore * 20)),
                priceChange: Math.round(pctChange * 100) / 100,
                direction: pctChange > 0 ? 'up' : 'down',
                zScore: Math.round(zScore * 100) / 100,
                price: current.close,
                priceBefore: prev.close
              });
            }
          }
          timeline.anomalies = anomalies.sort((a: any, b: any) => b.severity - a.severity).slice(0, 10);

          // 计算价格分析
          if (priceData.length >= 2) {
            const first = priceData[0];
            const last = priceData[priceData.length - 1];
            const closes = priceData.map((c: any) => c.close);
            const priceChange = last.close - first.open;
            const pctChange = first.open > 0 ? (priceChange / first.open) * 100 : 0;
            const high = Math.max(...closes);
            const low = Math.min(...closes);
            const avgP = closes.reduce((a: number, b: number) => a + b, 0) / closes.length;
            const vol = Math.sqrt(closes.reduce((s: number, p: number) => s + Math.pow(p - avgP, 2), 0) / closes.length);

            timeline.priceAnalysis = {
              currentPrice: last.close,
              startPrice: first.open,
              priceChange: Math.round(priceChange * 10000) / 10000,
              priceChangePercent: Math.round(pctChange * 100) / 100,
              high, low,
              avgPrice: Math.round(avgP * 10000) / 10000,
              volatility: Math.round(vol * 10000) / 10000,
              volatilityPercent: avgP > 0 ? Math.round((vol / avgP) * 100 * 100) / 100 : 0,
              trend: pctChange > 5 ? 'bullish' : pctChange < -5 ? 'bearish' : 'stable',
              dataPoints: priceData.length,
              timeRangeHours: Math.round((last.timestamp - first.timestamp) / 3600)
            };
          }

          // 更新 summary
          if (timeline.summary) {
            timeline.summary.anomaliesCount = timeline.anomalies.length;
          }
        }

        const totalTime = performance.now() - startTime;
        console.log('[Background] GET_TIMELINE_DATA result:', {
          priceSource: priceData.length > 0 ? 'CLOB (browser)' : 'none',
          priceDataCount: timeline.priceData?.length || 0,
          eventsCount: timeline.events?.length || 0,
          anomaliesCount: timeline.anomalies?.length || 0,
          hasPriceAnalysis: !!timeline.priceAnalysis,
          totalTime: `${totalTime.toFixed(0)}ms`
        });

        // 直接返回 timeline 对象，messaging 层会包装成 { success: true, data: timeline }
        if (timeline.capabilities.events === 'available') setToMemoryCache(timelineDataCache, timelineCacheKey, timeline, TIMELINE_DATA_CACHE_MAX_SIZE);
        return timeline || null;
      } catch (error) {
        const errorTime = performance.now() - startTime;
        console.error(`[Background] GET_TIMELINE_DATA error after ${errorTime.toFixed(0)}ms:`, error);
        return null;
      }
    };  // end inner async function
    })(),  // end IIFE

    // 获取 Market Summary 市场总结
    GET_MARKET_SUMMARY: async (payload) => {
      const { market, forceRefresh = false } = payload || {};
      const settings = await extStorage.get<UserSettings>('settings') || DEFAULT_SETTINGS;
      const cacheKey = `summary:${market?.id || 'unknown'}:${settings.language}`;

      try {
        console.log('[Background] GET_MARKET_SUMMARY:', market?.title);

        if (!market) {
          return null;
        }

        if (!forceRefresh) {
          const cached = getFromMemoryCache(marketSummaryCache, cacheKey, SUMMARY_CACHE_TTL);
          if (cached) {
            return {
              ...cached,
              _metadata: { fromCache: true },
            };
          }
        }

        return await withInFlightDedup(`inflight:${cacheKey}`, async () => {
        const summary = await generateMarketSummary(market, settings.language);

        console.log('[Background] Market Summary generated:', {
          direction: summary.direction,
          confidence: summary.confidence,
          risksCount: summary.risks.alerts.length,
        });

        setToMemoryCache(marketSummaryCache, cacheKey, summary, SUMMARY_CACHE_MAX_SIZE);
        // 直接返回 summary 对象，messaging 层会自动包装成 { success: true, data: summary }
        return {
          ...summary,
          _metadata: { fromCache: false },
        };
        });
      } catch (error) {
        console.error('[Background] GET_MARKET_SUMMARY error:', error);
        return null;
      }
    },

    // 获取社区情绪分析
    GET_COMMUNITY_SENTIMENT: async (payload) => {
      const { market, forceRefresh = false } = payload || {};
      const settings = await extStorage.get<UserSettings>('settings') || DEFAULT_SETTINGS;
      const cacheKey = `sentiment:${market?.id || 'unknown'}:${settings.language}`;

      try {
        console.log('[Background] GET_COMMUNITY_SENTIMENT:', market?.title);

        if (!market || !market.id) {
          throw new Error('Missing market data');
        }

        if (!forceRefresh) {
          const cached = getFromMemoryCache(communitySentimentCache, cacheKey, COMMUNITY_SENTIMENT_CACHE_TTL);
          if (cached) {
            console.log('[Background][SentimentCache] cache=hit', {
              key: cacheKey,
              marketId: market?.id,
              language: settings.language,
            });
            return {
              ...cached,
              _metadata: { fromCache: true },
            };
          }
          console.log('[Background][SentimentCache] cache=miss', {
            key: cacheKey,
            marketId: market?.id,
            language: settings.language,
          });
        } else {
          console.log('[Background][SentimentCache] cache=skip(forceRefresh)', {
            key: cacheKey,
            marketId: market?.id,
            language: settings.language,
          });
        }

        return await withInFlightDedup(`inflight:${cacheKey}`, async () => {
        // Step 1: Resolve slug to get Series/Event ID for comments
        // Polymarket hierarchy: Series > Event > Market
        // Comments exist at Series level (most) and Event level (few)
        let seriesId: string | null = null;
        let eventId: string | null = null;
        const slug = market.id;

        console.log('[Background] Resolving slug for comments:', slug);

        // If slug is not numeric, resolve via Gamma API
        if (!/^\d+$/.test(slug)) {
          try {
            // First try as Market to get parent Event/Series
            const marketResp = await fetch(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`);
            if (marketResp.ok) {
              const markets = await marketResp.json();
              if (Array.isArray(markets) && markets.length > 0) {
                const marketData = markets[0];
                // Extract parent event and series from market response
                if (marketData.events?.[0]) {
                  const parentEvent = marketData.events[0];
                  eventId = String(parentEvent.id);
                  // Series has the most comments
                  if (parentEvent.series?.[0]?.id) {
                    seriesId = String(parentEvent.series[0].id);
                  }
                  console.log('[Background] Resolved from Market:', {
                    marketId: marketData.id,
                    eventId,
                    seriesId,
                    eventTitle: parentEvent.title?.substring(0, 50)
                  });
                }
              }
            }

            // If not found as Market, try as Event
            if (!eventId) {
              const eventResp = await fetch(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`);
              if (eventResp.ok) {
                const events = await eventResp.json();
                if (Array.isArray(events) && events.length > 0) {
                  const eventData = events[0];
                  eventId = String(eventData.id);
                  if (eventData.series?.[0]?.id) {
                    seriesId = String(eventData.series[0].id);
                  }
                  console.log('[Background] Resolved from Event:', {
                    eventId,
                    seriesId,
                    title: eventData.title?.substring(0, 50)
                  });
                }
              }
            }
          } catch (e) {
            console.error('[Background] Failed to resolve slug:', e);
          }
        } else {
          // If already numeric, treat as event ID
          eventId = slug;
        }

        // If no valid ID found, return empty result
        if (!eventId && !seriesId) {
          console.warn('[Background] Could not resolve slug to any valid ID');
          return {
            overallSentiment: 'neutral',
            confidenceLevel: 'low',
            summary: settings.language === 'zh'
              ? '无法获取此事件的评论数据'
              : 'Unable to fetch comments for this event',
            keyArguments: [],
            optionMentions: [],
            notableComments: [],
            analyzedCount: 0,
            totalComments: 0,
            fetchedAt: new Date().toISOString()
          };
        }

        // Step 2: Fetch comments - prefer Series (more comments), fallback to Event
        let rawComments: any[] = [];
        const entityType = seriesId ? 'Series' : 'Event';
        const entityId = seriesId || eventId;
        if (!entityId) throw new Error('Public comment identifier unavailable');

        const commentsUrl = `https://gamma-api.polymarket.com/comments?parent_entity_type=${entityType}&parent_entity_id=${encodeURIComponent(entityId)}&limit=200`;
        console.log('[Background] Fetching comments:', { entityType, entityId });

        const commentsResponse = await fetch(commentsUrl);

        if (!commentsResponse.ok) {
          console.error('[Background] Gamma API error:', commentsResponse.status);
          throw new Error(`Gamma API error: ${commentsResponse.status}`);
        }

        const commentsData = await commentsResponse.json();
        rawComments = Array.isArray(commentsData) ? commentsData : [];

        console.log('[Background] Fetched', rawComments.length, 'comments from', entityType, entityId);

        if (rawComments.length === 0) {
          console.log('[Background] No comments found, returning empty sentiment result');
          return {
            overallSentiment: 'neutral',
            confidenceLevel: 'low',
            summary: settings.language === 'zh'
              ? '暂无社区评论数据'
              : 'No community comments available',
            keyArguments: [],
            optionMentions: [],
            notableComments: [],
            analyzedCount: 0,
            totalComments: 0,
            fetchedAt: new Date().toISOString()
          };
        }

        // Time-weighted scoring: score = reactionCount × e^(-daysOld/30)
        // This prioritizes recent comments while still considering engagement
        // - Today's comment: score = reactionCount × 1.0
        // - 30 days ago: score = reactionCount × 0.37
        // - 60 days ago: score = reactionCount × 0.14
        const now = Date.now();
        const DAY_MS = 24 * 60 * 60 * 1000;
        const DECAY_HALF_LIFE = 30; // Days for score to decay to ~37%

        const sortedComments = rawComments
          .map((c: any) => {
            const createdAt = c.createdAt ? new Date(c.createdAt).getTime() : now;
            const daysOld = Math.max(0, (now - createdAt) / DAY_MS);
            const reactionCount = c.reactionCount || 0;
            // Time-weighted score using exponential decay
            const timeWeightedScore = reactionCount * Math.exp(-daysOld / DECAY_HALF_LIFE);

            return {
              id: c.id,
              body: c.body || '',
              username: c.profile?.name || c.profile?.pseudonym || 'Anonymous',
              reactionCount,
              createdAt: c.createdAt,
              daysAgo: Math.round(daysOld), // Include for LLM context
              timeWeightedScore
            };
          })
          .sort((a: any, b: any) => b.timeWeightedScore - a.timeWeightedScore)
          .slice(0, 20);

        console.log('[Background] Top time-weighted comments:', sortedComments.slice(0, 3).map((c: any) => ({
          username: c.username,
          reactionCount: c.reactionCount,
          daysAgo: c.daysAgo,
          score: c.timeWeightedScore.toFixed(1),
          body: c.body?.substring(0, 50)
        })));

        // Step 2: Call backend to analyze comments with LLM
        // Get outcomes from market object, or fetch from Gamma API if missing
        let outcomes: string[] = [];

        if (market.outcomes && market.outcomes.length > 0) {
          outcomes = market.outcomes.map((o: any) => o.name || o);
          console.log('[Background] Using outcomes from market object:', outcomes);
        }

        // If outcomes still empty or only Yes/No, try to fetch from Gamma API
        // This handles cases where isMultiOptionMarket flag is missing
        if (outcomes.length <= 2) {
          console.log('[Background] Outcomes missing or binary, fetching from Gamma API...');
          try {
            // Try fetching as Event first
            const eventResp = await fetch(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(market.id)}`);
            if (eventResp.ok) {
              const events = await eventResp.json();
              if (Array.isArray(events) && events.length > 0) {
                const eventData = events[0];
                if (eventData.markets && eventData.markets.length > 0) {
                  const fetchedOutcomes = eventData.markets
                    .map((m: any) => m.groupItemTitle || m.question || m.slug)
                    .filter((name: string) => name && name.length > 0);
                  if (fetchedOutcomes.length > 0) {
                    outcomes = fetchedOutcomes;
                    console.log('[Background] Fetched outcomes from Gamma Event:', outcomes);
                  }
                }
              }
            }

            // If still binary, try fetching as Market to check parent Event
            if (outcomes.length <= 2) {
              const marketResp = await fetch(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(market.id)}`);
              if (marketResp.ok) {
                const markets = await marketResp.json();
                if (Array.isArray(markets) && markets.length > 0 && markets[0].events?.[0]) {
                  const parentEvent = markets[0].events[0];
                  // Fetch full event data to get all markets
                  const fullEventResp = await fetch(`https://gamma-api.polymarket.com/events/${encodeURIComponent(parentEvent.id)}`);
                  if (fullEventResp.ok) {
                    const fullEvent = await fullEventResp.json();
                    if (fullEvent.markets && fullEvent.markets.length > 0) {
                      const fetchedOutcomes = fullEvent.markets
                        .map((m: any) => m.groupItemTitle || m.question || m.slug)
                        .filter((name: string) => name && name.length > 0);
                      if (fetchedOutcomes.length > outcomes.length) {
                        outcomes = fetchedOutcomes;
                        console.log('[Background] Fetched outcomes from Gamma parent Event:', outcomes);
                      }
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error('[Background] Failed to fetch outcomes from Gamma:', e);
          }
        }

        // Fallback to Yes/No if still empty
        if (outcomes.length === 0) {
          outcomes = ['Yes', 'No'];
          console.log('[Background] Using default Yes/No outcomes');
        }

        const isMultiOption = outcomes.length > 2;
        console.log('[Background] Final outcomes for analysis:', {
          count: outcomes.length,
          isMultiOption,
          outcomes: outcomes.slice(0, 5)
        });

        const analyzeResponse = await fetch(`${API_BASE_URL}/api/polymarket/analyze-comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId: market.id,
            eventTitle: market.title,
            outcomes,
            comments: sortedComments,
            language: settings.language
          })
        });

        if (!analyzeResponse.ok) {
          console.error('[Background] Analyze API error:', analyzeResponse.status);
          throw new Error(`Analyze API error: ${analyzeResponse.status}`);
        }

        const analyzeResult = await analyzeResponse.json();
        console.log('[Background] Raw analyze result:', JSON.stringify(analyzeResult, null, 2));

        if (!analyzeResult.success) {
          throw new Error(analyzeResult.error || 'Analysis failed');
        }

        // Add total comments count
        analyzeResult.data.totalComments = rawComments.length;

        console.log('[Background] Community sentiment analysis complete:', {
          sentiment: analyzeResult.data.overallSentiment,
          confidence: analyzeResult.data.confidenceLevel,
          summary: analyzeResult.data.summary?.substring(0, 50),
          analyzedCount: analyzeResult.data.analyzedCount,
          totalComments: analyzeResult.data.totalComments,
          keyArguments: analyzeResult.data.keyArguments?.length || 0
        });

        const sentimentData = {
          ...analyzeResult.data,
          _metadata: { fromCache: false },
        };
        setToMemoryCache(communitySentimentCache, cacheKey, sentimentData, COMMUNITY_SENTIMENT_CACHE_MAX_SIZE);
        // Return data directly, messaging layer will wrap with { success, data }
        return sentimentData;
        });
      } catch (error) {
        console.error('[Background] GET_COMMUNITY_SENTIMENT error:', error);
        throw error; // Let messaging layer handle the error
      }
    },

    // 获取单个市场的实时价格（带缓存）
    FETCH_MARKET_REALTIME_PRICE: async (payload) => {
      const { marketId, source } = payload || {};

      try {
        console.log('[Background] FETCH_MARKET_REALTIME_PRICE:', { marketId, source });

        if (!marketId || !source) {
          return { success: false, error: 'Missing marketId or source' };
        }

        // 先检查缓存
        const cached = getCachedPrice(marketId, source);
        if (cached) {
          return {
            success: true,
            yesPrice: cached.yesPrice,
            noPrice: cached.noPrice,
            outcomes: cached.outcomes,
            isMultiOptionMarket: cached.isMultiOptionMarket,
            fromCache: true,
          };
        }

        // 缓存未命中，调用 API
        if (source === 'kalshi') {
          const data = await fetchKalshiLatestData(marketId);
          if (data) {
            // 写入缓存（包含 outcomes）
            setCachedPrice(marketId, source, data.yesPrice, data.noPrice, data.outcomes, data.isMultiOptionMarket);
            return {
              success: true,
              yesPrice: data.yesPrice,
              noPrice: data.noPrice,
              outcomes: data.outcomes,
              isMultiOptionMarket: data.isMultiOptionMarket,
            };
          }
          return { success: false, error: 'Failed to fetch Kalshi data' };
        } else if (source === 'polymarket') {
          const data = await fetchPolymarketLatestData(marketId);
          if (data) {
            // 写入缓存（包含 outcomes）
            setCachedPrice(marketId, source, data.yesPrice, data.noPrice, data.outcomes, data.isMultiOptionMarket);
            return {
              success: true,
              yesPrice: data.yesPrice,
              noPrice: data.noPrice,
              outcomes: data.outcomes,
              isMultiOptionMarket: data.isMultiOptionMarket,
            };
          }
          return { success: false, error: 'Failed to fetch Polymarket data' };
        }

        return { success: false, error: 'Unknown source' };
      } catch (error) {
        console.error('[Background] FETCH_MARKET_REALTIME_PRICE error:', error);
        return { success: false, error: String(error) };
      }
    }
  });
}

/**
 * 设置定时任务
 */
function setupAlarms() {
  for (const [name, period] of [['checkPriceMonitors', 5], ['resetDailyUsage', 1440]] as const) {
    void chrome.alarms.get(name).then(existing => {
      if (!existing) return chrome.alarms.create(name, { periodInMinutes: period });
    });
  }

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'checkPriceMonitors') {
      await checkPriceMonitors();
    } else if (alarm.name === 'resetDailyUsage') {
      await resetDailyUsage();
    }
  });
}

/**
 * 设置右键菜单
 */
function setupContextMenus() {
  chrome.runtime.onInstalled.addListener(() => {
    void chrome.storage.local.remove('privy_auth');
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({ id: 'analyze-selection', title: 'Search with OddsSeer', contexts: ['selection'] });
      chrome.contextMenus.create({ id: 'analyze-page', title: 'Open OddsSeer', contexts: ['page'] });
    });
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'analyze-selection' && info.selectionText && tab?.id != null) {
      void chrome.tabs.sendMessage(tab.id, {
        type: 'SEARCH_SELECTION', payload: { text: info.selectionText.slice(0, 500) }
      }).catch(() => {
        createNotification('oddsseer-page-unavailable', {
          title: 'OddsSeer', message: 'Refresh this ordinary webpage, then select text and search again.'
        });
      });
    } else if (info.menuItemId === 'analyze-page' && tab?.windowId != null) {
      void chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
    }
  });
}

/**
 * 调用后端 API 分析市场
 */
/**
 * 检查价格监控
 */
async function checkPriceMonitors() {
  const monitors = await extStorage.get<MonitorTask[]>('monitors') || [];
  const settings = await extStorage.get<UserSettings>('settings') || DEFAULT_SETTINGS;

  if (monitors.length === 0 || !settings.enableNotifications) return;

  const updatedMonitors = [...monitors];
  let hasMonitorUpdates = false;

  for (let i = 0; i < monitors.length; i++) {
    const monitor = monitors[i];
    try {
      const marketData = monitor.source === 'kalshi'
        ? await fetchKalshiLatestData(monitor.marketId)
        : await fetchPolymarketLatestData(monitor.marketId);
      if (!marketData || marketData.yesPrice == null) continue;
      const currentPrice = Number(marketData.yesPrice);
      if (!Number.isFinite(currentPrice)) continue;

      const baselinePrice = monitor.lastPrice;
      const now = Date.now();

      // 首次检查只建立基准价格，避免首次就误报
      if (typeof baselinePrice !== 'number') {
        updatedMonitors[i] = {
          ...monitor,
          lastPrice: currentPrice,
          lastChecked: now,
        };
        hasMonitorUpdates = true;
        continue;
      }

      // 检查是否触发阈值
      if (monitor.condition.threshold) {
        const priceChange = Math.abs(currentPrice - baselinePrice) * 100;
        
        if (priceChange >= monitor.condition.threshold && !monitor.triggered) {
          updatedMonitors[i] = {
            ...monitor,
            triggered: true,
            lastPrice: currentPrice,
            lastChecked: now,
          };
          hasMonitorUpdates = true;
          continue;
        }
      }

      updatedMonitors[i] = {
        ...monitor,
        lastPrice: currentPrice,
        lastChecked: now,
      };
      hasMonitorUpdates = true;
    } catch (error) {
      console.error('[Background] Monitor check error:', error);
    }
  }

  if (hasMonitorUpdates) {
    const merged = await mutateMonitors(current => mergeMonitorPrices(current, monitors, updatedMonitors));
    for (const item of merged) {
      const original = monitors.find(old => old.id === item.id);
      const updated = updatedMonitors.find(next => next.id === item.id);
      if (original && !original.triggered && item.triggered && item === updated) {
        createNotification(`price-alert-${item.id}`, {
          title: settings.language === 'zh' ? '价格提醒' : 'Price Alert',
          message: `${item.marketTitle} ${settings.language === 'zh' ? '达到价格变动阈值' : 'reached your price change threshold'}`
        });
      }
    }
  }
}

/**
 * 重置每日使用计数
 */
async function resetDailyUsage() {
  const settings = await extStorage.get<UserSettings>('settings') || DEFAULT_SETTINGS;
  await extStorage.set('settings', { ...settings, dailyAnalysisCount: 0 });
  await extStorage.set('lastResetDate', new Date().toDateString());
  console.log('[Background] Daily usage reset');
}

/**
 * 获取热门市场（从 Polymarket Gamma API）
 */
async function fetchTrendingMarkets(limit: number = 20, category?: string): Promise<MarketEvent[]> {
  const cacheKey = `trending:${category || 'all'}:${limit}`;
  const cached = getFromMemoryCache(trendingMarketsCache, cacheKey, TRENDING_CACHE_TTL);
  if (cached) {
    return cached;
  }

  try {
    console.log('[Background] Fetching trending markets...');
    
    // 使用 Polymarket Gamma API
    let url = `https://gamma-api.polymarket.com/events?closed=false&limit=${limit}&active=true`;
    
    if (category && category !== 'all') {
      // 映射分类
      const categoryMap: Record<string, string> = {
        'politics': 'Politics',
        'crypto': 'Crypto',
        'sports': 'Sports',
        'pop_culture': 'Pop Culture',
        'business': 'Business'
      };
      const mappedCategory = categoryMap[category] || category;
      url += `&tag=${encodeURIComponent(mappedCategory)}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('[Background] Gamma API error:', response.status);
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const events = await response.json();
    console.log('[Background] Fetched events:', events.length);

    // 转换为 MarketEvent 格式
    const markets: MarketEvent[] = events.map((event: any) => {
      // 获取主要市场（第一个）
      const market = event.markets?.[0];
      const { yesPrice, noPrice } = gammaPrices(market?.outcomePrices);
      
      return {
        id: event.slug || String(event.id),
        conditionId: market?.conditionId || event.id || event.slug,
        title: event.title,
        description: event.description || '',
        category: event.tags?.[0] || 'Other',
        yesPrice: yesPrice,
        noPrice,
        volume: parseFloat(event.volume || '0'),
        liquidity: parseFloat(event.liquidity || '0'),
        endDate: event.endDate,
        url: `https://polymarket.com/event/${event.slug}`,
        source: 'polymarket' as const
      };
    });

    setToMemoryCache(trendingMarketsCache, cacheKey, markets, TRENDING_CACHE_MAX_SIZE);
    return markets;
  } catch (error) {
    console.error('[Background] Failed to fetch trending markets:', error);

    // 不返回假数据，避免误导用户
    return [];
  }
}

/**
 * 搜索市场 - 优先使用后端语义搜索 API，降级到外部 API
 */
async function searchMarketsWithMetadata(
  query: string,
  limit: number = 20
): Promise<{ markets: MarketEvent[]; metadata: { fromCache: boolean; source: string; stage?: string } }> {
  // 基本文本清理
  const cleanQuery = query.trim().substring(0, 100);
  if (!cleanQuery) {
    return { markets: [], metadata: { fromCache: false, source: 'empty' } };
  }

  const cacheKey = `search:${normalizeTextForCache(cleanQuery)}:${limit}`;
  const cached = getFromMemoryCache(searchResultsCache, cacheKey, SEARCH_CACHE_TTL);
  if (cached) {
    return {
      markets: cached.markets,
      metadata: {
        ...(cached.metadata || {}),
        fromCache: true,
        source: cached.metadata?.source || 'extension_cache',
      },
    };
  }
  
  console.log('[Background] Searching markets:', cleanQuery);
  
  // 首先尝试使用后端语义搜索 API（向量 + BM25 混合检索）
  try {
    const semanticResult = await withInFlightDedup(`search:${cacheKey}`, () => searchWithSemanticAPI(cleanQuery, limit));
    if (semanticResult.markets.length > 0) {
      console.log(`[Background] Semantic search returned ${semanticResult.markets.length} results`);
      const result = {
        markets: semanticResult.markets,
        metadata: {
          fromCache: false,
          source: 'backend_quick',
          stage: semanticResult.metadata?.stage,
        },
      };
      setToMemoryCache(searchResultsCache, cacheKey, result, SEARCH_CACHE_MAX_SIZE);
      return result;
    }
    console.log('[Background] Semantic search returned no results, falling back to external APIs');
  } catch (error) {
    console.warn('[Background] Semantic search failed, falling back to external APIs:', error);
  }
  
  // 降级：并行搜索 Polymarket 和 Kalshi 外部 API
  const [polymarketResults, kalshiResults] = await Promise.all([
    searchPolymarket(cleanQuery, limit),
    searchKalshi(cleanQuery, Math.ceil(limit / 2))
  ]);
  
  // 合并结果，Polymarket 优先
  const combined = [...polymarketResults, ...kalshiResults];
  
  console.log(`[Background] Fallback results: Polymarket=${polymarketResults.length}, Kalshi=${kalshiResults.length}`);
  const result = {
    markets: combined.slice(0, limit),
    metadata: {
      fromCache: false,
      source: 'external_fallback',
    },
  };
  setToMemoryCache(searchResultsCache, cacheKey, result, SEARCH_CACHE_MAX_SIZE);
  return result;
}

async function searchMarkets(query: string, limit: number = 20): Promise<MarketEvent[]> {
  const result = await searchMarketsWithMetadata(query, limit);
  return result.markets;
}

/**
 * Convert backend search results to MarketEvent format.
 */
function mapQuickSearchResultsToMarketEvents(results: any[]): MarketEvent[] {
  return (results || []).map((result: any) => {
    const resultUrl = result.url || '';
    const source = (result.source?.toLowerCase() || 'polymarket') as 'polymarket' | 'kalshi';

    // 提取 slug 用于实时价格查询
    let slug = result.externalId || result.id;
    if (source === 'polymarket' && resultUrl.includes('polymarket.com/event/')) {
      const match = resultUrl.match(/polymarket\.com\/event\/([^/?]+)/);
      if (match) slug = match[1];
    } else if (source === 'kalshi' && resultUrl.includes('kalshi.com/events/')) {
      const match = resultUrl.match(/kalshi\.com\/events\/([^/?]+)/);
      if (match) slug = match[1];
    }

    // 处理多选项市场的 outcomes（若后端有返回）
    const outcomes = result.outcomes?.map((o: any) => ({
      id: o.id || o.outcome_id,
      name: o.name || o.title,
      yesPrice: probability(o.yesPrice ?? o.yes_price),
      noPrice: probability(o.noPrice ?? o.no_price),
      marketTicker: o.marketTicker || o.ticker
    }));

    const isMultiOptionMarket = outcomes && outcomes.length > 2 ||
      (outcomes && outcomes.length > 0 &&
        !outcomes.every((o: any) => ['Yes', 'No', 'yes', 'no'].includes(o.name)));

    return {
      id: slug,
      conditionId: result.externalId || result.id,
      title: result.title,
      description: result.description || '',
      category: result.category || 'Other',
      yesPrice: result.yesPrice != null ? result.yesPrice : null,
      noPrice: result.noPrice != null ? result.noPrice : null,
      isSnapshotPrice: result.yesPrice != null,
      volume: result.volume || 0,
      liquidity: result.liquidity || 0,
      endDate: result.endDate,
      url: resultUrl || `https://polymarket.com/event/${result.externalId}`,
      source,
      outcomes,
      isMultiOptionMarket
    };
  });
}

/**
 * 页面扫描 - 使用快速搜索（0 LLM token），搜不到时自动 fallback 到 LLM 语义搜索
 * 
 * 优化策略：
 * - 先用 /api/search/quick（Vector + BM25，无 LLM），覆盖 ~90% 场景
 * - quick 内部：搜不到结果时自动 fallback 到完整语义搜索（含 LLM）
 * - 本地 DB 包含 Polymarket + Kalshi 全量事件，Vector 搜索支持跨语言匹配
 */
async function scanPageContent(content: string, url: string): Promise<{ markets: MarketEvent[], detectedEvents: any[] }> {
  console.log('[Background] Scanning page content, length:', content.length);
  
  try {
    // 使用快速搜索 API（先 Vector+BM25，无结果时自动 fallback 到 LLM）
    const response = await fetch(`${API_BASE_URL}/api/search/quick`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: content,
        limit: 10,
      })
    });
    
    if (!response.ok) {
      console.error('[Background] Quick search API error:', response.status);
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[Background] Page scan response:', {
      success: data.success,
      resultsCount: data.results?.length,
      stage: data.metadata?.stage,  // 'quick' = 0 token, 'semantic' = fallback 到 LLM
    });

    // Debug: 打印原始 API 响应的第一个结果
    if (data.results?.length > 0) {
      console.log('[Background] PAGE_SCAN first result raw:', JSON.stringify(data.results[0], null, 2));
    }

    if (!data.success || !data.results) {
      return { markets: [], detectedEvents: [] };
    }

    // 转换为 MarketEvent 格式
    const markets: MarketEvent[] = mapQuickSearchResultsToMarketEvents(data.results);
    
    return {
      markets,
      detectedEvents: data.metadata?.detectedEvents || []
    };
  } catch (error) {
    console.error('[Background] Page scan error:', error);
    
    // 降级到直接 API 搜索（截取前 200 字符作为查询）
    const shortQuery = content.substring(0, 200);
    const fallbackResults = await searchMarkets(shortQuery, 10);
    
    return {
      markets: fallbackResults,
      detectedEvents: []
    };
  }
}

/**
 * 使用后端语义搜索 API（向量检索 + BM25 + RRF 融合）
 */
async function searchWithSemanticAPI(
  query: string,
  limit: number = 10
): Promise<{ markets: MarketEvent[]; metadata: any }> {
  const response = await fetch(`${API_BASE_URL}/api/search/quick`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: query,
      limit: limit
    })
  });

  if (!response.ok) {
    throw new Error(`Semantic search API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.success || !data.results) {
    return { markets: [], metadata: data.metadata || null };
  }

  // Debug: 打印原始 API 响应的第一个结果
  if (data.results.length > 0) {
    console.log('[Background] searchWithSemanticAPI first result raw:', {
      id: data.results[0].id,
      title: data.results[0].title?.substring(0, 50),
      hasOutcomes: !!data.results[0].outcomes,
      outcomesCount: data.results[0].outcomes?.length
    });
  }

  // 转换为 MarketEvent 格式
  const markets = data.results.map((result: any) => {
    const resultUrl = result.url || '';
    const source = (result.source || 'polymarket').toLowerCase() as 'polymarket' | 'kalshi';

    // 提取 slug 用于实时价格查询
    let slug = result.externalId || result.id;
    if (source === 'polymarket' && resultUrl.includes('polymarket.com/event/')) {
      const match = resultUrl.match(/polymarket\.com\/event\/([^/?]+)/);
      if (match) slug = match[1];
    } else if (source === 'kalshi' && resultUrl.includes('kalshi.com/events/')) {
      const match = resultUrl.match(/kalshi\.com\/events\/([^/?]+)/);
      if (match) slug = match[1];
    }

    // 处理多选项市场的 outcomes
    const outcomes = result.outcomes?.map((o: any) => ({
      id: o.id || o.outcome_id,
      name: o.name || o.title,
      yesPrice: probability(o.yesPrice ?? o.yes_price),
      noPrice: probability(o.noPrice ?? o.no_price),
      marketTicker: o.marketTicker || o.ticker
    }));

    // 判断是否为多选项市场
    const isMultiOptionMarket = outcomes && outcomes.length > 2 ||
      (outcomes && outcomes.length > 0 &&
        !outcomes.every((o: any) => ['Yes', 'No', 'yes', 'no'].includes(o.name)));

    return {
      id: slug,  // 使用 slug 作为 id，便于实时价格查询
      conditionId: result.externalId || result.id,
      title: result.title,
      description: result.description || '',
      category: result.category || 'Other',
      // 后端返回的价格作为快照，标记 isSnapshotPrice
      yesPrice: result.yesPrice != null ? result.yesPrice : null,
      noPrice: result.noPrice != null ? result.noPrice : null,
      isSnapshotPrice: result.yesPrice != null,  // 有价格就标记为快照
      volume: result.volume || 0,
      liquidity: result.liquidity || 0,
      endDate: result.endDate || '',
      url: resultUrl,
      source,
      outcomes,
      isMultiOptionMarket
    };
  });

  return { markets, metadata: data.metadata || null };
}

/**
 * 常见搜索词到 Polymarket 标签的映射
 */
const SEARCH_TO_TAG_MAP: Record<string, string[]> = {
  'middle east': ['middle-east', 'iran', 'israel', 'gaza'],
  'mideast': ['middle-east', 'iran', 'israel', 'gaza'],
  'israel': ['israel', 'middle-east'],
  'iran': ['iran', 'middle-east'],
  'gaza': ['gaza', 'israel', 'middle-east'],
  'trump': ['trump', 'donald-trump'],
  'biden': ['biden', 'joe-biden'],
  'crypto': ['crypto', 'bitcoin', 'ethereum'],
  'bitcoin': ['bitcoin', 'crypto'],
  'ai': ['ai', 'artificial-intelligence'],
  'china': ['china', 'geopolitics'],
  'russia': ['russia', 'ukraine', 'geopolitics'],
  'ukraine': ['ukraine', 'russia', 'geopolitics'],
};

/**
 * Polymarket 搜索 - 结合 public-search 和 tag 搜索
 * 参考文档: https://docs.polymarket.com/api-reference/search/search-markets-events-and-profiles
 */
async function searchPolymarket(query: string, limit: number = 10): Promise<MarketEvent[]> {
  try {
    const queryLower = query.toLowerCase().trim();
    const fetchLimit = Math.min(limit * 3, 50);
    
    // 并行执行：优化的 public-search + tag 搜索
    const searchPromises: Promise<any[]>[] = [];
    
    // 1. 优化的 public-search（使用官方文档推荐的参数）
    const searchParams = new URLSearchParams({
      q: query,
      limit_per_type: String(fetchLimit),
      keep_closed_markets: '0',  // 不返回已关闭的市场
      search_tags: 'true',       // 同时搜索标签
    });
    const publicSearchUrl = `https://gamma-api.polymarket.com/public-search?${searchParams}`;
    console.log('[Background] Polymarket public-search:', publicSearchUrl);
    
    searchPromises.push(
      fetch(publicSearchUrl, { headers: { 'Accept': 'application/json' } })
        .then(r => r.ok ? r.json() : { events: [] })
        .then(d => d.events || [])
        .catch(() => [])
    );
    
    // 2. 如果有匹配的标签，也执行 tag 搜索（使用官方推荐的 active=true&closed=false）
    const matchedTags = SEARCH_TO_TAG_MAP[queryLower] || [];
    for (const tag of matchedTags.slice(0, 2)) { // 最多搜索 2 个标签
      const tagUrl = `https://gamma-api.polymarket.com/events?tag_slug=${tag}&active=true&closed=false&limit=${fetchLimit}`;
      console.log('[Background] Polymarket tag-search:', tagUrl);
      searchPromises.push(
        fetch(tagUrl, { headers: { 'Accept': 'application/json' } })
          .then(r => r.ok ? r.json() : [])
          .catch(() => [])
      );
    }
    
    // 等待所有搜索完成
    const results = await Promise.all(searchPromises);
    
    // 合并结果并去重（按交易量排序）
    const allEvents: any[] = [];
    const seenIds = new Set<string>();
    
    for (const events of results) {
      for (const event of (Array.isArray(events) ? events : [])) {
        const id = event.id || event.slug;
        // 检查是否活跃且未关闭
        if (!seenIds.has(id) && event.active !== false && event.closed !== true) {
          seenIds.add(id);
          allEvents.push(event);
        }
      }
    }
    
    // 按交易量排序（高交易量优先）
    allEvents.sort((a, b) => (parseFloat(b.volume) || 0) - (parseFloat(a.volume) || 0));
    
    console.log('[Background] Polymarket combined: %d unique active events', allEvents.length);
    
    // 转换格式
    return allEvents.slice(0, limit).map((event: any) => {
      const market = event.markets?.[0];
      const { yesPrice, noPrice } = gammaPrices(market?.outcomePrices);

      return {
        id: event.slug || String(event.id),
        conditionId: market?.conditionId || event.id || event.slug,
        title: event.title,
        description: event.description || '',
        category: event.tags?.[0] || 'Other',
        yesPrice: yesPrice,
        noPrice,
        volume: parseFloat(event.volume || '0'),
        liquidity: parseFloat(event.liquidity || '0'),
        endDate: event.endDate,
        url: `https://polymarket.com/event/${event.slug}`,
        source: 'polymarket' as const
      };
    }).slice(0, limit);
  } catch (error) {
    console.error('[Background] Polymarket search error:', error);
    return [];
  }
}

/**
 * Kalshi 搜索 - 拉取事件后本地过滤
 */
async function searchKalshi(query: string, limit: number = 5): Promise<MarketEvent[]> {
  try {
    // Kalshi 没有搜索 API，需要拉取全部事件后本地过滤
    const url = 'https://api.elections.kalshi.com/trade-api/v2/events?status=open&limit=100';
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.error('[Background] Kalshi API error:', response.status);
      return [];
    }

    const data = await response.json();
    const events = data.events || [];
    
    // 本地关键词过滤 - 使用单词边界匹配，避免 "east" 匹配 "least"
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    
    const filtered = events.filter((event: any) => {
      const title = (event.title || '').toLowerCase();
      const subTitle = (event.sub_title || '').toLowerCase();
      const fullText = title + ' ' + subTitle;
      
      // 使用单词边界正则匹配
      return keywords.some(kw => fullText.includes(kw));
    });
    
    console.log('[Background] Kalshi search:', query, '-> keywords:', keywords, '-> matches:', filtered.length);
    
    // 如果没有匹配，返回空数组（不返回无关结果）
    if (filtered.length === 0) {
      return [];
    }
    
    // 转换格式 - yesPrice 设为 null，表示需要异步获取实时价格
    return filtered.slice(0, limit).map((event: any) => ({
      id: event.event_ticker,
      conditionId: event.event_ticker,
      title: event.title,
      description: event.sub_title || '',
      category: event.category || 'Other',
      yesPrice: null,  // null 表示需要异步获取实时价格
      noPrice: null,
      volume: 0,
      liquidity: 0,
      endDate: '',
      url: `https://kalshi.com/events/${event.event_ticker}`,
      source: 'kalshi' as const
    }));
  } catch (error) {
    console.error('[Background] Kalshi search error:', error);
    return [];
  }
}

// ============================================
// 实时价格获取（用于跨市场比价）
// ============================================

/**
 * 获取 Polymarket 事件的最新实时数据（包含所有 outcomes）
 * 
 * @param eventSlug - 事件的 slug（从 URL 中提取）
 * @returns 包含最新价格和所有 outcomes 的市场数据
 */
async function fetchPolymarketLatestData(eventSlug: string): Promise<any | null> {
  console.log('[Polymarket] 开始获取最新数据, 输入:', eventSlug);
  
  try {
    // slug 可能是完整 URL，需要提取
    let slug = eventSlug;
    if (eventSlug.includes('polymarket.com/event/')) {
      slug = eventSlug.split('polymarket.com/event/')[1]?.split(/[/?#]/)[0] || eventSlug;
      console.log('[Polymarket] 从 URL 提取 slug:', slug);
    }
    
    // 使用 Gamma API 获取事件详情
    const apiUrl = `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`;
    console.log('[Polymarket] 请求 API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' }
    });
    
    console.log('[Polymarket] API 响应状态:', response.status);
    
    if (!response.ok) {
      console.warn(`[Polymarket] API 请求失败: ${response.status} for slug: ${slug}`);
      return null;
    }
    
    // API 返回数组，取第一个匹配的事件
    const events = await response.json();
    console.log('[Polymarket] API 返回事件数量:', Array.isArray(events) ? events.length : 'not array');
    
    if (!Array.isArray(events) || events.length === 0) {
      console.warn(`[Polymarket] 未找到事件 for slug: ${slug}`);
      return null;
    }
    
    const event = events[0];
    console.log('[Polymarket] 找到事件:', {
      title: event.title?.substring(0, 50),
      slug: event.slug,
      marketsCount: event.markets?.length || 0
    });
    
    // 提取所有 markets（选项）的最新价格
    const markets = event.markets || [];
    const outcomes: MarketOutcome[] = markets.map((m: any, index: number) => ({
      id: m.conditionId || m.id || String(index),
      name: m.groupItemTitle || m.question || `Option ${index + 1}`,
      ...gammaPrices(m.outcomePrices),
      marketTicker: m.conditionId,
    }));

    console.log('[Polymarket] 提取的 outcomes:', outcomes.map(o => ({
      name: o.name?.substring(0, 30),
      yesPrice: o.yesPrice
    })));
    
    // 判断是否为多选项市场
    const isMultiOption = outcomes.length > 1 && 
      !outcomes.some(o => o.name === 'Yes' || o.name === 'No' || o.name === 'YES' || o.name === 'NO');
    
    console.log('[Polymarket] 是否多选项市场:', isMultiOption);
    
    // 获取主要价格（第一个选项或 Yes 价格最高的选项）
    const primaryOutcome = outcomes.length > 0 ? outcomes[0] : null;
    
    const result = {
      id: event.slug || String(event.id),
      slug: event.slug,
      title: event.title,
      description: event.description || '',
      category: event.tags?.[0] || 'Other',
      yesPrice: primaryOutcome?.yesPrice ?? null,
      noPrice: primaryOutcome?.noPrice ?? null,
      volume: parseFloat(event.volume || '0'),
      liquidity: parseFloat(event.liquidity || '0'),
      endDate: event.endDate,
      url: `https://polymarket.com/event/${event.slug}`,
      source: 'polymarket' as const,
      outcomes,
      isMultiOptionMarket: isMultiOption,
    };
    
    console.log('[Polymarket] ✅ 成功获取数据:', {
      title: result.title?.substring(0, 40),
      yesPrice: result.yesPrice,
      outcomesCount: outcomes.length,
      isMultiOption
    });
    
    return result;
  } catch (error) {
    console.error('[Polymarket] ❌ 获取数据出错:', error);
    return null;
  }
}

/**
 * 获取 Kalshi 事件的最新实时数据（包含所有 outcomes）
 * 
 * 直接通过 event_ticker 查询单个事件（根据 Kalshi API 文档）
 * API: GET /events/{event_ticker}?with_nested_markets=true
 * 
 * @param eventTicker - 事件的 ticker
 * @returns 包含最新价格和所有 outcomes 的市场数据，或 null 如果获取失败
 */
async function fetchKalshiLatestData(eventTicker: string): Promise<any | null> {
  console.log('[Kalshi] 开始获取最新数据, ticker:', eventTicker);
  
  try {
    // 直接通过 ticker 查询单个事件（包含嵌套的市场数据）
    const apiUrl = `https://api.elections.kalshi.com/trade-api/v2/events/${encodeURIComponent(eventTicker)}?with_nested_markets=true`;
    console.log('[Kalshi] 请求单个事件 API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' }
    });
    
    console.log('[Kalshi] API 响应状态:', response.status);
    
    if (!response.ok) {
      // 如果是 404，说明事件不存在或已关闭
      if (response.status === 404) {
        console.warn('[Kalshi] 事件不存在或已关闭:', eventTicker);
      } else {
        console.warn('[Kalshi] API 请求失败:', response.status);
      }
      return null;
    }
    
    const data = await response.json();
    const event = data.event;
    
    if (!event) {
      console.warn('[Kalshi] API 返回数据中没有 event 字段');
      return null;
    }
    
    console.log('[Kalshi] 找到事件:', {
      title: event.title?.substring(0, 50),
      ticker: event.event_ticker,
      marketsCount: event.markets?.length || 0
    });
    
    // 从嵌套的 markets 中提取 outcomes
    // with_nested_markets=true 时，markets 在 event.markets 中
    const markets = event.markets || data.markets || [];
    console.log('[Kalshi] 获取到市场数量:', markets.length);
    
    // 打印前 3 个原始 market 数据，用于调试
    if (markets.length > 0) {
      console.log('[Kalshi] 原始市场数据示例 (前3个):', markets.slice(0, 3).map((m: any) => ({
        ticker: m.ticker,
        title: m.title,
        subtitle: m.subtitle,
        yes_sub_title: m.yes_sub_title,
        yes_bid: m.yes_bid,
        last_price: m.last_price,
        status: m.status
      })));
    }
    
    const outcomes: MarketOutcome[] = markets.map((m: any, index: number) => {
      const { yesPrice, noPrice } = kalshiPrices(m);

      // 优先使用 yes_sub_title（如果存在），其次是 subtitle，最后是 title
      const name = m.yes_sub_title || m.subtitle || m.title || `Option ${index + 1}`;
      
      return {
        id: m.ticker || String(index),
        name,
        yesPrice,
        noPrice,
        marketTicker: m.ticker,
      };
    });
    
    console.log('[Kalshi] 提取的 outcomes:', outcomes.map(o => ({
      name: o.name?.substring(0, 30),
      yesPrice: o.yesPrice
    })));
    
    // 判断是否为多选项市场
    const isMultiOption = outcomes.length > 1;
    
    // 获取主要价格（第一个选项）
    const primaryOutcome = outcomes.length > 0 ? outcomes[0] : null;
    
    const result = {
      id: event.event_ticker,
      title: event.title,
      description: event.sub_title || '',
      category: event.category || 'Other',
      yesPrice: primaryOutcome?.yesPrice ?? null,
      noPrice: primaryOutcome?.noPrice ?? null,
      volume: 0,
      liquidity: 0,
      endDate: event.close_time || event.strike_date || '',
      url: `https://kalshi.com/events/${event.event_ticker}`,
      source: 'kalshi' as const,
      outcomes,
      isMultiOptionMarket: isMultiOption,
    };
    
    console.log('[Kalshi] ✅ 成功获取数据:', {
      title: result.title?.substring(0, 40),
      yesPrice: result.yesPrice,
      outcomesCount: outcomes.length,
      isMultiOption
    });
    
    return result;
  } catch (error) {
    console.error('[Kalshi] ❌ 获取数据出错:', error);
    return null;
  }
}

/**
 * 获取市场的最新实时数据（自动判断来源）
 * 
 * @param source - 市场来源 ('polymarket' | 'kalshi')
 * @param eventId - 事件 ID 或 slug
 * @returns 包含最新价格和所有 outcomes 的市场数据
 */
async function fetchLatestMarketData(source: string, eventId: string): Promise<any | null> {
  console.log('[FetchLatest] 开始获取最新数据, source:', source, ', eventId:', eventId);
  
  if (source === 'polymarket') {
    const result = await fetchPolymarketLatestData(eventId);
    console.log('[FetchLatest] Polymarket 结果:', result ? '成功' : '失败');
    return result;
  } else if (source === 'kalshi') {
    const result = await fetchKalshiLatestData(eventId);
    console.log('[FetchLatest] Kalshi 结果:', result ? '成功' : '失败');
    return result;
  }
  
  console.warn('[FetchLatest] 未知的 source:', source);
  return null;
}

/**
 * 从 URL 中提取事件标识符
 */
function extractEventIdentifier(market: any): string {
  console.log('[ExtractId] 输入市场:', {
    title: market.title?.substring(0, 40),
    source: market.source,
    url: market.url,
    id: market.id,
    slug: market.slug
  });
  
  // 优先从 URL 中提取 slug
  if (market.url) {
    // Polymarket URL: https://polymarket.com/event/{slug}
    if (market.url.includes('polymarket.com/event/')) {
      const slug = market.url.split('polymarket.com/event/')[1]?.split(/[/?#]/)[0];
      if (slug) {
        console.log('[ExtractId] 从 Polymarket URL 提取 slug:', slug);
        return slug;
      }
    }
    // Kalshi URL: https://kalshi.com/events/{ticker}
    if (market.url.includes('kalshi.com/events/')) {
      const ticker = market.url.split('kalshi.com/events/')[1]?.split(/[/?#]/)[0];
      if (ticker) {
        console.log('[ExtractId] 从 Kalshi URL 提取 ticker:', ticker);
        return ticker;
      }
    }
  }
  
  // 后备：使用其他字段
  const fallback = market.slug || market.id || market.conditionId || '';
  console.log('[ExtractId] 使用后备字段:', fallback);
  return fallback;
}

/**
 * 批量获取多个市场的最新数据（并行请求）
 * 
 * @param markets - 市场列表（需要包含 source 和 url）
 * @returns 带有最新价格和 outcomes 的市场列表
 */
async function enrichMarketsWithLatestData(markets: any[]): Promise<any[]> {
  console.log('[Enrich] ========================================');
  console.log('[Enrich] 开始批量获取最新数据, 市场数量:', markets.length);
  console.log('[Enrich] 市场列表:', markets.map(m => ({
    title: m.title?.substring(0, 30),
    source: m.source,
    url: m.url?.substring(0, 50)
  })));
  
  const enrichPromises = markets.map(async (market, index) => {
    console.log(`[Enrich] [${index + 1}/${markets.length}] 处理市场:`, market.title?.substring(0, 40));
    
    const eventId = extractEventIdentifier(market);
    
    if (!eventId) {
      console.warn(`[Enrich] [${index + 1}] ⚠️ 未找到事件标识符, 跳过`);
      return market;
    }
    
    console.log(`[Enrich] [${index + 1}] 提取的事件 ID:`, eventId);
    
    const latestData = await fetchLatestMarketData(market.source, eventId);
    
    if (latestData) {
      console.log(`[Enrich] [${index + 1}] ✅ 获取最新数据成功:`, {
        yesPrice: latestData.yesPrice,
        outcomesCount: latestData.outcomes?.length || 0
      });
      
      // 合并搜索结果的元数据和最新价格数据
      return {
        ...market,
        ...latestData,
        // 保留原始的相似度等搜索元数据
        similarity: market.similarity,
        isExactMatch: market.isExactMatch,
        matchedKeywords: market.matchedKeywords,
      };
    }
    
    console.log(`[Enrich] [${index + 1}] ⚠️ 获取最新数据失败, 使用原始数据`);
    // 如果获取失败，返回原始数据
    return market;
  });
  
  const results = await Promise.all(enrichPromises);
  
  console.log('[Enrich] 批量获取完成, 成功数量:', results.filter(r => r.outcomes?.length > 0).length);
  console.log('[Enrich] ========================================');
  
  return results;
}


