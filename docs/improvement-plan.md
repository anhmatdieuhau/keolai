# Kế Hoạch Cải Thiện KeoLai

> **Mục tiêu:** Tối ưu lead gen, tăng conversion rate, đóng các gap kỹ thuật và marketing.
> **Chiến thuật:** Ưu tiên quick-win trước, core optimization sau, strategic growth cuối cùng.

---

## Phase 0 — Quick Wins (1-2 ngày)

### 0.1 Facebook Pixel + Retargeting

**Vấn đề:** Không thể retarget người xem bài viết. Một người đọc 3 bài về kỹ thuật trồng keo rời đi vĩnh viễn — không có cách nào kéo họ quay lại.

**Làm:**
- Thêm Facebook Pixel trong `layout.js` (bên cạnh GA4 và Clarity hiện tại)
- Track sự kiện `ViewContent` cho homepage, `ViewArticle` cho bài viết
- Track `Lead` khi form được submit thành công
- **Chi phí:** 0đ (Pixel free) — chỉ cần tạo Business Manager + Pixel ID

**Mức độ ưu tiên:** 🔴 **CAO NHẤT** — vì retargeting là kênh có ROAS cao nhất với chi phí gần như bằng 0 để triển khai.

### 0.2 Exit-Intent Popup

**Vấn đề:** Người dùng đọc bài viết xong → rời trang → không có cơ hội giữ chân.

**Làm:**
- Thêm component `ExitPopup.js`:
  - Detect mouse rời khỏi window (dùng `document.addEventListener('mouseleave', ...)`)
  - Hiển thị popup với offer: "Tải ebook kỹ thuật trồng keo miễn phí" hoặc "Nhận báo giá ưu đãi trong 24h"
  - Form 2 field: SĐT + Họ tên (ngắn hơn form chính để giảm friction)
  - GA4 event tracking cho exit intent
- **Chỉ hiện 1 lần/session** (sessionStorage flag)
- **Không hiện nếu đã submit form chính** (kiểm tra sessionStorage)

**Mức độ ưu tiên:** 🔴 CAO — chi phí thấp, retention potential cao.

### 0.3 Contextual CTA Trong Bài Viết

**Vấn đề:** `AutoGenArticles` chỉ show danh sách bài viết "Xem thêm" — không có CTA chuyển đổi. Người đọc xong bài viết kỹ thuật, không được dẫn dắt đến hành động mua.

**Làm:**
- Component mới `ArticleCTA.js`:
  - Mỗi bài viết `.mdx` có thêm frontmatter field `cta_text` và `cta_goal`
  - Cuối mỗi bài viết, thay vì CTA cứng ("Gọi 0907.282.960"), render CTA động dựa trên nội dung bài:
    - Bài về "kỹ thuật trồng": CTA → "Tải checklist trồng keo" (lead gen)
    - Bài về "giá cả": CTA → "Báo giá mới nhất" (lead gen)
    - Bài về "so sánh giống": CTA → "Đặt cây giống AH1" (direct)
- A/B test: CTA cuối bài vs. CTA ở giữa bài (sau section 2)

**Mức độ ưu tiên:** 🟡 TRUNG BÌNH — phụ thuộc vào content pipeline.

### 0.4 Social Proof Thật

**Vấn đề:** Testimonials hiện tại là giả định (anh Hùng, chị Mai). Người mua cần bằng chứng xã hội thật.

**Làm:**
- Thu thập real testimonials từ khách hàng cũ qua Zalo
- Thay thế 3 testimonial giả bằng real (kèm ảnh chụp cây thực tế, tên thật)
- Thêm badge: "Đã giao X cây trong năm 2026" (cập nhật thủ công hoặc từ Firestore)
- Nếu có thể: quay video ngắn khách hàng nói về cây giống

**Mức độ ưu tiên:** 🟡 TRUNG BÌNH — phụ thuộc vào sự hợp tác từ chủ vườn.

---

## Phase 1 — Core Optimization (3-5 ngày)

### 1.1 Article CTA Engine

**Vấn đề:** Người dùng đọc xong bài viết, thấy CTA cứng "Gọi 0907..." — không đủ mạnh, không personalization.

