'use client'

import { IconRobot, IconBolt, IconCheck, IconClock, IconWarning, IconDatabase, IconUser, IconPlay, IconPower } from './Icons'

const KIND_ICON = {
  llm:           IconRobot,
  step:          IconBolt,
  gate:          IconCheck,
  'human-gate':  IconUser,
  store:         IconDatabase,
  sink:          IconDatabase,
  orchestrator:  IconPlay,
  api:           IconBolt,
  sensor:        IconBolt,
  missing:       IconWarning,
  default:       IconBolt,
}

const KIND_LABEL = {
  llm:           'LLM',
  step:          'Step',
  gate:          'Gate',
  'human-gate':  'Human',
  store:         'Store',
  sink:          'Sink',
  orchestrator:  'Orch',
  api:           'API',
  sensor:        'Sensor',
  missing:       'N/A',
}

function getKindIcon(kind) { return KIND_ICON[kind] || KIND_ICON.default }
function getKindLabel(kind) { return KIND_LABEL[kind] || kind }

export default function WorkflowNode({
  node,
  isSelected,
  isDisabled,
  isStarved,
  lastRun,
  onClick,
  style,
}) {
  const KindIcon = getKindIcon(node.kind)

  return (
    <div
      className={`wf-node wf-node--${node.kind}${isSelected ? ' is-selected' : ''}${isDisabled ? ' is-disabled' : ''}${isStarved ? ' is-starved' : ''}`}
      style={style}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onClick?.() }}
    >
      {/* Top row: kind badge + system badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="wf-chip">{getKindLabel(node.kind)}</span>
        <span className="wf-chip wf-chip--sys">{node.system === 'A' ? 'Pipeline' : 'MKT'}</span>
      </div>

      {/* Label */}
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--p-text)', lineHeight: 1.4, marginBottom: 6 }}>
        {node.label}
      </div>

      {/* Model + cost guard info */}
      {node.model && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          <KindIcon size={12} />
          <span className="mono" style={{ fontSize: 10.5 }}>{node.model}</span>
        </div>
      )}

      {/* Status badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
        {!node.costGuarded && (
          <span className="wf-badge wf-badge--warn" title="Không đi qua costGuard — chi phí không được ghi nhận">
            <IconWarning size={10} /> No cap
          </span>
        )}
        {node.trigger === 'cron' && (
          <span className="wf-badge wf-badge--info" title="Chạy theo lịch Cloud Scheduler">cron</span>
        )}
        {node.trigger === 'firestore' && (
          <span className="wf-badge wf-badge--info" title="Firestore trigger (onDocumentWritten)">event</span>
        )}
        {node.trigger === 'http' && (
          <span className="wf-badge wf-badge--info">HTTP</span>
        )}
        {node.trigger === 'firestore-poll' && (
          <span className="wf-badge" title="Không tự động — cron sau tình cờ đọc dữ liệu cron trước ghi">poll</span>
        )}
        {isStarved && (
          <span className="wf-badge wf-badge--starved" title="Node thượng nguồn đang bị tắt — sẽ không chạy">
            <IconPower size={10} /> starved
          </span>
        )}
        {isDisabled && (
          <span className="wf-badge wf-badge--off">OFF</span>
        )}
      </div>

      {/* Last run indicator */}
      {lastRun && (
        <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--p-border)', fontSize: 10.5, color: 'var(--p-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconClock size={10} />
          {lastRun.status === 'success' ? '✓' : lastRun.status === 'failed' ? '✗' : '…'}
          {' '}{new Date(lastRun.startedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
          {lastRun.durationMs != null && ` · ${(lastRun.durationMs / 1000).toFixed(1)}s`}
        </div>
      )}
    </div>
  )
}
