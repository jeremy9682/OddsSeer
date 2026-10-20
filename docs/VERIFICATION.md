# Verification and release boundaries

Recorded 2026-10-20. Compilation, offline fixtures and API checks do not establish native browser acceptance.

| Check | Observed result |
|---|---|
| Extension TypeScript check and Chrome MV3 build | Passed after source remediation |
| Extension behavior/security regression tests | 27 passed; mocked Chrome/DOM boundaries using real source functions |
| Server tests | 21 passed; local HTTP with injected upstream fixtures |
| Injection regression | Three new hostile-input cases failed before the fix and passed afterward |
| Clean export reproduction before the final disclosure fixes | Fresh npm ci, build/typecheck and then-current 25 extension +20 server tests passed; Linux x64 dependencies installed with scripts disabled, not a Linux runtime build |
| Public search API check | Local server health200; real Bitcoin search200 with Gamma/Kalshi results |
| Source/build secret patterns | No recognized private-key/API-key/credential-URL value found; heuristic evidence only |
| Native Chrome installation and cross-site interaction | **Not verified**; deferred for this initial source publication |
| Production DB, paid models, wallets and funds | Not used |
| License | MIT; dependency licenses remain separate |

The lockfiles use registry.npmjs.org, contain integrity hashes for all dependency entries and include esbuild platform binaries. The extension's previously tested dependency versions were preserved while repairing metadata. This is not evidence of a Linux/Windows runtime build; cross-platform native checks remain follow-up work.

## Dependency findings and disposition

Official npm audit reports are retained at [extension](../extension/dependency-audit.json) and [server](../server/dependency-audit.json). They reported 7 extension findings (5 high, 2 moderate) and 4 server findings (high), none critical. These are known limitations, not a claim of a clean dependency audit.

- Tailwind3's braces/glob chain handles repository-controlled build patterns. The [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) describes stack exhaustion from deeply nested patterns. Those packages are not browser runtime code. Build only trusted source/configuration; a Tailwind4 migration remains separate work.
- [postcss-selector-parser](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) can consume excessive CPU when parsing hostile selectors. This project uses it on its own build-time CSS, not webpage selectors in the runtime extension. An upstream-compatible parser/toolchain update remains follow-up work.
- Prisma6's config chain includes [deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) and [Effect](https://github.com/advisories/GHSA-38f7-945m-qr2g). The former issue requires recursive object graphs; the latter concerns concurrent Effect fiber request contexts. The default public server does not import Prisma, its HTTP handlers do not import Prisma CLI/config or Effect RPC, and no endpoint merges user-supplied config graphs. This source-only, loopback scope accepts the remaining reports while preserving Prisma6 schema/client compatibility. Do not use this as approval for public-network hosting.

`npm audit --omit=dev` reported zero extension findings but still 4 server findings: Prisma may remain in the installed dependency graph through @prisma/client's optional peer. Calling it “development tooling” describes the affected call path, not proof that npm omits the packages. Do not claim that a production install is audit-clean.

Dependency installation executes WXT/esbuild and Prisma package lifecycle scripts. For dependency inspection without executing them, use `npm ci --ignore-scripts`; this is an inspection mode, not a guaranteed runnable setup. Normal build and optional Prisma client generation require their documented preparation steps.

## Functional and visual limits

Default search is public keyword retrieval, not multilingual semantic retrieval. Kalshi public mode covers only the first 100 open events and reports that coverage. Hybrid retrieval needs a populated pgvector database. Paid HTTP features require server keys and an allowlisted extension Origin; missing Origin cannot enable them. Timeline source availability varies.

Security changes preserve existing layout and typography. Native visual, keyboard, motion and cross-site acceptance remain unverified. Existing compact labels need a future visual review. This source publication does not approve a Chrome Web Store binary or a publicly hosted backend.
