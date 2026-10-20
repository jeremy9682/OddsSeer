/**
 * Page detector module
 * Detects page type and extracts market data from supported pages
 */

import { matchesHost, detectEventUrl } from '../../utils/host';
import type { MarketEvent, PageContext } from '../../utils/types';

/**
 * Supported page info
 */
export interface SupportedPageInfo {
  supported: boolean;
  platform: string;
  eventId: string;
}

/**
 * Get the type of the current page
 */
export function getPageType(): PageContext['type'] {
  const url = window.location.href;
  const domain = window.location.hostname;

  // Prediction markets
  if (
    matchesHost(domain, 'polymarket.com') ||
    matchesHost(domain, 'kalshi.com') ||
    matchesHost(domain, 'metaculus.com')
  ) {
    return 'prediction_market';
  }

  // News sites
  const newsDomains = [
    'reuters.com', 'bloomberg.com', 'nytimes.com', 'wsj.com',
    'cnn.com', 'bbc.com', 'theguardian.com', 'apnews.com',
    'politico.com', 'axios.com', 'thehill.com', 'washingtonpost.com'
  ];
  if (newsDomains.some(nd => matchesHost(domain, nd))) {
    return 'news';
  }

  // Social media
  const socialDomains = ['twitter.com', 'x.com', 'reddit.com', 'facebook.com'];
  if (socialDomains.some(sd => matchesHost(domain, sd))) {
    return 'social';
  }

  return 'other';
}

/**
 * Check if current page is a supported prediction market event page
 */
export function isSupportedEventPage(): SupportedPageInfo {
  return detectEventUrl(window.location.href);
}

/**
 * Extract event/market data from the current page
 */
export function extractEventFromPage(eventId: string, platform: string): MarketEvent | null {
  if (platform === 'polymarket') {
    return extractPolymarketEvent(eventId);
  }
  if (platform === 'kalshi') {
    return extractKalshiEvent(eventId);
  }
  return null;
}

/**
 * Extract event data from Polymarket page
 */
function extractPolymarketEvent(eventId: string): MarketEvent | null {
  try {
    // Try to extract from page title
    const titleEl = document.querySelector('h1');
    const title = titleEl?.textContent?.trim() || eventId;

    // Try to extract prices from the page
    let yesPrice: number | null = null;
    let noPrice: number | null = null;

    // Look for price elements
    const priceEls = document.querySelectorAll('[class*="price"], [class*="odds"]');
    for (const el of priceEls) {
      const text = el.textContent || '';
      const match = text.match(/(\d+(?:\.\d+)?)[%¢]/);
      if (match) {
        const price = parseFloat(match[1]);
        if (text.toLowerCase().includes('yes')) {
          yesPrice = price / 100;
        } else if (text.toLowerCase().includes('no')) {
          noPrice = price / 100;
        }
      }
    }

    // Try to extract conditionId from page scripts or data attributes
    let conditionId = eventId;
    const scripts = document.querySelectorAll('script[type="application/json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        if (data.conditionId) {
          conditionId = data.conditionId;
          break;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Look for __NEXT_DATA__ which often contains market data
    const nextDataScript = document.getElementById('__NEXT_DATA__');
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript.textContent || '');
        const pageProps = nextData?.props?.pageProps;
        if (pageProps?.event) {
          const event = pageProps.event;
          let prices = event.markets?.[0]?.outcomePrices;
          if (typeof prices === 'string') prices = JSON.parse(prices);
          const probability = (value: unknown, fallback: number | null) => {
            const n = Number(value);
            return value != null && value !== '' && Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
          };
          return {
            id: typeof event.slug === 'string' && event.slug ? event.slug : eventId,
            conditionId: event.conditionId || event.markets?.[0]?.conditionId || eventId,
            title: event.title || title,
            description: event.description,
            category: event.category,
            endDate: event.endDate,
            yesPrice: probability(prices?.[0], yesPrice),
            noPrice: probability(prices?.[1], noPrice),
            volume: event.volume || 0,
            liquidity: event.liquidity || 0,
            source: 'polymarket',
            url: window.location.href
          };
        }
      } catch {
        // Ignore parse errors
      }
    }

    return {
      id: eventId,
      conditionId,
      title,
      yesPrice,
      noPrice,
      source: 'polymarket',
      url: window.location.href
    };
  } catch (error) {
    console.error('[PageDetector] Error extracting Polymarket event:', error);
    return null;
  }
}

