/**
 * Plain assert-based test — run with:
 *   node functions/marketing/__tests__/costGuard.test.js
 */
const assert = require('assert');
const { checkBudget, recordUsage, DEFAULT_MONTHLY_LIMIT_USD } = require('../lib/costGuard');

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

const FIXED_DATE = new Date('2026-07-15T00:00:00Z');

// ── recordUsage accumulates across multiple calls ──
(async () => {
  const db = createFakeFirestore();

  await recordUsage(db, 'gemini', 1000, 200, { date: FIXED_DATE });
  await recordUsage(db, 'gemini', 500, 100, { date: FIXED_DATE });
  await recordUsage(db, 'claude', 800, 150, { date: FIXED_DATE });

  const doc = await db.collection('metrics').doc('costGuard').collection('months').doc('2026-07').get();
  const data = doc.data();
  assert.strictEqual(data.gemini.calls, 2, 'gemini calls should accumulate');
  assert.strictEqual(data.gemini.tokensIn, 1500, 'gemini tokensIn should accumulate');
  assert.strictEqual(data.gemini.tokensOut, 300, 'gemini tokensOut should accumulate');
  assert.strictEqual(data.claude.calls, 1, 'claude calls tracked independently of gemini');
  console.log('PASS: recordUsage accumulates per-provider across multiple calls');

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

  console.log('\nAll costGuard tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
