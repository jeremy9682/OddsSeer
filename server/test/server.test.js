import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp, readConfig } from '../src/app.js';
import { createPublicSearch, mapGamma, mapKalshi } from '../src/public-search.js';
import { boundedFetch } from '../src/lib/upstream.js';
import { buildVectorSearchQuery, buildBm25SearchQuery, buildFallbackSearchQuery } from '../src/services/search/retrieval-sql.js';
const origin='chrome-extension://'+'a'.repeat(32);
const config=(extra={})=>({...readConfig({PORT:'0',ALLOWED_EXTENSION_ORIGINS:origin}),...extra});
async function running(t, options={}) {
 const app=createApp(options);await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>app.close(resolve)));
 return (path, {method='GET',body,headers={}}={})=>new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port:app.address().port,path,method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers}},res=>{
   const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const text=Buffer.concat(chunks).toString();resolve({status:res.statusCode,headers:res.headers,body:text?JSON.parse(text):null});});
  });req.on('error',reject);req.end(body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body));
 });
}
test('loopback and live-only configuration fail closed',()=>{
 assert.equal(readConfig({}).host,'127.0.0.1');
 for(const env of [{HOST:'0.0.0.0'},{PORT:'bad'},{ALLOWED_EXTENSION_ORIGINS:'https://evil.test'},{ODDSSEER_DATA_MODE:'fixture'},{ODDSSEER_SEARCH_MODE:'wrong'}])assert.throws(()=>readConfig(env));
});
test('health runs without database or model key',async t=>{
 const request=await running(t,{config:config()});const r=await request('/api/health');
 assert.equal(r.status,200);assert.equal(r.body.mode,'public');assert.equal(r.body.capabilities.comments,'unavailable');assert.equal(r.body.dataMode,'live');
});
test('Host / Origin / credentials boundaries precede service calls',async t=>{
 let called=0;const request=await running(t,{config:config(),services:{publicSearch:()=>{called++;return {results:[]};}}});
 assert.equal((await request('/api/search/quick',{method:'POST',body:{text:'test'},headers:{Host:'attacker.test'}})).status,403);
 assert.equal((await request('/api/search/quick',{method:'POST',body:{text:'test'},headers:{Origin:'https://attacker.test'}})).status,403);
 assert.equal((await request('/api/health',{headers:{Origin:'null'}})).status,403);
 assert.equal((await request('/api/health',{headers:{Authorization:'Bearer private-placeholder'}})).status,400);
 assert.equal(called,0);
 const preflight=await request('/api/search/quick',{method:'OPTIONS',headers:{Origin:origin}});assert.equal(preflight.status,204);assert.equal(preflight.headers['access-control-allow-origin'],origin);
});
test('invalid inputs and overlarge bodies are rejected before upstream',async t=>{
 let called=0;const request=await running(t,{config:config(),services:{publicSearch:()=>{called++;}}});
 for(const body of [{text:''},{text:'x',limit:-1},{text:'x',limit:1.5},{text:'x',source:"x' OR 1=1"},{text:'x'.repeat(2001)}])assert.equal((await request('/api/search/quick',{method:'POST',body})).status,400);
 assert.equal((await request('/api/search/quick',{method:'POST',body:'{'})).status,400);
 assert.equal((await request('/api/search/quick',{method:'POST',body:{text:'x'.repeat(66000)}})).status,413);
 assert.equal((await request('/api/search/quick',{method:'POST',body:'{}',headers:{'Content-Type':'text/plain'}})).status,415);
 assert.equal((await request('/api/polymarket/timeline/https%3A%2F%2Fevil.test')).status,400);
 assert.equal((await request('/api/polymarket/timeline/abc?tokenId=../evil')).status,400);assert.equal(called,0);
});
test('quick and batch return actual service contracts without fixture substitution',async t=>{
 const calls=[];const request=await running(t,{config:config(),services:{publicSearch:async(text)=>{calls.push(text);return {results:[{id:'event',title:text}],metadata:{stage:'public_keyword',dataMode:'live'}};}}});
 const quick=await request('/api/search/quick',{method:'POST',body:{text:'election'}});assert.equal(quick.body.results[0].title,'election');
 const batch=await request('/api/search/quick-batch',{method:'POST',body:{blocks:[{id:8,text:'one'},{id:9,text:'two'}]}});assert.deepEqual(batch.body.blockResults.map(x=>x.blockId),[8,9]);assert.equal(batch.body.metadata.stage,'public_keyword');
 assert.equal((await request('/api/search/quick-batch',{method:'POST',body:{blocks:[{id:1,text:'a'},{id:1,text:'b'}]}})).status,400);
 assert.deepEqual(calls,['election','one','two']);
});
test('both public upstream failures produce 502 with no mock success',async t=>{
 const publicSearch=createPublicSearch({json:async()=>{throw new Error('secret upstream response');}});
 const request=await running(t,{config:config(),services:{publicSearch}});const r=await request('/api/search/quick',{method:'POST',body:{text:'election'}});
 assert.equal(r.status,502);assert.equal(r.body.success,false);assert.ok(!JSON.stringify(r).includes('secret upstream'));assert.ok(!JSON.stringify(r).includes('fixture'));
});
test('public adapter maps real envelopes, reports partials and caches Kalshi only',async()=>{
 const counts={gamma:0,kalshi:0};const search=createPublicSearch({json:async url=>{
 if(url.includes('public-search')){counts.gamma++;return {events:[{id:1,slug:'election',title:'Election',markets:[{conditionId:'c',outcomePrices:'["0","1"]'}]}]};}
 counts.kalshi++;return {events:[{event_ticker:'ELECT',title:'Election',markets:[{ticker:'ELECT-A',yes_ask:30,no_ask:70}]}]};
 }});
 const first=await search('election');await search('election');assert.equal(first.results.length,2);assert.equal(first.results[0].yesPrice,0);assert.equal(first.results[1].yesPrice,.3);assert.deepEqual(counts,{gamma:2,kalshi:1});
 const partial=await createPublicSearch({json:async url=>{if(url.includes('public-search'))throw Error();return {events:[]};}})('x');assert.equal(partial.metadata.partial,true);
 assert.equal(mapGamma({slug:'../evil'}),null);assert.equal(mapKalshi({event_ticker:'../evil'}),null);
});
test('no model key gives explicit 503; paid calls require exact configured Origin',async t=>{
 let called=0;const noKey=await running(t,{config:config(),services:{comments:()=>{called++;}}});
 assert.equal((await noKey('/api/polymarket/analyze-comments',{method:'POST',body:{}})).body.code,'llm_not_configured');
 const withKey=await running(t,{config:config({llmConfigured:true}),services:{comments:async input=>{called++;assert.equal(input.language,'zh');assert.equal(input.model,undefined);return {summary:'summary',keyArguments:[],stats:{bullishRate:.5}};}}});
 const body={eventId:'e',eventTitle:'event',comments:[{body:'public comment',daysAgo:2}],outcomes:['Yes','No'],language:'zh',model:'attacker-model'};
 assert.equal((await withKey('/api/polymarket/analyze-comments',{method:'POST',body})).status,403);
 const response=await withKey('/api/polymarket/analyze-comments',{method:'POST',body,headers:{Origin:origin}});assert.equal(response.status,200);assert.equal(response.body.data.summary,'summary');assert.equal(called,1);
});
test('hybrid is explicit, unavailable without DB and never paid for no-Origin requests',async t=>{
 const missing=await running(t,{config:config({searchMode:'hybrid'})});assert.equal((await missing('/api/search/quick',{method:'POST',body:{text:'x'}})).status,503);
 const permissions=[];const request=await running(t,{config:config({searchMode:'hybrid',databaseConfigured:true}),services:{hybridSearch:async(text,opts)=>{permissions.push(opts.allowPaid);return {results:[],metadata:{stage:'quick'}};}}});
 await request('/api/search/quick',{method:'POST',body:{text:'x'}});await request('/api/search/quick',{method:'POST',body:{text:'x'},headers:{Origin:origin}});assert.deepEqual(permissions,[false,true]);
});
test('timeline keeps response envelope and validation',async t=>{
 const request=await running(t,{config:config(),services:{timeline:async(id,title,options)=>({market:{conditionId:id,title},events:[{title:'news'}],summary:{period:options.period},priceData:[]})}});
 const r=await request('/api/polymarket/timeline/abc?title=Event&period=24h');assert.equal(r.status,200);assert.equal(r.body.data.events[0].title,'news');assert.equal(r.body.data.summary.period,'24h');
});
test('rate and concurrency bounds refuse additional work',async t=>{
 const rate=await running(t,{config:config({requestsPerMinute:1}),services:{publicSearch:async()=>({results:[]})},now:()=>1});
 await rate('/api/search/quick',{method:'POST',body:{text:'x'}});assert.equal((await rate('/api/search/quick',{method:'POST',body:{text:'x'}})).status,429);
 let release,started;const ready=new Promise(resolve=>{started=resolve;});const hold=new Promise(resolve=>{release=resolve;});
 const concurrent=await running(t,{config:config({maxConcurrent:1}),services:{publicSearch:async()=>{started();await hold;return {results:[]};}}});
 const first=concurrent('/api/search/quick',{method:'POST',body:{text:'x'}});await ready;assert.equal((await concurrent('/api/search/quick',{method:'POST',body:{text:'x'}})).status,503);release();await first;
});
test('SQL values stay in bind parameters; invalid sources and vectors rejected',()=>{
 const injection="x' OR 1=1 --";
 const vector=buildVectorSearchQuery([.1,.2],{category:injection});assert.ok(!vector.sql.includes(injection));assert.ok(vector.params.includes(injection));assert.match(vector.sql,/\$1::vector/);
 assert.throws(()=>buildVectorSearchQuery([NaN]));assert.throws(()=>buildVectorSearchQuery([.1],{source:injection}));
 const fallback=buildFallbackSearchQuery([injection,'%_']);assert.ok(!fallback.sql.includes(injection));assert.ok(fallback.params.includes('%\\%\\_%'));
 const bm25=buildBm25SearchQuery(['election','news'],{source:'KALSHI'});assert.ok(bm25.params.includes('election | news'));assert.ok(!bm25.sql.includes('KALSHI'));
});
test('bounded upstream enforces streamed bytes and timeout without disclosing errors',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async()=>new Response('123456');await assert.rejects(()=>boundedFetch('https://fixed.test',{maxBytes:3}),/too large/);
 globalThis.fetch=async(url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
 // Keep test runner alive while AbortSignal timeout's unref timer is pending.
 const keep=setTimeout(()=>{},100);try {await assert.rejects(()=>boundedFetch('https://fixed.test',{timeoutMs:5}),e=>e.code==='upstream_timeout');}finally{clearTimeout(keep);}
});

