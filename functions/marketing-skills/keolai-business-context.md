<!--
  Custom foundational file (NOT from coreyhaines31/marketingskills) — real business
  facts about keolaigiamhom.vn, read alongside the 9 forked skills so every
  Cloud Function that builds an LLM prompt has consistent grounding on the
  business. Keep this file, and only this file, up to date when business
  facts change (pricing model, contact info, product line, etc).

  Named "keolai-business-context.md" (not "product-marketing.md") to avoid
  colliding with the forked upstream skill skills/product-marketing/SKILL.md,
  which is methodology, not facts about this specific business.
-->

# Bối cảnh kinh doanh — keolaigiamhom.vn

## Sản phẩm

Cây giống keo lai giâm hom AH1, bán theo lô/số lượng lớn cho hộ trồng rừng. Thương hiệu "Keo Lai Xanh", pháp nhân "Vườn Ươm Cây Giống Ngọc Sơn". Khách hàng quay lại theo mùa vụ trồng rừng (không phải giao dịch 1 lần).

## Khách hàng mục tiêu

Nông dân, chủ vườn, hợp tác xã trồng rừng. Quyết định mua dựa trên **chi phí đầu tư và lợi nhuận/ha** — không phải tính năng sản phẩm. Ngôn ngữ nội dung phải nói bằng số liệu cụ thể (chi phí/ha, lợi nhuận/ha, tỉ lệ sống, chu kỳ thu hoạch), không dùng ngôn ngữ marketing hoa mỹ.

## Kênh hiện có

- **Google/SEO** — kênh chính đang vận hành, có bài viết index qua `keolaigiamhom.vn/articles/`.
- Facebook group nông nghiệp, Zalo, YouTube — chưa khai thác, xem Phase 6 của kế hoạch marketing-agent.

## Cụm truy vấn lõi (chủ đề nội dung ưu tiên)

Chi phí trồng 1 ha, lợi nhuận 1 ha, so sánh giống (AH1 vs AH7 vs giống hạt), kỹ thuật trồng/bón phân/làm đất, phòng trừ sâu bệnh, lịch mùa vụ theo vùng (Tây Nguyên, Đông Nam Bộ, v.v.).

## Giọng nội dung

Tiếng Việt thực dụng, số liệu cụ thể, không văn hoa. Không dùng các tuyên bố không kiểm chứng được (ví dụ tránh lặp lại lỗi cũ đã sửa: claim "kiểm định nguồn gốc" chưa xác minh đã bị gỡ khỏi site).

## Ràng buộc phạm vi nội dung

Ngách "kỹ thuật trồng keo lai" tại Việt Nam đã tương đối hẹp — site đã có nhiều bài viết index. **Ưu tiên nâng cấp bài cũ hơn viết bài mới.** Đây là lý do whitelist `action_type` của `strategistAgent` có 3/5 loại hành động là sửa bài có sẵn (`update_meta`, `add_faq`, `fix_internal_link`), chỉ 2 loại tạo/sửa nội dung mới (`update_data`, `propose_new_article`) — và cả 2 loại đó đều cần người duyệt.

## NAP (Name-Address-Phone) chuẩn

Dùng đúng thông tin này trong mọi claim/proposal liên quan tới liên hệ — không được để agent tự bịa hoặc dùng số liệu cũ:

- Số điện thoại: `0907282960`
- Domain: `keolaigiamhom.vn`
- Thương hiệu: Keo Lai Xanh
- Pháp nhân: Vườn Ươm Cây Giống Ngọc Sơn

## Số bài viết hiện có

58 bài (đếm thật từ collection Firestore `articles` ngày 2026-07-22, lúc xây `strategistAgent` — không phải ước đoán).