**Làm:**
- Thêm frontmatter field `ctaType` vào `.mdx`: `'lead'` | `'phone'` | `'zalo'`
- Component `SmartCTA.js`:
  - `ctaType = 'lead'`: Hiển thị mini-form (2 field: SĐT) + "Tải tài liệu kỹ thuật miễn phí"
  - `ctaType = 'phone'`: Hiển thị số điện thoại + nút "Gọi ngay"
  - `ctaType = 'zalo'`: Link Zalo với message context theo bài viết
- Article page: replace CTA section cứng bằng `SmartCTA` component

### 1.2 Phân Bổ Lại Content Pipeline

**Vấn đề:** Pipeline tạo bài viết đều đặn MWF nhưng không có vòng lặp phân tích — không biết bài nào hiệu quả, từ khóa nào convert.

**Làm:**
- Thêm `analytics` field vào Firestore `articles` collection:
  ```
  analytics: {
    pageViews: number,
    leadConversions: number,
    conversionRate: number,
    avgTimeOnPage: number,
    topExitPoint: string
  }
  ```
- Script backend chạy Cloud Function hàng tuần:
  - Lấy dữ liệu từ GA4 API (page views, users, event count)
  - Match với số lead từ Firestore `leads`
  - Ghi vào `articles/{slug}/analytics`
  - Pipeline Analyst agent đọc analytics để quyết định topic tiếp theo
- **Output:** Content pipeline dừng tạo bài mù quáng, tập trung vào topic có conversion cao

### 1.3 A/B Testing Framework

**Vấn đề:** Không thể thử nghiệm. Form hiện tại có thể chỉ convert 1-2%, nhưng không biết.

**Làm:**
- Triển khai A/B test cho lead form (dùng query param `?v=a` hoặc `?v=b`):
  - **Variant A** (hiện tại): 5 fields, progress bar
  - **Variant B:** Chỉ 2 fields (SĐT + Họ tên), gọi điện sau để hỏi thêm
  - **Variant C:** 3 fields nhưng có field "Nhu cầu" thay vì "Số lượng" + "Tỉnh"
- Tracking: GA4 event `lead_form_variant` + `generate_lead` với variant label
- **Duration:** 2 tuần, tối thiểu 50 leads/variant
- **Phân phối 50/50** dùng Math.random() ở phía client

### 1.4 Theo Dõi ROI Content

**Vấn đề:** Tiêu tốn chi phí cho Cloud Functions + Vertex AI tạo bài viết, không biết bài nào đem về doanh thu.

**Làm:**
- Thêm `source` field vào lead submit: article slug nếu lead đến từ article page
- GA4 event `generate_lead` kèm `content_source` (article slug hoặc 'homepage')
- Dashboard (đơn giản): Google Sheets tự động cập nhật từ Firestore exports
- Báo cáo hàng tháng: cost per lead theo content source

---

## Phase 2 — Mobile & UX (2-3 ngày)

### 2.1 Audit Mobile UX

**Vấn đề:** Khách hàng mục tiêu (nông dân, chủ hộ) phần lớn dùng điện thoại. Cần kiểm tra thực tế.

**Làm:**
- Kiểm tra trên Chrome DevTools (iPhone SE, iPhone 12, Galaxy S21):
  - Hero section text có đọc được không?
  - Lead form có scroll được không? (form dài, có thể bị che keyboard)
  - Các nút CTA có đủ to để bấm bằng ngón tay không? (tối thiểu 48x48px)
  - Bài viết: font size, line height, image loading
- Clarity session recordings: xem thực tế người dùng mobile tương tác thế nào
- **Fix:** Điều chỉnh CSS media queries cho đến khi pass UX audit

### 2.2 Tối Ưu Tốc Độ

**Vấn đề:** Next.js SSG đã nhanh nhưng có thể kiểm tra thêm.

**Làm:**
- Lighthouse audit (mobile + desktop):
  - Largest Contentful Paint (LCP) < 2.5s
  - First Input Delay (FID) < 100ms
  - Cumulative Layout Shift (CLS) < 0.1
- Nếu hero image là vấn đề: thêm `priority` và `fetchpriority="high"`
- Nếu Google Fonts block render: thêm `display=swap` (đã có), kiểm tra preconnect
- Nếu layout shift do font swap: thêm `size-adjust` fallback

### 2.3 Keyboard-Friendly Form

**Vấn đề:** Trên mobile, input số điện thoại nên mở numeric keyboard.

