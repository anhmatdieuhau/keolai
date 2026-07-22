/**
 * Phase 3: strategistAgent — reads verified_claims/{date} (never signals/
 * directly, only claims that already passed evidenceVerifier), generates
 * candidate proposals with Claude Sonnet 5, then runs every candidate
 * through proposalGates.js before writing anything to proposals/.
 *
 * Does NOT execute anything — proposals/{id} just sit in Firestore for
 * Phase 4 shadow mode. No action_type here is ever auto-applied to the
 * live site; that's Phase 5's executorAgent, which doesn't exist yet.
 */
const crypto = require('crypto');
const { loadSkill } = require('../lib/skillLoader');
const costGuard = require('../lib/costGuard');
const {
  PROPOSAL_SCHEMA,
  requiresHumanApproval,
  checkEvidenceRefs,
  checkPlagiarism,
  runConsistencyCheck,
} = require('../lib/proposalGates');

const MAX_PROPOSALS_PER_RUN = 3;
// Rough per-call token estimates for costGuard accounting — callJSON doesn't
// surface exact usage, same tradeoff already made for serpGapScan/evidenceVerifier.
const ESTIMATED_GENERATION_TOKENS_IN = 6000;
const ESTIMATED_GENERATION_TOKENS_OUT = 2500;
const ESTIMATED_CONSISTENCY_TOKENS_IN = 400;
const ESTIMATED_CONSISTENCY_TOKENS_OUT = 80;

