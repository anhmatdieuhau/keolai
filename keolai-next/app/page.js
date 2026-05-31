
import FAQ from "@/components/FAQ";
import LeadForm from "@/components/LeadForm";
import AutoGenArticles from "@/components/AutoGenArticles";
import ScrollReveal from "@/components/ScrollReveal";
import { getAllArticles } from "@/lib/articles";
import Script from "next/script";

// JSON-LD Schemas for AI Search Visibility (per Google May 2026 guidelines)
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": ["Organization", "LocalBusiness", "GardenStore"],
  "@id": "https://keolaigiamhom.vn/#business",
  name: "Keo Lai Xanh",
  legalName: "Vườn Ươm Cây Giống Ngọc Sơn",
  url: "https://keolaigiamhom.vn/",
  telephone: "+84907282960",
  email: "dtduy46@gmail.com",
  foundingDate: "2003",
  description:
    "Vườn ươm chuyên giâm đọt keo lai AH1, ươm 2-3 tháng bằng hệ thống phun sương tự động, tỷ lệ sống trên 95%. Giao cây tận vườn toàn quốc.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "42, Ấp Quảng Phát, Xã Quảng Tiến",
    addressLocality: "Trảng Bom",
    addressRegion: "Đồng Nai",
    addressCountry: "VN",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 10.939003,
    longitude: 106.996687,
  },
  areaServed: "VN",
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: [
      "Monday", "Tuesday", "Wednesday", "Thursday",
      "Friday", "Saturday", "Sunday",
    ],
    opens: "06:00",
    closes: "18:00",
  },
  sameAs: [
    "https://www.facebook.com/profile.php?id=100063555342233",
    "https://zalo.me/0907282960",
    "https://www.google.com/search?q=v%C6%B0%E1%BB%9Dn+%C6%B0%C6%A1m+c%C3%A2y+gi%E1%BB%91ng+ng%E1%BB%8Dc+s%C6%A1n",
  ],
};

const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Cây giống Keo lai giâm hom AH1",
  description:
    "Cây giống keo lai AH1 giâm đọt, cao 25–35cm, đường kính thân 3–5mm, tỷ lệ sống trên 95%, có kiểm định nguồn gốc.",
  brand: { "@type": "Brand", name: "Keo Lai Xanh" },
  category: "Giống cây lâm nghiệp",
  offers: {
    "@type": "Offer",
    priceCurrency: "VND",
    price: "1500",
    availability: "https://schema.org/InStock",
    seller: { "@id": "https://keolaigiamhom.vn/#business" },
    url: "https://keolaigiamhom.vn/#pricing",
  },
};

