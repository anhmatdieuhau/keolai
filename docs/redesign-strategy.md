# Chiến Lược Redesign Giao Diện KeoLai

> **Mục tiêu:** Giao diện "đẹp hơn" nhưng vẫn "gần gũi với bà con nông dân".
> **Đối tượng:** Nông dân trồng rừng (35-60 tuổi), chủ hộ, doanh nghiệp nhỏ lâm nghiệp — đa số dùng điện thoại.
> **Triết lý thiết kế:** "Vườn ươm" — mộc mạc, xanh tươi, đáng tin cậy.

---

## 1. Đánh Giá Thiết Kế Hiện Tại

### Điểm mạnh
- ✅ Bảng màu xanh lá nhất quán (brand recognition)
- ✅ Typography (Be Vietnam Pro) đọc tốt tiếng Việt
- ✅ Scroll reveal animations tạo cảm giác mượt
- ✅ Card-based layout cho articles và pricing
- ✅ JSON-LD SEO đầy đủ

### Điểm yếu
- ❌ Quá nhiều chữ in hoa (uppercase) — cảm giác như đang "la" khách hàng
- ❌ Thiếu hình ảnh thật của vườn ươm — đang dùng ảnh từ Google CDN
- ❌ Bảng màu quá lạnh: chỉ có xanh lá đậm + trắng, thiếu điểm nhấn ấm áp
- ❌ Nút bấm chữ toàn uppercase + letter-spacing lớn → khó đọc trên mobile
- ❌ Thiếu real social proof (ảnh khách hàng thật, cây thật)
- ❌ 2140 dòng CSS trong 1 file — khó maintain
- ❌ Thiếu hình ảnh/video quy trình sản xuất (phun sương, cắt đọt, vườn cây mẹ)
- ❌ Container max-width 1200px hơi rộng cho article content (720px là tốt)

---

## 2. Định Hướng Thiết Kế Mới

### 2.1 Design Tokens

```css
:root {
  /* ── Core Colors (giữ nguyên brand green) ── */
  --primary: #0f5238;
  --primary-light: #2d6a4f;
  --primary-dark: #081f15;

  /* ── Thêm warm accent ── */
  --accent-warm: #d4993a;     /* Vàng đất ấm — điểm nhấn */
  --accent-warm-light: #f0d49e;
  --accent-earth: #8b6f47;    /* Nâu đất — cho texture */

  /* ── Surface ── */
  --surface: #faf8f5;          /* Trắng kem ấm (thay vì trắng lạnh #f9f9f8) */
  --surface-warm: #f5f0ea;     /* Nền ấm cho sections */
  --surface-card: #ffffff;
  
  /* ── Typography ── */
  --text-primary: #1a1a1a;
  --text-secondary: #5a5a5a;
  --text-muted: #8c8c8c;
  
  /* ── Border & Shadow ── */
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-xl: 28px;
  --shadow-soft: 0 4px 20px rgba(15, 82, 56, 0.06);
  --shadow-warm: 0 8px 32px rgba(212, 153, 58, 0.10);
}
```

**Tại sao thêm warm accent?** Màu xanh lá thuần túy tạo cảm giác "công ty" — thêm vàng đất ấm làm dịu, gợi nhớ đất đai, nắng, mùa màng. Bà con nông dân cảm thấy quen thuộc hơn.

### 2.2 Typography

| Element | Trước (cũ) | Sau (mới) | Lý do |
|---------|-----------|-----------|-------|
| Heading | Uppercase, letter-spacing 0.15em | Title case, letter-spacing bình thường | Uppercase khó đọc, nhất là trên mobile |
| Body text | size 1rem (18px root) | 1rem-1.05rem | Giữ nguyên, đã tốt |
| Button text | Uppercase + spacing 0.15em | Uppercase nhưng spacing 0.08em | Viết hoa vẫn ok nhưng spacing nhỏ lại |
| Font | Be Vietnam Pro 400-900 | Giữ nguyên + thêm weight 300 cho caption | Be Vietnam Pro đã rất tốt cho tiếng Việt |

### 2.3 Hình Ảnh & Visual Hierarchy