test('unparseable model output is a 502, never a neutral successful analysis',async t=>{
 const request=await running(t,{config:config({llmConfigured:true}),services:{comments:async()=>({analysisStatus:'parse_failed',summary:'fallback',keyArguments:[]})}});
 const r=await request('/api/polymarket/analyze-comments',{method:'POST',headers:{Origin:origin},body:{eventId:'e',eventTitle:'event',comments:[],outcomes:['Yes','No']}});
 assert.equal(r.status,502);assert.equal(r.body.success,false);
});

test('no-cors image and navigation requests cannot consume local upstream capacity',async t=>{
 let calls=0;const request=await running(t,{config:config(),services:{timeline:async()=>{calls++;return {events:[]};}}});
 for(const mode of ['no-cors','navigate'])assert.equal((await request('/api/polymarket/timeline/abc',{headers:{'Sec-Fetch-Mode':mode}})).status,403);
 assert.equal(calls,0);
 assert.equal((await request('/api/health')).body.capabilities.newsSummary,'unavailable');
});
test('generic English stop words do not match every Kalshi event',async()=>{
 const search=createPublicSearch({json:async url=>url.includes('public-search')?{events:[]}:{events:[{event_ticker:'NOISE',title:'Will the team win?',markets:[]}]}});
 assert.equal((await search('Will the Bitcoin rise?')).results.length,0);
});

test('comment count is limited to the model prompt capacity before any paid invocation', async t => {
 let called=0;
 const request=await running(t,{config:config({llmConfigured:true}),services:{comments:async()=>{called++;return {summary:'ok',keyArguments:[]};}}});
 const body={eventId:'e',eventTitle:'event',outcomes:['Yes','No'],comments:Array.from({length:21},()=>({body:'public comment'}))};
 assert.equal((await request('/api/polymarket/analyze-comments',{method:'POST',body,headers:{Origin:origin}})).status,400);
 assert.equal(called,0);
 body.comments.pop();
 assert.equal((await request('/api/polymarket/analyze-comments',{method:'POST',body,headers:{Origin:origin}})).status,200);
 assert.equal(called,1);
});
