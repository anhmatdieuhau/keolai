/**
 * Sensor (Phase 1, read-only): checks a fixed competitor watchlist
 * (config/competitors — no paid SERP API; see plan for why) for topics they
 * cover that we likely don't, and writes raw claims to signals/{date}.gap.
 *
 * Unlike the other 2 sensors, this one DOES call an LLM (Gemini Flash, not
 * Flash-Lite) — deciding "is this actually a content gap" requires reading
 * comprehension of the competitor's real page text against our own title
 * list, not just arithmetic on API numbers.
 *
 * Flow: sitemap.xml -> candidate URLs -> cheap token-overlap pre-filter
 * (no LLM call yet) -> fetch full page text only for the low-similarity
 * survivors -> one LLM judgment per survivor, fail-closed (any judge
 * error/ambiguity means no claim, not a guessed one).
 *
 * fetchFn/geminiClient are injected for testability — no real network call
 * happens in tests.
 */
const MAX_SITEMAP_URLS_PER_DOMAIN = 200; // cap parsing cost on a large competitor sitemap
const MAX_GAP_CANDIDATES_TO_VERIFY = 5; // cap LLM calls per domain per run
const SIMILARITY_OVERLAP_THRESHOLD = 0.3; // token overlap AT OR ABOVE this = "probably already covered", skip
const PAGE_TEXT_MAX_CHARS = 3000; // evidence snippet cap sent to the LLM

function currentWeekKey(now = new Date()) {
  const d = new Date(now);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().split('T')[0];
}

/** Very small hand-rolled <loc> extractor — sitemap.xml has no other content we need. */
function extractSitemapUrls(xml) {
  const matches = xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g);
  return [...matches].map((m) => m[1]);
}

// Words that appear in nearly every slug on this specific site (product name,
// generic connectors) — without stripping them, 2 unrelated articles look
// artificially similar just because both mention "keo lai" (every article
// does). Same philosophy as topic-dedup.js's MODIFIER_WORDS, scoped to what
// this comparison actually needs to discriminate on.
const SITE_STOPWORDS = new Set(['keo', 'lai', 'cay', 'giong', 'trong']);

function slugToWords(url) {
  const slug = url.replace(/\/$/, '').split('/').pop() || '';
  return slug
    .replace(/\.(html?|php)$/i, '')
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
    .filter((w) => !SITE_STOPWORDS.has(w));
}

function tokenOverlapRatio(wordsA, wordsB) {
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  const setB = new Set(wordsB);
  const shared = wordsA.filter((w) => setB.has(w)).length;
  return shared / Math.min(wordsA.length, wordsB.length);
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GAP_JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    is_gap: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['is_gap', 'reason'],
  additionalProperties: false, // not strictly required by Gemini's responseSchema, but keep schemas consistent across providers
};

/**
 * @param {object} deps
 * @param {FirebaseFirestore.Firestore} deps.db
 * @param {(url: string) => Promise<{ok: boolean, text: () => Promise<string>}>} deps.fetchFn
 * @param {{callJSON: (args: object) => Promise<{is_gap: boolean, reason: string}>}} deps.geminiClient
 *   Object with a callJSON method compatible with claudeClient's shape (see functions/marketing/lib/claudeClient.js) —
 *   for the Gemini REST call this is a small local adapter, not the Claude SDK.
 * @param {Date} [deps.now]
 */
async function runSerpGapScan({ db, fetchFn, geminiClient, now = new Date() }) {
  const configDoc = await db.collection('config').doc('competitors').get();
  const domains = configDoc.exists ? configDoc.data().domains || [] : [];

  const articlesSnap = await db.collection('articles').get();
  const ourTitleWords = articlesSnap.docs.map((d) => slugToWords(d.data().slug || d.id));
  const ourTitles = articlesSnap.docs.map((d) => d.data().title || '');

  const claims = [];
  const stats = { domainsScanned: 0, urlsConsidered: 0, candidatesSentToJudge: 0, errors: [] };

  for (const domain of domains) {
    stats.domainsScanned++;
    let sitemapUrls = [];
    try {
      const sitemapRes = await fetchFn(`https://${domain}/sitemap.xml`);
      if (sitemapRes.ok) {
        sitemapUrls = extractSitemapUrls(await sitemapRes.text()).slice(0, MAX_SITEMAP_URLS_PER_DOMAIN);
      }
    } catch (err) {
      stats.errors.push(`${domain}: sitemap fetch failed — ${err.message}`);
      continue;
    }
    stats.urlsConsidered += sitemapUrls.length;

    // Cheap pre-filter: skip anything with high token overlap against an
    // existing article slug — no LLM call spent on things we likely cover.
    const candidates = sitemapUrls.filter((url) => {
      const words = slugToWords(url);
      if (words.length === 0) return false;
      const maxOverlap = Math.max(0, ...ourTitleWords.map((ours) => tokenOverlapRatio(words, ours)));
      return maxOverlap < SIMILARITY_OVERLAP_THRESHOLD;
    });

    for (const url of candidates.slice(0, MAX_GAP_CANDIDATES_TO_VERIFY)) {
      let pageText;
      try {
        const pageRes = await fetchFn(url);
        if (!pageRes.ok) continue;
        pageText = stripHtml(await pageRes.text()).slice(0, PAGE_TEXT_MAX_CHARS);
      } catch (err) {
        stats.errors.push(`${url}: page fetch failed — ${err.message}`);
        continue;
      }
      if (!pageText) continue;

      stats.candidatesSentToJudge++;
      const prompt = `Đây là trích đoạn nội dung từ trang của một đối thủ trong ngành cây giống/lâm nghiệp:

"""
${pageText}
"""

Đây là danh sách tiêu đề bài viết hiện có trên website của chúng tôi (keolaigiamhom.vn):
${ourTitles.map((t) => `- ${t}`).join('\n')}

Câu hỏi: trang đối thủ trên có đang đề cập một CHỦ ĐỀ CỤ THỂ mà website chúng tôi CHƯA có bài viết tương ứng không? Chỉ trả lời is_gap=true nếu chắc chắn đây là chủ đề mới, không trùng lặp/gần giống bài đã có. Nếu không chắc, trả lời false.`;

      let verdict;
      try {
        verdict = await geminiClient.callJSON({ prompt, schema: GAP_JUDGE_SCHEMA });
      } catch (err) {
        // Fail-closed: a judge error means no claim, not a guessed one.
        stats.errors.push(`${url}: gap judge failed — ${err.message}`);
        continue;
      }

      if (verdict && verdict.is_gap === true && claims.length < MAX_GAP_CANDIDATES_TO_VERIFY) {
        claims.push({
          claim: `Đối thủ (${domain}) có nội dung về chủ đề chưa có trên keolaigiamhom.vn: ${verdict.reason}`,
          source_url: url,
          retrieved_at: now.toISOString(),
          evidence_snippet: pageText.slice(0, 500),
          raw_api_response: null, // not a site-metric claim — tier 2 of evidenceVerifier does not apply here
        });
      }
    }
  }

  await db
    .collection('signals')
    .doc(currentWeekKey(now))
    .set({ gap: claims }, { merge: true });

  return { ...stats, claimsCount: claims.length };
}

module.exports = { runSerpGapScan, extractSitemapUrls, slugToWords, tokenOverlapRatio };
