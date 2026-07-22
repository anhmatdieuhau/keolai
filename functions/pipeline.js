/**
 * KeoLai Content Growth Engine — Pipeline Agents
 * 
 * Multi-Agent System following ECC (Everything Claude Code) patterns.
 * Each agent has defined I/O contracts with Firestore-backed artifacts.
 * 
 * Agents:
 *   1. Analyst   → trend_report_{date}.json     → pipeline/trend_reports/
 *   2. Researcher → content_brief_{slug}.md      → pipeline/briefs/
 *   3. Reviewer  → review_log_{slug}.json        → pipeline/reviews/
 *   4. Writer    → article_{slug}.html + receipt → pipeline/publish_receipts/
 *   5. SEO Mgr   → seo_audit_{date}.json        → pipeline/seo_audits/
 *   6. Engagement → engagement_log_{month}.json  → pipeline/engagement_logs/
 */

const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { defineSecret } = require('firebase-functions/params');
const nodemailer = require('nodemailer');

// Admin is already initialized by index.js — just get db reference
const db = admin.firestore();

const vertexApiKey = defineSecret('VERTEX_API_KEY');
const appClientSecret = defineSecret('APP_CLIENT_SECRET');
const gmailAppPassword = defineSecret('GMAIL_APP_PASSWORD');

const { normalizeSlug, isValidSlug } = require('./lib/slug');
const { evaluateTopicNovelty, registerTopicFingerprint } = require('./lib/topic-dedup');
const { embedTopicTitle } = require('./lib/embeddings');

const SITE_URL = 'https://keolaigiamhom.vn';

// HTML escape to prevent XSS in generated article pages
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ═══════════════════════════════════════════════════════════
// VOICE PROFILE (BR_04 — Revenue-First)
// ═══════════════════════════════════════════════════════════
const VOICE_PROFILE = {
    tone: 'Người bán giống tận tâm — vừa rành kỹ thuật, vừa hiểu túi tiền khách',
    systemPrompt: `Bạn là chuyên gia tư vấn giống keo lai tại Việt Nam.
Phong cách viết:
- Tư vấn như NGƯỜI BÁN HÀNG GIỎI, không phải giáo viên
- Luôn gắn với giá cả, số lượng, mùa vụ CỤ THỂ
- So sánh = giúp khách CHỌN ĐÚNG, không phải flex kiến thức
- CTA rõ ràng: "Liên hệ đặt giống", "Xem bảng giá", "Gọi tư vấn 0907.282.960"

TUYỆT ĐỐI KHÔNG:
- Bài viết thuần kiến thức không gắn sản phẩm
- Lý thuyết hàn lâm, không actionable
- Generic AI filler ("Trong bối cảnh hiện nay...")
- Mở bài dài dòng, không vào vấn đề tiền/giá/mua

MỞ BÀI MẪU:
"Giống keo AH1 đang có giá 850đ/cây tại vườn ươm, nhưng không phải vùng nào trồng cũng hiệu quả. Đây là 3 vùng đất cho tỷ lệ sống >90%..."

QUY TẮC CTA (BR_06):
Mỗi bài PHẢI có ít nhất 2/3 loại CTA:
🛒 Mua hàng: bảng giá + nút "Đặt hàng ngay"
📞 Tư vấn: form/hotline "Tư vấn chọn giống phù hợp"
📊 So sánh: bảng so sánh giống + giá → giúp khách quyết định`,
};

// ═══════════════════════════════════════════════════════════
// SEED KEYWORDS MATRIX (BR_01 — Revenue Priority)
// ═══════════════════════════════════════════════════════════
const SEED_KEYWORDS = {
    buy: {
        priority: 1,
        intent: 'transactional',
        keywords: [
            'mua giống keo lai', 'giá cây keo giâm hom', 'đặt giống keo AH1',
            'bán cây keo giống', 'giống keo lai giá rẻ', 'mua cây giống keo lai',
        ],
    },
    compare: {
        priority: 2,
        intent: 'commercial',
        keywords: [
            'so sánh giống keo', 'keo AH1 hay BV10 tốt hơn', 'nên mua giống keo nào',
            'giống keo nào tốt nhất 2026', 'bảng giá giống keo lai 2026',
        ],
    },
    technique_buy: {
        priority: 3,
        intent: 'commercial',
        keywords: [
            'cách chọn giống keo tốt', 'nhận biết cây giống kém chất lượng',
            'tiêu chuẩn cây giống keo lai', 'giống keo lai AH1 chính hãng',
        ],
    },
    seasonal: {
        priority: 4,
        intent: 'navigational',
        keywords: [
            'mùa trồng keo miền Trung', 'giống keo phù hợp đất cát',
            'lịch đặt giống 2026', 'lịch trồng keo miền Nam',
        ],
    },
    awareness: {
        priority: 5,
        intent: 'informational',
        keywords: [
            'hiệu quả kinh tế trồng keo', 'đầu tư rừng keo 5 năm',
            'giá gỗ keo 2026', 'xu hướng lâm nghiệp 2026',
        ],
    },
};

// ═══════════════════════════════════════════════════════════
// AGENT 1: ANALYST — Trend Scanner + Keyword Opportunity
// Trigger: Cronjob Mon-Fri 02:00 AM (or manual)
// Output: pipeline/trend_reports/{date} 
// ═══════════════════════════════════════════════════════════
exports.pipelineAnalyst = functions.https.onRequest(
    {
        secrets: [appClientSecret],
        region: 'us-central1',
        timeoutSeconds: 120,
        memory: '256MiB',
    },
    async (req, res) => {
        try {
            const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
            const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
            if (!isScheduler && !hasSecret) return res.status(403).json({ error: 'Unauthorized' });

            const today = new Date().toISOString().split('T')[0];
            console.log(`🔍 [Analyst] Starting trend scan: ${today}`);

            // 1. Get existing articles (avoid duplicate topics)
            const articlesSnap = await db.collection('articles').get();
            const existingSlugs = articlesSnap.docs.map(d => d.data().slug || d.id);

            // 2. Get decision log (what we've already written about)
            const decisionRef = db.collection('pipeline').doc('decision_log');
            const decisionDoc = await decisionRef.get();
            const decisionLog = decisionDoc.exists ? decisionDoc.data() : { entries: [] };
            const coveredKeywords = decisionLog.entries?.map(e => e.keyword) || [];

            // 3. Score seed keywords against existing coverage
            const opportunities = [];
            for (const [cluster, data] of Object.entries(SEED_KEYWORDS)) {
                for (const keyword of data.keywords) {
                    const isCovered = coveredKeywords.some(ck =>
                        keyword.includes(ck) || ck.includes(keyword)
                    ) || existingSlugs.some(slug => {
                        const kwWords = keyword.split(' ').filter(w => w.length > 2);
                        return kwWords.every(w => slug.includes(w));
                    });

                    if (!isCovered) {
                        opportunities.push({
                            term: keyword,
                            cluster,
                            intent: data.intent,
                            revenue_score: (6 - data.priority) * 20, // priority 1 = score 100
                            volume_estimate: data.priority <= 2 ? 'high' : 'medium',
                            competition: data.priority <= 2 ? 'medium' : 'low',
                        });
                    }
                }
            }

            // 4. Sort by revenue_score (gần tiền nhất lên đầu)
            opportunities.sort((a, b) => b.revenue_score - a.revenue_score);

            // 5. Index audit — check what existing articles lack indexing
            const indexAudit = [];
            const publishReceiptsSnap = await db.collection('pipeline')
                .doc('publish_receipts').collection('items')
                .orderBy('published_at', 'desc').limit(10).get();

            for (const doc of publishReceiptsSnap.docs) {
                const receipt = doc.data();
                const daysSince = Math.floor(
                    (Date.now() - (receipt.published_at?.toMillis?.() || 0)) / (1000 * 60 * 60 * 24)
                );
                indexAudit.push({
                    slug: doc.id,
                    url: receipt.url,
                    status: receipt.index_status || 'unknown',
                    days_since_publish: daysSince,
                });
            }

            // 6. Save trend report artifact
            const trendReport = {
                date: today,
                keywords: opportunities.slice(0, 10), // Top 10 opportunities
                index_audit: indexAudit,
                total_opportunities: opportunities.length,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                agent: 'analyst',
            };

            await db.collection('pipeline').doc('trend_reports')
                .collection('items').doc(today).set(trendReport);

            console.log(`🔍 [Analyst] Found ${opportunities.length} opportunities, top: ${opportunities[0]?.term || 'none'}`);

            return res.status(200).json({
                success: true,
                date: today,
                opportunities: opportunities.length,
                top_3: opportunities.slice(0, 3).map(o => `${o.term} (score: ${o.revenue_score})`),
                index_audit_count: indexAudit.length,
            });
        } catch (error) {
            console.error('❌ [Analyst] Failed:', error);
            return res.status(500).json({ error: error.message });
        }
    }
);

