// Explicit operator commands only; importing the HTTP application starts no jobs.
const command=process.argv[2];
if(!['sync','embeddings'].includes(command)) throw new Error('Usage: node src/cli.js sync|embeddings');
if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if(command==='embeddings'&&!process.env.OPENROUTER_API_KEY&&!process.env.OPENAI_API_KEY) throw new Error('Embedding provider key is required');
const {default:prisma}=await import('./lib/prisma.js');
try {
  let result;
  if(command==='sync') {const {runMarketSync}=await import('./jobs/market-sync.job.js');result=await runMarketSync();}
  else {const {runEmbeddingJob}=await import('./services/search/embedding.service.js');result=await runEmbeddingJob();}
  const errors=Array.isArray(result.errors)?result.errors.length:Number(result.errors)||0;
  console.log(JSON.stringify({command,errors,processed:result.processed,queueRemaining:result.queueRemaining,polymarketNew:result.polymarketNew,kalshiNew:result.kalshiNew}));
  if(errors) process.exitCode=1;
} catch {console.error(`${command} failed; check configuration and database availability.`);process.exitCode=1;}
finally {await prisma.$disconnect();}