**Làm:**
- Phone field: `inputmode="numeric"` + `pattern="[0-9]{9,11}"` (đã có pattern)
- Quantity field: `inputmode="numeric"`
- Province field: chuyển từ `input type="text"` thành datalist suggestions (63 tỉnh thành)
  - Giảm lỗi gõ sai, tăng completion rate
  - Dùng `<datalist>` HTML thuần, không cần JS library

---

## Phase 3 — Infrastructure & Monitoring (2-3 ngày)

### 3.1 Error Monitoring

**Vấn đề:** Không biết function error, không biết lead form fail bao nhiêu lần.

**Làm:**
- Thêm Sentry (free tier): 
  - Frontend: `@sentry/nextjs` cho client-side errors + performance
  - Backend: Sentry wrapper cho Cloud Functions
- Hoặc Sentry-free alternative: GA4 error tracking + custom console.error handler
- Cloud Function: thêm structured logging (JSON) → Cloud Logging → alert nếu error rate > 5%

### 3.2 Pipeline Deadlock Prevention

**Vấn đề:** Pipeline Agent Reviewer gửi email đến `dtduy46@gmail.com` — nếu không duyệt trong 48h, pipeline treo vĩnh viễn.

**Làm:**
- Auto-approve mechanism:
  - Nếu brief không được duyệt sau 72h → tự động gửi email nhắc nhở
  - Nếu 96h → auto-approve (với priority thấp hơn)
  - Nếu 1 tuần → archive
- Thêm optional cron job hàng ngày: check `pipeline/briefs` có items nào quá hạn

### 3.3 Backup & Recovery

**Vấn đề:** Lead lưu ở Firestore, không có backup tự động.

**Làm:**
- Firestore export schedule: dùng Cloud Scheduler + Cloud Functions
  - Export to Cloud Storage bucket mỗi ngày
  - Export format: JSON, nén
- Retention policy: giữ 30 ngày backup
- Restore procedure: document trong `docs/disaster-recovery.md`

### 3.4 CI/CD

**Vấn đề:** Deploy thủ công, không có quy trình.

**Làm:**
- GitHub repository (nếu chưa có)
- GitHub Actions workflow:
  - `on: push to main` → build Next.js → deploy Firebase Hosting
  - `on: push to main` → deploy Cloud Functions
- Pre-deploy checks: build kiểm tra lỗi, lint

---

## Phase 4 — Strategic Growth (dài hạn, 1-2 tháng)

### 4.1 Zalo OA (Official Account) Integration

**Vấn đề:** Zalo hiện tại chỉ là Zalo cá nhân. Không có Zalo OA → không chat tự động, không gửi broadcast, không retarget.

**Làm:**
- Đăng ký Zalo OA (Official Account) — cần giấy tờ kinh doanh
- Tích hợp Zalo OA API:
  - Gửi tin nhắn xác nhận lead tự động
  - Gửi broadcast khi có bài viết mới
  - Chatbot trả lời FAQ cơ bản (kết nối với JSON-LD FAQ hiện tại)
- Followers tracking: GA4 event `zalo_follow`

**Khi nào làm:** Sau khi có Zalo OA (phase này không thể start nếu chưa đăng ký).

### 4.2 Content Performance Dashboard

**Vấn đề:** Pipeline Analyst tạo report nhưng không có dashboard để xem.

**Làm:**
- Dashboard nhẹ (Google Sheets Looker Studio, free):
  - Source: GA4 + Firestore exports
  - Metrics: leads theo bài viết, page views, conversion rate, cost per lead
- Hoặc custom dashboard trong `/cms` page (hiện tại chỉ là CMS chat, có thể mở rộng)

### 4.3 Google Ads

**Vấn đề:** Chỉ dựa vào organic search.

**Làm:**
- Google Ads với search campaigns:
  - Keywords: "mua cây keo giống", "keo lai giống", "cây giống lâm nghiệp"
  - Budget: thử nghiệm 200k-500k/ngày
  - Landing page: `/articles/{slug}` matching keyword (quality score optimization)
- Conversion tracking: GA4 → Google Ads (import goals)

### 4.4 Technical SEO Nâng Cao

**Vấn đề:** Có JSON-LD cơ bản nhưng có thể cải thiện.

