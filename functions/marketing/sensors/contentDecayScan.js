/**
 * Sensor (Phase 1, read-only): compares each article's current GSC position/
 * impressions against a snapshot from ~28 days ago, and flags meaningful
 * decay. Writes raw claims to signals/{date}.decay.
 *
 * History source: articles/{slug}/analytics/{date} (a dated subcollection
 * contentAnalyticsSync already writes daily) — NOT article_analytics/{slug},
 * which is only a rolling "latest" snapshot for the dashboard and has no
 * history. Confirmed by reading contentAnalyticsSync's actual write path
 * before building this (the original plan draft assumed the wrong
 * collection had history).
 *
 * Gracefully skips any article without a snapshot old enough to compare —
 * this sensor will find nothing for the first ~4 weeks after
 * contentAnalyticsSync starts accumulating history, by design, not a bug.
 *
 * No LLM call — pure arithmetic on 2 real snapshots, same reasoning as
 * gscDemandScan.
 */

const LOOKBACK_DAYS = 28;
const LOOKBACK_TOLERANCE_DAYS = 4; // accept a "past" snapshot within +/- this many days of the target
const MIN_PAST_IMPRESSIONS = 10; // don't flag decay on statistically meaningless small numbers
const POSITION_DECAY_THRESHOLD = 3; // position got at least this many spots worse
const IMPRESSIONS_DROP_THRESHOLD_PERCENT = 30;
const MAX_CLAIMS = 15;

function currentWeekKey(now = new Date()) {
  const d = new Date(now);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().split('T')[0];
}

function daysBetween(a, b) {
  return Math.abs(a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000);
}

/** Picks the analytics snapshot closest to `targetDate` within tolerance, or null. */
function findClosestSnapshot(snapshotDocs, targetDate) {
  let best = null;
  let bestDiff = Infinity;
  for (const doc of snapshotDocs) {
    const data = doc.data();
    if (!data.sync_date) continue;
    const snapDate = new Date(data.sync_date);
    const diff = daysBetween(snapDate, targetDate);
    if (diff <= LOOKBACK_TOLERANCE_DAYS && diff < bestDiff) {
      best = data;
      bestDiff = diff;
    }
  }
  return best;
}

/**
 * @param {object} deps
 * @param {FirebaseFirestore.Firestore} deps.db
 * @param {Date} [deps.now]
 */
async function runContentDecayScan({ db, now = new Date() }) {
  const articlesSnap = await db.collection('articles').get();
  const claims = [];
  let skippedNoHistory = 0;

  const targetPastDate = new Date(now);
  targetPastDate.setDate(targetPastDate.getDate() - LOOKBACK_DAYS);

  for (const articleDoc of articlesSnap.docs) {
    if (claims.length >= MAX_CLAIMS) break;
    const slug = articleDoc.id;
    const article = articleDoc.data();

    const snapshotsSnap = await db.collection('articles').doc(slug).collection('analytics').get();
    if (snapshotsSnap.empty) {
      skippedNoHistory++;
      continue;
    }

    // "Current" = the most recent snapshot available.
    let current = null;
    let currentDate = null;
    for (const doc of snapshotsSnap.docs) {
      const data = doc.data();
      if (!data.sync_date) continue;
      const d = new Date(data.sync_date);
      if (!currentDate || d > currentDate) {
        current = data;
        currentDate = d;
      }
    }
    if (!current) {
      skippedNoHistory++;
      continue;
    }

    const past = findClosestSnapshot(snapshotsSnap.docs, targetPastDate);
    if (!past) {
      skippedNoHistory++;
      continue;
    }

    const pastImpressions = past.gsc_impressions_28d || 0;
    const currentImpressions = current.gsc_impressions_28d || 0;
    const pastPosition = past.gsc_avg_position;
    const currentPosition = current.gsc_avg_position;

    if (pastImpressions < MIN_PAST_IMPRESSIONS) continue;

    const impressionsDropPercent = pastImpressions > 0 ? ((pastImpressions - currentImpressions) / pastImpressions) * 100 : 0;
    const positionDecay = pastPosition != null && currentPosition != null ? currentPosition - pastPosition : 0;

    const impressionsDecayed = impressionsDropPercent >= IMPRESSIONS_DROP_THRESHOLD_PERCENT;
    const positionDecayed = positionDecay >= POSITION_DECAY_THRESHOLD;

    if (!impressionsDecayed && !positionDecayed) continue;

    const parts = [];
    if (impressionsDecayed) {
      parts.push(`impression giảm từ ${pastImpressions} xuống ${currentImpressions} (${Math.round(impressionsDropPercent)}%)`);
    }
    if (positionDecayed) {
      parts.push(`vị trí trung bình tụt từ ${Math.round(pastPosition * 10) / 10} xuống ${Math.round(currentPosition * 10) / 10}`);
    }

    claims.push({
      claim: `Bài "${article.title}" (${article.url}) có dấu hiệu suy giảm trong ~${LOOKBACK_DAYS} ngày qua: ${parts.join('; ')}.`,
      source_url: article.url,
      retrieved_at: now.toISOString(),
      evidence_snippet: `slug="${slug}", past(${past.sync_date})={impressions:${pastImpressions},position:${pastPosition}}, current(${current.sync_date})={impressions:${currentImpressions},position:${currentPosition}}`,
      raw_api_response: { slug, past, current },
    });
  }

  await db
    .collection('signals')
    .doc(currentWeekKey(now))
    .set({ decay: claims }, { merge: true });

  return { claimsCount: claims.length, articlesScanned: articlesSnap.size, skippedNoHistory };
}

module.exports = { runContentDecayScan };
