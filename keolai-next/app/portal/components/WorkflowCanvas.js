'use client'

import { useRef, useCallback, useState } from 'react'
import WorkflowNode from './WorkflowNode'

// ═══════════════════════════════════════════════════════════
// Edge layer — static SVG behind nodes
// ═══════════════════════════════════════════════════════════

const EDGE_STYLES = {
  http:              { stroke: 'var(--p-accent)', strokeWidth: 2.0, dash: '', opacity: 0.9 },
  'firestore-trigger': { stroke: 'var(--p-accent)', strokeWidth: 2.0, dash: '', opacity: 0.9 },
  'firestore-poll':  { stroke: 'var(--p-text-muted)', strokeWidth: 1.25, dash: '5 4', opacity: 0.55 },
  write:             { stroke: 'var(--p-text-muted)', strokeWidth: 1.0, dash: '3 3', opacity: 0.4 },
  missing:           { stroke: 'var(--p-text-muted)', strokeWidth: 1.0, dash: '2 6', opacity: 0.2 },
}

// Simple connector: arrow from source → target with midpoint bend
function computePath(src, tgt) {
  const sx = src.x + 180  // right edge of source
  const sy = src.y + 40   // vertical center
  const tx = tgt.x        // left edge of target
  const ty = tgt.y + 40   // vertical center
  const mx = (sx + tx) / 2
  return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`
}

function EdgesLayer({ edges, nodes, nodeMap }) {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 0 }}
      width="100%" height="100%"
    >
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="var(--p-text-muted)" />
        </marker>
        <marker id="arrowhead-accent" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="var(--p-accent)" />
        </marker>
      </defs>
      {edges.map(e => {
        const src = nodeMap[e.source]
        const tgt = nodeMap[e.target]
        if (!src || !tgt) return null
        const s = EDGE_STYLES[e.kind] || EDGE_STYLES.write
        return (
          <path
            key={e.id}
            d={computePath(
              { x: src._pos?.x ?? src.defaultPosition.x, y: src._pos?.y ?? src.defaultPosition.y },
              { x: tgt._pos?.x ?? tgt.defaultPosition.x, y: tgt._pos?.y ?? tgt.defaultPosition.y }
            )}
            fill="none"
            stroke={s.stroke}
            strokeWidth={s.strokeWidth}
            strokeDasharray={s.dash}
            opacity={s.opacity}
            markerEnd={e.kind === 'http' || e.kind === 'firestore-trigger' ? 'url(#arrowhead-accent)' : 'url(#arrowhead)'}
          />
        )
      })}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════
// Starvation BFS — which nodes are unreachable because an
// upstream node is disabled?
// ═══════════════════════════════════════════════════════════

function computeStarved(disabledSet, nodes, edges) {
  if (disabledSet.size === 0) return new Set()
  const starved = new Set()
  const q = [...disabledSet]
  const outgoing = {}
  for (const e of edges) {
    if (e.kind === 'missing') continue
    if (!outgoing[e.source]) outgoing[e.source] = []
    outgoing[e.source].push(e.target)
  }
  while (q.length) {
    const cur = q.shift()
    for (const tgt of (outgoing[cur] || [])) {
      if (!starved.has(tgt) && !disabledSet.has(tgt)) {
        starved.add(tgt)
        q.push(tgt)
      }
    }
  }
  return starved
}

// ═══════════════════════════════════════════════════════════
// Zoom levels
// ═══════════════════════════════════════════════════════════
const ZOOM_LEVELS = [0.75, 1.0, 1.25]
function clampZoom(z) { return Math.max(ZOOM_LEVELS[0], Math.min(ZOOM_LEVELS[ZOOM_LEVELS.length - 1], z)) }

// ═══════════════════════════════════════════════════════════
// Main canvas
// ═══════════════════════════════════════════════════════════
export default function WorkflowCanvas({
  nodes,
  edges,
  nodeMap,
  positions,
  disabledSet,
  lastRuns,
  selectedNodeId,
  zoom,
  onSelectNode,
  onZoomChange,
}) {
  const canvasRef = useRef(null)
  const dragRef = useRef(null)   // { nodeId, startX, startY, posX, posY, captured }
  const [dragOffset, setDragOffset] = useState({})
  const DRAG_THRESHOLD = 4       // px before drag starts (click = <4px move)

  // ── Starvation ──
  const starvedSet = computeStarved(disabledSet, nodes, edges)

  // Merge positions with defaults
  const resolved = {}
  for (const n of nodes) {
    const pos = positions[n.id] || n.defaultPosition
    const off = dragOffset[n.id] || { x: 0, y: 0 }
    resolved[n.id] = { x: pos.x + off.x, y: pos.y + off.y }
  }
  // Attach resolved positions for edge calculation
  const nodeMapWithPos = { ...nodeMap }
  for (const n of nodes) nodeMapWithPos[n.id] = { ...n, _pos: resolved[n.id] }

  // ── Pointer drag handlers (threshold: <4px = click, >=4px = drag) ──
  const handlePointerDown = useCallback((e, nodeId) => {
    e.stopPropagation()
    dragRef.current = {
      nodeId, startX: e.clientX, startY: e.clientY,
      posX: resolved[nodeId]?.x || 0, posY: resolved[nodeId]?.y || 0,
      captured: false,
    }
  }, [resolved])

  const handlePointerMove = useCallback((e) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    // Only start drag after threshold
    if (!d.captured && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
    if (!d.captured) {
      d.captured = true
      const el = document.querySelector('[data-node-id="' + d.nodeId + '"]')
      if (el) el.setPointerCapture(e.pointerId)
    }
    setDragOffset(prev => ({ ...prev, [d.nodeId]: { x: dx, y: dy } }))
  }, [])

  const handlePointerUp = useCallback((e) => {
    const d = dragRef.current
    if (!d) return
    if (d.captured) {
      const el = document.querySelector('[data-node-id="' + d.nodeId + '"]')
      if (el) el.releasePointerCapture(e.pointerId)
      // Commit offset permanently
      setDragOffset(prev => {
        const off = prev[d.nodeId] || { x: 0, y: 0 }
        const next = { ...prev }
        delete next[d.nodeId]
        return next
      })
    }
    // If never captured (<4px), onClick on the inner node fires normally
    dragRef.current = null
  }, [])

  // ── Zoom ──
  const handleZoomIn = () => onZoomChange?.(clampZoom(zoom + 0.25))
  const handleZoomOut = () => onZoomChange?.(clampZoom(zoom - 0.25))
  const handleZoomReset = () => onZoomChange?.(1.0)

  return (
    <div className="wf-canvas-wrap">
      {/* Zoom controls */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={handleZoomOut} disabled={zoom <= ZOOM_LEVELS[0]}>−</button>
        <span className="text-xs" style={{ color: 'var(--p-text-muted)', minWidth: 40, textAlign: 'center' }}>{(zoom * 100).toFixed(0)}%</span>
        <button className="btn btn-ghost btn-sm" onClick={handleZoomIn} disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}>+</button>
        <button className="btn btn-ghost btn-sm" onClick={handleZoomReset} style={{ marginLeft: 2 }}>1:1</button>
      </div>

      {/* Edge legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', fontSize: 10.5, color: 'var(--p-text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke="var(--p-accent)" strokeWidth="2" /></svg> HTTP / Event trigger
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke="var(--p-text-muted)" strokeWidth="1.25" strokeDasharray="5 4" /></svg> Firestore poll (trùng lịch)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke="var(--p-text-muted)" strokeWidth="1" strokeDasharray="3 3" /></svg> Write
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke="var(--p-text-muted)" strokeWidth="1" strokeDasharray="2 6" opacity="0.2" /></svg> Missing
        </span>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="wf-canvas"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* SVG edge layer */}
        <EdgesLayer edges={edges} nodes={nodes} nodeMap={nodeMapWithPos} />

        {/* Node layer */}
        {nodes.map(n => {
          const pos = resolved[n.id]
          return (
            <div
              key={n.id}
              data-node-id={n.id}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                width: 180,
                cursor: dragRef.current?.nodeId === n.id ? 'grabbing' : 'grab',
                userSelect: 'none',
                zIndex: 1,
              }}
              onPointerDown={e => handlePointerDown(e, n.id)}
            >
              <WorkflowNode
                node={n}
                isSelected={selectedNodeId === n.id}
                isDisabled={disabledSet.has(n.id)}
                isStarved={starvedSet.has(n.id)}
                lastRun={lastRuns?.[n.id]}
                onClick={() => onSelectNode?.(n)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
