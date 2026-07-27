'use client'
import { useState, useMemo } from 'react'
import { IconFlask, IconSearch, IconEye, IconCursor, IconPin, IconInbox, StatusDot, IconArrowUp, IconArrowDown, IconArrowsSort } from './Icons'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

function ExpStatusDot({ status }) {
  const map = {
    c1_pending: { color: '#f59e0b', label: 'C1⏳' },
    c1_complete: { color: '#10b981', label: 'C1✅' },
    c1_retry_pending: { color: '#f59e0b', label: 'C1🔄' },
    c2_complete: { color: '#3b82f6', label: 'C2📊' },
    c3_pending_phase3: { color: '#8b5cf6', label: 'C3⏳' },
  }
  const c = map[status] || { color: '#94a3b8', label: '—' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700,
      color: c.color,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: c.color, flexShrink: 0,
      }} />
      {c.label}
    </span>
  )
}

export default function SeoTab({ data }) {
  const [kwSearch, setKwSearch] = useState('')
  const [kwSort, setKwSort] = useState('impressions')
  const [kwDir, setKwDir] = useState('desc')
  const [activeView, setActiveView] = useState('keywords') // keywords | experiments

  if (!data) return (
    <div className="portal-loading">
      <div className="portal-spinner" />
      <span>Đang tải dữ liệu SEO...</span>
    </div>
  )

  const { keywords = [], experiments = [] } = data

  // Keyword metrics
  const totalImpressions = keywords.reduce((s, k) => s + (k.impressions || 0), 0)
  const totalClicks = keywords.reduce((s, k) => s + (k.clicks || 0), 0)
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0'
  const avgPos = keywords.length > 0
    ? (keywords.reduce((s, k) => s + (k.position || 0), 0) / keywords.length).toFixed(1)
    : '—'

  const indexedExps = experiments.filter(e => e.c1?.indexed)
  const hasRankExps = experiments.filter(e => e.c2?.impressions > 0)

  // Filter & sort keywords
  const filteredKw = useMemo(() => {
    let list = keywords
    if (kwSearch) {
      const q = kwSearch.toLowerCase()
      list = list.filter(k => k.query?.toLowerCase().includes(q) || k.coveredBy?.includes(q))
    }
    return [...list].sort((a, b) => {
      const va = a[kwSort] ?? 0
      const vb = b[kwSort] ?? 0
      return kwDir === 'asc' ? va - vb : vb - va
    })
  }, [keywords, kwSearch, kwSort, kwDir])

  function sortKw(key) {
    if (kwSort === key) setKwDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setKwSort(key); setKwDir('desc') }
  }
  function sortIcon(key) {
    if (kwSort !== key) return ' ↕'
    return kwDir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div>
      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="kpi-card" style={{ '--kpi-color': '#3b82f6' }}>
          <div className="kpi-icon">🔑</div>
          <div className="kpi-value">{keywords.length}</div>
          <div className="kpi-label">Keywords tracked</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': '#10b981' }}>
          <div className="kpi-icon">👁️</div>
          <div className="kpi-value">{totalImpressions.toLocaleString()}</div>
          <div className="kpi-label">Tổng impressions</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': '#f59e0b' }}>
          <div className="kpi-icon">🖱️</div>
          <div className="kpi-value">{totalClicks.toLocaleString()}</div>
          <div className="kpi-label">Tổng clicks</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': '#8b5cf6' }}>
          <div className="kpi-icon">📍</div>
          <div className="kpi-value">{avgPos}</div>
          <div className="kpi-label">Avg Position</div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn ${activeView === 'keywords' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveView('keywords')}
        >
          🔑 Keywords ({keywords.length})
        </button>
        <button
          className={`btn ${activeView === 'experiments' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveView('experiments')}
        >
          <IconFlask size={16} /> Experiments ({experiments.length})
        </button>
      </div>

      {activeView === 'keywords' && (
        <>
          <div className="filter-bar">
            <input
              className="filter-input"
              placeholder="🔍 Tìm keyword..."
              value={kwSearch}
              onChange={e => setKwSearch(e.target.value)}
            />
            <span style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap' }}>
              {filteredKw.length} keywords
            </span>
          </div>
          <div className="table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Query</th>
                  <th onClick={() => sortKw('position')} className={kwSort === 'position' ? 'sorted' : ''}>
                    Position{sortIcon('position')}
                  </th>
                  <th onClick={() => sortKw('impressions')} className={kwSort === 'impressions' ? 'sorted' : ''}>
                    Impressions{sortIcon('impressions')}
                  </th>
                  <th onClick={() => sortKw('clicks')} className={kwSort === 'clicks' ? 'sorted' : ''}>
                    Clicks{sortIcon('clicks')}
                  </th>
                  <th onClick={() => sortKw('ctr')} className={kwSort === 'ctr' ? 'sorted' : ''}>
                    CTR{sortIcon('ctr')}
                  </th>
                  <th>Covered By</th>
                </tr>
              </thead>
              <tbody>
                {filteredKw.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="portal-empty">
                        <div className="portal-empty-icon">🔍</div>
                        <div className="portal-empty-title">Chưa có keyword data</div>
                        <div className="portal-empty-sub">Data sẽ có sau khi các bài viết đạt checkpoint C2 (T+14 ngày)</div>
                      </div>
                    </td>
                  </tr>
                )}
                {filteredKw.map((kw, i) => (
                  <tr key={kw.id || i}>
                    <td>
                      <span style={{ fontWeight: 500, color: '#1e293b' }}>{kw.query}</span>
                    </td>
                    <td>
                      {kw.position != null ? (
                        <span style={{
                          fontWeight: 700,
                          color: kw.position <= 3 ? '#10b981' : kw.position <= 10 ? '#f59e0b' : '#ef4444'
                        }}>
                          #{kw.position}
                        </span>
                      ) : '—'}
                    </td>
                    <td><span style={{ fontWeight: 600 }}>{(kw.impressions || 0).toLocaleString()}</span></td>
                    <td><span style={{ fontWeight: 600 }}>{(kw.clicks || 0).toLocaleString()}</span></td>
                    <td>
                      <span style={{ color: (kw.ctr || 0) > 5 ? '#10b981' : '#64748b', fontWeight: 600 }}>
                        {typeof kw.ctr === 'number' ? kw.ctr.toFixed(1) + '%' : '—'}
                      </span>
                    </td>
                    <td>
                      <a
                        href={`https://keolaigiamhom.vn/articles/${kw.coveredBy}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="td-link mono"
                        style={{ fontSize: 11 }}
                      >
                        {kw.coveredBy || '—'}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeView === 'experiments' && (
        <div className="table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Published</th>
                <th>Keyword</th>
                <th>Status</th>
                <th>C1 Index</th>
                <th>C2 Rank</th>
                <th>C3</th>
              </tr>
            </thead>
            <tbody>
              {experiments.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="portal-empty">
                      <div className="portal-empty-icon"><IconFlask size={24} /></div>
                      <div className="portal-empty-title">Chưa có experiment data</div>
                    </div>
                  </td>
                </tr>
              )}
              {experiments.map((exp, i) => (
                <tr key={exp.id || i}>
                  <td>
                    <a
                      href={exp.articleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="td-link mono"
                      style={{ fontSize: 11 }}
                    >
                      {exp.slug}
                    </a>
                  </td>
                  <td><span className="td-muted">{fmtDate(exp.publishedAt)}</span></td>
                  <td>
                    <span style={{ fontSize: 12, color: '#374151', maxWidth: 180, display: 'block' }} className="truncate">
                      {exp.targetKeyword || '—'}
                    </span>
                  </td>
                  <td><ExpStatusDot status={exp.status} /></td>
                  <td>
                    {exp.c1?.indexed
                      ? <span className="badge badge-green">✅ Indexed</span>
                      : exp.c1?.executedAt
                        ? <span className="badge badge-red">❌ Not indexed</span>
                        : <span className="badge badge-yellow">⏳ {fmtDate(exp.c1?.scheduledAt)}</span>
                    }
                  </td>
                  <td>
                    {exp.c2?.impressions > 0
                      ? <span className="badge badge-blue">#{exp.c2.position} · {exp.c2.impressions}imp</span>
                      : exp.c2?.executedAt
                        ? <span className="badge badge-gray">No data</span>
                        : <span className="badge badge-yellow">⏳ {fmtDate(exp.c2?.scheduledAt)}</span>
                    }
                  </td>
                  <td>
                    {exp.c3?.executedAt
                      ? <span className="badge badge-green">Done</span>
                      : <span className="badge badge-gray">⏳ {fmtDate(exp.c3?.scheduledAt)}</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
