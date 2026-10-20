import type { MarketEvent } from './types';
export function normalizeMarketIdentity(market: MarketEvent): MarketEvent {
  if (market.source !== 'polymarket') return market;
  try {
    const url = new URL(market.url || '');
    const slug = url.pathname.match(/^\/event\/([^/]+)(?:\/|$)/)?.[1];
    if (url.protocol === 'https:' && (url.hostname === 'polymarket.com' || url.hostname.endsWith('.polymarket.com')) && slug) {
      return { ...market, id: slug };
    }
  } catch { /* A valid slug may already be present. */ }
  return market;
}
