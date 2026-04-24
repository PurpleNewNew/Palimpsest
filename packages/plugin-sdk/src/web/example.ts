// Compile-time usage sample for the graph-workbench prop surface.
// This file exists to keep the type contracts exercised by
// `tsgo --noEmit` inside plugin-sdk itself, so regressions in the
// graph-workbench contract (see `specs/graph-workbench-pattern.md`)
// surface as a typecheck failure in this package rather than only in
// downstream plugins.
//
// This sample is not exported from the package's `exports` map.

import type { JSX } from "solid-js"

import type {
  CreateFormContext,
  DefaultAnchorAction,
  EdgeAdapter,
  EdgeCreateInput,
  LayoutFn,
  NodeAction,
  NodeAdapter,
  NodeGraphSlots,
  NodeGraphWorkbenchProps,
  Taxonomy,
} from "./graph-workbench"

type SampleNode = {
  id: string
  kind: "atom" | "finding" | "control"
  title: string
  severity?: "low" | "medium" | "high"
}

type SampleEdge = {
  id: string
  sourceID: string
  targetID: string
  kind: "depends-on" | "contradicts" | "supports"
  note?: string
}

// ─── NodeAction<N> ────────────────────────────────────────────────

// Minimum shape: id, label, handler.
const ask: NodeAction<SampleNode> = {
  id: "ask",
  label: "Ask",
  handler: async (node) => {
    // `node` is typed as SampleNode.
    void node.id
    void node.kind
  },
}

// With all optional fields: icon, enabled (per-node gate),
// requires (keyof PluginCapabilities).
const run: NodeAction<SampleNode> = {
  id: "run",
  label: "Run",
  icon: "play",
  enabled: (node) => node.kind === "finding" || node.kind === "atom",
  requires: "canRun",
  handler: async () => undefined,
}

// Lens-specific id string (non product-level verb) is allowed.
const markFalsePositive: NodeAction<SampleNode> = {
  id: "mark-false-positive",
  label: "Mark false positive",
  icon: "x-circle",
  requires: "canReview",
  enabled: (node) => node.kind === "finding",
  handler: () => {
    // synchronous handler is allowed.
  },
}

// Array of NodeAction<N> is the shape the graph workbench primitive
// expects on its `nodeActions` prop.
export const sampleNodeActions: Array<NodeAction<SampleNode>> = [ask, run, markFalsePositive]

// Negative assertion: `requires` must be a key of PluginCapabilities.
// The `requires` line intentionally uses an invalid key to lock the
// contract. If PluginCapabilities loses a flag or gains a non-boolean
// field, this file stops type-checking and the contract is rebroken in
// the open.
const invalidRequires: NodeAction<SampleNode> = {
  id: "bogus",
  label: "Bogus",
  // @ts-expect-error requires must be keyof PluginCapabilities
  requires: "canTeleport",
  handler: () => undefined,
}
void invalidRequires

// ─── Adapters ────────────────────────────────────────────────────

const nodeAdapter: NodeAdapter<SampleNode> = {
  id: (n) => n.id,
  kind: (n) => n.kind,
  title: (n) => n.title,
  status: (n) => (n.severity === "high" ? "proposed" : "committed"),
  meta: (n): Record<string, string> => (n.severity ? { severity: n.severity } : {}),
}

const edgeAdapter: EdgeAdapter<SampleEdge> = {
  id: (e) => e.id,
  source: (e) => e.sourceID,
  target: (e) => e.targetID,
  kind: (e) => e.kind,
  note: (e) => e.note,
}

// Minimum-shape edge adapter (omits optional id + note).
const minimalEdgeAdapter: EdgeAdapter<SampleEdge> = {
  source: (e) => e.sourceID,
  target: (e) => e.targetID,
  kind: (e) => e.kind,
}

// ─── Taxonomy ────────────────────────────────────────────────────

