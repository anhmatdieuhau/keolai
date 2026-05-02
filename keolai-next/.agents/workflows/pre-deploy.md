---
description: Pre-deploy checklist cho keolai-next — chạy trước mỗi lần deploy lên production
---

# KeoLai Pre-Deploy Testing Checklist

// turbo-all

## 1. Build Check
```bash
cd /Users/dangthiduyen/Documents/GitHub/WorkForce_Documentation/projects/KeoLai/keolai-next
npm run build 2>&1
```
- ✅ Build phải pass không lỗi
- ✅ Tất cả static pages generated thành công
- ✅ Không có TypeScript errors

## 2. Visual Verification (Browser Test)
Chạy dev server rồi kiểm tra trên browser (375px mobile + 1280px desktop):
```bash
npm run dev
```
Checklist visual:
- [ ] Hero section: trust badge hiển thị đúng, CTA buttons hoạt động
- [ ] Pricing cards: 3 cards, card giữa highlight "Phổ biến nhất"
- [ ] Testimonials: có quote icon ❝ và 5 sao ★★★★★
- [ ] Scroll animations: sections fade-in khi scroll
- [ ] Article thumbnails: KHÔNG có ảnh broken (check DevTools → Network → Img)
- [ ] Mobile menu: hamburger hoạt động, nav links đúng
- [ ] Lead form: submit thành công, dữ liệu vào Firestore
- [ ] Footer: links hoạt động, SĐT gọi được

## 3. Thumbnail Audit
Kiểm tra xem bài viết nào đang dùng placeholder:
```bash
grep -l 'image: /images/og-default' content/*.mdx | wc -l
```
- Target: 0 bài dùng placeholder (mỗi bài phải có ảnh riêng)
- Placeholder file: `/images/og-default.jpg`

## 4. Icon Consistency Check
Icons cho phép trên page (emoji system):
- Spec rows: 📏 🌿 🌱 🧬 📋
- Section labels: 📚
- Hero trust badge: 🌱
- Testimonials: ★ (star) và ❝ (quote)
- Pricing: ⭐ (popular badge)

**Rule**: KHÔNG sử dụng icon fonts (FontAwesome, etc). Chỉ dùng native emoji.

## 5. Performance Check
Chạy Lighthouse trên trang chủ:
- Performance ≥ 90
- Accessibility ≥ 90
- SEO ≥ 95
- Ảnh phải có `loading="lazy"` attribute

## 6. Broken Links Check
```bash
# Check internal links
grep -roh 'href="[^"]*"' out/ | sort -u | grep -v 'http' | grep -v 'tel:' | grep -v 'mailto:' | head -20
```

## 7. Deploy
```bash
firebase deploy --only hosting 2>&1
```
- ✅ Deploy complete
- ✅ Verify live site: https://keolaigiamhom.vn

## 8. Post-Deploy Smoke Test
Mở live site kiểm tra:
- [ ] Trang chủ load ok
- [ ] Mở 1 bài viết random — content hiển thị đúng
- [ ] Click "Liên hệ báo giá" → scroll tới form
- [ ] Gọi SĐT trên mobile → dial pad mở
