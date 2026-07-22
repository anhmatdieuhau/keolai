/**
 * Fixed, reviewed copy for lead-nurture emails — no LLM call. Every figure
 * here (price range, discount %, soil pH, planting density) is a real number
 * already published elsewhere on keolaigiamhom.vn, not model output.
 *
 * Why no LLM: emails sent to real leads can't be rolled back the way a live
 * webpage can (rollbackWatcher-style auto-revert has nothing to act on once
 * a message is in someone's inbox). The previous free-form-generation design
 * explicitly instructed the model to invent 2 fake customer testimonials
 * (specific names/provinces/yields) for the "testimonial" step, and gave the
 * model real price/discount figures with nothing stopping it from restating
 * them incorrectly. Both risks are eliminated by using fixed text instead of
 * generating it per-send.
 */

const NURTURE_TEMPLATES = {
  welcome: (lead) => {
    const region = lead.province ? ` ở ${lead.province}` : '';
    return `Cảm ơn bạn${region} đã quan tâm đến giống keo lai AH1 của Vườn Ươm Cây Giống Ngọc Sơn.

5 lưu ý nhanh giúp trồng keo lai hiệu quả ngay từ đầu:

1. Chọn đất pH 5.0-6.5, thoát nước tốt — tránh đất ngập úng.
2. Mật độ phổ biến 3x2m hoặc 3x1.6m tùy mục tiêu gỗ nhỏ hay gỗ lớn.
3. Bón lót vôi + phân hữu cơ trước khi trồng 2-4 tuần nếu đất chua.
4. Giữ ẩm đều trong 6 tháng đầu — giai đoạn cây con dễ chết nhất.
5. Kiểm tra sâu bệnh định kỳ, xử lý ngay khi thấy dấu hiệu bất thường.

Bạn có thể đọc thêm các bài kỹ thuật chi tiết tại **keolaigiamhom.vn**.

Có câu hỏi gì, nhắn Zalo cho chúng tôi bất cứ lúc nào.`;
  },

  technical: (lead) => {
    const region = lead.province ? ` ở ${lead.province}` : '';
    return `Chọn đúng giống keo lai AH1 chất lượng${region} quyết định phần lớn tỉ lệ sống và năng suất sau này.

Vài tiêu chí nên kiểm tra khi nhận cây giống:
- Cây con cao đều, thân thẳng, không cong queo.
- Lá xanh tươi, không có dấu hiệu vàng úa hay sâu bệnh.
- Bộ rễ phát triển tốt trong bầu đất, không bị đứt gãy khi vận chuyển.
- Nguồn gốc rõ ràng, giâm hom từ cây mẹ đã tuyển chọn.

Mùa trồng thuận lợi nhất thường vào đầu mùa mưa — thời điểm cụ thể khác nhau theo từng vùng.

Đọc thêm các bài kỹ thuật trồng và chăm sóc keo lai tại **keolaigiamhom.vn**.`;
  },

  pricing: (lead) => {
    const qty = lead.quantity ? ` cho ${lead.quantity} vạn cây bạn đang quan tâm` : '';
    return `Gửi bạn bảng giá tham khảo giống keo lai AH1${qty}:

- Giá tham khảo: **800-1.200đ/cây** tùy số lượng đặt.
- Ưu đãi đặt sớm: **giảm 5%** cho đơn đặt trước mùa vụ.
- Hỗ trợ tư vấn vận chuyển theo khu vực.

Giá cuối cùng phụ thuộc số lượng và thời điểm đặt hàng — gọi hoặc nhắn Zalo để được báo giá chính xác cho đơn hàng của bạn.

📞 0907.282.960 (Phone/Zalo)`;
  },

  // Deliberately not "customer case studies" — see file header. Points at
  // real, already-published articles instead of inventing testimonials.
  testimonial: () => {
    return `Vườn Ươm Cây Giống Ngọc Sơn chuyên cung cấp giống keo lai AH1 giâm hom cho các hộ trồng rừng.

Nếu bạn còn băn khoăn trước khi đặt hàng, đây là những câu hỏi khách hàng thường hỏi nhất — đều đã có bài trả lời chi tiết trên website:

- Chi phí trồng 1 ha keo lai hết bao nhiêu?
- So sánh giống AH1 và AH7, nên chọn giống nào?
- Kỹ thuật trồng và mật độ trồng tối ưu theo từng loại đất?
- Cách phòng trừ sâu bệnh thường gặp?

Xem đầy đủ tại **keolaigiamhom.vn**, hoặc nhắn Zalo để được tư vấn trực tiếp theo đúng điều kiện đất/vùng của bạn.`;
  },

  final_offer: (lead) => {
    const region = lead.province ? ` (${lead.province})` : '';
    return `Xin chào ${lead.name}${region},

Đây là ưu đãi cuối cùng trong chuỗi tư vấn của chúng tôi:

🎁 **Giảm 10%** cho đơn hàng từ 5 vạn cây giống keo lai AH1
⏰ Áp dụng trong **7 ngày** kể từ email này

Nếu vẫn đang cân nhắc, hãy liên hệ để chúng tôi tư vấn phương án phù hợp nhất với diện tích và ngân sách của bạn.

📞 Gọi ngay: 0907.282.960 (Phone/Zalo)`;
  },
};

/** @param {{template: string}} step  @param {{name?: string, province?: string, quantity?: string|number}} lead */
function buildNurtureEmail(step, lead) {
  const template = NURTURE_TEMPLATES[step.template] || NURTURE_TEMPLATES.welcome;
  return template(lead || {});
}

/** Re-engagement email for stale leads (reengageStaleLead) — same no-LLM policy. */
function buildReengagementEmail(lead, seasonOffer) {
  const region = lead.province ? ` ở ${lead.province}` : '';
  const seasonLine = seasonOffer ? `\n\n${seasonOffer}` : '';
  return `Xin chào ${lead.name}${region},

Chúng tôi là Vườn Ươm Cây Giống Ngọc Sơn. Nhớ lần trước bạn quan tâm giống keo lai AH1.${seasonLine}

🎁 Hiện tại chúng tôi có ưu đãi **giảm 10%** cho đơn hàng từ 3 vạn cây, áp dụng trong **7 ngày**.

Liên hệ 0907.282.960 (Phone/Zalo) để được tư vấn phương án phù hợp.`;
}

module.exports = { NURTURE_TEMPLATES, buildNurtureEmail, buildReengagementEmail };