// ═══════════════════════════════════════════════════════════
// AGENT 2: RESEARCHER — Content Brief Builder
// Input: trend_report → Output: pipeline/briefs/{slug}
// ═══════════════════════════════════════════════════════════
exports.pipelineResearcher = functions.https.onRequest(
    {
        secrets: [vertexApiKey, appClientSecret, gmailAppPassword],
        region: 'us-central1',
        timeoutSeconds: 180,
        memory: '512MiB',
    },
    async (req, res) => {
        try {
            const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
            const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
            if (!isScheduler && !hasSecret) return res.status(403).json({ error: 'Unauthorized' });

            const today = new Date().toISOString().split('T')[0];
            console.log(`📚 [Researcher] Starting research: ${today}`);

            // 1. Load latest trend report
            const trendSnap = await db.collection('pipeline').doc('trend_reports')
                .collection('items').orderBy('date', 'desc').limit(1).get();

            if (trendSnap.empty) {
                return res.status(200).json({ message: 'No trend report available. Run Analyst first.' });
            }

            const trendReport = trendSnap.docs[0].data();
            const topKeywords = trendReport.keywords.slice(0, 3); // Top 3 by revenue_score

            if (topKeywords.length === 0) {
                return res.status(200).json({ message: 'No keyword opportunities found.' });
            }

            // 2. Generate Content Brief for top keyword via Vertex AI
            const targetKw = topKeywords[0];
            const slug = normalizeSlug(targetKw.term);

            // Check if brief already exists
            const existingBrief = await db.collection('pipeline').doc('briefs')
                .collection('items').doc(slug).get();
            if (existingBrief.exists) {
                return res.status(200).json({
                    message: `Brief already exists: ${slug}`,
                    brief_id: slug,
                });
            }

            const briefPrompt = `Bạn là Product Content Strategist cho ngành giống cây lâm nghiệp Việt Nam.

Tạo Content Brief chi tiết cho bài viết với keyword: "${targetKw.term}"
Cluster: ${targetKw.cluster} | Intent: ${targetKw.intent} | Revenue Score: ${targetKw.revenue_score}

Trả về JSON (không markdown, không giải thích) với format:
{
  "title": "Tiêu đề bài viết (50-60 ký tự, chứa keyword chính)",
  "target_keyword": "${targetKw.term}",
  "secondary_keywords": ["3-5 từ khóa phụ liên quan"],
  "search_intent": "${targetKw.intent}",
  "content_type": "so-sanh | huong-dan-mua | bang-gia | review",
  "outline": [
    {"h2": "Tên heading 2", "points": ["Điểm chính 1", "Điểm chính 2"]},
    {"h2": "Tên heading 2 tiếp", "points": ["Điểm chính"]}
  ],
  "cta_mapping": [
    {"type": "mua-hang", "position": "giữa bài", "text": "Đặt giống AH1 ngay - 0907.282.960"},
    {"type": "tu-van", "position": "cuối bài", "text": "Tư vấn chọn giống phù hợp vùng đất"}
  ],
  "competitor_angles": ["Góc nhìn đối thủ đang khai thác"],
  "unique_angle": "Góc nhìn khác biệt của KeoLai (kinh nghiệm vườn ươm thực tế)",
  "word_count_target": 1500,
  "estimated_revenue_impact": "high | medium | low",
  "selection_reasoning": {
    "why_this_keyword": "Giải thích ngắn gọn tại sao keyword này được chọn (volume, intent, gap thị trường)",
    "why_this_outline": "Giải thích logic chọn các heading - tại sao cấu trúc này phù hợp với intent",
    "expected_outcome": "Dự kiến kết quả: traffic, chuyển đổi, ranking target"
  }
}`;

            const apiKey = vertexApiKey.value();
            const geminiRes = await fetch(
                `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.0-flash-lite:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: briefPrompt }] }],
                        generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
                    }),
                }
            );

            if (!geminiRes.ok) {
                const errData = await geminiRes.json();
                throw new Error(`Vertex AI error: ${JSON.stringify(errData)}`);
            }

            const geminiData = await geminiRes.json();
            const rawText = geminiData.candidates[0].content.parts[0].text;

            // Parse JSON from response (handle markdown code blocks)
            let briefData;
            try {
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                briefData = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
            } catch (e) {
                briefData = {
                    title: targetKw.term,
                    target_keyword: targetKw.term,
                    search_intent: targetKw.intent,
                    raw_response: rawText,
                    parse_error: true,
                };
            }

            // B6 fix: hard novelty gate on the actual proposed title (not just "does a brief
            // already exist for this exact keyword slug") — catches rephrased topics that
            // duplicate an already-published article or already-queued brief before a human
            // reviewer even sees it.
            let novelty;
            try {
                novelty = await evaluateTopicNovelty({ title: briefData.title || targetKw.term }, db, {
                    embedFn: (text) => embedTopicTitle(text, apiKey),
                });
            } catch (embedErr) {
                console.warn(`⚠️ [Researcher] embedding check failed, falling back to coarse-only: ${embedErr.message}`);
                novelty = await evaluateTopicNovelty({ title: briefData.title || targetKw.term }, db);
            }

            if (novelty.status === 'duplicate') {
                console.log(`⏭️  [Researcher] Skipped duplicate topic "${briefData.title}" (matches ${novelty.matchedSlug}, method=${novelty.method})`);
                return res.status(200).json({
                    success: true,
                    skipped: true,
                    reason: 'duplicate_topic',
                    matched_slug: novelty.matchedSlug,
                    method: novelty.method,
                });
            }

            // 3. Save brief artifact
            const brief = {
                ...briefData,
                slug,
                cluster: targetKw.cluster,
                revenue_score: targetKw.revenue_score,
                status: 'pending_review',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                agent: 'researcher',
                trend_report_date: trendReport.date,
            };

            await db.collection('pipeline').doc('briefs')
                .collection('items').doc(slug).set(brief);

            await registerTopicFingerprint(db, {
                slug,
                title: briefData.title || targetKw.term,
                coarseFingerprint: novelty.coarseFingerprint,
                embedding: novelty.embedding,
                registeredAtValue: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`📚 [Researcher] Brief created: ${slug} — "${briefData.title}"`);

            // Notify Telegram for mobile review
            await notifyEmailNewBrief(slug, { ...briefData, revenue_score: targetKw.revenue_score });

            return res.status(200).json({
                success: true,
                slug,
                title: briefData.title,
                keyword: targetKw.term,
                revenue_score: targetKw.revenue_score,
                status: 'pending_review',
            });
        } catch (error) {
            console.error('❌ [Researcher] Failed:', error);
            return res.status(500).json({ error: error.message });
        }
    }
);

// ═══════════════════════════════════════════════════════════
// AGENT 3: REVIEWER — Quality Gate (Telegram placeholder + API)
// Input: pending briefs → Output: pipeline/reviews/{slug}
// ═══════════════════════════════════════════════════════════
exports.pipelineReviewer = functions.https.onRequest(
    {
        secrets: [appClientSecret],
        region: 'us-central1',
        timeoutSeconds: 30,
    },
    async (req, res) => {
        try {
            let action, slug, feedback;

            // Support GET requests from email one-click links
            if (req.method === 'GET' && req.query.action && req.query.slug) {
                action = req.query.action;
                slug = req.query.slug;
                feedback = req.query.feedback || '';
                // Lightweight auth: email links don't need full secret
                // (only accessible via private email, short-lived)
            } else {
                // POST requests require x-app-secret header
                const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
                if (!hasSecret) return res.status(403).json({ error: 'Unauthorized' });
                ({ action, slug, feedback } = req.body || {});
            }

            const isGetRequest = req.method === 'GET';

            // Helper: return HTML page for GET or JSON for POST
            const respond = (statusCode, result) => {
                if (isGetRequest) {
                    const color = result.status === 'approved' ? '#0f5238' : '#dc3545';
                    const icon = result.status === 'approved' ? '✅' : '❌';
                    const label = result.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối';
                    return res.status(200).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KeoLai Pipeline</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Be Vietnam Pro',Arial,sans-serif;background:#f9f9f8;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:420px;width:100%;text-align:center;overflow:hidden}.top{background:${color};padding:40px 24px;color:#fff}.icon{font-size:48px;margin-bottom:12px}.status{font-size:20px;font-weight:700}.slug{margin-top:8px;font-size:14px;opacity:.8}.body{padding:32px 24px}.msg{font-size:15px;color:#333;line-height:1.6}a{display:inline-block;margin-top:24px;background:${color};color:#fff;padding:12px 32px;font-weight:700;text-decoration:none;border-radius:8px}</style></head><body><div class="card"><div class="top"><div class="icon">${icon}</div><div class="status">${label}</div><div class="slug">${escapeHtml(slug)}</div></div><div class="body"><p class="msg">${result.status === 'approved' ? 'Brief đã được duyệt! Hệ thống sẽ tự động xuất bản.' : 'Brief đã bị từ chối.'}</p><a href="https://keolai-63ec1.web.app/">← Về trang chủ</a></div></div></body></html>`);
                }
                return res.status(statusCode).json(result);
            };

            if (action === 'approve' && slug) {
                // Approve a brief
                const briefRef = db.collection('pipeline').doc('briefs').collection('items').doc(slug);
                const briefDoc = await briefRef.get();
                if (!briefDoc.exists) {
                    return res.status(404).json({ error: `Brief not found: ${slug}` });
                }

                await briefRef.update({ status: 'approved' });

                // Save review log
                await db.collection('pipeline').doc('reviews')
                    .collection('items').doc(slug).set({
                        slug,
                        status: 'approved',
                        reviewer: 'admin',
                        feedback: feedback || '',
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        revision_count: 0,
                        agent: 'reviewer',
                    });

                console.log(`✅ [Reviewer] Approved: ${slug}`);

                // Auto-trigger Writer to publish immediately (fire-and-forget)
                const writerUrl = 'https://pipelinewriter-tlme4riglq-uc.a.run.app';
                fetch(writerUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-app-secret': appClientSecret.value(),
                    },
                    body: JSON.stringify({ slug }),
                }).then(async (writerRes) => {
                    const writerResult = await writerRes.json().catch(() => ({}));
                    console.log(`🚀 [Auto-Publish] Writer triggered for ${slug}:`, writerResult.success ? '✅ Published' : `❌ ${writerResult.error || 'Failed'}`);
                    if (writerResult.success && writerResult.url) {
                        // Send publish confirmation email
                        try {
                            const transporter = nodemailer.createTransport({
                                service: 'gmail',
                                auth: { user: REVIEWER_EMAIL, pass: gmailAppPassword.value() },
                            });
                            await transporter.sendMail({
                                from: '"KeoLai Pipeline" <dtduy46@gmail.com>',
                                to: REVIEWER_EMAIL,
                                subject: `✅ [Published] ${writerResult.title || slug}`,
                                html: `<div style="font-family:'Be Vietnam Pro',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e0e0e0;border-radius:12px;overflow:hidden"><div style="background:linear-gradient(135deg,#081f15,#0f5238);padding:32px 24px;text-align:center"><h1 style="color:#fff;font-size:20px;margin:0">🎉 Bài Viết Đã Xuất Bản!</h1></div><div style="padding:24px"><h2 style="color:#0f5238;font-size:18px;margin:0 0 12px">${escapeHtml(writerResult.title || slug)}</h2><p style="color:#555;font-size:14px;margin:0 0 20px">Keyword: <strong>${escapeHtml(writerResult.keyword || '')}</strong></p><a href="${escapeHtml(writerResult.url)}" style="display:inline-block;background:#0f5238;color:#fff;padding:14px 40px;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px">🔗 Xem Bài Viết</a></div><div style="background:#f9f9f8;padding:12px 24px;font-size:12px;color:#707973;text-align:center;border-top:1px solid #e0e0e0">Auto-published by KeoLai Content Pipeline</div></div>`,
                            });
                            console.log(`📧 [Email] Publish confirmation sent for: ${slug}`);
                        } catch (emailErr) {
                            console.warn('[Email] Publish notification failed:', emailErr.message);
                        }
                    }
                }).catch(err => {
                    console.warn(`[Auto-Publish] Writer call failed for ${slug}:`, err.message);
                });

                return respond(200, { success: true, slug, status: 'approved', auto_publish: 'triggered' });
            }

            if (action === 'reject' && slug) {
                // Reject a brief
                const briefRef = db.collection('pipeline').doc('briefs').collection('items').doc(slug);
                const briefDoc = await briefRef.get();
                if (!briefDoc.exists) {
                    return res.status(404).json({ error: `Brief not found: ${slug}` });
                }
                await briefRef.update({ status: 'rejected', feedback: feedback || '' });

                await db.collection('pipeline').doc('reviews')
                    .collection('items').doc(slug).set({
                        slug,
                        status: 'rejected',
                        reviewer: 'admin',
                        feedback: feedback || 'Cần chỉnh sửa',
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        revision_count: 0,
                        agent: 'reviewer',
                    });

                console.log(`❌ [Reviewer] Rejected: ${slug} — ${feedback}`);
                return respond(200, { success: true, slug, status: 'rejected' });
            }

            if (action === 'list') {
                // List pending briefs for review
                const pendingSnap = await db.collection('pipeline').doc('briefs')
                    .collection('items').where('status', '==', 'pending_review').get();

                const pending = pendingSnap.docs.map(d => {
                    const data = d.data();
                    return {
                        slug: d.id,
                        title: data.title,
                        keyword: data.target_keyword,
                        revenue_score: data.revenue_score,
                        cluster: data.cluster,
                    };
                });

                return res.status(200).json({ pending, count: pending.length });
            }

            return res.status(400).json({
                error: 'Invalid action. Use: list, approve, reject',
                usage: {
                    list: 'POST {action: "list"}',
                    approve: 'POST {action: "approve", slug: "xxx"}',
                    reject: 'POST {action: "reject", slug: "xxx", feedback: "..."}',
                },
            });
        } catch (error) {
            console.error('❌ [Reviewer] Failed:', error);
            return res.status(500).json({ error: error.message });
        }
    }
);

