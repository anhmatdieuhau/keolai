# KeoLai — Plan các mục còn thiếu

> Base plan: `docs/improvement-plan.md`
> CI/CD đã hoàn thành (deploy.yml + SETUP.md). Các mục dưới đây là phần còn lại.

---

## Mục tiêu ngắn

Hoàn thành các mục **Phase 0-3** theo thứ tự ưu tiên: quick-win trước, core optimization sau, infrastructure cuối.

---

## Mục 1: Fix Facebook Pixel ID

**File:** `keolai-next/app/layout.js` (dòng 62)

**Vấn đề:** Pixel ID đang để placeholder `YOUR_FB_PIXEL_ID`.

**Làm:**
- Thay `YOUR_FB_PIXEL_ID` bằng Facebook Pixel ID thật
- Nếu chưa có Pixel ID: tạo Facebook Business Manager → tạo Data Set → lấy Pixel ID

**Kiểm tra:**
- Mở browser DevTools → Network tab → filter "facebook" → request đến `fbevents.js` phải có `&id=1234567890` (số thật)

---

## Mục 2: Social Proof Thật (0.4)

**Effort:** 🟢 2h
**File:** `keolai-next/app/page.js`, `keolai-next/components/LeadForm.js`

**Vấn đề:** Testimonials đang là giả định (tên Hùng, chị Mai). Không có badge "Đã giao X cây".

### 2.1 Thay thế testimonials

Trong `keolai-next/app/page.js`:
- Tìm section testimonials hiện tại
- Thay 3 testimonial fake bằng real data (có thể hardcode tạm vào mảng, sau này move lên Firestore)
- Format mỗi testimonial:
  ```js
  { name: "Tên thật", location: "Tỉnh", amount: "Số cây đã mua", years: "Khách hàng từ năm", quote: "Nội dung", avatar: "/images/testimonials/ten-nguoi.jpg" }
  ```
- Nếu chưa có ảnh: dùng avatar placeholder SVG (không dùng emoji)

### 2.2 Thêm trust badge động

Trong Hero section hoặc LeadForm:
- Thêm badge: "Đã giao {count} cây trong năm 2026"
- `count` hardcode tạm (VD: 500000), sau này đọc từ Firestore
- Hiển thị dạng count-up animation

### 2.3 Tạo thư mục chứa ảnh thật

- Tạo `keolai-next/public/images/testimonials/` + `.gitkeep`
- Tạo `keolai-next/public/images/vuon/` + `.gitkeep` (ảnh vườn thật sau này)

---

## Mục 3: Content Pipeline Analytics (1.2)

**Effort:** 🔴 16h
**Files:** Mới: `keolai-next/lib/analytics.js`, sửa `functions/index.js`

**Vấn đề:** Pipeline tạo bài đều đặn nhưng không biết bài nào hiệu quả, từ khóa nào convert.

### 3.1 GA4 Data Layer

Trong `keolai-next/lib/articles.js`:
- Export hàm `getArticleAnalytics(slug)` — fetch từ Cloud Function

Tạo mới `keolai-next/lib/analytics.js`:
```js
// Định nghĩa types cho analytics data
// Fetch article analytics từ Cloud Function URL
```

### 3.2 Cloud Function: contentAnalytics

Trong `functions/index.js`, function `contentAnalytics`:
- Nhận `slug` param
- Gọi GA4 Data API (v1beta) để lấy page views, users cho URL `/articles/{slug}`
- Match với số lead từ Firestore `leads` collection (field `source` chứa slug)
- Ghi kết quả vào Firestore `articles/{slug}/analytics`
- Return JSON

Cần deploy thêm package: `npm install @google-analytics/data` trong `functions/`

### 3.3 Hiển thị trên CMS page

Trong `keolai-next/app/cms/page.js`:
- Nếu đã login, hiển thị thêm cột analytics cho mỗi article
- Views, leads, conversion rate, avg time on page

---

## Mục 4: ROI Tracking (1.4)

**Effort:** 🟡 8h
**Files:** `keolai-next/components/LeadForm.js`, `ExitPopup.js`, `SmartCTA.js`

**Vấn đề:** Không biết lead đến từ bài viết nào, chi phí bao nhiêu.

### 4.1 Source tracking

Lead form components (`LeadForm.js`, `ExitPopup.js`, `SmartCTA.js`):
- Mỗi component khi submit lead đã có field `source` (article slug hoặc 'homepage', 'exit_popup')
- Kiểm tra: field `source` có được gửi lên Cloud Function không → đọc `functions/index.js` function `submitLead`

