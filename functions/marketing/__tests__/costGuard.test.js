/**
 * Plain assert-based test — run with:
 *   node functions/marketing/__tests__/costGuard.test.js
 */
const assert = require('assert');
const { checkBudget, recordUsage, rateForModel, DEFAULT_MONTHLY_LIMIT_USD } = require('../lib/costGuard');

// ── minimal in-memory Firestore stub supporting nested collection/doc paths ──
function createFakeFirestore() {
  const store = new Map(); // full path string -> data object

  function makeDocRef(pathParts) {
    const key = pathParts.join('/');
    return {
      async get() {
        const data = store.get(key);
        return { exists: data !== undefined, data: () => data };
      },
      async set(data, options) {
        const existing = store.get(key) || {};
        store.set(key, options && options.merge ? { ...existing, ...data } : data);
      },
      collection(name) {
        return makeCollectionRef([...pathParts, name]);
      },
    };
  }

  function makeCollectionRef(pathParts) {
    return {
      doc(id) {
        return makeDocRef([...pathParts, id]);
      },
    };
  }

  return { collection: (name) => makeCollectionRef([name]), _store: store };
}

const FIXED_DATE = new Date('2026-07-15T00:00:00Z'); // before the 2026-08-31 Claude intro-pricing cutoff
const POST_CUTOFF_DATE = new Date('2026-09-15T00:00:00Z'); // after it

(async () => {
  const db = createFakeFirestore();

  await recordUsage(db, 'gemini-3.6-flash', 1000, 200, { date: FIXED_DATE });
  await recordUsage(db, 'gemini-3.6-flash', 500, 100, { date: FIXED_DATE });
  await recordUsage(db, 'claude-sonnet-5', 800, 150, { date: FIXED_DATE });

  const doc = await db.collection('metrics').doc('costGuard').collection('months').doc('2026-07').get();
  const data = doc.data();
  assert.strictEqual(data['gemini-3.6-flash'].calls, 2, 'usage should accumulate per model');
  assert.strictEqual(data['gemini-3.6-flash'].tokensIn, 1500, 'tokensIn should accumulate');
  assert.strictEqual(data['gemini-3.6-flash'].tokensOut, 300, 'tokensOut should accumulate');
  assert.strictEqual(data['claude-sonnet-5'].calls, 1, 'each model tracked independently');
  console.log('PASS: recordUsage accumulates per-model across multiple calls');

  // ── recordUsage rejects a model with no configured rate ──
  await assert.rejects(() => recordUsage(db, 'gpt-4o', 100, 100), /unknown model/);
  console.log('PASS: recordUsage rejects an unconfigured model instead of silently under-counting');

  // ── checkBudget reflects recorded usage and stays ok under the default limit ──
  const status = await checkBudget(db, { date: FIXED_DATE });
  assert.strictEqual(status.ok, true, 'tiny usage should stay well under the default budget');
  assert.strictEqual(status.limitUsd, DEFAULT_MONTHLY_LIMIT_USD);
  console.log('PASS: checkBudget reports ok=true for small accumulated usage');

  // ── checkBudget trips false once simulated usage exceeds a tight limit ──
  const tight = await checkBudget(db, { date: FIXED_DATE, monthlyLimitUsd: 0.00001 });
  assert.strictEqual(tight.ok, false, 'checkBudget must report false once spend exceeds the configured limit');
  console.log('PASS: checkBudget trips ok=false once spend exceeds a tight limit');

  // ── checkBudget on an empty/new month never throws, defaults to ok=true ──
  const freshDb = createFakeFirestore();
  const fresh = await checkBudget(freshDb, { date: FIXED_DATE });
  assert.strictEqual(fresh.ok, true, 'a month with no recorded usage yet must be ok');
  assert.strictEqual(fresh.spentUsd, 0);
  console.log('PASS: checkBudget on a fresh month with no usage returns ok=true, spentUsd=0');

  // ── the real-world default cap is ~50,000 VND/month (~$1.85 @ ~26,500 VND/USD) ──
  assert.ok(DEFAULT_MONTHLY_LIMIT_USD <= 1.9 && DEFAULT_MONTHLY_LIMIT_USD >= 1.8, 'default cap should sit just under the 50k VND/$1.887 line');
  console.log('PASS: DEFAULT_MONTHLY_LIMIT_USD matches the 50,000 VND/month business requirement');

  // ── gemini-3.6-flash costs meaningfully more than gemini-3.1-flash-lite ──
  const flashRate = rateForModel('gemini-3.6-flash', FIXED_DATE);
  const liteRate = rateForModel('gemini-3.1-flash-lite', FIXED_DATE);
  assert.ok(flashRate.in > liteRate.in * 3, '3.6-flash input should be several times pricier than flash-lite');
  assert.ok(flashRate.out > liteRate.out * 3, '3.6-flash output should be several times pricier than flash-lite');
  console.log('PASS: gemini-3.6-flash is priced well above gemini-3.1-flash-lite, matching published rates');

  // ── Claude Sonnet 5 switches to standard pricing after the 2026-08-31 intro window ──
  const introRate = rateForModel('claude-sonnet-5', FIXED_DATE);
  const standardRate = rateForModel('claude-sonnet-5', POST_CUTOFF_DATE);
  assert.deepStrictEqual(introRate, { in: 2.0, out: 10.0 });
  assert.deepStrictEqual(standardRate, { in: 3.0, out: 15.0 });
  console.log('PASS: claude-sonnet-5 rate steps up to standard pricing after 2026-08-31');

  // ── estimateCostUsd picks up the post-cutoff Claude rate for spend recorded after it ──
  const postCutoffDb = createFakeFirestore();
  await recordUsage(postCutoffDb, 'claude-sonnet-5', 1_000_000, 1_000_000, { date: POST_CUTOFF_DATE });
  const postCutoffStatus = await checkBudget(postCutoffDb, { date: POST_CUTOFF_DATE, monthlyLimitUsd: 100 });
  assert.strictEqual(postCutoffStatus.spentUsd, 3.0 + 15.0, 'post-cutoff spend must use the $3/$15 standard rate, not the $2/$10 intro rate');
  console.log('PASS: checkBudget uses standard Claude pricing for usage dated after the intro window');

  console.log('\nAll costGuard tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
