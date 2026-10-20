# Project scope

OddsSeer is an independent browser extension that adds prediction-market context to ordinary webpages. Its optional loopback backend preserves public search and separately configured enhanced analysis.

The initial public source release uses clean Git history. Production configuration, private keys, user/account/payment data, browser state, old repository history and operator transcripts are excluded. Example environment values are placeholders; model keys belong only on the server.

Deliberate choices: retain the necessary backend and original search algorithms; exclude the former web workbench and money operations; expose unavailable upstreams honestly; exclude unused legacy account/payment source. Native browser acceptance is deferred and explicitly disclosed. No deposits, trades, production database connections or paid models were used in validation.

Release checks require two independent source reviews, a final-file privacy scan, reproducible build/typecheck/offline tests and documented dependency limitations. Source publication is distinct from Chrome Web Store distribution or public-network backend deployment.
