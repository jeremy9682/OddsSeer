import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, sanitizeExternalUrl } from '../content/utils/dom.ts';
import { matchesHost, detectEventUrl } from '../utils/host.ts';
import { readFile } from 'node:fs/promises';
test('escaping protects both text and quoted attribute contexts', () => {
 assert.equal(escapeHtml('" onmouseover="x<>&\''), '&quot; onmouseover=&quot;x&lt;&gt;&amp;&#39;');
});
test('event detection rejects lookalikes and misleading paths', () => {
 assert.equal(matchesHost('notpolymarket.com','polymarket.com'),false);
 assert.equal(detectEventUrl('https://notpolymarket.com/event/test').supported,false);
 assert.equal(detectEventUrl('https://polymarket.com/foo/kalshi.com/markets/test').supported,false);
 assert.equal(detectEventUrl('https://polymarket.com/event/bitcoin').eventId,'bitcoin');
 assert.equal(detectEventUrl('https://kalshi.com/markets/kxbtc').platform,'kalshi');
});
test('external links cannot execute script', () => {
 globalThis.window = {location:{href:'https://example.org/'}};
 assert.equal(sanitizeExternalUrl('javascript:alert(1)'),null);
 assert.equal(sanitizeExternalUrl('data:text/html,test'),null);
 assert.equal(sanitizeExternalUrl('https://polymarket.com/event/test'),'https://polymarket.com/event/test');
});
test('built manifest injects once and excludes account access', async () => {
 const m=JSON.parse(await readFile(new URL('../.output/chrome-mv3/manifest.json',import.meta.url),'utf8'));
 assert.equal(m.content_scripts.length,1);
 assert.ok(!m.web_accessible_resources?.some(entry=>entry.resources.includes('sidepanel.html')));
 assert.equal(m.content_scripts[0].js.length,1);
 assert.ok(!m.permissions.includes('identity'));
 assert.ok(!JSON.stringify(m).includes('api.oddsseer.com'));
 assert.ok(!JSON.stringify(m).includes('privy.io'));
 assert.ok(m.host_permissions.includes('https://data-api.polymarket.com/*'));
});
