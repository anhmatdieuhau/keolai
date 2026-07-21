/**
 * Phase 1 URL cleanup — one-time migration script.
 * Sets `redirectTo` (301 via serveArticle) or `retired` (permanently 404, duplicate of a
 * static page at the same slug) on Firestore `articles` docs that lost a content-cannibalization
 * merge decision in audit-report.md (sections 4.1-4.10). Idempotent — safe to re-run.
 *
 * Run: cd functions && node migrate-phase1-url-cleanup.js
 * Rollback: re-run with ROLLBACK=1 env var to strip these fields back off (see bottom).
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'keolai-63ec1' });
const db = admin.firestore();

// slug (Firestore doc ID) -> canonical slug it now redirects to
const REDIRECTS = {
  // 4.2 Tây Nguyên
  'lua-chon-giong-keo-lai-phu-hop-khi-hau-tay-nguyen': 'chon-giong-keo-lai-phu-hop-vung-tay-nguyen',
  'tap-huan-cham-soc-cay-keo-lai-non-mua-mua-tay-nguyen': 'cham-soc-cay-non-keo-lai-mua-mua-vung-cao-tay-nguyen',
  'dinh-duong-cay-keo-lai-con-mua-mua-tay-nguyen': 'cham-soc-cay-non-keo-lai-mua-mua-vung-cao-tay-nguyen',
  // 4.3 Chi phí 1ha
  'chi-phi-trong-keo-lai-1-hecta-mua-mua': 'chi-phi-trong-1-ha-keo-lai',
  'chi-phi-chuan-bi-dat-trong-keo-lai-mua-mua': 'chi-phi-trong-1-ha-keo-lai',
  // 4.4 + 4.10 Bón phân
  'quy-trinh-bon-phan-keo-lai': 'bon-phan-cho-keo-lai',
  'bon-phan-keo-lai-con-sau-khi-trong': 'bon-phan-cho-keo-lai',
  'phan-bon-npk-cho-keo-lai': 'bon-phan-cho-keo-lai',
  'phan-bon-huu-co-keo-lai-kien-thiet': 'su-dung-phan-huu-co-keo-lai-kien-thiet',
  // 4.5 + 4.10 Tỉa cành
  'quy-trinh-tia-canh-tao-tan-keo-lai-kien-thiet': 'ky-thuat-tia-canh-tao-tan-keo-lai-kien-thiet',
  'ky-thuat-tia-canh-tao-tan-keo-lai-con': 'ky-thuat-tia-canh-keo-lai',
  // 4.6 + 4.10 Seasonal
  'tan-dung-vuon-uom-keo-lai-hieu-qua-thang-6': 'tan-dung-vuon-uom-keo-lai-thang-6',
  'phong-tru-sau-benh-hai-keo-lai-dau-mua-mua': 'phong-tru-sau-benh-keo-lai-dau-mua-mua',
  'cham-soc-keo-lai-non-mua-he': 'cham-soc-vuon-keo-lai-non-mua-mua-thang-6', // contradictory-advice pair, see audit 4.10 #5
  'kinh-nghiem-trong-keo-lai-giam-hom-thang-6': 'ky-thuat-trong-keo-lai-thang-6',
  // 4.9 Mật độ + chọn đất
  'mat-do-trong-keo-lai': 'mat-do-trong-keo-lai-toi-uu',
  'kinh-nghiem-chon-dat-trong-keo-lai': 'cach-chon-dat-trong-keo-lai',
};

// slug -> retired in place (static page at the SAME slug already wins routing; this Firestore
// doc is permanently unreachable regardless, marked so sitemap logic doesn't need special-casing)
const RETIRED = ['lich-trong-keo-lai-theo-vung'];

async function main() {
  const rollback = process.env.ROLLBACK === '1';
  let updated = 0;
  let missing = 0;

  for (const [slug, target] of Object.entries(REDIRECTS)) {
    const ref = db.collection('articles').doc(slug);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`SKIP (not found): ${slug}`);
      missing++;
      continue;
    }
    if (rollback) {
      await ref.update({ redirectTo: admin.firestore.FieldValue.delete() });
      console.log(`ROLLED BACK: ${slug}`);
    } else {
      await ref.update({ redirectTo: target });
      console.log(`OK: ${slug} -> redirectTo=${target}`);
    }
    updated++;
  }

  for (const slug of RETIRED) {
    const ref = db.collection('articles').doc(slug);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`SKIP (not found): ${slug}`);
      missing++;
      continue;
    }
    if (rollback) {
      await ref.update({ retired: admin.firestore.FieldValue.delete() });
      console.log(`ROLLED BACK: ${slug}`);
    } else {
      await ref.update({ retired: true });
      console.log(`OK: ${slug} -> retired=true`);
    }
    updated++;
  }

  console.log(`\nDone. updated=${updated} missing=${missing}`);
  process.exit(0);
}

main().catch((e) => { console.error('Fatal error:', e); process.exit(1); });
