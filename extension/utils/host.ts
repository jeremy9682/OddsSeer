export function matchesHost(host: string, domain: string): boolean {
  const value = host.toLowerCase().replace(/\.$/, '');
  return value === domain || value.endsWith(`.${domain}`);
}

export function detectEventUrl(value: string) {
  const none = { supported: false, platform: '', eventId: '' };
  let url: URL;
  try { url = new URL(value); } catch { return none; }
  if (!['http:', 'https:'].includes(url.protocol)) return none;
  if (matchesHost(url.hostname, 'polymarket.com')) {
    const match = url.pathname.match(/^\/(?:event|markets)\/([^/]+)/) || url.pathname.match(/^\/sports\/[^/]+\/games\/[^/]+\/[^/]+\/([^/]+)/);
    if (match) return { supported: true, platform: 'polymarket', eventId: match[1] };
  }
  if (matchesHost(url.hostname, 'kalshi.com')) {
    const match = url.pathname.match(/^\/(?:markets|events)\/([^/]+)/);
    if (match) return { supported: true, platform: 'kalshi', eventId: match[1] };
  }
  return none;
}
