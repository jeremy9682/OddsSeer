/**
 * Parameterized SQL builders for the hybrid retrieval stage.
 *
 * The original retrieval.service.js interpolated status/source/category,
 * keywords and the vector literal directly into $queryRawUnsafe strings. These
 * builders keep the same SELECT/WHERE/ORDER shape but return
 * { sql, params } with PostgreSQL positional placeholders so every
 * caller-influenced value is bound. They are pure so they can be tested
 * without a database.
 */

export const ALLOWED_STATUSES = Object.freeze(['ACTIVE', 'CLOSED', 'RESOLVED']);
export const ALLOWED_SOURCES = Object.freeze(['POLYMARKET', 'KALSHI']);

const SELECT_COLUMNS = `
        id,
        external_id as "externalId",
        source,
        title,
        description,
        category,
        status,
        yes_price as "yesPrice",
        no_price as "noPrice",
        volume,
        liquidity,
        end_date as "endDate",
        url`;

function normalizeStatus(status) {
  const value = status == null ? 'ACTIVE' : String(status).toUpperCase();
  if (!ALLOWED_STATUSES.includes(value)) {
    throw new RangeError(`Invalid status filter: ${String(status).slice(0, 32)}`);
  }
  return value;
}

function normalizeSource(source) {
  if (source == null || source === '') return null;
  const value = String(source).toUpperCase();
  if (!ALLOWED_SOURCES.includes(value)) {
    throw new RangeError(`Invalid source filter: ${String(source).slice(0, 32)}`);
  }
  return value;
}

function normalizeCategory(category) {
  if (category == null || category === '') return null;
  const value = String(category);
  if (value.length > 50) {
    throw new RangeError('Category filter too long');
  }
  return value;
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Build the shared WHERE filter with positional parameters.
 * @returns {{ clause: string, params: unknown[] }}
 */
function buildFilters(options, startIndex) {
  const params = [];
  let index = startIndex;
  const parts = [];

  parts.push(`status = $${index++}`);
  params.push(normalizeStatus(options.status));

  const source = normalizeSource(options.source);
  if (source) {
    parts.push(`source = $${index++}`);
    params.push(source);
  }

  const category = normalizeCategory(options.category);
  if (category) {
    parts.push(`category = $${index++}`);
    params.push(category);
  }

  return { clause: parts.join(' AND '), params, nextIndex: index };
}

/**
 * Serialize an embedding into a pgvector literal after validating every entry.
 */
export function toVectorLiteral(embedding) {
  if (!Array.isArray(embedding) || embedding.length === 0 || embedding.length > 4096) {
    throw new RangeError('Embedding must be a non-empty numeric array');
  }
  for (const value of embedding) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError('Embedding contains a non-finite value');
    }
  }
  return `[${embedding.join(',')}]`;
}

export function buildVectorSearchQuery(queryEmbedding, options = {}) {
  const vectorLiteral = toVectorLiteral(queryEmbedding);
  const topK = clampInt(options.topK, 1, 200, 30);
  const threshold = clampNumber(options.similarityThreshold, -1, 1, 0.35);

  const filters = buildFilters(options, 2);
  const thresholdIndex = filters.nextIndex;
  const limitIndex = thresholdIndex + 1;

  const sql = `
      SELECT ${SELECT_COLUMNS},
        1 - (embedding <=> $1::vector) as similarity
      FROM market_events
      WHERE ${filters.clause}
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) > $${thresholdIndex}
      ORDER BY embedding <=> $1::vector
      LIMIT $${limitIndex}
    `;

  return { sql, params: [vectorLiteral, ...filters.params, threshold, topK] };
}

/**
 * Clean keywords the same way as the original BM25 stage (strip non-word
 * characters) and split on whitespace so multi-word keywords cannot produce
 * an invalid tsquery.
 */
export function cleanTsKeywords(keywords) {
  return (Array.isArray(keywords) ? keywords : [])
    .flatMap(k => String(k ?? '').replace(/[^\w\s]/g, ' ').split(/\s+/))
    .map(k => k.trim())
    .filter(k => k.length > 0)
    .slice(0, 20);
}

export function buildBm25SearchQuery(keywords, options = {}) {
  const cleanKeywords = cleanTsKeywords(keywords);
  if (cleanKeywords.length === 0) return null;

  // OR matching between keywords, as in the original implementation.
  const searchQuery = cleanKeywords.join(' | ');
  const topK = clampInt(options.topK, 1, 200, 30);
  const filters = buildFilters(options, 2);
  const limitIndex = filters.nextIndex;

  const sql = `
      SELECT ${SELECT_COLUMNS},
        ts_rank(
          to_tsvector('english', search_text),
          to_tsquery('english', $1)
        ) as relevance
      FROM market_events
      WHERE ${filters.clause}
        AND to_tsvector('english', search_text) @@ to_tsquery('english', $1)
      ORDER BY relevance DESC, volume DESC NULLS LAST
      LIMIT $${limitIndex}
    `;

  return { sql, params: [searchQuery, ...filters.params, topK] };
}

export function escapeLikePattern(value) {
  return String(value).replace(/[\\%_]/g, ch => `\\${ch}`);
}

export function buildFallbackSearchQuery(keywords, options = {}) {
  const terms = (Array.isArray(keywords) ? keywords : [])
    .map(k => String(k ?? '').trim())
    .filter(k => k.length > 0)
    .slice(0, 5);
  if (terms.length === 0) return null;

  const topK = clampInt(options.topK, 1, 200, 30);
  const params = [];
  let index = 1;

  const likeConditions = terms.map(term => {
    params.push(`%${escapeLikePattern(term.slice(0, 200))}%`);
    const p = index++;
    return `(title ILIKE $${p} ESCAPE '\\' OR description ILIKE $${p} ESCAPE '\\')`;
  }).join(' OR ');

  const filters = buildFilters({ status: options.status, source: options.source }, index);
  params.push(...filters.params);
  const limitIndex = filters.nextIndex;
  params.push(topK);

  const sql = `
      SELECT ${SELECT_COLUMNS}
      FROM market_events
      WHERE ${filters.clause} AND (${likeConditions})
      ORDER BY volume DESC NULLS LAST
      LIMIT $${limitIndex}
    `;

  return { sql, params };
}
