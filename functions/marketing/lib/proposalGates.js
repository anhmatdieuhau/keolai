/**
 * Pure gate logic for strategistAgent (Phase 3) — generates proposals/{id}
 * from verified_claims/{date}, but a proposal is only as trustworthy as the
 * checks that run on it before it's written. Kept separate from the
 * Firestore-reading orchestration (functions/marketing/strategist/strategistAgent.js)
 * so it's directly unit-testable with fake claudeClient, same split as
 * functions/marketing/lib/verifierGates.js.
 *
 * 3 independent gates, cheapest/deterministic first, LLM calls last:
 *   1. Structural: action_type in the whitelist, every claims[i] has a
 *      non-empty evidence_refs pointing to a claim_id that actually exists
 *      in verified_claims (never trust an LLM-invented ID).
 *   2. proposalConsistencyCheck: re-verify each claims[i].statement against
 *      the evidence text it cites — the strategist could cite a real,
 *      verified claim_id but then add a number/fact to the statement that
 *      isn't actually in that evidence. Catches the strategist "adding
 *      things" the way evidenceVerifier catches sensors "adding things".
 *   3. Plagiarism guard: proposed_change must never closely echo a
 *      competitor's evidence_snippet (serpGapScan claims) — a gap claim may
 *      only be used to justify writing something, never to copy it.
 *
 * Fail-closed throughout, same as verifierGates.js: any ambiguity, missing
 * reference, or LLM error rejects the whole proposal — nothing here ever
 * guesses a proposal into acceptance.
 */

const ACTION_TYPES_AUTO = ['update_meta', 'add_faq', 'fix_internal_link'];
const ACTION_TYPES_HUMAN = ['update_data', 'propose_new_article'];
const ALL_ACTION_TYPES = [...ACTION_TYPES_AUTO, ...ACTION_TYPES_HUMAN];

const PLAGIARISM_NGRAM_SIZE = 3;
const PLAGIARISM_OVERLAP_THRESHOLD = 0.4;

const CLAIM_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    statement: { type: 'string' },
    evidence_refs: { type: 'array', items: { type: 'string' } },
  },
  required: ['statement', 'evidence_refs'],
  additionalProperties: false,
};

const PROPOSAL_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    action_type: { type: 'string', enum: ALL_ACTION_TYPES },
    target_url: { type: 'string' },
    rationale: { type: 'string' },
    claims: { type: 'array', items: CLAIM_ITEM_SCHEMA },
    expected_impact: { type: 'string' },
    effort: { type: 'string', enum: ['low', 'medium', 'high'] },
    confidence: { type: 'number' },
    proposed_change: { type: 'string' },
  },
  required: ['action_type', 'target_url', 'rationale', 'claims', 'expected_impact', 'effort', 'confidence', 'proposed_change'],
  additionalProperties: false,
};

const PROPOSAL_SCHEMA = {
  type: 'object',
  properties: {
    proposals: { type: 'array', items: PROPOSAL_ITEM_SCHEMA },
  },
  required: ['proposals'],
  additionalProperties: false,
};

const CONSISTENCY_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['SUPPORTED', 'NOT_SUPPORTED'] },
    reason: { type: 'string' },
  },
  required: ['verdict', 'reason'],
  additionalProperties: false, // required by Claude's output_config.format — see verifierGates.js for the real-API failure mode this guards against
};

function isValidActionType(actionType) {
  return ALL_ACTION_TYPES.includes(actionType);
}

function requiresHumanApproval(actionType) {
  return ACTION_TYPES_HUMAN.includes(actionType);
}

/**
 * @param {object} proposal - candidate proposal as returned by the LLM (not yet written to Firestore)
 * @param {Set<string>} verifiedClaimIds - claim_id values that actually exist and are SUPPORTED in verified_claims/{date}
 */
function checkEvidenceRefs(proposal, verifiedClaimIds) {
  if (!isValidActionType(proposal.action_type)) {
    return { ok: false, reject_reason: 'invalid_action_type', detail: proposal.action_type };
  }
  if (!Array.isArray(proposal.claims) || proposal.claims.length === 0) {
    return { ok: false, reject_reason: 'no_claims', detail: null };
  }
  for (const c of proposal.claims) {
    if (!Array.isArray(c.evidence_refs) || c.evidence_refs.length === 0) {
      return { ok: false, reject_reason: 'missing_evidence_refs', detail: c.statement };
    }
    for (const ref of c.evidence_refs) {
      if (!verifiedClaimIds.has(ref)) {
        return { ok: false, reject_reason: 'unknown_evidence_ref', detail: ref };
      }
    }
  }
  return { ok: true, reject_reason: null, detail: null };
}