/**
 * Extract event data from Kalshi page
 */
function extractKalshiEvent(eventId: string): MarketEvent | null {
  try {
    // Extract title - multiple strategies
    let title = '';

    // Strategy 1: Use document.title (most reliable for Kalshi)
    // Format: "Who will Trump nominate as Fed Chair? Odds & Predictions"
    const docTitle = document.title;
    if (docTitle && !docTitle.toLowerCase().includes('kalshi')) {
      // Remove common suffixes like "Odds & Predictions", "| Kalshi"
      title = docTitle
        .replace(/\s*[|–-]\s*Kalshi.*$/i, '')
        .replace(/\s*Odds\s*&?\s*Predictions.*$/i, '')
        .trim();
    }

    // Strategy 2: Look for specific Kalshi event title elements
    if (!title) {
      // Kalshi uses specific class patterns for event titles
      const titleSelectors = [
        '[data-testid="event-title"]',
        '[class*="EventTitle"]',
        '[class*="event-title"]',
        'main h1',
        'article h1'
      ];
      for (const selector of titleSelectors) {
        const el = document.querySelector(selector);
        const text = el?.textContent?.trim();
        if (text && text.length > 5 && !text.toLowerCase().includes('notice')) {
          title = text;
          break;
        }
      }
    }

    // Strategy 3: Fallback to eventId
    if (!title) {
      title = eventId;
    }

    console.log('[PageDetector] Kalshi title extracted:', title);

    // Default prices
    let yesPrice: number | null = null;
    let noPrice: number | null = null;

    // Look for price elements
    const priceEls = document.querySelectorAll('[class*="price"], [class*="probability"]');
    for (const el of priceEls) {
      const text = el.textContent || '';
      const match = text.match(/(\d+(?:\.\d+)?)[%¢]/);
      if (match) {
        const price = parseFloat(match[1]);
        if (text.toLowerCase().includes('yes')) {
          yesPrice = price / 100;
        } else if (text.toLowerCase().includes('no')) {
          noPrice = price / 100;
        }
      }
    }

    return {
      id: eventId,
      conditionId: eventId,
      title,
      yesPrice,
      noPrice,
      source: 'kalshi',
      url: window.location.href
    };
  } catch (error) {
    console.error('[PageDetector] Error extracting Kalshi event:', error);
    return null;
  }
}

/**
 * Extract keywords from page content
 */
export function extractKeywordsFromPage(): string[] {
  const keywords: string[] = [];

  // Extract from title
  const title = document.title;
  if (title) {
    // Split by common separators
    const titleWords = title.split(/[-–—|·•]/)[0].trim();
    if (titleWords.length > 3) {
      keywords.push(titleWords);
    }
  }

  // Extract from h1
  const h1 = document.querySelector('h1');
  if (h1?.textContent) {
    const h1Text = h1.textContent.trim();
    if (h1Text.length > 3 && !keywords.includes(h1Text)) {
      keywords.push(h1Text);
    }
  }

  // Extract from meta keywords
  const metaKeywords = document.querySelector('meta[name="keywords"]');
  if (metaKeywords) {
    const content = metaKeywords.getAttribute('content');
    if (content) {
      content.split(',').forEach(kw => {
        const trimmed = kw.trim();
        if (trimmed.length > 2 && !keywords.includes(trimmed)) {
          keywords.push(trimmed);
        }
      });
    }
  }

  // Extract from meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    const content = metaDesc.getAttribute('content');
    if (content && content.length > 10) {
      keywords.push(content.substring(0, 200));
    }
  }

  return keywords.slice(0, 10);
}

/**
 * Get page context for messaging
 */
export function getPageContext(): PageContext {
  const type = getPageType();
  const keywords = extractKeywordsFromPage();

  return {
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title,
    type,
    keywords
  };
}
