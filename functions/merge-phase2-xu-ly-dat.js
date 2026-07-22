/**
 * Phase 2 — merge verdict for audit-report.md §4.9 "xử lý đất trước khi trồng" cluster.
 * 3 articles covered the same topic: Firestore `xu-ly-dat-truoc-khi-trong-keo-lai` (narrower,
 * "cày xới và làm hố"), Firestore `kinh-nghiem-xu-ly-dat-truoc-khi-trong-keo-giam-hom` (most
 * comprehensive — covers soil survey, pH/structure amendment, phèn/xám bạc màu/đồi dốc-specific
 * treatment, hố trồng), and static `cach-xu-ly-dat-truoc-khi-trong-keo` (source of the Cluster B
 * boilerplate body shared with cach-lam-dat-bac-thang-trong-keo.mdx / trong-keo-lai-tren-dat-doi-troc.mdx).
 * Canonical: kinh-nghiem-xu-ly-dat-truoc-khi-trong-keo-giam-hom (most complete, read in full).
 * Sets redirectTo on the losing Firestore doc, after merging in the one genuinely useful detail
 * it had that the canonical didn't (hố spacing/density, not just hố size).
 *
 * Run: cd functions && node merge-phase2-xu-ly-dat.js
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'keolai-63ec1' });
const db = admin.firestore();

const CANONICAL_SLUG = 'kinh-nghiem-xu-ly-dat-truoc-khi-trong-keo-giam-hom';
const LOSING_SLUG = 'xu-ly-dat-truoc-khi-trong-keo-lai';

const OLD_TEXT = `<h3>6. Xử Lý Hố Trồng</h3>
<p>Sau khi làm đất chung, bước tiếp theo là đào hố trồng. Kích thước hố trồng phổ biến là 40x40x40 cm hoặc 50x50x50 cm, tùy thuộc vào loại đất và kinh nghiệm địa phương. Hố cần được đào trước khi trồng khoảng 15-30 ngày để đất có thời gian phân hủy và hấp thụ các chất cải tạo.</p>`;

const NEW_TEXT = `<h3>6. Xử Lý Hố Trồng</h3>
<p>Sau khi làm đất chung, bước tiếp theo là đào hố trồng. Kích thước hố trồng phổ biến là 40x40x40 cm hoặc 50x50x50 cm, tùy thuộc vào loại đất và kinh nghiệm địa phương. Hố cần được đào trước khi trồng khoảng 15-30 ngày để đất có thời gian phân hủy và hấp thụ các chất cải tạo.</p>
<p>Khoảng cách giữa các hố phụ thuộc vào mục đích sử dụng rừng: 2m x 3m, 3m x 3m hoặc 3m x 4m — tương ứng mật độ khoảng 555 đến 1.660 cây/ha tùy lựa chọn (xem thêm <a href="/articles/mat-do-trong-keo-lai-toi-uu/">so sánh mật độ trồng</a> để chọn mật độ phù hợp mục tiêu gỗ).</p>`;

async function main() {
  const canonicalRef = db.collection('articles').doc(CANONICAL_SLUG);
  const canonicalSnap = await canonicalRef.get();
  if (!canonicalSnap.exists) {
    console.error(`FATAL: canonical ${CANONICAL_SLUG} not found`);
    process.exit(1);
  }
  const html = canonicalSnap.data().html || '';
  if (html.includes('Khoảng cách giữa các hố phụ thuộc')) {
    console.log('SKIP content merge (already merged)');
  } else if (!html.includes(OLD_TEXT)) {
    console.warn('WARN: anchor text not found in canonical, doc may have changed — skipping content merge, no write');
  } else {
    await canonicalRef.update({ html: html.replace(OLD_TEXT, NEW_TEXT) });
    console.log(`OK: merged hố-spacing detail into ${CANONICAL_SLUG}`);
  }

  const losingRef = db.collection('articles').doc(LOSING_SLUG);
  const losingSnap = await losingRef.get();
  if (!losingSnap.exists) {
    console.log(`SKIP redirect (not found): ${LOSING_SLUG}`);
  } else if (losingSnap.data().redirectTo === CANONICAL_SLUG) {
    console.log(`SKIP redirect (already set): ${LOSING_SLUG}`);
  } else {
    await losingRef.update({ redirectTo: CANONICAL_SLUG });
    console.log(`OK: ${LOSING_SLUG} -> redirectTo=${CANONICAL_SLUG}`);
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error('Fatal error:', e); process.exit(1); });