### 4.2 Cloud Function: submitLead

Trong `functions/index.js`, function `submitLead`:
- Kiểm tra xem `source` có được lưu vào Firestore document không
- Nếu chưa: thêm field `source` vào lead document

### 4.3 Google Sheets export

Function `sheetsExport` đã có trong functions — kiểm tra:
- Nó có export đúng cấu trúc (source, date, v.v.) không
- Nếu thiếu source column: thêm vào

---

## Mục 5: Mobile UX Audit (2.1)

**Effort:** 🟢 4h
**Files:** `keolai-next/app/globals.css` (media queries)

**Vấn đề:** Khách hàng mục tiêu (nông dân, chủ hộ) phần lớn dùng điện thoại.

### 5.1 Audit checklist

Mở Chrome DevTools → kiểm tra từng item trên iPhone SE (375px) và Galaxy S21 (360px):

- [ ] Hero section text đọc được, không bị che
- [ ] Lead form scroll được khi keyboard mở (không bị kẹt)
- [ ] CTA buttons ≥ 48x48px touch target
- [ ] Article body font ≥ 16px, line-height ≥ 1.6
- [ ] Images không overflow container
- [ ] Navigation hamburger hoạt động
- [ ] Pricing cards không bị vỡ layout

### 5.2 Fix CSS

Trong `keolai-next/app/globals.css`:
- Thêm media queries cho mobile nếu thiếu
- Fix cụ thể từng vấn đề tìm được ở 5.1

### 5.3 Clarity recordings

- Đăng nhập Microsoft Clarity
- Xem session recordings của user mobile thực tế
- Note lại UX friction points

---

## Mục 6: Performance Optimization (2.2)

**Effort:** 🟢 4h
**Files:** `keolai-next/app/globals.css`, image components

### 6.1 Lighthouse audit

Chạy:
```bash
npx lighthouse https://keolaigiamhom.vn --view
```

Target:
- Performance ≥ 90
- Accessibility ≥ 90
- SEO ≥ 95

### 6.2 Fix common issues

Nếu LCP > 2.5s:
- Hero image: thêm `priority` attribute + `fetchpriority="high"`
- Kiểm tra trong `keolai-next/app/page.js` component Hero

Nếu CLS > 0.1:
- Thêm `width` + `height` cho tất cả images
- Font: đã có `display=swap`, kiểm tra preconnect

Nếu render-blocking resources:
- Thêm `preconnect` cho Google Fonts trong `layout.js`

---

## Mục 7: Form UX Improvements (2.3)

**Effort:** 🟢 2h
**Files:** `keolai-next/components/LeadForm.js`

**Vấn đề:** Field SĐT không mở numeric keyboard trên mobile. Field Tỉnh đang là text input.

### 7.1 Phone field

Trong `LeadForm.js`:
- Thêm `inputmode="numeric"` vào input phone

### 7.2 Quantity field

- Thêm `inputmode="numeric"` vào input số lượng

### 7.3 Province field

- Chuyển từ `<input type="text">` thành `<input list="provinces">` + `<datalist id="provinces">`
- Data list: 63 tỉnh thành Việt Nam
- Không cần JS library

---

## Mục 8: Error Monitoring (3.1)

**Effort:** 🟡 8h
**Files:** Mới, `functions/index.js`

**Vấn đề:** Không biết function error, không biết lead form fail bao nhiêu lần.

### 8.1 Frontend (đã có basic)

Trong `keolai-next/app/layout.js` (dòng 65-82) đã có error tracking qua GA4 events:
```js
window.addEventListener('error', function(e) { ... })
window.addEventListener('unhandledrejection', function(e) { ... })
```

Kiểm tra: GA4 reports có hiển thị `exception` events không.

### 8.2 Backend structured logging

Trong `functions/index.js`:
- Mỗi Cloud Function catch error → log JSON với: `{ severity, message, function, error, timestamp }`
- Dùng `functions.logger.error()` thay vì `console.error()`
- Các function cần log: submitLead, serveArticle, serveSitemap, pipeline functions

### 8.3 Alert (optional)

- Tạo Cloud Logging Alert policy nếu error rate > 5% trong 5 phút
- Gửi email đến dtduy46@gmail.com

---

