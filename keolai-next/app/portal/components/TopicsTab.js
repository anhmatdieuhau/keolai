'use client'
import { useState, useMemo } from 'react'
import { StatusBadge } from './Charts'
import { IconClock, IconBolt, IconCheck, IconX, IconRefresh, IconSearch, IconLightbulb, IconInbox, IconLink, IconExternal, IconWarning, StatusDot } from './Icons'

const FUNCTIONS_BASE = 'https://us-central1-keolai-63ec1.cloudfunctions.net'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const STATUS_ORDER = ['pending', 'generating', 'published', 'error']
const STATUS_CONFIG = {
  pending:    { color: '#956400', bg: '#FBF3DB', title: 'Dang cho',  icon: IconClock },
  generating: { color: '#1F6C9F', bg: '#E1F3FE', title: 'Dang tao',  icon: IconBolt },
  published:  { color: '#346538', bg: '#EDF3EC', title: 'Da dang',   icon: IconCheck },
  error:      { color: '#9F2F2D', bg: '#FDEBEC', title: 'Loi',       icon: IconX },
}

export default function TopicsTab({ data, appSecret, onRefresh }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [replenishing, setReplenishing] = useState(false)
  const [replenishResult, setReplenishResult] = useState(null)

  if (!data) return (
    <div className="portal-loading-skeleton" style={{ padding: 24 }}>
      <div className="skeleton-kpi-grid">
        {[1,2,3,4].map(i => <div key={i} className="skeleton-card" style={{ height: 100 }} />)}
      </div>
    </div>
  )

  const { topics = [] } = data

  const pending = topics.filter(t => t.status === 'pending').length
  const generating = topics.filter(t => t.status === 'generating').length
  const published = topics.filter(t => t.status === 'published').length
  const errors = topics.filter(t => t.status === 'error').length

  // Estimated days remaining (pipeline runs M/W/F = ~3x/week)
  const pipelineRunsPerWeek = 3
  const daysRemaining = pending > 0 ? Math.ceil(pending / (pipelineRunsPerWeek / 7)) : 0

  const filtered = useMemo(() => {
    let list = topics
    if (filter !== 'all') list = list.filter(t => t.status === filter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t => t.title?.toLowerCase().includes(q) || t.keywords?.join?.('').toLowerCase().includes(q))
    }
    return list
  }, [topics, filter, search])

  async function handleReplenish() {
    if (!appSecret) return alert('Cần APP_SECRET để thực hiện hành động này')
    setReplenishing(true)
    setReplenishResult(null)
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/autoReplenishTopics`, {
        method: 'POST',
        headers: { 'x-app-secret': appSecret },
      })
      const data = await res.json()
      setReplenishResult({ ok: res.ok, data })
      if (res.ok) onRefresh?.()
    } catch (err) {
      setReplenishResult({ ok: false, data: { error: err.message } })
    } finally {
      setReplenishing(false)
    }
  }

  return (
    <div>
      {/* Alert nếu gần hết topic */}
      {pending <= 3 && (
        <div className="alert alert-warning">
          <div className="alert-icon"><IconWarning size={16} /></div>
          <div className="alert-text">
            <div className="alert-title">
              {pending === 0 ? 'Hết topic! Pipeline sẽ dừng.' : `Chỉ còn ${pending} topic đang chờ`}
            </div>
            <div className="alert-body">
              Ước tính: {daysRemaining} ngày nữa hết topic. Nhấn "Replenish" để gen topic mới.
            </div>
          </div>
        </div>
      )}

      {replenishResult && (
        <div className={`alert ${replenishResult.ok ? 'alert-success' : 'alert-danger'}`}>
          <div className="alert-text">
            <div className="alert-title">{replenishResult.ok ? 'Replenish thanh cong' : 'Replenish that bai'}</div>
            <div className="alert-body">{JSON.stringify(replenishResult.data).slice(0, 200)}</div>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {STATUS_ORDER.map(s => {
          const c = STATUS_CONFIG[s]
          const count = topics.filter(t => t.status === s).length
          return (
            <div
              key={s}
              className="kpi-card"
              style={{ '--kpi-color': c.color, cursor: 'pointer' }}
              onClick={() => setFilter(filter === s ? 'all' : s)}
            >
              <div className="kpi-icon" style={{ background: c.bg, color: c.color }}><c.icon size={20} /></div>
              <div className="kpi-value">{count}</div>
              <div className="kpi-label">{c.title}</div>
              {filter === s && (
                <div style={{ marginTop: 6, fontSize: 10, color: c.color, fontWeight: 700 }}>● ĐANG LỌC</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn btn-accent"
          onClick={handleReplenish}
          disabled={replenishing}
        >
          {replenishing ? <><IconClock size={16} /> Dang replenish...</> : <><IconRefresh size={16} /> Replenish Topics</>}
        </button>
        <span style={{ fontSize: 12, color: '#9E9C99' }}>
          Pipeline tự động chạy T2/T4/T6 lúc 6AM · Còn ~{daysRemaining} ngày
        </span>
      </div>

      {/* Filter + Search */}
      <div className="filter-bar">
        <input
          className="filter-input"
          placeholder="Tim topic..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="all">Tất cả ({topics.length})</option>
          {STATUS_ORDER.map(s => (
            <option key={s} value={s}>
              {STATUS_CONFIG[s].title} ({topics.filter(t => t.status === s).length})
            </option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: '#9E9C99', whiteSpace: 'nowrap' }}>{filtered.length} topics</span>
      </div>

      {/* Kanban View */}
      {filter === 'all' && !search ? (
        <div className="kanban-board">
          {STATUS_ORDER.map(s => {
            const c = STATUS_CONFIG[s]
            const cols = topics.filter(t => t.status === s)
            return (
              <div key={s} className="kanban-col">
                <div className="kanban-col-header">
                  <div className="kanban-col-title" style={{ color: c.color }}>
                    <c.icon size={14} /> {c.title}
                  </div>
                  <div className="kanban-col-count">{cols.length}</div>
                </div>
                {cols.slice(0, 15).map(topic => (
                  <div key={topic.id} className="kanban-card">
                    <div className="kanban-card-title">{topic.title}</div>
                    <div className="kanban-card-meta">
                      {topic.status === 'published' && topic.url ? (
                        <a href={topic.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2C6B4F', fontSize: 11 }}>
                          <IconLink size={12} /> Xem bài viết
                        </a>
                      ) : topic.status === 'error' ? (
                        <span style={{ color: '#9F2F2D', fontSize: 11 }}>
                          <IconWarning size={12} /> {(topic.errorMessage || '').slice(0, 60)}
                        </span>
                      ) : (
                        <span>P{topic.priority || 0} · {Array.isArray(topic.keywords) ? topic.keywords.slice(0, 2).join(', ') : topic.keywords || topic.label || ''}</span>
                      )}
                    </div>
                  </div>
                ))}
                {cols.length > 15 && (
                  <div style={{ fontSize: 12, color: '#9E9C99', padding: '8px 4px', textAlign: 'center' }}>
                    +{cols.length - 15} nữa...
                  </div>
                )}
                {cols.length === 0 && (
                  <div style={{ fontSize: 12, color: '#9E9C99', padding: '16px 4px', textAlign: 'center' }}>
                    Trống
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* List view when filtering */
        <div className="table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Keywords</th>
                <th>Ngày đăng / Lỗi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="portal-empty">
                      <div className="portal-empty-icon"><IconInbox size={24} /></div>
                      <div className="portal-empty-title">Không tìm thấy topic</div>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map(topic => (
                <tr key={topic.id}>
                  <td>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{topic.title}</div>
                    <div className="td-muted mono">{topic.slug}</div>
                  </td>
                  <td><StatusBadge status={topic.status} /></td>
                  <td>
                    <span style={{ fontWeight: 700, color: topic.priority >= 8 ? '#9F2F2D' : '#787774' }}>
                      {topic.priority || 0}
                    </span>
                  </td>
                  <td>
                    <div style={{ maxWidth: 200, fontSize: 12, color: '#787774' }}>
                      {Array.isArray(topic.keywords)
                        ? topic.keywords.slice(0, 3).join(', ')
                        : topic.keywords || '—'}
                    </div>
                  </td>
                  <td>
                    {topic.status === 'error' ? (
                      <span style={{ fontSize: 12, color: '#9F2F2D' }}>
                        {(topic.errorMessage || 'Unknown error').slice(0, 80)}
                      </span>
                    ) : topic.status === 'published' && topic.url ? (
                      <a href={topic.url} target="_blank" rel="noopener noreferrer" className="td-link" style={{ fontSize: 12 }}>
                        {fmtDate(topic.publishedAt)} <IconExternal size={12} />
                      </a>
                    ) : (
                      <span className="td-muted">{fmtDate(topic.scheduledAt)}</span>
                    )}
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
