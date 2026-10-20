# Source selection

| Source from the former host project | Destination | Treatment |
|---|---|---|
| `extension/` content modules, worker, side panel, icons | `extension/` | Preserved and adapted for standalone use |
| Privy/upgrade/profile hooks and unmounted side-panel tabs | Not copied | Unused account/payment and unmounted views excluded from public source |
| search services and search config | `server/src/services/search`, `server/src/config` | Original algorithms retained; independent configuration and bounded inputs |
| timeline, free-data and comment-analysis services | `server/src/services/polymarket` | Retained, adapted to bounded upstream calls |
| model adapter | `server/src/services/ai` | Server-only provider credentials |
| MarketEvent model/search SQL | `server/prisma` | Independent market-only schema; no users or payments |
| original secrets module | Not copied | Replaced with a minimal server-side provider-key getter |
| original web app and backend bootstrap | Not copied | Not required by extension call graph |
| trading, wallet, deposits, credits, account data | Not copied | No dependency from the currently mounted extension flows |
| old Git history, env files, deployment credentials, logs | Not copied | New repository boundary |

Historical code origin is acknowledged without preserving old operational configuration. Code retention does not mean an optional external service has been exercised with production credentials.
