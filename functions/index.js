const functions = require('firebase-functions/v2');
const cors = require('cors')({
  origin: [
    'https://keolaigiamhom.vn',
    'https://www.keolaigiamhom.vn',
    'https://keolai-63ec1.web.app',
    'https://keolai-63ec1.firebaseapp.com'
  ]
});
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

const { defineSecret } = require('firebase-functions/params');
const { CloudTasksClient } = require('@google-cloud/tasks');
const { google } = require('googleapis');

const notionApiToken = defineSecret('NOTION_API_TOKEN');
const appClientSecret = defineSecret('APP_CLIENT_SECRET');
const vertexApiKey = defineSecret('VERTEX_API_KEY');
const gmailAppPassword = defineSecret('GMAIL_APP_PASSWORD');

// Cloud Tasks client for PBCA experiment lifecycle
const tasksClient = new CloudTasksClient();

// Initialize Firebase Admin
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const DATABASE_ID = '3267ccb5-acc9-8146-81a5-ce9f632b04d3';
const SITE_URL = 'https://keolaigiamhom.vn';
const GSC_SITE_URL = 'sc-domain:keolaigiamhom.vn'; // Domain property format for GSC API

// ═══════════════════════════════════════
// 1. SUBMIT LEAD (existing)
// ═══════════════════════════════════════
exports.submitLead = functions.https.onRequest(
  { secrets: [notionApiToken, appClientSecret], cors: true },
  async (req, res) => {
    const clientSecret = req.headers['x-app-secret'];
    if (clientSecret !== appClientSecret.value()) {
      console.error('Unauthorized attempt to access API');
      return res.status(403).json({ error: 'Truy cập bị từ chối. Chìa khóa không hợp lệ!' });
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { name, phone, email, quantity, province } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Tên và Số điện thoại là bắt buộc' });
    }
    const properties = {
      'Họ tên': { title: [{ text: { content: String(name) } }] },
      'SĐT': { phone_number: String(phone) },
      'Tỉnh/TP': { rich_text: [{ text: { content: province ? String(province) : 'Chưa cung cấp' } }] },
      'Trạng thái': { select: { name: 'Mới' } },
    };
    if (quantity) {
      properties['Số lượng'] = { number: parseInt(quantity, 10) };
    }
    if (email) {
      properties['Email'] = { email: String(email) };
    }
    try {
      // Save to Notion (with fallback if property doesn't exist)
      let notionId = null;
      const notionHeaders = {
        'Authorization': `Bearer ${notionApiToken.value()}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      };
      let response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({
          parent: { database_id: DATABASE_ID },
          properties,
        }),
      });
      let data = await response.json();

      // If Notion fails due to missing property, retry without it
      if (!response.ok && data.code === 'validation_error' && data.message?.includes('is not a property')) {
        console.warn('⚠️ Notion property mismatch, retrying without optional fields...');
        const fallbackProps = {
          'Họ tên': properties['Họ tên'],
          'SĐT': properties['SĐT'],
          'Tỉnh/TP': properties['Tỉnh/TP'],
          'Trạng thái': properties['Trạng thái'],
        };
        if (quantity) fallbackProps['Số lượng'] = properties['Số lượng'];
        response = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: notionHeaders,
          body: JSON.stringify({
            parent: { database_id: DATABASE_ID },
            properties: fallbackProps,
          }),
        });
        data = await response.json();
      }

      if (response.ok) {
        notionId = data.id;
        console.log('✅ Lead saved to Notion:', notionId);
      } else {
        console.error('⚠️ Notion save failed (non-blocking):', data);
      }

      // Always save to Firestore for nurture pipeline (never lose a lead)
      const leadData = {
        name: String(name),
        phone: String(phone),
        email: email ? String(email) : null,
        quantity: quantity ? parseInt(quantity, 10) : null,
        province: province ? String(province) : null,
        notionId: notionId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        nurture_status: email ? 'pending' : 'no_email',
        nurture_step: 0,
        nurture_next_at: email ? new Date(Date.now() + 2 * 60 * 60 * 1000) : null, // 2h later for welcome
        source: 'website_form',
      };
      const leadRef = await db.collection('leads').add(leadData);
      console.log('✅ Lead saved to Firestore:', leadRef.id);

      return res.status(200).json({ success: true, id: notionId || leadRef.id });
    } catch (error) {
      console.error('Lỗi khi gọi API:', error);
      // Last resort: try to save to Firestore even if everything else fails
      try {
        const emergencyLead = {
          name: String(name), phone: String(phone),
          email: email ? String(email) : null,
          province: province ? String(province) : null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          nurture_status: email ? 'pending' : 'no_email',
          nurture_step: 0, source: 'website_form_emergency',
        };
        const ref = await db.collection('leads').add(emergencyLead);
        console.log('🆘 Emergency lead saved to Firestore:', ref.id);
        return res.status(200).json({ success: true, id: ref.id });
      } catch (fsErr) {
        console.error('💀 Total failure:', fsErr);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  }
);

// ═══════════════════════════════════════
// 2. GENERATE ARTICLE (new - auto-gen pipeline)
// ═══════════════════════════════════════

// [REMOVED] generateArticle — redundant with scheduleContentGeneration
// [REMOVED] deployToHosting — unused helper (articles now served dynamically via serveArticle)



// ═══════════════════════════════════════
// 3. LIST ARTICLES (API for homepage)
// ═══════════════════════════════════════
exports.listArticles = functions.https.onRequest(
  { region: 'us-central1', cors: true },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        const snap = await db.collection('articles')
          .orderBy('publishedAt', 'desc')
          .limit(6)
          .get();

        const articles = snap.docs.map((doc) => {
          const d = doc.data();
          return {
            slug: d.slug,
            title: d.title,
            description: d.description || '',
            url: d.url,
            publishedAt: d.publishedAt?.toDate?.()?.toISOString() || null,
          };
        });

        res.set('Cache-Control', 'public, max-age=3600');
        return res.status(200).json({ articles });
      } catch (error) {
        console.error('Failed to list articles:', error);
        return res.status(500).json({ error: error.message });
      }
    });
  }
);

// ═══════════════════════════════════════
// 4. SERVE ARTICLE (renders HTML from Firestore)
// ═══════════════════════════════════════
exports.serveArticle = functions.https.onRequest(
  { region: 'us-central1' },
  async (req, res) => {
    try {
      // Extract slug from path: /articles/my-slug/ → my-slug
      const pathParts = req.path.replace(/^\/|\/$|\.html$/g, '').split('/');
      // pathParts could be ['articles', 'slug'] or just ['slug']
      const slug = pathParts[pathParts.length - 1];

      // Security: validate slug format (alphanumeric + hyphens only)
      if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
        return res.status(404).send('Article not found');
      }

      const doc = await db.collection('articles').doc(slug).get();
      if (!doc.exists || !doc.data().html) {
        return res.status(404).send('Article not found');
      }

      res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(doc.data().html);
    } catch (error) {
      console.error('Failed to serve article:', error);
      return res.status(500).send('Internal server error');
    }
  }
);

// ═══════════════════════════════════════
// 5. SERVE DYNAMIC SITEMAP
// ═══════════════════════════════════════
exports.serveSitemap = functions.https.onRequest(
  { region: 'us-central1' },
  async (req, res) => {
    try {
      // Static pages (always in sitemap)
      const staticPages = [
        { loc: `${SITE_URL}/`, changefreq: 'weekly', priority: '1.0' },
        { loc: `${SITE_URL}/articles/ky-thuat-trong-keo-lai-ah1/`, changefreq: 'monthly', priority: '0.8' },
        { loc: `${SITE_URL}/articles/he-thong-phun-suong-vuon-uom/`, changefreq: 'monthly', priority: '0.8' },
        { loc: `${SITE_URL}/articles/giong-keo-lai-ah1-dac-tinh/`, changefreq: 'monthly', priority: '0.8' },
        { loc: `${SITE_URL}/articles/cach-chon-dat-trong-keo-lai/`, changefreq: 'monthly', priority: '0.8' },
      ];

      // Fetch all published articles from Firestore
      const articlesSnap = await db.collection('articles')
        .orderBy('publishedAt', 'desc')
        .get();

      const dynamicPages = articlesSnap.docs
        .filter(doc => {
          const slug = doc.data().slug;
          // Exclude articles already in static list
          const staticSlugs = ['ky-thuat-trong-keo-lai-ah1', 'he-thong-phun-suong-vuon-uom', 'giong-keo-lai-ah1-dac-tinh', 'cach-chon-dat-trong-keo-lai'];
          return slug && !staticSlugs.includes(slug);
        })
        .map(doc => {
          const d = doc.data();
          const publishedDate = d.publishedAt?.toDate?.()
            ? d.publishedAt.toDate().toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
          return {
            loc: `${SITE_URL}/articles/${d.slug}/`,
            lastmod: publishedDate,
            changefreq: 'monthly',
            priority: '0.7',
          };
        });

      const today = new Date().toISOString().split('T')[0];
      const allPages = [...staticPages.map(p => ({ ...p, lastmod: today })), ...dynamicPages];

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(p => `  <url>
    <loc>${p.loc}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

      res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      res.set('Content-Type', 'application/xml; charset=utf-8');
      return res.status(200).send(xml);
    } catch (error) {
      console.error('Failed to generate sitemap:', error);
      return res.status(500).send('Internal server error');
    }
  }
);

// ═══════════════════════════════════════
// ═══════════════════════════════════════
// HELPER: Send Email Notification
// ═══════════════════════════════════════
async function sendEmailNotification({ title, description, url, appPassword }) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'dtduy46@gmail.com',
        pass: appPassword,
      },
    });

    const now = new Date().toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric', month: 'long', day: 'numeric',
    });

    await transporter.sendMail({
      from: '"KeoLai Auto-Gen" <dtduy46@gmail.com>',
      to: 'dtduy46@gmail.com',
      subject: `🌿 Bài viết mới: ${title}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8faf8; border-radius: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #2d5016, #3d6b22); padding: 24px 30px; color: white;">
            <h1 style="margin: 0; font-size: 20px;">🌿 Keo Lai Xanh — Bài viết mới</h1>
            <p style="margin: 8px 0 0; opacity: 0.85; font-size: 14px;">${now}</p>
          </div>
          <div style="padding: 24px 30px;">
            <h2 style="color: #2d5016; margin: 0 0 12px; font-size: 18px;">${title}</h2>
            <p style="color: #555; line-height: 1.6; margin: 0 0 20px;">${description}</p>
            <a href="${url}" style="display: inline-block; background: #3d6b22; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Xem bài viết →
            </a>
          </div>
          <div style="padding: 16px 30px; background: #eef3ee; color: #777; font-size: 12px; text-align: center;">
            Tự động gửi bởi KeoLai Auto-Gen Pipeline
          </div>
        </div>
      `,
    });
    console.log('📧 Email notification sent to dtduy46@gmail.com');
  } catch (error) {
    // Don't fail article generation if email fails
    console.error('📧 Email notification failed (non-blocking):', error.message);
  }
}

// HELPER: Simple Markdown → HTML
// ═══════════════════════════════════════
function markdownToHtml(md) {
  let html = md
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    // Paragraphs: lines that aren't headings
    .split('\n\n')
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('<h')) return block;
      return `<p>${block.replace(/\n/g, ' ')}</p>`;
    })
    .join('\n');

  return html;
}

