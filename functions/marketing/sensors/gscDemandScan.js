/**
 * Sensor (Phase 1, read-only): scans Google Search Console for 2 kinds of
 * demand signal and writes raw claims to signals/{date}.demand.
 *
 *   1. Striking-distance: pages ranking 5-15 with decent impressions but a
 *      CTR well below what that position normally gets — a meta/title fix
 *      could plausibly lift clicks without writing anything new.
 *   2. Uncovered demand: queries with real impressions whose topic doesn't
 *      match any registered topic_fingerprints entry — i.e. people are
 *      searching for something we haven't written about.
 *
 * Deliberately NO LLM call here. Every claim below is built by string
 * template directly from the GSC API response — there is nothing for a
 * model to hallucinate, and it keeps this sensor free (no Gemini token
 * cost) and directly unit-testable. Compare with serpGapScan, which does
 * need an LLM because it requires actual reading comprehension of
 * competitor page content, not just arithmetic on API numbers.
 *
 * Auth pattern matches functions/index.js's contentAnalyticsSync (GoogleAuth
 * with the webmasters.readonly scope, resolved via the default compute
 * service account already granted access to the GSC property).
 */
const { coarseFingerprint } = require('../../lib/topic-dedup');

const GSC_SITE_URL = 'sc-domain:keolaigiamhom.vn';

// Striking-distance thresholds — tunable, not claimed to be optimal.
const STRIKING_MIN_POSITION = 5;
const STRIKING_MAX_POSITION = 15;
const STRIKING_MIN_IMPRESSIONS = 10;
const STRIKING_MAX_CTR_PERCENT = 2.0; // flag if CTR is at/below this despite decent impressions

// Uncovered-demand threshold.
const UNCOVERED_MIN_IMPRESSIONS = 15;
const MAX_CLAIMS_PER_CATEGORY = 15; // cap output size — this is a signal feed, not a full export

function getDateString(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

/** Monday of the current week, as YYYY-MM-DD — the signals/{date} doc key. */
function currentWeekKey(now = new Date()) {
  const d = new Date(now);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().split('T')[0];
}

/**
 * @param {object} deps
 * @param {FirebaseFirestore.Firestore} deps.db
 * @param {{searchanalytics: {query: (args: object) => Promise<{data: {rows?: any[]}}>}}} deps.searchconsole
 *   Pre-authenticated googleapis searchconsole client (dependency-injected for testability).
 * @param {Date} [deps.now]
 */
async function runGscDemandScan({ db, searchconsole, now = new Date() }) {
  const response = await searchconsole.searchanalytics.query({
    siteUrl: GSC_SITE_URL,
    requestBody: {
      startDate: getDateString(-28),
      endDate: getDateString(-1),
      dimensions: ['query', 'page'],
      rowLimit: 1000,
    },
  });
  const rows = response.data.rows || [];
  const retrievedAt = now.toISOString();

  const strikingDistance = [];
  const uncoveredDemand = [];

  // Load existing topic fingerprints once, up front, for the uncovered-demand check.
  const fingerprintsSnap = await db.collection('topic_fingerprints').get();
  const knownFingerprints = new Set(fingerprintsSnap.docs.map((d) => d.data().coarseFingerprint));

  for (const row of rows) {
    const [query, page] = row.keys;
    const position = row.position;
    const impressions = row.impressions;
    const clicks = row.clicks;
    const ctrPercent = impressions > 0 ? (clicks / impressions) * 100 : 0;

    if (
      strikingDistance.length < MAX_CLAIMS_PER_CATEGORY &&
      position >= STRIKING_MIN_POSITION &&
      position <= STRIKING_MAX_POSITION &&
      impressions >= STRIKING_MIN_IMPRESSIONS &&
      ctrPercent <= STRIKING_MAX_CTR_PERCENT
    ) {
      const posRounded = Math.round(position * 10) / 10;
      const ctrRounded = Math.round(ctrPercent * 100) / 100;
      strikingDistance.push({
        claim: `Trang ${page} đang xếp hạng vị trí trung bình ${posRounded} cho từ khóa "${query}", với ${impressions} impression và CTR chỉ ${ctrRounded}% trong 28 ngày qua (${getDateString(-28)} đến ${getDateString(-1)}).`,
        source_url: page,
        retrieved_at: retrievedAt,
        evidence_snippet: `query="${query}", page="${page}", position=${posRounded}, impressions=${impressions}, clicks=${clicks}, ctr=${ctrRounded}%`,
        raw_api_response: { query, page, position, impressions, clicks, ctr: ctrPercent },
      });
    }

    if (uncoveredDemand.length < MAX_CLAIMS_PER_CATEGORY && impressions >= UNCOVERED_MIN_IMPRESSIONS) {
      const fp = coarseFingerprint(query);
      if (!knownFingerprints.has(fp)) {
        uncoveredDemand.push({
          claim: `Từ khóa "${query}" có ${impressions} impression trong 28 ngày qua nhưng không khớp với bất kỳ chủ đề nào đã có bài viết (theo topic_fingerprints).`,
          source_url: page,
          retrieved_at: retrievedAt,
          evidence_snippet: `query="${query}", coarseFingerprint="${fp}", impressions=${impressions}, best-matching page="${page}" (position ${Math.round(position * 10) / 10})`,
          raw_api_response: { query, page, position, impressions, clicks, ctr: ctrPercent },
        });
        // Avoid re-flagging the same emerging topic twice within this run.
        knownFingerprints.add(fp);
      }
    }
  }

  await db
    .collection('signals')
    .doc(currentWeekKey(now))
    .set({ demand: [...strikingDistance, ...uncoveredDemand] }, { merge: true });

  return {
    strikingDistanceCount: strikingDistance.length,
    uncoveredDemandCount: uncoveredDemand.length,
    totalRowsScanned: rows.length,
  };
}

module.exports = { runGscDemandScan, currentWeekKey };
