import http from 'node:http';
import { createPublicSearch } from './public-search.js';
class HttpError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
const fail = (status, code) => { throw new HttpError(status, code); };
const isExtension = origin => /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
export function readConfig(env = process.env) {
  const port = Number(env.PORT || 8787);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT');
  if (env.HOST && env.HOST !== '127.0.0.1') throw new Error('Only loopback HOST=127.0.0.1 is supported');
  const origins = new Set((env.ALLOWED_EXTENSION_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean));
  if ([...origins].some(o => !isExtension(o))) throw new Error('Invalid extension origin allowlist');
  const searchMode = env.ODDSSEER_SEARCH_MODE || 'public';
  if (!['public', 'hybrid'].includes(searchMode)) throw new Error('Invalid search mode');
  if (env.ODDSSEER_DATA_MODE && env.ODDSSEER_DATA_MODE !== 'live') throw new Error('Only live data mode is supported');
  return { host: '127.0.0.1', port, origins, searchMode, maxBody: 65536, maxConcurrent: 8, requestsPerMinute: 60,
    databaseConfigured: Boolean(env.DATABASE_URL), llmConfigured: Boolean(env.OPENROUTER_API_KEY?.trim()) };
}
function string(value, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(400, 'invalid_input');
  return value.trim();
}
function searchInput(body) {
  const text = string(body.text, 2000);
  const limit = body.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20 || (body.source && !['POLYMARKET','KALSHI'].includes(body.source))) fail(400,'invalid_input');
  return { text, limit, source: body.source || null };
}
async function readBody(req, max) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) fail(415,'json_required');
  if (Number(req.headers['content-length']) > max) fail(413,'body_too_large');
  const chunks=[]; let size=0;
  for await (const chunk of req) { size+=chunk.length; if(size>max) fail(413,'body_too_large'); chunks.push(chunk); }
  let body; try { body=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400,'invalid_json'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400,'invalid_input');
  return body;
}
export function createApp({ config = readConfig(), services = {}, now = Date.now } = {}) {
  const publicSearch = services.publicSearch || createPublicSearch();
  let active=0, tokens=config.requestsPerMinute, last=now();
  async function search(body, paidAllowed) {
    const { text, limit, source } = searchInput(body);
    if(config.searchMode === 'public') return publicSearch(text,{limit});
    if(!config.databaseConfigured) fail(503,'hybrid_not_configured');
    // Hybrid may call paid embedding and query-understanding APIs. An exact
    // configured extension origin is required for those calls, even on loopback.
    const fn = services.hybridSearch || (await import('./services/search/index.js')).quickSearch;
    const result = await fn(text,{limit,source,allowPaid:paidAllowed,fallbackToSemantic:paidAllowed});
    if(result.metadata?.error || result.success === false) fail(502,'hybrid_search_failed');
    return {...result,metadata:{...result.metadata,dataMode:'live',searchMode:'hybrid',paidCallsAllowed:paidAllowed}};
  }
  const server = http.createServer(async(req,res)=>{
    const send=(status,value)=>{ if(!res.writableEnded) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(value)); } };
    let counted=false;
    try {
      const port=server.address()?.port || config.port;
      if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)) fail(403,'host_forbidden');
      const origin=req.headers.origin;
      const allowed=typeof origin==='string' && config.origins.has(origin);
      if(origin && !allowed) fail(403,'origin_forbidden');
      if(['no-cors','navigate'].includes(req.headers['sec-fetch-mode'])) fail(403,'origin_forbidden');
      if(allowed) { res.setHeader('Access-Control-Allow-Origin',origin); res.setHeader('Vary','Origin'); }
      if(req.method==='OPTIONS') {
        if(!allowed) fail(403,'origin_forbidden');
        res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS'); res.setHeader('Access-Control-Allow-Headers','Content-Type');
        res.writeHead(204);res.end();return;
      }
      if(req.headers.authorization || req.headers['x-wallet-address']) fail(400,'credentials_not_accepted');
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET' && url.pathname==='/api/health') {
        send(200,{success:true,dataMode:'live',mode:config.searchMode,searchMode:config.searchMode,capabilities:{search:config.searchMode==='hybrid'&&!config.databaseConfigured?'unavailable':config.searchMode==='public'?'public_keyword':'hybrid',timeline:'configured',newsSummary:'unavailable',domeFallback:'unavailable',comments:config.llmConfigured&&config.origins.size?'configured':'unavailable',timelineEvents:'configured',sentiment:config.llmConfigured&&config.origins.size?'configured':'unavailable'}});return;
      }
      const current=now();tokens=Math.min(config.requestsPerMinute,tokens+(current-last)*config.requestsPerMinute/60000);last=current;
      if(tokens<1) fail(429,'rate_limited'); tokens--;
      if(active>=config.maxConcurrent) fail(503,'busy'); active++;counted=true;
      if(req.method==='POST' && url.pathname==='/api/search/quick') { const body=await readBody(req,config.maxBody);send(200,{success:true,...await search(body,allowed)});return; }
      if(req.method==='POST' && url.pathname==='/api/search/quick-batch') {
        const body=await readBody(req,config.maxBody);
        if(!Array.isArray(body.blocks)||body.blocks.length<1||body.blocks.length>8) fail(400,'invalid_blocks');
        const seen=new Set();
        for(const b of body.blocks) {
          if(!b || !(typeof b.id==='string'||Number.isInteger(b.id)) || String(b.id).length>64 || seen.has(String(b.id))) fail(400,'invalid_block_id');
          seen.add(String(b.id)); searchInput({text:b.text,limit:body.limit});
        }
        // Serial per request bounds fan-out (8 requests * at most 2 upstreams).
        const blockResults=[];for(const b of body.blocks) blockResults.push({blockId:b.id,...await search({text:b.text,limit:body.limit},allowed)});
        send(200,{success:true,blockResults,metadata:{dataMode:'live',stage:config.searchMode==='public'?'public_keyword':'hybrid'}});return;
      }
      if(req.method==='GET' && url.pathname.startsWith('/api/polymarket/timeline/')) {
        const id=decodeURIComponent(url.pathname.slice('/api/polymarket/timeline/'.length));
        if(!/^[a-zA-Z0-9_-]{1,200}$/.test(id)) fail(400,'invalid_market_id');
        const title=string(url.searchParams.get('title')||'',500,false); const period=url.searchParams.get('period')||'7d';
        const impactFilter=url.searchParams.get('impactFilter')||'all';const tokenId=url.searchParams.get('tokenId')||undefined;
        if(!['24h','7d','30d'].includes(period)||!['all','high','medium'].includes(impactFilter)||(tokenId&&!/^\d{1,100}$/.test(tokenId))) fail(400,'invalid_input');
        const fn=services.timeline || (await import('./services/polymarket/timeline.service.js')).getTimelineData;
        const data=await fn(id,title,{period,impactFilter,tokenId});send(200,{success:true,data});return;
      }
      if(req.method==='POST' && url.pathname==='/api/polymarket/analyze-comments') {
        if(!config.llmConfigured) fail(503,'llm_not_configured');
        if(!allowed) fail(403,'configured_origin_required');
        const body=await readBody(req,config.maxBody);
        const eventId=string(body.eventId,200),eventTitle=string(body.eventTitle,500);
        if(!Array.isArray(body.comments)||body.comments.length>20||!Array.isArray(body.outcomes)||body.outcomes.length>50) fail(400,'invalid_input');
        const comments=body.comments.map(c=>{ if(!c||typeof c!=='object') fail(400,'invalid_input');return { id:String(c.id||'').slice(0,100),body:string(c.body,2000,false),username:typeof c.username==='string'?c.username.slice(0,100):'Anonymous',reactionCount:Number.isFinite(c.reactionCount)?Math.max(0,c.reactionCount):0,daysAgo:Number.isFinite(c.daysAgo)?Math.max(0,c.daysAgo):0 }; });
        const outcomes=body.outcomes.map(o=>string(o,200));const language=body.language==='zh'?'zh':'en';
        const fn=services.comments || (await import('./services/polymarket/comment-analysis.service.js')).analyzeComments;
        const data=await fn({eventId,eventTitle,outcomes,comments,language});
        if(!data || data.analysisStatus === 'parse_failed' || typeof data.summary!=='string' || !Array.isArray(data.keyArguments)) fail(502,'invalid_analysis');
        send(200,{success:true,data});return;
      }
      fail(404,'not_found');
    } catch(error) { const status=error instanceof HttpError?error.status:502;send(status,{success:false,code:error instanceof HttpError?error.code:'upstream_unavailable',error:status===502?'Upstream service unavailable':error.code}); }
    finally {if(counted)active--;}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.timeout=20000;server.keepAliveTimeout=5000;
  return server;
}