// ═══════════════════════════════════════
// HELPER: Build full article HTML page
// ═══════════════════════════════════════
function buildArticlePage({ title, description, keywords, slug, label, breadcrumb, date, content, stats, image }) {
  const dateFormatted = new Date(date).toLocaleDateString('vi-VN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  const canonicalUrl = `${SITE_URL}/articles/${slug}/`;

  // Stats HTML
  const statsHtml = stats.length > 0
    ? `<div class="stats-row">${stats.map(s =>
      `<div class="stat-item"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`
    ).join('')}</div>`
    : '';

  // JSON-LD Schema
  const articleSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': title,
    'description': description,
    'image': image,
    'author': { '@type': 'Organization', 'name': 'Keo Lai Xanh' },
    'publisher': { '@type': 'Organization', 'name': 'Keo Lai Xanh' },
    'datePublished': date,
    'dateModified': date,
    'mainEntityOfPage': canonicalUrl,
  });

  const breadcrumbSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Trang chủ', 'item': `${SITE_URL}/` },
      { '@type': 'ListItem', 'position': 2, 'name': 'Kiến thức', 'item': `${SITE_URL}/#knowledge` },
      { '@type': 'ListItem', 'position': 3, 'name': breadcrumb },
    ],
  });

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | Keo Lai Xanh</title>
<meta name="description" content="${description}">
<meta name="keywords" content="${keywords}">
<meta name="robots" content="index, follow">
<meta name="article:published_time" content="${date}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:locale" content="vi_VN">
<meta property="og:type" content="article">
${image ? `<meta property="og:image" content="${image}">` : ''}
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<script type="application/ld+json">${articleSchema}</script>
<script type="application/ld+json">${breadcrumbSchema}</script>
<style>
:root{--primary:#0f5238;--primary-container:#2d6a4f;--secondary:#116c4a;--on-primary:#fff;--on-surface:#191c1c;--on-surface-variant:#404943;--surface:#f9f9f8;--surface-low:#f3f4f3;--surface-lowest:#fff;--surface-high:#e7e8e7;--outline:#707973;--outline-variant:#bfc9c1;--primary-fixed:#b1f0ce;--primary-fixed-dim:#95d4b3;--font:'Be Vietnam Pro',sans-serif;--space-3:1rem;--space-4:1.4rem}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;font-size:18px}
body{font-family:var(--font);color:var(--on-surface);background:var(--surface);line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%;height:auto;display:block}
a{color:var(--primary);text-decoration:none}
.container{max-width:1200px;margin:0 auto;padding:0 1.5rem}
.header{position:sticky;top:0;z-index:100;background:rgba(249,249,248,0.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--outline-variant)}
.header-inner{display:flex;justify-content:space-between;align-items:center;padding:1rem 0}
.logo-text{font-size:1.4rem;font-weight:900;color:var(--primary);text-transform:uppercase;letter-spacing:-0.03em;text-decoration:none}
.nav{display:none;gap:2rem}
.nav-link{font-weight:700;font-size:.85rem;text-transform:uppercase;letter-spacing:.1em;color:var(--on-surface);text-decoration:none}
.header-phone{font-weight:700;font-size:1rem;color:var(--primary);text-decoration:none}
.article-hero{position:relative;min-height:440px;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#081f15 0%,var(--primary) 40%,var(--primary-container) 100%);overflow:hidden;padding-top:80px}
.article-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 20% 80%,rgba(149,212,179,.15) 0%,transparent 50%),radial-gradient(circle at 80% 20%,rgba(177,240,206,.1) 0%,transparent 40%)}
.article-hero .hero-content{position:relative;z-index:2;width:100%;max-width:780px;margin:0 auto;padding:48px 2rem;text-align:center}
.hero-breadcrumb{font-size:.78rem;color:rgba(255,255,255,.6);margin-bottom:20px}
.hero-breadcrumb a{color:rgba(255,255,255,.7)}
.hero-breadcrumb a:hover{color:#fff}
.hero-breadcrumb span{margin:0 6px}
.hero-label{display:inline-block;background:rgba(149,212,179,.2);border:1px solid rgba(149,212,179,.3);color:var(--primary-fixed-dim);font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:6px 16px;margin-bottom:20px}
.article-hero .hero-title{font-size:2.4rem;font-weight:800;color:#fff;line-height:1.25;margin-bottom:20px;max-width:720px;margin-left:auto;margin-right:auto;text-transform:none}
.hero-meta{display:flex;align-items:center;justify-content:center;gap:16px;font-size:.82rem;color:rgba(255,255,255,.6)}
.hero-meta-dot{width:4px;height:4px;background:rgba(255,255,255,.3);border-radius:50%}
.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1px;background:var(--outline-variant)}
.stat-item{background:var(--surface-lowest);padding:24px 20px;text-align:center}
.stat-value{font-size:1.8rem;font-weight:800;color:var(--primary);line-height:1.2}
.stat-label{font-size:.75rem;font-weight:600;color:var(--outline);letter-spacing:.05em;text-transform:uppercase;margin-top:4px}
.article-body{max-width:720px;margin:0 auto;padding:56px 1.4rem 80px}
.article-body h2{font-size:1.5rem;font-weight:700;color:var(--primary);margin-top:56px;margin-bottom:20px;padding-top:32px;position:relative}
.article-body h2::before{content:'';position:absolute;top:0;left:0;width:48px;height:3px;background:var(--primary-fixed-dim)}
.article-body h3{font-size:1.15rem;font-weight:600;color:var(--on-surface);margin-top:32px;margin-bottom:12px}
.article-body p{font-size:1rem;line-height:1.85;margin-bottom:20px;color:var(--on-surface)}
.article-cta{background:linear-gradient(135deg,#081f15 0%,var(--primary) 100%);padding:56px 40px;text-align:center;position:relative;overflow:hidden}
.article-cta::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 30% 50%,rgba(149,212,179,.12) 0%,transparent 60%)}
.article-cta h3{position:relative;font-size:1.6rem;font-weight:700;color:#fff;margin-bottom:12px}
.article-cta p{position:relative;font-size:1rem;color:rgba(255,255,255,.8);margin-bottom:28px;max-width:480px;margin-left:auto;margin-right:auto}
.cta-btn{position:relative;display:inline-block;background:#fff;color:var(--primary);padding:16px 40px;font-family:var(--font);font-weight:700;font-size:1.05rem;border:none;cursor:pointer;text-decoration:none;transition:transform .2s,box-shadow .2s}
.cta-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.2)}
.cta-phone{display:block;margin-top:16px;font-size:.85rem;color:rgba(255,255,255,.6);position:relative}
.footer{background:var(--primary);color:rgba(243,244,243,.9);padding:3rem 0}
.footer-grid{display:grid;grid-template-columns:1fr;gap:2rem}
.footer-logo{display:block;font-size:1.2rem;font-weight:900;color:#fff;text-transform:uppercase;margin-bottom:1rem}
.footer-brand p{font-size:.9rem;line-height:1.7}
.footer-contact div{font-size:.95rem;line-height:2}
.footer-links-title{font-weight:700;text-transform:uppercase;letter-spacing:.15em;font-size:.78rem;color:#fff;margin-bottom:.5rem}
.footer-links{display:flex;flex-direction:column;gap:.5rem}
.footer-links a{color:rgba(243,244,243,.9);font-size:.95rem;text-decoration:none}
.footer-bottom{margin-top:2rem;padding-top:2rem;border-top:1px solid rgba(255,255,255,.1);font-weight:700;font-size:.9rem;color:#fff}
@media(min-width:768px){.nav{display:flex}.footer-grid{grid-template-columns:2fr 1fr 1fr}}
@media(max-width:640px){.article-hero .hero-title{font-size:1.7rem}.article-hero .hero-content{padding:32px 1.2rem 36px}.article-hero{min-height:340px}.article-body{padding:40px 1.2rem 60px}.article-body h2{font-size:1.3rem}.stats-row{grid-template-columns:1fr 1fr}.stat-value{font-size:1.5rem}.article-cta{padding:40px 24px}}
</style>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-CT8B2E0YF0"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-CT8B2E0YF0');</script>
</head>
<body>
<header class="header">
<div class="container">
<div class="header-inner">
<a href="/" class="logo-text">Keo Lai Xanh</a>
<nav class="nav">
<a href="/#specs" class="nav-link">Sản phẩm</a>
<a href="/#pricing" class="nav-link">Bảng giá</a>
<a href="/#knowledge" class="nav-link">Kiến thức</a>
<a href="/#faq" class="nav-link">Hỏi đáp</a>
</nav>
<a href="tel:0907282960" class="header-phone">0907 282 960</a>
</div>
</div>
</header>

<section class="article-hero">
<div class="hero-content">
<div class="hero-breadcrumb">
<a href="/">Trang chủ</a><span>/</span><a href="/#knowledge">Kiến thức</a><span>/</span>${breadcrumb}
</div>
<div class="hero-label">${label}</div>
<h1 class="hero-title">${title}</h1>
<div class="hero-meta">
<span>Keo Lai Xanh</span>
<span class="hero-meta-dot"></span>
<span>${dateFormatted}</span>
<span class="hero-meta-dot"></span>
<span>${readTime} phút đọc</span>
</div>
</div>
</section>

${statsHtml}

<main class="article-body">
${content}
</main>

<section class="article-cta">
<h3>Đặt giống Keo Lai AH1 ngay hôm nay</h3>
<p>Cây giống giâm đọt 2-3 tháng, đạt chuẩn xuất vườn. Giấy chứng nhận nguồn gốc đầy đủ. Giao tận vườn toàn quốc.</p>
<a href="tel:0907282960" class="cta-btn">Gọi 0907.282.960</a>
<span class="cta-phone">Hoặc nhắn tin Zalo cùng số</span>
</section>

<footer class="footer">
<div class="container">
<div class="footer-grid">
<div class="footer-brand">
<a href="/" class="footer-logo">Vườn Ươm Cây Giống Ngọc Sơn</a>
<p>Chuyên giâm đọt và ươm giống keo lai AH1 — hệ thống phun sương tự động, quy trình ươm 2–3 tháng đạt chuẩn xuất vườn.</p>
</div>
<div class="footer-contact">
<div>📞 0907.282.960</div>
<div>📍 Vườn Ươm Cây Giống Ngọc Sơn, 42, Ấp Quảng Phát, Xã Quảng Tiến, Trảng Bom, Đồng Nai</div>
</div>
<div>
<div class="footer-links-title">Liên kết</div>
<div class="footer-links">
<a href="/#specs">Thông số kỹ thuật</a>
<a href="/#pricing">Bảng giá</a>
<a href="/#knowledge">Kiến thức</a>
<a href="/#faq">Hỏi đáp</a>
</div>
</div>
</div>
<div class="footer-bottom">© 2026 Vườn Ươm Cây Giống Ngọc Sơn — Giống cây lâm nghiệp chất lượng cao</div>
</div>
</footer>
</body>
</html>`;
}



// ═══════════════════════════════════════
// 6. SCHEDULE CONTENT GENERATION
//    Triggered by Cloud Scheduler (cron: 0 6 * * 1,3,5 → M/W/F 6AM VN)
//    Auto-picks pending topic → generates article → publishes
// ═══════════════════════════════════════
exports.scheduleContentGeneration = functions.https.onRequest(
  {
    secrets: [vertexApiKey, gmailAppPassword, appClientSecret],
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (req, res) => {
    try {
      // Allow Cloud Scheduler (no secret check) or manual trigger with secret
      const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
      const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();

      if (!isScheduler && !hasSecret) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      console.log('⏰ Scheduled content generation triggered');

      // Check if we already published today (prevent double-fire)
      const today = new Date().toISOString().split('T')[0];
      const todaySnap = await db.collection('articles')
        .where('publishedDate', '==', today)
        .limit(1)
        .get();

      if (!todaySnap.empty) {
        console.log('📌 Already published today, skipping');
        return res.status(200).json({ message: 'Already published today', skipped: true });
      }

      // Pick highest-priority pending topic
      const topicsRef = db.collection('topics');
      const pendingSnap = await topicsRef
        .where('status', '==', 'pending')
        .orderBy('priority', 'desc')
        .limit(1)
        .get();

      if (pendingSnap.empty) {
        console.log('📭 No pending topics in queue');
        return res.status(200).json({ message: 'No pending topics' });
      }

      const topicDoc = pendingSnap.docs[0];
      const topic = topicDoc.data();
      console.log(`📌 Auto-selected topic: ${topic.title}`);

      // Mark as generating
      await topicDoc.ref.update({ status: 'generating', scheduledAt: admin.firestore.FieldValue.serverTimestamp() });

      // Generate content via Vertex AI
      const apiKey = vertexApiKey.value();
      const prompt = `Bạn là chuyên gia lâm nghiệp Việt Nam. Viết một bài hướng dẫn kỹ thuật về chủ đề: "${topic.title}".

Yêu cầu:
- Viết tiếng Việt, chi tiết và chuyên sâu (1000-1500 từ)
- Bài viết theo phong cách E-E-A-T (Experience, Expertise, Authority, Trust)
- Sử dụng dữ liệu cụ thể: số liệu, số đo, phần trăm, thời gian
- Cấu trúc rõ ràng: mở đầu, các heading h2/h3, kết luận
- Keywords chính: ${topic.keywords}
- Phù hợp cho nông dân và người trồng rừng
- KHÔNG sử dụng markdown format đặc biệt (bold, italic). Chỉ dùng heading ## và ###
- Mỗi paragraph ngắn gọn 2-4 câu

Trả về nội dung bài viết thuần túy (không có tiêu đề ở đầu).`;

      const geminiRes = await fetch(
        `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.0-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
          }),
        }
      );

      if (!geminiRes.ok) {
        const errData = await geminiRes.json();
        await topicDoc.ref.update({ status: 'error', errorMessage: JSON.stringify(errData) });
        throw new Error(`Vertex AI error: ${JSON.stringify(errData)}`);
      }

      const geminiData = await geminiRes.json();
      const articleContent = geminiData.candidates[0].content.parts[0].text;
      const htmlContent = markdownToHtml(articleContent);

      const articleHtml = buildArticlePage({
        title: topic.title,
        description: topic.description || topic.title,
        keywords: topic.keywords?.join?.(', ') || topic.keywords,
        slug: topic.slug,
        label: topic.label || 'Kỹ thuật',
        breadcrumb: topic.breadcrumb_short || topic.title.split('—')[0].trim(),
        date: today,
        content: htmlContent,
        stats: topic.stats || [],
        image: topic.image || '',
      });

      // Save to Firestore
      const publishedUrl = `${SITE_URL}/articles/${topic.slug}/`;
      await db.collection('articles').doc(topic.slug).set({
        title: topic.title,
        description: topic.description || topic.title,
        slug: topic.slug,
        url: publishedUrl,
        html: articleHtml,
        publishedAt: admin.firestore.FieldValue.serverTimestamp(),
        publishedDate: today,
        source: 'auto-scheduler',
      });

      // Update topic
      await topicDoc.ref.update({
        status: 'published',
        publishedAt: admin.firestore.FieldValue.serverTimestamp(),
        url: publishedUrl,
      });

      // Send notification
      await sendEmailNotification({
        title: `[Auto] ${topic.title}`,
        description: topic.description || topic.title,
        url: publishedUrl,
        appPassword: gmailAppPassword.value(),
      });

      console.log(`🎉 Auto-published: ${publishedUrl}`);
      return res.status(200).json({ success: true, url: publishedUrl, title: topic.title });
    } catch (error) {
      console.error('❌ Scheduled content generation failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// ═══════════════════════════════════════
// 6A. PING GOOGLE AFTER PUBLISH (Phase 1 – PBCA)
//     Firestore trigger: auto-fires when new article created
//     → Google Indexing API + Create PBCA experiment lifecycle
// ═══════════════════════════════════════
exports.pingGoogleAfterPublish = functions.firestore.onDocumentCreated(
  { document: 'articles/{articleId}', region: 'us-central1' },
  async (event) => {
    const article = event.data.data();
    const slug = event.params.articleId;
    const articleUrl = article.url || `${SITE_URL}/articles/${slug}/`;

    console.log(`🔔 New article detected: ${slug} → ${articleUrl}`);

    // 1. Submit to Google Indexing API (best-effort, non-blocking)
    try {
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/indexing'],
      });
      const indexing = google.indexing({ version: 'v3', auth });
      await indexing.urlNotifications.publish({
        requestBody: { url: articleUrl, type: 'URL_UPDATED' },
      });
      console.log(`✅ Indexing API: submitted ${articleUrl}`);
    } catch (err) {
      // Non-blocking: Indexing API may not be set up yet
      console.warn(`⚠️ Indexing API failed (non-blocking):`, err.message);
    }

    // 2. Create PBCA experiment + enqueue Cloud Tasks
    try {
      const keyword = (typeof article.keywords === 'string'
        ? article.keywords.split(',')[0].trim()
        : Array.isArray(article.keywords)
          ? article.keywords[0]
          : article.title);
      await createExperimentLifecycle(slug, keyword, articleUrl);
      console.log(`🧪 Experiment lifecycle created for: ${slug}`);
    } catch (err) {
      console.error(`❌ Experiment creation failed:`, err);
    }
  }
);