export default function Home() {
  const articles = getAllArticles();

  // Top 3 featured articles for the CTA section
  const featuredArticles = articles.slice(0, 3);

  return (
    <main>
      {/* JSON-LD Schemas — server-rendered for AI search grounding */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />

      {/* GA4 Enhanced Event Tracking */}
      <Script id="ga4-events" strategy="afterInteractive">
        {`
          (function() {
            // ── UTM Capture ──
            try {
              var params = new URLSearchParams(window.location.search);
              var utmKeys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
              var utm = {};
              var hasUtm = false;
              utmKeys.forEach(function(k) {
                var v = params.get(k);
                if (v) { utm[k] = v; hasUtm = true; }
              });
              if (hasUtm) {
                sessionStorage.setItem('utm_data', JSON.stringify(utm));
                if (typeof window.gtag === 'function') {
                  window.gtag('event', 'utm_captured', {
                    event_category: 'Attribution',
                    utm_source: utm.utm_source || '',
                    utm_medium: utm.utm_medium || '',
                    utm_campaign: utm.utm_campaign || ''
                  });
                }
              }
            } catch(e) {}

            // ── Phone Click Tracking ──
            document.addEventListener('click', function(e) {
              var link = e.target.closest('a[href^="tel:"]');
              if (link && typeof window.gtag === 'function') {
                window.gtag('event', 'phone_click', {
                  event_category: 'Contact',
                  event_label: link.href.replace('tel:', ''),
                  transport_type: 'beacon'
                });
              }
            });

            // ── Article Click Tracking ──
            document.addEventListener('click', function(e) {
              var card = e.target.closest('.featured-article-card, .knowledge-card');
              if (card && typeof window.gtag === 'function') {
                var title = card.querySelector('h3');
                window.gtag('event', 'article_click', {
                  event_category: 'Content',
                  event_label: title ? title.textContent.substring(0, 80) : 'unknown',
                  link_url: card.href || card.getAttribute('href') || ''
                });
              }
            });

            // ── CTA Button Tracking ──
            document.addEventListener('click', function(e) {
              var btn = e.target.closest('.btn, .cta-btn');
              if (btn && typeof window.gtag === 'function') {
                window.gtag('event', 'cta_click', {
                  event_category: 'Engagement',
                  event_label: btn.textContent.trim().substring(0, 50),
                  link_url: btn.href || ''
                });
              }
            });

            // ── Debounced Scroll Depth ──
            var scrollMilestones = [25, 50, 75, 100];
            var scrollTracked = {};
            var scrollTimer = null;
            window.addEventListener('scroll', function() {
              if (scrollTimer) return;
              scrollTimer = setTimeout(function() {
                scrollTimer = null;
                var h = document.body.scrollHeight - window.innerHeight;
                if (h <= 0) return;
                var pct = Math.round((window.scrollY / h) * 100);
                scrollMilestones.forEach(function(m) {
                  if (pct >= m && !scrollTracked[m]) {
                    scrollTracked[m] = true;
                    if (typeof window.gtag === 'function') {
                      window.gtag('event', 'scroll_depth', {
                        event_category: 'Engagement',
                        event_label: m + '%',
                        value: m
                      });
                    }
                  }
                });
              }, 200);
            }, { passive: true });
            
            // ── Facebook Pixel ViewContent ──
            if (typeof window.fbq === 'function') {
              window.fbq('track', 'ViewContent', {
                content_name: 'Homepage',
                content_category: 'Home'
              });
            }
          })();
        `}
      </Script>

      {/* ═══════════ HERO ═══════════ */}
      <section className="hero" id="hero">
        <div className="hero-bg">
          <img
            src="/images/articles/keo-uom-hom.png"
            srcSet="/images/articles/keo-uom-hom.png 1x"
            alt="Vườn ươm keo lai giâm hom — hệ thống phun sương tự động, Đồng Nai"
            loading="eager"
            fetchPriority="high"
            decoding="sync"
          />
          {/* TODO: Replace with real hero photo at /public/images/hero-vuon.jpg (16:9 ratio) */}
          <div className="hero-overlay" />
        </div>
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              Vườn Ươm Keo Lai Giâm Đọt Chất Lượng Cao
            </h1>
            <p className="hero-desc">
              Giâm đọt AH1, ươm 2-3 tháng bằng hệ thống phun sương tự động —
              Tỷ lệ sống trên 95%. Giao cây tận vườn toàn quốc.
            </p>
            <div className="hero-actions">
              <a href="#lead-form" className="btn btn-white">
                LIÊN HỆ BÁO GIÁ
              </a>
              <a href="tel:0907282960" className="btn btn-outline">
                GỌI NGAY: 0907 282 960
              </a>
            </div>
            <div className="hero-trust-badge">
              🌱 Ươm từ 2003 <span>·</span> Giao toàn quốc <span>·</span> Tỷ lệ sống {">"}95%
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURED ARTICLES CTA ═══════════ */}
      <ScrollReveal>
        <section className="section featured-articles-cta" id="featured-articles">
          <div className="container">
            <div className="featured-cta-header">
              <span className="section-label">📚 CẨM NANG MIỄN PHÍ</span>
              <h2 className="section-title">
                Kiến thức nền tảng trước khi trồng rừng
              </h2>
              <p className="section-desc">
                Đọc ngay các hướng dẫn kỹ thuật từ chuyên gia — giúp bạn tăng tỷ
                lệ sống cây giống và tối ưu năng suất rừng.
              </p>
            </div>
            <div className="featured-article-grid">
              {featuredArticles.map((article, i) => (
                <ScrollReveal key={article.slug} delay={i * 100}>
                  <article>
                    <a
                      href={`/articles/${article.slug}`}
                      className="featured-article-card"
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <div className="featured-article-number">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <h3 className="featured-article-title">{article.title}</h3>
                      <p className="featured-article-desc">{article.description}</p>
                      <span className="featured-article-link">Đọc hướng dẫn →</span>
                    </a>
                  </article>
                </ScrollReveal>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
              <a href="#knowledge" className="btn btn-outline" style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                Xem tất cả bài viết ↓
              </a>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ═══════════ SPECS ═══════════ */}
      <ScrollReveal>
        <section className="section bg-light" id="specs">
          <div className="container">
            <div className="specs-grid">
              <div className="specs-intro">
                <span className="section-label">THÔNG SỐ KỸ THUẬT</span>
                <h2 className="section-title">Chi tiết cây giống</h2>
                <p className="section-desc">
                  Quy trình giâm đọt được kiểm soát nghiêm ngặt: từ cắt đọt cây
                  mẹ → giâm vào bầu → phun sương tự động 1-2 phút/lần → ươm 2-3
                  tháng → xuất vườn.
                </p>
              </div>
              <div className="specs-table">
                {[
                  ["📏", "CHIỀU CAO CÂY", "25 – 35cm"],
                  ["🌿", "ĐƯỜNG KÍNH THÂN", "3 – 5mm"],
                  ["🌱", "TỶ LỆ SỐNG", "trên 95%"],
                  ["🧬", "DÒNG GIỐNG", "AH1"],
                  ["📋", "CHỨNG NHẬN", "Kiểm định nguồn gốc"],
                ].map(([icon, label, value], i) => (
                  <div
                    key={i}
                    className={`spec-row${i % 2 === 1 ? " alt" : ""}`}
                  >
                    <span className="spec-label"><span className="spec-icon">{icon}</span> {label}</span>
                    <span className="spec-value">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ═══════════ PRICING ═══════════ */}
      <ScrollReveal>
        <section className="section" id="pricing">
          <div className="container">
            <div className="section-center">
              <h2 className="section-title">Bảng giá tham khảo</h2>
              <p className="section-desc-italic">
                Giá cập nhật mới nhất cho vụ mùa 2026
              </p>
            </div>
            <div className="pricing-cards-grid">
              {/* Tier 1 */}
              <ScrollReveal delay={0}>
                <div className="pricing-card">
                  <div className="pricing-card-tier">Đơn hàng nhỏ</div>
                  <div className="pricing-card-price">1.800đ</div>
                  <div className="pricing-card-unit">/ cây</div>
                  <ul className="pricing-card-features">
                    <li>1 – 5 vạn cây</li>
                    <li>Vận chuyển theo khu vực</li>
                    <li>Tư vấn kỹ thuật trồng</li>
                  </ul>
                  <a href="#lead-form" className="btn btn-outline" style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}>LIÊN HỆ</a>
                </div>
              </ScrollReveal>
              {/* Tier 2 - Popular */}
              <ScrollReveal delay={150}>
                <div className="pricing-card popular">
                  <div className="pricing-card-tier">Phổ biến nhất</div>
                  <div className="pricing-card-price">1.500đ</div>
                  <div className="pricing-card-unit">/ cây</div>
                  <ul className="pricing-card-features">
                    <li>5 – 10 vạn cây</li>
                    <li>Miễn phí giao hàng nội tỉnh</li>
                    <li>Tư vấn kỹ thuật trồng</li>
                    <li>Cam kết đổi cây lỗi</li>
                  </ul>
                  <a href="#lead-form" className="btn btn-white">BÁO GIÁ NGAY</a>
                </div>
              </ScrollReveal>
              {/* Tier 3 */}
              <ScrollReveal delay={300}>
                <div className="pricing-card">
                  <div className="pricing-card-tier">Đơn hàng lớn</div>
                  <div className="pricing-card-price">LIÊN HỆ</div>
                  <div className="pricing-card-unit">giá ưu đãi đặc biệt</div>
                  <ul className="pricing-card-features">
                    <li>Trên 10 vạn cây</li>
                    <li>Miễn phí vận chuyển</li>
                    <li>Hỗ trợ kỹ thuật trồng rừng</li>
                    <li>Hợp đồng dài hạn</li>
                  </ul>
                  <a href="tel:0907282960" className="btn btn-outline" style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}>GỌI NGAY</a>
                </div>
              </ScrollReveal>
            </div>
            <p className="pricing-note">
              Giá chưa bao gồm vận chuyển. Miễn phí giao hàng cho các đơn hàng
              từ 5 vạn cây trở lên.
            </p>
          </div>
        </section>
      </ScrollReveal>

      {/* ═══════════ PROOF BLOCK ═══════════ */}
      <ScrollReveal>
        <section className="section bg-light" id="testimonials">
          <div className="container">
            <div style={{ textAlign: "center", marginBottom: "40px" }}>
              <span className="section-label">VÌ SAO CHỌN CHÚNG TÔI</span>
              <h2 className="section-title" style={{ marginBottom: "16px" }}>Vườn ươm thực — Kinh nghiệm thực</h2>
              <p className="section-desc" style={{ maxWidth: "640px", margin: "0 auto" }}>
                Không phải thương mại. Chúng tôi trực tiếp giâm đọt, ươm cây, và giao tận vườn trên toàn quốc.
              </p>
            </div>
            <div className="specs-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="spec-row" style={{ flexDirection: "column", textAlign: "center", padding: "24px 16px" }}>
                <span style={{ fontSize: "2.5rem", marginBottom: "8px" }}>2003</span>
                <span className="spec-label" style={{ fontWeight: 600 }}>Kinh nghiệm ươm giống</span>
                <span style={{ fontSize: "13px", color: "#666" }}>Hơn 20 năm giâm hom keo lai AH1</span>
              </div>
              <div className="spec-row" style={{ flexDirection: "column", textAlign: "center", padding: "24px 16px" }}>
                <span style={{ fontSize: "2.5rem", marginBottom: "8px" }}>&gt;95%</span>
                <span className="spec-label" style={{ fontWeight: 600 }}>Tỷ lệ sống</span>
                <span style={{ fontSize: "13px", color: "#666" }}>Hệ thống phun sương tự động 1–2 phút/lần</span>
              </div>
              <div className="spec-row" style={{ flexDirection: "column", textAlign: "center", padding: "24px 16px" }}>
                <span style={{ fontSize: "2.5rem", marginBottom: "8px" }}>2–3</span>
                <span className="spec-label" style={{ fontWeight: 600 }}>Tháng ươm chuẩn</span>
                <span style={{ fontSize: "13px", color: "#666" }}>Đạt chuẩn xuất vườn, có kiểm định nguồn gốc</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginTop: "32px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f0fdf4", color: "#166534", padding: "10px 18px", borderRadius: "100px", fontWeight: 600, fontSize: "14px" }}>
                <span>🚚</span> Giao cây tận vườn toàn quốc
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f0fdf4", color: "#166534", padding: "10px 18px", borderRadius: "100px", fontWeight: 600, fontSize: "14px" }}>
                <span>📋</span> Kiểm định nguồn gốc cây mẹ
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f0fdf4", color: "#166534", padding: "10px 18px", borderRadius: "100px", fontWeight: 600, fontSize: "14px" }}>
                <span>🌱</span> Cam kết đổi cây lỗi
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ═══════════ KNOWLEDGE ═══════════ */}
      <ScrollReveal>
        <section className="section" id="knowledge">
          <div className="container">
            <div className="knowledge-header">
              <div>
                <span className="section-label">CẨM NANG LÂM NGHIỆP</span>
                <h2 className="section-title">Kiến thức trồng rừng</h2>
              </div>
            </div>
            <AutoGenArticles staticArticles={articles.slice(3)} />
          </div>
        </section>
      </ScrollReveal>

      {/* ═══════════ FAQ ═══════════ */}
      <FAQ />

      {/* ═══════════ LEAD FORM ═══════════ */}
      <LeadForm />
    </main>
  );
}
