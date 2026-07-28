'use client'

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const tooltipStyle = {
  background: 'var(--p-surface)',
  border: '1px solid var(--p-border)',
  borderRadius: 6,
  fontSize: 12,
  fontFamily: 'var(--p-font)',
  boxShadow: 'var(--p-shadow)',
  padding: '6px 10px',
}

// ═══════════════════════════════════════════════════════════
// Donut Chart — topic queue distribution
// ═══════════════════════════════════════════════════════════
export function DonutChart({ data, size = 160 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const innerR = size * 0.36
  const outerR = size * 0.48

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      {/* Chart */}
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={innerR}
              outerRadius={outerR}
              dataKey="value"
              strokeWidth={2}
              stroke="var(--p-surface)"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, '']} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--p-mono)', lineHeight: 1, color: 'var(--p-text)' }}>
            {total}
          </span>
          <span style={{ fontSize: 10, color: 'var(--p-text-muted)', marginTop: 2 }}>total</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--p-text-2)', flex: 1 }}>{d.label}</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--p-text)' }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Mini Bar Chart — weekly article trend
// ═══════════════════════════════════════════════════════════
export function MiniBarChart({ data, color = '#787774', height = 90 }) {
  if (!data || data.length === 0) return null
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label"
            tick={{ fontSize: 9.5, fill: 'var(--p-text-muted)', fontFamily: 'var(--p-font)' }}
            axisLine={false} tickLine={false} interval={0}
          />
          <YAxis hide />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--p-surface-3)' }} />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, marginTop: 2 }}>
        {data.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, color: 'var(--p-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {d.value}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Cost Bar Chart — monthly spend
// ═══════════════════════════════════════════════════════════
export function CostBarChart({ data, color = '#2C6B4F', height = 90 }) {
  if (!data || data.length === 0) return null
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label"
            tick={{ fontSize: 9.5, fill: 'var(--p-text-muted)', fontFamily: 'var(--p-font)' }}
            axisLine={false} tickLine={false} interval={0}
          />
          <YAxis hide />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--p-surface-3)' }}
            formatter={(v) => [`$${Number(v).toFixed(4)}`, '']}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Status Badge
// ═══════════════════════════════════════════════════════════
const BADGE = {
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
  cms:              { cls: 'badge-gray',   label: 'CMS' },
  static:           { cls: 'badge-gray',   label: 'Static' },
}

export function StatusBadge({ status }) {
  const c = BADGE[status] || { cls: 'badge-gray', label: status || '—' }
  return <span className={'badge ' + c.cls}>{c.label}</span>
}

// ═══════════════════════════════════════════════════════════
// Checkpoint Badge
// ═══════════════════════════════════════════════════════════
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
    if (data.executedAt) return <span className="badge badge-green">Done</span>
    return <span className="badge badge-gray">T+30d</span>
  }
  return null
}

// ═══════════════════════════════════════════════════════════
// KPI Card
// ═══════════════════════════════════════════════════════════
export function KpiCard({ icon, label, value, delta, deltaLabel, color = '#2C6B4F', bg }) {
  const style = { '--kpi-color': color, '--kpi-bg': bg || (color + '20') }
  const isUp = typeof delta === 'number' && delta > 0
  const isDown = typeof delta === 'number' && delta < 0

  return (
    <div className="kpi-card" style={style}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-value">{value ?? '—'}</div>
      <div className="kpi-label">{label}</div>
      {delta !== undefined && (
        <div className={`kpi-delta ${isUp ? 'up' : isDown ? 'down' : 'neutral'}`}>
          {isUp ? '↑' : isDown ? '↓' : '→'} {Math.abs(delta)} {deltaLabel}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Progress Meter
// ═══════════════════════════════════════════════════════════
export function ProgressMeter({ value, max, label, showPct = true }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const cls = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : ''
  return (
    <div className="cost-meter">
      <div className="cost-meter-labels">
        <span>{label}</span>
        {showPct && <span className="cost-meter-amount">{pct.toFixed(1)}%</span>}
      </div>
      <div className="progress-bar-wrap">
        <div className={`progress-bar-fill ${cls}`} style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
    </div>
  )
}