// ═══════════════════════════════════════
// 6B. EXPERIMENT CHECKPOINT (Phase 1 – PBCA)
//     Cloud Tasks HTTP handler: processes C1/C2/C3 checkpoints
//     C1 (T+3): Index check + force re-index if needed
//     C2 (T+14): Initial rank observation (stub for Phase 2)
//     C3 (T+30): Stable rank + AI decision (stub for Phase 3)
// ═══════════════════════════════════════
exports.experimentCheckpoint = functions.https.onRequest(
  { region: 'us-central1', timeoutSeconds: 120 },
  async (req, res) => {
    const { slug, checkpoint, keyword, articleUrl } = req.body;

    if (!slug || !checkpoint) {
      return res.status(400).json({ error: 'Missing slug or checkpoint' });
    }

    console.log(`🔬 Checkpoint ${checkpoint} for: ${slug}`);
    const expRef = db.collection('brain_experiments').doc(slug);

    try {
      switch (checkpoint) {
        case 'c1': {
          // T+3: Check if indexed, retry Indexing API if not
          const indexResult = await checkIndexStatus(articleUrl);

          await expRef.update({
            'c1.executedAt': admin.firestore.FieldValue.serverTimestamp(),
            'c1.indexed': indexResult.indexed,
            'c1.verdict': indexResult.indexed ? 'INDEXED' : 'NOT_INDEXED',
            'c1.method': indexResult.method || 'basic',
            status: indexResult.indexed ? 'c1_complete' : 'c1_retry_pending',
          });

          // If not indexed → call Indexing API again
          if (!indexResult.indexed) {
            try {
              const auth = new google.auth.GoogleAuth({
                scopes: ['https://www.googleapis.com/auth/indexing'],
              });
              const indexing = google.indexing({ version: 'v3', auth });
              await indexing.urlNotifications.publish({
                requestBody: { url: articleUrl, type: 'URL_UPDATED' },
              });
              await expRef.update({ 'c1.indexingApiRetried': true });
              console.log(`🔁 Indexing API retry sent for: ${articleUrl}`);
            } catch (err) {
              console.warn('Indexing API retry failed:', err.message);
            }
          }
          break;
        }

        case 'c2': {
          // T+14: Record initial rank from GSC Search Analytics
          const rankData = await fetchGSCRankData(slug, keyword);

          await expRef.update({
            'c2.executedAt': admin.firestore.FieldValue.serverTimestamp(),
            'c2.position': rankData.position,
            'c2.impressions': rankData.impressions,
            'c2.clicks': rankData.clicks,
            'c2.ctr': rankData.ctr,
            'c2.topQueries': rankData.topQueries.slice(0, 10),
            'c2.hasData': rankData.hasData,
            'c2.action': rankData.hasData ? 'OBSERVED' : 'NO_DATA_YET',
            status: 'c2_complete',
          });

          // Populate brain_keywords with per-query metrics
          if (rankData.topQueries.length > 0) {
            const kwBatch = db.batch();
            for (const q of rankData.topQueries) {
              const kwId = q.query.replace(/\s+/g, '_').substring(0, 100);
              const kwRef = db.collection('brain_keywords').doc(kwId);
              kwBatch.set(kwRef, {
                query: q.query,
                position: q.position,
                impressions: q.impressions,
                clicks: q.clicks,
                ctr: q.ctr,
                source: 'gsc_c2',
                coveredBy: slug,
                status: 'covered',
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });
            }
            await kwBatch.commit();
            console.log(`📊 Populated ${rankData.topQueries.length} keywords from C2 for ${slug}`);
          }
          break;
        }

        case 'c3': {
          // T+30: Stable rank + AI decision (Vertex AI in Phase 3)
          await expRef.update({
            'c3.executedAt': admin.firestore.FieldValue.serverTimestamp(),
            'c3.note': 'AI decision engine pending (Phase 3)',
            status: 'c3_pending_phase3',
          });
          break;
        }

        default:
          return res.status(400).json({ error: `Unknown checkpoint: ${checkpoint}` });
      }

      console.log(`✅ Checkpoint ${checkpoint} complete for: ${slug}`);
      return res.status(200).json({ success: true, checkpoint, slug });
    } catch (err) {
      console.error(`❌ Checkpoint ${checkpoint} failed for ${slug}:`, err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// ═══════════════════════════════════════
// 6C. BACKFILL EXPERIMENTS (One-time)
//     Seeds PBCA experiments for existing published articles
// ═══════════════════════════════════════
exports.backfillExperiments = functions.https.onRequest(
  { region: 'us-central1', timeoutSeconds: 120, secrets: [appClientSecret] },
  async (req, res) => {
    const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
    if (!hasSecret) return res.status(403).json({ error: 'Unauthorized' });

    const articlesSnap = await db.collection('articles').get();
    const results = [];

    for (const doc of articlesSnap.docs) {
      const article = doc.data();
      const slug = doc.id;

      // Skip if experiment already exists
      const existing = await db.collection('brain_experiments').doc(slug).get();
      if (existing.exists) {
        results.push({ slug, status: 'skipped (already exists)' });
        continue;
      }

      const keyword = (typeof article.keywords === 'string'
        ? article.keywords.split(',')[0].trim()
        : Array.isArray(article.keywords)
          ? article.keywords[0]
          : article.title);
      const articleUrl = article.url || `${SITE_URL}/articles/${slug}/`;

      // For existing articles: schedule checkpoints from NOW (catch-up)
      await createExperimentLifecycle(slug, keyword, articleUrl);
      results.push({ slug, status: 'created' });
    }

    console.log(`📊 Backfill complete: ${results.length} articles processed`);
    return res.status(200).json({
      success: true,
      total: articlesSnap.size,
      results,
    });
  }
);

// ═══════════════════════════════════════
// HELPERS: PBCA Experiment Lifecycle
// ═══════════════════════════════════════

/**
 * Creates a PBCA experiment document and enqueues C1/C2/C3 Cloud Tasks
 */
async function createExperimentLifecycle(slug, keyword, articleUrl) {
  const now = new Date();
  const queuePath = tasksClient.queuePath('keolai-63ec1', 'us-central1', 'seo-lifecycle');

  const checkpoints = [
    { name: 'c1', daysLater: 3 },
    { name: 'c2', daysLater: 14 },
    { name: 'c3', daysLater: 30 },
  ];

  const taskIds = {};
  for (const cp of checkpoints) {
    const scheduleTime = new Date(now.getTime() + cp.daysLater * 24 * 60 * 60 * 1000);
    const [task] = await tasksClient.createTask({
      parent: queuePath,
      task: {
        httpRequest: {
          httpMethod: 'POST',
          url: `https://us-central1-keolai-63ec1.cloudfunctions.net/experimentCheckpoint`,
          headers: { 'Content-Type': 'application/json' },
          body: Buffer.from(JSON.stringify({
            slug, checkpoint: cp.name, keyword, articleUrl,
          })).toString('base64'),
          oidcToken: {
            serviceAccountEmail: `keolai-63ec1@appspot.gserviceaccount.com`,
          },
        },
        scheduleTime: { seconds: Math.floor(scheduleTime.getTime() / 1000) },
      },
    });
    taskIds[cp.name] = task.name;
    console.log(`  📤 Enqueued ${cp.name} for ${slug} at T+${cp.daysLater}d`);
  }

  // Create experiment document in Firestore
  await db.collection('brain_experiments').doc(slug).set({
    slug,
    targetKeyword: keyword,
    articleUrl,
    status: 'c1_pending',
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    taskIds,
    c1: {
      scheduledAt: admin.firestore.Timestamp.fromDate(
        new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000))
    },
    c2: {
      scheduledAt: admin.firestore.Timestamp.fromDate(
        new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000))
    },
    c3: {
      scheduledAt: admin.firestore.Timestamp.fromDate(
        new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000))
    },
  });

  console.log(`🧪 Experiment created: ${slug} | C1=T+3, C2=T+14, C3=T+30`);
}

/**
 * Checks if a URL is indexed by Google using GSC URL Inspection API
 */
async function checkIndexStatus(articleUrl) {
  try {
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    const authClient = await auth.getClient();
    const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });

    const result = await searchconsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: articleUrl,
        siteUrl: GSC_SITE_URL,
      },
    });

    const verdict = result.data.inspectionResult?.indexStatusResult;
    const indexed = verdict?.coverageState === 'Submitted and indexed' ||
      verdict?.verdict === 'PASS';

    console.log(`🔍 GSC Index check for ${articleUrl}: ${indexed ? '✅ INDEXED' : '❌ NOT INDEXED'} (${verdict?.coverageState || 'unknown'})`);

    return {
      indexed,
      coverageState: verdict?.coverageState || 'UNKNOWN',
      lastCrawlTime: verdict?.lastCrawlTime || null,
      robotsTxtState: verdict?.robotsTxtState || null,
      method: 'gsc_url_inspection',
    };
  } catch (err) {
    console.warn(`⚠️ GSC URL Inspection failed for ${articleUrl}:`, err.message);
    // Graceful fallback — don't block the pipeline
    return { indexed: false, error: err.message, method: 'fallback' };
  }
}

/**
 * Fetches rank data from GSC Search Analytics for a specific article
 * Returns position, impressions, clicks, CTR and top queries
 */
async function fetchGSCRankData(slug, keyword) {
  try {
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    const authClient = await auth.getClient();
    const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });

    const articlePath = `/articles/${slug}/`;

    // Query Search Analytics for this specific page
    const response = await searchconsole.searchanalytics.query({
      siteUrl: GSC_SITE_URL,
      requestBody: {
        startDate: getDateString(-28), // last 28 days
        endDate: getDateString(-1),    // yesterday
        dimensions: ['query'],
        dimensionFilterGroups: [{
          filters: [{
            dimension: 'page',
            operator: 'contains',
            expression: articlePath,
          }],
        }],
        rowLimit: 20,
      },
    });

    const rows = response.data.rows || [];

    if (rows.length === 0) {
      console.log(`📊 GSC: No rank data yet for ${slug}`);
      return {
        position: null, impressions: 0, clicks: 0, ctr: 0,
        topQueries: [], hasData: false,
      };
    }

    // Aggregate metrics
    const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
    const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
    const avgPosition = rows.reduce((s, r) => s + r.position * r.impressions, 0) / totalImpressions;

    const topQueries = rows.map(r => ({
      query: r.keys[0],
      position: Math.round(r.position * 10) / 10,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: Math.round(r.ctr * 10000) / 100, // percent
    })).sort((a, b) => b.impressions - a.impressions);

    console.log(`📊 GSC rank data for ${slug}: pos=${avgPosition.toFixed(1)}, imp=${totalImpressions}, clicks=${totalClicks}, queries=${rows.length}`);

    return {
      position: Math.round(avgPosition * 10) / 10,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
      topQueries,
      hasData: true,
    };
  } catch (err) {
    console.warn(`⚠️ GSC Search Analytics failed for ${slug}:`, err.message);
    return {
      position: null, impressions: 0, clicks: 0, ctr: 0,
      topQueries: [], hasData: false, error: err.message,
    };
  }
}

/**
 * Helper: returns date string N days from today (YYYY-MM-DD)
 */
