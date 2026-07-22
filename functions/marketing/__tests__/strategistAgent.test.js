/**
 * Plain assert-based test — run with:
 *   node functions/marketing/__tests__/strategistAgent.test.js
 * Full orchestration test with a fake Firestore + fake Claude client (no
 * network, no emulator) — covers the Phase 3 acceptance criteria that need
 * the real read/write wiring, not just the pure gate functions already
 * covered in proposalGates.test.js.
 */
const assert = require('assert');
const { runStrategistAgent, currentWeekKey, domainOf } = require('../strategist/strategistAgent');

// ── minimal in-memory Firestore stub, generic nested collection/doc paths + a
// `.where('url','==', x).limit(n).get()` shim scoped to the articles collection ──
function createFakeFirestore({ verifiedClaims = [], competitors = [], articles = [] } = {}) {
  const store = new Map();

  function makeDocRef(pathParts) {
    const key = pathParts.join('/');
    return {
      async get() {
        const data = store.get(key);
        return { exists: data !== undefined, data: () => data, docs: undefined };
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
    const name = pathParts[pathParts.length - 1];
    return {
      doc(id) {
        return makeDocRef([...pathParts, id]);
      },
      where(field, op, value) {
        if (name !== 'articles' || op !== '==') throw new Error('fake Firestore: only articles.where(field,"==",value) is supported');
        const matches = articles.filter((a) => a[field] === value);
        return {
          limit(n) {
            const limited = matches.slice(0, n);
            return { async get() { return { empty: limited.length === 0, docs: limited.map((a) => ({ data: () => a })) }; } };
          },
        };
      },
    };
  }

  const db = { collection: (name) => makeCollectionRef([name]), _store: store };

  // Seed fixed collections used by strategistAgent.
  store.set('verified_claims/2026-07-20', { claims: verifiedClaims });
  store.set('config/competitors', { domains: competitors });

  return db;
}

function fakeClaudeClient(responses) {
  const queue = [...responses];
  const calls = [];
  return {
    calls,
    async callJSON(args) {
      calls.push(args);
      const next = queue.shift();
      if (next === undefined) throw new Error('fakeClaudeClient: no more queued responses');
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

const FIXED_NOW = new Date('2026-07-22T12:00:00Z'); // same week as verified_claims/2026-07-20

(async () => {
  // ── currentWeekKey / domainOf sanity ──
  assert.strictEqual(currentWeekKey(FIXED_NOW), '2026-07-20');
  assert.strictEqual(domainOf('https://caygiongtuanphuong.com/san-pham/'), 'caygiongtuanphuong.com');
  assert.strictEqual(domainOf('not a url'), null);
  console.log('PASS: currentWeekKey/domainOf helpers');

  // ── no SUPPORTED claims -> no-op, LLM never called ──
  {
    const db = createFakeFirestore({ verifiedClaims: [{ claim_id: 'c1', verdict: 'REJECTED' }] });
    const claude = fakeClaudeClient([]);
    const result = await runStrategistAgent({ db, claudeClient: claude, now: FIXED_NOW });
    assert.strictEqual(result.proposalsGenerated, 0);
    assert.strictEqual(result.reason, 'no_supported_claims');
    assert.strictEqual(claude.calls.length, 0);
    console.log('PASS: no SUPPORTED claims -> no-op, Claude never called');
  }

  // ── happy path: valid proposal citing real evidence, targeting a real article ──
  {
    const db = createFakeFirestore({
      verifiedClaims: [
        { claim_id: 'c1', verdict: 'SUPPORTED', category: 'decay', claim: 'Bài X suy giảm 40% impression', source_url: 'https://keolaigiamhom.vn/articles/x/', evidence_snippet: 'impressions past=100 current=60' },
      ],
      articles: [{ url: 'https://keolaigiamhom.vn/articles/x/', title: 'Bài X cũ', description: 'Mô tả cũ', slug: 'x' }],
    });
    const claude = fakeClaudeClient([
      {
        proposals: [
          {
            action_type: 'update_meta',
            target_url: 'https://keolaigiamhom.vn/articles/x/',
            rationale: 'Bài suy giảm impression, cần làm mới meta để cải thiện CTR',
            claims: [{ statement: 'Bài X suy giảm 40% impression', evidence_refs: ['c1'] }],
            expected_impact: 'Tăng CTR nhờ meta hấp dẫn hơn',
            effort: 'low',
            confidence: 0.8,
            proposed_change: 'Meta title/description mới, viết lại hoàn toàn độc lập không liên quan đối thủ',
          },
        ],
      },
      { verdict: 'SUPPORTED', reason: 'khớp đúng evidence' }, // consistency check for the 1 claim above
    ]);

    const result = await runStrategistAgent({ db, claudeClient: claude, now: FIXED_NOW });
    assert.strictEqual(result.proposalsGenerated, 1);
    const written = db._store.get(`proposals/${result.proposalIds[0]}`);
    assert.strictEqual(written.action_type, 'update_meta');
    assert.strictEqual(written.requires_human_approval, false);
    assert.deepStrictEqual(written.before_snapshot, { title: 'Bài X cũ', description: 'Mô tả cũ', slug: 'x', captured_at: FIXED_NOW.toISOString() });
    assert.strictEqual(written.status, 'shadow');
    console.log('PASS: happy path — valid proposal written to proposals/ with correct before_snapshot + requires_human_approval=false');
  }

  // ── unknown evidence_ref -> rejected, nothing written ──
  {
    const db = createFakeFirestore({
      verifiedClaims: [{ claim_id: 'c1', verdict: 'SUPPORTED', category: 'decay', claim: 'x', source_url: 'https://keolaigiamhom.vn/articles/x/', evidence_snippet: 'y' }],
      articles: [{ url: 'https://keolaigiamhom.vn/articles/x/', title: 'X', description: 'd', slug: 'x' }],
    });
    const claude = fakeClaudeClient([
      {
        proposals: [
          {
            action_type: 'update_meta',
            target_url: 'https://keolaigiamhom.vn/articles/x/',
            rationale: 'r',
            claims: [{ statement: 's', evidence_refs: ['claim-that-was-never-verified'] }],
            expected_impact: 'i',
            effort: 'low',
            confidence: 0.5,
            proposed_change: 'c',
          },
        ],
      },
    ]);
    const result = await runStrategistAgent({ db, claudeClient: claude, now: FIXED_NOW });
    assert.strictEqual(result.proposalsGenerated, 0);
    assert.strictEqual(result.rejectReasonCounts.unknown_evidence_ref, 1);
    console.log('PASS: proposal citing an unverified claim_id is rejected, nothing written (consistency check never runs — cheaper gate fails first)');
  }

  // ── target_url not found -> rejected before any consistency-check LLM call ──
  {
    const db = createFakeFirestore({
      verifiedClaims: [{ claim_id: 'c1', verdict: 'SUPPORTED', category: 'decay', claim: 'x', source_url: 'https://keolaigiamhom.vn/articles/x/', evidence_snippet: 'y' }],
      articles: [], // no real article at all
    });
    const claude = fakeClaudeClient([
      {
        proposals: [
          {
            action_type: 'update_meta',
            target_url: 'https://keolaigiamhom.vn/articles/does-not-exist/',
            rationale: 'r',
            claims: [{ statement: 's', evidence_refs: ['c1'] }],
            expected_impact: 'i',
            effort: 'low',
            confidence: 0.5,
            proposed_change: 'c',
          },
        ],
      },
    ]);
    const result = await runStrategistAgent({ db, claudeClient: claude, now: FIXED_NOW });
    assert.strictEqual(result.proposalsGenerated, 0);
    assert.strictEqual(result.rejectReasonCounts.target_url_not_found, 1);
    assert.strictEqual(claude.calls.length, 1, 'only the generation call should have happened — consistency check must not run for an unresolvable target');
    console.log('PASS: target_url that does not match a real article is rejected (fail-closed against hallucinated/competitor URLs)');
  }

  // ── update_data always requires_human_approval, even though it targets a real article ──
  {
    const db = createFakeFirestore({
      verifiedClaims: [{ claim_id: 'c1', verdict: 'SUPPORTED', category: 'demand', claim: 'x', source_url: 'https://keolaigiamhom.vn/articles/x/', evidence_snippet: 'y' }],
      articles: [{ url: 'https://keolaigiamhom.vn/articles/x/', title: 'X', description: 'd', slug: 'x' }],
    });
    const claude = fakeClaudeClient([
      {
        proposals: [
          {
            action_type: 'update_data',
            target_url: 'https://keolaigiamhom.vn/articles/x/',
            rationale: 'r',
            claims: [{ statement: 's', evidence_refs: ['c1'] }],
            expected_impact: 'i',
            effort: 'medium',
            confidence: 0.6,
            proposed_change: 'c',
          },
        ],
      },
      { verdict: 'SUPPORTED', reason: 'ok' },
    ]);
    const result = await runStrategistAgent({ db, claudeClient: claude, now: FIXED_NOW });
    assert.strictEqual(result.proposalsGenerated, 1);
    const written = db._store.get(`proposals/${result.proposalIds[0]}`);
    assert.strictEqual(written.requires_human_approval, true);
    console.log('PASS: update_data proposal is written with requires_human_approval=true, unconditionally');
  }

  // ── propose_new_article: no existing target required, before_snapshot is null ──
  {
    const db = createFakeFirestore({
      verifiedClaims: [{ claim_id: 'c1', verdict: 'SUPPORTED', category: 'gap', claim: 'đối thủ có chủ đề mới', source_url: 'https://caygiongtuanphuong.com/cay-trac/', evidence_snippet: 'nội dung về cây trắc giống' }],
      competitors: ['caygiongtuanphuong.com'],
      articles: [],
    });
    const claude = fakeClaudeClient([
      {
        proposals: [
          {
            action_type: 'propose_new_article',
            target_url: '/articles/cay-trac-giong-moi/',
            rationale: 'r',
            claims: [{ statement: 's', evidence_refs: ['c1'] }],
            expected_impact: 'i',
            effort: 'high',
            confidence: 0.5,
            proposed_change: 'Nội dung hoàn toàn độc lập, tự viết dựa trên kiến thức chung về cây trắc, không liên quan văn phong đối thủ',
          },
        ],
      },
      { verdict: 'SUPPORTED', reason: 'ok' },
    ]);
    const result = await runStrategistAgent({ db, claudeClient: claude, now: FIXED_NOW });
    assert.strictEqual(result.proposalsGenerated, 1);
    const written = db._store.get(`proposals/${result.proposalIds[0]}`);
    assert.strictEqual(written.before_snapshot, null);
    assert.strictEqual(written.requires_human_approval, true);
    console.log('PASS: propose_new_article does not require an existing target_url, before_snapshot is null');
  }

  // ── plagiarism guard wired end-to-end: proposed_change echoes a competitor evidence_snippet ──
  {
    const competitorSnippet = 'Cây trắc giống được ươm từ hạt tuyển chọn, thời gian sinh trưởng nhanh, phù hợp đất đồi núi cao';
    const db = createFakeFirestore({
      verifiedClaims: [{ claim_id: 'c1', verdict: 'SUPPORTED', category: 'gap', claim: 'đối thủ có chủ đề mới', source_url: 'https://caygiongtuanphuong.com/cay-trac/', evidence_snippet: competitorSnippet }],
      competitors: ['caygiongtuanphuong.com'],
      articles: [],
    });
    const claude = fakeClaudeClient([
      {
        proposals: [
          {
            action_type: 'propose_new_article',
            target_url: '/articles/cay-trac-giong-moi/',
            rationale: 'r',
            claims: [{ statement: 's', evidence_refs: ['c1'] }],
            expected_impact: 'i',
            effort: 'high',
            confidence: 0.5,
            proposed_change: competitorSnippet, // copied near-verbatim
          },
        ],
      },
      { verdict: 'SUPPORTED', reason: 'ok' },
    ]);
    const result = await runStrategistAgent({ db, claudeClient: claude, now: FIXED_NOW });
    assert.strictEqual(result.proposalsGenerated, 0);
    assert.strictEqual(result.rejectReasonCounts.possible_plagiarism, 1);
    console.log('PASS: proposed_change that echoes competitor evidence_snippet is rejected end-to-end (possible_plagiarism)');
  }

  // ── costGuard exceeded -> skip entirely, Claude never called ──
  {
    const db = createFakeFirestore({ verifiedClaims: [{ claim_id: 'c1', verdict: 'SUPPORTED' }] });
    // Seed costGuard's month doc with spend already over DEFAULT_MONTHLY_LIMIT_USD ($10).
    const monthKey = FIXED_NOW.toISOString().slice(0, 7);
    db._store.set(`metrics/costGuard/months/${monthKey}`, { claude: { calls: 1000, tokensIn: 50_000_000, tokensOut: 10_000_000 } });
    const claude = fakeClaudeClient([]);
    const result = await runStrategistAgent({ db, claudeClient: claude, now: FIXED_NOW });
    assert.strictEqual(result.skipped, 'cost_guard_exceeded');
    assert.strictEqual(claude.calls.length, 0);
    console.log('PASS: costGuard budget exceeded -> run skipped entirely, Claude never called');
  }

  console.log('\nAll strategistAgent tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