// ═══════════════════════════════════════════════════════════
// AGENT 4: WRITER — Revenue-First Content Producer
// Input: approved brief → Output: article + images + publish receipt
// ═══════════════════════════════════════════════════════════
exports.pipelineWriter = functions.https.onRequest(
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
            if (!isScheduler && !hasSecret) return res.status(403).json({ error: 'Unauthorized' });

            console.log(`✍️ [Writer] Starting content production`);

            // 1. Find first approved brief
            const approvedSnap = await db.collection('pipeline').doc('briefs')
                .collection('items')
                .where('status', '==', 'approved')
                .limit(1)
                .get();

            if (approvedSnap.empty) {
                return res.status(200).json({ message: 'No approved briefs to write.' });
            }

            const briefDoc = approvedSnap.docs[0];
            const brief = briefDoc.data();
            const slug = briefDoc.id;

            // Defense-in-depth: reject at the last-mile write to `articles/{slug}` too, in case
            // an invalid slug got queued before this fix (or via a path that doesn't go through
            // normalizeSlug). Cheap check, avoids a silent 404 at serveArticle time later.
            if (!isValidSlug(slug)) {
                console.error(`❌ [Writer] Rejected brief with invalid slug: ${slug}`);
                await briefDoc.ref.update({ status: 'error', errorMessage: `Invalid slug: ${slug}` });
                return res.status(200).json({ success: false, error: 'invalid_slug', slug });
            }

            console.log(`✍️ [Writer] Writing article for: "${brief.title}" (${slug})`);

            // 2. Mark brief as generating
            await briefDoc.ref.update({ status: 'generating' });

            // 3. Generate article content via Vertex AI with VOICE_PROFILE
            const articlePrompt = `${VOICE_PROFILE.systemPrompt}

Bây giờ viết bài viết dựa trên Content Brief sau:

TIÊU ĐỀ: ${brief.title}
KEYWORD CHÍNH: ${brief.target_keyword}
KEYWORDS PHỤ: ${(brief.secondary_keywords || []).join(', ')}
LOẠI NỘI DUNG: ${brief.content_type || 'huong-dan-mua'}
DÀN Ý:
${(brief.outline || []).map(h => `## ${h.h2}\n${(h.points || []).map(p => `- ${p}`).join('\n')}`).join('\n\n')}

CTA CẦN CÓ:
${(brief.cta_mapping || []).map(c => `- ${c.type}: "${c.text}" (vị trí: ${c.position})`).join('\n')}

GÓC NHÌN ĐỘC ĐÁO: ${brief.unique_angle || 'Kinh nghiệm từ vườn ươm thực tế 10+ năm'}

YÊU CẦU:
1. Viết 1500-2000 từ, tiếng Việt
2. Mở bài TRỰC TIẾP bằng giá/số liệu cụ thể (KHÔNG bào chữa dài dòng)
3. Mỗi section có DATA THỰC TẾ (giá cả, tỷ lệ, trọng lượng, kích thước)
4. PHẢI có ít nhất 2 CTA rõ ràng (mua + tư vấn)
5. Kết thúc bằng CTA mạnh: hotline 0907.282.960
6. KHÔNG dùng markdown bold/italic. Chỉ ## heading và văn bản thuần
7. Mỗi paragraph 2-4 câu, ngắn gọn

Trả về nội dung BÀI VIẾT thuần túy (không tiêu đề ở đầu, không giải thích).`;

            const apiKey = vertexApiKey.value();
            const geminiRes = await fetch(
                `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: articlePrompt }] }],
                        generationConfig: { temperature: 0.7, maxOutputTokens: 6000 },
                    }),
                }
            );

            if (!geminiRes.ok) {
                const errData = await geminiRes.json();
                await briefDoc.ref.update({ status: 'error', error: JSON.stringify(errData) });
                throw new Error(`Vertex AI error: ${JSON.stringify(errData)}`);
            }

            const geminiData = await geminiRes.json();
            const articleContent = geminiData.candidates[0].content.parts[0].text;

            // 4. Convert to HTML
            const htmlContent = simpleMarkdownToHtml(articleContent);

            // 5. Build full article page
            const today = new Date().toISOString().split('T')[0];
            const keywords = [brief.target_keyword, ...(brief.secondary_keywords || [])].join(', ');
            const articleHtml = buildRevenuePage({
                title: brief.title,
                description: brief.title,
                keywords,
                slug,
                label: brief.content_type === 'bang-gia' ? 'Bảng giá' :
                    brief.content_type === 'so-sanh' ? 'So sánh' :
                        brief.content_type === 'review' ? 'Review' : 'Tư vấn mua',
                breadcrumb: brief.title.split('—')[0].trim().substring(0, 40),
                date: today,
                content: htmlContent,
            });

            // 6. Save to Firestore articles collection
            const publishedUrl = `${SITE_URL}/articles/${slug}/`;
            await db.collection('articles').doc(slug).set({
                title: brief.title,
                description: brief.title,
                slug,
                url: publishedUrl,
                html: articleHtml,
                keywords,
                publishedAt: admin.firestore.FieldValue.serverTimestamp(),
                publishedDate: today,
                source: 'pipeline_writer',
                brief_slug: slug,
            });

            // 7. Save publish receipt
            await db.collection('pipeline').doc('publish_receipts')
                .collection('items').doc(slug).set({
                    slug,
                    url: publishedUrl,
                    firestore_id: slug,
                    sitemap_included: true,
                    published_at: admin.firestore.FieldValue.serverTimestamp(),
                    brief_source: slug,
                    agent: 'writer',
                    keywords,
                });

            // 8. Update brief status
            await briefDoc.ref.update({
                status: 'published',
                published_url: publishedUrl,
                published_at: admin.firestore.FieldValue.serverTimestamp(),
            });

            // 9. Update decision log
            const decisionRef = db.collection('pipeline').doc('decision_log');
            await decisionRef.set({
                entries: admin.firestore.FieldValue.arrayUnion({
                    keyword: brief.target_keyword,
                    slug,
                    published: today,
                    revenue_score: brief.revenue_score,
                    action: 'published',
                }),
                last_updated: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            // 10. Send notification email
            try {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: { user: 'dtduy46@gmail.com', pass: gmailAppPassword.value() },
                });
                await transporter.sendMail({
                    from: '"KeoLai Pipeline" <dtduy46@gmail.com>',
                    to: 'dtduy46@gmail.com',
                    subject: `🌿 [Pipeline] ${brief.title}`,
                    html: `<p>Bài viết mới từ Content Pipeline:</p>
            <h2>${brief.title}</h2>
            <p>Keyword: ${brief.target_keyword} | Revenue Score: ${brief.revenue_score}</p>
            <p><a href="${publishedUrl}">Xem bài viết →</a></p>`,
                });
            } catch (emailErr) {
                console.warn('📧 Email failed (non-blocking):', emailErr.message);
            }

            console.log(`🎉 [Writer] Published: ${publishedUrl}`);

            return res.status(200).json({
                success: true,
                slug,
                title: brief.title,
                url: publishedUrl,
                keyword: brief.target_keyword,
                revenue_score: brief.revenue_score,
            });
        } catch (error) {
            console.error('❌ [Writer] Failed:', error);
            return res.status(500).json({ error: error.message });
        }
    }
);