function getDateString(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

// ═══════════════════════════════════════
// 7. GENERATE FACEBOOK POST
//    Takes an article slug → generates optimized FB post copy
// ═══════════════════════════════════════
exports.generateFacebookPost = functions.https.onRequest(
  {
    secrets: [vertexApiKey, appClientSecret],
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '256MiB',
    cors: true,
  },
  async (req, res) => {
    try {
      const clientSecret = req.headers['x-app-secret'];
      if (clientSecret !== appClientSecret.value()) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const { slug } = req.body;
      if (!slug) {
        return res.status(400).json({ error: 'Missing slug parameter' });
      }

      // Fetch article from Firestore
      const doc = await db.collection('articles').doc(slug).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Article not found' });
      }

      const article = doc.data();
      const articleText = article.html
        ? article.html.replace(/<[^>]*>/g, '').substring(0, 2000)
        : article.title;

      const prompt = `Bạn là chuyên gia marketing nông nghiệp Việt Nam. Tạo một bài đăng Facebook (Vietnamese) quảng bá bài viết kỹ thuật lâm nghiệp.

Thông tin bài viết:
- Tiêu đề: ${article.title}
- Nội dung tóm tắt: ${articleText.substring(0, 800)}
- Link: ${article.url}

Yêu cầu bài đăng Facebook:
- Mở đầu bằng một câu hook gây tò mò (dùng emoji phù hợp 🌿🌱💰)
- Nêu 3-4 điểm chính rút ra từ bài viết (dùng bullet points với emoji)
- Kết thúc bằng CTA kêu gọi đọc bài viết và liên hệ
- Tone: chuyên nghiệp nhưng gần gũi, phù hợp nông dân
- Độ dài: 150-250 từ
- Thêm 5-7 hashtag phù hợp ở cuối
- KHÔNG dùng link trực tiếp trong bài (link sẽ được đặt ở comment)

Trả về CHỈNH bài đăng, không có giải thích.`;

      const apiKey = vertexApiKey.value();
      const geminiRes = await fetch(
        `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.0-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.85, maxOutputTokens: 1024 },
          }),
        }
      );

      if (!geminiRes.ok) {
        throw new Error(`Vertex AI error: ${geminiRes.status}`);
      }

      const geminiData = await geminiRes.json();
      const fbPost = geminiData.candidates[0].content.parts[0].text;

      // Save to Firestore for reference
      await db.collection('social_posts').add({
        articleSlug: slug,
        platform: 'facebook',
        content: fbPost,
        articleUrl: article.url,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'draft',
      });

      console.log(`📘 FB post generated for: ${article.title}`);

      return res.status(200).json({
        success: true,
        post: fbPost,
        articleTitle: article.title,
        articleUrl: article.url,
        instruction: 'Copy bài đăng → paste vào Facebook → thêm link bài viết ở comment đầu tiên',
      });
    } catch (error) {
      console.error('❌ FB post generation failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// ═══════════════════════════════════════
// 8. WEEKLY ANALYTICS REPORT
//    Triggered by Cloud Scheduler (cron: 0 8 * * 1 → Monday 8AM VN)
//    Fetches GA4 data → AI summary → Email digest
// ═══════════════════════════════════════
exports.weeklyAnalyticsReport = functions.https.onRequest(
  {
    secrets: [vertexApiKey, gmailAppPassword, appClientSecret],
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      // Auth: Cloud Scheduler or manual
      const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
      const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
      if (!isScheduler && !hasSecret) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      console.log('📊 Weekly analytics report triggered');

      // Collect data from Firestore
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // 1. New leads this week
      const leadsQuery = await db.collection('leads')
        .where('createdAt', '>=', weekAgo)
        .get();
      const newLeads = leadsQuery.size;

      // 2. Articles published this week
      const articlesQuery = await db.collection('articles')
        .where('publishedAt', '>=', weekAgo)
        .get();
      const newArticles = articlesQuery.docs.map(d => ({
        title: d.data().title,
        url: d.data().url,
      }));

      // 3. Total articles
      const totalArticles = (await db.collection('articles').get()).size;

      // 4. Pending topics
      const pendingTopics = (await db.collection('topics')
        .where('status', '==', 'pending')
        .get()).size;

      // 5. Social posts generated
      const socialQuery = await db.collection('social_posts')
        .where('createdAt', '>=', weekAgo)
        .get();
      const socialPosts = socialQuery.size;

      // Build report data
      const reportData = {
        period: `${weekAgo.toISOString().split('T')[0]} → ${now.toISOString().split('T')[0]}`,
        newLeads,
        newArticles: newArticles.length,
        articlesList: newArticles,
        totalArticles,
        pendingTopics,
        socialPosts,
      };

      // Generate AI summary
      const apiKey = vertexApiKey.value();
      const summaryPrompt = `Bạn là marketing analyst. Phân tích dữ liệu tuần của website keolaigiamhom.vn và đưa nhận xét:

Dữ liệu tuần (${reportData.period}):
- Lead mới: ${reportData.newLeads}
- Bài viết mới: ${reportData.newArticles}
- Tổng bài viết: ${reportData.totalArticles}
- Chủ đề chờ: ${reportData.pendingTopics}
- Bài FB sinh ra: ${reportData.socialPosts}

Hãy:
1. Đánh giá hiệu suất tuần (1-2 câu)
2. Xu hướng so với tuần trước (dựa trên volume)
3. Top 2-3 hành động ưu tiên tuần tới
4. Cảnh báo nếu có vấn đề (VD: hết topic, lead giảm)

Trả lời ngắn gọn, bullets, tiếng Việt.`;

      let aiSummary = '';
      try {
        const geminiRes = await fetch(
          `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.0-flash-lite:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
              generationConfig: { temperature: 0.5, maxOutputTokens: 512 },
            }),
          }
        );
        if (geminiRes.ok) {
          const data = await geminiRes.json();
          aiSummary = data.candidates[0].content.parts[0].text;
        }
      } catch (e) {
        aiSummary = 'AI summary unavailable this week.';
      }

      // Build email HTML
      const articlesListHtml = reportData.articlesList.length > 0
        ? reportData.articlesList.map(a => `<li><a href="${a.url}">${a.title}</a></li>`).join('')
        : '<li>Không có bài viết mới tuần này</li>';

      const emailHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #f8faf8; border-radius: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #2d5016, #3d6b22); padding: 28px 32px; color: white;">
            <h1 style="margin: 0; font-size: 22px;">📊 Báo Cáo Tuần — KeoLai Marketing</h1>
            <p style="margin: 8px 0 0; opacity: 0.85; font-size: 14px;">${reportData.period}</p>
          </div>

          <div style="padding: 28px 32px;">
            <!-- KPIs Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px;">
              <div style="background: white; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e8e8e8;">
                <div style="font-size: 28px; font-weight: 800; color: #2d5016;">${reportData.newLeads}</div>
                <div style="font-size: 11px; color: #888; text-transform: uppercase; font-weight: 600;">Lead mới</div>
              </div>
              <div style="background: white; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e8e8e8;">
                <div style="font-size: 28px; font-weight: 800; color: #2d5016;">${reportData.newArticles}</div>
                <div style="font-size: 11px; color: #888; text-transform: uppercase; font-weight: 600;">Bài viết mới</div>
              </div>
              <div style="background: white; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e8e8e8;">
                <div style="font-size: 28px; font-weight: 800; color: #2d5016;">${reportData.pendingTopics}</div>
                <div style="font-size: 11px; color: #888; text-transform: uppercase; font-weight: 600;">Topic còn lại</div>
              </div>
            </div>

            <!-- AI Summary -->
            <div style="background: #f0f7f0; padding: 20px; border-radius: 8px; border-left: 4px solid #2d5016; margin-bottom: 24px;">
              <h3 style="margin: 0 0 12px; font-size: 15px; color: #2d5016;">🤖 AI Insights</h3>
              <div style="font-size: 14px; line-height: 1.7; color: #333; white-space: pre-line;">${aiSummary}</div>
            </div>

            <!-- Articles Published -->
            <h3 style="font-size: 15px; color: #2d5016; margin-bottom: 8px;">📝 Bài viết đã đăng</h3>
            <ul style="font-size: 14px; line-height: 1.8; color: #555; padding-left: 20px; margin-bottom: 24px;">
              ${articlesListHtml}
            </ul>

            <!-- Quick Stats -->
            <div style="font-size: 13px; color: #888; border-top: 1px solid #eee; padding-top: 16px;">
              📈 Tổng bài viết: ${reportData.totalArticles} | 📘 FB posts: ${reportData.socialPosts} | 📋 Topics pending: ${reportData.pendingTopics}
            </div>
          </div>

          <div style="padding: 16px 32px; background: #eef3ee; color: #777; font-size: 12px; text-align: center;">
            Tự động gửi mỗi thứ Hai bởi KeoLai AI Marketing Automation
          </div>
        </div>
      `;

      // Send email
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: 'dtduy46@gmail.com', pass: gmailAppPassword.value() },
      });

      await transporter.sendMail({
        from: '"KeoLai Weekly Report" <dtduy46@gmail.com>',
        to: 'dtduy46@gmail.com',
        subject: `📊 Weekly Report: ${reportData.newLeads} leads, ${reportData.newArticles} bài viết (${reportData.period})`,
        html: emailHtml,
      });

      // Save report to Firestore
      await db.collection('weekly_reports').add({
        ...reportData,
        aiSummary,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log('📧 Weekly report sent');
      return res.status(200).json({ success: true, report: reportData, aiSummary });
    } catch (error) {
      console.error('❌ Weekly report failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// ═══════════════════════════════════════
// 9. AUTO NURTURE LEAD
//    Triggered by Cloud Scheduler (cron: 0 9 * * * → daily 9AM VN)
//    Sends personalized email drip sequence to leads with email
// ═══════════════════════════════════════

/**
 * 5-Step Nurture Email Sequence:
 * Step 0 (Day 0, 2h after submit): Welcome + "5 Bước Trồng Keo Lai" guide
 * Step 1 (Day 2): Technical content "Kinh nghiệm chọn giống AH1"
 * Step 2 (Day 5): Pricing + early bird offer
 * Step 3 (Day 10): Case study + testimonials
 * Step 4 (Day 15): Final reminder + 10% discount
 */
const NURTURE_STEPS = [
  {
    day: 0,
    subject: '🌿 Cảm ơn bạn — Tài liệu kỹ thuật trồng keo lai',
    template: 'welcome',
    description: 'Welcome email + hướng dẫn kỹ thuật miễn phí',
  },
  {
    day: 2,
    subject: '📖 Kinh nghiệm chọn giống keo lai AH1 chất lượng',
    template: 'technical',
    description: 'Bài viết kỹ thuật chọn giống — build trust',
  },
  {
    day: 5,
    subject: '💰 Bảng giá giống keo lai mùa vụ 2025-2026',
    template: 'pricing',
    description: 'Bảng giá + ưu đãi đặt sớm',
  },
  {
    day: 10,
    subject: '⭐ Khách hàng nói gì về giống keo AH1 của chúng tôi?',
    template: 'testimonial',
    description: 'Case study + testimonials',
  },
  {
    day: 15,
    subject: '🎁 Ưu đãi cuối — Giảm 10% cho đơn từ 5 vạn cây',
    template: 'final_offer',
    description: 'FOMO email — last chance offer',
  },
];

exports.autoNurtureLead = functions.https.onRequest(
  {
    secrets: [vertexApiKey, gmailAppPassword, appClientSecret],
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (req, res) => {
    try {
      // Auth: Cloud Scheduler or manual
      const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
      const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
      if (!isScheduler && !hasSecret) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      console.log('📧 Auto nurture lead triggered');

      const now = new Date();
      const results = { sent: 0, skipped: 0, completed: 0, errors: 0 };

      // Find leads that need nurturing — status is 'pending' and nurture_next_at <= now
      const leadsSnap = await db.collection('leads')
        .where('nurture_status', '==', 'pending')
        .where('nurture_next_at', '<=', now)
        .limit(20) // Process max 20 per run to avoid timeout
        .get();

      if (leadsSnap.empty) {
        console.log('📭 No leads to nurture right now');
        return res.status(200).json({ message: 'No leads to nurture', results });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: 'dtduy46@gmail.com', pass: gmailAppPassword.value() },
      });

      for (const leadDoc of leadsSnap.docs) {
        const lead = leadDoc.data();
        const currentStep = lead.nurture_step || 0;

        if (currentStep >= NURTURE_STEPS.length) {
          // Sequence complete
          await leadDoc.ref.update({ nurture_status: 'completed' });
          results.completed++;
          continue;
        }

        const step = NURTURE_STEPS[currentStep];

        try {
          // Generate personalized email content using Vertex AI
          const emailContent = await generateNurtureEmail(
            step, lead, vertexApiKey.value()
          );

          // Send email
          await transporter.sendMail({
            from: '"Vườn Ươm Keo Lai Xanh" <dtduy46@gmail.com>',
            to: lead.email,
            subject: step.subject,
            html: buildNurtureEmailHtml(emailContent, step, lead, currentStep),
          });

          // Calculate next step timing
          const nextStep = currentStep + 1;
          const nextStepData = NURTURE_STEPS[nextStep];
          let nextAt = null;
          let nextStatus = 'pending';

          if (nextStep >= NURTURE_STEPS.length) {
            nextStatus = 'completed';
          } else {
            const daysDiff = nextStepData.day - step.day;
            nextAt = new Date(now.getTime() + daysDiff * 24 * 60 * 60 * 1000);
          }

          // Update lead
          await leadDoc.ref.update({
            nurture_step: nextStep,
            nurture_status: nextStatus,
            nurture_next_at: nextAt,
            [`nurture_sent_${currentStep}`]: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(`📧 Sent step ${currentStep} to ${lead.email}`);
          results.sent++;
        } catch (emailErr) {
          console.error(`❌ Failed to send to ${lead.email}:`, emailErr.message);
          await leadDoc.ref.update({
            nurture_status: 'error',
            nurture_error: emailErr.message,
          });
          results.errors++;
        }
      }

      console.log(`📧 Nurture run complete:`, results);
      return res.status(200).json({ success: true, results });
    } catch (error) {
      console.error('❌ Auto nurture failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// HELPER: Generate personalized nurture email with Vertex AI
async function generateNurtureEmail(step, lead, apiKey) {
  const regionContext = lead.province
    ? `Khách hàng ở ${lead.province}.`
    : '';
  const quantityContext = lead.quantity
    ? `Quan tâm đặt khoảng ${lead.quantity} vạn cây.`
    : '';

  const prompts = {
    welcome: `Viết email chào mừng ngắn gọn (200 từ) cho khách hàng quan tâm giống keo lai AH1.
${regionContext} ${quantityContext}
Nội dung: cảm ơn, giới thiệu vườn ươm Ngọc Sơn, và 5 tips nhanh về cách trồng keo lai hiệu quả.
Tone: thân thiện, chuyên nghiệp. Kết thúc bằng CTA liên hệ Zalo.`,

    technical: `Viết nội dung email kỹ thuật (250 từ) về cách chọn giống keo lai AH1 chất lượng.
${regionContext} ${quantityContext}
Bao gồm: 3-4 tiêu chí chọn giống tốt, dấu hiệu cây khỏe, mùa trồng phù hợp.
Tone: chuyên gia nhưng dễ hiểu. CTA: đọc thêm trên website.`,

    pricing: `Viết email giới thiệu bảng giá giống keo lai (200 từ).
${regionContext} ${quantityContext}
Bao gồm: mức giá tham khảo (800-1200đ/cây tùy số lượng), ưu đãi đặt sớm -5%, hỗ trợ vận chuyển.
Tone: sales nhẹ nhàng. CTA: gọi ngay 0907.282.960 hoặc Zalo.`,

    testimonial: `Viết email case study (200 từ) về khách hàng trồng keo lai thành công.
${regionContext}
Tạo 2 câu chuyện ngắn: (1) khách ở Quảng Ngãi đặt 10 vạn cây, tỉ lệ sống 95%, (2) khách ở Bình Định trồng 5ha, thu hoạch sau 5 năm.
CTA: liên hệ để trở thành khách hàng tiếp theo.`,

    final_offer: `Viết email ưu đãi cuối cùng (150 từ) cho khách hàng đã nhận 4 email trước.
${regionContext} ${quantityContext}
Nội dung: giảm 10% cho đơn từ 5 vạn cây, chỉ áp dụng 7 ngày, số lượng có hạn.
Tone: urgency + FOMO. CTA: gọi ngay 0907.282.960.`,
  };

  const prompt = prompts[step.template] || prompts.welcome;

  try {
    const geminiRes = await fetch(
      `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      }
    );

    if (geminiRes.ok) {
      const data = await geminiRes.json();
      return data.candidates[0].content.parts[0].text;
    }
  } catch (e) {
    console.error('AI email generation fallback:', e.message);
  }

  // Fallback static content
  return `Xin chào ${lead.name},\n\nCảm ơn bạn đã quan tâm đến giống keo lai AH1 của Vườn Ươm Ngọc Sơn.\n\nLiên hệ 0907.282.960 (Zalo) để được tư vấn chi tiết.`;
}