**Vấn đề lớn nhất:** Website đang thiếu hình ảnh thật của vườn ươm.

**Ưu tiên chụp ảnh thật:**
1. Vườn cây mẹ AH1 — cho khách thấy nguồn giống
2. Hệ thống phun sương tự động — unique selling point
3. Cây giống xuất vườn (cầm trên tay để thấy kích thước)
4. Khách hàng nhận cây / vườn đã trồng — social proof
5. Quy trình cắt đọt → giâm → ươm (3-4 ảnh)
6. Chủ vườn (Ngọc Sơn) chụp chân dung — tạo trust

**Nếu chưa chụp được:**
- Dùng illustration/minh họa vector (không dùng stock photo)
- Vẽ icon bộ quy trình sản xuất dạng infographic
- Mô phỏng hệ thống phun sương bằng animation nhẹ (CSS/SVG)

---

## 3. Layout Redesign Theo Từng Section

### 3.1 Header

**Hiện tại:**
```
[LOGO]  [Sản phẩm] [Bảng giá] [Kiến thức] [Hỏi đáp] [0907 282 960] [☰]
```

**Sau redesign:**
```
[🌿 KEO LAI XANH]  [Sản phẩm] [Bảng giá] [Bài viết] [Hỏi đáp] [📞 0907.282.960] [☰]
```

Thay đổi:
- Logo thêm icon lá nhỏ (SVG inline, không cần image)
- Ẩn số điện thoại trên mobile (chỉ hiện icon phone)
- Sticky header có background đục hơn (backdrop-filter mạnh hơn)
- Thêm active state cho nav-link khi ở section đó (IntersectionObserver)

### 3.2 Hero Section (Trang Chủ)

**Hiện tại:**
- Ảnh full-width với overlay gradient 60% + text
- Heading: "Vườn Ươm Keo Lai Giâm Đọt Chất Lượng Cao"
- 2 buttons: [LIÊN HỆ BÁO GIÁ] [GỌI NGAY]
- Trust badge ở dưới

**Sau redesign:**
```
┌─────────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░  🏡 Vườn Ươm từ 2003                    ░░        │
│ ░░  🌱 Cây giống Keo Lai AH1               ░░        │
│ ░░  Chất lượng cao — Giá tận vườn          ░░        │
│ ░░                                           ░░        │
│ ░░  [📞 NHẬN BÁO GIÁ]  [💬 CHAT ZALO]      ░░        │
│ ░░                                           ░░        │
│ ░░  ⭐ 4.9 · 47 đánh giá · Giao toàn quốc   ░░        │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────────────────────────────────┘
  [🏆 Đã giao 500,000+ cây] [📍 Đồng Nai → Toàn quốc] [🌿 Tỷ lệ sống >95%]
```

Thay đổi:
- **Giảm overlay opacity xuống 30%** — để ảnh vườn ươm hiện rõ hơn
- Thêm breadcrumb text "Vườn Ươm từ 2003" — nhấn mạnh uy tín
- Thay đổi nút: "LIÊN HỆ BÁO GIÁ" → to hơn, màu vàng ấm (accent-warm)
- Thêm nút Zalo bên cạnh (tận dụng contextual message)
- Trust badges dạng chip dưới hero (dùng SVG icons nhỏ)
- Có thể thêm số count-up animation: "Đã giao X cây"

### 3.3 Featured Articles (Sau Hero)

**Hiện tại:** Grid 3 cột với số thứ tự 01, 02, 03.

**Sau redesign:**
- Chuyển thành dạng **horizontal cards** với ảnh + text (trên mobile: vertical stack)
- Mỗi card: [Ảnh nhỏ] [Title] [Description] [Tag: "Kỹ thuật" | "Kinh tế"]
- Thêm badge "Mới nhất" cho bài gần đây nhất
- Nút "Xem tất cả bài viết" chuyển thành button có icon arrow

### 3.4 Specs Section (Thông Số Kỹ Thuật)

**Hiện tại:** Grid 2 cột: text trái, bảng phải.

