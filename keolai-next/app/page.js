
import FAQ from "@/components/FAQ";
import LeadForm from "@/components/LeadForm";
import AutoGenArticles from "@/components/AutoGenArticles";
import ScrollReveal from "@/components/ScrollReveal";
import { getAllArticles } from "@/lib/articles";
import Script from "next/script";

// JSON-LD Schemas for SEO
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Vườn Ươm Cây Giống Ngọc Sơn",
  alternateName: "Keo Lai Xanh",
  url: "https://keolaigiamhom.vn",
  telephone: "+84907282960",
  description:
    "Chuyên giâm đọt và ươm giống keo lai AH1 — hệ thống phun sương tự động, quy trình ươm 2-3 tháng đạt chuẩn xuất vườn.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "42 Ấp Quảng Phát, Xã Quảng Tiến",
    addressLocality: "Trảng Bom",
    addressRegion: "Đồng Nai",
    addressCountry: "VN",
  },
  areaServed: { "@type": "Country", name: "VN" },
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Vườn Ươm Cây Giống Ngọc Sơn",
  image: "https://keolaigiamhom.vn/images/vuon-uom.jpg",
  telephone: "+84907282960",
  url: "https://keolaigiamhom.vn",
  address: {
    "@type": "PostalAddress",
    streetAddress: "42 Ấp Quảng Phát, Xã Quảng Tiến",
    addressLocality: "Trảng Bom",
    addressRegion: "Đồng Nai",
    postalCode: "810000",
    addressCountry: "VN",
  },
  priceRange: "1.500đ - 1.800đ / cây",
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    opens: "06:00",
    closes: "18:00",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    bestRating: "5",
    ratingCount: "47",
    reviewCount: "3",
  },
};

const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Cây giống Keo Lai AH1 giâm hom",
  description:
    "Cây giống keo lai AH1 giâm đọt, ươm 2-3 tháng, hệ thống phun sương tự động, tỷ lệ sống trên 95%.",
  image: "https://keolaigiamhom.vn/images/vuon-uom.jpg",
  brand: { "@type": "Brand", name: "Keo Lai Xanh" },
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "VND",
    lowPrice: "1500",
    highPrice: "1800",
    offerCount: "3",
    availability: "https://schema.org/InStock",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    bestRating: "5",
    ratingCount: "47",
    reviewCount: "3",
  },
  review: [
    {
      "@type": "Review",
      author: { "@type": "Person", name: "Anh Hùng" },
      datePublished: "2025-11-15",
      reviewBody:
        "Tôi đã nhập 10 vạn cây AH1 của vườn. Cây rất khoẻ, đồng đều, tỷ lệ hao hụt sau khi trồng thực tế cực thấp. Rất hài lòng với dịch vụ.",
      reviewRating: {
        "@type": "Rating",
        ratingValue: "5",
        bestRating: "5",
      },
    },
    {
      "@type": "Review",
      author: { "@type": "Person", name: "Chị Mai" },
      datePublished: "2025-12-03",
      reviewBody:
        "Vườn ươm làm việc rất chuyên nghiệp, giao hàng đúng hẹn dù đường vào rẫy khó đi. Cây hom đạt tiêu chuẩn, rễ khoẻ.",
      reviewRating: {
        "@type": "Rating",
        ratingValue: "5",
        bestRating: "5",
      },
    },
    {
      "@type": "Review",
      author: { "@type": "Person", name: "Anh Tuấn" },
      datePublished: "2026-01-20",
      reviewBody:
        "Giá cả cạnh tranh nhất khu vực Miền Trung. Tư vấn kỹ thuật trồng rừng rất tận tâm, không chỉ bán cây mà còn hỗ trợ quy trình.",
      reviewRating: {
        "@type": "Rating",
        ratingValue: "5",
        bestRating: "5",
      },
    },
  ],
};

export default function Home() {
  const articles = getAllArticles();

  // Top 3 featured articles for the CTA section
  const featuredArticles = articles.slice(0, 3);

  return (
    <main>
      {/* JSON-LD Schemas */}
      <Script
        id="org-schema"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <Script
        id="local-biz-schema"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(localBusinessSchema),
        }}
      />
      <Script
        id="product-schema"
        type="application/ld+json"
        strategy="afterInteractive"
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
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDwxA2cwtcgxA_DP_CY6raj4OrSSkxf1at_Jtykqx1e8qxC48oiibz1wy8vVMnUFnITKgipdpu1XF9BjkFb6uPcS1MJv55XwrfcCjrzZExYO3ezBZhhttXxtD3oV61-4AcLcnb1yAIpRko-P2DzMxe3M8fz5o1_20z_VVBT400_2rAaJlxRx3PMl6gql3j1IHwgL7EPYNLz4WGjnEXZPqH1Cmq02Bo-d6VIjLY1bKH2GU4CkYQqtKiSTErETUfZ8552HpmdZERTejA"
            alt="Vườn keo lai giâm hom quy mô lớn"
            loading="eager"
          />
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

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      <ScrollReveal>
        <section className="section bg-light" id="testimonials">
          <div className="container">
            <div style={{ textAlign: "center", marginBottom: "40px" }}>
              <h2 className="section-title" style={{ marginBottom: "16px" }}>Khách hàng thực tế nói gì</h2>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#f0fdf4", color: "#166534", padding: "8px 16px", borderRadius: "100px", fontWeight: "600", fontSize: "14px" }}>
                <span>🏅</span> Đã giao hơn 2.5 triệu cây trong năm 2026
              </div>
            </div>
            <div className="testimonial-grid">
              {[
                {
                  text: 'Tôi đã nhập 10 vạn cây AH1 của vườn. Cây rất khoẻ, đồng đều, tỷ lệ hao hụt sau khi trồng thực tế cực thấp. Rất hài lòng với dịch vụ.',
                  name: "ANH HÙNG",
                  loc: "QUẢNG NGÃI",
                  border: "border-primary",
                },
                {
                  text: 'Vườn ươm làm việc rất chuyên nghiệp, giao hàng đúng hẹn dù đường vào rẫy khó đi. Cây hom đạt tiêu chuẩn, rễ khoẻ.',
                  name: "CHỊ MAI",
                  loc: "BÌNH ĐỊNH",
                  border: "border-secondary",
                },
                {
                  text: 'Giá cả cạnh tranh nhất khu vực Miền Trung. Tư vấn kỹ thuật trồng rừng rất tận tâm, không chỉ bán cây mà còn hỗ trợ quy trình.',
                  name: "ANH TUẤN",
                  loc: "PHÚ YÊN",
                  border: "border-tertiary",
                },
              ].map((t, i) => (
                <ScrollReveal key={i} delay={i * 120}>
                  <div className={`testimonial-card ${t.border}`}>
                    <span className="testimonial-quote-icon">&ldquo;</span>
                    <div className="testimonial-stars">
                      {[...Array(5)].map((_, s) => <span key={s} className="testimonial-star">★</span>)}
                    </div>
                    <p className="testimonial-text">{t.text}</p>
                    <div className="testimonial-author">
                      <span className="author-name">{t.name}</span>
                      <span className="author-location">{t.loc}</span>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
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
            <AutoGenArticles staticArticles={articles} />
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