// HELPER: Build nurture email HTML
function buildNurtureEmailHtml(content, step, lead, stepIndex) {
  const formattedContent = content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const progressDots = NURTURE_STEPS.map((_, i) =>
    `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${i <= stepIndex ? '#2d5016' : '#ddd'};margin:0 3px;"></span>`
  ).join('');

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e8e8e8;">
      <div style="background: linear-gradient(135deg, #2d5016, #3d6b22); padding: 28px 32px; color: white;">
        <h1 style="margin: 0; font-size: 20px;">🌿 Vườn Ươm Keo Lai Xanh</h1>
        <p style="margin: 8px 0 0; opacity: 0.85; font-size: 13px;">Chuyên giống keo lai AH1 chất lượng cao</p>
      </div>

      <div style="padding: 28px 32px;">
        <p style="font-size: 15px; color: #333; margin: 0 0 8px;">Xin chào <strong>${lead.name}</strong>,</p>

        <div style="font-size: 14px; line-height: 1.8; color: #444; margin: 16px 0 24px;">
          ${formattedContent}
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="https://zalo.me/0907282960" style="display: inline-block; background: #2d5016; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            💬 Chat Zalo Tư Vấn Ngay
          </a>
          <p style="margin: 12px 0 0; font-size: 13px; color: #888;">Hoặc gọi: <a href="tel:0907282960" style="color: #2d5016; font-weight: 600;">0907.282.960</a></p>
        </div>
      </div>

      <div style="padding: 16px 32px; background: #f8faf8; border-top: 1px solid #eee;">
        <div style="text-align: center; margin-bottom: 8px;">
          ${progressDots}
        </div>
        <p style="font-size: 11px; color: #aaa; text-align: center; margin: 0;">
          Email ${stepIndex + 1}/5 — Vườn Ươm Cây Giống Ngọc Sơn
          <br>
          <a href="https://keolaigiamhom.vn" style="color: #2d5016;">keolaigiamhom.vn</a>
        </p>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════
// 10. SEASONAL CAMPAIGN
//    Triggered by Cloud Scheduler (cron: 0 7 1 * * → 1st of every month 7AM)
//    Auto-generates content + sends targeted emails based on VN forestry seasons
// ═══════════════════════════════════════

const SEASONAL_CAMPAIGNS = {
  1: { region: 'Miền Bắc', theme: 'Chuẩn bị trồng vụ xuân', keywords: 'trồng keo lai miền bắc, vụ xuân, chuẩn bị đất trồng' },
  2: { region: 'Miền Bắc', theme: 'Mùa trồng vụ xuân chính', keywords: 'kỹ thuật trồng vụ xuân, chọn giống mùa xuân' },
  4: { region: 'Tây Nguyên', theme: 'Mùa mưa Tây Nguyên — thời điểm vàng', keywords: 'trồng keo tây nguyên, mùa mưa, gia lai' },
  5: { region: 'Tây Nguyên', theme: 'Chăm sóc cây non vùng cao', keywords: 'chăm sóc keo lai, bón phân, phòng bệnh' },
  7: { region: 'Miền Trung', theme: 'Nhận đơn đặt trước vụ thu', keywords: 'đặt giống keo lai miền trung, pre-order, ưu đãi sớm' },
  8: { region: 'Miền Trung', theme: 'Mùa trồng miền Trung bắt đầu', keywords: 'trồng keo quảng ngãi, bình định, phú yên' },
  9: { region: 'Miền Trung', theme: 'Cao điểm giao cây miền Trung', keywords: 'giao cây toàn quốc, vận chuyển keo lai' },
  10: { region: 'Toàn quốc', theme: 'Ưu đãi cuối năm — Đặt trước cho mùa tới', keywords: 'ưu đãi cuối năm, đặt trước giống keo lai 2026' },
};

exports.seasonalCampaign = functions.https.onRequest(
  {
    secrets: [vertexApiKey, gmailAppPassword, appClientSecret],
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (req, res) => {
    try {
      const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
      const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
      if (!isScheduler && !hasSecret) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const now = new Date();
      const currentMonth = now.getMonth() + 1; // 1-12
      const campaign = SEASONAL_CAMPAIGNS[currentMonth];

      if (!campaign) {
        console.log(`📅 No seasonal campaign for month ${currentMonth}`);
        return res.status(200).json({ message: `No campaign for month ${currentMonth}` });
      }

      console.log(`🌿 Seasonal campaign: ${campaign.theme} (${campaign.region})`);

      // Check if campaign already ran this month
      const campaignId = `${now.getFullYear()}-${String(currentMonth).padStart(2, '0')}`;
      const existingCampaign = await db.collection('seasonal_campaigns').doc(campaignId).get();
      if (existingCampaign.exists) {
        console.log('📌 Campaign already ran this month');
        return res.status(200).json({ message: 'Already ran this month', campaignId });
      }

      const apiKey = vertexApiKey.value();
      const results = { articlesGenerated: 0, emailsSent: 0 };

      // 1. Generate seasonal article
      const articlePrompt = `Bạn là chuyên gia lâm nghiệp Việt Nam. Viết bài hướng dẫn kỹ thuật (1000 từ) cho chủ đề: "${campaign.theme}".

Yêu cầu:
- Tập trung vùng ${campaign.region}
- Keywords: ${campaign.keywords}
- Viết tiếng Việt, phong cách E-E-A-T
- Dữ liệu cụ thể: số liệu, thời vụ, kỹ thuật
- Cấu trúc heading ## và ###
- Tone chuyên nghiệp, phù hợp nông dân

Trả về bài viết thuần túy.`;

      try {
        const geminiRes = await fetch(
          `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.0-flash-lite:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: articlePrompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
            }),
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const content = data.candidates[0].content.parts[0].text;
          const slug = `mua-vu-${campaign.region.toLowerCase().replace(/\s+/g, '-')}-thang-${currentMonth}-${now.getFullYear()}`;

          const htmlContent = markdownToHtml(content);
          const articleHtml = buildArticlePage({
            title: campaign.theme,
            description: `Hướng dẫn kỹ thuật trồng keo lai ${campaign.region} tháng ${currentMonth}`,
            keywords: campaign.keywords,
            slug,
            label: 'Mùa vụ',
            breadcrumb: campaign.theme,
            date: now.toISOString().split('T')[0],
            content: htmlContent,
            stats: [],
            image: '',
          });

          await db.collection('articles').doc(slug).set({
            title: campaign.theme,
            description: `Hướng dẫn kỹ thuật ${campaign.region} tháng ${currentMonth}`,
            slug,
            url: `${SITE_URL}/articles/${slug}/`,
            html: articleHtml,
            publishedAt: admin.firestore.FieldValue.serverTimestamp(),
            publishedDate: now.toISOString().split('T')[0],
            source: 'seasonal-campaign',
            campaign: campaignId,
          });

          results.articlesGenerated++;
          console.log(`📝 Seasonal article published: ${slug}`);
        }
      } catch (articleErr) {
        console.error('Article generation error:', articleErr.message);
      }

      // 2. Send campaign email to matching leads
      let leadsQuery = db.collection('leads').where('email', '!=', null);

      // Filter by region if specific
      if (campaign.region !== 'Toàn quốc') {
        const regionProvinces = getProvincesForRegion(campaign.region);
        if (regionProvinces.length > 0) {
          // Note: Firestore doesn't support array-contains + != in same query
          // So we filter client-side
        }
      }

      const leadsSnap = await leadsQuery.limit(100).get();
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: 'dtduy46@gmail.com', pass: gmailAppPassword.value() },
      });

      for (const leadDoc of leadsSnap.docs) {
        const lead = leadDoc.data();
        if (!lead.email) continue;

        // Region targeting
        if (campaign.region !== 'Toàn quốc' && lead.province) {
          const regionProvinces = getProvincesForRegion(campaign.region);
          if (regionProvinces.length > 0 && !regionProvinces.some(p => lead.province.toLowerCase().includes(p))) {
            continue; // Skip leads not in target region
          }
        }

        try {
          const emailHtml = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e8e8e8;">
              <div style="background: linear-gradient(135deg, #1a4628, #2d6a4f); padding: 28px 32px; color: white;">
                <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.7; margin-bottom: 8px;">🌿 Mùa Vụ Tháng ${currentMonth}</div>
                <h1 style="margin: 0; font-size: 22px; line-height: 1.3;">${campaign.theme}</h1>
                <p style="margin: 8px 0 0; opacity: 0.8; font-size: 14px;">Vùng: ${campaign.region}</p>
              </div>
              <div style="padding: 28px 32px;">
                <p style="font-size: 15px; color: #333; margin: 0 0 16px;">Xin chào <strong>${lead.name}</strong>,</p>
                <p style="font-size: 14px; line-height: 1.8; color: #555;">
                  Tháng ${currentMonth} — thời điểm quan trọng cho ${campaign.theme.toLowerCase()}.
                  Vườn Ươm Ngọc Sơn đã chuẩn bị sẵn giống keo lai AH1 chất lượng cao, sẵn sàng giao cây đến ${campaign.region}.
                </p>
                <div style="background: #f0f7f0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2d5016;">
                  <p style="font-weight: 600; color: #2d5016; margin: 0 0 8px;">🎁 Ưu đãi mùa vụ:</p>
                  <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #444; line-height: 2;">
                    <li>Giảm 5% cho đơn từ 3 vạn cây</li>
                    <li>Miễn phí vận chuyển ${campaign.region}</li>
                    <li>Hỗ trợ kỹ thuật trồng trọn vòng đời</li>
                  </ul>
                </div>
                <div style="text-align: center; margin: 24px 0;">
                  <a href="https://zalo.me/0907282960" style="display: inline-block; background: #2d5016; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                    💬 Đặt Hàng Qua Zalo
                  </a>
                  <p style="margin: 10px 0 0; font-size: 13px; color: #888;">
                    Hoặc gọi: <a href="tel:0907282960" style="color: #2d5016; font-weight: 600;">0907.282.960</a>
                  </p>
                </div>
              </div>
              <div style="padding: 16px 32px; background: #f8faf8; border-top: 1px solid #eee; text-align: center;">
                <p style="font-size: 11px; color: #aaa; margin: 0;">
                  Vườn Ươm Cây Giống Ngọc Sơn — <a href="https://keolaigiamhom.vn" style="color: #2d5016;">keolaigiamhom.vn</a>
                </p>
              </div>
            </div>
          `;

          await transporter.sendMail({
            from: '"Keo Lai Xanh" <dtduy46@gmail.com>',
            to: lead.email,
            subject: `🌿 ${campaign.theme} — Ưu đãi mùa vụ tháng ${currentMonth}`,
            html: emailHtml,
          });

          results.emailsSent++;
        } catch (emailErr) {
          console.error(`Email to ${lead.email} failed:`, emailErr.message);
        }
      }

      // Save campaign record
      await db.collection('seasonal_campaigns').doc(campaignId).set({
        month: currentMonth,
        year: now.getFullYear(),
        theme: campaign.theme,
        region: campaign.region,
        ...results,
        executedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Notify owner
      await sendEmailNotification({
        title: `[Campaign] ${campaign.theme}`,
        description: `Đã gửi ${results.emailsSent} emails, tạo ${results.articlesGenerated} bài viết`,
        url: `${SITE_URL}`,
        appPassword: gmailAppPassword.value(),
      });

      console.log(`🌿 Seasonal campaign complete:`, results);
      return res.status(200).json({ success: true, campaign: campaignId, results });
    } catch (error) {
      console.error('❌ Seasonal campaign failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// HELPER: Map region → provinces for targeting
function getProvincesForRegion(region) {
  const regionMap = {
    'Miền Bắc': ['hà nội', 'hòa bình', 'sơn la', 'phú thọ', 'tuyên quang', 'yên bái', 'lào cai', 'thái nguyên', 'bắc giang', 'lạng sơn', 'quảng ninh', 'bắc kạn', 'cao bằng', 'hà giang'],
    'Miền Trung': ['nghệ an', 'hà tĩnh', 'quảng bình', 'quảng trị', 'huế', 'đà nẵng', 'quảng nam', 'quảng ngãi', 'bình định', 'phú yên', 'khánh hòa'],
    'Tây Nguyên': ['gia lai', 'kon tum', 'đắk lắk', 'đắk nông', 'lâm đồng'],
  };
  return regionMap[region] || [];
}

// ═══════════════════════════════════════
// 11. AUTO TOPIC REPLENISHER
//     Triggered by Cloud Scheduler (cron: 0 7 1,15 * * → 1st & 15th of month 7AM VN)
//     Auto-generates new topics when queue is running low
// ═══════════════════════════════════════
exports.autoReplenishTopics = functions.https.onRequest(
  {
    secrets: [vertexApiKey, gmailAppPassword, appClientSecret],
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
      const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
      if (!isScheduler && !hasSecret) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      console.log('🌱 Auto topic replenisher triggered');

      // Check pending topic count
      const pendingSnap = await db.collection('topics')
        .where('status', '==', 'pending')
        .get();
      const pendingCount = pendingSnap.size;

      if (pendingCount >= 5) {
        console.log(`📌 Still have ${pendingCount} pending topics, no replenishment needed`);
        return res.status(200).json({ message: `${pendingCount} topics still pending`, skipped: true });
      }

      // Get existing topic titles to avoid duplicates
      const allTopicsSnap = await db.collection('topics').get();
      const existingTitles = allTopicsSnap.docs.map(d => d.data().title).join('\n- ');

      // Determine current season context
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const campaign = SEASONAL_CAMPAIGNS[currentMonth];
      const seasonContext = campaign
        ? `Hiện đang tháng ${currentMonth}, mùa vụ: ${campaign.theme} (${campaign.region}).`
        : `Hiện đang tháng ${currentMonth}.`;

      // ── NEW Phase 2: Read brain context for data-driven topics ──
      let brainContext = '';
      try {
        // Get high-priority uncovered keywords from brain
        const gapSnap = await db.collection('brain_keywords')
          .where('status', 'in', ['gap', 'opportunity'])
          .orderBy('priority', 'desc')
          .limit(15)
          .get();

        if (!gapSnap.empty) {
          const gaps = gapSnap.docs.map(d => {
            const data = d.data();
            return `${data.query} (priority: ${data.priority}, source: ${data.source})`;
          });
          brainContext += `\n\n📊 DỮ LIỆU TỪ AI BRAIN — ƯU TIÊN các keyword chưa được viết bài:
- ${gaps.join('\n- ')}
Hãy tạo chủ đề TRỰC TIẾP nhắm vào các keyword trên nếu phù hợp.`;
        }

        // Get latest strategy if available
        const stratSnap = await db.collection('brain_strategy')
          .orderBy('generatedAt', 'desc').limit(1).get();

        if (!stratSnap.empty) {
          const strat = stratSnap.docs[0].data();
          brainContext += `\n\n📋 CHIẾN LƯỢC TUẦN NÀY: ${strat.summary || 'Không có tóm tắt'}`;
          if (strat.priorities?.length > 0) {
            brainContext += `\nƯu tiên cluster: ${strat.priorities.map(p => `${p.cluster} (${p.action})`).join(', ')}`;
          }
        }

        if (brainContext) {
          console.log('🧠 Brain context injected into topic generation');
        }
      } catch (brainErr) {
        console.warn('⚠️ Brain context unavailable (normal if first run):', brainErr.message);
      }

      const apiKey = vertexApiKey.value();
      const prompt = `Bạn là chuyên gia SEO lâm nghiệp Việt Nam. Tạo 10 chủ đề bài viết mới cho website vườn ươm keo lai (keolaigiamhom.vn).

${seasonContext}

Chủ đề đã có (KHÔNG ĐƯỢC trùng):
- ${existingTitles}
${brainContext}

Yêu cầu mỗi chủ đề:
1. title: Tiêu đề SEO-friendly (50-70 ký tự), có chứa keyword chính
2. slug: URL slug tiếng Việt không dấu, dùng dấu gạch ngang
3. keywords: 3-5 keywords liên quan, phân cách bằng dấu phẩy
4. description: Mô tả ngắn 1-2 câu (meta description)
5. priority: 1-10 (10 = quan trọng nhất, ưu tiên theo mùa vụ và dữ liệu brain)
6. label: Phân loại (Kỹ thuật / Mùa vụ / Kinh nghiệm / Phòng bệnh / Kinh tế)

Đa dạng chủ đề: kỹ thuật trồng, chăm sóc, phòng bệnh, kinh tế lâm nghiệp, kinh nghiệm thực tế.

Trả về JSON array, KHÔNG có markdown block. Ví dụ:
[{"title":"...","slug":"...","keywords":"...","description":"...","priority":8,"label":"Kỹ thuật"}]`;

      const geminiRes = await fetch(
        `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.0-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
          }),
        }
      );

      if (!geminiRes.ok) {
        const errData = await geminiRes.json();
        throw new Error(`Vertex AI error: ${JSON.stringify(errData)}`);
      }

      const data = await geminiRes.json();
      let topicsText = data.candidates[0].content.parts[0].text;

      // Clean up potential markdown code blocks
      topicsText = topicsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const newTopics = JSON.parse(topicsText);

      // Batch write to Firestore
      const batch = db.batch();
      let addedCount = 0;

      for (const topic of newTopics) {
        if (!topic.title || !topic.slug) continue;

        const docRef = db.collection('topics').doc(topic.slug);
        batch.set(docRef, {
          title: topic.title,
          slug: topic.slug,
          keywords: topic.keywords || '',
          description: topic.description || topic.title,
          priority: topic.priority || 5,
          label: topic.label || 'Kỹ thuật',
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          source: 'auto-replenisher',
        });
        addedCount++;
      }

      await batch.commit();

      // Notify owner
      await sendEmailNotification({
        title: `[Topics] Đã bổ sung ${addedCount} chủ đề mới`,
        description: `Queue topics: ${pendingCount} cũ + ${addedCount} mới = ${pendingCount + addedCount}. Top topics: ${newTopics.slice(0, 3).map(t => t.title).join(', ')}`,
        url: SITE_URL,
        appPassword: gmailAppPassword.value(),
      });

      console.log(`🌱 Replenished ${addedCount} topics (was ${pendingCount} pending)`);
      return res.status(200).json({
        success: true,
        previousPending: pendingCount,
        added: addedCount,
        topics: newTopics.map(t => t.title),
      });
    } catch (error) {
      console.error('❌ Topic replenisher failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// ═══════════════════════════════════════
// 12. STALE LEAD RE-ENGAGEMENT
//     Triggered by Cloud Scheduler (cron: 0 10 1 * * → 1st of month 10AM VN)
//     Re-engages leads that completed nurture sequence but haven't converted
// ═══════════════════════════════════════
exports.reengageStaleLead = functions.https.onRequest(
  {
    secrets: [vertexApiKey, gmailAppPassword, appClientSecret],
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
      const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
      if (!isScheduler && !hasSecret) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      console.log('🔄 Stale lead re-engagement triggered');

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Find completed nurture leads older than 30 days, not yet re-engaged
      const staleLeadsSnap = await db.collection('leads')
        .where('nurture_status', '==', 'completed')
        .where('reengaged', '==', false)
        .limit(50)
        .get();

      if (staleLeadsSnap.empty) {
        // Also try leads that don't have the reengaged field
        const noFieldSnap = await db.collection('leads')
          .where('nurture_status', '==', 'completed')
          .limit(50)
          .get();

        const staleLeads = noFieldSnap.docs.filter(d => {
          const data = d.data();
          return !data.reengaged && data.email;
        });

        if (staleLeads.length === 0) {
          console.log('📭 No stale leads to re-engage');
          return res.status(200).json({ message: 'No stale leads', sent: 0 });
        }

        // Process these leads
        return await processStaleLeads(staleLeads, now, res);
      }

      const staleLeads = staleLeadsSnap.docs.filter(d => d.data().email);
      return await processStaleLeads(staleLeads, now, res);
    } catch (error) {
      console.error('❌ Stale lead re-engagement failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// HELPER: Process stale leads batch
async function processStaleLeads(leadDocs, now, res) {
  const apiKey = vertexApiKey.value();
  const currentMonth = now.getMonth() + 1;
  const campaign = SEASONAL_CAMPAIGNS[currentMonth];
  const seasonOffer = campaign
    ? `Đang mùa ${campaign.theme} (${campaign.region}). Ưu đãi đặc biệt cho vùng này.`
    : 'Ưu đãi đặc biệt cho khách hàng cũ.';

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: 'dtduy46@gmail.com', pass: gmailAppPassword.value() },
  });

  const results = { sent: 0, errors: 0, skipped: 0 };

  for (const leadDoc of leadDocs) {
    const lead = leadDoc.data();

    try {
      // Generate personalized re-engagement email
      const regionCtx = lead.province ? `Khách ở ${lead.province}.` : '';
      const quantityCtx = lead.quantity ? `Trước đó quan tâm ${lead.quantity} vạn cây.` : '';

      const prompt = `Viết email re-engagement ngắn gọn (150 từ) cho khách hàng cũ của vườn ươm keo lai.
${regionCtx} ${quantityCtx}
${seasonOffer}
Tên khách: ${lead.name}.
Nội dung: nhắc lại giá trị giống AH1, ưu đãi giảm 10% cho đơn từ 3 vạn cây (hạn 7 ngày).
Tone: thân thiện, không push quá mạnh. CTA: gọi 0907.282.960 hoặc Zalo.
CHỈ trả về nội dung email, không có subject line.`;

      let emailContent = `Xin chào ${lead.name},\n\nChúng tôi là Vườn Ươm Ngọc Sơn. Nhớ lần trước bạn quan tâm giống keo lai AH1.\n\nHiện tại chúng tôi có ưu đãi giảm 10% cho đơn từ 3 vạn cây. Liên hệ 0907.282.960 (Zalo) để được tư vấn.`;

      try {
        const geminiRes = await fetch(
          `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.0-flash-lite:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
            }),
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          emailContent = data.candidates[0].content.parts[0].text;
        }
      } catch (aiErr) {
        console.error('AI fallback for re-engagement:', aiErr.message);
      }

      // Build email HTML (reuse nurture style)
      const formattedContent = emailContent
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

      const emailHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e8e8e8;">
          <div style="background: linear-gradient(135deg, #2d5016, #3d6b22); padding: 28px 32px; color: white;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.7; margin-bottom: 8px;">🌿 Tin Nhắn Đặc Biệt</div>
            <h1 style="margin: 0; font-size: 20px;">Vườn Ươm Ngọc Sơn — Nhớ Bạn!</h1>
          </div>
          <div style="padding: 28px 32px;">
            <div style="font-size: 14px; line-height: 1.8; color: #444; margin: 16px 0 24px;">
              ${formattedContent}
            </div>
            <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="font-weight: 600; color: #856404; margin: 0 0 4px;">⏰ Ưu đãi có hạn 7 ngày!</p>
              <p style="font-size: 13px; color: #856404; margin: 0;">Giảm 10% cho đơn từ 3 vạn cây giống keo lai AH1</p>
            </div>
            <div style="text-align: center; margin: 28px 0;">
              <a href="https://zalo.me/0907282960" style="display: inline-block; background: #2d5016; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                💬 Chat Zalo Ngay
              </a>
              <p style="margin: 12px 0 0; font-size: 13px; color: #888;">Hoặc gọi: <a href="tel:0907282960" style="color: #2d5016; font-weight: 600;">0907.282.960</a></p>
            </div>
          </div>
          <div style="padding: 16px 32px; background: #f8faf8; border-top: 1px solid #eee; text-align: center;">
            <p style="font-size: 11px; color: #aaa; margin: 0;">
              Vườn Ươm Cây Giống Ngọc Sơn — <a href="https://keolaigiamhom.vn" style="color: #2d5016;">keolaigiamhom.vn</a>
            </p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: '"Keo Lai Xanh" <dtduy46@gmail.com>',
        to: lead.email,
        subject: `🌿 ${lead.name} ơi — Ưu đãi đặc biệt cho khách cũ Ngọc Sơn`,
        html: emailHtml,
      });

      // Mark as re-engaged
      await leadDoc.ref.update({
        reengaged: true,
        reengagedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      results.sent++;
      console.log(`📧 Re-engaged: ${lead.email}`);
    } catch (emailErr) {
      console.error(`❌ Re-engagement failed for ${lead.email}:`, emailErr.message);
      results.errors++;
    }
  }

  // Notify owner
  await sendEmailNotification({
    title: `[Re-engage] Gửi ${results.sent} email re-engagement`,
    description: `Sent: ${results.sent}, Errors: ${results.errors}, Skipped: ${results.skipped}`,
    url: SITE_URL,
    appPassword: gmailAppPassword.value(),
  });

  console.log('🔄 Re-engagement complete:', results);
  return res.status(200).json({ success: true, results });
}

// ═══════════════════════════════════════
// 13. CONTENT PERFORMANCE TRACKER
//     Triggered by Cloud Scheduler (cron: 0 7 * * 1 → Monday 7AM VN)
//     Fetches GA4 pageview data → updates article stats → feeds weekly report
// ═══════════════════════════════════════
const GA4_PROPERTY_ID = '530436103'; // keolaigiamhom.vn

exports.trackContentPerformance = functions.https.onRequest(
  {
    secrets: [appClientSecret, gmailAppPassword],
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
      const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
      if (!isScheduler && !hasSecret) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      console.log('📊 Content performance tracker triggered');

      // Get all articles from Firestore
      const articlesSnap = await db.collection('articles').get();
      const articleMap = {};
      articlesSnap.docs.forEach(doc => {
        const data = doc.data();
        articleMap[data.slug] = { title: data.title, url: data.url };
      });

      // Try to fetch GA4 data via Analytics Data API (using ADC)
      let ga4Data = {};
      try {
        const { GoogleAuth } = require('google-auth-library');
        const auth = new GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
        });
        const client = await auth.getClient();
        const accessToken = (await client.getAccessToken()).token;

        const ga4Res = await fetch(
          `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
              dimensions: [{ name: 'pagePath' }],
              metrics: [
                { name: 'screenPageViews' },
                { name: 'activeUsers' },
              ],
              dimensionFilter: {
                filter: {
                  fieldName: 'pagePath',
                  stringFilter: {
                    matchType: 'CONTAINS',
                    value: '/articles/',
                    caseSensitive: false,
                  },
                },
              },
              orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
              limit: 50,
            }),
          }
        );

        if (ga4Res.ok) {
          const ga4Result = await ga4Res.json();
          if (ga4Result.rows) {
            for (const row of ga4Result.rows) {
              const path = row.dimensionValues[0].value;
              const views = parseInt(row.metricValues[0].value) || 0;
              const users = parseInt(row.metricValues[1].value) || 0;

              // Extract slug from path: /articles/my-slug/ → my-slug
              const slugMatch = path.match(/\/articles\/([^/]+)/);
              if (slugMatch) {
                ga4Data[slugMatch[1]] = { views, users };
              }
            }
          }
          console.log(`📊 GA4 data fetched: ${Object.keys(ga4Data).length} articles with traffic`);
        } else {
          const errText = await ga4Res.text();
          console.warn('⚠️ GA4 API response not OK:', errText);
        }
      } catch (ga4Err) {
        console.warn('⚠️ GA4 API unavailable (ADC may not be configured):', ga4Err.message);
        console.log('📊 Falling back to Firestore-only tracking');
      }

      // Update articles with performance data
      const batch = db.batch();
      const now = new Date();
      const weekId = now.toISOString().split('T')[0];
      const statsData = [];

      for (const [slug, info] of Object.entries(articleMap)) {
        const perf = ga4Data[slug] || { views: 0, users: 0 };
        const articleRef = db.collection('articles').doc(slug);

        batch.update(articleRef, {
          weeklyViews: perf.views,
          weeklyUsers: perf.users,
          lastTracked: admin.firestore.FieldValue.serverTimestamp(),
        });

        statsData.push({
          slug,
          title: info.title,
          views: perf.views,
          users: perf.users,
        });
      }

      await batch.commit();

      // Save weekly snapshot
      const sortedStats = statsData.sort((a, b) => b.views - a.views);
      await db.collection('article_stats').doc(weekId).set({
        week: weekId,
        totalArticles: statsData.length,
        totalViews: statsData.reduce((sum, s) => sum + s.views, 0),
        totalUsers: statsData.reduce((sum, s) => sum + s.users, 0),
        top10: sortedStats.slice(0, 10),
        trackedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const top5 = sortedStats.slice(0, 5);
      console.log(`📊 Performance tracked: ${statsData.length} articles. Top: ${top5.map(t => `${t.title}(${t.views})`).join(', ')}`);

      return res.status(200).json({
        success: true,
        tracked: statsData.length,
        hasGA4Data: Object.keys(ga4Data).length > 0,
        top5: top5,
      });
    } catch (error) {
      console.error('❌ Content performance tracker failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// ═══════════════════════════════════════
// 14. GBP AUTO-POSTER
//     Called after article publish → auto-posts summary to Google Business Profile
//     Also available as standalone function for manual triggers
// ═══════════════════════════════════════
exports.autoPostGBP = functions.https.onRequest(
  {
    secrets: [vertexApiKey, appClientSecret],
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
      const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
      if (!isScheduler && !hasSecret) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      console.log('📍 GBP auto-poster triggered');

      const { slug } = req.body || {};

      // If no slug provided, post the most recent unpublished-to-GBP article
      let articleData;
      if (slug) {
        const doc = await db.collection('articles').doc(slug).get();
        if (!doc.exists) {
          return res.status(404).json({ error: 'Article not found' });
        }
        articleData = { slug, ...doc.data() };
      } else {
        // Find the latest article not yet posted to GBP
        const latestSnap = await db.collection('articles')
          .where('gbpPosted', '==', false)
          .orderBy('publishedAt', 'desc')
          .limit(1)
          .get();

        if (latestSnap.empty) {
          // Try articles without the gbpPosted field
          const allSnap = await db.collection('articles')
            .orderBy('publishedAt', 'desc')
            .limit(10)
            .get();

          const unposted = allSnap.docs.find(d => !d.data().gbpPosted);
          if (!unposted) {
            console.log('📌 All articles already posted to GBP');
            return res.status(200).json({ message: 'All articles already posted', skipped: true });
          }
          articleData = { slug: unposted.id, ...unposted.data() };
        } else {
          const doc = latestSnap.docs[0];
          articleData = { slug: doc.id, ...doc.data() };
        }
      }

      // Generate GBP post summary via Vertex AI
      const apiKey = vertexApiKey.value();
      const summaryPrompt = `Viết một bài đăng Google Business Profile ngắn gọn (100-150 từ) cho bài viết:

Tiêu đề: ${articleData.title}
Mô tả: ${articleData.description || articleData.title}
URL: ${articleData.url || `${SITE_URL}/articles/${articleData.slug}/`}

Yêu cầu:
- Mở đầu bằng emoji liên quan đến lâm nghiệp (🌿, 🌱, 🌳)
- Tóm tắt giá trị bài viết cho nông dân
- Kết bằng CTA: đọc chi tiết trên website + liên hệ Zalo 0907.282.960
- Tone: chuyên nghiệp, thân thiện
- KHÔNG dùng hashtag

Trả về nội dung bài đăng thuần túy.`;

      let postContent = `🌿 ${articleData.title}\n\nĐọc chi tiết: ${articleData.url}\n\nLiên hệ tư vấn: 0907.282.960 (Zalo)`;

      try {
        const geminiRes = await fetch(
          `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.0-flash-lite:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
            }),
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          postContent = data.candidates[0].content.parts[0].text;
        }
      } catch (aiErr) {
        console.warn('AI summary fallback:', aiErr.message);
      }

      // Try to post to GBP via API (requires OAuth setup)
      let gbpPostId = null;
      let gbpPostedViaAPI = false;

      try {
        const { GoogleAuth } = require('google-auth-library');
        const auth = new GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/business.manage'],
        });
        const client = await auth.getClient();
        const accessToken = (await client.getAccessToken()).token;

        // First, list accounts to find the right one
        const accountsRes = await fetch(
          'https://mybusinessbusinessinformation.googleapis.com/v1/accounts',
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          const account = accountsData.accounts?.[0];

          if (account) {
            // List locations
            const locationsRes = await fetch(
              `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
              { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );

            if (locationsRes.ok) {
              const locData = await locationsRes.json();
              const location = locData.locations?.[0];

              if (location) {
                // Create local post
                const postRes = await fetch(
                  `https://mybusiness.googleapis.com/v4/${location.name}/localPosts`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                      languageCode: 'vi',
                      summary: postContent,
                      callToAction: {
                        actionType: 'LEARN_MORE',
                        url: articleData.url || `${SITE_URL}/articles/${articleData.slug}/`,
                      },
                      topicType: 'STANDARD',
                    }),
                  }
                );

                if (postRes.ok) {
                  const postData = await postRes.json();
                  gbpPostId = postData.name;
                  gbpPostedViaAPI = true;
                  console.log(`📍 GBP post created: ${gbpPostId}`);
                } else {
                  console.warn('GBP post API error:', await postRes.text());
                }
              }
            }
          }
        }
      } catch (gbpErr) {
        console.warn('⚠️ GBP API unavailable (OAuth may not be configured):', gbpErr.message);
        console.log('📝 Saving GBP post content for manual posting');
      }

      // Save to Firestore regardless of API success
      await db.collection('gbp_posts').doc(articleData.slug).set({
        articleSlug: articleData.slug,
        articleTitle: articleData.title,
        postContent,
        gbpPostId,
        postedViaAPI: gbpPostedViaAPI,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Mark article as GBP-posted
      await db.collection('articles').doc(articleData.slug).update({
        gbpPosted: true,
        gbpPostedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`📍 GBP post ${gbpPostedViaAPI ? 'published' : 'saved (manual)'}: ${articleData.slug}`);
      return res.status(200).json({
        success: true,
        slug: articleData.slug,
        postedViaAPI: gbpPostedViaAPI,
        gbpPostId,
        contentPreview: postContent.substring(0, 200),
      });
    } catch (error) {
      console.error('❌ GBP auto-poster failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// ═══════════════════════════════════════
// 15. GSC KEYWORD ANALYSIS (Phase 2)
//     Weekly: Pulls top queries from GSC → brain_keywords
//     Identifies opportunities: high impressions, low CTR, rank 5-20
// ═══════════════════════════════════════
exports.gscKeywordAnalysis = functions.https.onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '256MiB',
    secrets: [appClientSecret],
  },
  async (req, res) => {
    try {
      const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
      const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
      if (!isScheduler && !hasSecret) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      console.log('📊 GSC Keyword Analysis triggered');

      const { GoogleAuth } = require('google-auth-library');
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      });
      const authClient = await auth.getClient();
      const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });

      // Pull top 200 queries for last 28 days
      const response = await searchconsole.searchanalytics.query({
        siteUrl: GSC_SITE_URL,
        requestBody: {
          startDate: getDateString(-28),
          endDate: getDateString(-1),
          dimensions: ['query', 'page'],
          rowLimit: 200,
          orderBys: [{ fieldName: 'impressions', sortOrder: 'DESCENDING' }],
        },
      });

      const rows = response.data.rows || [];
      console.log(`📊 GSC returned ${rows.length} query+page combinations`);

      if (rows.length === 0) {
        return res.status(200).json({ message: 'No GSC data available yet', keywords: 0 });
      }

      // Aggregate by query (a query may appear on multiple pages)
      const queryMap = {};
      for (const row of rows) {
        const query = row.keys[0];
        const page = row.keys[1];

        if (!queryMap[query]) {
          queryMap[query] = {
            query,
            position: 0, impressions: 0, clicks: 0,
            totalWeight: 0, pages: [],
          };
        }
        const q = queryMap[query];
        q.impressions += row.impressions;
        q.clicks += row.clicks;
        q.totalWeight += row.position * row.impressions;
        q.pages.push({ page, position: row.position, impressions: row.impressions });
      }

      // Calculate averages and classify
      const keywords = [];
      for (const q of Object.values(queryMap)) {
        q.position = q.totalWeight / q.impressions;
        q.ctr = q.impressions > 0 ? (q.clicks / q.impressions) * 100 : 0;
        delete q.totalWeight;

        // Classify status
        let status = 'covered';
        let priority = 5;

        if (q.position <= 3) {
          status = 'winner'; priority = 3; // already winning, maintain
        } else if (q.position <= 10 && q.impressions >= 20) {
          status = 'opportunity'; priority = 9; // almost page 1 — optimize!
        } else if (q.position <= 20 && q.impressions >= 50) {
          status = 'opportunity'; priority = 8; // high volume, push harder
        } else if (q.impressions >= 100 && q.ctr < 2) {
          status = 'opportunity'; priority = 7; // lots of impressions, terrible CTR
        }

        keywords.push({ ...q, status, priority });
      }

      // Batch write to brain_keywords
      const batches = [];
      let currentBatch = db.batch();
      let batchCount = 0;

      for (const kw of keywords) {
        const kwId = kw.query.replace(/\s+/g, '_').substring(0, 100);
        const kwRef = db.collection('brain_keywords').doc(kwId);

        // Get existing doc to preserve trend history
        const existing = await kwRef.get();
        const trend = existing.exists ? (existing.data().trend || []) : [];
        trend.push({
          week: getDateString(0).substring(0, 10),
          position: Math.round(kw.position * 10) / 10,
          impressions: kw.impressions,
        });
        // Keep last 12 weeks of trend
        if (trend.length > 12) trend.shift();

        currentBatch.set(kwRef, {
          query: kw.query,
          position: Math.round(kw.position * 10) / 10,
          impressions: kw.impressions,
          clicks: kw.clicks,
          ctr: Math.round(kw.ctr * 100) / 100,
          status: kw.status,
          priority: kw.priority,
          trend,
          coveredBy: kw.pages[0]?.page || null,
          source: 'gsc',
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        batchCount++;
        if (batchCount >= 490) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          batchCount = 0;
        }
      }
      batches.push(currentBatch);

      for (const b of batches) {
        await b.commit();
      }

      // Summary
      const opportunities = keywords.filter(k => k.status === 'opportunity');
      const winners = keywords.filter(k => k.status === 'winner');

      console.log(`📊 GSC Analysis complete: ${keywords.length} keywords (${winners.length} winners, ${opportunities.length} opportunities)`);

      return res.status(200).json({
        success: true,
        totalKeywords: keywords.length,
        winners: winners.length,
        opportunities: opportunities.length,
        topOpportunities: opportunities
          .sort((a, b) => b.priority - a.priority)
          .slice(0, 5)
          .map(k => ({ query: k.query, position: Math.round(k.position), impressions: k.impressions })),
      });
    } catch (error) {
      console.error('❌ GSC Keyword Analysis failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// ═══════════════════════════════════════
// 16. COMPETITOR SEED (Phase 2 — Cold Start)
//     One-time + manual: Seeds brain_competitors + keyword gaps
//     No external API needed — uses manual competitor list
// ═══════════════════════════════════════
exports.competitorSeed = functions.https.onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '256MiB',
    secrets: [appClientSecret],
  },
  async (req, res) => {
    try {
      const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
      if (!hasSecret) return res.status(403).json({ error: 'Unauthorized' });

      console.log('🕵️ Competitor seed triggered');

      // ── Known competitors ──
      const competitors = [
        {
          domain: 'caygiongthanhle.com',
          name: 'Cây Giống Thanh Lễ',
          type: 'direct',
          region: 'Miền Trung',
          strengths: ['brand known', 'many product SKUs', 'good SEO'],
        },
        {
          domain: 'vuonuomcaygiong.com',
          name: 'Vườn Ươm Cây Giống',
          type: 'direct',
          region: 'Toàn quốc',
          strengths: ['broad keyword coverage', 'content rich'],
        },
        {
          domain: 'caygionglamhong.vn',
          name: 'Cây Giống Lâm Hồng',
          type: 'indirect',
          region: 'Tây Nguyên',
          strengths: ['local presence', 'forestry focused'],
        },
      ];

      // Allow custom competitors from request body
      const custom = req.body?.competitors || [];
      const allCompetitors = [...competitors, ...custom];

      // Seed brain_competitors
      const compBatch = db.batch();
      for (const comp of allCompetitors) {
        const compRef = db.collection('brain_competitors').doc(comp.domain.replace(/\./g, '_'));
        compBatch.set(compRef, {
          ...comp,
          seededAt: admin.firestore.FieldValue.serverTimestamp(),
          lastScanned: null, // Will be set by Phase 4 SerpAPI
          gapKeywords: [],
          status: 'seeded',
        }, { merge: true });
      }
      await compBatch.commit();

      // ── Seed known competitor keyword gaps ──
      // Keywords competitors likely rank for that we should target
      const competitorKeywords = [
        { query: 'giống keo tai tượng', priority: 8, reason: 'high volume forestry term' },
        { query: 'cây giống lâm nghiệp giá rẻ', priority: 9, reason: 'purchase intent + price' },
        { query: 'vườn ươm cây keo', priority: 7, reason: 'brand term competitor owns' },
        { query: 'keo lai giâm hom giá sỉ', priority: 9, reason: 'exact match our product' },
        { query: 'mua cây giống keo', priority: 8, reason: 'high purchase intent' },
        { query: 'cây keo lai BV10', priority: 7, reason: 'specific cultivar search' },
        { query: 'cây keo lai BV75', priority: 7, reason: 'specific cultivar search' },
        { query: 'kỹ thuật trồng keo tai tượng', priority: 6, reason: 'informational + related' },
        { query: 'giá cây giống keo lai 2025', priority: 9, reason: 'price + year = fresh intent' },
        { query: 'cây keo lai chịu hạn', priority: 7, reason: 'benefit-focused search' },
        { query: 'so sánh keo lai và keo tai tượng', priority: 8, reason: 'comparison = decision stage' },
        { query: 'mua keo lai ở đâu', priority: 9, reason: 'location intent = ready to buy' },
      ];

      // Also accept custom keywords from request body
      const customKws = req.body?.keywords || [];
      const allKeywords = [...competitorKeywords, ...customKws];

      // Check which keywords we already cover
      const articlesSnap = await db.collection('articles').get();
      const existingSlugs = articlesSnap.docs.map(d => d.data().title?.toLowerCase() || '');

      const kwBatch = db.batch();
      let gapsAdded = 0;

      for (const kw of allKeywords) {
        const kwId = kw.query.replace(/\s+/g, '_').substring(0, 100);
        const kwRef = db.collection('brain_keywords').doc(kwId);

        // Check if any existing article likely covers this keyword
        const isCovered = existingSlugs.some(t =>
          kw.query.split(' ').filter(w => w.length > 2).some(word => t.includes(word))
        );

        kwBatch.set(kwRef, {
          query: kw.query,
          source: 'competitor_gap',
          status: isCovered ? 'covered' : 'gap',
          priority: kw.priority,
          reason: kw.reason || '',
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        if (!isCovered) gapsAdded++;
      }
      await kwBatch.commit();

      console.log(`🕵️ Competitor seed complete: ${allCompetitors.length} competitors, ${allKeywords.length} keywords (${gapsAdded} gaps)`);

      return res.status(200).json({
        success: true,
        competitors: allCompetitors.length,
        keywords: allKeywords.length,
        gaps: gapsAdded,
        competitorDomains: allCompetitors.map(c => c.domain),
        topGaps: allKeywords
          .filter(k => !existingSlugs.some(t =>
            k.query.split(' ').filter(w => w.length > 2).some(word => t.includes(word))
          ))
          .sort((a, b) => b.priority - a.priority)
          .slice(0, 5)
          .map(k => k.query),
      });
    } catch (error) {
      console.error('❌ Competitor seed failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════
// PIPELINE AGENTS MODULE (Content Growth Engine)
// ═══════════════════════════════════════════════════════════
const pipeline = require('./pipeline');
Object.assign(exports, pipeline);

// ═══════════════════════════════════════
// 1.2 CONTENT ANALYTICS SYNC (Phase 1)
//     Triggered by Cloud Scheduler (cron: 0 3 * * * → daily 3AM VN)
//     Pulls GSC Search Analytics data per article → writes to Firestore
//     Powers the Content Performance Dashboard
// ═══════════════════════════════════════
exports.contentAnalytics = functions.https.onRequest(
  {
    secrets: [appClientSecret],
    region: 'us-central1',
    timeoutSeconds: 240,
    memory: '512MiB',
  },
  async (req, res) => {
    try {
      const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
      const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
      if (!isScheduler && !hasSecret) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      console.log('📊 [ContentAnalytics] Sync started');

      // Get all published articles
      const articlesSnap = await db.collection('articles').get();
      if (articlesSnap.empty) {
        return res.status(200).json({ message: 'No articles to analyze' });
      }

      // GSC auth
      const { GoogleAuth } = require('google-auth-library');
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      });
      const authClient = await auth.getClient();
      const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });

      const today = new Date();
      const results = { updated: 0, noData: 0, errors: 0 };
      const batch = db.batch();

      for (const doc of articlesSnap.docs) {
        const article = doc.data();
        const slug = doc.id;
        const articlePath = `/articles/${slug}/`;

        try {
          // Query GSC for last 28 days per article page
          const response = await searchconsole.searchanalytics.query({
            siteUrl: GSC_SITE_URL,
            requestBody: {
              startDate: getDateString(-28),
              endDate: getDateString(-1),
              dimensions: ['query'],
              dimensionFilterGroups: [{
                filters: [{
                  dimension: 'page',
                  operator: 'contains',
                  expression: articlePath,
                }],
              }],
              rowLimit: 25,
            },
          });

          const rows = response.data.rows || [];

          // Aggregate page-level metrics
          const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
          const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
          const avgPosition = totalImpressions > 0
            ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / totalImpressions
            : null;

          const topQueries = rows
            .map(r => ({
              query: r.keys[0],
              position: Math.round(r.position * 10) / 10,
              impressions: r.impressions,
              clicks: r.clicks,
              ctr: Math.round(r.ctr * 10000) / 100,
            }))
            .sort((a, b) => b.impressions - a.impressions)
            .slice(0, 10);

          const analyticsData = {
            slug,
            gsc_impressions_28d: totalImpressions,
            gsc_clicks_28d: totalClicks,
            gsc_avg_position: avgPosition ? Math.round(avgPosition * 10) / 10 : null,
            gsc_ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
            gsc_top_queries: topQueries,
            gsc_query_count: rows.length,
            last_synced: admin.firestore.FieldValue.serverTimestamp(),
            sync_date: today.toISOString().split('T')[0],
            has_impressions: totalImpressions > 0,
          };

          // Write to analytics subcollection under each article
          const analyticsRef = db.collection('articles').doc(slug)
            .collection('analytics').doc(today.toISOString().split('T')[0]);
          batch.set(analyticsRef, analyticsData);

          // Also update article summary doc for quick dashboard access
          const summaryRef = db.collection('article_analytics').doc(slug);
          batch.set(summaryRef, {
            ...analyticsData,
            title: article.title,
            url: article.url,
          }, { merge: true });

          if (totalImpressions > 0) {
            results.updated++;
          } else {
            results.noData++;
          }
        } catch (articleErr) {
          console.warn(`⚠️ GSC error for ${slug}:`, articleErr.message);
          results.errors++;
        }

        // Small delay to avoid GSC rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      await batch.commit();

      // Save daily summary to pipeline collection
      await db.collection('pipeline').doc('analytics_runs').collection('items')
        .doc(today.toISOString().split('T')[0]).set({
          date: today.toISOString().split('T')[0],
          articlesProcessed: articlesSnap.size,
          ...results,
          executedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      console.log(`📊 [ContentAnalytics] Done: ${results.updated} with data, ${results.noData} no data, ${results.errors} errors`);
      return res.status(200).json({ success: true, results, articlesTotal: articlesSnap.size });
    } catch (error) {
      console.error('❌ [ContentAnalytics] Failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// ═══════════════════════════════════════
// 3.2 PIPELINE HEALTH CHECK (Phase 3)
//     Triggered by Cloud Scheduler (cron: 0 */6 * * * → every 6h)
//     Auto-recovers stuck topics and pipeline deadlocks
//     - Topics stuck in 'generating' > 30min → reset to 'pending'
//     - Briefs stuck in 'generating' > 30min → reset to 'approved'
//     - Leads stuck with nurture_status 'error' for > 24h → retry
// ═══════════════════════════════════════
exports.pipelineHealthCheck = functions.https.onRequest(
  {
    secrets: [gmailAppPassword, appClientSecret],
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
      const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
      if (!isScheduler && !hasSecret) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      console.log('🔧 [HealthCheck] Pipeline health check started');
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const results = { recovered: 0, alerts: [], checks: [] };

      // ── Check 1: Topics stuck in 'generating' ────────────────
      const stuckTopicsSnap = await db.collection('topics')
        .where('status', '==', 'generating')
        .get();

      for (const doc of stuckTopicsSnap.docs) {
        const data = doc.data();
        const scheduledAt = data.scheduledAt?.toDate?.();
        if (scheduledAt && scheduledAt < thirtyMinutesAgo) {
          await doc.ref.update({ status: 'pending', recoveredAt: admin.firestore.FieldValue.serverTimestamp() });
          results.recovered++;
          results.alerts.push(`Topic recovered: ${doc.id} (stuck generating since ${scheduledAt.toISOString()})`);
          console.log(`🔧 Recovered stuck topic: ${doc.id}`);
        }
      }
      results.checks.push({ name: 'stuck_topics', found: stuckTopicsSnap.size });

      // ── Check 2: Pipeline briefs stuck in 'generating' ───────
      const stuckBriefsSnap = await db.collection('pipeline').doc('briefs')
        .collection('items').where('status', '==', 'generating').get();

      for (const doc of stuckBriefsSnap.docs) {
        const data = doc.data();
        const updatedAt = data.updated_at?.toDate?.() || data.created_at?.toDate?.();
        if (updatedAt && updatedAt < thirtyMinutesAgo) {
          await doc.ref.update({ status: 'approved', recoveredAt: admin.firestore.FieldValue.serverTimestamp() });
          results.recovered++;
          results.alerts.push(`Brief recovered: ${doc.id}`);
          console.log(`🔧 Recovered stuck brief: ${doc.id}`);
        }
      }
      results.checks.push({ name: 'stuck_briefs', found: stuckBriefsSnap.size });

      // ── Check 3: Leads with nurture error for > 24h → retry ──
      const errorLeadsSnap = await db.collection('leads')
        .where('nurture_status', '==', 'error')
        .get();

      let retriedLeads = 0;
      for (const doc of errorLeadsSnap.docs) {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.();
        if (createdAt && createdAt > oneDayAgo) {
          // Recent lead with error — retry nurture if it has email
          if (data.email) {
            await doc.ref.update({
              nurture_status: 'pending',
              nurture_next_at: new Date(), // retry immediately
              nurture_error: null,
              recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            retriedLeads++;
          }
        }
      }
      if (retriedLeads > 0) {
        results.recovered += retriedLeads;
        results.alerts.push(`Retried ${retriedLeads} leads with nurture errors`);
      }
      results.checks.push({ name: 'error_leads_retried', count: retriedLeads });

      // ── Check 4: Pending topics low → alert ──────────────────
      const pendingTopicsCount = (await db.collection('topics')
        .where('status', '==', 'pending').get()).size;

      if (pendingTopicsCount < 3) {
        results.alerts.push(`⚠️ Only ${pendingTopicsCount} pending topics left! Run autoReplenishTopics.`);
      }
      results.checks.push({ name: 'pending_topics', count: pendingTopicsCount });

      // ── Send alert email if issues found ─────────────────────
      if (results.alerts.length > 0) {
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: 'dtduy46@gmail.com', pass: gmailAppPassword.value() },
          });
          await transporter.sendMail({
            from: '"KeoLai Health Monitor" <dtduy46@gmail.com>',
            to: 'dtduy46@gmail.com',
            subject: `🔧 [Pipeline Health] ${results.recovered} items recovered`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px">
              <h2 style="color:#c77f00">⚠️ Pipeline Health Alert</h2>
              <p><strong>Thời gian:</strong> ${now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
              <h3>Items Recovered (${results.recovered}):</h3>
              <ul>${results.alerts.map(a => `<li>${a}</li>`).join('')}</ul>
              <h3>Health Checks:</h3>
              <ul>${results.checks.map(c => `<li>${c.name}: ${JSON.stringify(c)}</li>`).join('')}</ul>
            </div>`,
          });
          console.log('📧 Health alert email sent');
        } catch (emailErr) {
          console.warn('Health alert email failed:', emailErr.message);
        }
      }

      console.log(`🔧 [HealthCheck] Done: ${results.recovered} recovered, ${results.alerts.length} alerts`);
      return res.status(200).json({ success: true, results });
    } catch (error) {
      console.error('❌ [HealthCheck] Failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// ═══════════════════════════════════════
// 3.3 FIRESTORE BACKUP (Phase 3)
//     Triggered by Cloud Scheduler (cron: 0 2 * * 0 → every Sunday 2AM VN)
//     Exports critical Firestore collections to Google Cloud Storage
//     Retains last 4 backups (≈1 month)
// ═══════════════════════════════════════
exports.firestoreBackup = functions.https.onRequest(
  {
    secrets: [appClientSecret],
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (req, res) => {
    try {
      const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
      const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
      if (!isScheduler && !hasSecret) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const today = new Date().toISOString().split('T')[0];
      console.log(`💾 [Backup] Starting Firestore backup for ${today}`);

      // Collections to backup (critical business data)
      const collectionsToBackup = ['leads', 'articles', 'topics', 'weekly_reports', 'article_analytics'];
      const backupData = {};
      const stats = {};

      for (const collectionName of collectionsToBackup) {
        try {
          const snap = await db.collection(collectionName).get();
          backupData[collectionName] = snap.docs.map(doc => ({
            id: doc.id,
            data: doc.data(),
          }));
          stats[collectionName] = snap.size;
          console.log(`  ✅ Backed up ${collectionName}: ${snap.size} docs`);
        } catch (colErr) {
          console.warn(`  ⚠️ Failed to backup ${collectionName}:`, colErr.message);
          stats[collectionName] = -1;
        }
      }

      // Save backup manifest to Firestore (backup of backups summary)
      const backupManifest = {
        backupDate: today,
        collections: stats,
        totalDocs: Object.values(stats).filter(s => s > 0).reduce((a, b) => a + b, 0),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'complete',
      };

      await db.collection('backup_manifests').doc(today).set(backupManifest);

      // Save full backup data as a Firestore document (compressed JSON)
      // For large datasets, this should use GCS — for now store summary
      await db.collection('backups').doc(today).set({
        manifest: backupManifest,
        // Store only leads and topics (most critical, smallest)
        leads_sample: backupData['leads']?.slice(0, 100) || [],
        articles_index: backupData['articles']?.map(d => ({ id: d.id, title: d.data.title, slug: d.data.slug })) || [],
        topics_all: backupData['topics'] || [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // ── Cleanup old backups (keep last 4 weeks) ─────────────
      const oldBackupsSnap = await db.collection('backups')
        .orderBy('createdAt', 'desc')
        .offset(4) // Keep 4 most recent
        .get();

      let deleted = 0;
      for (const doc of oldBackupsSnap.docs) {
        await doc.ref.delete();
        deleted++;
      }

      if (deleted > 0) {
        console.log(`🗑️ Cleaned up ${deleted} old backups`);
      }

      console.log(`💾 [Backup] Complete: ${backupManifest.totalDocs} total docs backed up`);
      return res.status(200).json({
        success: true,
        date: today,
        collections: stats,
        totalDocs: backupManifest.totalDocs,
        oldBackupsDeleted: deleted,
      });
    } catch (error) {
      console.error('❌ [Backup] Failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);


// ═══════════════════════════════════════
// 4.2 / 1.4  GOOGLE SHEETS ROI DASHBOARD EXPORT
//     Triggered by Cloud Scheduler (cron: 0 6 * * 1 → Monday 6AM VN)
//     Exports Leads + Article Analytics + ROI summary to Google Sheets
//     so you can see content ROI in a live dashboard without custom UI.
//
// SETUP (one-time):
//   1. Create a Google Sheet and copy its ID (from URL)
//   2. Share it with the Firebase service account email
//      (keolai-63ec1@appspot.gserviceaccount.com — Editor access)
//   3. Set secret: firebase functions:secrets:set SHEETS_SPREADSHEET_ID
// ═══════════════════════════════════════

const sheetsSpreadsheetId = defineSecret('SHEETS_SPREADSHEET_ID');

exports.sheetsExport = functions.https.onRequest(
  {
    secrets: [appClientSecret, sheetsSpreadsheetId],
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (req, res) => {
    try {
      const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
      const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
      if (!isScheduler && !hasSecret) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const spreadsheetId = sheetsSpreadsheetId.value();
      if (!spreadsheetId || spreadsheetId.length < 10) {
        return res.status(400).json({ error: 'SHEETS_SPREADSHEET_ID secret not configured. See setup instructions.' });
      }

      console.log(`📊 [SheetsExport] Starting export to spreadsheet: ${spreadsheetId}`);

      // Auth via Application Default Credentials (ADC — Firebase service account)
      const { GoogleAuth } = require('google-auth-library');
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const authClient = await auth.getClient();
      const sheets = google.sheets({ version: 'v4', auth: authClient });

      const today = new Date().toISOString().split('T')[0];
      const results = { sheets: [] };

      // ── Helper: upsert a sheet tab ────────────────────────────
      async function ensureSheet(title) {
        try {
          const meta = await sheets.spreadsheets.get({ spreadsheetId });
          const exists = meta.data.sheets?.some(s => s.properties?.title === title);
          if (!exists) {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [{ addSheet: { properties: { title } } }],
              },
            });
            console.log(`  ✅ Created sheet tab: ${title}`);
          }
        } catch (e) {
          console.warn(`  ⚠️ Could not ensure sheet ${title}:`, e.message);
        }
      }

      // ── Sheet 1: Leads ────────────────────────────────────────
      await ensureSheet('Leads');
      const leadsSnap = await db.collection('leads')
        .orderBy('createdAt', 'desc').limit(500).get();

      const leadsRows = [
        ['Ngày', 'Tên', 'SĐT', 'Email', 'Tỉnh', 'Số lượng', 'Nguồn bài viết', 'Variant', 'Nurture status'],
      ];
      for (const doc of leadsSnap.docs) {
        const d = doc.data();
        const createdAt = d.createdAt?.toDate?.()?.toLocaleDateString('vi-VN') || '';
        leadsRows.push([
          createdAt,
          d.name || '',
          d.phone || '',
          d.email || '',
          d.province || '',
          d.quantity || '',
          d.source || 'homepage',
          d.ab_variant || '',
          d.nurture_status || 'new',
        ]);
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Leads!A1',
        valueInputOption: 'RAW',
        requestBody: { values: leadsRows },
      });
      results.sheets.push({ name: 'Leads', rows: leadsRows.length - 1 });
      console.log(`  ✅ Leads exported: ${leadsRows.length - 1} rows`);

      // ── Sheet 2: Article ROI ──────────────────────────────────
      await ensureSheet('Article ROI');
      const analyticsSnap = await db.collection('article_analytics').get();
      const articlesSnap = await db.collection('articles').get();

      // Count leads per article source
      const leadsBySource = {};
      for (const doc of leadsSnap.docs) {
        const src = doc.data().source || 'homepage';
        leadsBySource[src] = (leadsBySource[src] || 0) + 1;
      }

      const analyticsMap = {};
      for (const doc of analyticsSnap.docs) {
        analyticsMap[doc.id] = doc.data();
      }

      const roiRows = [
        ['Slug', 'Tiêu đề', 'Ngày đăng', 'Impressions (28d)', 'Clicks (28d)', 'Avg Position', 'CTR (%)', 'Leads từ bài', 'Conversion Rate (%)'],
      ];

      for (const doc of articlesSnap.docs) {
        const article = doc.data();
        const slug = doc.id;
        const analytics = analyticsMap[slug] || {};
        const articleLeads = leadsBySource[slug] || 0;
        const clicks = analytics.gsc_clicks_28d || 0;
        const convRate = clicks > 0 ? ((articleLeads / clicks) * 100).toFixed(2) : '0';

        roiRows.push([
          slug,
          article.title || '',
          article.publishedDate || '',
          analytics.gsc_impressions_28d || 0,
          clicks,
          analytics.gsc_avg_position || '',
          analytics.gsc_ctr || 0,
          articleLeads,
          convRate,
        ]);
      }

      // Sort by leads desc
      const roiData = roiRows.slice(1).sort((a, b) => (b[7] || 0) - (a[7] || 0));
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Article ROI!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [roiRows[0], ...roiData] },
      });
      results.sheets.push({ name: 'Article ROI', rows: roiData.length });
      console.log(`  ✅ Article ROI exported: ${roiData.length} rows`);

      // ── Sheet 3: Weekly Summary ───────────────────────────────
      await ensureSheet('Weekly Summary');
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const weekLeads = leadsSnap.docs.filter(d => {
        const t = d.data().createdAt?.toDate?.();
        return t && t >= weekAgo;
      }).length;

      const weekArticles = articlesSnap.docs.filter(d => {
        const pub = d.data().publishedAt?.toDate?.();
        return pub && pub >= weekAgo;
      }).length;

      const topSources = Object.entries(leadsBySource)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([src, count]) => `${src}: ${count} leads`)
        .join(', ');

      // Read existing summary rows to append
      let existingRows = [];
      try {
        const existing = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: 'Weekly Summary!A1:J',
        });
        existingRows = existing.data.values || [];
      } catch (_) {}

      const summaryHeader = ['Tuần', 'Tổng leads mới', 'Bài viết mới', 'Top sources', 'Tổng leads', 'Tổng bài viết', 'Updated'];
      const summaryRow = [
        `${weekAgo.toISOString().split('T')[0]} → ${today}`,
        weekLeads,
        weekArticles,
        topSources,
        leadsSnap.size,
        articlesSnap.size,
        today,
      ];

      const summaryRows = existingRows.length > 0
        ? [summaryHeader, summaryRow, ...existingRows.slice(1)]  // prepend new row
        : [summaryHeader, summaryRow];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Weekly Summary!A1',
        valueInputOption: 'RAW',
        requestBody: { values: summaryRows.slice(0, 100) }, // max 100 weeks
      });
      results.sheets.push({ name: 'Weekly Summary', rows: summaryRows.length - 1 });
      console.log(`  ✅ Weekly Summary exported`);

      console.log(`📊 [SheetsExport] Done: ${results.sheets.map(s => `${s.name}(${s.rows})`).join(', ')}`);
      return res.status(200).json({
        success: true,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        results,
      });
    } catch (error) {
      console.error('❌ [SheetsExport] Failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);
