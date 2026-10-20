import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {escapeHtml} from '../content/utils/dom.ts';
import {createMonitorMutator,mergeMonitorPrices} from '../utils/monitor-storage.ts';
const quiet={log(){},warn(){},error(){}};
// Run real source functions with explicit API/DOM fixtures, without browser automation.
function load(file,names,globals={}) {
 const src=readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const ast=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true);
 const functions=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text));
 assert.equal(functions.length,names.length);
 const code=functions.map(n=>n.getText(ast).replace(/^export /,'')).join('\n')+'\nthis.out={'+names.join(',')+'};';
 const context={console:quiet,URL,Date,Map,Set,...globals};
 vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return context.out;
}
test('sidebar message calls open in the current event before yielding and propagates rejection',async()=>{
 let handlers,calls=0;
 load('entrypoints/background.ts',['setupMessageListeners'],{createMessageListener:h=>handlers=h,
  chrome:{sidePanel:{open:()=>{calls++;return Promise.resolve();}}}}).setupMessageListeners();
 const pending=handlers.OPEN_SIDEPANEL(null,{tab:{id:4}});
 assert.equal(calls,1);await pending;
 await assert.rejects(()=>handlers.OPEN_SIDEPANEL(null,{}),/originating tab/);
});
test('right-click dispatch reaches content search, not a removed sidebar tab',async()=>{
 let listener,message;
 const chrome={runtime:{onInstalled:{addListener(){}}},contextMenus:{onClicked:{addListener:fn=>listener=fn}},
 tabs:{sendMessage:async(id,msg)=>{message={id,...msg};}}};
 load('entrypoints/background.ts',['setupContextMenus'],{chrome}).setupContextMenus();
 listener({menuItemId:'analyze-selection',selectionText:'Bitcoin'},{id:7});
 assert.equal(message.type,'SEARCH_SELECTION');assert.equal(message.payload.text,'Bitcoin');
 let receiver,query;
 const contentChrome={runtime:{onMessage:{addListener:fn=>receiver=fn}}};
 load('entrypoints/content.ts',['setupMessageListener'],{chrome:contentChrome,searchMarkets:async text=>{query=text;}}).setupMessageListener();
 receiver(message,{},()=>{});assert.equal(query,'Bitcoin');
});
test('actual scanner sends a pure Chinese block to PAGE_SCAN',async()=>{
 const text='今年美国总统选举结果将如何影响全球金融市场和未来经济政策';let sent;
 const functions=load('content/page-scanner/index.ts',['scanCurrentPage','extractKeywords'],{
  STOP_WORDS:new Set(),isZhLanguage:()=>true,getVisibleText(){},getExtractedBlocks:()=>[{text,element:{}}],
  showToast(){},sendToBackground:async(type,payload)=>{sent={type,payload};return{success:true,data:{blockResults:[]}}},
  window:{location:{href:'https://example.org/news'}}
 });await functions.scanCurrentPage();
 assert.equal(sent.type,'PAGE_SCAN');assert.equal(sent.payload.blocks[0].text,text);
});
test('NEXT_DATA event numeric id and encoded prices preserve slug and zero',()=>{
 const document={querySelector:()=>({textContent:'Bitcoin'}),querySelectorAll:()=>[],
 getElementById:()=>({textContent:JSON.stringify({props:{pageProps:{event:{id:12345,slug:'bitcoin',title:'Bitcoin',markets:[{outcomePrices:'["0","1"]'}]}}}})})};
 const {extractPolymarketEvent}=load('content/page-detector/index.ts',['extractPolymarketEvent'],{document,window:{location:{href:'https://polymarket.com/event/bitcoin'}}});
 const result=extractPolymarketEvent('bitcoin');assert.equal(result.id,'bitcoin');assert.equal(result.yesPrice,0);assert.equal(result.noPrice,1);
});
test('actual sentiment renderer rejects markup in numeric response fields',()=>{
 const f=load('content/enhancement-panel/sections/community-sentiment.ts',
 ['renderCommunitySentiment','finiteCount','renderMultiOptionWilson','renderOptionMentions','getSentimentEmoji'],{escapeHtml});
 const probe='<b data-review-probe="injected">fixture</b>';
 for(const multi of [false,true]) {
  const body={};f.renderCommunitySentiment(body,{isMultiOption:multi,overallSentiment:'neutral',summary:'Fixture',
   keyArguments:[{point:'Fixture',forOption:'A',sentiment:'support',mentions:probe}],
   optionMentions:[{option:'A',mentions:probe,supportRate:0.5}],
   stats:multi?{wilsonLower:.4,wilsonUpper:.6,leadGap:probe}:undefined}, {},false);
  assert.ok(!body.innerHTML.includes('<b data-review-probe'));assert.match(body.innerHTML,/argument-count">\(0\)/);
 }
});
test('serialized monitor writers preserve simultaneous additions and recover after failure',async()=>{
 let saved=[];const mutate=createMonitorMutator(async()=>structuredClone(saved),async value=>{saved=structuredClone(value)});
 await Promise.all([mutate(items=>[...items,{id:'a'}]),mutate(items=>[...items,{id:'b'}])]);
 assert.deepEqual(saved.map(x=>x.id),['a','b']);
 await assert.rejects(mutate(()=>{throw Error('fixture')}));
 await mutate(items=>items.filter(x=>x.id!=='a'));assert.deepEqual(saved.map(x=>x.id),['b']);
});
test('late price responses cannot resurrect deleted or overwrite edited/new monitors',()=>{
 const a={id:'a',condition:{threshold:5}}, b={id:'b',condition:{threshold:5}};
 const updated=[{...a,triggered:true},{...b,lastPrice:.7}];
 const current=[{...b,condition:{threshold:10}},{id:'c'}];
 assert.deepEqual(mergeMonitorPrices(current,[a,b],updated),current);
});
test('active market is isolated by tab and navigation URL',async()=>{
 let id=1,url='https://example.org/one';
 const state={'selected:1':{url,market:{id:'one'}},'selected:2':{url:'https://example.org/two',market:{id:'two'}}};
 const chrome={tabs:{query:async()=>[{id}],sendMessage:async()=>({url,market:null})},storage:{session:{get:async()=>state}}};
 const {activeMarket}=load('entrypoints/background.ts',['activeMarket'],{chrome});
 assert.equal((await activeMarket()).id,'one');id=2;url='https://example.org/two';assert.equal((await activeMarket()).id,'two');
 url='https://example.org/elsewhere';assert.equal(await activeMarket(),null);
});
test('disabled selection setting prevents the popup immediately',()=>{
 let hidden=false;
 const {handleMouseUp}=load('content/text-selection/index.ts',['handleMouseUp'],{getSettings:()=>({enableTextSelection:false}),hideSelectionPopup:()=>{hidden=true}});
 handleMouseUp({});assert.equal(hidden,true);
});

test('external selection normalizes numeric Polymarket ids from an event URL',async()=>{
 const {normalizeMarketIdentity}=await import('../utils/market-identity.ts');
 const market={id:12345,source:'polymarket',url:'https://polymarket.com/event/bitcoin'};
 assert.equal(normalizeMarketIdentity(market).id,'bitcoin');
 assert.equal(normalizeMarketIdentity({...market,url:'https://notpolymarket.com/event/bitcoin'}).id,12345);
});
test('scan reports backend failure rather than a successful empty result',async()=>{
 let message;
 const functions=load('content/page-scanner/index.ts',['scanCurrentPage','extractKeywords'],{
  STOP_WORDS:new Set(),isZhLanguage:()=>false,getVisibleText(){},
  getExtractedBlocks:()=>[{text:'Bitcoin market expectations and economic policies for next year',element:{}}],
  showToast:msg=>message=msg,sendToBackground:async()=>({success:true,data:{success:false,error:'fixture offline'}}),
  window:{location:{href:'https://example.org/news'}}
 });await functions.scanCurrentPage();assert.equal(message,'Search failed, please retry');
});

test('worker restarts preserve existing alarm schedule and restore missing alarms',async()=>{
 const creates=[];let existing=true;
 const chrome={alarms:{get:async()=>existing?{scheduledTime:123}:undefined,create:async(...args)=>creates.push(args),onAlarm:{addListener(){}}}};
 const {setupAlarms}=load('entrypoints/background.ts',['setupAlarms'],{chrome});
 setupAlarms();await Promise.resolve();assert.equal(creates.length,0);
 existing=false;setupAlarms();await Promise.resolve();assert.equal(creates.length,2);
});
test('quotes preserve zero and never manufacture a midpoint from missing data',async()=>{
 const {probability,gammaPrices,kalshiPrices}=await import('../utils/prices.ts');
 assert.equal(probability(''),null);assert.equal(probability('0'),0);assert.equal(probability('bad'),null);
 assert.deepEqual(gammaPrices('["0","1"]'),{yesPrice:0,noPrice:1});
 assert.deepEqual(gammaPrices(undefined),{yesPrice:null,noPrice:null});
 assert.deepEqual(kalshiPrices({yes_ask_dollars:'0.42',no_ask_dollars:'0.61',yes_bid:30}),{yesPrice:.42,noPrice:.61});
 assert.deepEqual(kalshiPrices({yes_ask:1,no_ask:99}),{yesPrice:.01,noPrice:.99});
 assert.deepEqual(kalshiPrices({}),{yesPrice:null,noPrice:null});
});
test('real realtime adapters return missing quotes as null and keep public slug',async()=>{
 const {gammaPrices,kalshiPrices}=await import('../utils/prices.ts');
 let body=[{id:99,slug:'bitcoin',markets:[{question:'Yes',outcomePrices:undefined}]}];
 const {fetchPolymarketLatestData,fetchKalshiLatestData}=load('entrypoints/background.ts',['fetchPolymarketLatestData','fetchKalshiLatestData'],{
  gammaPrices,kalshiPrices,fetch:async()=>({ok:true,status:200,json:async()=>body})
 });
 const gamma=await fetchPolymarketLatestData('bitcoin');assert.equal(gamma.id,'bitcoin');assert.equal(gamma.yesPrice,null);
 body={event:{event_ticker:'BTC',title:'Bitcoin',markets:[{ticker:'BTC-X',yes_ask_dollars:'0.24',no_ask_dollars:'0.79'}]}};
 const kalshi=await fetchKalshiLatestData('BTC');assert.equal(kalshi.yesPrice,.24);assert.equal(kalshi.noPrice,.79);
 body={event:{event_ticker:'BTC',markets:[{}]}};assert.equal((await fetchKalshiLatestData('BTC')).yesPrice,null);
});
test('missing prices cannot trigger a watchlist notification',async()=>{
 let notifications=0,writes=0;
 const monitor={id:'a',marketId:'bitcoin',condition:{threshold:1},lastPrice:.1};
 const {checkPriceMonitors}=load('entrypoints/background.ts',['checkPriceMonitors'],{
  extStorage:{get:async key=>key==='monitors'?[monitor]:{enableNotifications:true}},
  DEFAULT_SETTINGS:{},fetchPolymarketLatestData:async()=>({yesPrice:null}),
  mutateMonitors:async()=>writes++,createNotification:()=>notifications++
 });await checkPriceMonitors();assert.equal(writes,0);assert.equal(notifications,0);
});
test('unavailable prices cannot produce a synthetic arbitrage difference',()=>{
 const {findBestArbitrage}=load('content/enhancement-panel/sections/arbitrage.ts',['findBestArbitrage']);
 assert.equal(findBestArbitrage({yesPrice:null},{yesPrice:.3}).maxDiff,null);
 assert.equal(findBestArbitrage({yesPrice:0},{yesPrice:.1}).maxDiff,10);
});

test('market summary refuses to invent bid/ask when the book is missing',()=>{
 const {computeMicrostructure}=load('utils/market-summary.ts',['computeMicrostructure']);
 assert.throws(()=>computeMicrostructure(null,{yesPrice:null}),/Order book unavailable/);
 const result=computeMicrostructure(null,{}, {bestBid:0,bestAsk:.02,spread:.02});
 assert.equal(result.bestBid,0);assert.equal(result.bestAsk,.02);
});