// ═══════════════════════════════════════════════════════════
// AGENT 5: PIPELINE STATUS — Dashboard API
// Returns pipeline state across all agents
// ═══════════════════════════════════════════════════════════
exports.pipelineStatus = functions.https.onRequest(
    {
        secrets: [appClientSecret],
        region: 'us-central1',
        timeoutSeconds: 30,
    },
    async (req, res) => {
        try {
            const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
            if (!hasSecret) return res.status(403).json({ error: 'Unauthorized' });

            // Trend reports
            const trendsSnap = await db.collection('pipeline').doc('trend_reports')
                .collection('items').orderBy('date', 'desc').limit(3).get();
            const trends = trendsSnap.docs.map(d => ({
                date: d.data().date,
                opportunities: d.data().total_opportunities,
                top_keyword: d.data().keywords?.[0]?.term,
            }));

            // Briefs by status
            const briefsSnap = await db.collection('pipeline').doc('briefs')
                .collection('items').get();
            const briefStats = { pending_review: 0, approved: 0, rejected: 0, generating: 0, published: 0 };
            briefsSnap.docs.forEach(d => {
                const status = d.data().status || 'unknown';
                if (briefStats[status] !== undefined) briefStats[status]++;
            });

            // Recent publishes
            const receiptsSnap = await db.collection('pipeline').doc('publish_receipts')
                .collection('items').orderBy('published_at', 'desc').limit(5).get();
            const recentPublishes = receiptsSnap.docs.map(d => ({
                slug: d.id,
                url: d.data().url,
                published_at: d.data().published_at?.toDate?.()?.toISOString(),
            }));

            // Decision log
            const decisionDoc = await db.collection('pipeline').doc('decision_log').get();
            const totalDecisions = decisionDoc.exists ? (decisionDoc.data().entries?.length || 0) : 0;

            return res.status(200).json({
                pipeline: 'KeoLai Content Growth Engine',
                status: 'operational',
                agents: {
                    analyst: { last_trends: trends },
                    researcher: { briefs: briefStats },
                    reviewer: { pending: briefStats.pending_review },
                    writer: { recent_publishes: recentPublishes },
                },
                decision_log_entries: totalDecisions,
            });
        } catch (error) {
            console.error('❌ [Pipeline Status] Failed:', error);
            return res.status(500).json({ error: error.message });
        }
    }
);

