import { Show, type JSX } from "solid-js"
import {
  NodeGraphWorkbench,
  type EdgeAdapter,
  type LayoutFn,
  type NodeAdapter,
} from "@palimpsest/plugin-sdk/web/graph-workbench"

import type { SecurityEdge, SecurityNode } from "../context/security-audit"

import { SECURITY_TAXONOMY } from "./security-taxonomy"

const NODE_ADAPTER: NodeAdapter<SecurityNode> = {
  id: (n) => n.id,
  kind: (n) => n.kind,
  title: (n) => n.title,
  status: (n) => {
    const v = n.data?.["reviewState"]
    return typeof v === "string" ? v : undefined
  },
  meta: (n) => {
    const out: Record<string, string> = {}
    const sev = n.data?.["severity"]
    if (typeof sev === "string") out.Severity = sev
    const conf = n.data?.["confidence"]
    if (typeof conf === "string") out.Confidence = conf
    const src = n.data?.["sourceRunID"]
    if (typeof src === "string") out.Source = src
    return out
  },
}

const EDGE_ADAPTER: EdgeAdapter<SecurityEdge> = {
  id: (e) => e.id ?? `${e.sourceID}-${e.kind}-${e.targetID}`,
  source: (e) => e.sourceID,
  target: (e) => e.targetID,
  kind: (e) => e.kind,
  note: (e) => e.note ?? undefined,
}

/**
 * Column-based fixed layout migrated 1:1 from the legacy SVG
 * `layout()` helper in `workbench.tsx`. Six kinds map to six columns;
 * `target` and `assumption` share the left column (with assumption
 * pinned lower); `surface` and `control` share the second column on
 * a similar split; `finding` is its own column; `risk` and any
 * unrecognized kinds (`other` bucket) share the rightmost column.
 *
 * Coordinates are in graph-space; `<NodeGraphWorkbench>` feeds them
 * to g6 via the `LayoutFn` path which writes `style.x/y` on each node
 * directly, bypassing the force / dagre / radial / circular built-ins.
 */
const SECURITY_LAYOUT: LayoutFn = (ctx) => {
  const cols: Record<string, { x: number; yBase: number; ids: string[] }> = {
    target: { x: 90, yBase: 110, ids: [] },
    surface: { x: 250, yBase: 110, ids: [] },
    finding: { x: 430, yBase: 110, ids: [] },
    risk: { x: 610, yBase: 110, ids: [] },
    control: { x: 250, yBase: 360, ids: [] },
    assumption: { x: 90, yBase: 360, ids: [] },
    other: { x: 610, yBase: 110, ids: [] },
  }
  for (const n of ctx.nodes) {
    const col = cols[n.kind] ?? cols.other
    col.ids.push(n.id)
  }
  const positions: Record<string, { x: number; y: number }> = {}
  for (const col of Object.values(cols)) {
    col.ids.forEach((id, idx) => {
      positions[id] = { x: col.x, y: col.yBase + idx * 92 }
    })
  }
  return positions
}

function severityColor(s: string): string {
  if (s === "critical") return "#dc2626"
  if (s === "high") return "#ef4444"
  if (s === "medium") return "#f59e0b"
  if (s === "low") return "#a3a3a3"
  return "#64748b"
}

/**
 * Per-node severity dot rendered via `slots.nodeBadge` at each node's
 * upper-right corner. Only renders when `node.data.severity` is set;
 * findings without a severity flag stay clean.
 */
function SeverityBadge(props: { node: SecurityNode }): JSX.Element {
  const sev = () => {
    const v = props.node.data?.["severity"]
    return typeof v === "string" ? v : ""
  }
  return (
    <Show when={sev()}>
      {(value) => (
        <span
          class="block size-2 rounded-full ring-2 ring-[rgba(15,23,42,0.96)]"
          style={{ background: severityColor(value()) }}
          title={`severity: ${value()}`}
        />
      )}
    </Show>
  )
}

/**
 * Security audit lens binding around the generic `<NodeGraphWorkbench>`.
 *
 * Replaces the hand-rolled SVG `GraphCanvas` in `workbench.tsx` with the
 * shared primitive driven by `SECURITY_TAXONOMY`, the security
 * `NodeAdapter` / `EdgeAdapter`, and a fixed column layout that
 * reproduces the baseline visual arrangement.
 *
 * No mutation callbacks are wired (no `onNodeCreate` / `onNodeDelete` /
 * `onEdgeCreate` / `onEdgeUpdate` / `onEdgeDelete`) — security-audit's
 * graph is workflow-driven; humans reach mutations through the proposal
 * review tray and per-node session, not by editing the graph directly.
 * Per the primitive's Capability-Driven UI, this means the right-click
 * create form, drag-to-connect, edge popover, and anchor delete /
 * add-edge buttons are all suppressed automatically.
 *
 * Plain click on a node calls `props.onSelect(node)`, which the
 * workbench wires to its detail panel / fullscreen overlay. The default
 * anchor toolbar shows only a single `view-detail` button (because that
 * is the only default action whose backing callback is supplied), and
 * it routes through the same `onNodeClick` handler.
 *
 * Persistence keys are scoped to `lensID="security-audit"` so a future
 * research lens on the same project does not collide.
 */
export function SecurityGraphCanvas(props: {
  nodes: SecurityNode[]
  edges: SecurityEdge[]
  projectID: string
  onSelect: (node: SecurityNode) => void
}): JSX.Element {
  return (
    <NodeGraphWorkbench<SecurityNode, SecurityEdge>
      nodes={props.nodes}
      edges={props.edges}
      loading={false}
      error={false}
      nodeAdapter={NODE_ADAPTER}
      edgeAdapter={EDGE_ADAPTER}
      taxonomy={SECURITY_TAXONOMY}
      projectID={props.projectID}
      lensID="security-audit"
      layout={SECURITY_LAYOUT}
      onNodeClick={(id) => {
        const node = props.nodes.find((n) => n.id === id)
        if (node) props.onSelect(node)
      }}
      slots={{
        nodeBadge: (node) => <SeverityBadge node={node} />,
      }}
    />
  )
}
