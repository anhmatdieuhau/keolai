/**
 * Shared topic-novelty gate for all 3 content-generation entry points (autoReplenishTopics,
 * pipelineResearcher, pipelineOrchestrator's inline researcher step — see
 * pipeline-fix-proposal.md §1 "Đường A/B/C"). Fixes B6: the old checks compared *phrasing*
 * (title/keyword substring match) instead of *topic identity*, so a rephrased title like
 * "Lựa chọn giống keo lai phù hợp với điều kiện khí hậu Tây Nguyên" sailed past a dedup check
 * built for "Chọn giống keo lai phù hợp vùng Tây Nguyên" — soft "don't repeat yourself" prompt
 * instructions to the LLM failed the same way, repeatedly, in production.
 *
 * Two-tier check against a `topic_fingerprints` collection (one doc per published/queued topic):
 *   1. Cheap coarse fingerprint (strip generic modifier words, sort remaining core words) —
 *      catches exact/near-exact rephrasings for free, no API call.
 *   2. Optional semantic check via injected embedding function (cosine similarity, threshold
 *      configurable) — catches paraphrases the coarse check misses. Only runs if `embedFn` is
 *      provided, so callers/tests that don't need it don't pay for it.
 * Blocking happens in code (a hard collection query / cosine threshold), not by asking the LLM
 * nicely in a prompt — that's the mechanism that was already failing.
 */

const { normalizeSlug } = require('./slug');

// Generic modifier words that don't carry topic identity on their own — stripped before
// computing the coarse fingerprint so "Kỹ thuật chọn giống..." and "Kinh nghiệm chọn giống..."
// collapse to the same fingerprint.
const MODIFIER_WORDS = new Set([
  'ky', 'thuat', 'kinh', 'nghiem', 'huong', 'dan', 'cach', 'phuong', 'phap',
  'quy', 'trinh', 'bi', 'quyet', 'meo', 'tips', 'lua', 'chon', 'cho', 'voi',
  've', 'trong', 'khi', 'tai', 'cua', 'la', 'mot', 'nhung', 'cac', 'phu',
  'hop', 'dieu', 'kien', 'tap', 'huan', 'vung', 'hau', 'moi', 'truong',
]);

function coarseFingerprint(title) {
  const slug = normalizeSlug(title);
  const words = slug.split('-').filter((w) => w && !MODIFIER_WORDS.has(w));
  return words.sort().join('-');
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * @param {{title: string}} candidate
 * @param {FirebaseFirestore.Firestore} db
 * @param {{embedFn?: (text: string) => Promise<number[]>, similarityThreshold?: number, fingerprintLimit?: number}} [opts]
 * @returns {Promise<{status: 'novel'|'duplicate', coarseFingerprint: string, embedding?: number[], matchedSlug?: string, method?: string, score?: number}>}
 */
async function evaluateTopicNovelty(candidate, db, opts = {}) {
  const { embedFn, similarityThreshold = 0.85, fingerprintLimit = 500 } = opts;
  const coarse = coarseFingerprint(candidate.title || '');
  const fpCol = db.collection('topic_fingerprints');

  // Tier 1 — cheap coarse match, no API call.
  const coarseHit = await fpCol.where('coarseFingerprint', '==', coarse).limit(1).get();
  if (!coarseHit.empty) {
    return {
      status: 'duplicate',
      coarseFingerprint: coarse,
      matchedSlug: coarseHit.docs[0].data().slug,
      method: 'coarse',
    };
  }

  // Tier 2 — semantic check, only if caller supplied an embedding function.
  if (embedFn) {
    const candidateEmbedding = await embedFn(candidate.title);
    const existing = await fpCol.limit(fingerprintLimit).get();
    let best = { score: 0, slug: null };
    for (const doc of existing.docs) {
      const data = doc.data();
      if (!Array.isArray(data.embedding)) continue;
      const score = cosineSimilarity(candidateEmbedding, data.embedding);
      if (score > best.score) best = { score, slug: data.slug };
    }
    if (best.score >= similarityThreshold) {
      return {
        status: 'duplicate',
        coarseFingerprint: coarse,
        matchedSlug: best.slug,
        method: 'semantic',
        score: best.score,
      };
    }
    return { status: 'novel', coarseFingerprint: coarse, embedding: candidateEmbedding };
  }

  return { status: 'novel', coarseFingerprint: coarse };
}

/**
 * Registers a topic's fingerprint after evaluateTopicNovelty returned 'novel' and the topic
 * was actually queued/published — so the next candidate checked against it. Idempotent (keyed
 * by slug, .set() not .create()).
 */
async function registerTopicFingerprint(db, { slug, title, coarseFingerprint: coarse, embedding, registeredAtValue }) {
  if (!slug) throw new Error('registerTopicFingerprint requires slug');
  await db.collection('topic_fingerprints').doc(slug).set({
    slug,
    canonicalTopic: title,
    coarseFingerprint: coarse || coarseFingerprint(title || ''),
    embedding: embedding || null,
    registeredAt: registeredAtValue,
  });
}

module.exports = {
  coarseFingerprint,
  cosineSimilarity,
  evaluateTopicNovelty,
  registerTopicFingerprint,
};