const taxonomy: Taxonomy = {
  nodeKinds: [
    { id: "atom", label: "Atom", color: "#7c3aed" },
    { id: "finding", label: "Finding", color: "#dc2626" },
    { id: "control", label: "Control", color: "#059669" },
  ],
  edgeKinds: [
    { id: "depends-on", label: "Depends on", color: "#64748b" },
    { id: "contradicts", label: "Contradicts", color: "#dc2626" },
    { id: "supports", label: "Supports", color: "#16a34a" },
  ],
  statusStates: [
    { id: "proposed", label: "Proposed", color: "#eab308", bg: "#fef9c3" },
    { id: "committed", label: "Committed", color: "#16a34a", bg: "#dcfce7" },
  ],
  legend: { nodeTitle: "FINDING TYPES", edgeTitle: "RELATIONS" },
}

// ─── Layout ──────────────────────────────────────────────────────

const customLayout: LayoutFn = (ctx) => {
  const positions: Record<string, { x: number; y: number }> = {}
  ctx.nodes.forEach((n, i) => {
    positions[n.id] = { x: i * 80, y: ctx.viewport.height / 2 }
  })
  return positions
}

// ─── Slots ───────────────────────────────────────────────────────

const slots: NodeGraphSlots<SampleNode> = {
  tooltip: (node): JSX.Element => (node.title ? node.title : null),
  createForm: (ctx: CreateFormContext): JSX.Element => {
    // ctx provides position, taxonomy, onSubmit, onCancel.
    void ctx.position.graphX
    void ctx.taxonomy.nodeKinds
    return null
  },
  nodeBadge: (node): JSX.Element => (node.severity === "high" ? "!" : null),
  anchorActions: (node, defaults): JSX.Element => {
    // defaults is DefaultAnchorAction[] — a discriminated union.
    const ids: Array<DefaultAnchorAction["id"]> = defaults.map((d) => d.id)
    void ids
    void node
    return null
  },
}

// ─── NodeGraphWorkbenchProps<N, E> ───────────────────────────────

// Minimum shape: data, adapters, taxonomy, projectID, lensID.
const minimalProps: NodeGraphWorkbenchProps<SampleNode, SampleEdge> = {
  nodes: [],
  edges: [],
  nodeAdapter,
  edgeAdapter: minimalEdgeAdapter,
  taxonomy,
  projectID: "proj_sample",
  lensID: "sample",
}
void minimalProps

// Full shape: every optional field wired.
const fullProps: NodeGraphWorkbenchProps<SampleNode, SampleEdge> = {
  nodes: [],
  edges: [],
  loading: false,
  error: false,
  nodeAdapter,
  edgeAdapter,
  taxonomy,
  onNodeClick: (id) => {
    void id
  },
  nodeActions: sampleNodeActions,
  onNodeCreate: async (input) => {
    // input is NodeCreateInput; returns the new node (Promise<N>).
    return {
      id: "n_new",
      kind: input.kind as SampleNode["kind"],
      title: input.name,
    }
  },
  onNodeDelete: async () => undefined,
  onEdgeCreate: async (input: EdgeCreateInput) => {
    void input.sourceID
  },
  onEdgeUpdate: async (input) => {
    // update carries previousKind.
    void input.previousKind
  },
  onEdgeDelete: async () => undefined,
  slots,
  projectID: "proj_sample",
  lensID: "sample",
  layout: "force",
}
void fullProps

// Layout prop accepts either a built-in hint or a custom LayoutFn.
const propsWithCustomLayout: NodeGraphWorkbenchProps<SampleNode, SampleEdge> = {
  ...minimalProps,
  layout: customLayout,
}
void propsWithCustomLayout

// ─── Negative assertions ─────────────────────────────────────────

// `layout` must be one of the four built-in hints or a LayoutFn.
const badLayoutHint: NodeGraphWorkbenchProps<SampleNode, SampleEdge> = {
  ...minimalProps,
  // @ts-expect-error "kanban" is not a LayoutHint
  layout: "kanban",
}
void badLayoutHint

// `NodeAdapter.id` must return a string.
const badNodeAdapter: NodeAdapter<SampleNode> = {
  // @ts-expect-error id must return string, not number
  id: (n) => n.id.length,
  kind: (n) => n.kind,
  title: (n) => n.title,
}
void badNodeAdapter

// `DefaultAnchorAction.id` is restricted to the three built-in ids.
// @ts-expect-error "open-detail" is not a DefaultAnchorAction id
const badDefault: DefaultAnchorAction = { id: "open-detail", enabled: true, invoke: () => {} }
void badDefault
