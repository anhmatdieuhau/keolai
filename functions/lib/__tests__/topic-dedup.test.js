/**
 * Plain assert-based test (no test runner is configured in this package) — run with:
 *   node functions/lib/__tests__/topic-dedup.test.js
 * Exercises evaluateTopicNovelty/registerTopicFingerprint against an in-memory Firestore
 * stub, so it needs no network/Vertex AI access. This is the guard for B6 (weak dedup) —
 * the two logic tiers in topic-dedup.js are the actual bug fix; this file is what proves
 * they work before they're wired into production.
 */
const assert = require('assert');
const { evaluateTopicNovelty, registerTopicFingerprint } = require('../topic-dedup');

// ── minimal in-memory Firestore stub — just enough surface for topic-dedup.js ──
function createFakeFirestore() {
  const store = new Map(); // collection -> Map(docId -> data)

  function collection(name) {
    if (!store.has(name)) store.set(name, new Map());
    const docs = store.get(name);
    return {
      doc(id) {
        return {
          async set(data) {
            docs.set(id, { ...data });
          },
        };
      },
      where(field, op, value) {
        assert.strictEqual(op, '==', 'fake Firestore stub only supports == filters');
        return {
          async limit() {
            return this;
          },
          limit(n) {
            const matches = [...docs.values()].filter((d) => d[field] === value).slice(0, n);
            return {
              async get() {
                return { empty: matches.length === 0, docs: matches.map((data) => ({ data: () => data })) };
              },
            };
          },
        };
      },
      limit(n) {
        const all = [...docs.values()].slice(0, n);
        return {
          async get() {
            return { empty: all.length === 0, docs: all.map((data) => ({ data: () => data })) };
          },
        };
      },
    };
  }

  return { collection };
}

async function run() {
  // ── Test 1: coarse fingerprint catches a rephrased duplicate, no embedFn needed ──
  {
    const fakeDb = createFakeFirestore();
    const candidate = { title: 'Chọn giống keo lai phù hợp cho vùng Tây Nguyên' };
    const first = await evaluateTopicNovelty(candidate, fakeDb);
    assert.strictEqual(first.status, 'novel', 'first candidate should be novel');
    await registerTopicFingerprint(fakeDb, {
      slug: 'chon-giong-keo-lai-phu-hop-vung-tay-nguyen',
      title: candidate.title,
      coarseFingerprint: first.coarseFingerprint,
      registeredAtValue: new Date(),
    });

    const rephrased = { title: 'Lựa chọn giống keo lai phù hợp với điều kiện khí hậu Tây Nguyên' };
    const second = await evaluateTopicNovelty(rephrased, fakeDb);
    assert.strictEqual(second.status, 'duplicate', 'rephrased title should be caught as duplicate');
    assert.strictEqual(second.method, 'coarse');
    assert.strictEqual(second.matchedSlug, 'chon-giong-keo-lai-phu-hop-vung-tay-nguyen');
    console.log('PASS: coarse fingerprint catches rephrased duplicate');
  }

  // ── Test 2: genuinely different topic is not flagged ──
  {
    const fakeDb = createFakeFirestore();
    await registerTopicFingerprint(fakeDb, {
      slug: 'bon-phan-cho-keo-lai',
      title: 'Bón phân cho keo lai',
      coarseFingerprint: 'bon-lai-nhan-phan', // whatever coarseFingerprint('Bón phân cho keo lai') computes to
      registeredAtValue: new Date(),
    });
    const different = await evaluateTopicNovelty({ title: 'Phòng trừ sâu bệnh keo lai mùa mưa' }, fakeDb);
    assert.strictEqual(different.status, 'novel', 'unrelated topic must not be flagged as duplicate');
    console.log('PASS: unrelated topic stays novel');
  }

  // ── Test 3: semantic tier catches a paraphrase the coarse tier misses, via injected embedFn ──
  {
    const fakeDb = createFakeFirestore();
    // Two vectors with cosine similarity ~0.99 — simulates "true paraphrase" the coarse
    // fingerprint wouldn't catch (totally different wording, same underlying topic).
    const VEC_A = [1, 0.1, 0.2];
    const VEC_B = [0.99, 0.12, 0.22];
    const embedFn = async (text) => (text.includes('mùa mưa') ? VEC_A : VEC_B);

    await registerTopicFingerprint(fakeDb, {
      slug: 'cham-soc-keo-lai-mua-mua',
      title: 'Chăm sóc keo lai mùa mưa',
      coarseFingerprint: 'zzz-does-not-match-on-purpose',
      embedding: VEC_A,
      registeredAtValue: new Date(),
    });

    const paraphrase = { title: 'Bí quyết dưỡng cây keo lai trong thời tiết ẩm ướt' };
    const result = await evaluateTopicNovelty(paraphrase, fakeDb, { embedFn, similarityThreshold: 0.85 });
    assert.strictEqual(result.status, 'duplicate', 'semantic tier should catch high-similarity paraphrase');
    assert.strictEqual(result.method, 'semantic');
    assert.strictEqual(result.matchedSlug, 'cham-soc-keo-lai-mua-mua');
    console.log('PASS: semantic tier catches paraphrase via injected embedFn');
  }

  // ── Test 4: semantic tier below threshold stays novel and returns its embedding for registration ──
  {
    const fakeDb = createFakeFirestore();
    const embedFn = async () => [0, 1, 0];
    await registerTopicFingerprint(fakeDb, {
      slug: 'unrelated-topic',
      title: 'Chủ đề khác hẳn',
      coarseFingerprint: 'khac-chu-de-han',
      embedding: [1, 0, 0], // orthogonal -> similarity 0
      registeredAtValue: new Date(),
    });
    const result = await evaluateTopicNovelty({ title: 'Một chủ đề mới hoàn toàn' }, fakeDb, { embedFn });
    assert.strictEqual(result.status, 'novel');
    assert.deepStrictEqual(result.embedding, [0, 1, 0]);
    console.log('PASS: low-similarity candidate stays novel and carries its embedding forward');
  }

  console.log('\nAll topic-dedup tests passed.');
}

run().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