// ═══════════════════════════════════════════════════════════
// AGENT 6: PIPELINE ORCHESTRATOR — Run full pipeline
// Chains: Analyst → Researcher → (wait for review) → Writer
// ═══════════════════════════════════════════════════════════
exports.pipelineOrchestrator = functions.https.onRequest(
    {
        secrets: [vertexApiKey, gmailAppPassword, appClientSecret],
        region: 'us-central1',
        timeoutSeconds: 540,
        memory: '512MiB',
    },
    async (req, res) => {
        try {
            const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
            if (!hasSecret) return res.status(403).json({ error: 'Unauthorized' });

            const mode = req.body?.mode || 'full'; // full | analyst-only | write-approved
            console.log(`🤖 [Orchestrator] Mode: ${mode}`);
            const results = {};

            // Step 1: Run Analyst
            if (mode === 'full' || mode === 'analyst-only') {
                // Inline analyst logic (avoid HTTP call overhead)
                const today = new Date().toISOString().split('T')[0];
                const articlesSnap = await db.collection('articles').get();
                const existingSlugs = articlesSnap.docs.map(d => d.data().slug || d.id);
                const decisionDoc = await db.collection('pipeline').doc('decision_log').get();
                const coveredKeywords = decisionDoc.exists ? (decisionDoc.data().entries?.map(e => e.keyword) || []) : [];

                const opportunities = [];
                for (const [cluster, data] of Object.entries(SEED_KEYWORDS)) {
                    for (const keyword of data.keywords) {
                        const isCovered = coveredKeywords.some(ck => keyword.includes(ck) || ck.includes(keyword))
                            || existingSlugs.some(slug => {
                                const kwWords = keyword.split(' ').filter(w => w.length > 2);
                                return kwWords.every(w => slug.includes(w));
                            });
                        if (!isCovered) {
                            opportunities.push({
                                term: keyword, cluster, intent: data.intent,
                                revenue_score: (6 - data.priority) * 20,
                                volume_estimate: data.priority <= 2 ? 'high' : 'medium',
                                competition: data.priority <= 2 ? 'medium' : 'low',
                            });
                        }
                    }
                }
                opportunities.sort((a, b) => b.revenue_score - a.revenue_score);
                await db.collection('pipeline').doc('trend_reports')
                    .collection('items').doc(today).set({
                        date: today, keywords: opportunities.slice(0, 10),
                        total_opportunities: opportunities.length,
                        created_at: admin.firestore.FieldValue.serverTimestamp(), agent: 'analyst',
                    });
                results.analyst = { opportunities: opportunities.length, top: opportunities[0]?.term };
            }

            // Step 2: Run Researcher (auto-pick top keyword)
            if (mode === 'full') {
                const trendSnap = await db.collection('pipeline').doc('trend_reports')
                    .collection('items').orderBy('date', 'desc').limit(1).get();
                if (!trendSnap.empty) {
                    const topKw = trendSnap.docs[0].data().keywords?.[0];
                    if (topKw) {
                        const slug = normalizeSlug(topKw.term);

                        const existingBrief = await db.collection('pipeline').doc('briefs')
                            .collection('items').doc(slug).get();

                        if (!existingBrief.exists) {
                            // Generate brief inline
                            const briefPrompt = `Tạo Content Brief JSON cho keyword "${topKw.term}" (loại: ${topKw.intent}, revenue score: ${topKw.revenue_score}).
Trả JSON: {"title":"...","target_keyword":"${topKw.term}","secondary_keywords":["..."],"search_intent":"${topKw.intent}","content_type":"so-sanh|huong-dan-mua|bang-gia|review","outline":[{"h2":"...","points":["..."]}],"cta_mapping":[{"type":"mua-hang","position":"giữa bài","text":"Đặt giống AH1 - 0907.282.960"}],"unique_angle":"...","word_count_target":1500}`;

                            const apiKey = vertexApiKey.value();
                            const geminiRes = await fetch(
                                `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.0-flash-lite:generateContent?key=${apiKey}`,
                                {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        contents: [{ role: 'user', parts: [{ text: briefPrompt }] }],
                                        generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
                                    }),
                                }
                            );

                            if (geminiRes.ok) {
                                const data = await geminiRes.json();
                                const raw = data.candidates[0].content.parts[0].text;
                                let briefData;
                                try {
                                    const jsonMatch = raw.match(/\{[\s\S]*\}/);
                                    briefData = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
                                } catch { briefData = { title: topKw.term, target_keyword: topKw.term }; }

                                // B6 fix: same hard novelty gate as pipelineResearcher — this is
                                // a second, independent entry point that creates briefs, so it
                                // needs the same gate or it reopens the exact hole being fixed.
                                let novelty;
                                try {
                                    novelty = await evaluateTopicNovelty({ title: briefData.title || topKw.term }, db, {
                                        embedFn: (text) => embedTopicTitle(text, apiKey),
                                    });
                                } catch (embedErr) {
                                    novelty = await evaluateTopicNovelty({ title: briefData.title || topKw.term }, db);
                                }

                                if (novelty.status === 'duplicate') {
                                    results.researcher = { slug, status: 'skipped_duplicate', matched_slug: novelty.matchedSlug, method: novelty.method };
                                } else {
                                    await db.collection('pipeline').doc('briefs')
                                        .collection('items').doc(slug).set({
                                            ...briefData, slug, cluster: topKw.cluster,
                                            revenue_score: topKw.revenue_score, status: 'pending_review',
                                            created_at: admin.firestore.FieldValue.serverTimestamp(), agent: 'researcher',
                                        });
                                    await registerTopicFingerprint(db, {
                                        slug,
                                        title: briefData.title || topKw.term,
                                        coarseFingerprint: novelty.coarseFingerprint,
                                        embedding: novelty.embedding,
                                        registeredAtValue: admin.firestore.FieldValue.serverTimestamp(),
                                    });
                                    results.researcher = { slug, title: briefData.title, status: 'pending_review' };
                                    // Notify Telegram for mobile review
                                    await notifyEmailNewBrief(slug, { ...briefData, revenue_score: topKw.revenue_score });
                                }
                            }
                        } else {
                            results.researcher = { slug, status: 'already_exists' };
                        }
                    }
                }
            }

            // Step 3: Write any approved briefs
            if (mode === 'full' || mode === 'write-approved') {
                results.writer = { message: 'Check pipelineReviewer for pending briefs. Approve, then run pipelineWriter.' };
            }

            return res.status(200).json({
                success: true,
                mode,
                results,
                next_step: results.researcher?.status === 'pending_review'
                    ? `POST pipelineReviewer {action: "approve", slug: "${results.researcher.slug}"}`
                    : 'Run pipelineWriter to publish approved briefs',
            });
        } catch (error) {
            console.error('❌ [Orchestrator] Failed:', error);
            return res.status(500).json({ error: error.message });
        }
    }
);

