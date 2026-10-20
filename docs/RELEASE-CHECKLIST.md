# Source release checklist

1. Review the exact selected source and assets independently; exclude real environment files, databases, logs, wallet material, browser profiles and old Git history.
2. Reproduce dependency installation, typecheck, build and tests. Document any unresolved dependency findings and their affected execution paths.
3. Check README claims against evidence. Native Chrome loading and cross-site tests are not yet complete for the initial source release; do not call it browser-accepted or a Chrome Web Store release.
4. Preserve MIT and third-party notices. Publish only the reviewed Git tree with new history; do not include private operator transcripts.
5. Verify the public repository, its exact commit and visible documentation after pushing.

Future binary/store distribution requires actual installation and cross-site verification plus review of the distributed bundle and its third-party notices. Any future deposits/trading integration is a separate feature with user-controlled wallet signing and its own review; no private keys belong in this repository.
