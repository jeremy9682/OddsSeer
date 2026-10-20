# Architecture

```
Ordinary web page
  ↕ content script (isolated Shadow DOM UI)
Chrome background service worker
  ├─ public Gamma / Kalshi / CLOB / Polymarket data reads
  ├─ local browser storage, alarms and notifications
  ├─ React side panel (no account prerequisite)
  └─ independent loopback server
       ├─ public keyword search (default)
       ├─ news / price timeline
       ├─ optional server-side comment LLM
       └─ optional original PostgreSQL hybrid search + explicit import/embedding commands
```

`extension/` is copied from the original extension and no longer resolves any parent `src/` aliases or Tailwind paths. WXT is the single owner of the content-script manifest entry. The same public backend environment value drives the runtime URL and host permission.

`server/` retains the original non-financial algorithms and exposes a new bounded HTTP surface. It does not import the original server bootstrap, trading controllers, deposit scanners, wallet secrets or account models. Default public search is a deliberately lighter operating mode; it is not marketed as the original semantic search. Enhanced search requires a new database and populated corpus. Provider failures never justify silently replacing live results with fixtures.

Unused commercial/authentication examples and unmounted legacy tabs are excluded from the public tree. Accounts, funding and trading require a separate implementation and review.

Current visible UI is My Markets / Local Account / Settings plus page tools. Previously unmounted Analysis/Markets/Monitors tabs are excluded. Unsupported old message handlers fail explicitly instead of returning fake trading advice or smart-money numbers.

Browser installation and external-provider acceptance are separate from compilation. See VERIFICATION.md for actual evidence.
