/** Fixed-template callers only; bounded network and streaming response body. */
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 8000;
export const DEFAULT_UPSTREAM_MAX_BYTES = 2 * 1024 * 1024;
export const USER_AGENT = 'OddsSeer/0.1';
export class UpstreamError extends Error {
  constructor(message = 'Upstream unavailable', { code = 'upstream_error' } = {}) {
    super(message); this.code = code; this.status = 502;
  }
}
export async function boundedFetch(url, options = {}) {
  const { timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS, maxBytes = DEFAULT_UPSTREAM_MAX_BYTES, ...init } = options;
  const signal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(init.signal ? [init.signal] : [])]);
  let response;
  try {
    response = await globalThis.fetch(url, { ...init, redirect: 'error', signal });
    const declared = Number(response.headers.get('content-length'));
    if (declared > maxBytes) { await response.body?.cancel(); throw new UpstreamError('Upstream response too large'); }
    const reader = response.body?.getReader();
    const chunks = []; let size = 0;
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) { await reader.cancel(); throw new UpstreamError('Upstream response too large'); }
          chunks.push(Buffer.from(value));
        }
      } finally { reader.releaseLock(); }
    }
    return new Response(response.status === 204 || response.status === 304 ? null : Buffer.concat(chunks), {
      status: response.status, statusText: response.statusText, headers: response.headers,
    });
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError('Upstream request failed', { code: signal.aborted ? 'upstream_timeout' : 'upstream_unreachable' });
  }
}
export async function upstreamJson(url) {
  const res = await boundedFetch(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new UpstreamError();
  try { return await res.json(); } catch { throw new UpstreamError('Invalid upstream JSON'); }
}
