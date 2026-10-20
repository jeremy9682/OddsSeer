import { upstreamJson, UpstreamError } from './lib/upstream.js';
const gamma = 'https://gamma-api.polymarket.com';
const kalshi = 'https://api.elections.kalshi.com/trade-api/v2';
function array(value) { try { return Array.isArray(value) ? value : JSON.parse(value || '[]'); } catch { return []; } }
function number(value) { const n = Number(value); return value != null && Number.isFinite(n) ? n : null; }
function probability(value) { const n = number(value); return n != null && n >= 0 && n <= 1 ? n : null; }
export function mapGamma(event) {
  if (!/^[a-z0-9-]{1,200}$/i.test(event.slug || '')) return null;
  const markets = Array.isArray(event.markets) ? event.markets : [];
  const primary = [...markets].sort((a,b) => Number(b.volume || 0)-Number(a.volume || 0))[0] || {};
  const prices = array(primary.outcomePrices);
  return { id: String(event.id || event.slug), externalId: String(primary.conditionId || event.id || event.slug), source: 'polymarket',
    title: event.title || primary.question || '', description: event.description || '',
    yesPrice: probability(prices[0]), noPrice: probability(prices[1]), volume: number(event.volume) || 0,
    endDate: event.endDate, url: `https://polymarket.com/event/${event.slug}`,
    outcomes: markets.map(m => ({ id: m.id, name: m.groupItemTitle || m.question, yesPrice: probability(array(m.outcomePrices)[0]), noPrice: probability(array(m.outcomePrices)[1]) })) };
}
export function mapKalshi(event) {
  const ticker = event.event_ticker;
  if (!/^[A-Z0-9._-]{1,64}$/.test(ticker || '')) return null;
  const markets = event.markets || []; const m = markets[0] || {};
  const yes = probability(m.yes_ask_dollars ?? (m.yes_ask == null ? null : m.yes_ask / 100));
  const no = probability(m.no_ask_dollars ?? (m.no_ask == null ? null : m.no_ask / 100));
  return { id: ticker, externalId: ticker, title: event.title || '', source: 'kalshi', yesPrice: yes, noPrice: no,
    volume: markets.reduce((n, x) => n + (number(x.volume) || 0), 0), url: `https://kalshi.com/events/${ticker}`,
    outcomes: markets.map(x => ({ id: x.ticker, marketTicker: x.ticker, name: x.yes_sub_title || x.title, yesPrice: probability(x.yes_ask_dollars ?? (x.yes_ask == null ? null : x.yes_ask/100)), noPrice: probability(x.no_ask_dollars ?? (x.no_ask == null ? null : x.no_ask/100)) })) };
}
export function createPublicSearch({ json = upstreamJson, now = Date.now } = {}) {
  let cached = null; let expiry = 0; let pending;
  async function kalshiEvents() {
    if (cached && now() < expiry) return cached;
    if (!pending) pending = json(`${kalshi}/events?status=open&limit=100&with_nested_markets=true`).then(data => {
      if (!Array.isArray(data.events)) throw new UpstreamError('Invalid Kalshi response');
      cached = data.events; expiry = now() + 300000; return cached;
    }).finally(() => { pending = null; });
    return pending;
  }
  return async (text, { limit = 10 } = {}) => {
    const stop = new Set(['the','will','are','was','were','for','and','with','this','that','what','when','how','does','would','could']);
    const terms = (text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []).filter(term => !stop.has(term));
    const query = new URLSearchParams({ q: text.slice(0, 300), limit_per_type: String(limit), events_status: 'active' });
    const results = await Promise.allSettled([
      json(`${gamma}/public-search?${query}`).then(data => {
        if (!Array.isArray(data.events)) throw new UpstreamError('Invalid Gamma response');
        return data.events.map(mapGamma).filter(Boolean);
      }),
      kalshiEvents().then(events => events.filter(e => terms.some(t => `${e.title} ${e.sub_title || ''}`.toLowerCase().includes(t))).map(mapKalshi).filter(Boolean)),
    ]);
    if (results.every(r => r.status === 'rejected')) throw new UpstreamError();
    return { results: results.flatMap(r => r.status === 'fulfilled' ? r.value : []).slice(0, limit),
      metadata: { stage: 'public_keyword', dataMode: 'live', partial: results.some(r => r.status === 'rejected'),
        sources: { polymarket: results[0].status === 'fulfilled' ? 'available' : 'unavailable', kalshi: results[1].status === 'fulfilled' ? 'available' : 'unavailable' },
        kalshiCoverage: 'first_100_open_events' } };
  };
}
