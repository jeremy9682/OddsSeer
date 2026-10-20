# Source review

Initial public release review covers the independent extension, optional loopback server, examples, tests, documentation, dependency locks and shipped icons. It excludes the former host application, historical Git data, real environment files, user/account/payment data, local model sessions and browser profiles.

Independent model-assisted review is part of preparation; it is not a security certification. The first full Claude Opus 5.5 review found an RSS-source tooltip injection bug, incomplete lockfile integrity/platform metadata and release-documentation gaps. Those findings were treated as release blockers and corrected before the next review.

Corrections include escaping chart source/icon text and backend market identifiers/labels, numeric volume validation, avoiding CSS selector interpolation, checking runtime-message sender identity, encoding upstream URL parameters, moving toolbar position from site localStorage to extension storage, and disabling embeddings in the example configuration. Unused account/payment views and large unused logo originals were excluded. MIT and dependency attribution were added.

Tests include malicious source/icon markup and malformed backend values; three cases failed on the prior source and passed after remediation. The exact final publication decision is made after independent follow-up and a separate DeepSeek full-source review, followed by final-tree scanning. Raw local review conversations are not distributed.

Deliberate choices: clean history; only the necessary backend; no wallet/funds operations; honest unavailable data; documented native-browser testing deferral. Dependency findings are accepted only within the documented source/loopback boundary in [verification](VERIFICATION.md).

DeepSeek’s complete review identified two misleading UI states: a market-card AI label only opened the side panel, and hybrid mode looked connected despite unavailable search. The button now displays `OddsSeer ↗` with the title `Open in OddsSeer`, and status uses the reported search capability. Its additional findings led to a 20-comment HTTP cap before any model call, escaped timeline counts, removal of unused Pro labels, and explicit automatic-model-call/cost disclosure in both READMEs and the local-mode panel. These final corrections are checked independently before publication.

## Initial source-release decision — 2026-10-20

Both named independent reviewers completed a full-source audit and subsequent targeted verification of the corrections. Isolated Claude Opus 5.5 and DeepSeek (official provider, deepseek-flash) each returned **SOURCE RELEASE READY** for the final candidate. No outstanding release-blocking source findings remained. This is a model-assisted review result, not a security guarantee.

The release operator separately verified 27 extension tests and 21 server tests, typecheck, a clean dependency installation and build. All 18 generated build files matched between the primary and clean build. The selected tree contains 120 files (108 text files and 12 icons); custom secret scanning and Gitleaks found no leaks. Dependency advisories and deferred native-browser acceptance remain documented in [verification](VERIFICATION.md).

After both reviews, this factual decision receipt and the button-label clarification were the only source-tree changes; executable code and dependency locks remained unchanged. Only the reviewed independent project is published with new Git history.
