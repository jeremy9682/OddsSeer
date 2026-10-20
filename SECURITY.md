# Security and privacy boundaries

The shipped extension is read-only with respect to money: there are no wallet signing, custody, funding, order execution or billing endpoints. The necessary backend was selected from actual extension calls rather than copying the old application's server bootstrap.

- New Git history; no previous repository history, production env, wallet data or user tables.
- Extension permissions: storage, sidePanel, activeTab, contextMenus, notifications, alarms. Content scripts run on ordinary HTTP(S) pages. Network hosts are the configured backend origin plus Gamma, CLOB, Polymarket data API and Kalshi public API.
- No Privy runtime or identity permission. Unused legacy account/payment examples are excluded from the public source tree.
- Server binds loopback, validates Host/Origin and bounds payloads, requests and upstream time. Provider-costing actions require explicit configuration.
- No production credentials are included. Secret scanning is heuristic and does not replace reviewing every file selected for publication or rotating previously exposed credentials.
- Original remote repositories and their history are outside this extracted repository. Creating a clean repository does not revoke a key that was once exposed elsewhere.
- Raw query analytics and original user/credit/funding tables are not migrated.

Do not publish `.env`, local databases, profiles, logs, source research notes or unreviewed build artifacts. Review exact Git contents and dependency findings for every release. See [verification](docs/VERIFICATION.md) for the initial source-release boundary, including deferred browser testing.

## Reporting vulnerabilities

Use GitHub's private vulnerability reporting for this repository when enabled. Do not put secrets, exploit credentials or personal data in a public issue. If private reporting is unavailable, open an issue requesting a private contact without including sensitive details.
