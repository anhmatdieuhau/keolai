/**
 * Marketing-agent Cloud Functions (Phase 1: sensors). Aggregated here and
 * merged into the main exports from functions/index.js via
 * Object.assign(exports, require('./marketing')) — same pattern already
 * used for functions/pipeline.js.
 *
 * Relies on functions/index.js having already called admin.initializeApp()
 * before requiring this file (matches how pipeline.js relies on the same
 * ordering).
 */
const functions = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

const db = admin.firestore();
const vertexApiKey = defineSecret('VERTEX_API_KEY');
const appClientSecret = defineSecret('APP_CLIENT_SECRET');
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

const { runGscDemandScan } = require('./sensors/gscDemandScan');
const { runContentDecayScan } = require('./sensors/contentDecayScan');
const { runSerpGapScan } = require('./sensors/serpGapScan');
const { runStrategistAgent } = require('./strategist/strategistAgent');
const { createGeminiClient } = require('./lib/geminiClient');
const { createClaudeClient } = require('./lib/claudeClient');
const { verifyClaim, claimId } = require('./lib/verifierGates');
const costGuard = require('./lib/costGuard');

function isAuthorized(req) {
  const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
  const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
  return isScheduler || hasSecret;
}

exports.gscDemandScan = functions.onRequest(
  {
    secrets: [appClientSecret],
    region: 'us-central1',
    timeoutSeconds: 180,
    memory: '256MiB',
  },
  async (req, res) => {
    if (!isAuthorized(req)) return res.status(403).json({ error: 'Unauthorized' });
    try {
      const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
      const authClient = await auth.getClient();
      const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });
      const result = await runGscDemandScan({ db, searchconsole });
      console.log('📡 [gscDemandScan]', result);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error('❌ [gscDemandScan] failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

exports.contentDecayScan = functions.onRequest(
  {
    secrets: [appClientSecret],
    region: 'us-central1',
    timeoutSeconds: 180,
    memory: '256MiB',
  },
  async (req, res) => {
    if (!isAuthorized(req)) return res.status(403).json({ error: 'Unauthorized' });
    try {
      const result = await runContentDecayScan({ db });
      console.log('📉 [contentDecayScan]', result);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error('❌ [contentDecayScan] failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

exports.serpGapScan = functions.onRequest(
  {
    secrets: [appClientSecret, vertexApiKey],
    region: 'us-central1',
    timeoutSeconds: 180,
    memory: '256MiB',
  },
  async (req, res) => {
    if (!isAuthorized(req)) return res.status(403).json({ error: 'Unauthorized' });
    try {
      const budget = await costGuard.checkBudget(db);
      if (!budget.ok) {
        console.warn('⏸ [serpGapScan] costGuard budget exceeded, skipping run', budget);
        return res.status(200).json({ success: false, skipped: 'cost_guard_exceeded', ...budget });
      }

      const geminiClient = createGeminiClient(vertexApiKey.value(), { model: 'gemini-3.6-flash' });
      const wrappedClient = {
        async callJSON(args) {
          const result = await geminiClient.callJSON(args);
          // Best-effort usage accounting — Gemini's REST response carries
          // usageMetadata, but callJSON only returns the parsed JSON payload,
          // so this is a rough per-call estimate rather than exact token
          // counts. Good enough for a circuit-breaker-style guard.
          await costGuard.recordUsage(db, 'gemini', 1500, 200).catch(() => {});
          return result;
        },
      };

      const result = await runSerpGapScan({ db, fetchFn: fetch, geminiClient: wrappedClient });
      console.log('🔍 [serpGapScan]', result);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error('❌ [serpGapScan] failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════
// PHASE 2 — evidenceVerifier (Gate #1)
//
// Event-driven off signals/{date} — no separate cron. Fires once per sensor
// write (demand/decay/gap merge into the same doc across the morning), so
// every claim gets a stable claimId() and already-verified IDs are skipped
// on repeat firings rather than re-verified 3x.
//
// Writes verdicts to verified_claims/{date} — a SEPARATE collection from
// signals/{date}. Writing back to signals/{date} itself would re-trigger
// this same onDocumentWritten listener and loop forever; see
// functions/marketing/lib/verifierGates.js and the plan for the full
// reasoning. strategistAgent (Phase 3) reads verified_claims/, never
// signals/ directly.
// ═══════════════════════════════════════════════════════════
exports.evidenceVerifier = onDocumentWritten(
  {
    document: 'signals/{date}',
    region: 'us-central1',
    secrets: [anthropicApiKey],
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  async (event) => {
    const date = event.params.date;
    const after = event.data?.after?.data();
    if (!after) return; // document deleted — nothing to verify

    const allClaims = [
      ...(after.demand || []).map((c) => ({ ...c, category: 'demand' })),
      ...(after.decay || []).map((c) => ({ ...c, category: 'decay' })),
      ...(after.gap || []).map((c) => ({ ...c, category: 'gap' })),
    ];
    if (allClaims.length === 0) return;

    const verifiedRef = db.collection('verified_claims').doc(date);
    const existingSnap = await verifiedRef.get();
    const existingClaims = existingSnap.exists ? existingSnap.data().claims || [] : [];
    const alreadyVerifiedIds = new Set(existingClaims.map((c) => c.claim_id));

    const newClaims = allClaims.filter((c) => !alreadyVerifiedIds.has(claimId(c)));
    if (newClaims.length === 0) {
      console.log(`🔒 [evidenceVerifier] signals/${date}: no new claims since last run`);
      return;
    }

    const budget = await costGuard.checkBudget(db);
    const claudeClient = createClaudeClient(anthropicApiKey.value());

    const verifiedResults = [];
    const rejectReasonCounts = {};
    let tier3Calls = 0;

    for (const claim of newClaims) {
      const id = claimId(claim);

      if (!budget.ok) {
        verifiedResults.push({ ...claim, claim_id: id, verdict: 'REJECTED', reject_reason: 'cost_guard_exceeded', verified_at: new Date().toISOString() });
        rejectReasonCounts.cost_guard_exceeded = (rejectReasonCounts.cost_guard_exceeded || 0) + 1;
        continue;
      }

      const result = await verifyClaim(claim, { fetchFn: fetch, claudeClient });
      if (result.tier === 3) {
        tier3Calls++;
        await costGuard.recordUsage(db, 'claude', 800, 150).catch(() => {});
      }

      verifiedResults.push({
        ...claim,
        claim_id: id,
        verdict: result.verdict,
        reject_reason: result.reject_reason,
        tier: result.tier,
        detail: result.detail || null,
        verified_at: new Date().toISOString(),
      });
      if (result.reject_reason) {
        rejectReasonCounts[result.reject_reason] = (rejectReasonCounts[result.reject_reason] || 0) + 1;
      }
    }

    await verifiedRef.set({ claims: [...existingClaims, ...verifiedResults] }, { merge: true });

    // Flat top-level keys (reject_reason_<name>), not a nested map — avoids
    // relying on Firestore's dotted-field-path merge semantics for
    // something this simple to get right with plain top-level increments.
    const metricsUpdate = {
      date,
      processed: admin.firestore.FieldValue.increment(newClaims.length),
      supported: admin.firestore.FieldValue.increment(verifiedResults.filter((r) => r.verdict === 'SUPPORTED').length),
      rejected: admin.firestore.FieldValue.increment(verifiedResults.filter((r) => r.verdict === 'REJECTED').length),
      tier3Calls: admin.firestore.FieldValue.increment(tier3Calls),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    for (const [reason, count] of Object.entries(rejectReasonCounts)) {
      metricsUpdate[`reject_reason_${reason}`] = admin.firestore.FieldValue.increment(count);
    }

    await db.collection('metrics').doc('verifier').collection('dates').doc(date).set(metricsUpdate, { merge: true });

    console.log(`🔒 [evidenceVerifier] signals/${date}: processed ${newClaims.length} new claims`, {
      supported: verifiedResults.filter((r) => r.verdict === 'SUPPORTED').length,
      rejected: verifiedResults.filter((r) => r.verdict === 'REJECTED').length,
      rejectReasonCounts,
    });
  }
);

// ═══════════════════════════════════════════════════════════
// PHASE 3 — strategistAgent
//
// Weekly (Cloud Scheduler, T2 7h Asia/Ho_Chi_Minh — after the 3 sensors and
// evidenceVerifier have had time to run that same morning). Reads
// verified_claims/{date}, NEVER signals/{date} directly — only claims that
// already passed Gate #1. Generates candidate proposals with Claude Sonnet
// 5, then runs proposalConsistencyCheck + a plagiarism guard on every
// candidate (see functions/marketing/lib/proposalGates.js) before writing
// anything to proposals/. Does not execute anything — Phase 5's
// executorAgent doesn't exist yet; proposals just sit in Firestore for
// Phase 4 shadow-mode grading.
// ═══════════════════════════════════════════════════════════
exports.strategistAgent = functions.onRequest(
  {
    secrets: [appClientSecret, anthropicApiKey],
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  async (req, res) => {
    if (!isAuthorized(req)) return res.status(403).json({ error: 'Unauthorized' });
    try {
      const claudeClient = createClaudeClient(anthropicApiKey.value());
      const result = await runStrategistAgent({ db, claudeClient });
      console.log('📋 [strategistAgent]', result);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error('❌ [strategistAgent] failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);
