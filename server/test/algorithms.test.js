import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAnalysisResponse, calculateWilsonScore, calculateVelocity, buildCommentAnalysisCacheKey } from '../src/services/polymarket/comment-analysis.service.js';
import { getTimelineData } from '../src/services/polymarket/timeline.service.js';
import { toSafeErrorMessage } from '../src/services/ai/openrouter.service.js';
const comments=[{id:'a',body:'first',daysAgo:0},{id:'b',body:'second',daysAgo:1},{id:'c',body:'third',daysAgo:7}];
test('original sentiment parser computes Wilson and velocity from bounded classifications',()=>{
 const data=parseAnalysisResponse(JSON.stringify({summary:'A split sample',commentClassifications:[{id:1,sentiment:'bullish'},{id:2,sentiment:'bullish'},{id:3,sentiment:'bearish'}],keyArguments:[]}),comments,'en',['Yes','No']);
 assert.equal(data.analysisStatus,'ok');assert.equal(data.stats.bullishCount,2);assert.equal(data.stats.bearishCount,1);assert.equal(data.stats.bullishRate,2/3);
 assert.deepEqual(data.stats.velocity,calculateVelocity(comments));assert.equal(data.stats.wilsonLower,calculateWilsonScore(2,3).lower);
 assert.ok(data.stats.wilsonLower>=0&&data.stats.wilsonUpper<=1);
});
test('malformed, duplicate or invented classifications cannot manufacture successful statistics',()=>{
 for(const content of ['not json','{}',JSON.stringify({summary:'fake',commentClassifications:[{id:1,sentiment:'bullish'},{id:1,sentiment:'bullish'},{id:3,sentiment:'bullish'}]}),JSON.stringify({summary:'fake',commentClassifications:[{id:1,sentiment:'bullish'}]})])assert.equal(parseAnalysisResponse(content,comments,'en',['Yes','No']).analysisStatus,'parse_failed');
 const multi=parseAnalysisResponse(JSON.stringify({summary:'bad',commentClassifications:[{id:1,favoredOption:'__proto__'},{id:2,favoredOption:null},{id:3,favoredOption:null}]}),comments,'en',['A','B','C']);assert.equal(multi.analysisStatus,'parse_failed');
});
test('cache keys separate language, content and options; provider error bodies stay private',()=>{
 const base={eventId:'e',eventTitle:'title',comments,outcomes:['Yes','No'],language:'en'};
 assert.notEqual(buildCommentAnalysisCacheKey(base),buildCommentAnalysisCacheKey({...base,language:'zh'}));
 assert.notEqual(buildCommentAnalysisCacheKey(base),buildCommentAnalysisCacheKey({...base,comments:[{...comments[0],body:'changed'},...comments.slice(1)]}));
 assert.equal(toSafeErrorMessage({response:{status:401,data:{error:{message:'credential-in-provider-error'}}}}),'Model provider HTTP 401');
});
test('original timeline retains RSS news and real price transformation with bounded fixture transport',async t=>{
 const previous=globalThis.fetch;t.after(()=>{globalThis.fetch=previous;});
 const now=Math.floor(Date.now()/1000);
 globalThis.fetch=async url=>{
  if(String(url).includes('news.google.com')) return new Response(`<rss><channel><item><title>Event wins - Source</title><link>https://example.test/news</link><pubDate>${new Date().toUTCString()}</pubDate><description>News</description></item></channel></rss>`);
  if(String(url).includes('clob.polymarket.com'))return Response.json({history:[{t:now-3600,p:.4},{t:now,p:.6}]});
  return new Response('unavailable',{status:503});
 };
 const data=await getTimelineData('condition','Event',{period:'24h',tokenId:'123'});
 assert.equal(data.priceData.length,2);assert.equal(data.priceData[1].close,.6);assert.equal(data.priceAnalysis.currentPrice,.6);assert.equal(data.capabilities.events,'available');assert.equal(data.summary.period,'24h');assert.ok(Array.isArray(data.events));
 globalThis.fetch=async()=>{throw Error('offline');};
 await assert.rejects(()=>getTimelineData('condition','Event',{period:'24h',tokenId:'123'}),/unavailable/);
});