function tokenizeWords(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function ngramSet(words, n) {
  const set = new Set();
  for (let i = 0; i <= words.length - n; i++) {
    set.add(words.slice(i, i + n).join(' '));
  }
  return set;
}

/** Fraction of textA's n-grams that also appear in textB — directional (textA = the newly-proposed text, textB = pre-existing evidence). */
function ngramOverlapRatio(textA, textB, n = PLAGIARISM_NGRAM_SIZE) {
  const gramsA = ngramSet(tokenizeWords(textA), n);
  if (gramsA.size === 0) return 0;
  const gramsB = ngramSet(tokenizeWords(textB), n);
  let shared = 0;
  for (const g of gramsA) {
    if (gramsB.has(g)) shared++;
  }
  return shared / gramsA.size;
}

/**
 * @param {string} proposedChange
 * @param {string[]} competitorSnippets - evidence_snippet values from every claim referenced by this
 *   proposal whose source_url's domain is in the config/competitors watchlist
 */
function checkPlagiarism(proposedChange, competitorSnippets) {
  for (const snippet of competitorSnippets) {
    const overlap = ngramOverlapRatio(proposedChange, snippet);
    if (overlap > PLAGIARISM_OVERLAP_THRESHOLD) {
      return { ok: false, reject_reason: 'possible_plagiarism', detail: `overlap=${overlap.toFixed(2)}` };
    }
  }
  return { ok: true, reject_reason: null, detail: null };
}

/**
 * Re-verifies each claims[i].statement against the evidence text of the
 * claim_ids it cites — catches the strategist citing a real, verified claim
 * but then asserting something beyond what that evidence actually says.
 *
 * @param {object} proposal
 * @param {Map<string, object>} verifiedClaimsById - claim_id -> verified claim object (has .claim, .evidence_snippet)
 * @param {{callJSON: Function}} claudeClient
 * @returns {Promise<{ok: boolean, reject_reason: string|null, detail: string|null, llmCalls: number}>}
 */
async function runConsistencyCheck(proposal, verifiedClaimsById, claudeClient) {
  let llmCalls = 0;
  for (const c of proposal.claims) {
    const evidenceTexts = c.evidence_refs
      .map((ref) => verifiedClaimsById.get(ref))
      .filter(Boolean)
      .map((claim) => `- ${claim.claim} (evidence: ${claim.evidence_snippet})`)
      .join('\n');

    const prompt = `Luận điểm trong đề xuất marketing: "${c.statement}"

Evidence đã được xác minh, dùng để chống đỡ luận điểm trên:
${evidenceTexts}

Luận điểm trên có HOÀN TOÀN được evidence trên chống đỡ không, hay strategist đã tự thêm số liệu/khẳng định không có trong evidence? Chỉ trả lời SUPPORTED nếu mọi chi tiết trong luận điểm đều truy được về evidence. Nếu luận điểm thêm bất kỳ chi tiết nào không có trong evidence, trả lời NOT_SUPPORTED.`;

    let judged;
    try {
      llmCalls++;
      judged = await claudeClient.callJSON({ prompt, schema: CONSISTENCY_SCHEMA, thinking: { type: 'disabled' } });
    } catch (err) {
      return { ok: false, reject_reason: 'consistency_check_api_error', detail: err.message, llmCalls };
    }
    if (judged.verdict !== 'SUPPORTED') {
      return { ok: false, reject_reason: 'consistency_check_failed', detail: `"${c.statement}" — ${judged.reason}`, llmCalls };
    }
  }
  return { ok: true, reject_reason: null, detail: null, llmCalls };
}

module.exports = {
  ACTION_TYPES_AUTO,
  ACTION_TYPES_HUMAN,
  ALL_ACTION_TYPES,
  PROPOSAL_SCHEMA,
  CONSISTENCY_SCHEMA,
  PLAGIARISM_OVERLAP_THRESHOLD,
  isValidActionType,
  requiresHumanApproval,
  checkEvidenceRefs,
  tokenizeWords,
  ngramOverlapRatio,
  checkPlagiarism,
  runConsistencyCheck,
};
