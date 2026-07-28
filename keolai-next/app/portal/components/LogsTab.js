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

  const { timeline = [], counts, gsc } = data

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

            {/* Top articles table */}
            {gsc.topArticles.length > 0 && (
              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Bài viết</th>
                      <th>Position</th>
                      <th>Impressions</th>
                      <th>Clicks</th>
                      <th>CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gsc.topArticles.map(a => (
                      <tr key={a.slug}>
                        <td style={{ maxWidth: 280 }}><a href={a.articleUrl || '#'} target="_blank" rel="noopener noreferrer" className="td-link truncate" style={{ display: 'block' }}>{a.slug}</a></td>
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
