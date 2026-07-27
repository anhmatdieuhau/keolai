'use client'

import { KpiCard, DonutChart, MiniBarChart, ProgressMeter } from './Charts'

const VND_PER_USD = 26500

function formatUsd(usd) {
  return `$${usd.toFixed(4)}`
}
function formatVnd(usd) {
  return `${Math.round(usd * VND_PER_USD).toLocaleString('vi-VN')} ₫`
}
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtWeekLabel(period) {
  if (!period) return ''
  return period.split(' → ')[0]?.slice(5) || period
}

export default function DashboardTab({ data, onAction }) {
  if (!data) return (
    <div className="portal-loading">
      <div className="portal-spinner" />
      <span>Đang tải dữ liệu tổng quan...</span>
    </div>
  )

  const { articles, topics, leads, cost, weeklyReports } = data

  // Topic donut chart data
  const topicDonut = [
    { label: 'Pending', value: topics?.pending || 0, color: '#f59e0b' },
    { label: 'Published', value: topics?.published || 0, color: '#10b981' },
    { label: 'Generating', value: topics?.generating || 0, color: '#3b82f6' },
    { label: 'Error', value: topics?.error || 0, color: '#ef4444' },
  ].filter(d => d.value > 0)

  // Weekly trend bars
  const weeklyBars = (weeklyReports || []).slice().reverse().map(r => ({
    label: fmtWeekLabel(r.period),
    value: r.newArticles || 0,
  }))

  const costPct = cost ? (cost.spentUsd / cost.limitUsd) * 100 : 0
  const costCls = costPct >= 90 ? 'danger' : costPct >= 70 ? 'warning' : ''

  // Alerts
  const alerts = []
  if (topics?.pending <= 3) {
    alerts.push({
      type: 'warning',
      title: '⚠️ Topic sắp hết!',
      body: `Chỉ còn ${topics.pending} topic đang chờ. Pipeline sẽ dừng nếu hết topic.`,
    })
  }
  if (costPct >= 90) {
    alerts.push({
      type: 'danger',
      title: '🔴 Ngân sách AI gần hết!',
      body: `Đã dùng ${formatVnd(cost.spentUsd)} / ${formatVnd(cost.limitUsd)} (${costPct.toFixed(0)}%)`,
    })
  }
  if (topics?.error > 0) {
    alerts.push({
      type: 'warning',
      title: `❌ ${topics.error} topic bị lỗi`,
      body: 'Vào tab Topics để xem chi tiết và retry.',
    })
  }

  return (
    <div>
      {/* Alerts */}
      {alerts.map((a, i) => (
        <div key={i} className={`alert alert-${a.type}`}>
          <div className="alert-text">
            <div className="alert-title">{a.title}</div>
            <div className="alert-body">{a.body}</div>
          </div>
        </div>
      ))}

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KpiCard
          icon="📝"
          label="Tổng bài viết"
          value={articles?.total ?? '—'}
          delta={articles?.thisMonth}
          deltaLabel="tháng này"
          color="#10b981"
        />
        <KpiCard
          icon="📅"
          label="Bài tuần này"
          value={articles?.thisWeek ?? '—'}
          delta={articles?.thisWeek}
          deltaLabel="vs tuần trước"
          color="#3b82f6"
          bg="#dbeafe"
        />
        <KpiCard
          icon="💡"
          label="Topic đang chờ"
          value={topics?.pending ?? '—'}
          color={topics?.pending <= 3 ? '#ef4444' : '#f59e0b'}
          bg={topics?.pending <= 3 ? '#fee2e2' : '#fef3c7'}
        />
        <KpiCard
          icon="👥"
          label="Leads tuần này"
          value={leads?.thisWeek ?? '—'}
          delta={leads?.thisWeek}
          deltaLabel="vs 0"
          color="#8b5cf6"
          bg="#ede9fe"
        />
      </div>

      {/* Row 2: Topic Health + Cost */}
      <div className="dashboard-grid-2 mb-6">
        {/* Topic Health Donut */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">💡 Topic Queue Health</span>
          </div>
          <div className="card-body">
            {topicDonut.length > 0 ? (
              <DonutChart data={topicDonut} size={140} />
            ) : (
              <div className="portal-empty">
                <div className="portal-empty-icon">📭</div>
                <div className="portal-empty-title">Chưa có topic</div>
              </div>
            )}
          </div>
        </div>

        {/* Cost Meter */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">💰 Chi Phí AI Tháng Này</span>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--p-font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 32, fontWeight: 700, letterSpacing: '-0.01em', color: costPct >= 90 ? '#ef4444' : '#182420' }}>
                  {formatVnd(cost?.spentUsd || 0)}
                </span>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>/ {formatVnd(cost?.limitUsd || 1.85)}</span>
              </div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatUsd(cost?.spentUsd || 0)} USD</span>
            </div>
            <ProgressMeter
              value={cost?.spentUsd || 0}
              max={cost?.limitUsd || 1.85}
              label={`Đã dùng: ${costPct.toFixed(1)}%`}
              showPct={false}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
              Còn lại: {formatVnd((cost?.limitUsd || 1.85) - (cost?.spentUsd || 0))}
            </div>

            {/* Model breakdown */}
            {cost?.breakdown && (
              <div style={{ marginTop: 16, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                {Object.entries(cost.breakdown)
                  .filter(([k]) => k !== 'updatedAt')
                  .map(([model, usage]) => (
                    <div key={model} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: '#64748b', fontFamily: 'monospace' }}>{model.replace('gemini-', 'G-').replace('claude-', 'C-')}</span>
                      <span style={{ fontWeight: 600 }}>{usage.calls || 0} calls</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Weekly Trend + Recent Reports */}
      <div className="dashboard-grid-2">
        {/* Weekly Trend Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📈 Bài viết theo tuần</span>
            <span className="card-subtitle">4 tuần gần nhất</span>
          </div>
          <div className="card-body">
            {weeklyBars.length > 0 ? (
              <>
                <MiniBarChart data={weeklyBars} color="#10b981" height={80} />
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weeklyBars.length}, 1fr)`, marginTop: 4 }}>
                  {weeklyBars.map((b, i) => (
                    <div key={i} style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                      {b.value} bài
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
                Chưa có báo cáo tuần
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions + Latest AI Summary */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🤖 AI Insights Tuần Này</span>
          </div>
          <div className="card-body">
            {weeklyReports?.[0]?.aiSummary ? (
              <div style={{ fontSize: 13, lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-line', maxHeight: 180, overflowY: 'auto' }}>
                {weeklyReports[0].aiSummary}
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: 13, padding: '20px 0' }}>
                Chưa có AI insights. Báo cáo tuần được tạo mỗi thứ Hai lúc 8AM.
              </div>
            )}
            {weeklyReports?.[0]?.period && (
              <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
                Kỳ: {weeklyReports[0].period}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <span className="card-title">⚡ Quick Actions</span>
        </div>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => onAction?.('cms')}>
            ✍️ Viết bài mới (CMS)
          </button>
          <button className="btn btn-accent" onClick={() => onAction?.('tab-topics')}>
            💡 Xem Topic Queue
          </button>
          <a
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
          >
            🔍 Google Search Console ↗
          </a>
          <a
            href="https://console.firebase.google.com/project/keolai-63ec1"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
          >
            🔥 Firebase Console ↗
          </a>
          <a
            href="https://analytics.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
          >
            📊 GA4 ↗
          </a>
        </div>
      </div>
    </div>
  )
}