## Mục 9: Pipeline Deadlock Prevention (3.2)

**Effort:** 🟢 4h
**Files:** `functions/index.js` (function pipelineHealthCheck)

**Vấn đề:** Pipeline Agent cần duyệt brief — nếu không duyệt trong 48h, pipeline treo.

### 9.1 Auto-approve logic

Trong `functions/index.js`, function `pipelineHealthCheck` (hoặc tạo mới):
- Query Firestore `pipeline/briefs` collection
- Nếu brief quá 72h chưa được approved: gửi email nhắc (Gmail API hoặc SendGrid)
- Nếu brief quá 96h: auto-approve với priority thấp
- Nếu brief quá 1 tuần: archive (move sang `pipeline/archived`)

### 9.2 Cloud Scheduler

- Scheduler đã có 11 jobs — có thể thêm 1 job mới
- Cần kiểm tra file pipelines schedule hoặc terraform config

---

## Mục 10: Phase 4 — Strategic Growth (dài hạn)

Không urgent, nhưng cần document để biết khi nào làm.

### 10.1 Zalo OA Integration

**Khi nào làm:** Sau khi có Zalo Official Account (cần giấy tờ kinh doanh)

**Cần làm:**
- Đăng ký Zalo OA tại https://oa.zalo.me
- Tích hợp Zalo OA API:
  - Gửi tin nhắn xác nhận lead tự động (trigger từ `submitLead` function)
  - Gửi broadcast khi có bài viết mới (trigger từ `scheduleContentGeneration`)
  - Chatbot FAQ (kết nối với JSON-LD FAQ hiện tại)
- Tracking: GA4 event `zalo_follow`

### 10.2 Content Dashboard

**File mới:** Google Looker Studio hoặc custom dashboard trong `/cms`
**Nguồn data:** GA4 + Firestore exports
**Metrics:** Leads theo bài, page views, conversion rate, cost per lead

### 10.3 Google Ads

- Search campaigns: keywords "mua cây keo giống", "keo lai giống", "cây giống lâm nghiệp"
- Budget khởi điểm: 200k-500k/ngày
- Landing page: `/articles/{slug}` matching keyword
- Conversion tracking: GA4 → Google Ads import

### 10.4 Technical SEO

- **Internal linking:** Đã có inline related articles (đo 2 H2). Kiểm tra có hoạt động không.
- **Image SEO:** Thêm `alt` text cho assets (hiện tại asset images không có alt)
- **Core Web Vitals:** Kiểm tra Google Search Console → Core Web Vitals report
- **Video sitemap:** Nếu có video về vườn ươm sau này

---

## Thứ tự ưu tiên triển khai

1. **Mục 1** (Fix FB Pixel ID) — 5 phút, unblock tracking
2. **Mục 2** (Social Proof) — 2h, impact cao
3. **Mục 7** (Form UX) — 2h, quick win
4. **Mục 5** (Mobile Audit) — 4h, cần baseline
5. **Mục 6** (Performance) — 4h, SEO impact
6. **Mục 3** (Analytics) — 16h, quan trọng nhưng nặng
7. **Mục 4** (ROI Tracking) — 8h
8. **Mục 8** (Error Monitoring) — 8h
9. **Mục 9** (Pipeline Deadlock) — 4h
10. **Mục 10** (Phase 4) — dài hạn, làm sau cùng

---

## Files cần tạo mới

| File | Mục đích |
|------|----------|
| `keolai-next/lib/analytics.js` | GA4 Data API client + types |
| `keolai-next/public/images/testimonials/.gitkeep` | Thư mục ảnh thật |
| `keolai-next/public/images/vuon/.gitkeep` | Thư mục ảnh vườn thật |

## Files cần sửa

| File | Mục đích |
|------|----------|
| `keolai-next/app/layout.js` | Fix FB Pixel ID |
| `keolai-next/app/page.js` | Thay testimonials, thêm trust badge |
| `keolai-next/components/LeadForm.js` | inputmode, datalist province |
| `keolai-next/components/ExitPopup.js` | Verify source tracking |
| `keolai-next/components/SmartCTA.js` | Verify source tracking |
| `keolai-next/app/cms/page.js` | Thêm analytics columns (nếu có) |
| `keolai-next/app/globals.css` | Mobile fixes, performance fixes |
| `functions/index.js` | contentAnalytics, error logging, auto-approve |
| `functions/package.json` | Thêm @google-analytics/data |