**Sau redesign:**
- Chuyển thành **icon cards** (grid 5 cột trên desktop, 2 cột mobile)
- Mỗi card: icon lớn + label + value
- Visual hơn: dùng icon SVG thay vì emoji (🌿 → leaf icon)
- Thêm mini-infographic quy trình sản xuất (horizontal timeline):
  ```
  [Cây mẹ] → [Cắt đọt] → [Giâm bầu] → [Phun sương] → [Xuất vườn]
  ```
  Mỗi bước có icon + thời gian

### 3.5 Pricing Cards

**Hiện tại:** 3 card dọc, card ở giữa là "Phổ biến nhất" với scale(1.03).

**Sau redesign:**
- Card "Phổ biến nhất" có nổi bật hơn: border vàng ấm + shadow vàng
- Thêm visual hint: biểu tượng "⭐" hoặc "🔥" cho phổ biến
- Giá: font-size to hơn (hiện tại 2.2rem → 2.8rem)
- Nút CTA trên card popular: màu vàng ấm thay vì trắng
- Thêm dòng nhỏ dưới mỗi nút: "Cam kết giá tốt nhất"

### 3.6 Testimonials

**Hiện tại:** 3 card text, top border màu xanh, 3 ngôi sao.

**Sau redesign:**
- Nếu có ảnh khách hàng thật: thêm avatar circle
- Nếu chưa có: dùng icon người dạng silhouette
- Thêm real location + số cây đã mua (VD: "10 vạn cây — Quảng Ngãi")
- Thêm badge "Khách hàng từ 2019" cho testimonial dài hạn
- Carousel nếu có >3 testimonials (touch-swipe cho mobile)
- Rating stars: 5 sao vàng, to hơn

### 3.7 Knowledge / Articles Grid

**Hiện tại:** Grid 3 cột, mỗi card có ảnh + title + description.

**Sau redesign:**
- Thêm **category filter tabs**: "Tất cả" | "Kỹ thuật" | "Kinh tế" | "Giống"
  - Filter bằng URL search params + client-side filter (không cần re-fetch)
- Card redesign:
  - Ảnh: bo góc lớn hơn, có overlay gradient nhẹ
  - Category badge ở góc ảnh
  - Title: 2 dòng tối đa với ellipsis
  - Date dạng "12/03/2026" thay vì "Mar 12, 2026"
- "Xem thêm" button: thêm loading spinner khi fetch AI articles

### 3.8 Article Page (Chi Tiết Bài Viết)

**Hiện tại:** Hero gradient xanh + breadcrumb + body 720px + CTA + related articles.

**Sau redesign:**
- Hero: giảm độ cao xuống (hiện min-height 440px), chỉ đủ chứa title + meta
- Article body: thêm **table of contents** (sticky, bên trái trên desktop)
- Thêm **progress bar** đọc bài (fixed top, % đã đọc)
- CTA cuối bài: nếu article có ctaType="lead", show mini-form ngay trong article body (background ấm, không phải gradient xanh đậm)
- Related articles: grid 2x2 thay vì list dọc
- Thêm nút "Chia sẻ" (copy link, Zalo share, Facebook share)
- Breadcrumb: thêm schema BreadcrumbList (đã có) nhưng UI đẹp hơn

### 3.9 Lead Form

**Hiện tại:** Gradient xanh đậm + form trắng + social proof.

**Sau redesign:**
- Background: gradient xanh nhẹ hơn, có pattern lá (SVG background pattern)
- Form: bo góc lớn hơn (radius-lg), shadow ấm hơn
- Field focus: thay vì border-bottom xanh, dùng border + shadow glow
- Nút submit: màu vàng ấm (accent-warm) thay vì xanh
- Social proof: số "500+" animation count-up khi scroll vào view
- Thêm trust badge dưới nút submit: "🔒 Thông tin được bảo mật"

### 3.10 Footer

**Hiện tại:** Gradient xanh + 4 cột (brand, contact, links, map).

**Sau redesign:**
- Thêm dòng "Giấy chứng nhận: Bộ NN&PTNT" với icon
- Map: Google Maps embed giữ nguyên (rất hữu ích cho khách tìm đến vườn)
- Social icons: to hơn, có hover animation
- Footer bottom: thêm "Giờ làm việc: 6:00-18:00 tất cả các ngày"
- QR Code Zalo (optional)

