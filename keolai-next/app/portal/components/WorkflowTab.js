'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import WorkflowCanvas from './WorkflowCanvas'
import { KpiCard, ProgressMeter } from './Charts'
import { IconWorkflow, IconRobot, IconBolt, IconClock, IconRefresh, IconWarning } from './Icons'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Helpers ───────────────────────────────────────────────
function buildNodeMap(nodes) {
  const m = {}
  for (const n of nodes) m[n.id] = n
  return m
}

function buildLastRunMap(recentRuns) {
  const m = {}
  if (!recentRuns) return m
  for (const r of recentRuns) {
    if (!m[r.nodeId]) m[r.nodeId] = r
  }
  return m
}

// Load/save positions from localStorage (Stage 1). Stage 2 migrates to server.
const LS_KEY = 'keolai_workflow_positions'
function loadPositions() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {} }
  catch { return {} }
}
function savePositions(pos) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(pos)) }
  catch {}
}

// ═══════════════════════════════════════════════════════════
export default function WorkflowTab({ data }) {
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [disabledSet] = useState(new Set())   // Stage 2: load from nodeToggle
  const [zoom, setZoom] = useState(1.0)
  const [positions, setPositions] = useState({})

  // Load positions on mount
  useEffect(() => { setPositions(loadPositions()) }, [])

  // Loading skeleton
  if (!data) return (
    <div>
      <div className="kpi-grid">
        {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-kpi" />)}
      </div>
      <div className="skeleton" style={{ height: 500, borderRadius: 'var(--p-radius)' }} />
    </div>
  )

  const { graph, budget, recentRuns, pipelineCounts } = data
  const nodes = graph?.nodes || []
  const edges = graph?.edges || []
  const nodeMap = useMemo(() => buildNodeMap(nodes), [nodes])
  const lastRuns = useMemo(() => buildLastRunMap(recentRuns), [recentRuns])

  const selectedNode = selectedNodeId ? nodeMap[selectedNodeId] : null

  // ── KPI counts ──
  const llmNodes = nodes.filter(n => n.kind === 'llm' || n.kind === 'orchestrator')
  const costUnguarded = nodes.filter(n => !n.costGuarded && (n.kind === 'llm' || n.kind === 'orchestrator'))
  const runnableCount = nodes.filter(n => n.runnable).length
  const budgetPct = budget ? (budget.spentUsd / budget.limitUsd) * 100 : 0

  // ── Handlers ──
  const handleSelectNode = useCallback((node) => {
    setSelectedNodeId(prev => prev === node.id ? null : node.id)
  }, [])

  const handleSavePositions = useCallback(() => {
    // Merge drag deltas into positions and persist
    // For now just save whatever positions we have
    savePositions(positions)
  }, [positions])

  return (
    <div>
      {/* KPI Header */}
      <div className="kpi-grid">
        <KpiCard icon={<IconWorkflow size={20} />} label="Nodes" value={nodes.length} color="#787774" />
        <KpiCard icon={<IconRobot size={20} />} label="LLM Agents" value={llmNodes.length}
          color="#2C6B4F" />
        <KpiCard icon={<IconBolt size={20} />} label="Runnable" value={runnableCount}
          color="#787774" />
        <KpiCard icon={<IconWarning size={20} />} label="Bypass costGuard"
          value={costUnguarded.length}
          color={costUnguarded.length > 0 ? '#956400' : '#2C6B4F'}
          bg={costUnguarded.length > 0 ? '#FBF3DB' : '#EDF3EC'}
        />
      </div>

      {/* Budget bar */}
      {budget && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title"><IconClock size={16} /> Ngân sách AI tháng này</span>
          </div>
          <div className="card-body">
            <ProgressMeter
              value={budget.spentUsd}
              max={budget.limitUsd}
              label={`Đã dùng: $${budget.spentUsd.toFixed(3)} / $${budget.limitUsd}`}
            />
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--p-text-muted)' }}>
              Còn lại: ${(budget.limitUsd - budget.spentUsd).toFixed(3)} USD
              {pipelineCounts?.pendingTopics != null && ` · ${pipelineCounts.pendingTopics} topic đang chờ`}
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <WorkflowCanvas
        nodes={nodes}
        edges={edges}
        nodeMap={nodeMap}
        positions={positions}
        disabledSet={disabledSet}
        lastRuns={lastRuns}
        selectedNodeId={selectedNodeId}
        zoom={zoom}
        onSelectNode={handleSelectNode}
        onZoomChange={setZoom}
      />

      {/* Node detail drawer */}
      {selectedNode && (
        <div className="wf-drawer-overlay" onClick={() => setSelectedNodeId(null)} />
      )}
      <div className={`wf-drawer${selectedNode ? ' is-open' : ''}`}>
        {selectedNode && (
          <>
            <div className="wf-drawer-header">
              <div>
                <div className="wf-drawer-title">{selectedNode.label}</div>
                <div className="wf-drawer-sub">{selectedNode.id}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedNodeId(null)}>✕</button>
            </div>

            <div className="wf-drawer-body">
              {/* Meta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <div><div className="text-xs" style={{ color: 'var(--p-text-muted)' }}>System</div><div className="mono">{selectedNode.system === 'A' ? 'Content Pipeline' : 'Marketing Agent'}</div></div>
                <div><div className="text-xs" style={{ color: 'var(--p-text-muted)' }}>Kind</div><div>{selectedNode.kind}</div></div>
                <div><div className="text-xs" style={{ color: 'var(--p-text-muted)' }}>Model</div><div className="mono">{selectedNode.model || '—'}</div></div>
                <div><div className="text-xs" style={{ color: 'var(--p-text-muted)' }}>Timeout</div><div className="mono">{selectedNode.timeoutSeconds ? `${selectedNode.timeoutSeconds}s` : '—'}</div></div>
                <div><div className="text-xs" style={{ color: 'var(--p-text-muted)' }}>Trigger</div><div className="mono">{selectedNode.trigger}</div></div>
                <div><div className="text-xs" style={{ color: 'var(--p-text-muted)' }}>Runnable</div><div>{selectedNode.runnable ? '✓ Yes' : '—'}</div></div>
              </div>

              {/* Cost Guard status */}
              <div className={`alert ${selectedNode.costGuarded ? 'alert-success' : 'alert-warning'}`}>
                <div className="alert-icon"><IconWarning size={14} /></div>
                <div className="alert-text">
                  <div className="alert-title">{selectedNode.costGuarded ? 'Đi qua costGuard' : 'BYPASS costGuard'}</div>
                  <div className="alert-body">
                    {selectedNode.costGuarded
                      ? 'Chi phí được ghi nhận và kiểm soát trong ngân sách tháng.'
                      : 'Node này KHÔNG gọi recordUsage — chi phí không được ghi nhận và không bị chặn khi vượt ngân sách.'}
                  </div>
                </div>
              </div>

              {/* Note */}
              {selectedNode.note && (
                <div className="alert alert-info" style={{ marginTop: 12 }}>
                  <div className="alert-text">
                    <div className="alert-title">Ghi chú</div>
                    <div className="alert-body" style={{ whiteSpace: 'pre-line' }}>{selectedNode.note}</div>
                  </div>
                </div>
              )}

              {/* Last run */}
              {lastRuns[selectedNode.id] && (
                <div style={{ marginTop: 16 }}>
                  <div className="text-xs" style={{ color: 'var(--p-text-muted)', marginBottom: 6 }}>Lần chạy cuối</div>
                  <div className="mono" style={{ fontSize: 11 }}>
                    {lastRuns[selectedNode.id].status} · {fmtDate(lastRuns[selectedNode.id].startedAt)}
                    {lastRuns[selectedNode.id].durationMs != null && ` · ${(lastRuns[selectedNode.id].durationMs / 1000).toFixed(1)}s`}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