function currentWeekKey(now = new Date()) {
  const d = new Date(now);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().split('T')[0];
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function buildProposalPrompt(supportedClaims, competitorDomains) {
  const businessContext = loadSkill('keolai-business-context');
  const contentStrategy = loadSkill('content-strategy');
  const copyEditing = loadSkill('copy-editing');

  const claimsList = supportedClaims
    .map((c) => `- claim_id="${c.claim_id}" category=${c.category} source_url="${c.source_url}"\n  ${c.claim}`)
    .join('\n');

  return `${businessContext}

---
${contentStrategy}

---
${copyEditing}

---
# Nhiệm vụ

Dưới đây là các claim ĐÃ QUA XÁC MINH (evidenceVerifier đã kiểm chứng, không phải dữ liệu thô) trong tuần này:

${claimsList}

Danh sách domain đối thủ (chỉ dùng evidence từ các claim "gap" để XÁC ĐỊNH có lỗ hổng nội dung, TUYỆT ĐỐI KHÔNG sao chép/diễn giải sát nghĩa nội dung của họ vào proposed_change): ${competitorDomains.join(', ') || '(không có)'}

Hãy sinh tối đa ${MAX_PROPOSALS_PER_RUN} đề xuất (proposals) hành động, mỗi đề xuất PHẢI:
- action_type là 1 trong: update_meta, add_faq, fix_internal_link (sửa bài có sẵn — ưu tiên, xem "Ràng buộc phạm vi nội dung" ở trên), update_data (sửa số liệu/giá), propose_new_article (chỉ khi thực sự không có bài nào phù hợp để sửa).
- target_url: với 4 action_type đầu, PHẢI dùng ĐÚNG NGUYÊN VĂN 1 giá trị source_url đã liệt kê ở trên (không tự bịa URL). Với propose_new_article, đề xuất 1 slug mới hợp lý dạng "/articles/ten-slug-moi/".
- claims: mỗi luận điểm (statement) trong rationale/proposed_change PHẢI có evidence_refs trỏ ĐÚNG claim_id đã liệt kê ở trên (không tự bịa ID, không dùng ID không có trong danh sách).
- Không đưa vào bất kỳ số điện thoại/giá/thông tin liên hệ nào ngoài phần "NAP chuẩn" ở business context.
- proposed_change: MÔ TẢ NGẮN GỌN nội dung sẽ thay đổi/thêm (tối đa ~100 từ) — đây là bản tóm tắt cho người duyệt xem, KHÔNG PHẢI bản nội dung hoàn chỉnh cuối cùng (bản đầy đủ sẽ do bước thực thi soạn sau, khi đề xuất đã được duyệt).
- Nếu không có đủ evidence chắc chắn cho 1 đề xuất, ĐỪNG sinh đề xuất đó — sinh ít đề xuất tốt hơn nhiều đề xuất yếu.`;
}

/**
 * @param {object} deps
 * @param {FirebaseFirestore.Firestore} deps.db
 * @param {{callJSON: Function}} deps.claudeClient
 * @param {Date} [deps.now]
 */
async function runStrategistAgent({ db, claudeClient, now = new Date() }) {
  const budget = await costGuard.checkBudget(db);
  if (!budget.ok) {
    console.warn('⏸ [strategistAgent] costGuard budget exceeded, skipping run', budget);
    return { skipped: 'cost_guard_exceeded', ...budget };
  }

  const date = currentWeekKey(now);
  const verifiedSnap = await db.collection('verified_claims').doc(date).get();
  const allVerified = verifiedSnap.exists ? verifiedSnap.data().claims || [] : [];
  const supportedClaims = allVerified.filter((c) => c.verdict === 'SUPPORTED');

  if (supportedClaims.length === 0) {
    console.log(`📋 [strategistAgent] verified_claims/${date}: no SUPPORTED claims, nothing to propose`);
    return { proposalsGenerated: 0, reason: 'no_supported_claims' };
  }

  const verifiedClaimIds = new Set(supportedClaims.map((c) => c.claim_id));
  const verifiedClaimsById = new Map(supportedClaims.map((c) => [c.claim_id, c]));

  const configDoc = await db.collection('config').doc('competitors').get();
  const competitorDomains = configDoc.exists ? configDoc.data().domains || [] : [];

  const prompt = buildProposalPrompt(supportedClaims, competitorDomains);
  let generated;
  try {
    generated = await claudeClient.callJSON({ prompt, schema: PROPOSAL_SCHEMA });
    await costGuard.recordUsage(db, 'claude', ESTIMATED_GENERATION_TOKENS_IN, ESTIMATED_GENERATION_TOKENS_OUT).catch(() => {});
  } catch (err) {
    console.error('❌ [strategistAgent] generation call failed:', err);
    return { proposalsGenerated: 0, reason: 'generation_api_error', detail: err.message };
  }

  const candidates = (generated.proposals || []).slice(0, MAX_PROPOSALS_PER_RUN);
  const written = [];
  const rejectReasonCounts = {};
  let consistencyCheckCalls = 0;

  for (const candidate of candidates) {
    // ── Gate 1: structural — cheap, deterministic, no LLM ──
    const structural = checkEvidenceRefs(candidate, verifiedClaimIds);
    if (!structural.ok) {
      rejectReasonCounts[structural.reject_reason] = (rejectReasonCounts[structural.reject_reason] || 0) + 1;
      console.warn(`⚠️ [strategistAgent] rejected: ${structural.reject_reason}`, structural.detail);
      continue;
    }

    // ── Gate 2: target_url must resolve to a real existing article, unless proposing a brand-new one ──
    let targetArticle = null;
    if (candidate.action_type !== 'propose_new_article') {
      const articleQuery = await db.collection('articles').where('url', '==', candidate.target_url).limit(1).get();
      if (articleQuery.empty) {
        rejectReasonCounts.target_url_not_found = (rejectReasonCounts.target_url_not_found || 0) + 1;
        console.warn('⚠️ [strategistAgent] rejected: target_url_not_found', candidate.target_url);
        continue;
      }
      targetArticle = articleQuery.docs[0].data();
    }

    // ── Gate 3: proposalConsistencyCheck — LLM re-verification of the strategist's own claims ──
    const consistency = await runConsistencyCheck(candidate, verifiedClaimsById, claudeClient);
    consistencyCheckCalls += consistency.llmCalls;
    for (let i = 0; i < consistency.llmCalls; i++) {
      await costGuard.recordUsage(db, 'claude', ESTIMATED_CONSISTENCY_TOKENS_IN, ESTIMATED_CONSISTENCY_TOKENS_OUT).catch(() => {});
    }
    if (!consistency.ok) {
      rejectReasonCounts[consistency.reject_reason] = (rejectReasonCounts[consistency.reject_reason] || 0) + 1;
      console.warn(`⚠️ [strategistAgent] rejected: ${consistency.reject_reason}`, consistency.detail);
      continue;
    }

    // ── Gate 4: plagiarism guard against competitor evidence ──
    const competitorSnippets = candidate.claims
      .flatMap((c) => c.evidence_refs)
      .map((ref) => verifiedClaimsById.get(ref))
      .filter((c) => c && c.category === 'gap' && competitorDomains.includes(domainOf(c.source_url)))
      .map((c) => c.evidence_snippet);
    const plagiarism = checkPlagiarism(candidate.proposed_change, competitorSnippets);
    if (!plagiarism.ok) {
      rejectReasonCounts[plagiarism.reject_reason] = (rejectReasonCounts[plagiarism.reject_reason] || 0) + 1;
      console.warn('⚠️ [strategistAgent] rejected: possible_plagiarism', plagiarism.detail);
      continue;
    }

    // ── All gates passed — write the proposal ──
    const id = crypto.randomUUID();
    const proposal = {
      id,
      action_type: candidate.action_type,
      target_url: candidate.target_url,
      rationale: candidate.rationale,
      claims: candidate.claims,
      expected_impact: candidate.expected_impact,
      effort: candidate.effort,
      confidence: candidate.confidence,
      before_snapshot: targetArticle
        ? { title: targetArticle.title, description: targetArticle.description, slug: targetArticle.slug, captured_at: now.toISOString() }
        : null,
      proposed_change: candidate.proposed_change,
      requires_human_approval: requiresHumanApproval(candidate.action_type),
      status: 'shadow', // Phase 4 — never auto-executed; executorAgent (Phase 5) doesn't exist yet
      created_at: now.toISOString(),
      source_date: date,
    };
    await db.collection('proposals').doc(id).set(proposal);
    written.push(id);
  }

  const metricsUpdate = {
    date,
    candidatesConsidered: candidates.length,
    proposalsWritten: written.length,
    consistencyCheckCalls,
    updatedAt: new Date().toISOString(),
  };
  for (const [reason, count] of Object.entries(rejectReasonCounts)) {
    metricsUpdate[`reject_reason_${reason}`] = count;
  }
  await db.collection('metrics').doc('strategist').collection('dates').doc(date).set(metricsUpdate, { merge: true });

  console.log(`📋 [strategistAgent] verified_claims/${date}: ${written.length}/${candidates.length} candidates written to proposals/`, rejectReasonCounts);
  return { proposalsGenerated: written.length, candidatesConsidered: candidates.length, rejectReasonCounts, proposalIds: written };
}

module.exports = { runStrategistAgent, buildProposalPrompt, currentWeekKey, domainOf };