---

## 4. Component Architecture

### Component Tree Mới

```
layout.js
├── Header
│   ├── Logo (SVG leaf icon + text)
│   ├── Nav (desktop: horizontal, mobile: drawer)
│   └── PhoneButton
├── Page Content
│   ├── Hero
│   │   ├── HeroImage (next/image với priority)
│   │   ├── HeroText (animated entrance)
│   │   ├── HeroCTA (2 buttons: báo giá + zalo)
│   │   └── TrustBadges (count-up stats)
│   ├── FeaturedArticles
│   │   ├── ArticleCard (horizontal, with image)
│   │   └── "Xem tất cả" button
│   ├── SpecsSection
│   │   ├── IconCards (grid)
│   │   └── ProductionTimeline (horizontal infographic)
│   ├── PricingSection
│   │   └── PricingCard × 3
│   ├── TestimonialCarousel (swipeable)
│   ├── KnowledgeSection
│   │   ├── CategoryTabs
│   │   ├── ArticleCard (grid)
│   │   └── LoadMoreButton
│   ├── FAQ (giữ nguyên, accordion)
│   └── LeadForm (redesigned)
├── Footer
│   ├── BrandInfo
│   ├── ContactInfo
│   ├── QuickLinks
│   ├── GoogleMap
│   └── PrivacyBar
├── SocialFloat (giữ nguyên)
└── ExitPopup (mới thêm)
```

### Component Mới Cần Xây Dựng

| Component | Mô tả | Priority |
|-----------|-------|----------|
| `CountUp.js` | Animation số đếm (500+ → đếm từ 0 đến 500) | 🟡 Medium |
| `ProductionTimeline.js` | Timeline ngang quy trình sản xuất | 🟡 Medium |
| `CategoryTabs.js` | Filter tabs cho articles | 🟢 Low |
| `ReadingProgress.js` | Progress bar đọc bài | 🟢 Low |
| `TableOfContents.js` | Mục lục sticky cho article | 🟢 Low |
| `ShareButtons.js` | Chia sẻ Zalo/Facebook/Copy link | 🟢 Low |
| `TestimonialCarousel.js` | Carousel testimonials có swipe | 🟡 Medium |
| `TrustBadges.js` | Badge tin cậy (đã giao X cây, rating) | 🔴 High |

---

## 5. Mobile First (Quan Trọng Nhất)

Vì bà con nông dân dùng điện thoại là chính:

### Touch Targets
- Tất cả nút: **tối thiểu 48x48px** (Apple HIG standard)
- Khoảng cách giữa các nút: 12px+ (tránh bấm nhầm)
- Form fields: padding dọc 14px+, font 16px+ (tránh zoom on focus)

### Performance
- Hero image: responsive với `sizes` attribute + WebP format
- Lazy load articles images dùng `loading="lazy"`
- font-display: swap (đã có) + preconnect Google Fonts
- Không dùng JS animation phức tạp trên mobile (chỉ CSS animations)

### Content
- Chữ **tối thiểu 16px** cho body text (18px hiện tại là tốt)
- Line height: 1.6-1.8 (giữ nguyên)
- Không dùng hover-dependent UI (tooltip, dropdown)
- Accordion FAQ tốt cho mobile — giữ nguyên

---

## 6. Animation & Micro-interactions

| Element | Animation | Ghi chú |
|---------|-----------|---------|
| Hero title | Fade up (giữ) | Đã có, giữ nguyên |
| Specs cards | Stagger fade-in | Mỗi card delay 100ms |
| Pricing cards | Scale up nhẹ khi hover | Thêm cho mobile: không hover |
| Count-up numbers | Đếm từ 0 → target khi vào view | IntersectionObserver |
| Form focus | Border glow + shadow | Thay vì chỉ border-bottom |
| Button hover | translateY(-2px) + shadow | Giữ nguyên |
| Scroll progress bar | Fixed top, width % đọc | Article page |
| Article images | Fade-in khi load | placeholder skeleton |

---

## 7. CSS Architecture

**Hiện tại:** 1 file globals.css (2140 dòng) — khó maintain.

