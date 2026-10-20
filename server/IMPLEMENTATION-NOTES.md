# Implementation notes

The standalone server retains query understanding, vector/FTS retrieval, RRF, reranking, embeddings, timeline price/news matching, anomaly detection and comment classifications/Wilson/velocity. Its market-only schema excludes user, account, payment and query-log tables.

Public keyword mode needs no database/model credentials. Hybrid services and model-based comment analysis require separate configuration and are not production-validated. Exact allowed extension origins are required for paid HTTP calls. If Chrome omits Origin, those calls intentionally remain unavailable.

See [verification](../docs/VERIFICATION.md) for tests, dependency findings and limits. This source release does not approve public-network backend deployment.
