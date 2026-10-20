import { createApp, readConfig } from './app.js';
const config=readConfig();
const app=createApp({config});
app.listen(config.port,config.host,()=>console.log(`OddsSeer listening at http://${config.host}:${app.address().port} (${config.searchMode}, live)`));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>app.close(()=>process.exit(0)));
