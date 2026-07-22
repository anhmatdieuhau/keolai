/**
 * Shared LLM spend guard for functions/marketing/** — the marketing-agent system
 * calls two separate LLM providers with two separate billing accounts (Gemini via
 * GCP, Claude via Anthropic), so there is no single provider dashboard that shows
 * total spend. `metrics/costGuard/{YYYY-MM}` is that missing unified view: every
 * function that calls an LLM (sensor, verifier, strategist, executor) must call
 * checkBudget() before the call and recordUsage() after a successful one — no
 * exceptions, including the smallest Gemini sensor call.
 *
 * `db` is passed in explicitly (not read from admin.firestore() internally) so
 * this stays testable against the same in-memory Firestore stub pattern used by
 * functions/lib/__tests__/topic-dedup.test.js.
 */

// Deliberately well above the Phase 3 cost estimate (~$1-1.5/month combined) —
// this is a runaway-cost circuit breaker, not a precise monthly cap.
const DEFAULT_MONTHLY_LIMIT_USD = 10;

// Rough $/1K-token rates used only for the budget check itself (not billing).
// Sonnet 5 intro pricing through 2026-08-31; revisit after that date.
const RATES_PER_1K_TOKENS_USD = {
  gemini: { in: 0.0001, out: 0.0004 }, // Flash-Lite/Flash blended estimate
  claude: { in: 0.002, out: 0.01 }, // Claude Sonnet 5 intro pricing
};

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7); // 'YYYY-MM'
}

function estimateCostUsd(usage) {
  let total = 0;
  for (const provider of ['gemini', 'claude']) {
    const u = usage[provider];
    const rate = RATES_PER_1K_TOKENS_USD[provider];
    if (!u || !rate) continue;
    total += (u.tokensIn / 1000) * rate.in + (u.tokensOut / 1000) * rate.out;
  }
  return total;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{monthlyLimitUsd?: number, date?: Date}} [opts]
 * @returns {Promise<{ok: boolean, spentUsd: number, limitUsd: number, usage: object}>}
 */
async function checkBudget(db, opts = {}) {
  const { monthlyLimitUsd = DEFAULT_MONTHLY_LIMIT_USD, date } = opts;
  const key = monthKey(date);
  const snap = await db.collection('metrics').doc('costGuard').collection('months').doc(key).get();
  const usage = snap.exists ? snap.data() : { gemini: { calls: 0, tokensIn: 0, tokensOut: 0 }, claude: { calls: 0, tokensIn: 0, tokensOut: 0 } };
  const spentUsd = estimateCostUsd(usage);
  return { ok: spentUsd < monthlyLimitUsd, spentUsd, limitUsd: monthlyLimitUsd, usage };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {'gemini'|'claude'} provider
 * @param {number} tokensIn
 * @param {number} tokensOut
 * @param {{date?: Date}} [opts]
 */
async function recordUsage(db, provider, tokensIn, tokensOut, opts = {}) {
  if (provider !== 'gemini' && provider !== 'claude') {
    throw new Error(`recordUsage: unknown provider "${provider}"`);
  }
  const key = monthKey(opts.date);
  const ref = db.collection('metrics').doc('costGuard').collection('months').doc(key);
  const snap = await ref.get();
  const current = snap.exists ? snap.data() : {};
  const providerCurrent = current[provider] || { calls: 0, tokensIn: 0, tokensOut: 0 };
  await ref.set(
    {
      [provider]: {
        calls: providerCurrent.calls + 1,
        tokensIn: providerCurrent.tokensIn + tokensIn,
        tokensOut: providerCurrent.tokensOut + tokensOut,
      },
      updatedAt: opts.date ? opts.date.toISOString() : new Date().toISOString(),
    },
    { merge: true }
  );
}

module.exports = { checkBudget, recordUsage, estimateCostUsd, monthKey, DEFAULT_MONTHLY_LIMIT_USD };
