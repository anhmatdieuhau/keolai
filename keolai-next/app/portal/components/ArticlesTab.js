'use client'
import { useState, useMemo } from 'react'
import { StatusBadge, CheckpointBadge } from './Charts'
import { IconArticles, IconRobot, IconSeo, IconBarChart, IconInbox, IconSearch, IconTarget, IconChevronUp, IconChevronDown, IconCalendar, IconArrowUp, IconArrowDown, IconArrowsSort } from './Icons'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function expStatusBadge(exp) {
  if (!exp) return <span className="badge badge-gray">⚪ No tracking</span>
  const statusMap = {
    c1_pending:        <span className="badge badge-yellow">⏳ Chờ index (C1)</span>,
    c1_complete:       <span className="badge badge-green">✅ Indexed</span>,
    c1_retry_pending:  <span className="badge badge-yellow">🔄 Retry index</span>,
    c2_complete:       <span className="badge badge-blue">📊 Có rank data</span>,
    c3_pending_phase3: <span className="badge badge-gray">📅 C3 pending</span>,
  }
  return statusMap[exp.status] || <span className="badge badge-gray">{exp.status}</span>
}

export default function ArticlesTab({ data }) {
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [sortKey, setSortKey] = useState('publishedAt')
  const [sortDir, setSortDir] = useState('desc')
  const [expanded, setExpanded] = useState(null)

  if (!data) return (
    <div className="portal-loading">
      <div className="portal-spinner" />
      <span>Đang tải bài viết...</span>
    </div>
  )

  const { articles = [] } = data

  const filtered = useMemo(() => {
    let list = articles
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a => a.title?.toLowerCase().includes(q) || a.slug?.includes(q))
    }
    if (sourceFilter !== 'all') {
      list = list.filter(a => {
        const src = (a.source || '').toLowerCase()
        if (sourceFilter === 'auto') return src.includes('auto') || src.includes('scheduler')
        if (sourceFilter === 'cms') return src.includes('cms')
        if (sourceFilter === 'static') return !src.includes('auto') && !src.includes('cms')
        return true
      })
    }
    list = [...list].sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey]
      if (sortKey === 'publishedAt') {
        va = va ? new Date(va).getTime() : 0
        vb = vb ? new Date(vb).getTime() : 0
      }
      if (va == null) va = ''
      if (vb == null) vb = ''
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })
    return list
  }, [articles, search, sourceFilter, sortKey, sortDir])

  const totalIndexed = articles.filter(a => a.experiment?.c1?.indexed).length
  const totalWithRank = articles.filter(a => a.experiment?.c2?.hasData).length
  const totalAuto = articles.filter(a => (a.source || '').includes('auto') || (a.source || '').includes('scheduler')).length

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }
  function sortIcon(key) {
    if (sortKey !== key) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div>
      {/* Summary KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi-card" style={{ '--kpi-color': '#10b981' }}>
          <div className="kpi-icon">📝</div>
          <div className="kpi-value">{articles.length}</div>
          <div className="kpi-label">Tổng bài viết</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': '#3b82f6' }}>
          <div className="kpi-icon"><IconRobot size={20} /></div>
          <div className="kpi-value">{totalAuto}</div>
          <div className="kpi-label">Auto-generated</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': '#f59e0b' }}>
          <div className="kpi-icon">🔍</div>
          <div className="kpi-value">{totalIndexed}</div>
          <div className="kpi-label">Đã index (Google)</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': '#8b5cf6' }}>
          <div className="kpi-icon">📊</div>
          <div className="kpi-value">{totalWithRank}</div>
          <div className="kpi-label">Có rank data</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          className="filter-input"
          placeholder="🔍 Tìm bài viết..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="filter-select" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="all">Tất cả nguồn</option>
          <option value="auto">Auto</option>
          <option value="cms">CMS</option>
          <option value="static">📄 Static</option>
        </select>
        <span style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap' }}>{filtered.length} bài</span>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('title')} className={sortKey === 'title' ? 'sorted' : ''}>
                Tiêu đề{sortIcon('title')}
              </th>
              <th onClick={() => toggleSort('publishedAt')} className={sortKey === 'publishedAt' ? 'sorted' : ''}>
                Ngày đăng{sortIcon('publishedAt')}
              </th>
              <th>Nguồn</th>
              <th>Index Status</th>
              <th>C2 Rank</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="portal-empty">
                    <div className="portal-empty-icon">📭</div>
                    <div className="portal-empty-title">Không tìm thấy bài viết</div>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map(art => (
              <>
                <tr key={art.slug}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpanded(expanded === art.slug ? null : art.slug)}
                >
                  <td>
                    <div style={{ maxWidth: 360 }}>
                      <a
                        href={art.url || `https://keolaigiamhom.vn/articles/${art.slug}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="td-link"
                        onClick={e => e.stopPropagation()}
                        style={{ display: 'block', marginBottom: 2 }}
                      >
                        {art.title || art.slug}
                      </a>
                      <span className="td-muted mono">{art.slug}</span>
                    </div>
                  </td>
                  <td>
                    <span className="td-muted">{fmtDate(art.publishedAt)}</span>
                  </td>
                  <td>
                    <StatusBadge status={art.source || 'static'} />
                  </td>
                  <td>
                    {art.experiment
                      ? <CheckpointBadge checkpoint="c1" data={art.experiment?.c1} />
                      : <span className="badge badge-gray">—</span>
                    }
                  </td>
                  <td>
                    {art.experiment?.c2
                      ? <CheckpointBadge checkpoint="c2" data={art.experiment?.c2} />
                      : <span className="badge badge-gray">—</span>
                    }
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm">
                      {expanded === art.slug ? '▲ Thu' : '▼ Chi tiết'}
                    </button>
                  </td>
                </tr>
                {expanded === art.slug && art.experiment && (
                  <tr key={`${art.slug}-exp`}>
                    <td colSpan={6} style={{ background: '#f8fafc', padding: '16px 20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        {/* C1 */}
                        <div style={{ background: 'white', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0' }}>
                          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>🔍 C1 — Index Check (T+3d)</div>
                          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
                            <div>Trạng thái: <strong>{art.experiment.c1?.verdict || 'Pending'}</strong></div>
                            <div>Coverage: {art.experiment.c1?.coverageState || '—'}</div>
                            <div>Thực hiện: {fmtDate(art.experiment.c1?.executedAt)}</div>
                          </div>
                        </div>
                        {/* C2 */}
                        <div style={{ background: 'white', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0' }}>
                          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>📊 C2 — Rank Data (T+14d)</div>
                          {art.experiment.c2?.hasData ? (
                            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
                              <div>Position: <strong>#{art.experiment.c2?.position}</strong></div>
                              <div>Impressions: {art.experiment.c2?.impressions?.toLocaleString()}</div>
                              <div>Clicks: {art.experiment.c2?.clicks?.toLocaleString()}</div>
                              <div>CTR: {art.experiment.c2?.ctr}%</div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>
                              {art.experiment.c2?.executedAt ? 'Không có data' : `Dự kiến: ${fmtDate(art.experiment.c2?.scheduledAt)}`}
                            </div>
                          )}
                        </div>
                        {/* C3 */}
                        <div style={{ background: 'white', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0' }}>
                          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>🎯 C3 — AI Decision (T+30d)</div>
                          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
                            <div>Keyword: <span className="mono">{art.experiment.targetKeyword || '—'}</span></div>
                            <div>Dự kiến: {fmtDate(art.experiment.c3?.scheduledAt)}</div>
                            <div>Thực hiện: {fmtDate(art.experiment.c3?.executedAt) || 'Chưa'}</div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
