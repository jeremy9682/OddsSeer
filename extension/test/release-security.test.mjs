import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { escapeHtml, sanitizeExternalUrl, formatVolume } from '../content/utils/dom.ts';
import { formatBackendStatus } from '../utils/backend-status.ts';

function actualFunctions(file, names, globals) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const found = [];
  function walk(node) {
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.push(node);
    ts.forEachChild(node, walk);
  }
  walk(ast);
  assert.equal(found.length, names.length);
  const code = found.map(node => node.getText(ast).replace(/^export /, '')).join('\n') + '\nthis.actual = {' + names.join(',') + '};';
  const context = { URL, Date, console: { log() {}, warn() {}, error() {} }, ...globals };
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.actual;
}

const markup = '<img src=x onerror="globalThis.reviewProbe=1">';
test('chart tooltip treats RSS-derived source and icon as text', () => {
  const tooltip = {};
  const actual = actualFunctions('content/chart-overlay/index.ts', ['renderTooltipContent'], { tooltip, isZh: false, escapeHtml });
  actual.renderTooltipContent([{ source: { name: markup, icon: markup }, title: 'A headline', timestamp: 1700000000 }], 1700000000);
  assert.ok(!tooltip.innerHTML.includes('<img'));
  assert.equal(tooltip.innerHTML.split(escapeHtml(markup)).length - 1, 2);
  assert.ok(tooltip.innerHTML.includes('A headline'));
});
test('search cards escape hostile backend ids/source labels and reject nonnumeric volumes', () => {
  globalThis.window = { location: { href: 'https://example.org/' } };
  const actual = actualFunctions('content/text-selection/index.ts', ['renderSearchResults', 'formatVolume', 'renderMultiOptionPrice'], {
    escapeHtml, sanitizeExternalUrl, REALTIME_PRICE_LIMIT: 3, MULTI_OPTION_DISPLAY_LIMIT: 3,
  });
  const container = {};
  actual.renderSearchResults(container, [{ id: '" onmouseover="x', source: markup, title: 'Market', url: 'https://example.org/market', volume: markup, yesPrice: 0.5 }], false);
  assert.ok(!container.innerHTML.includes('<img'));
  assert.ok(!container.innerHTML.includes('data-market-id="" onmouseover='));
  assert.ok(container.innerHTML.includes('data-market-id="&quot; onmouseover=&quot;x"'));
  assert.ok(container.innerHTML.includes('Vol: $0'));
});
test('shared volume formatter never returns attacker-provided markup', () => {
  assert.equal(formatVolume(markup), '0');
  assert.equal(formatVolume(Infinity), '0');
  assert.equal(formatVolume('1200'), '1.2K');
  assert.equal(formatVolume(0), '0');
});

test('runtime message listener accepts only well-formed messages from this extension', () => {
  let receive, calls = 0, reply;
  const chrome = { runtime: { id: 'our-extension', onMessage: { addListener: callback => receive = callback } } };
  actualFunctions('utils/messaging.ts', ['createMessageListener'], { chrome }).createMessageListener({ SET_SETTINGS: () => { calls++; return 'ok'; } });
  receive({type:'SET_SETTINGS'}, {id:'another-extension'}, value => reply=value);
  receive(null, {id:'our-extension'}, value => reply=value);
  assert.equal(calls, 0);
  receive({type:'SET_SETTINGS'}, {id:'our-extension'}, value => reply=value);
  assert.equal(calls, 1);
  assert.equal(reply.success, true);
});

test('backend status distinguishes unavailable search from an online server', () => {
  assert.match(formatBackendStatus({success:true,data:{capabilities:{search:'unavailable'}}},false), /Search unavailable/);
  assert.match(formatBackendStatus({success:true,data:{capabilities:{search:'hybrid'}}},false), /Hybrid search configured/);
  assert.match(formatBackendStatus({success:true,data:{}},false), /unknown/);
  assert.match(formatBackendStatus({success:false},true), /离线/);
});
test('timeline summary treats malformed backend totals as text', () => {
  const container = {};
  actualFunctions('content/enhancement-panel/sections/timeline.ts',['renderTimelineSummary'],{escapeHtml}).renderTimelineSummary(container,{summary:{totalEvents:markup}},false);
  assert.ok(!container.innerHTML.includes('<img'));
  assert.ok(container.innerHTML.includes(escapeHtml(markup)));
});
