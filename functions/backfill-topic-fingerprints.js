/**
 * One-time backfill for `topic_fingerprints` (see lib/topic-dedup.js) — seeds the collection
 * from the 58 already-published articles so the new dedup gate (B6 fix) has a real baseline to
 * check new topics against from day one, instead of only catching duplicates going forward.
 * Skips docs with `redirectTo`/`retired` (Phase 1 cleanup) — their topic space is already
 * represented by whichever canonical they point to / superseded them.
 * Idempotent: skips any slug that already has a fingerprint doc, unless FORCE=1.
 *
 * Run: VERTEX_API_KEY=$(gcloud secrets versions access latest --secret=VERTEX_API_KEY --project=keolai-63ec1) \
 *        node backfill-topic-fingerprints.js
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'keolai-63ec1' });
const db = admin.firestore();

const { coarseFingerprint, registerTopicFingerprint } = require('./lib/topic-dedup');
const { embedTopicTitle } = require('./lib/embeddings');

async function main() {
  const apiKey = process.env.VERTEX_API_KEY;
  if (!apiKey) {
    console.error('Missing VERTEX_API_KEY env var. See file header for how to fetch it.');
    process.exit(1);
  }
  const force = process.env.FORCE === '1';

  const articlesSnap = await db.collection('articles').get();
  let seeded = 0;
  let skippedExisting = 0;
  let skippedRedirected = 0;
  let errors = 0;

  for (const doc of articlesSnap.docs) {
    const article = doc.data();
    const slug = doc.id;

    if (article.redirectTo || article.retired) {
      skippedRedirected++;
      continue;
    }
    if (!article.title) continue;

    if (!force) {
      const existing = await db.collection('topic_fingerprints').doc(slug).get();
      if (existing.exists) {
        skippedExisting++;
        continue;
      }
    }

    try {
      const embedding = await embedTopicTitle(article.title, apiKey);
      await registerTopicFingerprint(db, {
        slug,
        title: article.title,
        coarseFingerprint: coarseFingerprint(article.title),
        embedding,
        registeredAtValue: admin.firestore.FieldValue.serverTimestamp(),
      });
      seeded++;
      console.log(`OK: ${slug}`);
    } catch (err) {
      errors++;
      console.error(`ERROR (${slug}): ${err.message}`);
    }

    // Gentle pacing — this is a one-time script, not latency-sensitive.
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\nDone. seeded=${seeded} skipped_existing=${skippedExisting} skipped_redirected=${skippedRedirected} errors=${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((e) => { console.error('Fatal error:', e); process.exit(1); });
