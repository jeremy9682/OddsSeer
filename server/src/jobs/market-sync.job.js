import { boundedFetch as fetch } from '../lib/upstream.js';
/**
 * Market Sync Job
 * 
 * Synchronizes market events from Polymarket and Kalshi
 * to the local database for semantic search
 */

import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import { MARKET_SYNC_CONFIG } from '../config/search.config.js';

// ============================================
// Configuration
// ============================================

const POLYMARKET_API = MARKET_SYNC_CONFIG.polymarket.apiUrl;
const KALSHI_API = MARKET_SYNC_CONFIG.kalshi.apiUrl;

// Sync statistics
let syncStats = {
  lastSyncAt: null,
  polymarketEvents: 0,  // Total from API
  polymarketNew: 0,     // New events inserted
  kalshiEvents: 0,      // Total from API
  kalshiNew: 0,         // New events inserted
  errors: [],
};

// ============================================
// Text Normalization
// ============================================

/**
 * Normalize text for search (lowercase, remove punctuation)
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .replace(/\s+/g, ' ')       // Collapse whitespace
    .trim();
}

/**
 * Detect category from title/description
 */
function detectCategory(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  
  // Category detection patterns
  const patterns = {
    politics: /\b(election|president|congress|senate|vote|democrat|republican|trump|biden|political|governor|mayor|poll)\b/,
    crypto: /\b(bitcoin|btc|ethereum|eth|crypto|blockchain|defi|nft|token|coin|solana|cardano)\b/,
    sports: /\b(nfl|nba|mlb|nhl|soccer|football|basketball|baseball|hockey|championship|super bowl|world cup|olympics)\b/,
    entertainment: /\b(movie|film|oscar|grammy|emmy|award|box office|netflix|disney|celebrity|music|album)\b/,
    business: /\b(stock|market|fed|interest rate|inflation|gdp|earnings|ipo|merger|acquisition|company)\b/,
    science: /\b(space|nasa|climate|research|discovery|ai|artificial intelligence|technology|tech)\b/,
    legal: /\b(court|trial|lawsuit|judge|verdict|indictment|legal|supreme court)\b/,
  };
  
  for (const [category, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      return category;
    }
  }
  
  return 'other';
}

// ============================================
// Polymarket Sync
// ============================================

/**
 * Fetch events from Polymarket Gamma API
 */
async function fetchPolymarketEvents(limit = 500, offset = 0) {
  try {
    const url = `${POLYMARKET_API}/events?active=true&closed=false&limit=${limit}&offset=${offset}&order=volume&ascending=false`;
    
    void 0;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }
    
    const events = await response.json();
    return Array.isArray(events) ? events : [];
  } catch (error) {
    void 0;
    syncStats.errors.push({ source: 'polymarket', error: error.message, time: new Date() });
    return [];
  }
}

/**
 * Transform Polymarket event to database format
 */
function transformPolymarketEvent(event) {
  // Get the primary market (first one or highest volume)
  const markets = event.markets || [];
  const primaryMarket = markets[0] || {};
  
  const title = event.title || primaryMarket.question || 'Unknown Event';
  const description = event.description || '';
  
  return {
    externalId: event.id || event.slug,
    source: 'POLYMARKET',
    title: title.slice(0, 500),
    titleNormalized: normalizeText(title).slice(0, 500),
    description: description,
    searchText: `${title} ${description}`,
    category: detectCategory(title, description),
    status: event.closed ? 'CLOSED' : (event.active ? 'ACTIVE' : 'CLOSED'),
    yesPrice: primaryMarket.outcomePrices ? 
      parseFloat(JSON.parse(primaryMarket.outcomePrices)[0]) : null,
    noPrice: primaryMarket.outcomePrices ? 
      parseFloat(JSON.parse(primaryMarket.outcomePrices)[1]) : null,
    volume: event.volume ? parseFloat(event.volume) : null,
    liquidity: event.liquidity ? parseFloat(event.liquidity) : null,
    endDate: event.endDate ? new Date(event.endDate) : null,
    url: `https://polymarket.com/event/${event.slug}`,
    metadata: {
      slug: event.slug,
      marketsCount: markets.length,
      tags: event.tags || [],
    },
  };
}

/**
 * Sync Polymarket events to database
 * 
 * 简化策略：只存储用于搜索的基本信息（标题、描述、链接）
 * 详细数据（价格、交易量）用户点击时再实时获取
 */
