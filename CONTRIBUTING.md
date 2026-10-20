# Contributing

Use Node.js 22.18+ and install dependencies separately in `extension/` and `server/` with `npm ci`. See the root README for build and validation commands.

Keep browser code independent of the former web app. Provider credentials belong only in ignored server configuration. Never add wallet material, account databases, real user browser state or production env files as test fixtures.

Tests should exercise behavior with explicit fixtures and distinguish local mocks from real public-service checks. Browser interaction claims require an installed extension and observable results. Do not represent missing providers as fabricated live results.

Review backend contracts when changing message payloads, storage behavior or API response envelopes. Preserve explicit optional-service boundaries and document any changed capability.
