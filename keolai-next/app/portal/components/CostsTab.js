'use client'
import { MiniBarChart, CostBarChart, ProgressMeter } from './Charts'
import { IconTarget, IconCash, IconCalendar, StatusDot, IconCosts, IconTrend, IconRobot, IconBarChart, IconInbox, IconWarning } from './Icons'

const VND_PER_USD = 26500

function formatUsd(usd) {
  if (!usd) return '$0.0000'
  return `$${Number(usd).toFixed(4)}`
}
function formatVnd(usd) {
  return `${Math.round((usd || 0) * VND_PER_USD).toLocaleString('vi-VN')} ₫`
}

const MODEL_COLORS = {
  'gemini-3.6-flash': '#4285f4',
  'gemini-3.1-flash-lite': '#34a853',
  'gemini-3.0-flash-lite': '#fbbc05',
  'claude-sonnet-5': '#c18d46',
}
const MODEL_LABELS = {
  'gemini-3.6-flash': 'Gemini 3.6 Flash',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
  'gemini-3.0-flash-lite': 'Gemini 3.0 Flash Lite',
  'claude-sonnet-5': 'Claude Sonnet 5',
}

export default function CostsTab({ data }) {
  if (!data) return (
    <div className="portal-loading-skeleton" style={{ padding: 24 }}>
      <div className="skeleton-kpi-grid">
        {[1,2,3,4].map(i => <div key={i} className="skeleton-card" style={{ height: 100 }} />)}
      </div>
      <div className="skeleton-card" style={{ height: 200, marginTop: 24 }} />
    </div>
  )

  const { months = [], limitUsd = 1.85, rates = {} } = data

  const currentMonthKey = new Date().toISOString().slice(0, 7)
  const currentMonth = months.find(m => m.month === currentMonthKey) || months[months.length - 1]
  const spentUsd = currentMonth?.totalUsd || 0
  const pct = Math.min(100, (spentUsd / limitUsd) * 100)

  // Bar chart data (monthly totals)
  const barData = months.slice(-6).map(m => ({
    label: m.month?.slice(5) || '',
    value: m.totalUsd || 0,
  }))

  // All models seen across all months
  const allModels = new Set()
  months.forEach(m => Object.keys(m.models || {}).forEach(k => allModels.add(k)))

  // Per-model totals
  const modelTotals = {}
  months.forEach(m => {
    Object.entries(m.models || {}).forEach(([model, u]) => {
      if (!modelTotals[model]) modelTotals[model] = { calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 }
      modelTotals[model].calls += u.calls || 0
      modelTotals[model].tokensIn += u.tokensIn || 0
      modelTotals[model].tokensOut += u.tokensOut || 0
      modelTotals[model].costUsd += u.costUsd || 0
    })
  })

  const totalAllTime = Object.values(modelTotals).reduce((s, m) => s + (m.costUsd || 0), 0)

  const budgetStatus = pct >= 90 ? { cls: 'danger', label: 'Nguy hiểm', text: 'Gần hết ngân sách!' }
    : pct >= 70 ? { cls: 'warning', label: 'Cẩn thận', text: 'Đã dùng nhiều' }
    : { cls: 'success', label: 'Ổn định', text: 'Trong ngưỡng an toàn' }

  const statusColor = pct >= 90 ? '#9F2F2D' : pct >= 70 ? '#956400' : '#2C6B4F'

  return (
    <div>
      {/* Header KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi-card" style={{ '--kpi-color': statusColor }}>
          <div className="kpi-icon"><StatusDot color={statusColor} size={16} /></div>
          <div className="kpi-value">{formatVnd(spentUsd)}</div>
          <div className="kpi-label">Chi phí tháng này</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': '#1F6C9F' }}>
          <div className="kpi-icon"><IconTarget size={20} /></div>
          <div className="kpi-value">{formatVnd(limitUsd)}</div>
          <div className="kpi-label">Ngân sách / tháng</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': '#787774' }}>
          <div className="kpi-icon"><IconCash size={20} /></div>
          <div className="kpi-value">{formatVnd(limitUsd - spentUsd)}</div>
          <div className="kpi-label">Còn lại</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': '#956400' }}>
          <div className="kpi-icon"><IconCalendar size={20} /></div>
          <div className="kpi-value">{formatVnd(totalAllTime)}</div>
          <div className="kpi-label">Tổng tất cả thời gian</div>
        </div>
      </div>

      {/* Budget Gauge */}
      <div className="card mb-6">
        <div className="card-header">
          <span className="card-title"><IconCosts size={16} /> Ngân Sách Tháng {currentMonthKey}</span>
          <span className={`badge badge-${budgetStatus.cls === 'success' ? 'green' : budgetStatus.cls === 'warning' ? 'yellow' : 'red'}`}>
            {budgetStatus.label}
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}>
            {/* Big gauge number */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{
                fontSize: 48, fontWeight: 900,
                color: statusColor,
                lineHeight: 1,
              }}>
                {pct.toFixed(0)}%
              </div>
              <div style={{ fontSize: 12, color: '#9E9C99', marginTop: 4 }}>{budgetStatus.text}</div>
            </div>

            {/* Progress + details */}
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ height: 20, background: '#F0EFEC', borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: statusColor,
                    borderRadius: 10,
                    transition: 'width 0.8s ease',
                  }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#787774' }}>
                <span>Đã dùng: <strong>{formatUsd(spentUsd)}</strong> ({formatVnd(spentUsd)})</span>
                <span>Giới hạn: <strong>{formatUsd(limitUsd)}</strong> ({formatVnd(limitUsd)})</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#9E9C99' }}>
                Tỷ giá: 1 USD ≈ {VND_PER_USD.toLocaleString('vi-VN')} VND
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row: Bar Chart + Model Breakdown */}
      <div className="dashboard-grid-2 mb-6">
        {/* Monthly bar chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><IconTrend size={16} /> Chi phí 6 tháng gần nhất</span>
          </div>
          <div className="card-body">
            {barData.length > 0 ? (
              <>
                <MiniBarChart
                  data={barData.map(b => ({ ...b, value: Math.round(b.value * VND_PER_USD) }))}
                  color="#2C6B4F"
                  height={100}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  {barData.map((b, i) => (
                    <div key={i} style={{ textAlign: 'center', fontSize: 11, color: '#9E9C99', flex: 1 }}>
                      {formatVnd(b.value)}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="portal-empty">
                <div className="portal-empty-icon"><IconBarChart size={24} /></div>
                <div className="portal-empty-title">Chưa có dữ liệu</div>
              </div>
            )}
          </div>
        </div>

        {/* Model breakdown current month */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><IconRobot size={16} /> Breakdown theo Model (tháng này)</span>
          </div>
          <div className="card-body">
            {currentMonth?.models && Object.keys(currentMonth.models).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(currentMonth.models).map(([model, usage]) => {
                  const label = MODEL_LABELS[model] || model
                  const color = MODEL_COLORS[model] || '#9E9C99'
                  const totalMonthCost = currentMonth.totalUsd || 1
                  const pctModel = totalMonthCost > 0 ? (usage.costUsd / totalMonthCost) * 100 : 0
                  return (
                    <div key={model}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color }}>{label}</span>
                        <span style={{ fontWeight: 700 }}>{formatVnd(usage.costUsd)} ({pctModel.toFixed(0)}%)</span>
                      </div>
                      <div className="progress-bar-wrap">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${pctModel}%`, background: color }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 11, color: '#9E9C99' }}>
                        <span>{usage.calls} calls</span>
                        <span>{(usage.tokensIn || 0).toLocaleString()} in</span>
                        <span>{(usage.tokensOut || 0).toLocaleString()} out</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="portal-empty">
                <div className="portal-empty-icon"><IconRobot size={24} /></div>
                <div className="portal-empty-title">Chưa có AI usage tháng này</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* All-time model table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><IconBarChart size={16} /> Tổng hợp tất cả thời gian theo Model</span>
        </div>
        <div className="table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Calls</th>
                <th>Tokens In</th>
                <th>Tokens Out</th>
                <th>Chi phí (USD)</th>
                <th>Chi phí (VND)</th>
                <th>Rate In/Out</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(modelTotals).length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="portal-empty">
                      <div className="portal-empty-icon"><IconBarChart size={24} /></div>
                      <div className="portal-empty-title">Chưa có dữ liệu chi phí</div>
                      <div className="portal-empty-sub">Dữ liệu sẽ xuất hiện sau khi pipeline chạy lần đầu</div>
                    </div>
                  </td>
                </tr>
              )}
              {Object.entries(modelTotals).map(([model, totals]) => {
                const rate = rates[model] || {}
                const label = MODEL_LABELS[model] || model
                const color = MODEL_COLORS[model] || '#9E9C99'
                return (
                  <tr key={model}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{label}</span>
                      </div>
                    </td>
                    <td><span style={{ fontWeight: 700 }}>{totals.calls.toLocaleString()}</span></td>
                    <td><span className="mono">{totals.tokensIn.toLocaleString()}</span></td>
                    <td><span className="mono">{totals.tokensOut.toLocaleString()}</span></td>
                    <td><span style={{ fontWeight: 700 }}>{formatUsd(totals.costUsd)}</span></td>
                    <td><span style={{ fontWeight: 700, color: '#2C6B4F' }}>{formatVnd(totals.costUsd)}</span></td>
                    <td>
                      <span className="mono" style={{ fontSize: 11, color: '#9E9C99' }}>
                        ${rate.in}/M · ${rate.out}/M
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rate info */}
      <div style={{ marginTop: 16, fontSize: 12, color: '#9E9C99', padding: '12px 16px', background: '#F7F6F3', borderRadius: 8 }}>
        <strong><IconWarning size={14} /> Pricing note:</strong> Rates verified 2026-07-25. Gemini 3.6 Flash: $1.5/$7.0 per 1M tokens. Gemini 3.1 Flash Lite: $0.25/$1.5 per 1M tokens. Claude Sonnet 5 (intro đến 31/8/2026): $2/$10 per 1M tokens. Hard cap: $1.85/tháng = ~{formatVnd(1.85)}.
      </div>
    </div>
  )
}