async function syncPolymarketEvents() {
  void 0;
  
  let totalNew = 0;
  let totalSkipped = 0;
  let offset = 0;
  const batchSize = MARKET_SYNC_CONFIG.polymarket.batchSize;
  
  // Get existing event IDs (only need to check if exists)
  const existingEvents = await prisma.marketEvent.findMany({
    where: { source: 'POLYMARKET' },
    select: { externalId: true },
  });
  const existingIds = new Set(existingEvents.map(e => e.externalId));
  
  while (true) {
    const events = await fetchPolymarketEvents(batchSize, offset);
    
    if (events.length === 0) break;
    
    // Only collect NEW events (existing ones don't need update)
    const eventsToCreate = [];
    
    for (const event of events) {
      try {
        const data = transformPolymarketEvent(event);
        
        if (!existingIds.has(data.externalId)) {
          // New event - insert it
          eventsToCreate.push(data);
          existingIds.add(data.externalId);  // Prevent duplicates in same sync
          totalNew++;
        } else {
          // Already exists - skip (no need to update search data)
          totalSkipped++;
        }
      } catch (error) {
        void 0;
      }
    }
    
    // Batch create new events only
    if (eventsToCreate.length > 0) {
      await prisma.marketEvent.createMany({
        data: eventsToCreate,
        skipDuplicates: true,
      });
    }
    
    offset += batchSize;
    
    // Safety limit
    if (offset > 5000) {
      void 0;
      break;
    }
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  syncStats.polymarketEvents = totalNew + totalSkipped;  // Total fetched from API
  syncStats.polymarketNew = totalNew;
  void 0;
  
  return totalNew;
}

// ============================================
// Kalshi Sync
// ============================================

/**
 * Fetch events from Kalshi API (with cursor pagination)
 */
async function fetchKalshiEvents(limit = 100, cursor = null) {
  try {
    let url = `${KALSHI_API}/events?status=open&limit=${limit}`;
    if (cursor) {
      url += `&cursor=${encodeURIComponent(cursor)}`;
    }
    
    void 0;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Kalshi API error: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      events: data.events || [],
      cursor: data.cursor || null,  // Next page cursor
    };
  } catch (error) {
    void 0;
    syncStats.errors.push({ source: 'kalshi', error: error.message, time: new Date() });
    return { events: [], cursor: null };
  }
}

/**
 * Transform Kalshi event to database format
 */
function transformKalshiEvent(event) {
  const title = event.title || 'Unknown Event';
  const description = event.sub_title || '';
  
  // Kalshi status can be 'open', 'OPEN', 'closed', etc.
  // We fetch with status=open, so default to ACTIVE
  const eventStatus = (event.status || '').toLowerCase();
  const isActive = eventStatus === 'open' || eventStatus === 'active' || !event.status;
  
  return {
    externalId: `kalshi_${event.event_ticker}`,
    source: 'KALSHI',
    title: title.slice(0, 500),
    titleNormalized: normalizeText(title).slice(0, 500),
    description: description,
    searchText: `${title} ${description}`,
    category: event.category ? event.category.toLowerCase() : detectCategory(title, description),
    status: isActive ? 'ACTIVE' : 'CLOSED',
    yesPrice: null,  // Kalshi requires separate market request
    noPrice: null,
    volume: null,
    liquidity: null,
    endDate: event.expiration_time ? new Date(event.expiration_time) : null,
    url: `https://kalshi.com/events/${event.event_ticker}`,
    metadata: {
      eventTicker: event.event_ticker,
      seriesTicker: event.series_ticker,
      mutuallyExclusive: event.mutually_exclusive,
    },
  };
}

/**
 * Sync Kalshi events to database
 * 
 * 简化策略：只插入新事件，不更新已有事件
 * 使用 cursor 分页获取所有事件
 */