**Sau redesign:**
```
styles/
├── tokens.css          # Design tokens (variables)
├── reset.css           # Reset + base
├── layout.css          # Grid, container, section
├── components/
│   ├── header.css
│   ├── hero.css
│   ├── specs.css
│   ├── pricing.css
│   ├── testimonials.css
│   ├── knowledge.css
│   ├── faq.css
│   ├── lead-form.css
│   ├── footer.css
│   ├── social-float.css
│   ├── article.css      # Article page
│   ├── exit-popup.css
│   └── smart-cta.css
└── utilities.css       # Animation, skeleton, helpers
```

Hoặc đơn giản hơn: giữ 1 file nhưng chia thành các section rõ ràng với comment blocks (hiện tại đã làm khá tốt). KHÔNG cần CSS Modules — 1 file cho dự án nhỏ là đủ.

**Quan trọng:** Chỉ refactor CSS nếu có thời gian. UI improvement có thể làm mà không cần refactor CSS architecture.

---

## 8. Implementation Plan

### Phase A: "Làm Đẹp Ngay" (3-4 ngày) — Chỉ CSS, không đụng component logic

| Task | Mô tả | Files |
|------|-------|-------|
| A.1 | Thêm warm accent color + update color palette | globals.css |
| A.2 | Giảm uppercase, relax letter-spacing | globals.css (buttons, nav) |
| A.3 | Tăng border-radius cho cards (12px → 16-20px) | globals.css |
| A.4 | Thêm pattern nền nhẹ (SVG leaves) cho lead section | globals.css + SVG |
| A.5 | Hero: giảm overlay opacity, cải thiện typography | globals.css |
| A.6 | Pricing card popular: warm accent highlight | globals.css |
| A.7 | Button colors: thêm variant vàng ấm | globals.css |
| A.8 | Testimonials: tăng star size, thêm avatar placeholder | globals.css |

### Phase B: "Nâng Cấp UX" (4-5 ngày) — Thêm component mới

| Task | Mô tả | Files |
|------|-------|-------|
| B.1 | CountUp component cho stats | components/CountUp.js |
| B.2 | Production Timeline infographic | components/ProductionTimeline.js |
| B.3 | CategoryTabs cho articles | components/CategoryTabs.js |
| B.4 | ReadingProgress bar | components/ReadingProgress.js |
| B.5 | TestimonialCarousel | components/TestimonialCarousel.js |
| B.6 | Article page: TOC + better layout | app/articles/[slug]/page.js |

### Phase C: "Chụp Ảnh Thật" (thời gian thực tế) — Không code

| Task | Mô tả |
|------|-------|
| C.1 | Chụp vườn cây mẹ AH1 |
| C.2 | Chụp hệ thống phun sương |
| C.3 | Chụp cây giống cầm tay (có thước đo) |
| C.4 | Chụp chân dung chủ vườn Ngọc Sơn |
| C.5 | Chụp khách hàng nhận cây / rừng đã trồng |
| C.6 | Thay thế tất cả ảnh trong website |

### Phase D: "Tối Ưu" (2-3 ngày) — Performance + Refinement

| Task | Mô tả |
|------|-------|
| D.1 | WebP conversion cho tất cả ảnh |
| D.2 | Responsive images (srcset + sizes) |
| D.3 | Lighthouse audit: target 90+ |
| D.4 | CSS cleanup: xóa unused styles |
| D.5 | Testing: Chrome, Safari, Firefox, iOS Safari, Android Chrome |

---

## 9. Visual Previews (ASCII Mockups)

### Desktop Homepage Layout Mới

