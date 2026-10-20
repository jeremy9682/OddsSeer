/**
 * Retrieval Service
 * 
 * Stage 2 of the semantic search pipeline
 * Implements hybrid search: Vector Search + BM25 + RRF Fusion
 */

import prisma from '../../lib/prisma.js';
import { createHash } from 'crypto';
import { generateQueryEmbedding } from './embedding.service.js';
import { RETRIEVAL_CONFIG } from '../../config/search.config.js';
import {
  buildVectorSearchQuery,
  buildBm25SearchQuery,
  buildFallbackSearchQuery,
} from './retrieval-sql.js';

const VECTOR_CACHE_TTL_MS = 15 * 60 * 1000;
const VECTOR_CACHE_MAX_SIZE = 2000;
const vectorSearchCache = new Map();

const BM25_CACHE_TTL_MS = 10 * 60 * 1000;
const BM25_CACHE_MAX_SIZE = 1500;
const bm25SearchCache = new Map();

function buildOptionsCacheKey(options = {}) {
  return JSON.stringify({
    topK: options.topK,
    similarityThreshold: options.similarityThreshold,
    status: options.status || 'ACTIVE',
    source: options.source || null,
    category: options.category || null,
  });
}

function getCacheValue(cache, key, ttlMs) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > ttlMs) {
    cache.delete(key);
    return null;
  }
  return cached.value;
}

function setCacheValue(cache, key, value, maxSize) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, { value, timestamp: Date.now() });
  if (cache.size > maxSize) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

// ============================================
// Vector Search (Semantic)
// ============================================

/**
 * Search events using vector similarity (pgvector)
 * 
 * @param {number[]} queryEmbedding - Query embedding vector
 * @param {object} options - Search options
 * @returns {Promise<Array>} Matching events with similarity scores
 */
export async function vectorSearch(queryEmbedding, options = {}) {
  const {
    topK = RETRIEVAL_CONFIG.vector.topK,
    similarityThreshold = RETRIEVAL_CONFIG.vector.similarityThreshold,
    status = 'ACTIVE',
    source = null,
    category = null,
  } = options;
  
  if (!queryEmbedding || queryEmbedding.length === 0) {
    void 0;
    return [];
  }

  const cacheKey = createHash('sha256')
    .update(`${queryEmbedding.join(',')}|${buildOptionsCacheKey(options)}`)
    .digest('hex');
  const cachedResults = getCacheValue(vectorSearchCache, cacheKey, VECTOR_CACHE_TTL_MS);
  if (cachedResults) {
    return cachedResults;
  }
  
  try {
    // Execute vector similarity search with bound parameters
    // Using cosine distance operator <=> (smaller = more similar)
    // Convert to similarity: 1 - distance
    const { sql, params } = buildVectorSearchQuery(queryEmbedding, {
      topK,
      similarityThreshold,
      status,
      source,
      category,
    });
    const results = await prisma.$queryRawUnsafe(sql, ...params);
    
    const mappedResults = results.map((r, index) => ({
      ...r,
      _vectorRank: index + 1,
      _vectorScore: r.similarity,
    }));
    setCacheValue(vectorSearchCache, cacheKey, mappedResults, VECTOR_CACHE_MAX_SIZE);
    return mappedResults;
    
  } catch (error) {
    void 0;
    throw new Error("Database retrieval failed");
  }
}

// ============================================
// BM25 / Full-Text Search
// ============================================

/**
 * Search events using full-text search (BM25-like with PostgreSQL)
 * 
 * @param {string[]} keywords - Search keywords
 * @param {object} options - Search options
 * @returns {Promise<Array>} Matching events with relevance scores
 */
export async function bm25Search(keywords, options = {}) {
  const {
    topK = RETRIEVAL_CONFIG.bm25.topK,
    status = 'ACTIVE',
    source = null,
    category = null,
  } = options;
  
  if (!keywords || keywords.length === 0) {
    void 0;
    return [];
  }

  const normalizedKeywords = keywords
    .map(k => (k || '').toLowerCase().trim())
    .filter(Boolean)
    .sort();
  const cacheKey = createHash('sha256')
    .update(`${normalizedKeywords.join('|')}|${buildOptionsCacheKey(options)}`)
    .digest('hex');
  const cachedResults = getCacheValue(bm25SearchCache, cacheKey, BM25_CACHE_TTL_MS);
  if (cachedResults) {
    return cachedResults;
  }
  
  try {
    // Clean keywords and build the bound full-text query
    // (| for OR matching between keywords, as before)
    const query = buildBm25SearchQuery(keywords, { topK, status, source, category });
    if (!query) {
      return [];
    }

    // Execute full-text search with ts_rank
    const results = await prisma.$queryRawUnsafe(query.sql, ...query.params);
    
    const mappedResults = results.map((r, index) => ({
      ...r,
      _bm25Rank: index + 1,
      _bm25Score: r.relevance,
    }));
    setCacheValue(bm25SearchCache, cacheKey, mappedResults, BM25_CACHE_MAX_SIZE);
    return mappedResults;
    
  } catch (error) {
    void 0;
    
    // Fallback to simple ILIKE search
    return fallbackSearch(keywords, options);
  }
}

/**
 * Fallback search using ILIKE (when full-text search fails)
 */