**Làm:**
- Article breadcrumb: đã có BreadcrumbList schema — kiểm tra Google Search Console
- Video sitemap: nếu có video về vườn ươm
- Image SEO: thêm alt text chuẩn cho tất cả ảnh (hiện tại asset images không có alt)
- Core Web Vitals optimization: kiểm tra GSC báo cáo
- Internal linking: thêm related articles links trong article body (không chỉ ở cuối)

---

## Tổng Quan Timeline

```
Phase 0 (1-2 ngày):
  ├── 0.1 Facebook Pixel + Retargeting 🔴
  ├── 0.2 Exit-Intent Popup 🔴
  ├── 0.3 Contextual CTA 🟡
  └── 0.4 Social Proof Thật 🟡

Phase 1 (3-5 ngày):
  ├── 1.1 Article CTA Engine
  ├── 1.2 Content Pipeline Analytics
  ├── 1.3 A/B Testing
  └── 1.4 ROI Tracking

Phase 2 (2-3 ngày):
  ├── 2.1 Mobile UX Audit
  ├── 2.2 Tốc độ (Lighthouse)
  └── 2.3 Keyboard-Friendly Form

Phase 3 (2-3 ngày):
  ├── 3.1 Error Monitoring
  ├── 3.2 Pipeline Deadlock
  ├── 3.3 Backup
  └── 3.4 CI/CD

Phase 4 (1-2 tháng):
  ├── 4.1 Zalo OA (sau khi đăng ký)
  ├── 4.2 Content Dashboard
  ├── 4.3 Google Ads
  └── 4.4 Technical SEO
```

## Impact Matrix

| Item | Effort | Impact | Cost | Dependencies |
|------|--------|--------|------|-------------|
| 0.1 Facebook Pixel | 🟢 2h | 🔴 Cao | 0đ | Facebook Business Manager |
| 0.2 Exit Popup | 🟢 4h | 🔴 Cao | 0đ | Không |
| 0.3 Article CTA | 🟡 6h | 🟡 TB | 0đ | Content review |
| 0.4 Social Proof | 🟢 2h | 🟡 TB | 0đ | Owner cooperation |
| 1.1 CTA Engine | 🟡 12h | 🟡 TB | 0đ | 0.3 |
| 1.2 Content Analytics | 🔴 16h | 🔴 Cao | Vertex AI cost | Pipeline |
| 1.3 A/B Testing | 🟡 8h | 🔴 Cao | 0đ | 0.1 (GA4 tracking) |
| 1.4 ROI Tracking | 🟡 8h | 🔴 Cao | 0đ | 1.2 |
| 2.1 Mobile Audit | 🟢 4h | 🟡 TB | 0đ | Không |
| 2.2 Speed | 🟢 4h | 🟡 TB | 0đ | 2.1 |
| 2.3 Form UX | 🟢 2h | 🟢 Thấp | 0đ | Không |
| 3.1 Monitoring | 🟡 8h | 🟡 TB | 0đ (Sentry free) | Không |
| 3.2 Pipeline Fix | 🟢 4h | 🟡 TB | 0đ | Pipeline |
| 3.3 Backup | 🟢 2h | 🟡 TB | Storage cost | Không |
| 3.4 CI/CD | 🟡 8h | 🟢 Thấp | 0đ | GitHub |
| 4.1 Zalo OA | 🔴 Cao | 🔴 Cao | Zalo OA fee | Đăng ký OA |
| 4.2 Dashboard | 🔴 16h | 🟡 TB | 0đ | 1.2 |
| 4.3 Google Ads | 🟡 8h | 🔴 Cao | Ad spend | 0.1 |
| 4.4 Advanced SEO | 🟡 12h | 🟡 TB | 0đ | Không |

## Bắt Đầu Từ Đâu?

**Recommendation:** Nếu chỉ có 1 tuần, làm theo thứ tự:

1. **Ngày 1:** Facebook Pixel + Exit-Intent Popup (impact nhanh nhất, 0đ)
2. **Ngày 2:** Contextual CTA trong bài viết + Social Proof thật
3. **Ngày 3-5:** A/B test lead form + Content ROI tracking setup
4. **Ngày 6-7:** Mobile UX audit + fix + Error monitoring

Sau đó đánh giá kết quả (comparison: before/after metrics) trước khi đầu tư Phase 3 & 4.
