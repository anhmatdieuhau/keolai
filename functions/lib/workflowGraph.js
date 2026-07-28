/**
 * Workflow Graph — canonical topology of the KeoLai AI system.
 *
 * This file is the single source of truth for what agents exist, how they
 * connect, and what their real capabilities are. The portal Workflow tab reads
 * from here — it never hardcodes node definitions. To add or rename a node,
 * edit this file and deploy functions.
 *
 * Design constraints:
 * - id format: `${system}.${name}` — stable, never reused
 * - system 'A' = Content Pipeline (functions/pipeline.js)
 * - system 'B' = Marketing Agent (functions/marketing/)
 * - kind: sensor|step|llm|gate|human-gate|store|sink|orchestrator|api|missing
 * - costGuarded MUST reflect reality, not aspiration — several nodes bypass
 *   costGuard entirely (see notes)
 * - trigger: cron|http|firestore|manual|none — the actual mechanism, not the
 *   "would be nice" mechanism
 * - edge.kind is the most important field on the graph:
 *     http              = real HTTP call in code (pipeline.js:479 has the only one)
 *     firestore-trigger = real Firestore event trigger
 *     firestore-poll    = no automation — cron N+1 happens to read what cron N wrote
 *     write             = node writes to a store collection
 *     missing           = dead-end — next stage doesn't exist
 */

// ═══════════════════════════════════════════════════════════
// Hệ A — Content Pipeline (functions/pipeline.js)
// ═══════════════════════════════════════════════════════════

