# OddsSeer local server

Node.js 22.18+; independent ESM service, bound only to `127.0.0.1:8787`. No account, wallet, transaction, recharge, credits or financial scheduler is included. No fixture mode is offered; default search uses live public data.

## Run

```sh
npm ci
cp .env.example .env
# Set ALLOWED_EXTENSION_ORIGINS=chrome-extension://<installed-extension-id>
node --env-file=.env src/index.js
```

`npm start` reads process environment; it does not automatically load `.env`. `GET /api/health` reports `mode`, `dataMode` and capabilities. Configured means the adapter is enabled, not that an upstream probe has succeeded. No external health probe runs at startup. Defaults need no database and no model key. Requests bearing Origin require an exact configured extension origin. No-Origin local clients can read public APIs; no-Origin requests cannot run paid comment analysis or paid hybrid embedding/query understanding. Some Chrome service-worker versions omit Origin: in that case paid features remain unavailable; do not weaken the Origin rule to enable them. Browser installation must verify this behavior.

## Retained functionality

- `POST /api/search/quick`: `{text,limit?}` → `{success,results,metadata}`. Default stage `public_keyword` calls Gamma public-search and a five-minute cache of the first 100 open Kalshi events. Kalshi coverage is explicitly partial. This is not semantic or exhaustive search. Both upstreams failing returns 502; one failure returns live results plus `metadata.partial` and source status.
- `POST /api/search/quick-batch`: `{blocks:[{id,text}],limit?}` → `{success,blockResults,metadata}`. At most eight blocks; duplicate IDs are rejected.
- `GET /api/polymarket/timeline/:id?title=...&period=7d&tokenId=...`: original CLOB candles (the retained Dome fallback is disabled), Google News RSS parsing, Z-score anomaly detection and news/event matching. The response retains `{success,data:{events,priceData,anomalies,priceAnalysis,summary,...}}`; capabilities describe available sources. Both news and price data failing returns 502. No promise of upstream availability is made.
- `POST /api/polymarket/analyze-comments`: original comment prompt/parser, option classifications, Wilson confidence interval and discussion velocity. Requires `OPENROUTER_API_KEY` on the server and an exact allowlisted Origin; otherwise 503/403. Client model/key fields are ignored. Comments are public event comments sent by the extension; LLM calls incur provider usage. When page enhancement is enabled, opening a supported market page can automatically send up to 20 public comments (including usernames) to the configured model and incur charges; no separate analysis click is required. Leave the key unset or disable page enhancement to opt out. `OPENROUTER_COMMENT_MODEL` selects the model; default is `deepseek/deepseek-chat`. No model key is returned to the browser.

Search text and public comments are sent to the selected upstreams as needed. They are not written to a query-log table or printed by algorithm services. In-memory caches exist. Malformed model classifications or output return HTTP 502; a neutral placeholder is never returned as successful analysis. Automated tests use injected local fixtures, never silently substitute fixtures in the running service.

## Original hybrid search (optional)

The original query understanding, pgvector retrieval, PostgreSQL full-text retrieval, RRF fusion, Cohere reranking, deduplication and embedding code remains under `src/services/search`. `ODDSSEER_SEARCH_MODE=hybrid` selects it explicitly. It needs a separate PostgreSQL database with `vector` and `pg_trgm`, plus a generated Prisma client and initialized market data. It does not load in public mode.

```sh
npm run db:generate
# After setting a NEW dedicated DATABASE_URL in the process environment:
npm run db:migrate
npm run sync
# Optional PAID operation; set embedding provider/key first:
npm run embeddings
ODDSSEER_SEARCH_MODE=hybrid npm start
```

For `.env` loading with these commands, export the variables or invoke `node --env-file=.env src/cli.js sync` / `embeddings`. Migration/generate commands use Prisma's environment behavior. The schema contains only MarketEvent; the clean baseline migration additionally creates vector(1536), HNSW, full-text and trigram indexes. Do not replace it with schema-only table creation. `SearchLog` and legacy account migrations are excluded. `npm run sync` and `embeddings` are explicit operator commands; the HTTP server starts no scheduler. Sync consumes public data and writes this database. Embedding generation can incur charges. Verify coverage before calling hybrid search operational.

Embedding is disabled by default (`EMBEDDING_PROVIDER=none`). Explicitly setting `EMBEDDING_PROVIDER=openrouter` selects `openai/text-embedding-3-small`, 1536 dimensions, and permits provider charges on the configured paid paths. `EMBEDDING_PROVIDER=openai` uses `OPENAI_API_KEY`; query understanding still needs OpenRouter. Cohere is optional and falls back to RRF. A configured extension origin is required for paid hybrid stages; no-Origin clients use only the database lexical stage. Database availability and actual semantic quality require a separately authorized DB/provider validation; offline tests do not prove them.

## Boundaries and tests

Host is checked against localhost/127.0.0.1 with the actual port; Origin is checked before work. No wallet/Authorization header is accepted. JSON bodies are limited to 64 KiB; text blocks to 2,000 characters; requests to 60/minute and eight concurrent operations per process. Comments: at most 20, each at most 2,000 characters; at most 50 outcomes. Upstreams have an eight-second fetch timeout and a 2 MiB streamed-body cap; redirects are rejected. API URLs are built from fixed upstream templates. OpenRouter configuration is trusted operator environment only, axios redirects are disabled and response size/time are bounded. Secrets never belong in `VITE_*` settings.

`npm test` exercises real local HTTP handling with injected upstream fixtures: Host/Origin, payload/parameter validation, rate/concurrency, fail-closed model configuration, contracts, public upstream failure/partial behavior, parameterized SQL builders and streamed response limits. It uses neither a live DB nor a paid model.

Dependency versions are pinned. Axios was updated from 1.12.2 to 1.20.0 during extraction. Prisma stays at 6.19.0 to preserve the existing schema/client contract; any remaining dependency audit findings are recorded in [verification](../docs/VERIFICATION.md). No Prisma 7 migration was attempted. This server is prepared for local use, not approved for public-network hosting.