async function syncKalshiEvents() {
  if (!MARKET_SYNC_CONFIG.kalshi.enabled) {
    void 0;
    return 0;
  }
  
  void 0;
  
  // Get existing Kalshi event IDs
  const existingEvents = await prisma.marketEvent.findMany({
    where: { source: 'KALSHI' },
    select: { externalId: true },
  });
  const existingIds = new Set(existingEvents.map(e => e.externalId));
  
  let totalNew = 0;
  let totalSkipped = 0;
  let cursor = null;
  let pageCount = 0;
  const pageSize = MARKET_SYNC_CONFIG.kalshi.pageSize || 100;
  const maxPages = MARKET_SYNC_CONFIG.kalshi.maxPages || 50;
  
  // Paginate through all Kalshi events
  do {
    const result = await fetchKalshiEvents(pageSize, cursor);
    const events = result.events;
    cursor = result.cursor;
    pageCount++;
    
    if (events.length === 0) break;
    
    const eventsToCreate = [];
    
    for (const event of events) {
      try {
        const data = transformKalshiEvent(event);
        
        if (!existingIds.has(data.externalId)) {
          eventsToCreate.push(data);
          existingIds.add(data.externalId);  // Prevent duplicates in same sync
          totalNew++;
        } else {
          totalSkipped++;
        }
      } catch (error) {
        void 0;
      }
    }
    
    // Batch create new events
    if (eventsToCreate.length > 0) {
      await prisma.marketEvent.createMany({
        data: eventsToCreate,
        skipDuplicates: true,
      });
    }
    
    // Small delay between pages
    if (cursor) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
  } while (cursor && pageCount < maxPages);
  
  if (pageCount >= maxPages) {
    void 0;
  }
  
  syncStats.kalshiEvents = totalNew + totalSkipped;  // Total fetched from API
  syncStats.kalshiNew = totalNew;
  void 0;
  
  return totalNew;
}

// ============================================
// Cleanup & Maintenance
// ============================================

/**
 * Delete expired events (endDate has passed)
 * 事件到期 = 直接删除，不保留
 */
async function deleteExpiredEvents() {
  try {
    const now = new Date();
    
    const result = await prisma.marketEvent.deleteMany({
      where: {
        endDate: {
          lt: now,  // endDate 已过
          not: null,
        },
      },
    });
    
    if (result.count > 0) {
      void 0;
    }
    
    return result.count;
  } catch (error) {
    void 0;
    return 0;
  }
}

/**
 * Get events that need embedding generation
 */
export async function getEventsNeedingEmbedding(limit = 100) {
  return prisma.marketEvent.findMany({
    where: {
      embeddingGeneratedAt: null,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      title: true,
      description: true,
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });
}

// ============================================
// Main Sync Function
// ============================================

/**
 * Run full market sync
 */
export async function runMarketSync() {
  void 0;
  void 0;
  const startTime = Date.now();
  
  // Reset stats
  syncStats = {
    lastSyncAt: new Date(),
    polymarketEvents: 0,
    polymarketNew: 0,
    kalshiEvents: 0,
    kalshiNew: 0,
    errors: [],
  };
  
  try {
    // Sync from both sources
    await Promise.all([
      syncPolymarketEvents(),
      syncKalshiEvents(),
    ]);
    
    // Delete expired events (endDate passed)
    await deleteExpiredEvents();
    
    const duration = Date.now() - startTime;
    const totalInDb = await prisma.marketEvent.count();
    
    void 0;
    void 0;
    void 0;
    void 0;
    void 0;
    
    if (syncStats.errors.length > 0) {
      void 0;
    }
    
    return syncStats;
  } catch (error) {
    void 0;
    syncStats.errors.push({ source: 'sync', error: error.message, time: new Date() });
    throw error;
  }
}

/**
 * Get sync statistics
 */
export function getSyncStats() {
  return { ...syncStats };
}

// ============================================
// Scheduler
// ============================================

let syncJob = null;

/**
 * Start the market sync scheduler
 */
export function startMarketSyncScheduler() {
  void 0;
  void 0;
  
  // Validate cron expression
  if (!cron.validate(MARKET_SYNC_CONFIG.schedule)) {
    void 0;
    return;
  }
  
  // Stop existing job if any
  if (syncJob) {
    syncJob.stop();
  }
  
  // Start new scheduled job
  syncJob = cron.schedule(MARKET_SYNC_CONFIG.schedule, async () => {
    try {
      await runMarketSync();
    } catch (error) {
      void 0;
    }
  });
  
  void 0;
  
  // Run initial sync after 5 seconds
  setTimeout(() => {
    void 0;
    runMarketSync().catch(err => {
      void 0;
    });
  }, 5000);
}

/**
 * Stop the market sync scheduler
 */
export function stopMarketSyncScheduler() {
  if (syncJob) {
    syncJob.stop();
    syncJob = null;
    void 0;
  }
}

export default {
  runMarketSync,
  getSyncStats,
  getEventsNeedingEmbedding,
  startMarketSyncScheduler,
  stopMarketSyncScheduler,
};
