/**
 * Plain assert-based test — run with:
 *   node functions/marketing/__tests__/gscDemandScan.test.js
 * No network access: both the Firestore client and the GSC client are fakes.
 */
const assert = require('assert');
const { runGscDemandScan, currentWeekKey } = require('../sensors/gscDemandScan');

// ── minimal in-memory Firestore stub ──
function createFakeFirestore(fingerprintDocs = []) {
  const store = new Map(); // 'collection/doc' -> data
  return {
    collection(name) {
      return {
        async get() {
          if (name === 'topic_fingerprints') {
            return { docs: fingerprintDocs.map((d) => ({ data: () => d })) };
          }
          return { docs: [] };
        },
        doc(id) {
          return {
            async set(data, options) {
              const key = `${name}/${id}`;
              const existing = store.get(key) || {};
              store.set(key, options && options.merge ? { ...existing, ...data } : data);
            },
          };
        },
      };
    },
    _store: store,
  };
}

function fakeSearchconsole(rows) {
  return { searchanalytics: { query: async () => ({ data: { rows } }) } };
}

(async () => {
  // ── currentWeekKey returns a Monday ──
  const someWednesday = new Date('2026-07-22T12:00:00Z'); // 2026-07-22 is a Wednesday
  const key = currentWeekKey(someWednesday);
  assert.strictEqual(key, '2026-07-20', 'currentWeekKey should resolve to the Monday of that week');
  console.log('PASS: currentWeekKey resolves to the correct Monday');

  // ── striking-distance detection ──
  const rows = [
    // position 8, decent impressions, low CTR -> striking distance
    { keys: ['kỹ thuật trồng keo lai', '/articles/ky-thuat-trong-keo-lai/'], position: 8.2, impressions: 500, clicks: 3, ctr: 0.006 },
    // position 3 (too good, not striking distance) -> excluded
    { keys: ['giá keo lai', '/articles/gia-keo-lai/'], position: 3.1, impressions: 800, clicks: 100, ctr: 0.125 },
    // position 10 but too few impressions -> excluded
    { keys: ['sâu bệnh hiếm gặp keo lai', '/articles/sau-benh/'], position: 10, impressions: 3, clicks: 0, ctr: 0 },
    // uncovered demand: decent impressions, fingerprint not registered
    { keys: ['máy cày đất trồng keo lai', '/articles/ky-thuat-trong-keo-lai/'], position: 25, impressions: 40, clicks: 1, ctr: 0.025 },
  ];

  // Both already-ranking topics ("kỹ thuật trồng keo lai" pos 8, "giá keo lai" pos
  // 3) realistically already have a registered fingerprint from their existing
  // article — only the position-25 "máy cày đất..." row is genuinely uncovered.
  const { coarseFingerprint } = require('../../lib/topic-dedup');
  const fingerprints = [
    { coarseFingerprint: coarseFingerprint('kỹ thuật trồng keo lai') },
    { coarseFingerprint: coarseFingerprint('giá keo lai') },
  ];
  const db = createFakeFirestore(fingerprints);
  const searchconsole = fakeSearchconsole(rows);

  const result = await runGscDemandScan({ db, searchconsole, now: someWednesday });

  assert.strictEqual(result.strikingDistanceCount, 1, 'exactly 1 row should qualify as striking-distance');
  assert.strictEqual(result.uncoveredDemandCount, 1, 'exactly 1 row should qualify as uncovered demand');
  console.log('PASS: striking-distance and uncovered-demand thresholds filter correctly');

  const written = db._store.get(`signals/${key}`);
  assert.ok(written, 'must write to signals/{weekKey}');
  assert.strictEqual(written.demand.length, 2);
  for (const claim of written.demand) {
    assert.ok(claim.claim && typeof claim.claim === 'string');
    assert.ok(claim.source_url);
    assert.ok(claim.retrieved_at);
    assert.ok(claim.evidence_snippet);
    assert.ok(claim.raw_api_response, 'every claim must carry raw_api_response for evidenceVerifier tier-2');
  }
  console.log('PASS: written claims have the required shape (claim/source_url/retrieved_at/evidence_snippet/raw_api_response)');

  // ── claim text contains only real numbers from the row, nothing invented ──
  const strikingClaim = written.demand.find((c) => c.claim.includes('kỹ thuật trồng keo lai'));
  assert.ok(strikingClaim.claim.includes('500'), 'claim text must include the real impressions figure');
  assert.ok(strikingClaim.claim.includes('8.2'), 'claim text must include the real position figure');
  console.log('PASS: claim text is built from real row data, not generated prose');

  // ── module has no LLM dependency ──
  const fs = require('fs');
  const source = fs.readFileSync(require.resolve('../sensors/gscDemandScan'), 'utf8');
  assert.ok(!source.includes('fetch('), 'gscDemandScan must not call an LLM — pure arithmetic on GSC data');
  console.log('PASS: gscDemandScan has no fetch()/LLM call');

  console.log('\nAll gscDemandScan tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