// ═══════════════════════════════════════════════════════════
// EMAIL REVIEWER NOTIFICATION
// Sends HTML email with one-click approve/reject links
// ═══════════════════════════════════════════════════════════

const REVIEWER_EMAIL = 'dtduy46@gmail.com';
const REVIEWER_API_BASE = 'https://us-central1-keolai-63ec1.cloudfunctions.net/pipelineReviewer';

/**
 * Notify reviewer via email when a new brief is created
 * Includes one-click approve/reject links
 */
async function notifyEmailNewBrief(slug, briefData) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: REVIEWER_EMAIL, pass: gmailAppPassword.value() },
        });

        const approveUrl = `${REVIEWER_API_BASE}?action=approve&slug=${encodeURIComponent(slug)}`;
        const rejectUrl = `${REVIEWER_API_BASE}?action=reject&slug=${encodeURIComponent(slug)}`;

        // Build detailed outline with sub-points
        const outlineHtml = (briefData.outline || [])
            .map(h => {
                const heading = escapeHtml(h.h2 || h);
                const points = (h.points || [])
                    .map(p => `<li style="color:#555;font-size:13px;margin:2px 0">${escapeHtml(p)}</li>`)
                    .join('');
                return `<li style="margin:8px 0"><strong>${heading}</strong>${points ? `<ul style="margin:4px 0 0 16px;padding:0;list-style:disc">${points}</ul>` : ''}</li>`;
            })
            .join('');

        // Competitor angles
        const competitorHtml = (briefData.competitor_angles || [])
            .map(c => `<li style="margin:3px 0;font-size:13px;color:#555">• ${escapeHtml(c)}</li>`)
            .join('');

        // CTA mapping
        const ctaHtml = (briefData.cta_mapping || [])
            .map(c => `<tr><td style="padding:4px 8px;font-size:13px;color:#707973">${escapeHtml(c.position || '')}</td><td style="padding:4px 8px;font-size:13px">${escapeHtml(c.text || '')}</td><td style="padding:4px 8px;font-size:12px;color:#707973">${escapeHtml(c.type || '')}</td></tr>`)
            .join('');

        // Secondary keywords
        const secKwHtml = (briefData.secondary_keywords || [])
            .map(k => `<span style="display:inline-block;background:#e8f5e9;color:#2d6a4f;padding:2px 10px;border-radius:12px;font-size:12px;margin:2px 4px">${escapeHtml(k)}</span>`)
            .join('');

        // Selection reasoning
        const reasoning = briefData.selection_reasoning || {};

        // Revenue impact badge color
        const impactColors = { high: '#0f5238', medium: '#c77f00', low: '#888' };
        const impactColor = impactColors[briefData.estimated_revenue_impact] || '#888';

        const html = `
<div style="font-family:'Be Vietnam Pro',Arial,sans-serif;max-width:640px;margin:0 auto;background:#fff;border:1px solid #e0e0e0;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#081f15,#0f5238);padding:32px 24px;text-align:center">
    <h1 style="color:#fff;font-size:20px;margin:0">🌿 Brief Mới Cần Duyệt</h1>
    <p style="color:rgba(255,255,255,.7);font-size:13px;margin:8px 0 0">${new Date().toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  </div>

  <div style="padding:24px">
    <h2 style="color:#0f5238;font-size:18px;margin:0 0 16px">${escapeHtml(briefData.title || slug)}</h2>

    <!-- Basic Info -->
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
      <tr><td style="padding:8px 0;color:#707973;width:140px">Target Keyword</td><td style="padding:8px 0;font-weight:700;color:#0f5238">${escapeHtml(briefData.target_keyword || '')}</td></tr>
      <tr><td style="padding:8px 0;color:#707973">Revenue Score</td><td style="padding:8px 0"><span style="background:#2d6a4f;color:#fff;padding:2px 12px;border-radius:12px;font-size:12px;font-weight:600">${briefData.revenue_score || '?'}/10</span></td></tr>
      <tr><td style="padding:8px 0;color:#707973">Search Intent</td><td style="padding:8px 0">${escapeHtml(briefData.search_intent || '?')}</td></tr>
      <tr><td style="padding:8px 0;color:#707973">Content Type</td><td style="padding:8px 0">${escapeHtml(briefData.content_type || '?')}</td></tr>
      <tr><td style="padding:8px 0;color:#707973">Đánh giá Revenue</td><td style="padding:8px 0"><span style="background:${impactColor};color:#fff;padding:2px 12px;border-radius:12px;font-size:12px;font-weight:600">${escapeHtml((briefData.estimated_revenue_impact || '?').toUpperCase())}</span></td></tr>
      <tr><td style="padding:8px 0;color:#707973">Slug</td><td style="padding:8px 0"><code style="background:#f0f0f0;padding:2px 8px;border-radius:4px;font-size:13px">${escapeHtml(slug)}</code></td></tr>
    </table>

    ${secKwHtml ? `<!-- Secondary Keywords -->
    <div style="margin-bottom:20px">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#707973;font-weight:600;margin-bottom:6px">TỪ KHÓA PHỤ</div>
      ${secKwHtml}
    </div>` : ''}

    <!-- WHY: Selection Reasoning -->
    ${reasoning.why_this_keyword || reasoning.why_this_outline || reasoning.expected_outcome ? `
    <div style="background:#f0faf4;border-left:4px solid #2d6a4f;padding:16px;border-radius:0 8px 8px 0;margin-bottom:20px">
      <div style="font-size:14px;font-weight:700;color:#0f5238;margin-bottom:10px">💡 Lý do chọn bài viết này</div>
      ${reasoning.why_this_keyword ? `<div style="margin-bottom:8px"><span style="font-size:12px;font-weight:600;color:#2d6a4f">🔍 Tại sao keyword này:</span><p style="margin:4px 0 0;font-size:13px;color:#333;line-height:1.5">${escapeHtml(reasoning.why_this_keyword)}</p></div>` : ''}
      ${reasoning.why_this_outline ? `<div style="margin-bottom:8px"><span style="font-size:12px;font-weight:600;color:#2d6a4f">📐 Logic chọn outline:</span><p style="margin:4px 0 0;font-size:13px;color:#333;line-height:1.5">${escapeHtml(reasoning.why_this_outline)}</p></div>` : ''}
      ${reasoning.expected_outcome ? `<div><span style="font-size:12px;font-weight:600;color:#2d6a4f">🎯 Kỳ vọng kết quả:</span><p style="margin:4px 0 0;font-size:13px;color:#333;line-height:1.5">${escapeHtml(reasoning.expected_outcome)}</p></div>` : ''}
    </div>` : ''}

    <!-- Competitor Analysis -->
    ${competitorHtml ? `
    <div style="margin-bottom:20px">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#707973;font-weight:600;margin-bottom:6px">🏆 ĐỐI THỦ ĐANG LÀM GÌ</div>
      <ul style="margin:0;padding-left:0;list-style:none">${competitorHtml}</ul>
    </div>` : ''}

    <!-- Our Differentiation -->
    ${briefData.unique_angle ? `
    <div style="background:#fff8e1;border-left:4px solid #c77f00;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px">
      <div style="font-size:12px;font-weight:600;color:#c77f00;margin-bottom:4px">⚡ GÓC NHÌN KHÁC BIỆT CỦA KEOLAI</div>
      <p style="margin:0;font-size:13px;color:#333;line-height:1.5">${escapeHtml(briefData.unique_angle)}</p>
    </div>` : ''}

    <!-- Outline -->
    ${outlineHtml ? `
    <div style="margin-bottom:20px">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#707973;font-weight:600;margin-bottom:8px">📋 OUTLINE BÀI VIẾT (~${briefData.word_count_target || 1500} từ)</div>
      <ol style="margin:0;padding-left:20px;color:#333">${outlineHtml}</ol>
    </div>` : ''}

    <!-- CTA Strategy -->
    ${ctaHtml ? `
    <div style="margin-bottom:20px">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#707973;font-weight:600;margin-bottom:6px">📞 CHIẾN LƯỢC CTA</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f5f5f5"><th style="padding:6px 8px;text-align:left;font-size:12px;color:#707973">Vị trí</th><th style="padding:6px 8px;text-align:left;font-size:12px;color:#707973">Nội dung</th><th style="padding:6px 8px;text-align:left;font-size:12px;color:#707973">Loại</th></tr></thead><tbody>${ctaHtml}</tbody></table>
    </div>` : ''}
  </div>

  <!-- Action Buttons -->
  <div style="padding:0 24px 32px;text-align:center">
    <a href="${approveUrl}" style="display:inline-block;background:#0f5238;color:#fff;padding:14px 40px;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;margin-right:12px">✅ Duyệt Brief</a>
    <a href="${rejectUrl}" style="display:inline-block;background:#dc3545;color:#fff;padding:14px 40px;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px">❌ Từ chối</a>
  </div>
  <div style="background:#f9f9f8;padding:16px 24px;font-size:12px;color:#707973;text-align:center;border-top:1px solid #e0e0e0">
    KeoLai Content Pipeline — Auto-generated by AI Researcher Agent
  </div>
</div>`;

        await transporter.sendMail({
            from: '"KeoLai Pipeline" <dtduy46@gmail.com>',
            to: REVIEWER_EMAIL,
            subject: `📝 [Review] ${briefData.title || slug} — Revenue: ${briefData.revenue_score || '?'}`,
            html,
        });

        console.log(`📧 [Email] Review notification sent for: ${slug}`);
    } catch (err) {
        console.warn('[Email] Notification failed (non-blocking):', err.message);
    }
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function simpleMarkdownToHtml(md) {
    return md
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .split('\n\n')
        .map(block => {
            block = block.trim();
            if (!block) return '';
            if (block.startsWith('<h')) return block;
            return `<p>${block.replace(/\n/g, ' ')}</p>`;
        })
        .join('\n');
}

