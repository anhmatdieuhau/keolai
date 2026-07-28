'use client'

import { useState, useMemo } from 'react'
import { KpiCard } from './Charts'
import { IconArticles, IconTopics, IconTrend, IconLightbulb, IconCheck, IconX, IconClock, IconWarning, IconRobot, IconExternal } from './Icons'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtShort(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

const STATUS_ICON = {
  published:   { Icon: IconCheck, color: 'var(--p-success)' },
  pending:     { Icon: IconClock, color: 'var(--p-warning)' },
  generating:  { Icon: IconRobot, color: 'var(--p-info)' },
  error:       { Icon: IconX, color: 'var(--p-danger)' },
}

// ── Error parser ──────────────────────────────────────────
function parseError(raw) {
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (p.error) return p.error.message || p.error.code || raw.slice(0, 120)
    return p.message || raw.slice(0, 120)
  } catch { return raw.slice(0, 120) }
}

// Simple markdown → styled HTML for AI analysis rendering
function mdToHtml(text) {
  if (!text) return ''
  const lines = text.split('\n')
  let html = ''
  let inList = false
  let listType = ''

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { html += '<hr style="border:none;border-top:1px solid var(--p-border);margin:18px 0">'; inList = false; continue }

    // h2
    const h2 = line.match(/^## (.+)/)
    if (h2) {
      if (inList) { html += '</' + listType + '>'; inList = false }
      html += '<h2 style="font-size:16px;font-weight:800;color:var(--p-text);margin:20px 0 8px;letter-spacing:-0.01em">' + inlineMarkdown(h2[1]) + '</h2>'
      continue
    }
    // h3
    const h3 = line.match(/^### (.+)/)
    if (h3) {
      if (inList) { html += '</' + listType + '>'; inList = false }
      html += '<h3 style="font-size:14px;font-weight:700;color:var(--p-text);margin:14px 0 6px">' + inlineMarkdown(h3[1]) + '</h3>'
      continue
    }

    // Numbered list
    const ol = line.match(/^(\d+)\. (.+)/)
    if (ol) {
      if (!inList || listType !== 'ol') {
        if (inList) html += '</' + listType + '>'
        html += '<ol style="margin:6px 0;padding-left:20px">'
        inList = true; listType = 'ol'
      }
      html += '<li style="margin-bottom:4px;line-height:1.7">' + inlineMarkdown(ol[2]) + '</li>'
      continue
    }
    // Bullet list
    const ul = line.match(/^- (.+)/)
    if (ul) {
      if (!inList || listType !== 'ul') {
        if (inList) html += '</' + listType + '>'
        html += '<ul style="margin:6px 0;padding-left:18px">'
        inList = true; listType = 'ul'
      }
      html += '<li style="margin-bottom:4px;line-height:1.7">' + inlineMarkdown(ul[1]) + '</li>'
      continue
    }

    // Close list if not a list item
    if (inList && line.trim()) { html += '</' + listType + '>'; inList = false }

    // Indented sub-item (skip wrapping in p)
    const sub = line.match(/^  - (.+)/)
    if (sub) {
      html += '<div style="margin-left:20px;margin-bottom:4px;line-height:1.7">' + inlineMarkdown(sub[1]) + '</div>'
      continue
    }

    // Normal paragraph
    if (line.trim()) {
      html += '<p style="margin:0 0 8px;line-height:1.8">' + inlineMarkdown(line) + '</p>'
    } else {
      if (inList) { html += '</' + listType + '>'; inList = false }
    }
  }
  if (inList) html += '</' + listType + '>'
  return html
}

function inlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--p-text);font-weight:700">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:var(--p-surface-3);padding:1px 5px;border-radius:3px;font-family:var(--p-mono);font-size:0.9em">$1</code>')
}

