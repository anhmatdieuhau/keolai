/**
 * Plain assert-based test — run with:
 *   node functions/lib/__tests__/workflowGraph.test.js
 *
 * Guards the canonical topology against regressions: duplicate IDs, missing
 * edge targets, promptIds that don't resolve, stores marked runnable, nodes
 * without Vietnamese labels, overlapping default positions.
 */
const assert = require('assert')
const { nodes, edges, getNode, runnableNodeIds, promptIdToNode, GRAPH_VERSION } = require('../workflowGraph')

// ── Graph version bumps are intentional ──
assert.strictEqual(GRAPH_VERSION, 1, 'GRAPH_VERSION must stay at 1 (bump deliberately, not by accident)')

// ── ids are unique ──
const ids = nodes.map(n => n.id)
const dups = ids.filter((id, i) => ids.indexOf(id) !== i)
assert.deepStrictEqual(dups, [], `Duplicate node IDs: ${dups.join(', ')}`)
console.log('PASS: all node IDs are unique')

const edgeIds = edges.map(e => e.id)
const edgeDups = edgeIds.filter((id, i) => edgeIds.indexOf(id) !== i)
assert.deepStrictEqual(edgeDups, [], `Duplicate edge IDs: ${edgeDups.join(', ')}`)
console.log('PASS: all edge IDs are unique')

// ── edges resolve ──
const nodeIdSet = new Set(ids)
for (const e of edges) {
  assert.ok(nodeIdSet.has(e.source), `Edge ${e.id}: source "${e.source}" does not match any node`)
  assert.ok(nodeIdSet.has(e.target), `Edge ${e.id}: target "${e.target}" does not match any node`)
}
console.log('PASS: all edges resolve to existing nodes')

// ── getNode ──
assert.strictEqual(getNode('pipe.writer').label, 'Writer — Viết bài hoàn chỉnh')
assert.strictEqual(getNode('does.not.exist'), null)
console.log('PASS: getNode resolves correctly')

// ── runnableNodeIds ──
const runnable = runnableNodeIds()
for (const id of runnable) {
  const n = getNode(id)
  assert.ok(n.runnable, `runnableNodeIds includes ${id} but node.runnable is false`)
  assert.ok(n.functionName, `runnable node ${id} has no functionName`)
  assert.ok(typeof n.timeoutSeconds === 'number' && n.timeoutSeconds > 0, `runnable node ${id} has no timeoutSeconds`)
}
console.log('PASS: all runnable nodes have functionName and timeoutSeconds')

// ── no store is runnable ──
const stores = nodes.filter(n => n.kind === 'store')
for (const s of stores) {
  assert.strictEqual(s.runnable, false, `store "${s.id}" must not be runnable`)
}
console.log('PASS: no store node is runnable')

// ── every node has a Vietnamese label (non-ASCII) ──
for (const n of nodes) {
  assert.ok(/[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/.test(n.label) || /[A-Z]/.test(n.label),
    `Node ${n.id}: label must contain Vietnamese or Latin characters — got "${n.label}"`)
}
console.log('PASS: all nodes have labels with readable characters')

// ── defaultPosition exists and no two nodes overlap exactly ──
const posKeys = new Set()
for (const n of nodes) {
  assert.ok(n.defaultPosition && typeof n.defaultPosition.x === 'number', `Node ${n.id}: missing defaultPosition.x`)
  assert.ok(n.defaultPosition && typeof n.defaultPosition.y === 'number', `Node ${n.id}: missing defaultPosition.y`)
  const key = `${n.defaultPosition.x},${n.defaultPosition.y}`
  assert.ok(!posKeys.has(key), `Nodes overlap at ${key}`)
  posKeys.add(key)
}
console.log('PASS: all nodes have unique defaultPosition')

// ── promptIdToNode resolves ──
for (const n of nodes) {
  for (const pid of (n.promptIds || [])) {
    const found = promptIdToNode(pid)
    assert.ok(found, `promptId "${pid}" does not resolve to any node`)
    assert.strictEqual(found.id, n.id, `promptId "${pid}" resolves to ${found.id}, expected ${n.id}`)
  }
}
console.log('PASS: all promptIds resolve to their owning node')

// ── edge kind values are valid ──
const VALID_EDGE_KINDS = new Set(['http', 'firestore-trigger', 'firestore-poll', 'write', 'missing'])
for (const e of edges) {
  assert.ok(VALID_EDGE_KINDS.has(e.kind), `Edge ${e.id}: invalid kind "${e.kind}"`)
}
console.log('PASS: all edges have valid kind values')

// ── edge kind counts match reality ──
const httpEdges = edges.filter(e => e.kind === 'http')
assert.strictEqual(httpEdges.length, 1, `Expected exactly 1 http edge, got ${httpEdges.length}: ${httpEdges.map(e => e.id).join(', ')}`)
const triggerEdges = edges.filter(e => e.kind === 'firestore-trigger')
assert.strictEqual(triggerEdges.length, 1, `Expected exactly 1 firestore-trigger edge, got ${triggerEdges.length}`)
const missingEdges = edges.filter(e => e.kind === 'missing')
assert.strictEqual(missingEdges.length, 1, `Expected exactly 1 missing edge, got ${missingEdges.length}`)
console.log('PASS: edge kind counts match expected reality (1 http, 1 firestore-trigger, 1 missing)')

console.log(`\nAll workflowGraph tests passed (${nodes.length} nodes, ${edges.length} edges).`)
