import { boundedFetch as fetch } from '../../lib/upstream.js';
import { parseStringPromise } from 'xml2js';


// ============================================
// Google News RSS
// ============================================

/**
 * 从 Google News RSS 获取新闻
 * @param {string} query - 搜索关键词
 * @param {object} options - 配置选项
 * @returns {Promise<object>} 新闻数据
 */
export async function fetchGoogleNewsData(query, options = {}) {
  const {
    language = 'en',
    country = 'US',
    maxResults = 15
  } = options;

  void 0;

  try {
    // 构建 RSS URL
    const encodedQuery = encodeURIComponent(query);
    const hl = language === 'zh' ? 'zh-CN' : 'en-US';
    const gl = country;
    const ceid = `${gl}:${language}`;
    
    const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

    void 0;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      throw new Error(`Google News RSS error: ${response.status}`);
    }

    const xmlText = await response.text();
    
    // 解析 XML
    const result = await parseStringPromise(xmlText, {
      explicitArray: false,
      ignoreAttrs: false
    });

    const items = result?.rss?.channel?.item;
    if (!items) {
      void 0;
      return { articles: [], articlesCount: 0 };
    }

    // 确保 items 是数组
    const articlesArray = Array.isArray(items) ? items : [items];

    // 处理文章
    const articles = articlesArray.slice(0, maxResults).map(item => {
      // 解析来源（Google News 格式: "Title - Source"）
      const titleParts = item.title?.split(' - ') || [];
      const source = titleParts.length > 1 ? titleParts.pop() : 'Unknown';
      const title = titleParts.join(' - ');

      return {
        title: title || item.title,
        link: item.link,
        pubDate: item.pubDate,
        pubDateFormatted: formatPubDate(item.pubDate),
        source: source,
        description: cleanHtml(item.description || '')
      };
    });

    // 统计来源
    const sourceCount = {};
    articles.forEach(a => {
      sourceCount[a.source] = (sourceCount[a.source] || 0) + 1;
    });

    const processedData = {
      articles,
      articlesCount: articles.length,
      sources: Object.entries(sourceCount)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
      latestDate: articles.length > 0 ? articles[0].pubDate : null,
      query
    };

    void 0;

    return processedData;

  } catch (error) {
    void 0;
    return null;
  }
}


/**
 * 格式化发布日期
 */
