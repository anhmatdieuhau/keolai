/**
 * Plain assert-based test — run with:
 *   node functions/marketing/__tests__/contentDecayScan.test.js
 */
const assert = require('assert');
const { runContentDecayScan } = require('../sensors/contentDecayScan');

// ── minimal in-memory Firestore stub: articles/{slug} + articles/{slug}/analytics/{date} ──
function createFakeFirestore(articles) {
  // articles: { [slug]: { title, url, analytics: { [date]: {...} } } }
  return {
    collection(name) {
      if (name !== 'articles') {
        // signals write target
        return {
          doc: (id) => ({
            async set(data, options) {
              this._written = this._written || {};
            },
          }),
        };
      }
      return {
        async get() {
          return {
            size: Object.keys(articles).length,
            docs: Object.entries(articles).map(([slug, data]) => ({
              id: slug,
              data: () => ({ title: data.title, url: data.url }),
            })),
          };
        },
        doc(slug) {
          return {
            collection(sub) {
              assert.strictEqual(sub, 'analytics');
              const snapshots = articles[slug]?.analytics || {};
              return {
                async get() {
                  return {
                    docs: Object.entries(snapshots).map(([date, data]) => ({
                      data: () => ({ sync_date: date, ...data }),
                    })),
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

// Wrap the real db so we capture what gets written to signals/{date}.
function withSignalsCapture(fakeDb) {
  const captured = {};
  const originalCollection = fakeDb.collection.bind(fakeDb);
  fakeDb.collection = (name) => {
    if (name === 'signals') {
      return {
        doc: (id) => ({
          async set(data) {
            captured[id] = data;
          },
        }),
      };
    }
    return originalCollection(name);
  };
  fakeDb._captured = captured;
  return fakeDb;
}

(async () => {
  const now = new Date('2026-07-22T12:00:00Z');

  const articles = {
    'decayed-article': {
      title: 'Bài suy giảm',
      url: 'https://keolaigiamhom.vn/articles/decayed-article/',
      analytics: {
        '2026-06-24': { gsc_impressions_28d: 500, gsc_avg_position: 6.0 }, // ~28 days before "now"
        '2026-07-21': { gsc_impressions_28d: 200, gsc_avg_position: 12.0 }, // current — big drop
      },
    },
    'stable-article': {
      title: 'Bài ổn định',
      url: 'https://keolaigiamhom.vn/articles/stable-article/',
      analytics: {
        '2026-06-24': { gsc_impressions_28d: 300, gsc_avg_position: 8.0 },
        '2026-07-21': { gsc_impressions_28d: 290, gsc_avg_position: 8.2 }, // basically unchanged
      },
    },
    'no-history-article': {
      title: 'Bài chưa có lịch sử',
      url: 'https://keolaigiamhom.vn/articles/no-history-article/',
      analytics: {}, // simulates contentAnalyticsSync not having run yet for this slug
    },
    'low-volume-article': {
      title: 'Bài lưu lượng thấp',
      url: 'https://keolaigiamhom.vn/articles/low-volume-article/',
      analytics: {
        '2026-06-24': { gsc_impressions_28d: 3, gsc_avg_position: 20 }, // below MIN_PAST_IMPRESSIONS
        '2026-07-21': { gsc_impressions_28d: 0, gsc_avg_position: null },
      },
    },
  };

  const db = withSignalsCapture(createFakeFirestore(articles));
  const result = await runContentDecayScan({ db, now });

  assert.strictEqual(result.articlesScanned, 4);
  assert.strictEqual(result.skippedNoHistory, 1, 'the article with an empty analytics subcollection must be skipped, not crash');
  assert.strictEqual(result.claimsCount, 1, 'only the genuinely decayed article should produce a claim');
  console.log('PASS: scans all articles, skips missing history gracefully, flags only real decay');

  const written = db._captured['2026-07-20']; // Monday of 2026-07-22
  assert.ok(written, 'must write to signals/{weekKey}');
  assert.strictEqual(written.decay.length, 1);
  const claim = written.decay[0];
  assert.ok(claim.claim.includes('Bài suy giảm'), 'claim sentence should reference the real article title');
  assert.ok(claim.claim.includes('500'), 'must cite the real past impressions number');
  assert.ok(claim.claim.includes('200'), 'must cite the real current impressions number');
  assert.ok(claim.raw_api_response.past && claim.raw_api_response.current, 'raw_api_response must carry both snapshots for evidenceVerifier tier-2');
  console.log('PASS: decay claim cites real numbers from both snapshots and carries raw_api_response');

  // ── low-volume article must not produce a claim even though position/impressions "dropped to 0" ──
  const lowVolumeClaim = written.decay.find((c) => c.claim.includes('lưu lượng thấp'));
  assert.strictEqual(lowVolumeClaim, undefined, 'must not flag decay on statistically meaningless small-impression articles');
  console.log('PASS: MIN_PAST_IMPRESSIONS floor suppresses noise on low-traffic articles');

  console.log('\nAll contentDecayScan tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
