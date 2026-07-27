/**
 * Shared LLM spend guard for every Cloud Function that calls Gemini or Claude
 * (not just functions/marketing/** — scheduleContentGeneration, autoReplenishTopics
 * and weeklyAnalyticsReport in functions/index.js also call in). Two separate
 * providers, two separate billing accounts (Gemini via GCP, Claude via Anthropic),
 * so there is no single provider dashboard that shows total spend.
 * `metrics/costGuard/months/{YYYY-MM}` is that missing unified view: every function
 * that calls an LLM must call checkBudget() before the call and recordUsage() after
 * a successful one — no exceptions, including the smallest Gemini sensor call.
 *
 * Hard business requirement (set 2026-07-25): total spend across ALL models must
 * not exceed 50,000 VND/month. Usage is bucketed per MODEL (not per provider) below
 * because gemini-3.6-flash and gemini-3.1-flash-lite differ in price by ~6x — a
 * single blended "gemini" rate can't give an honest answer to "are we over budget".
 *
 * `db` is passed in explicitly (not read from admin.firestore() internally) so
 * this stays testable against the same in-memory Firestore stub pattern used by
 * functions/lib/__tests__/topic-dedup.test.js.
 */

// 50,000 VND/month hard cap, converted at ~26,500 VND/USD (2026-07-25) with a
// safety margin against exchange-rate drift: 50000/26500 = $1.887, capped at
// $1.85. This is a real ceiling now, not a loose circuit breaker — verify the
// VND/USD rate again if this ever needs to move.
const DEFAULT_MONTHLY_LIMIT_USD = 1.85;

// $/1M-token rates, verified against published provider pricing on 2026-07-25
// (see PR description for sources) — NOT a guess. Re-verify before trusting
// for a budget decision if it's been a while since that date.
const MODEL_RATES_PER_1M_TOKENS_USD = {
  'gemini-3.6-flash': { in: 1.5, out: 7.0 },
  'gemini-3.1-flash-lite': { in: 0.25, out: 1.5 },
  // Not independently verified — assumed same tier as 3.1-flash-lite. Only
  // used by the dormant pipeline.js chain (pipelineAnalyst/Reviewer), which
  // has no active Cloud Scheduler job right now. Re-verify before that chain
  // is ever wired back up.
  'gemini-3.0-flash-lite': { in: 0.25, out: 1.5 },
  // Anthropic intro pricing, guaranteed through 2026-08-31 — see
  // CLAUDE_SONNET_5_STANDARD_RATE below for what kicks in after that.
  'claude-sonnet-5': { in: 2.0, out: 10.0 },
};

// Standard Claude Sonnet 5 pricing from 2026-09-01 onward (+50% vs intro).
const CLAUDE_SONNET_5_STANDARD_RATE = { in: 3.0, out: 15.0 };
const CLAUDE_SONNET_5_INTRO_UNTIL = '2026-08-31';

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7); // 'YYYY-MM'
}

function rateForModel(model, date = new Date()) {
  if (model === 'claude-sonnet-5' && date.toISOString().slice(0, 10) > CLAUDE_SONNET_5_INTRO_UNTIL) {
    return CLAUDE_SONNET_5_STANDARD_RATE;
  }
  const rate = MODEL_RATES_PER_1M_TOKENS_USD[model];
  if (!rate) throw new Error(`costGuard: no rate configured for model "${model}" — add it to MODEL_RATES_PER_1M_TOKENS_USD first`);
  return rate;
}

function estimateCostUsd(usage, date = new Date()) {
  let total = 0;
  for (const [model, u] of Object.entries(usage)) {
    if (model === 'updatedAt' || !u || typeof u !== 'object') continue;
    // Skip fields with no configured rate instead of throwing — e.g. the bare
    // "gemini"/"claude" keys written before the 2026-07-25 per-model rework
    // (see metrics/costGuard/months/2026-07). recordUsage() still rejects
    // unknown models on write, so this only ever swallows stale/legacy data,
    // not a live bug — but without this guard, one bad field in this month's
    // doc throws checkBudget() for every caller (autoReplenishTopics,
    // scheduleContentGeneration, weeklyAnalyticsReport) for the rest of the month.
    if (!MODEL_RATES_PER_1M_TOKENS_USD[model]) continue;
    const rate = rateForModel(model, date);
    total += (u.tokensIn / 1e6) * rate.in + (u.tokensOut / 1e6) * rate.out;
  }
  return total;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{monthlyLimitUsd?: number, date?: Date}} [opts]
 * @returns {Promise<{ok: boolean, spentUsd: number, limitUsd: number, usage: object}>}
 */
async function checkBudget(db, opts = {}) {
  const { monthlyLimitUsd = DEFAULT_MONTHLY_LIMIT_USD, date = new Date() } = opts;
  const key = monthKey(date);
  const snap = await db.collection('metrics').doc('costGuard').collection('months').doc(key).get();
  const usage = snap.exists ? snap.data() : {};
  const spentUsd = estimateCostUsd(usage, date);
  return { ok: spentUsd < monthlyLimitUsd, spentUsd, limitUsd: monthlyLimitUsd, usage };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} model - e.g. 'gemini-3.6-flash', 'claude-sonnet-5' — must have an entry in MODEL_RATES_PER_1M_TOKENS_USD
 * @param {number} tokensIn
 * @param {number} tokensOut
 * @param {{date?: Date}} [opts]
 */
async function recordUsage(db, model, tokensIn, tokensOut, opts = {}) {
  if (!MODEL_RATES_PER_1M_TOKENS_USD[model]) {
    throw new Error(`recordUsage: unknown model "${model}" — add it to MODEL_RATES_PER_1M_TOKENS_USD first`);
  }
  const key = monthKey(opts.date);
  const ref = db.collection('metrics').doc('costGuard').collection('months').doc(key);
  const snap = await ref.get();
  const current = snap.exists ? snap.data() : {};
  const modelCurrent = current[model] || { calls: 0, tokensIn: 0, tokensOut: 0 };
  await ref.set(
    {
      [model]: {
        calls: modelCurrent.calls + 1,
        tokensIn: modelCurrent.tokensIn + tokensIn,
        tokensOut: modelCurrent.tokensOut + tokensOut,
      },
      updatedAt: opts.date ? opts.date.toISOString() : new Date().toISOString(),
    },
    { merge: true }
  );
}

module.exports = {
  checkBudget,
  recordUsage,
  estimateCostUsd,
  monthKey,
  rateForModel,
  DEFAULT_MONTHLY_LIMIT_USD,
  MODEL_RATES_PER_1M_TOKENS_USD,
  CLAUDE_SONNET_5_STANDARD_RATE,
  CLAUDE_SONNET_5_INTRO_UNTIL,
};
