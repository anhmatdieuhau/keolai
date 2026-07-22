/**
 * Plain assert-based test — run with:
 *   node functions/marketing/__tests__/proposalGates.test.js
 * strategistAgent's own safety net (Phase 3): tests every fixture from the
 * plan's Phase 3 acceptance criteria — missing/unknown evidence_refs,
 * invalid action_type, a consistency-check catching an "added" fact, and
 * the plagiarism guard catching near-verbatim competitor copy.
 */
const assert = require('assert');
const {
  ACTION_TYPES_AUTO,
  ACTION_TYPES_HUMAN,
  isValidActionType,
  requiresHumanApproval,
  checkEvidenceRefs,
  ngramOverlapRatio,
  checkPlagiarism,
  runConsistencyCheck,
} = require('../lib/proposalGates');

function fakeClaudeClient(verdict) {
  return {
    async callJSON() {
      if (verdict instanceof Error) throw verdict;
      return verdict;
    },
  };
}

(async () => {
  // ══ action_type whitelist ══
  {
    for (const t of ACTION_TYPES_AUTO) {
      assert.ok(isValidActionType(t), `${t} should be valid`);
      assert.strictEqual(requiresHumanApproval(t), false, `${t} should NOT require human approval`);
    }
    for (const t of ACTION_TYPES_HUMAN) {
      assert.ok(isValidActionType(t), `${t} should be valid`);
      assert.strictEqual(requiresHumanApproval(t), true, `${t} MUST require human approval`);
    }
    assert.strictEqual(isValidActionType('delete_site'), false);
    console.log('PASS: action_type whitelist — 3 auto-executable + 2 human-approval-required, nothing else valid');
  }

  // ══ checkEvidenceRefs ══
  {
    const verifiedIds = new Set(['abc123', 'def456']);

    const invalidAction = { action_type: 'delete_everything', claims: [] };
    assert.strictEqual(checkEvidenceRefs(invalidAction, verifiedIds).reject_reason, 'invalid_action_type');

    const noClaims = { action_type: 'update_meta', claims: [] };
    assert.strictEqual(checkEvidenceRefs(noClaims, verifiedIds).reject_reason, 'no_claims');

    const missingRefs = { action_type: 'update_meta', claims: [{ statement: 'x', evidence_refs: [] }] };
    assert.strictEqual(checkEvidenceRefs(missingRefs, verifiedIds).reject_reason, 'missing_evidence_refs');

    const bogusRef = { action_type: 'update_meta', claims: [{ statement: 'x', evidence_refs: ['does-not-exist'] }] };
    assert.strictEqual(checkEvidenceRefs(bogusRef, verifiedIds).reject_reason, 'unknown_evidence_ref');

    const valid = { action_type: 'update_meta', claims: [{ statement: 'x', evidence_refs: ['abc123'] }] };
    assert.strictEqual(checkEvidenceRefs(valid, verifiedIds).ok, true);
    console.log('PASS: checkEvidenceRefs rejects invalid action_type, empty claims, missing refs, and refs to claim_ids that were never verified');
  }

  // ══ plagiarism guard ══
  {
    assert.ok(ngramOverlapRatio('cây keo lai giâm hom sinh trưởng nhanh', 'sản phẩm chủ lực của chúng tôi khác hẳn') < 0.2);
    assert.ok(ngramOverlapRatio('cây keo lai giâm hom sinh trưởng nhanh chóng', 'cây keo lai giâm hom sinh trưởng nhanh chóng vượt trội') > 0.5);

    const competitorSnippet = 'Cây trắc giống được ươm từ hạt tuyển chọn, thời gian sinh trưởng nhanh, phù hợp đất đồi';
    const nearVerbatimCopy = 'Cây trắc giống được ươm từ hạt tuyển chọn, thời gian sinh trưởng nhanh, phù hợp đất đồi';
    const rejected = checkPlagiarism(nearVerbatimCopy, [competitorSnippet]);
    assert.strictEqual(rejected.ok, false);
    assert.strictEqual(rejected.reject_reason, 'possible_plagiarism');

    const originalText = 'Keo lai AH1 tại vườn ươm Ngọc Sơn có tỉ lệ sống trên 95% khi trồng đúng kỹ thuật mật độ 3x2m';
    const accepted = checkPlagiarism(originalText, [competitorSnippet]);
    assert.strictEqual(accepted.ok, true);
    console.log('PASS: plagiarism guard rejects near-verbatim competitor copy, accepts genuinely original text');
  }

  // ══ proposalConsistencyCheck ══
  {
    const verifiedClaimsById = new Map([
      ['c1', { claim_id: 'c1', claim: 'Trang X có 500 impression', evidence_snippet: 'impressions=500' }],
    ]);

    // Fixture from Phase 3 acceptance criteria: statement adds a fact not in the cited evidence.
    const proposalWithAddedFact = {
      claims: [{ statement: 'Trang X có 500 impression và tỉ lệ chuyển đổi 12%', evidence_refs: ['c1'] }],
    };
    const rejected = await runConsistencyCheck(proposalWithAddedFact, verifiedClaimsById, fakeClaudeClient({
      verdict: 'NOT_SUPPORTED',
      reason: 'evidence không nhắc gì đến tỉ lệ chuyển đổi',
    }));
    assert.strictEqual(rejected.ok, false);
    assert.strictEqual(rejected.reject_reason, 'consistency_check_failed');
    console.log('PASS: proposalConsistencyCheck rejects a statement that adds a fact beyond its cited evidence');

    const proposalFaithful = { claims: [{ statement: 'Trang X có 500 impression', evidence_refs: ['c1'] }] };
    const accepted = await runConsistencyCheck(proposalFaithful, verifiedClaimsById, fakeClaudeClient({ verdict: 'SUPPORTED', reason: 'khớp' }));
    assert.strictEqual(accepted.ok, true);
    assert.strictEqual(accepted.llmCalls, 1);
    console.log('PASS: proposalConsistencyCheck accepts a statement fully backed by its cited evidence, counts LLM calls for cost accounting');

    // Fail-closed: LLM error must reject, not silently pass.
    const apiError = await runConsistencyCheck(proposalFaithful, verifiedClaimsById, fakeClaudeClient(new Error('Anthropic API 529 overloaded')));
    assert.strictEqual(apiError.ok, false);
    assert.strictEqual(apiError.reject_reason, 'consistency_check_api_error');
    console.log('PASS: proposalConsistencyCheck fails closed on an LLM error (api_error, not a silent pass)');
  }

  console.log('\nAll proposalGates tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