// ═══════════════════════════════════════════════════════════
export default function LogsTab({ data }) {
  const [filter, setFilter] = useState('all') // all | topic | article | report | error
  const [search, setSearch] = useState('')

  if (!data) return (
    <div>
      <div className="kpi-grid">
        {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-kpi" />)}
      </div>
      <div className="skeleton" style={{ height: 500, borderRadius: 'var(--p-radius)' }} />
    </div>
  )

  const [aiLoading, setAiLoading] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState(null)

  const { timeline = [], counts, gsc } = data

  async function fetchAnalysis() {
    setAiLoading(true)
    try {
      const secret = sessionStorage.getItem('keolai_portal_secret') || ''
      const res = await fetch(`https://us-central1-keolai-63ec1.cloudfunctions.net/portalData?section=analysis`, {
        headers: { 'x-app-secret': secret },
      })
      if (res.ok) {
        const d = await res.json()
        setAiAnalysis(d)
      }
    } catch (e) {
      setAiAnalysis({ analysis: 'Lỗi kết nối: ' + e.message })
    } finally {
      setAiLoading(false)
    }
  }

  // Filter
  const filtered = useMemo(() => {
    let list = timeline
    if (filter === 'error') list = list.filter(e => e.status === 'error' || (e.type === 'topic' && e.errorMessage))
    else if (filter !== 'all') list = list.filter(e => e.type === filter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(e => (e.title || '').toLowerCase().includes(q))
    }
    return list
  }, [timeline, filter, search])

  // Day groups
  const grouped = useMemo(() => {
    const groups = []
    let lastDay = ''
    for (const e of filtered) {
      const day = (e.timestamp || '').slice(0, 10)
      if (day !== lastDay) {
        groups.push({ day, events: [e] })
        lastDay = day
      } else {
        groups[groups.length - 1].events.push(e)
      }
    }
    return groups
  }, [filtered])

  return (
    <div>
      {/* KPI Header */}
      <div className="kpi-grid">
        <KpiCard icon={<IconArticles size={20} />} label="Bài viết 7 ngày" value={counts?.articles?.thisWeek ?? '—'} color="#2C6B4F" />
        <KpiCard icon={<IconTopics size={20} />} label="Topic chờ" value={counts?.topics?.pending ?? '—'}
          color={counts?.topics?.pending <= 3 ? '#956400' : '#2C6B4F'} />
        <KpiCard icon={<IconTrend size={20} />} label="Tổng bài" value={counts?.articles?.total ?? '—'} color="#787774" />
        <KpiCard icon={<IconX size={20} />} label="Topic lỗi" value={counts?.topics?.error ?? '—'}
          color={counts?.topics?.error > 0 ? '#9F2F2D' : '#2C6B4F'} />
      </div>

      {/* AI Analysis */}
      <div style={{ marginBottom: 20 }}>
        {!aiAnalysis && (
          <button className="btn btn-primary" onClick={fetchAnalysis} disabled={aiLoading}>
            <IconRobot size={16} /> {aiLoading ? 'Đang phân tích...' : 'AI Phân Tích & Đề Xuất (DeepSeek)'}
          </button>
        )}
        {aiAnalysis && (
          <div className="card">
            <div className="card-header">
              <span className="card-title"><IconRobot size={16} /> AI Phân Tích — DeepSeek</span>
              <button className="btn btn-ghost btn-sm" onClick={fetchAnalysis} disabled={aiLoading}>
                {aiLoading ? '⏳' : '🔄'} Làm mới
              </button>
            </div>
            <div className="card-body">
              <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--p-text-2)' }}
                dangerouslySetInnerHTML={{ __html: mdToHtml(aiAnalysis.analysis) }}
              />
              {aiAnalysis.summary && (
                <div style={{ marginTop: 14, padding: '10px 0', borderTop: '1px solid var(--p-border)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--p-text-muted)' }}>
                  <span>Dựa trên: {aiAnalysis.summary.articles?.total} bài · {aiAnalysis.summary.topics?.total} topic · {aiAnalysis.summary.gsc?.impressions?.toLocaleString('vi-VN')} GSC impressions</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <input className="filter-input" placeholder="Tìm trong log..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Tất cả ({timeline.length})</option>
          <option value="topic">Topics ({timeline.filter(e => e.type === 'topic').length})</option>
          <option value="article">Bài viết ({timeline.filter(e => e.type === 'article').length})</option>
          <option value="report">Báo cáo ({timeline.filter(e => e.type === 'report').length})</option>
          <option value="error">Lỗi ({timeline.filter(e => e.status === 'error' || (e.type === 'topic' && e.errorMessage)).length})</option>
        </select>
      </div>

      {/* GSC Performance */}
      {gsc && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title"><IconTrend size={16} /> Hiệu quả SEO — Google Search Console</span>
            <span className="card-subtitle">{gsc.totalTracked} bài tracked</span>
          </div>
          <div className="card-body">
            {/* GSC KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--p-surface-2)', borderRadius: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--p-mono)', color: 'var(--p-text)' }}>{gsc.withRankData}</div>
                <div style={{ fontSize: 10, color: 'var(--p-text-muted)', marginTop: 2 }}>Có rank data</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--p-success-bg)', borderRadius: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--p-mono)', color: 'var(--p-success)' }}>{gsc.indexed}</div>
                <div style={{ fontSize: 10, color: 'var(--p-success)', marginTop: 2 }}>Đã index</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--p-info-bg)', borderRadius: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--p-mono)', color: 'var(--p-info)' }}>{gsc.top10}</div>
                <div style={{ fontSize: 10, color: 'var(--p-info)', marginTop: 2 }}>Top 10 Google</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--p-warning-bg)', borderRadius: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--p-mono)', color: 'var(--p-warning)' }}>{gsc.totalImpressions.toLocaleString('vi-VN')}</div>
                <div style={{ fontSize: 10, color: 'var(--p-warning)', marginTop: 2 }}>Tổng impressions</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--p-surface-2)', borderRadius: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--p-mono)', color: 'var(--p-text)' }}>{gsc.totalClicks.toLocaleString('vi-VN')}</div>
                <div style={{ fontSize: 10, color: 'var(--p-text-muted)', marginTop: 2 }}>Tổng clicks</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--p-surface-2)', borderRadius: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--p-mono)', color: 'var(--p-text)' }}>{gsc.avgPosition}</div>
                <div style={{ fontSize: 10, color: 'var(--p-text-muted)', marginTop: 2 }}>Avg position</div>
              </div>
            </div>

            {/* AI Summary */}
            <div style={{
              background: 'var(--p-surface-2)', borderRadius: 6, padding: 14,
              fontSize: 13, lineHeight: 1.7, color: 'var(--p-text-2)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--p-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Tóm tắt tình hình
              </div>
              Đang theo dõi <strong>{gsc.totalTracked} bài</strong> trên Google Search Console.
              Có <strong style={{ color: 'var(--p-success)' }}>{gsc.withRankData} bài</strong> đã có dữ liệu rank (C2 checkpoint), trong đó
              {' '}<strong style={{ color: 'var(--p-info)' }}>{gsc.top10} bài lọt top 10</strong>,{' '}
              <strong style={{ color: 'var(--p-info)' }}>{gsc.top3} bài lọt top 3</strong>.
              Tổng cộng <strong>{gsc.totalImpressions.toLocaleString('vi-VN')} impressions</strong> và{' '}
              <strong>{gsc.totalClicks.toLocaleString('vi-VN')} clicks</strong> (CTR trung bình {gsc.avgCtr}%).
              Vị trí trung bình: <strong>{gsc.avgPosition}</strong>.
              {gsc.top3 === 0 ? ' Chưa có bài nào lọt top 3 — cần thêm thời gian để index và leo rank.' : ''}
              {gsc.indexed < gsc.totalTracked ? ` Còn ${gsc.totalTracked - gsc.indexed} bài chưa được index.` : ''}
            </div>

            {/* Top articles + Top queries side by side */}
            {(gsc.topArticles.length > 0 || gsc.topQueries?.length > 0) && (
              <div className="dashboard-grid-2" style={{ marginTop: 14 }}>
                {gsc.topArticles.length > 0 && (
                  <div className="table-wrap">
                    <table className="portal-table">
                      <thead><tr><th colSpan={5} style={{ fontSize: 11, fontWeight: 700 }}>Top Bài Viết</th></tr>
                        <tr><th>Bài viết</th><th>Pos</th><th>Impr</th><th>Clicks</th><th>CTR</th></tr></thead>
                      <tbody>
                        {gsc.topArticles.slice(0, 10).map(a => (
                          <tr key={a.slug}>
                            <td style={{ maxWidth: 160 }}><a href={a.articleUrl || '#'} target="_blank" rel="noopener noreferrer" className="td-link truncate" style={{ display: 'block' }}>{a.slug}</a></td>
                            <td className="mono">{a.position != null ? `#${a.position}` : '—'}</td>
                            <td className="mono">{a.impressions?.toLocaleString('vi-VN') || '—'}</td>
                            <td className="mono">{a.clicks?.toLocaleString('vi-VN') || '—'}</td>
                            <td className="mono">{a.ctr != null ? `${a.ctr}%` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {gsc.topQueries?.length > 0 && (
                  <div className="table-wrap">
                    <table className="portal-table">
                      <thead><tr><th colSpan={5} style={{ fontSize: 11, fontWeight: 700 }}>Top Từ Khoá GSC</th></tr>
                        <tr><th>Query</th><th>Pos</th><th>Impr</th><th>Clicks</th><th>CTR</th></tr></thead>
                      <tbody>
                        {gsc.topQueries.slice(0, 15).map((q, i) => (
                          <tr key={i}>
                            <td style={{ maxWidth: 200 }} className="truncate">{q.query}</td>
                            <td className="mono">{q.position != null ? `#${q.position}` : '—'}</td>
                            <td className="mono">{q.impressions?.toLocaleString('vi-VN') || '—'}</td>
                            <td className="mono">{q.clicks?.toLocaleString('vi-VN') || '—'}</td>
                            <td className="mono">{q.ctr != null ? `${q.ctr}%` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      {grouped.length === 0 ? (
        <div className="portal-empty">
          <div className="portal-empty-icon"><IconLightbulb size={24} /></div>
          <div className="portal-empty-title">Không có sự kiện nào</div>
          <div className="portal-empty-sub">Dữ liệu sẽ xuất hiện khi pipeline chạy và tạo topic/bài viết.</div>
        </div>
      ) : (
        <div>
          {grouped.map(group => (
            <div key={group.day} style={{ marginBottom: 24 }}>
              {/* Day header */}
              <div style={{
                fontSize: 12, fontWeight: 700, color: 'var(--p-text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                marginBottom: 8, padding: '4px 0',
                borderBottom: '1px solid var(--p-border)',
              }}>
                {new Date(group.day).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                {' · '}{group.events.length} sự kiện
              </div>

              {/* Events */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.events.map((e, i) => {
                  const st = STATUS_ICON[e.status] || {}
                  const StatusIcon = st.Icon
                  return (
                    <div
                      key={e.id || i}
                      className="card"
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '10px 14px',
                        opacity: e.status === 'error' ? 1 : undefined,
                        borderLeft: e.status === 'error' ? '3px solid var(--p-danger)' : undefined,
                      }}
                    >
                      {/* Type icon */}
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: e.type === 'article' ? 'var(--p-success-bg)' :
                          e.type === 'report' ? 'var(--p-info-bg)' :
                          e.errorMessage ? 'var(--p-danger-bg)' : 'var(--p-surface-3)',
                        color: e.type === 'article' ? 'var(--p-success)' :
                          e.type === 'report' ? 'var(--p-info)' :
                          e.errorMessage ? 'var(--p-danger)' : 'var(--p-text-muted)',
                        flexShrink: 0,
                      }}>
                        {e.type === 'article' ? <IconArticles size={14} /> :
                         e.type === 'report' ? <IconTrend size={14} /> :
                         e.errorMessage ? <IconWarning size={14} /> :
                         e.status === 'generating' ? <IconRobot size={14} /> :
                         <IconTopics size={14} />}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--p-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.title || e.period || e.id}
                          </span>
                          <span style={{ fontSize: 10.5, color: 'var(--p-text-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--p-mono)' }}>
                            {fmtDate(e.timestamp)}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {/* Type badge */}
                          <span className="badge badge-gray" style={{ fontSize: 9.5, padding: '1px 5px' }}>
                            {e.type === 'article' ? 'Bài viết' : e.type === 'report' ? 'Báo cáo' : 'Topic'}
                          </span>

                          {/* Status badge */}
                          {e.status && (
                            <span className={`badge badge-${e.status === 'published' ? 'green' : e.status === 'error' ? 'red' : e.status === 'generating' ? 'blue' : 'yellow'}`} style={{ fontSize: 9.5, padding: '1px 5px' }}>
                              {e.status === 'published' ? 'Đã đăng' : e.status === 'error' ? 'Lỗi' : e.status === 'generating' ? 'Đang tạo' : 'Chờ'}
                            </span>
                          )}

                          {/* Source */}
                          {e.source && <span className="text-xs" style={{ color: 'var(--p-text-muted)' }}>{e.source}</span>}

                          {/* Priority */}
                          {e.priority != null && <span className="text-xs" style={{ color: 'var(--p-text-muted)' }}>P{e.priority}</span>}

                          {/* Link */}
                          {e.url && (
                            <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5, color: 'var(--p-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <IconExternal size={10} /> Xem
                            </a>
                          )}
                        </div>

                        {/* Error message */}
                        {e.errorMessage && (
                          <div style={{
                            marginTop: 6, padding: '6px 8px',
                            background: 'var(--p-danger-bg)', borderRadius: 4,
                            fontSize: 11, fontFamily: 'var(--p-mono)', color: 'var(--p-danger)',
                            wordBreak: 'break-word',
                          }} title={e.errorMessage}>
                            {parseError(e.errorMessage)}
                          </div>
                        )}

                        {/* AI Summary (reports) */}
                        {e.aiSummary && (
                          <div style={{
                            marginTop: 6, fontSize: 12, color: 'var(--p-text-2)',
                            lineHeight: 1.5, whiteSpace: 'pre-line',
                            maxHeight: 80, overflow: 'hidden',
                          }}>
                            {e.aiSummary}
                          </div>
                        )}

                        {/* Report stats */}
                        {e.type === 'report' && (
                          <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--p-text-muted)', display: 'flex', gap: 12 }}>
                            {e.newArticles != null && <span>+{e.newArticles} bài mới</span>}
                            {e.totalArticles != null && <span>{e.totalArticles} tổng</span>}
                            {e.newLeads != null && <span>{e.newLeads} leads</span>}
                            {e.pendingTopics != null && <span>{e.pendingTopics} topic chờ</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
