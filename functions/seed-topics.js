/**
 * Seed script — populate Firestore with initial article topics
 * Run: cd functions && node seed-topics.js
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env or default credentials
 */
const admin = require('firebase-admin');

// Initialize with default project credentials
admin.initializeApp({ projectId: 'keolai-63ec1' });
const db = admin.firestore();

const TOPICS = [
  {
    title: 'Quy Trình Bón Phân Cho Keo Lai — Từ Trồng Đến 3 Năm Tuổi',
    description: 'Hướng dẫn bón phân NPK cho keo lai từ giai đoạn trồng mới đến 3 năm tuổi. Công thức, liều lượng, thời điểm bón phân hiệu quả nhất.',
    keywords: 'bón phân keo lai, phân NPK keo lai, chăm sóc keo lai, quy trình bón phân rừng',
    slug: 'quy-trinh-bon-phan-keo-lai',
    label: 'Chăm sóc',
    breadcrumb: 'Bón phân',
    priority: 10,
    stats: [
      { value: '100-200g', label: 'NPK/gốc lần 1' },
      { value: '2 lần/năm', label: 'Tần suất bón' },
      { value: '20-30cm', label: 'Bán kính bón' },
      { value: '+35%', label: 'Tăng năng suất' },
    ],
    status: 'pending',
  },
  {
    title: 'Phòng Trừ Sâu Bệnh Trên Keo Lai — Nhận Diện và Xử Lý Kịp Thời',
    description: 'Hướng dẫn nhận diện và phòng trừ các loại sâu bệnh thường gặp trên keo lai. Biện pháp sinh học và hóa học kết hợp.',
    keywords: 'sâu bệnh keo lai, phòng trừ sâu keo lai, bệnh phấn trắng, sâu đục thân',
    slug: 'phong-tru-sau-benh-keo-lai',
    label: 'Bảo vệ thực vật',
    breadcrumb: 'Sâu bệnh',
    priority: 9,
    stats: [
      { value: '5+ loại', label: 'Sâu bệnh phổ biến' },
      { value: '70%', label: 'Hiệu quả phòng trừ' },
      { value: '2 lần/năm', label: 'Phun thuốc tối thiểu' },
      { value: '3-6 tháng', label: 'Giai đoạn mẫn cảm' },
    ],
    status: 'pending',
  },
  {
    title: 'Thu Hoạch Keo Lai Đúng Thời Điểm — Tối Đa Hóa Giá Trị Gỗ',
    description: 'Xác định thời điểm thu hoạch keo lai tối ưu. So sánh giá trị gỗ theo tuổi cây và phương pháp khai thác bền vững.',
    keywords: 'thu hoạch keo lai, khai thác gỗ keo, giá gỗ keo lai, chu kỳ khai thác',
    slug: 'thu-hoach-keo-lai-dung-thoi-diem',
    label: 'Khai thác',
    breadcrumb: 'Thu hoạch',
    priority: 8,
    stats: [
      { value: '5-7 năm', label: 'Chu kỳ khai thác' },
      { value: '150-200m³', label: 'Năng suất/ha' },
      { value: '2.5-3.5M', label: 'VNĐ/tấn gỗ' },
      { value: '80-120tr', label: 'Doanh thu/ha' },
    ],
    status: 'pending',
  },
  {
    title: 'Mật Độ Trồng Keo Lai — Tính Toán Số Cây Theo Mục Đích Sử Dụng',
    description: 'Hướng dẫn tính mật độ trồng keo lai cho gỗ nguyên liệu và gỗ lớn. Khoảng cách hàng, khoảng cách cây tối ưu.',
    keywords: 'mật độ trồng keo lai, khoảng cách trồng keo, số cây trên hecta, thiết kế lô trồng',
    slug: 'mat-do-trong-keo-lai',
    label: 'Kỹ thuật trồng',
    breadcrumb: 'Mật độ',
    priority: 7,
    stats: [
      { value: '1.660 cây', label: 'Mật độ/ha (gỗ NL)' },
      { value: '3x2m', label: 'Khoảng cách chuẩn' },
      { value: '830 cây', label: 'Mật độ gỗ lớn' },
      { value: '5-7 năm', label: 'Chu kỳ tỉa thưa' },
    ],
    status: 'pending',
  },
  {
    title: 'Kỹ Thuật Tỉa Cành Keo Lai — Nâng Cao Chất Lượng Gỗ',
    description: 'Quy trình tỉa cành keo lai đúng cách. Thời điểm tỉa, dụng cụ cần thiết, kỹ thuật cắt không gây tổn thương thân cây.',
    keywords: 'tỉa cành keo lai, nâng cao chất lượng gỗ, kỹ thuật lâm sinh, chăm sóc rừng trồng',
    slug: 'ky-thuat-tia-canh-keo-lai',
    label: 'Lâm sinh',
    breadcrumb: 'Tỉa cành',
    priority: 6,
    stats: [
      { value: '1-2 tuổi', label: 'Lần tỉa đầu tiên' },
      { value: '1/3 tán', label: 'Tỷ lệ tỉa tối đa' },
      { value: '2-3 lần', label: 'Số lần tỉa' },
      { value: '+25%', label: 'Tăng giá trị gỗ' },
    ],
    status: 'pending',
  },
  {
    title: 'So Sánh Keo Lai Và Keo Tai Tượng — Nên Chọn Giống Nào?',
    description: 'Phân tích ưu nhược điểm keo lai AH1 so với keo tai tượng. Tốc độ tăng trưởng, năng suất, khả năng chống chịu và giá trị kinh tế.',
    keywords: 'keo lai vs keo tai tượng, so sánh giống keo, chọn giống keo trồng rừng',
    slug: 'so-sanh-keo-lai-va-keo-tai-tuong',
    label: 'Giống cây',
    breadcrumb: 'So sánh giống',
    priority: 5,
    stats: [
      { value: '20-30%', label: 'Keo lai nhanh hơn' },
      { value: '150m³/ha', label: 'Năng suất keo lai' },
      { value: '120m³/ha', label: 'Năng suất tai tượng' },
      { value: '5 vs 7 năm', label: 'Chu kỳ khai thác' },
    ],
    status: 'pending',
  },
  {
    title: 'Xử Lý Đất Trước Khi Trồng Keo Lai — Cày Xới và Làm Hố',
    description: 'Quy trình xử lý đất trước khi trồng keo lai: phát dọn thực bì, cày rạch, đào hố, bón lót. Kích thước hố chuẩn.',
    keywords: 'xử lý đất trồng keo, đào hố trồng keo, cày đất lâm nghiệp, chuẩn bị đất rừng',
    slug: 'xu-ly-dat-truoc-khi-trong-keo-lai',
    label: 'Chuẩn bị',
    breadcrumb: 'Xử lý đất',
    priority: 4,
    stats: [
      { value: '30x30x30cm', label: 'Kích thước hố' },
      { value: '200-300g', label: 'Phân lót/hố' },
      { value: '15-20 ngày', label: 'Trước khi trồng' },
      { value: '100%', label: 'Dọn thực bì' },
    ],
    status: 'pending',
  },
  {
    title: 'Tưới Nước Cho Keo Lai Mới Trồng — Hướng Dẫn Giai Đoạn Đầu',
    description: 'Hướng dẫn tưới nước cho keo lai giai đoạn mới trồng. Lượng nước, tần suất, phương pháp tưới tiết kiệm nước.',
    keywords: 'tưới nước keo lai, chăm sóc keo lai sau trồng, keo lai giai đoạn đầu',
    slug: 'tuoi-nuoc-cho-keo-lai-moi-trong',
    label: 'Chăm sóc',
    breadcrumb: 'Tưới nước',
    priority: 3,
    stats: [
      { value: '3-5 lít', label: 'Lượng nước/cây' },
      { value: '2-3 ngày', label: 'Tần suất tưới' },
      { value: '3 tháng', label: 'Giai đoạn cần tưới' },
      { value: '95%', label: 'Tỷ lệ sống nếu tưới' },
    ],
    status: 'pending',
  },
  {
    title: 'Trồng Keo Lai Xen Canh — Mô Hình Nông Lâm Kết Hợp',
    description: 'Mô hình trồng keo lai xen canh với sắn, ngô, đậu. Tận dụng đất, tăng thu nhập trong khi chờ keo thu hoạch.',
    keywords: 'trồng keo lai xen canh, nông lâm kết hợp, trồng sắn xen keo, mô hình rừng trồng',
    slug: 'trong-keo-lai-xen-canh',
    label: 'Mô hình',
    breadcrumb: 'Xen canh',
    priority: 2,
    stats: [
      { value: '3 loại', label: 'Cây xen phù hợp' },
      { value: '2 năm', label: 'Thời gian xen' },
      { value: '15-20tr', label: 'Thu nhập thêm/ha' },
      { value: '+40%', label: 'Tăng hiệu quả đất' },
    ],
    status: 'pending',
  },
  {
    title: 'Chi Phí Trồng 1 Hecta Keo Lai — Phân Tích Đầu Tư Toàn Bộ',
    description: 'Tính toán chi phí đầu tư trồng 1 hecta keo lai AH1: giống, phân bón, nhân công, thuốc trừ sâu, đến khai thác.',
    keywords: 'chi phí trồng keo lai, đầu tư trồng rừng, lãi trồng keo, vốn trồng keo 1 ha',
    slug: 'chi-phi-trong-1-hecta-keo-lai',
    label: 'Kinh tế',
    breadcrumb: 'Chi phí',
    priority: 1,
    stats: [
      { value: '25-35M', label: 'Tổng đầu tư/ha' },
      { value: '80-120M', label: 'Doanh thu/ha' },
      { value: '3-4x', label: 'Tỷ suất lợi nhuận' },
      { value: '5-7 năm', label: 'Thời gian hoàn vốn' },
    ],
    status: 'pending',
  },
];

async function seedTopics() {
  console.log('🌱 Seeding topics to Firestore...\n');

  const batch = db.batch();

  for (const topic of TOPICS) {
    const ref = db.collection('topics').doc(topic.slug);
    batch.set(ref, {
      ...topic,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✅ ${topic.title}`);
  }

  await batch.commit();
  console.log(`\n🎉 Seeded ${TOPICS.length} topics successfully!`);
  process.exit(0);
}

seedTopics().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