const SYSTEM_A = [
  {
    id: 'pipe.analyst',
    label: 'Analyst — Phân tích trend report',
    system: 'A',
    kind: 'step',
    model: null,
    promptIds: [],
    functionName: 'pipelineAnalyst',
    trigger: 'cron',
    timeoutSeconds: 120,
    runnable: true,
    toggleable: true,
    dangerous: false,
    costGuarded: false,
    reads: ['pipeline/trend_reports/items/{date}'],
    writes: ['pipeline/trend_reports/items/{date}'],
    defaultPosition: { x: 40, y: 120 },
    note: 'Không gọi LLM — thuần fetch GSC/GA4. Không đi qua costGuard.',
  },
  {
    id: 'pipe.trendReports',
    label: 'Trend Reports',
    system: 'A',
    kind: 'store',
    model: null,
    promptIds: [],
    functionName: null,
    trigger: 'none',
    timeoutSeconds: null,
    runnable: false,
    toggleable: false,
    dangerous: false,
    costGuarded: false,
    reads: [],
    writes: [],
    defaultPosition: { x: 40, y: 280 },
    note: 'pipeline/trend_reports/items/{date} — analyst ghi, researcher đọc.',
  },
  {
    id: 'pipe.researcher',
    label: 'Researcher — Soạn Content Brief',
    system: 'A',
    kind: 'llm',
    model: 'gemini-3.1-flash-lite',
    promptIds: ['pipeline.researcher.brief'],
    functionName: 'pipelineResearcher',
    trigger: 'firestore-poll',
    timeoutSeconds: 180,
    runnable: true,
    toggleable: true,
    dangerous: false,
    costGuarded: false,
    reads: ['pipeline/trend_reports/items/{date}'],
    writes: ['pipeline/briefs/items/{slug}', 'email'],
    defaultPosition: { x: 340, y: 120 },
    note: 'Không đi qua costGuard — chi phí không được ghi nhận. Gửi email brief.',
  },
  {
    id: 'pipe.briefs',
    label: 'Content Briefs',
    system: 'A',
    kind: 'store',
    model: null,
    promptIds: [],
    functionName: null,
    trigger: 'none',
    timeoutSeconds: null,
    runnable: false,
    toggleable: false,
    dangerous: false,
    costGuarded: false,
    reads: [],
    writes: [],
    defaultPosition: { x: 340, y: 280 },
    note: 'pipeline/briefs/items/{slug} — researcher ghi, reviewer đọc rồi writer đọc.',
  },
  {
    id: 'pipe.reviewer',
    label: 'Reviewer — Duyệt brief (thủ công)',
    system: 'A',
    kind: 'human-gate',
    model: null,
    promptIds: [],
    functionName: 'pipelineReviewer',
    trigger: 'manual',
    timeoutSeconds: 30,
    runnable: false,
    toggleable: false,
    dangerous: false,
    costGuarded: false,
    reads: ['pipeline/briefs/items/{slug}'],
    writes: [],
    defaultPosition: { x: 640, y: 120 },
    note: 'GET endpoint (pipeline.js:424-429) không có auth. Để runnable: false vì không thể xác thực người gọi — nếu cần one-click approve thì phải thêm auth trước.',
  },
  {
    id: 'pipe.writer',
    label: 'Writer — Viết bài hoàn chỉnh',
    system: 'A',
    kind: 'llm',
    model: 'gemini-3.6-flash',
    promptIds: ['pipeline.writer.article'],
    functionName: 'pipelineWriter',
    trigger: 'http',
    timeoutSeconds: 300,
    runnable: true,
    toggleable: true,
    dangerous: false,
    costGuarded: false,
    reads: ['pipeline/briefs/items/{slug}'],
    writes: ['articles/{slug}', 'email'],
    defaultPosition: { x: 940, y: 120 },
    note: 'Không đi qua costGuard — chi phí không được ghi nhận. Model đắt nhất trong hệ A.',
  },
  {
    id: 'pipe.articles',
    label: 'Articles (Firestore)',
    system: 'A',
    kind: 'sink',
    model: null,
    promptIds: [],
    functionName: null,
    trigger: 'none',
    timeoutSeconds: null,
    runnable: false,
    toggleable: false,
    dangerous: false,
    costGuarded: false,
    reads: [],
    writes: [],
    defaultPosition: { x: 940, y: 280 },
    note: 'Đích cuối của pipeline — bài viết được lưu vào Firestore articles/{slug}.',
  },
  {
    id: 'pipe.orchestrator',
    label: 'Orchestrator — Chạy toàn bộ pipeline',
    system: 'A',
    kind: 'orchestrator',
    model: 'gemini-3.1-flash-lite',
    promptIds: ['pipeline.orchestrator.analyst', 'pipeline.orchestrator.researcher'],
    functionName: 'pipelineOrchestrator',
    trigger: 'cron',
    timeoutSeconds: 540,
    runnable: true,
    toggleable: true,
    dangerous: true,
    costGuarded: false,
    reads: ['pipeline/trend_reports', 'pipeline/briefs', 'articles'],
    writes: ['articles/{slug}', 'topics/{slug}', 'email'],
    defaultPosition: { x: 640, y: 400 },
    note: 'Cài lại analyst + researcher inline với prompt KHÁC pipelineResearcher (pipeline.js:911). Tốn kém nhất (540s), bypass costGuard, publish trực tiếp. Chạy thủ công cần xác nhận 2 lần.',
  },
  {
    id: 'pipe.status',
    label: 'Pipeline Status API',
    system: 'A',
    kind: 'api',
    model: null,
    promptIds: [],
    functionName: 'pipelineStatus',
    trigger: 'http',
    timeoutSeconds: 30,
    runnable: false,
    toggleable: false,
    dangerous: false,
    costGuarded: false,
    reads: [],
    writes: [],
    defaultPosition: { x: 640, y: 560 },
    note: 'GET /pipelineStatus — trả về trạng thái hiện tại của pipeline.',
  },
]

// ═══════════════════════════════════════════════════════════
// Hệ B — Marketing Agent (functions/marketing/)
// ═══════════════════════════════════════════════════════════

