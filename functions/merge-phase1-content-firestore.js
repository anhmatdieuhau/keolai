/**
 * Phase 1 URL cleanup — content-merge migration (Firestore `html` field edits).
 * Folds the genuinely useful content from 2 losing articles into their canonical
 * before those losers get redirectTo'd (see migrate-phase1-url-cleanup.js).
 * Idempotent: if the OLD anchor text is no longer present (already replaced, or
 * doc changed), that item is skipped with a warning rather than silently no-op'd.
 *
 * Run: cd functions && node merge-phase1-content-firestore.js
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'keolai-63ec1' });
const db = admin.firestore();

const MERGES = [
  {
    // Tây Nguyên: dinh dưỡng cây con -> chăm sóc cây non (audit 4.10 #7)
    targetSlug: 'cham-soc-cay-non-keo-lai-mua-mua-vung-cao-tay-nguyen',
    oldText: `<h3>Bón phân lót và phân thúc sớm</h3>
<p>Trước khi mưa lớn, có thể tiến hành bón phân lót hoặc phân thúc lần đầu với các loại phân hữu cơ hoai mục (khoảng 0.5-1kg/gốc) kết hợp với phân vô cơ NPK (tỷ lệ N:P:K khoảng 16:16:8 hoặc 20:20:15, liều lượng 50-100g/gốc). Việc này cung cấp dinh dưỡng thiết yếu cho cây phát triển rễ và lá.</p>`,
    newText: `<h3>Bón phân lót và phân thúc sớm</h3>
<p>Trong 3-6 tháng đầu (đầu mùa mưa), dùng NPK tỷ lệ lân-kali cao (15-30-15 hoặc 16-16-8), liều 50-100g/gốc, rải cách gốc 15-20cm, bón 1-2 lần cách nhau 4-6 tuần khi mưa đã ổn định. Từ 6-12 tháng tuổi, chuyển sang NPK tỷ lệ đạm cao hơn (20-10-10 hoặc 15-15-15), tăng liều lên 100-150g/gốc, bón 2-3 lần cách nhau 4-6 tuần, kết hợp làm cỏ quanh gốc để giảm cạnh tranh dinh dưỡng. Luôn bón trước những trận mưa nhỏ, không bón khi đất còn sũng nước.</p>
<p>Mùa mưa dễ rửa trôi vi lượng trong đất — nên bổ sung phân bón lá chứa Kẽm, Sắt, Mangan, Bo, Magie (pha 1-2g/lít nước), phun định kỳ 2-3 lần cách nhau 6-8 tuần, đặc biệt khi thấy lá vàng đốm hoặc xoăn lá.</p>`,
    source: 'dinh-duong-cay-keo-lai-con-mua-mua-tay-nguyen (redirects here)',
  },
  {
    // Tỉa cành: cây con (crown-formation detail) -> tổng quát (audit 4.10 #4)
    targetSlug: 'ky-thuat-tia-canh-keo-lai',
    oldText: `<h3>Tỉa Cành Lần 1: Giai Đoạn Cây Con</h3>
<p>Giai đoạn cây con, thường từ 1 đến 2 năm tuổi, là thời điểm thích hợp để thực hiện tỉa cành lần đầu. Lúc này, các cành phụ còn non, dễ dàng loại bỏ và vết cắt cũng mau lành.</p>
<p>*   Mục đích chính của lần tỉa này là loại bỏ các cành mọc thấp sát mặt đất, cành bị sâu bệnh, cành mọc song song hoặc đan xen nhau, đảm bảo thân chính được thông thoáng. *   Tỉa bỏ khoảng 30-40% số cành phụ mọc thấp, ưu tiên giữ lại những cành khỏe mạnh, phân bố đều.</p>`,
    newText: `<h3>Tỉa Cành Lần 1: Giai Đoạn Cây Con</h3>
<p>Giai đoạn cây con, thường từ 1 đến 2 năm tuổi, là thời điểm thích hợp để thực hiện tỉa cành lần đầu. Lúc này, các cành phụ còn non, dễ dàng loại bỏ và vết cắt cũng mau lành.</p>
<p>*   Mục đích chính của lần tỉa này là loại bỏ các cành mọc thấp sát mặt đất, cành bị sâu bệnh, cành mọc song song hoặc đan xen nhau, đảm bảo thân chính được thông thoáng. *   Tỉa bỏ khoảng 30-40% số cành phụ mọc thấp, ưu tiên giữ lại những cành khỏe mạnh, phân bố đều.</p>
<p>Khi chọn cành giữ lại, ưu tiên cành cấp 1 mọc cách đều nhau quanh thân chính, tạo góc 45-60 độ so với thân — góc này giúp cành chịu lực tốt và tán phát triển cân đối. Mục tiêu hình dáng: tán chóp hoặc hình nón, giúp ánh sáng chiếu đều xuống các cành thấp hơn. Nếu 2 cành mọc song song cùng kích thước, chỉ giữ 1 cành để tránh cạnh tranh.</p>`,
    source: 'ky-thuat-tia-canh-tao-tan-keo-lai-con (redirects here)',
  },
];

async function main() {
  for (const m of MERGES) {
    const ref = db.collection('articles').doc(m.targetSlug);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`SKIP (target not found): ${m.targetSlug}`);
      continue;
    }
    const html = snap.data().html || '';
    if (html.includes(m.newText)) {
      console.log(`SKIP (already merged): ${m.targetSlug}`);
      continue;
    }
    if (!html.includes(m.oldText)) {
      console.warn(`WARN (anchor text not found, doc may have changed — skipped, no write): ${m.targetSlug}`);
      continue;
    }
    const updatedHtml = html.replace(m.oldText, m.newText);
    await ref.update({ html: updatedHtml });
    console.log(`OK: ${m.targetSlug} <- merged content from ${m.source}`);
  }
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error('Fatal error:', e); process.exit(1); });
