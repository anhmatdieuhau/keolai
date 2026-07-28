/**
 * Single source of truth for model IDs across the entire codebase.
 *
 * Hardcoding model names in template literals has caused two migration misses:
 * - 75a96df fixed index.js
 * - 9536d84 missed pipeline.js (2 call sites still using gemini-3.0-flash-lite
 *   which Google never shipped — Vertex returns 404)
 *
 * USE THIS FILE. Do NOT type model names directly into prompt URLs or
 * recordUsage calls. When a model changes, change it HERE and nowhere else.
 *
 * costGuard.js MODEL_RATES_PER_1M_TOKENS_USD keeps legacy keys for historical
 * cost data — removing them would lose spend attribution for old months.
 * This file only defines the *current* models for new calls.
 */

const MODELS = {
  /** gemini-3.6-flash — article writing, long-form content, expensive */
  CONTENT: 'gemini-3.6-flash',

  /** gemini-3.1-flash-lite — briefs, JSON classification, cheap */
  CHEAP: 'gemini-3.1-flash-lite',

  /** text-embedding-004 — semantic similarity (lib/embeddings.js).
   *  Google recommends gemini-embedding-001 for new projects but this model
   *  is still in the stable list with no announced deprecation date. */
  EMBED: 'text-embedding-004',
}

module.exports = MODELS