const SYSTEM_B = [
  {
    id: 'mkt.gscDemandScan',
    label: 'GSC Demand Scan',
    system: 'B',
    kind: 'sensor',
    model: null,
    promptIds: [],
    functionName: 'gscDemandScan',
    trigger: 'cron',
    timeoutSeconds: 180,
    runnable: true,
    toggleable: true,
    dangerous: false,
    costGuarded: true,
    reads: [],
    writes: ['signals/{date}'],
    defaultPosition: { x: 40, y: 680 },
    note: 'Thuần số học — không gọi LLM. Đọc GSC API, ghi raw claims vào signals.',
  },
  {
    id: 'mkt.contentDecayScan',
    label: 'Content Decay Scan',
    system: 'B',
    kind: 'sensor',
    model: null,
    promptIds: [],
    functionName: 'contentDecayScan',
    trigger: 'cron',
    timeoutSeconds: 180,
    runnable: true,
    toggleable: true,
    dangerous: false,
    costGuarded: true,
    reads: ['articles/{slug}/analytics/{date}'],
    writes: ['signals/{date}'],
    defaultPosition: { x: 40, y: 820 },
    note: 'Thuần số học — so sánh 2 snapshot GSC. Không gọi LLM. Cần ~4 tuần lịch sử mới có kết quả.',
  },
  {
    id: 'mkt.serpGapScan',
    label: 'SERP Gap Scan',
    system: 'B',
    kind: 'sensor',
    model: 'gemini-3.6-flash',
    promptIds: ['marketing.serpGapScan.judge'],
    functionName: 'serpGapScan',
    trigger: 'cron',
    timeoutSeconds: 180,
    runnable: true,
    toggleable: true,
    dangerous: false,
    costGuarded: true,
    reads: [],
    writes: ['signals/{date}'],
    defaultPosition: { x: 40, y: 960 },
    note: 'Có gọi LLM để đánh giá SERP gap. Đi qua costGuard.',
  },
  {
    id: 'mkt.signals',
    label: 'Signals',
    system: 'B',
    kind: 'store',
    model: null,
    promptIds: [],
    functionName: null,
    trigger: 'none',
    timeoutSeconds: null,
    runnable: false,
    toggleable: false,
    dangerous: false,
    costGuarded: false,
    reads: [],
    writes: [],
    defaultPosition: { x: 340, y: 820 },
    note: 'signals/{date}.{sensor} — 3 sensor ghi, evidenceVerifier đọc qua Firestore trigger.',
  },
  {
    id: 'mkt.evidenceVerifier',
    label: 'Evidence Verifier — Cổng #1',
    system: 'B',
    kind: 'gate',
    model: 'claude-sonnet-5',
    promptIds: [],
    functionName: 'evidenceVerifier',
    trigger: 'firestore',
    timeoutSeconds: 300,
    runnable: false,
    toggleable: true,
    dangerous: false,
    costGuarded: true,
    reads: ['signals/{date}', 'verified_claims/{date}'],
    writes: ['verified_claims/{date}'],
    defaultPosition: { x: 640, y: 820 },
    note: 'Firestore trigger (onDocumentWritten trên signals). Gate #1: xác minh claim từ sensor có bằng chứng thật không. prompt không editable (cổng an toàn). costGuarded: true.',
  },
  {
    id: 'mkt.verifiedClaims',
    label: 'Verified Claims',
    system: 'B',
    kind: 'store',
    model: null,
    promptIds: [],
    functionName: null,
    trigger: 'none',
    timeoutSeconds: null,
    runnable: false,
    toggleable: false,
    dangerous: false,
    costGuarded: false,
    reads: [],
    writes: [],
    defaultPosition: { x: 940, y: 820 },
    note: 'verified_claims/{date} — evidenceVerifier ghi, strategistAgent đọc.',
  },
  {
    id: 'mkt.strategistAgent',
    label: 'Strategist Agent — Cổng #1.5',
    system: 'B',
    kind: 'gate',
    model: 'claude-sonnet-5',
    promptIds: ['marketing.strategist.proposal'],
    functionName: 'strategistAgent',
    trigger: 'cron',
    timeoutSeconds: 300,
    runnable: true,
    toggleable: true,
    dangerous: false,
    costGuarded: true,
    reads: ['verified_claims/{date}'],
    writes: ['proposals/{date}'],
    defaultPosition: { x: 1240, y: 820 },
    note: 'Đọc verified claims → sinh đề xuất chiến lược. Model đắt nhất (claude-sonnet-5). Đi qua costGuard.',
  },
  {
    id: 'mkt.proposals',
    label: 'Proposals',
    system: 'B',
    kind: 'store',
    model: null,
    promptIds: [],
    functionName: null,
    trigger: 'none',
    timeoutSeconds: null,
    runnable: false,
    toggleable: false,
    dangerous: false,
    costGuarded: false,
    reads: [],
    writes: [],
    defaultPosition: { x: 1540, y: 820 },
    note: 'proposals/{date} — strategistAgent ghi (status: shadow). Dead-end: Phase 4/5 chưa tồn tại.',
  },
  {
    id: 'mkt.phase45',
    label: 'Phase 4+5 — Executor + Optimizer',
    system: 'B',
    kind: 'missing',
    model: null,
    promptIds: [],
    functionName: null,
    trigger: 'none',
    timeoutSeconds: null,
    runnable: false,
    toggleable: false,
    dangerous: false,
    costGuarded: false,
    reads: [],
    writes: [],
    defaultPosition: { x: 1840, y: 820 },
    note: 'CHƯA TỒN TẠI. Chuỗi marketing dừng ở proposals. Phase 4 (executorAgent — tự áp dụng thay đổi) và Phase 5 (optimizerAgent — theo dõi kết quả) chưa được code.',
  },
]

