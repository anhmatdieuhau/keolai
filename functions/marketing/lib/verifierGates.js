/**
 * Pure gate logic for evidenceVerifier (Phase 2, Gate #1 — the most important
 * safety gate in the whole marketing-agent system). Kept separate from the
 * Firestore-trigger wrapper so it's directly unit-testable with fake
 * fetch/claudeClient, no emulator needed.
 *
 * Routing (NOT the same claim goes through every tier):
 *   - Claims carrying raw_api_response (gscDemandScan/contentDecayScan —
 *     site metrics) go through TIER 2 ONLY: no fetch, no LLM, just a numeric
 *     cross-check against the real API response the claim was built from.
 *     Fetching source_url for these would be pointless — the "evidence" is
 *     API data, not page text, so there's nothing on the page to match.
 *   - Claims with no raw_api_response (serpGapScan — content/competitor
 *     claims) go through TIER 1 (does evidence_snippet still appear on a
 *     freshly-refetched source_url?) then, if that passes, TIER 3 (LLM
 *     judge: is the claim text actually supported by that evidence?). This
 *     re-checks serpGapScan's own LLM judgment independently — the sensor's
 *     Gemini call is not trusted blindly either.
 *
 * Fail-closed throughout: any fetch error, LLM error, parse failure, or
 * AMBIGUOUS/low-confidence verdict rejects the claim. Nothing here ever
 * guesses a claim into acceptance.
 */
const crypto = require('crypto');

const SNIPPET_OVERLAP_THRESHOLD = 0.6;
const LLM_CONFIDENCE_THRESHOLD = 0.7;
const METRIC_MATCH_TOLERANCE = 0.15; // absolute difference allowed when comparing rounded numbers

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['SUPPORTED', 'NOT_SUPPORTED', 'AMBIGUOUS'] },
    confidence: { type: 'number' },
    reason: { type: 'string' },
  },
  required: ['verdict', 'confidence', 'reason'],
};

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Fraction of the snippet's words that appear anywhere in pageText — order-independent, tolerant of whitespace/HTML differences. */
function snippetOverlapRatio(snippet, pageText) {
  const snippetWords = tokenize(snippet);
  if (snippetWords.length === 0) return 0;
  const pageWordSet = new Set(tokenize(pageText));
  const matched = snippetWords.filter((w) => pageWordSet.has(w)).length;
  return matched / snippetWords.length;
}

function extractNumbers(text) {
  const matches = String(text).match(/\d+[.,]?\d*/g) || [];
  return matches.map((m) => parseFloat(m.replace(',', '.')));
}

function flattenNumbers(value, acc = []) {
  if (value == null) return acc;
  if (typeof value === 'number' && Number.isFinite(value)) {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const v of value) flattenNumbers(v, acc);
    return acc;
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value)) flattenNumbers(v, acc);
  }
  return acc;
}

/** Stable ID for a claim, used to avoid re-verifying the same claim across repeated signals/{date} trigger firings (3 sensors merge into 1 doc). */
function claimId(claim) {
  const key = `${claim.claim}|${claim.source_url}|${claim.retrieved_at}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * @param {object} claim - one entry from signals/{date}.demand|decay|gap
 * @param {{fetchFn: typeof fetch, claudeClient: {callJSON: Function}}} deps
 * @returns {Promise<{verdict: 'SUPPORTED'|'REJECTED', reject_reason: string|null, tier: number, detail?: string}>}
 */
async function verifyClaim(claim, { fetchFn, claudeClient }) {
  // ── Tier 2: site-metric claim — numeric cross-check only, no fetch/LLM ──
  if (claim.raw_api_response) {
    const shapeOk =
      claim.raw_api_response.impressions !== undefined && claim.raw_api_response.position !== undefined;
    if (!shapeOk) {
      return { verdict: 'REJECTED', reject_reason: 'source_not_gsc_ga4', tier: 2 };
    }

    const claimNumbers = extractNumbers(claim.claim).map((n) => Math.round(n * 10) / 10);
    const sourceNumbers = flattenNumbers(claim.raw_api_response).map((n) => Math.round(n * 10) / 10);
    const allMatch = claimNumbers.every((n) => sourceNumbers.some((s) => Math.abs(s - n) <= METRIC_MATCH_TOLERANCE));

    return allMatch
      ? { verdict: 'SUPPORTED', reject_reason: null, tier: 2 }
      : { verdict: 'REJECTED', reject_reason: 'metric_mismatch', tier: 2 };
  }

  // ── Tier 1: deterministic snippet match ──
  let pageText;
  try {
    const res = await fetchFn(claim.source_url);
    if (!res.ok) {
      return { verdict: 'REJECTED', reject_reason: 'no_snippet_match', tier: 1, detail: `fetch returned ${res.status}` };
    }
    pageText = await res.text();
  } catch (err) {
    const isTimeout = /timeout/i.test(err.message || '');
    return { verdict: 'REJECTED', reject_reason: isTimeout ? 'timeout' : 'api_error', tier: 1, detail: err.message };
  }

  const overlap = snippetOverlapRatio(claim.evidence_snippet, pageText);
  if (overlap < SNIPPET_OVERLAP_THRESHOLD) {
    return { verdict: 'REJECTED', reject_reason: 'no_snippet_match', tier: 1, detail: `overlap=${overlap.toFixed(2)}` };
  }

  // ── Tier 3: LLM judge (only reached if tier 1 passed) ──
  const prompt = `Claim cần kiểm chứng: "${claim.claim}"

Evidence (trích từ ${claim.source_url}):
"""
${claim.evidence_snippet}
"""

Claim trên có thực sự được đoạn evidence chống đỡ không? Chỉ trả lời SUPPORTED nếu evidence thực sự nói lên đúng nội dung claim khẳng định. Nếu evidence không đủ rõ hoặc không liên quan trực tiếp, trả lời AMBIGUOUS hoặc NOT_SUPPORTED — đừng đoán.`;

  let judged;
  try {
    judged = await claudeClient.callJSON({
      prompt,
      schema: VERDICT_SCHEMA,
      thinking: { type: 'disabled' },
    });
  } catch (err) {
    const isTimeout = /timeout/i.test(err.message || '');
    return { verdict: 'REJECTED', reject_reason: isTimeout ? 'timeout' : 'api_error', tier: 3, detail: err.message };
  }

  if (judged.verdict === 'SUPPORTED' && judged.confidence >= LLM_CONFIDENCE_THRESHOLD) {
    return { verdict: 'SUPPORTED', reject_reason: null, tier: 3, detail: judged.reason };
  }
  const reject_reason =
    judged.verdict === 'AMBIGUOUS'
      ? 'ambiguous'
      : judged.confidence < LLM_CONFIDENCE_THRESHOLD
        ? 'low_confidence'
        : 'not_supported';
  return { verdict: 'REJECTED', reject_reason, tier: 3, detail: judged.reason };
}

module.exports = {
  verifyClaim,
  claimId,
  snippetOverlapRatio,
  extractNumbers,
  flattenNumbers,
  tokenize,
  SNIPPET_OVERLAP_THRESHOLD,
  LLM_CONFIDENCE_THRESHOLD,
};