function formatPubDate(pubDate) {
  if (!pubDate) return '';
  
  try {
    const date = new Date(pubDate);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return '刚刚';
    if (diffHours < 24) return `${diffHours} 小时前`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} 天前`;
    
    return date.toLocaleDateString('zh-CN');
  } catch {
    return pubDate;
  }
}


/**
 * 清理 HTML 标签
 */
function cleanHtml(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}


// ============================================
// Dome API (完全免费，无需 API Key)
// 提供 Polymarket 市场数据、价格、K线、交易历史
// ============================================

const DOME_API_BASE = 'https://api.domeapi.io/v1';


/**
 * 从 Dome API 获取 K 线数据（价格走势）
 * @param {string} conditionId - Polymarket condition ID
 * @param {object} options - 配置选项
 * @returns {Promise<object>} K线数据
 */
export async function fetchDomeCandlesticks(conditionId, options = {}) {
  const {
    interval = '1h',  // 1m, 5m, 15m, 30m, 1h, 4h, 1d
    hours = 72        // 获取多少小时的数据
  } = options;

  if (!conditionId) {
    void 0;
    return null;
  }

  void 0;

  try {
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (hours * 3600);

    const url = `${DOME_API_BASE}/polymarket/candlesticks/${conditionId}?` + new URLSearchParams({
      interval,
      start_time: startTime.toString(),
      end_time: endTime.toString(),
      limit: '100'
    });

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OddsSeer/0.1'
      }
    });

    if (!response.ok) {
      throw new Error(`Dome API error: ${response.status}`);
    }

    // 验证响应类型，防止 HTML 错误页面导致 JSON 解析失败
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      void 0;
      throw new Error(`Dome API returned non-JSON response (${response.status})`);
    }

    const data = await response.json();

    // 处理 K 线数据 - Dome 返回的是嵌套数组结构
    if (!data.candlesticks || data.candlesticks.length === 0) {
      void 0;
      return null;
    }

    // 提取所有 outcome 的 K 线数据
    const processedData = {
      outcomes: [], // 所有 outcome 的 K 线数据
      yes: null,    // 保持向后兼容
      no: null,
      interval,
      hours,
      priceAnalysis: null,
      fetchedAt: new Date().toISOString()
    };

    data.candlesticks.forEach((tokenData, index) => {
      if (!tokenData || !Array.isArray(tokenData[0])) return;

      const candles = tokenData[0].map(c => ({
        timestamp: c.end_period_ts,
        time: new Date(c.end_period_ts * 1000).toISOString(),
        open: parseFloat(c.price?.open_dollars || 0),
        high: parseFloat(c.price?.high_dollars || 0),
        low: parseFloat(c.price?.low_dollars || 0),
        close: parseFloat(c.price?.close_dollars || 0),
        volume: c.volume || 0
      }));

      const tokenId = tokenData[1]?.token_id;
      const outcome = tokenData[1]?.outcome || `Outcome ${index + 1}`;

      // 获取当前价格（最后一个 K 线的收盘价）
      const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

      // 添加到 outcomes 数组
      processedData.outcomes.push({
        index,
        name: outcome,
        tokenId,
        candles,
        currentPrice
      });

      // 保持向后兼容：根据 outcome 名称或索引设置 yes/no
      if (outcome === 'Yes' || (index === 0 && !processedData.yes)) {
        processedData.yes = { candles, tokenId, name: outcome };
      } else if (outcome === 'No' || (index === 1 && !processedData.no)) {
        processedData.no = { candles, tokenId, name: outcome };
      }
    });

    // 按当前价格降序排序 outcomes（价格高的在前）
    processedData.outcomes.sort((a, b) => b.currentPrice - a.currentPrice);

    // 计算价格分析（使用第一个 outcome）
    if (processedData.outcomes.length > 0 && processedData.outcomes[0].candles.length > 0) {
      processedData.priceAnalysis = analyzePriceTrend(processedData.outcomes[0].candles);
    }

    void 0;

    return processedData;

  } catch (error) {
    void 0;
    return null;
  }
}


/**
 * 分析价格走势
 * @param {Array} candles - K线数据
 * @returns {object} 价格分析结果
 */
function analyzePriceTrend(candles) {
  if (!candles || candles.length < 2) {
    return null;
  }

  const first = candles[0];
  const last = candles[candles.length - 1];

  // 价格变化
  const priceChange = last.close - first.open;
  const priceChangePercent = first.open > 0 ? (priceChange / first.open) * 100 : 0;

  // 最高和最低
  const high = Math.max(...candles.map(c => c.high));
  const low = Math.min(...candles.map(c => c.low));

  // 计算波动率 (简单标准差)
  const prices = candles.map(c => c.close);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
  const volatility = Math.sqrt(variance);

  // 计算动量 (最近几根K线的方向)
  const recentCandles = candles.slice(-5);
  let momentum = 0;
  for (let i = 1; i < recentCandles.length; i++) {
    if (recentCandles[i].close > recentCandles[i - 1].close) momentum++;
    else if (recentCandles[i].close < recentCandles[i - 1].close) momentum--;
  }

  // 判断趋势
  let trend = 'stable';
  if (priceChangePercent > 5) trend = 'bullish';
  else if (priceChangePercent < -5) trend = 'bearish';

  // 趋势强度
  let trendStrength = 'weak';
  if (Math.abs(priceChangePercent) > 15) trendStrength = 'strong';
  else if (Math.abs(priceChangePercent) > 8) trendStrength = 'moderate';

  return {
    currentPrice: last.close,
    startPrice: first.open,
    priceChange: Math.round(priceChange * 10000) / 10000,
    priceChangePercent: Math.round(priceChangePercent * 100) / 100,
    high,
    low,
    avgPrice: Math.round(avgPrice * 10000) / 10000,
    volatility: Math.round(volatility * 10000) / 10000,
    volatilityPercent: Math.round((volatility / avgPrice) * 100 * 100) / 100,
    momentum,  // 正数=上涨动量, 负数=下跌动量
    trend,
    trendStrength,
    dataPoints: candles.length,
    timeRangeHours: Math.round((last.timestamp - first.timestamp) / 3600)
  };
}