// ═══════════════════════════════════════════════════════════
// Edges — kind is the most important signal on the graph
// ═══════════════════════════════════════════════════════════

const EDGES = [
  // ── System A: Content Pipeline ──
  { id: 'e.a.analyst→trend',    source: 'pipe.analyst',       target: 'pipe.trendReports',   kind: 'write' },
  { id: 'e.a.trend→researcher',  source: 'pipe.trendReports',  target: 'pipe.researcher',     kind: 'firestore-poll' },
  { id: 'e.a.researcher→brief',  source: 'pipe.researcher',    target: 'pipe.briefs',         kind: 'write' },
  { id: 'e.a.brief→reviewer',    source: 'pipe.briefs',        target: 'pipe.reviewer',       kind: 'firestore-poll' },
  { id: 'e.a.reviewer→writer',   source: 'pipe.reviewer',      target: 'pipe.writer',         kind: 'http' },
  { id: 'e.a.brief→writer',      source: 'pipe.briefs',        target: 'pipe.writer',         kind: 'firestore-poll' },
  { id: 'e.a.writer→articles',   source: 'pipe.writer',        target: 'pipe.articles',       kind: 'write' },

  // Orchestrator bypass — gọi analyst+researcher+writer inline, publish trực tiếp
  { id: 'e.a.orchestrator→trend',    source: 'pipe.orchestrator', target: 'pipe.trendReports', kind: 'write' },
  { id: 'e.a.orchestrator→brief',    source: 'pipe.orchestrator', target: 'pipe.briefs',       kind: 'write' },
  { id: 'e.a.orchestrator→articles', source: 'pipe.orchestrator', target: 'pipe.articles',     kind: 'write' },

  // Status API — reads from multiple stores
  { id: 'e.a.trend→status',     source: 'pipe.trendReports', target: 'pipe.status',         kind: 'firestore-poll' },
  { id: 'e.a.brief→status',     source: 'pipe.briefs',       target: 'pipe.status',         kind: 'firestore-poll' },
  { id: 'e.a.articles→status',  source: 'pipe.articles',     target: 'pipe.status',         kind: 'firestore-poll' },

  // ── System B: Marketing Agent ──
  { id: 'e.b.gsc→signals',      source: 'mkt.gscDemandScan',    target: 'mkt.signals',          kind: 'write' },
  { id: 'e.b.decay→signals',    source: 'mkt.contentDecayScan', target: 'mkt.signals',          kind: 'write' },
  { id: 'e.b.serp→signals',     source: 'mkt.serpGapScan',      target: 'mkt.signals',          kind: 'write' },
  { id: 'e.b.signals→verifier', source: 'mkt.signals',          target: 'mkt.evidenceVerifier',  kind: 'firestore-trigger' },
  { id: 'e.b.verifier→claims',  source: 'mkt.evidenceVerifier', target: 'mkt.verifiedClaims',    kind: 'write' },
  { id: 'e.b.claims→strategist',source: 'mkt.verifiedClaims',   target: 'mkt.strategistAgent',   kind: 'firestore-poll' },
  { id: 'e.b.strategist→props', source: 'mkt.strategistAgent',  target: 'mkt.proposals',         kind: 'write' },

  // Dead-end — Phase 4+5 chưa tồn tại
  { id: 'e.b.props→phase45',    source: 'mkt.proposals',       target: 'mkt.phase45',           kind: 'missing' },
]

// ═══════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════

const NODES = [...SYSTEM_A, ...SYSTEM_B]
const NODE_MAP = Object.fromEntries(NODES.map(n => [n.id, n]))

const GRAPH_VERSION = 1

function getNode(id) { return NODE_MAP[id] || null }

/** Node IDs eligible for workflowControl target allowlist. */
function runnableNodeIds() { return NODES.filter(n => n.runnable).map(n => n.id) }

/** Reverse lookup: promptId → node. */
function promptIdToNode(promptId) {
  return NODES.find(n => n.promptIds && n.promptIds.includes(promptId)) || null
}

module.exports = {
  nodes: NODES,
  edges: EDGES,
  NODE_MAP,
  GRAPH_VERSION,
  getNode,
  runnableNodeIds,
  promptIdToNode,
}