async function fallbackSearch(keywords, options = {}) {
  const {
    topK = RETRIEVAL_CONFIG.bm25.topK,
    status = 'ACTIVE',
    source = null,
  } = options;
  
  try {
    // Build bound ILIKE conditions (max 5 keywords, LIKE wildcards escaped)
    const query = buildFallbackSearchQuery(keywords, { topK, status, source });
    if (!query) {
      return [];
    }

    const results = await prisma.$queryRawUnsafe(query.sql, ...query.params);
    
    return results.map((r, index) => ({
      ...r,
      _bm25Rank: index + 1,
      _bm25Score: 0.5,  // Fixed score for fallback
      _fallback: true,
    }));
    
  } catch (error) {
    void 0;
    throw new Error("Database retrieval failed");
  }
}

// ============================================
// RRF Fusion
// ============================================

/**
 * Reciprocal Rank Fusion to combine vector and BM25 results
 * 
 * RRF score = sum(1 / (k + rank_i))
 * 
 * @param {Array} vectorResults - Results from vector search
 * @param {Array} bm25Results - Results from BM25 search
 * @param {object} options - Fusion options
 * @returns {Array} Fused and sorted results
 */
export function rrfFusion(vectorResults, bm25Results, options = {}) {
  const {
    k = RETRIEVAL_CONFIG.rrf.k,
    vectorWeight = RETRIEVAL_CONFIG.rrf.vectorWeight,
    bm25Weight = RETRIEVAL_CONFIG.rrf.bm25Weight,
    topK = RETRIEVAL_CONFIG.rrf.outputTopK,
  } = options;
  
  // Map to store fused scores by event ID
  const fusedScores = new Map();
  const eventData = new Map();
  
  // Process vector results
  vectorResults.forEach((result, index) => {
    const rank = index + 1;
    const rrfScore = vectorWeight * (1 / (k + rank));
    
    const existing = fusedScores.get(result.id) || 0;
    fusedScores.set(result.id, existing + rrfScore);
    
    if (!eventData.has(result.id)) {
      eventData.set(result.id, {
        ...result,
        _vectorRank: rank,
        _vectorScore: result._vectorScore || result.similarity,
      });
    } else {
      eventData.get(result.id)._vectorRank = rank;
      eventData.get(result.id)._vectorScore = result._vectorScore || result.similarity;
    }
  });
  
  // Process BM25 results
  bm25Results.forEach((result, index) => {
    const rank = index + 1;
    const rrfScore = bm25Weight * (1 / (k + rank));
    
    const existing = fusedScores.get(result.id) || 0;
    fusedScores.set(result.id, existing + rrfScore);
    
    if (!eventData.has(result.id)) {
      eventData.set(result.id, {
        ...result,
        _bm25Rank: rank,
        _bm25Score: result._bm25Score || result.relevance,
      });
    } else {
      eventData.get(result.id)._bm25Rank = rank;
      eventData.get(result.id)._bm25Score = result._bm25Score || result.relevance;
    }
  });
  
  // Sort by fused score and return top K
  const fusedResults = Array.from(fusedScores.entries())
    .map(([id, score]) => ({
      ...eventData.get(id),
      _rrfScore: score,
    }))
    .sort((a, b) => b._rrfScore - a._rrfScore)
    .slice(0, topK);
  
  return fusedResults;
}

// ============================================
// Hybrid Search (Main Function)
// ============================================

/**
 * Execute hybrid search combining vector and BM25
 * 
 * @param {object} queryData - Parsed query from Query Understanding
 * @param {object} options - Search options
 * @returns {Promise<object>} Search results with metadata
 */
export async function hybridSearch(queryData, options = {}) {
  const startTime = Date.now();
  
  const {
    query_keywords = [],
    query_en = '',
  } = queryData;
  
  // Prepare search parameters
  const searchText = query_en || query_keywords.join(' ');
  
  let vectorResults = [];
  let bm25Results = [];
  
  // Execute searches in parallel
  const searchPromises = [];
  
  // Vector search (if enabled and we have text). Query embeddings are a paid
  // API call, so the HTTP layer can switch them off per request.
  const useVector = options.allowPaidEmbedding !== false;
  if (RETRIEVAL_CONFIG.vector.enabled && useVector && searchText) {
    searchPromises.push(
      (async () => {
        try {
          const embedding = await generateQueryEmbedding(searchText);
          return vectorSearch(embedding, options);
        } catch (err) {
          void 0;
          return [];
        }
      })()
    );
  } else {
    searchPromises.push(Promise.resolve([]));
  }
  
  // BM25 search (if enabled and we have keywords)
  if (RETRIEVAL_CONFIG.bm25.enabled && query_keywords.length > 0) {
    searchPromises.push(bm25Search(query_keywords, options));
  } else {
    searchPromises.push(Promise.resolve([]));
  }
  
  // Wait for both searches
  [vectorResults, bm25Results] = await Promise.all(searchPromises);
  
  // Fuse results
  const fusedResults = rrfFusion(vectorResults, bm25Results, options);
  
  const latencyMs = Date.now() - startTime;
  
  return {
    results: fusedResults,
    metadata: {
      vectorCount: vectorResults.length,
      bm25Count: bm25Results.length,
      fusedCount: fusedResults.length,
      latencyMs,
    },
  };
}

/**
 * Simple search for single query (convenience function)
 */
export async function simpleSearch(query, options = {}) {
  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
  
  return hybridSearch({
    query_keywords: keywords,
    query_en: query,
  }, options);
}

export default {
  vectorSearch,
  bm25Search,
  rrfFusion,
  hybridSearch,
  simpleSearch,
};