```
┌─────────── HEADER ───────────┐
│ [🌿 Keo Lai Xanh]  SP BG BV HĐ  │
└──────────────────────────────┘
┌─────────── HERO ─────────────┐
│                              │
│   🌱 Giống keo lai AH1      │
│   Chất lượng cao — Tận vườn  │
│                              │
│  [📞 NHẬN BÁO GIÁ] [💬 ZALO] │
│                              │
│  ⭐ 4.9 · Giao toàn quốc     │
└──────────────────────────────┘
  ┌──────┐  ┌──────┐  ┌──────┐
  │500K+ │  │ 2003 │  │ >95% │
  │cây   │  │năm   │  │sống  │
  └──────┘  └──────┘  └──────┘

┌─────────── TIN TỨC ──────────┐
│ [Kỹ thuật] [Kinh tế] [Tất cả]│
┌────┐ ┌────┐ ┌────┐
│Ảnh │ │Ảnh │ │Ảnh │
│Bài 1│ │Bài 2│ │Bài 3│
└────┘ └────┘ └────┘
┌─────────── QUY TRÌNH ────────┐
│  🌱→✂️→🪴→💦→🚚                │
│  Cây mẹ → Cắt → Giâm → Phun →│
└──────────────────────────────┘
┌─────────── BẢNG GIÁ ────────┐
┌──────┐ ┌──────┐ ┌──────┐
│1-5 vạn││5-10 vạn││>10 vạn│
│1.800đ ││1.500đ ││L.Hệ   │
└──────┘ └──────┘ └──────┘
┌─────────── LEAD FORM ───────┐
│ 📞 Đặt cây giống ngay hôm nay│
│ [Tên] [SĐT] [SL] [Tỉnh]     │
│ [📤 NHẬN BÁO GIÁ]           │
│ Hoặc chat Zalo: [💬]         │
└──────────────────────────────┘
┌─────────── FOOTER ───────────┐
│  Vườn ươm Ngọc Sơn ·         │
│  Đồng Nai · 0907.282.960     │
└──────────────────────────────┘
```

### Article Page Layout Mới

```
┌─────────── HEADER ───────────┐
┌─────────── HERO (thấp hơn) ──┐
│ Trang chủ / Kiến thức / Title │
│ 📖 Cách trồng keo lai...      │
│ Keo Lai Xanh · 12/03/2026    │
└──────────────────────────────┘
┌─── READING PROGRESS BAR ────┐ (fixed top)
└──────────────────────────────┘
┌─ TOC ─┐ ┌─── BODY ──────────┐
│ Mục   │ │  Nội dung bài      │
│ lục   │ │  viết markdown     │
│ 1. ...│ │  render HTML       │
│ 2. ...│ │                    │
│ 3. ...│ │ [📞 NHẬN TÀI LIỆU]  │
└───────┘ └────────────────────┘
┌─────────── RELATED ──────────┐
│ ┌────┐ ┌────┐                │
│ │Bài1│ │Bài2│                │
│ └────┘ └────┘                │
└──────────────────────────────┘
┌─────────── FOOTER ───────────┐
```

---

## 10. Success Metrics

Sau redesign, đo lường:

| Metric | Current Baseline | Target |
|--------|-----------------|--------|
| Mobile conversion rate | ? | +20% |
| Time on page | ? | +30s |
| Bounce rate | ? | -10% |
| Lead form completion | ? | +15% |
| Article scroll depth | ? | +10% |
| Lighthouse Performance | ? | 90+ |
| Lighthouse Accessibility | ? | 95+ |

Cần thiết lập baseline trước khi redesign — xem GA4 và Clarity để có số liệu hiện tại.

---

## 11. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Đổi màu sắc làm mất brand recognition | Medium | Giữ primary green, chỉ thêm accent — không thay thế |
| Animation quá nhiều làm chậm mobile | High | CSS animations only, dùng `will-change` hạn chế, test trên thiết bị thật |
| Nông dân không quen UI mới | Medium | Giữ layout cấu trúc cũ (sections), chỉ làm đẹp — không thay đổi navigation flow |
| Chụp ảnh không đẹp | Medium | Thuê người chụp hoặc dùng điện thoại tốt, chụp ban ngày, ánh sáng tự nhiên |
| CSS refactor mất thời gian | Low | Không refactor CSS architecture nếu không cần — ưu tiên visual changes |

---

## Kết Luận

Redesign nên làm theo thứ tự:
1. **Phase A** (3-4 ngày) — thay đổi CSS thuần túy, không đụng logic → impact ngay
2. **Chụp ảnh thật** — yếu tố quyết định aesthetic
3. **Phase B** (4-5 ngày) — thêm component mới
4. **Phase D** (2-3 ngày) — performance optimization

Tổng thời gian: **9-12 ngày** (không tính chụp ảnh).
