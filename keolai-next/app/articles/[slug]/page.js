import { getArticle, getAllSlugs, getAllArticles } from "@/lib/articles";
import Link from "next/link";
import { notFound } from "next/navigation";
import SmartCTA from "@/components/SmartCTA";

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};

  return {
    title: article.title,
    description: article.description,
    keywords: article.keywords,
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
      url: `https://keolaigiamhom.vn/articles/${slug}`,
      locale: "vi_VN",
    },
    alternates: {
      canonical: `https://keolaigiamhom.vn/articles/${slug}`,
    },
    other: {
      "article:published_time": article.date,
    },
  };
}

function renderBody(body, relatedArticles = []) {
  // Convert markdown-like content to HTML sections
  const lines = body.split("\n");
  let html = "";
  let h2Count = 0;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      html += `<h2>${line.slice(3)}</h2>`;
      h2Count++;
      // 4.4 SEO: inject internal link box after 2nd H2 (mid-article)
      if (h2Count === 2 && relatedArticles.length > 0) {
        const picks = relatedArticles.slice(0, 2);
        html += `<div class="inline-related"><span class="inline-related-label">📖 Xem thêm:</span>${picks.map(r => `<a href="/articles/${r.slug}" class="inline-related-link">${r.title}</a>`).join('')}</div>`;
      }
    } else if (line.startsWith("### ")) {
      html += `<h3>${line.slice(4)}</h3>`;
    } else if (line.startsWith("- ")) {
      html += `<li>${line.slice(2)}</li>`;
    } else if (line.trim() === "") {
      continue;
    } else if (line.startsWith(":::callout")) {
      html += `<div class="callout">`;
    } else if (line.startsWith(":::warning")) {
      html += `<div class="callout callout-warning">`;
    } else if (line === ":::") {
      html += `</div>`;
    } else if (line.startsWith("|")) {
      // Table row — handled as raw HTML pass-through
      html += line;
    } else {
      html += `<p>${line}</p>`;
    }
  }

  return html;
}

export default async function ArticlePage({ params }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const allArticles = getAllArticles();
  
  // Smart related: score by keyword overlap
  const articleKeywords = (article.keywords || "").toLowerCase().split(",").map(k => k.trim()).filter(Boolean);
  const related = allArticles
    .filter((a) => a.slug !== slug)
    .map((a) => {
      const aKeywords = (a.keywords || "").toLowerCase().split(",").map(k => k.trim()).filter(Boolean);
      const overlap = articleKeywords.filter(k => aKeywords.some(ak => ak.includes(k) || k.includes(ak))).length;
      return { ...a, relevance: overlap };
    })
    .sort((a, b) => b.relevance - a.relevance || new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 4);

  const readTime = Math.ceil((article.body?.split(/\s+/).length || 500) / 200);
  const dateDisplay = article.date
    ? new Date(article.date).toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" })
    : "2026";

  // Stats from frontmatter
  const stats = article.stats
    ? (typeof article.stats === "string" ? article.stats.split("|") : article.stats)
    : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    author: { "@type": "Organization", name: "Keo Lai Xanh", url: "https://keolaigiamhom.vn" },
    publisher: { "@type": "Organization", name: "Keo Lai Xanh" },
    datePublished: article.date,
    dateModified: article.date,
    mainEntityOfPage: `https://keolaigiamhom.vn/articles/${slug}`,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Trang chủ", item: "https://keolaigiamhom.vn/" },
      { "@type": "ListItem", position: 2, name: "Kiến thức", item: "https://keolaigiamhom.vn/#knowledge" },
      { "@type": "ListItem", position: 3, name: article.breadcrumb || article.title },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script dangerouslySetInnerHTML={{ __html: `
        if (typeof window !== 'undefined' && window.fbq) {
          window.fbq('track', 'ViewContent', {
            content_name: "${article.title.replace(/"/g, '\\"')}",
            content_category: "Article"
          });
        }
      ` }} />

      <section className="article-hero">
        <div className="hero-content">
          <div className="hero-breadcrumb">
            <Link href="/">Trang chủ</Link>
            <span>/</span>
            <Link href="/#knowledge">Kiến thức</Link>
            <span>/</span>
            {article.breadcrumb || article.title}
          </div>
          {article.label && <div className="hero-label">{article.label}</div>}
          <h1 className="hero-title">{article.title}</h1>
          <div className="hero-meta">
            <span>Keo Lai Xanh</span>
            <span className="hero-meta-dot" />
            <span>{dateDisplay}</span>
            <span className="hero-meta-dot" />
            <span>{readTime} phút đọc</span>
          </div>
        </div>
      </section>

      {stats.length > 0 && (
        <div className="stats-row">
          {stats.map((s, i) => {
            const parts = s.split(":");
            return (
              <div key={i} className="stat-item">
                <div className="stat-value">{parts[0]?.trim()}</div>
                <div className="stat-label">{parts[1]?.trim()}</div>
              </div>
            );
          })}
        </div>
      )}

      <main className="article-body" dangerouslySetInnerHTML={{ __html: renderBody(article.body, related) }} />

      <SmartCTA article={article} />

      {related.length > 0 && (
        <div className="related">
          <h3>Bài viết liên quan</h3>
          {related.map((r) => (
            <Link key={r.slug} href={`/articles/${r.slug}`} className="related-card" aria-label={`Đọc bài viết: ${r.title}`}>
              <div className="related-card-title">{r.title}</div>
              <div className="related-card-desc">{r.description}</div>
            </Link>
          ))}
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link href="/#knowledge" className="btn btn-outline" style={{ display: 'inline-block' }}>
              Tất cả bài viết
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