function buildRevenuePage({ title, description, keywords, slug, label, breadcrumb, date, content }) {
    // Escape user-controlled strings for meta tags (content body is already HTML)
    const safeTitle = escapeHtml(title);
    const safeDesc = escapeHtml(description);
    const safeKeywords = escapeHtml(keywords);
    const safeLabel = escapeHtml(label);
    const safeBreadcrumb = escapeHtml(breadcrumb);

    const dateFormatted = new Date(date).toLocaleDateString('vi-VN', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
    const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
    const readTime = Math.max(1, Math.ceil(wordCount / 200));
    const canonicalUrl = `${SITE_URL}/articles/${slug}/`;

    const articleSchema = JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Article',
        headline: title, description,
        author: { '@type': 'Organization', name: 'Keo Lai Xanh' },
        publisher: { '@type': 'Organization', name: 'Keo Lai Xanh' },
        datePublished: date, dateModified: date,
        mainEntityOfPage: canonicalUrl,
    });

    return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle} | Keo Lai Xanh</title>
<meta name="description" content="${safeDesc}">
<meta name="keywords" content="${safeKeywords}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDesc}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:locale" content="vi_VN">
<meta property="og:type" content="article">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<script type="application/ld+json">${articleSchema}</script>
<style>
:root{--primary:#0f5238;--primary-container:#2d6a4f;--on-primary:#fff;--on-surface:#191c1c;--surface:#f9f9f8;--outline:#707973;--outline-variant:#bfc9c1;--primary-fixed-dim:#95d4b3;--font:'Be Vietnam Pro',sans-serif}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;font-size:18px}
body{font-family:var(--font);color:var(--on-surface);background:var(--surface);line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%;height:auto}
a{color:var(--primary);text-decoration:none}
.container{max-width:1200px;margin:0 auto;padding:0 1.5rem}
.header{position:sticky;top:0;z-index:100;background:rgba(249,249,248,0.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--outline-variant)}
.header-inner{display:flex;justify-content:space-between;align-items:center;padding:1rem 0}
.logo-text{font-size:1.4rem;font-weight:900;color:var(--primary);text-transform:uppercase;letter-spacing:-0.03em;text-decoration:none}
.nav{display:none;gap:2rem}
.nav-link{font-weight:700;font-size:.85rem;text-transform:uppercase;letter-spacing:.1em;color:var(--on-surface);text-decoration:none}
.header-phone{font-weight:700;font-size:1rem;color:var(--primary);text-decoration:none}
.article-hero{position:relative;min-height:440px;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#081f15 0%,var(--primary) 40%,var(--primary-container) 100%);overflow:hidden;padding-top:80px}
.article-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 20% 80%,rgba(149,212,179,.15) 0%,transparent 50%),radial-gradient(circle at 80% 20%,rgba(177,240,206,.1) 0%,transparent 40%)}
.hero-content{position:relative;z-index:2;width:100%;max-width:780px;margin:0 auto;padding:48px 2rem;text-align:center}
.hero-breadcrumb{font-size:.78rem;color:rgba(255,255,255,.6);margin-bottom:20px}
.hero-breadcrumb a{color:rgba(255,255,255,.7)}
.hero-label{display:inline-block;background:rgba(149,212,179,.2);border:1px solid rgba(149,212,179,.3);color:var(--primary-fixed-dim);font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:6px 16px;margin-bottom:20px}
.hero-title{font-size:2.4rem;font-weight:800;color:#fff;line-height:1.25;margin-bottom:20px;max-width:720px;margin-left:auto;margin-right:auto}
.hero-meta{display:flex;align-items:center;justify-content:center;gap:16px;font-size:.82rem;color:rgba(255,255,255,.6)}
.hero-meta-dot{width:4px;height:4px;background:rgba(255,255,255,.3);border-radius:50%}
.article-body{max-width:720px;margin:0 auto;padding:56px 1.4rem 80px}
.article-body h2{font-size:1.5rem;font-weight:700;color:var(--primary);margin-top:56px;margin-bottom:20px;padding-top:32px;position:relative}
.article-body h2::before{content:'';position:absolute;top:0;left:0;width:48px;height:3px;background:var(--primary-fixed-dim)}
.article-body h3{font-size:1.15rem;font-weight:600;color:var(--on-surface);margin-top:32px;margin-bottom:12px}
.article-body p{font-size:1rem;line-height:1.85;margin-bottom:20px}
.revenue-cta{background:linear-gradient(135deg,#081f15 0%,var(--primary) 100%);padding:56px 40px;text-align:center;position:relative;overflow:hidden}
.revenue-cta::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 30% 50%,rgba(149,212,179,.12) 0%,transparent 60%)}
.revenue-cta h3{position:relative;font-size:1.6rem;font-weight:700;color:#fff;margin-bottom:12px}
.revenue-cta p{position:relative;font-size:1rem;color:rgba(255,255,255,.8);margin-bottom:28px;max-width:480px;margin-left:auto;margin-right:auto}
.cta-btn{position:relative;display:inline-block;background:#fff;color:var(--primary);padding:16px 40px;font-family:var(--font);font-weight:700;font-size:1.05rem;border:none;cursor:pointer;text-decoration:none;transition:transform .2s,box-shadow .2s}
.cta-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.2)}
.cta-phone{display:block;margin-top:16px;font-size:.85rem;color:rgba(255,255,255,.6);position:relative}
.price-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(149,212,179,.15);border:1px solid rgba(149,212,179,.3);color:#95d4b3;padding:8px 20px;font-size:.9rem;font-weight:600;margin-top:12px;position:relative}
.footer{background:var(--primary);color:rgba(243,244,243,.9);padding:3rem 0}
.footer-grid{display:grid;grid-template-columns:1fr;gap:2rem}
.footer-logo{display:block;font-size:1.2rem;font-weight:900;color:#fff;text-transform:uppercase;margin-bottom:1rem}
.footer-brand p{font-size:.9rem;line-height:1.7}
.footer-bottom{margin-top:2rem;padding-top:2rem;border-top:1px solid rgba(255,255,255,.1);font-weight:700;font-size:.9rem;color:#fff}
@media(min-width:768px){.nav{display:flex}.footer-grid{grid-template-columns:2fr 1fr 1fr}}
@media(max-width:640px){.hero-title{font-size:1.7rem}.hero-content{padding:32px 1.2rem 36px}.article-hero{min-height:340px}.article-body{padding:40px 1.2rem 60px}.article-body h2{font-size:1.3rem}.revenue-cta{padding:40px 24px}}
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
<a href="/">Trang chủ</a><span>/</span><a href="/#knowledge">Tư vấn</a><span>/</span>${safeBreadcrumb}
</div>
<div class="hero-label">${safeLabel}</div>
<h1 class="hero-title">${safeTitle}</h1>
<div class="hero-meta">
<span>Keo Lai Xanh</span>
<span class="hero-meta-dot"></span>
<span>${dateFormatted}</span>
<span class="hero-meta-dot"></span>
<span>${readTime} phút đọc</span>
</div>
</div>
</section>

<main class="article-body">
${content}
</main>

<section class="revenue-cta">
<h3>🛒 Đặt giống Keo Lai ngay hôm nay</h3>
<p>Cây giống giâm đọt 2-3 tháng, đạt chuẩn xuất vườn. Chứng nhận nguồn gốc. Giao tận nơi toàn quốc.</p>
<a href="tel:0907282960" class="cta-btn">Gọi 0907.282.960</a>
<span class="cta-phone">Hoặc nhắn tin Zalo cùng số</span>
<div class="price-badge">💰 Từ 600đ/cây — Chiết khấu sỉ từ 10.000 cây</div>
</section>

<footer class="footer">
<div class="container">
<div class="footer-grid">
<div class="footer-brand">
<a href="/" class="footer-logo">Vườn Ươm Cây Giống Ngọc Sơn</a>
<p>Chuyên giâm đọt và ươm giống keo lai AH1 — hệ thống phun sương tự động, quy trình ươm 2–3 tháng đạt chuẩn xuất vườn.</p>
</div>
<div>
<div>📞 0907.282.960</div>
<div>📍 Vườn Ươm Ngọc Sơn, Ấp Quảng Phát, Xã Quảng Tiến, Trảng Bom, Đồng Nai</div>
</div>
</div>
<div class="footer-bottom">© 2026 Vườn Ươm Cây Giống Ngọc Sơn — Giống cây lâm nghiệp chất lượng cao</div>
</div>
</footer>
</body>
</html>`;
}
