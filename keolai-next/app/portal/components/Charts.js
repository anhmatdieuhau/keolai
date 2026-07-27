'use client'
import { useEffect, useRef } from 'react'

// ── Simple SVG Donut Chart ─────────────────────────────
export function DonutChart({ data, size = 120 }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = 40
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F0EFEC" strokeWidth="14" />
        {data.map((seg, i) => {
          const pct = seg.value / total
          const dash = pct * circ
          const gap = circ - dash
          const el = (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset * circ / 1 + circ / 4}
              strokeLinecap="round"
            />
          )
          offset += pct
          return el
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="currentColor">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="currentColor">
          total
        </text>
      </svg>
      <div className="donut-legend">
        {data.map((seg, i) => (
          <div key={i} className="donut-legend-item">
            <div className="donut-legend-dot" style={{ background: seg.color }} />
            <span className="donut-legend-label">{seg.label}</span>
            <span className="donut-legend-value">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Mini Bar Chart (SVG) ───────────────────────────────
export function MiniBarChart({ data, color = '#2C6B4F', height = 80 }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.value)) || 1
  const w = 100 / data.length
  const gap = 0.8

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="mini-bar-chart"
    >
      {data.map((d, i) => {
        const barH = (d.value / max) * (height - 20)
        const x = i * w + gap / 2
        const y = height - barH - 2
        return (
          <g key={i}>
            <rect
              x={x} y={y}
              width={w - gap}
              height={barH}
              fill={color}
              opacity={0.8}
              rx={2}
            />
            <text
              x={x + (w - gap) / 2}
              y={height}
              textAnchor="middle"
              fontSize={6}
              fill="#9E9C99"
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Status Badge ───────────────────────────────────────
export function StatusBadge({ status }) {
  const configs = {
    pending:          { cls: 'badge-yellow', label: 'Pending' },
    generating:       { cls: 'badge-blue',   label: 'Đang tạo' },
    published:        { cls: 'badge-green',  label: 'Đã đăng' },
    error:            { cls: 'badge-red',    label: 'Lỗi' },
    c1_pending:       { cls: 'badge-yellow', label: 'Chờ index' },
    c1_complete:      { cls: 'badge-green',  label: 'Đã index' },
    c1_retry_pending: { cls: 'badge-yellow', label: 'Retry' },
    c2_complete:      { cls: 'badge-blue',   label: 'Có rank' },
    c3_pending_phase3:{ cls: 'badge-gray',   label: 'C3 pending' },
    covered:          { cls: 'badge-green',  label: 'Covered' },
    auto_scheduler:   { cls: 'badge-blue',   label: 'Auto' },
    'auto-scheduler': { cls: 'badge-blue',   label: 'Auto' },
    cms:              { cls: 'badge-dark',   label: 'CMS' },
    static:           { cls: 'badge-gray',   label: 'Static' },
  }
  const c = configs[status] || { cls: 'badge-gray', label: status || '—' }
  return <span className={'badge ' + c.cls}>{c.label}</span>
}

// ── Experiment Checkpoint Badge ────────────────────────
export function CheckpointBadge({ checkpoint, data }) {
  if (!data) return <span className="badge badge-gray">—</span>
  if (checkpoint === 'c1') {
    if (data.indexed) return <span className="badge badge-green">Indexed</span>
    if (data.executedAt) return <span className="badge badge-red">Not indexed</span>
    return <span className="badge badge-yellow">T+3d</span>
  }
  if (checkpoint === 'c2') {
    if (data.hasData || data.impressions > 0) {
      return <span className="badge badge-blue">#{data.position || '?'} · {data.impressions || 0} imp</span>
    }
    if (data.executedAt) return <span className="badge badge-yellow">No data</span>
    return <span className="badge badge-gray">T+14d</span>
  }
  if (checkpoint === 'c3') {
    if (data.executedAt) return <span className="badge badge-green">C3 Done</span>
    return <span className="badge badge-gray">T+30d</span>
  }
  return null
}

// ── KPI Card ───────────────────────────────────────────
export function KpiCard({ icon, label, value, delta, deltaLabel, color = '#2C6B4F', bg }) {
  const style = {
    '--kpi-color': color,
    '--kpi-bg': bg || (color + '20'),
  }
  const isUp = typeof delta === 'number' && delta > 0
  const isDown = typeof delta === 'number' && delta < 0

  return (
    <div className="kpi-card" style={style}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-value">{value ?? '—'}</div>
      <div className="kpi-label">{label}</div>
      {delta !== undefined && (
        <div className={`kpi-delta ${isUp ? 'up' : isDown ? 'down' : 'neutral'}`}>
          {Math.abs(delta)} {deltaLabel}
        </div>
      )}
    </div>
  )
}
