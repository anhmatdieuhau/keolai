/**
 * Plain assert-based test — run with:
 *   node functions/marketing/__tests__/serpGapScan.test.js
 * No network access: fetchFn and geminiClient are both fakes.
 */
const assert = require('assert');
const { runSerpGapScan, extractSitemapUrls, slugToWords, tokenOverlapRatio } = require('../sensors/serpGapScan');

// ── pure helpers ──
{
  const urls = extractSitemapUrls(`<?xml version="1.0"?><urlset>
    <url><loc>https://example.com/a/</loc></url>
    <url><loc>https://example.com/b/</loc></url>
  </urlset>`);
  assert.deepStrictEqual(urls, ['https://example.com/a/', 'https://example.com/b/']);
  console.log('PASS: extractSitemapUrls parses <loc> entries');

  assert.deepStrictEqual(slugToWords('https://x.com/ky-thuat-trong-keo-lai/'), ['ky', 'thuat']);
  console.log('PASS: slugToWords splits a URL slug into words, strips site-ubiquitous stopwords (keo/lai/trong/...)');

  assert.strictEqual(tokenOverlapRatio(['ky', 'thuat', 'trong'], ['ky', 'thuat', 'cham', 'soc']), 2 / 3);
  assert.strictEqual(tokenOverlapRatio([], ['a']), 0);
  console.log('PASS: tokenOverlapRatio computes shared-word ratio, handles empty input');
}

// ── fake Firestore: config/competitors + articles ──
function createFakeFirestore({ domains, articleSlugs }) {
  return {
    collection(name) {
      if (name === 'config') {
        return { doc: () => ({ async get() { return { exists: true, data: () => ({ domains }) }; } }) };
      }
      if (name === 'articles') {
        return {
          async get() {
            return { docs: articleSlugs.map((slug) => ({ data: () => ({ slug, title: slug.replace(/-/g, ' ') }) })) };
          },
        };
      }
      if (name === 'signals') {
        return { doc: (id) => ({ async set(data) { this._captured = data; }, }) };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

function withSignalsCapture(db) {
  const captured = {};
  const orig = db.collection.bind(db);
  db.collection = (name) => {
    if (name === 'signals') return { doc: (id) => ({ async set(data) { captured[id] = data; } }) };
    return orig(name);
  };
  db._captured = captured;
  return db;
}

(async () => {
  const now = new Date('2026-07-22T12:00:00Z'); // Monday key: 2026-07-20

  // Sitemap has 2 URLs: one overlaps heavily with our existing article
  // ("ky-thuat-trong-keo-lai" vs our "ky-thuat-trong-keo-lai-ah1" — should be
  // pre-filtered out without ever calling fetch on the page or the LLM), one
  // is a genuine gap candidate.
  const sitemapXml = `<urlset>
    <url><loc>https://competitor.com/ky-thuat-trong-keo-lai/</loc></url>
    <url><loc>https://competitor.com/che-bien-go-keo-lai-xuat-khau/</loc></url>
  </urlset>`;

  let pageFetchCount = 0;
  let judgeCallCount = 0;

  const fetchFn = async (url) => {
    if (url.endsWith('sitemap.xml')) {
      return { ok: true, async text() { return sitemapXml; } };
    }
    if (url.includes('che-bien-go-keo-lai-xuat-khau')) {
      pageFetchCount++;
      return { ok: true, async text() { return '<html><body>Nội dung về chế biến gỗ keo lai xuất khẩu...</body></html>'; } };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const geminiClient = {
    async callJSON() {
      judgeCallCount++;
      return { is_gap: true, reason: 'Chế biến gỗ xuất khẩu chưa có bài viết tương ứng' };
    },
  };

  const db = withSignalsCapture(
    createFakeFirestore({ domains: ['competitor.com'], articleSlugs: ['ky-thuat-trong-keo-lai-ah1'] })
  );

  const result = await runSerpGapScan({ db, fetchFn, geminiClient, now });

  assert.strictEqual(pageFetchCount, 1, 'only the low-overlap candidate should trigger a page fetch — the near-duplicate must be pre-filtered without any network call');
  assert.strictEqual(judgeCallCount, 1, 'only the low-overlap candidate should reach the LLM judge');
  assert.strictEqual(result.claimsCount, 1);
  console.log('PASS: pre-filter skips near-duplicate URLs before spending a fetch or an LLM call on them');

  const written = db._captured['2026-07-20'];
  assert.strictEqual(written.gap.length, 1);
  const claim = written.gap[0];
  assert.ok(claim.claim.includes('competitor.com'));
  assert.ok(claim.evidence_snippet.includes('chế biến gỗ keo lai xuất khẩu'), 'evidence_snippet must be real fetched page text, not invented');
  assert.strictEqual(claim.source_url, 'https://competitor.com/che-bien-go-keo-lai-xuat-khau/');
  console.log('PASS: gap claim carries real evidence_snippet and source_url from the actual fetched page');

  // ── fail-closed: judge error must not produce a claim ──
  const failingGemini = { async callJSON() { throw new Error('judge unavailable'); } };
  const db2 = withSignalsCapture(
    createFakeFirestore({ domains: ['competitor.com'], articleSlugs: ['ky-thuat-trong-keo-lai-ah1'] })
  );
  const result2 = await runSerpGapScan({ db: db2, fetchFn, geminiClient: failingGemini, now });
  assert.strictEqual(result2.claimsCount, 0, 'a judge failure must produce zero claims, not a guessed one');
  assert.ok(result2.errors.length > 0);
  console.log('PASS: fail-closed — LLM judge error produces no claim, logged as an error instead');

  console.log('\nAll serpGapScan tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
