import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, useContext } from "solid-js"
import type { JSX } from "solid-js"
import { createStore, type SetStoreFunction } from "solid-js/store"
import { Graph } from "@antv/g6"

import { PLUGIN_CAPABILITIES_NONE, PluginWebHostContext } from "../host-web"
import type { PluginCapabilities } from "../host-web"

/**
 * Prop surface for the `<NodeGraphWorkbench>` primitive exported from
 * `@palimpsest/plugin-sdk/web/graph-workbench`.
 *
 * Type shapes mirror `specs/graph-workbench-pattern.md` (Props section,
 * lines 223-321). Any deviation is a spec bug.
 *
 * Generics:
 *
 * - `N` — the lens's node type (e.g., research `ResearchAtom`,
 *   security-audit `SecurityNode`).
 * - `E` — the lens's edge type (e.g., research `AtomRelation`).
 *
 * The primitive itself stays generic in both and accesses their fields
 * exclusively through `nodeAdapter` / `edgeAdapter`. The only knowledge
 * the primitive has of the shape of `N` and `E` is what the adapters
 * project.
 */
export type NodeGraphWorkbenchProps<N, E> = {
  // ─── Data ──────────────────────────────────────────────────
  /** Current node set; the primitive renders every entry. */
  nodes: N[]
  /** Current edge set; the primitive renders every entry. */
  edges: E[]
  /** If true, show a loading skeleton in place of the canvas. */
  loading?: boolean
  /** If true, show the primitive's error state. */
  error?: boolean

  // ─── A. Field adapters (map lens objects to graph fields) ──
  nodeAdapter: NodeAdapter<N>
  edgeAdapter: EdgeAdapter<E>

  // ─── B. Taxonomy (node / edge / status kinds as data) ──────
  taxonomy: Taxonomy

  // ─── C. Action callbacks (business ops) ────────────────────
  /** Plain click on a node. Convention: open the detail view in place. */
  onNodeClick?: (id: string) => void
  /** Per-node action registry; rendered in hover anchor toolbar. */
  nodeActions?: Array<NodeAction<N>>
  /** If absent, right-click on canvas is a no-op. */
  onNodeCreate?: (input: NodeCreateInput) => Promise<N>
  /** If absent, the anchor toolbar omits the default delete button. */
  onNodeDelete?: (id: string) => Promise<void>
  /** If absent, drag-to-connect is disabled. */
  onEdgeCreate?: (input: EdgeCreateInput) => Promise<void>
  /** If absent, edge click does not show the kind-editing popover. */
  onEdgeUpdate?: (input: EdgeUpdateInput) => Promise<void>
  /** If absent, the edge popover (if any) has no delete button. */
  onEdgeDelete?: (input: EdgeDeleteInput) => Promise<void>

  // ─── D. Presentation slots (Solid JSX; Portal-mounted) ─────
  slots?: NodeGraphSlots<N>

  // ─── E. Persistence ─────────────────────────────────────────
  /** Current project identifier; scopes `GraphStateManager` storage. */
  projectID: string
  /**
   * Lens identifier; distinguishes storage per lens so different
   * lenses on the same project keep independent node positions.
   * Storage key is `graph-state-<lensID>-<projectID>`.
   */
  lensID: string

  // ─── F. Layout strategy (optional; capability-driven default) ─
  layout?: LayoutHint | LayoutFn
}

/**
 * Field adapter that projects a lens's node type `N` down to the
 * graph-shaped fields the primitive knows how to render.
 *
 * Keeps the primitive free of lens-specific field names (no
 * `atom.atom_title`, no `finding.severity` at the primitive level).
 */
export type NodeAdapter<N> = {
  /** Stable id; used as the g6 node id and everywhere a node is referenced. */
  id: (n: N) => string
  /** Matches a {@link Taxonomy.nodeKinds} entry id. */
  kind: (n: N) => string
  /** Shown in tooltips, anchor toolbar label, detail chrome. */
  title: (n: N) => string
  /** Matches a {@link Taxonomy.statusStates} entry id, or `undefined` to omit. */
  status?: (n: N) => string | undefined
  /** Freeform key/value pairs for the default tooltip footer. */
  meta?: (n: N) => Record<string, string>
}

/**
 * Field adapter for edges. Source / target must return the ids of
 * existing nodes; `kind` must match a {@link Taxonomy.edgeKinds} entry.
 */
export type EdgeAdapter<E> = {
  /** Optional stable id. Default: `${source}-${kind}-${target}`. */
  id?: (e: E) => string
  source: (e: E) => string
  target: (e: E) => string
  /** Matches a {@link Taxonomy.edgeKinds} entry id. */
  kind: (e: E) => string
  /** Freeform edge annotation for tooltips. */
  note?: (e: E) => string | undefined
}

/**
 * Taxonomy configures node / edge kinds and (optionally) status states
 * as pure data. Each entry carries its own label and color so the
 * primitive never needs lens-specific lookup tables.
 */
export type Taxonomy = {
  /** Every possible node kind the lens uses. Used by create form. */
  nodeKinds: Array<{ id: string; label: string; color: string }>
  /** Every possible edge kind the lens uses. Used by edge kind chooser. */
  edgeKinds: Array<{ id: string; label: string; color: string }>
  /**
   * Optional status states. Lenses that participate in the
   * proposed/committed flow must at minimum declare entries with ids
   * `"proposed"` and `"committed"`. See `specs/graph-workbench-pattern.md`
   * Proposed vs. Committed Nodes.
   */
  statusStates?: Array<{ id: string; label: string; color: string; bg: string }>
  /** Header labels in the legend pane. Default: "NODE TYPES" / "RELATIONS". */
  legend?: { nodeTitle?: string; edgeTitle?: string }
}

/** Payload produced by the default create form (or a lens' `slots.createForm`). */
export type NodeCreateInput = {
  name: string
  kind: string
  position: { x: number; y: number }
}

export type EdgeCreateInput = {
  sourceID: string
  targetID: string
  kind: string
}

export type EdgeUpdateInput = EdgeCreateInput & {
  previousKind: string
}

export type EdgeDeleteInput = {
  sourceID: string
  targetID: string
  kind: string
}

/**
 * Entry in a lens's per-node action registry.
 *
 * Decision 2 of the spec restructure (see
 * `specs/graph-workbench-pattern.md`) replaces the old
 * `onNodeEnterWorkflow` callback with a `nodeActions: Array<NodeAction<N>>`
 * prop on `<NodeGraphWorkbench>`. The primitive renders each entry as a
 * button in the hover anchor toolbar (alongside the default add-edge /
 * delete / view-detail set) and, optionally, in the object workspace
 * right panel.
 *
 * Product-level verbs
 * (mirroring `@palimpsest/plugin-sdk/product` `ActionID`):
 *
 * - `"ask"`     — open a node-attached chat session
 * - `"run"`     — start a workflow run bound to this node
 * - `"propose"` — draft a change against the node (proposal-first)
 * - `"review"`  — review the latest proposal for this node
 * - `"inspect"` — inspect provenance / assets
 *
 * Lens-specific verbs are allowed as free-form string ids (for example
 * `"mark-false-positive"`, `"request-evidence"`, `"open-playbook"`).
 *
 * Gating:
 *
 * - `enabled(node)` — optional per-node gating (e.g., hide "run" on
 *   `control` nodes in security-audit).
 * - `requires` — optional capability gate; `keyof PluginCapabilities`
 *   ensures only valid boolean flags are accepted. The primitive hides
 *   an action whose corresponding flag is `false`. See
 *   `packages/plugin-sdk/src/host-web.ts` for the capability snapshot.
 *
 * The `handler` runs the action. Session creation, proposal drafting,
 * and all other domain side effects are lens concerns; the primitive
 * only supplies click wiring and capability gating.
 *
 * The `N` parameter is the lens's node type (for example research's
 * `ResearchAtom` or security-audit's `SecurityNode`), supplied by the
 * consumer of `<NodeGraphWorkbench>`.
 */
export type NodeAction<N> = {
  /**
   * Unique id for this action within the lens. Product-level verbs use
   * `"ask" | "propose" | "review" | "run" | "inspect"`; lens-specific
   * verbs (e.g., `"mark-false-positive"`) use any other string.
   */
  id: string
  /** Short label shown on the toolbar button. */
  label: string
  /** Optional Lucide icon name; defaults to a generic action icon. */
  icon?: string
  /** Runs when the user invokes this action against `node`. */
  handler: (node: N) => void | Promise<void>
  /**
   * Optional per-node gating. If provided and returns `false` for a
   * node, the action is hidden for that node. Useful for kind-scoped
   * verbs (e.g., only show `"run"` on `finding` nodes).
   */
  enabled?: (node: N) => boolean
  /**
   * Optional capability gate. If set and the corresponding
   * {@link PluginCapabilities} flag is `false`, the action is hidden
   * for every node regardless of `enabled`.
   *
   * Example:
   *
   * ```ts
   * { id: "run", label: "Run", handler, requires: "canRun" }
   * ```
   */
  requires?: keyof PluginCapabilities
}

/**
 * Built-in layout hints. The primitive ships default implementations
 * for all four; lenses that need a bespoke shape can pass a
 * {@link LayoutFn} instead.
 */
export type LayoutHint = "force" | "dagre" | "radial" | "circular"

/**
 * Custom layout function. Receives the current node / edge set plus
 * viewport dimensions and returns a map of node id → position.
 * The primitive is responsible for animating between layouts.
 */
export type LayoutFn = (ctx: {
  nodes: Array<{ id: string; kind: string }>
  edges: Array<{ source: string; target: string; kind: string }>
  viewport: { width: number; height: number }
}) => Record<string, { x: number; y: number }>

/**
 * The three default actions the primitive always renders in the hover
 * anchor toolbar when their underlying capability is wired.
 *
 * Passed to `slots.anchorActions` so a lens can embed its custom
 * toolbar around or between the defaults.
 */
export type DefaultAnchorAction =
  | { id: "add-edge"; enabled: boolean; invoke: () => void }
  | { id: "delete"; enabled: boolean; invoke: () => void }
  | { id: "view-detail"; enabled: boolean; invoke: () => void }

/**
 * Presentation slots. Each one is a Solid JSX function that the
 * primitive portals into the appropriate overlay. A slot left absent
 * falls back to the primitive's default rendering.
 */
export type NodeGraphSlots<N> = {
  /** Replaces the default hover tooltip card. */
  tooltip?: (node: N) => JSX.Element
  /** Replaces the default right-click create form. */
  createForm?: (ctx: CreateFormContext) => JSX.Element
  /** Small overlay on the node itself (e.g., severity dot). */
  nodeBadge?: (node: N) => JSX.Element
  /**
   * Replaces the default hover anchor toolbar contents. Receives the
   * node and the default action set so a lens can interleave custom
   * buttons with the defaults.
   */
  anchorActions?: (node: N, defaults: DefaultAnchorAction[]) => JSX.Element
}

/**
 * Context passed to `slots.createForm`. `onSubmit` wraps `onNodeCreate`
 * with the resolved graph position so the lens only needs to deal with
 * form state.
 */
export type CreateFormContext = {
  position: {
    viewportX: number
    viewportY: number
    graphX: number
    graphY: number
  }
  taxonomy: Taxonomy
  onSubmit: (input: NodeCreateInput) => Promise<void>
  onCancel: () => void
}

// ─── Runtime component ──────────────────────────────────────────
//
// In scope through 9a.6c:
// - g6 lifecycle (new Graph / setData / setLayout / destroy)
// - data projection through adapters (2-hop degree → node size)
// - taxonomy-driven node / edge coloring (with hover / dimmed /
//   connect-source / connect-target states)
// - 4 built-in layouts (force / dagre / radial / circular) + custom
//   LayoutFn via pre-applied positions
// - right-click-canvas → create form (default UI or slots.createForm)
// - hover anchor toolbar with three default actions (add-edge / delete
//   / view-detail) + capability-gated nodeActions, slots.anchorActions
//   override
// - tooltip (default card or slots.tooltip), onNodeClick, Ctrl/Cmd+click
//   focus pin, 110ms debounced dim effect
// - drag-to-connect: anchor "add-edge" button starts the draft. While
//   in "dragging" phase, an SVG dashed line follows the pointer and
//   tooltip / anchor / dim / click handlers are bypassed. Releasing on
//   a valid target node moves to "picking" phase, opening a kind picker
//   popover whose options come from taxonomy.edgeKinds. Selecting an
//   option calls onEdgeCreate({sourceID, targetID, kind}); cancel /
//   release on canvas / non-target node aborts the draft.
// - edge:click popover. Opens iff at least one of onEdgeUpdate /
//   onEdgeDelete is supplied. Highlights the current relation kind;
//   selecting a different row calls onEdgeUpdate({sourceID, targetID,
//   kind, previousKind}). Delete button (visible iff onEdgeDelete is
//   supplied) calls onEdgeDelete({sourceID, targetID, kind}). The
//   popover closes on canvas:click, ×, or successful mutation.
// - slots.nodeBadge: per-node JSX overlay tracked at the upper-right
//   of each node, sized relative to the node radius. Position map is
//   refreshed on viewportchange / node:drag / afterlayout / afterrender
//   / props.nodes change / container resize. Skipped entirely when the
//   slot is absent. Wrapper has pointer-events:none; lens slot may
//   re-enable via pointer-events:auto on its own root.
//
// Out of scope (landing in 9a.6d):
// - GraphStateManager persistence (positions + viewport zoom/center
//   keyed by graph-state-<lensID>-<projectID>)

const NODE_SIZE_MIN = 28
const NODE_SIZE_MAX = 60

const BUILTIN_LAYOUTS: Record<LayoutHint, Record<string, unknown>> = {
  force: {
    type: "force",
    linkDistance: 150,
    nodeStrength: 30,
    edgeStrength: 200,
    preventOverlap: true,
    nodeSize: 60,
    nodeSpacing: 20,
    coulombDisScale: 0.003,
  },
  dagre: {
    type: "dagre",
    rankdir: "TB",
    align: "UL",
    nodesep: 30,
    ranksep: 70,
    controlPoints: false,
  },
  radial: {
    type: "radial",
    linkDistance: 160,
    preventOverlap: true,
    nodeSize: 60,
    nodeSpacing: 16,
    unitRadius: 220,
    strictRadial: false,
    sortBy: "degree",
  },
  circular: {
    type: "circular",
    radius: 300,
    clockwise: true,
    divisions: 1,
    ordering: "degree",
    angleRatio: 1,
  },
}

type InternalNode = {
  id: string
  data: {
    kind: string
    title: string
    status: string | undefined
    size: number
  }
  style?: { x: number; y: number }
}

type InternalEdge = {
  id: string
  source: string
  target: string
  data: {
    kind: string
    note: string | undefined
  }
}

type InternalGraphData = { nodes: InternalNode[]; edges: InternalEdge[] }

function buildGraphData<N, E>(
  nodes: N[],
  edges: E[],
  nodeAdapter: NodeAdapter<N>,
  edgeAdapter: EdgeAdapter<E>,
): InternalGraphData {
  const ids = nodes.map(nodeAdapter.id)
  const adj = new Map<string, Set<string>>()
  for (const id of ids) adj.set(id, new Set())
  for (const e of edges) {
    const s = edgeAdapter.source(e)
    const t = edgeAdapter.target(e)
    adj.get(s)?.add(t)
    adj.get(t)?.add(s)
  }
  const degree2 = new Map<string, number>()
  for (const [id, neighbors] of adj) {
    const reach = new Set<string>(neighbors)
    for (const nb of neighbors) {
      for (const nb2 of adj.get(nb) ?? []) {
        if (nb2 !== id) reach.add(nb2)
      }
    }
    degree2.set(id, reach.size)
  }
  const maxDeg = Math.max(1, ...degree2.values())
  const sizeFor = (id: string) => {
    const d = degree2.get(id) ?? 0
    return Math.round(NODE_SIZE_MIN + (d / maxDeg) * (NODE_SIZE_MAX - NODE_SIZE_MIN))
  }

  const g6Nodes: InternalNode[] = nodes.map((n) => ({
    id: nodeAdapter.id(n),
    data: {
      kind: nodeAdapter.kind(n),
      title: nodeAdapter.title(n),
      status: nodeAdapter.status?.(n),
      size: sizeFor(nodeAdapter.id(n)),
    },
  }))

  const g6Edges: InternalEdge[] = edges.map((e) => {
    const src = edgeAdapter.source(e)
    const tgt = edgeAdapter.target(e)
    const kind = edgeAdapter.kind(e)
    return {
      id: edgeAdapter.id?.(e) ?? `${src}-${kind}-${tgt}`,
      source: src,
      target: tgt,
      data: { kind, note: edgeAdapter.note?.(e) },
    }
  })

  return { nodes: g6Nodes, edges: g6Edges }
}

/**
 * If `layout` is a custom function, pre-compute positions and apply
 * them as initial `style.x/y` on each node. g6 honors explicit
 * coordinates when they are present on data nodes and no layout
 * config overrides them.
 */
function applyCustomLayout(
  data: InternalGraphData,
  layout: LayoutHint | LayoutFn | undefined,
  viewport: { width: number; height: number },
): InternalGraphData {
  if (typeof layout !== "function") return data
  const positions = layout({
    nodes: data.nodes.map((n) => ({ id: n.id, kind: n.data.kind })),
    edges: data.edges.map((e) => ({ source: e.source, target: e.target, kind: e.data.kind })),
    viewport,
  })
  return {
    edges: data.edges,
    nodes: data.nodes.map((n) => {
      const pos = positions[n.id]
      return pos ? { ...n, style: { x: pos.x, y: pos.y } } : n
    }),
  }
}

function buildGraphOptions(
  taxonomy: Taxonomy,
  layout: LayoutHint | LayoutFn | undefined,
): Record<string, unknown> {
  const nodeKindIndex = new Map(taxonomy.nodeKinds.map((k) => [k.id, k]))
  const edgeKindIndex = new Map(taxonomy.edgeKinds.map((k) => [k.id, k]))
  const nodeColor = (kind: string) => nodeKindIndex.get(kind)?.color ?? "#6366f1"
  const edgeColor = (kind: string) => edgeKindIndex.get(kind)?.color ?? "#94a3b8"
  // Custom LayoutFn uses pre-applied positions (see applyCustomLayout).
  // In that case we still pass `force` to g6 so it does not try to
  // re-layout and overwrite our coordinates during the initial
  // render — force honors fixed positions on nodes that carry
  // style.x/y.
  const layoutConfig =
    typeof layout === "function" ? BUILTIN_LAYOUTS.force : BUILTIN_LAYOUTS[layout ?? "force"]
  return {
    autoFit: "view",
    padding: 10,
    node: {
      type: "circle",
      style: {
        size: (d: { data?: { size?: number } }) => d.data?.size ?? 40,
        fill: "#1e293b",
        fillOpacity: 1,
        stroke: (d: { data?: { kind?: string } }) => nodeColor(d.data?.kind ?? ""),
        strokeOpacity: 1,
        lineWidth: 2,
        cursor: "pointer",
        shadowColor: "rgba(0,0,0,0.25)",
        shadowBlur: 8,
        shadowOffsetY: 2,
      },
      state: {
        hover: {
          size: (d: { data?: { size?: number } }) => (d.data?.size ?? 40) + 16,
          stroke: "#f8fafc",
          lineWidth: 4,
          shadowColor: "rgba(248,250,252,0.32)",
          shadowBlur: 18,
        },
        dimmed: {
          fillOpacity: 0.15,
          strokeOpacity: 0.12,
          size: (d: { data?: { size?: number } }) =>
            Math.max(14, Math.round((d.data?.size ?? 40) * 0.6)),
          lineWidth: 1,
          shadowBlur: 0,
        },
        "connect-source": {
          stroke: "#818cf8",
          lineWidth: 3,
          shadowColor: "rgba(99,102,241,0.35)",
          shadowBlur: 18,
        },
        "connect-target": {
          size: (d: { data?: { size?: number } }) => (d.data?.size ?? 40) + 12,
          stroke: "#f8fafc",
          lineWidth: 4,
          shadowColor: "rgba(248,250,252,0.4)",
          shadowBlur: 16,
        },
      },
      animation: false,
    },
    edge: {
      style: {
        stroke: (d: { data?: { kind?: string } }) => edgeColor(d.data?.kind ?? ""),
        fillOpacity: 1,
        strokeOpacity: 1,
        lineWidth: 1.5,
        endArrow: true,
        endArrowSize: 6,
      },
      state: {
        hover: {
          stroke: "#e2e8f0",
          lineWidth: 3,
        },
        dimmed: {
          fillOpacity: 0.08,
          strokeOpacity: 0.08,
          lineWidth: 0.5,
        },
      },
      animation: false,
    },
    layout: layoutConfig,
    behaviors: [
      { type: "drag-canvas", key: "drag-canvas" },
      { type: "zoom-canvas", key: "zoom-canvas" },
      { type: "drag-element", key: "drag-element", enable: true },
    ],
    animation: false,
  }
}

/**
 * Renders a graph workbench bound to a lens's `N` / `E` types via the
 * adapters in `props.nodeAdapter` / `props.edgeAdapter`.
 *
 * Step 9a.2 — minimal render. See the Runtime component header comment
 * above for the exact in-scope / out-of-scope split.
 */
export function NodeGraphWorkbench<N, E>(props: NodeGraphWorkbenchProps<N, E>): JSX.Element {
  let containerRef: HTMLDivElement | undefined
  let graph: Graph | undefined
  let ro: ResizeObserver | undefined
  const [containerReady, setContainerReady] = createSignal(false)

  // Create form state (shared by default popover and by slots.createForm)
  // plus a pending-placement signal so newly created nodes land at the
  // exact viewport coordinates where the user right-clicked, once they
  // appear in props.nodes.
  const [form, setForm] = createStore({
    open: false,
    vx: 0,
    vy: 0,
    gx: 0,
    gy: 0,
    name: "",
    kind: "",
    saving: false,
    error: "",
  })
  const [pending, setPending] = createSignal<{ id: string; x: number; y: number } | undefined>(
    undefined,
  )
  const defaultKind = () => props.taxonomy.nodeKinds[0]?.id ?? ""

  const closeForm = () => {
    setForm("open", false)
  }

  const openForm = (clientX: number, clientY: number) => {
    if (!containerRef || !graph || !props.onNodeCreate) return
    hideAnchor()
    const rect = containerRef.getBoundingClientRect()
    const vx = clientX - rect.left
    const vy = clientY - rect.top
    const pad = 16
    const w = 260
    const h = 230
    // g6 5.x exposes getCanvasByViewport([vx, vy]) but the typings
    // occasionally trail behind the runtime; fall back to viewport
    // coords if unavailable (distorts position but never throws).
    const toCanvas = (graph as unknown as { getCanvasByViewport?: (p: number[]) => number[] })
      .getCanvasByViewport
    const [gx, gy] = toCanvas ? toCanvas.call(graph, [vx, vy]) : [vx, vy]
    setForm({
      open: true,
      vx: Math.min(Math.max(vx, pad), Math.max(pad, rect.width - w - pad)),
      vy: Math.min(Math.max(vy, pad), Math.max(pad, rect.height - h - pad)),
      gx,
      gy,
      name: "",
      kind: defaultKind(),
      saving: false,
      error: "",
    })
  }

  const runCreate = async (input: NodeCreateInput) => {
    const create = props.onNodeCreate
    if (!create) return
    const created = await create(input)
    setPending({ id: props.nodeAdapter.id(created), x: input.position.x, y: input.position.y })
    closeForm()
  }

  const submit = async () => {
    if (form.saving) return
    const name = form.name.trim()
    if (!name) {
      setForm("error", "Name is required")
      return
    }
    const kind = form.kind || defaultKind()
    if (!kind) {
      setForm("error", "Select a node kind")
      return
    }
    setForm({ saving: true, error: "" })
    try {
      await runCreate({ name, kind, position: { x: form.gx, y: form.gy } })
    } catch (err) {
      setForm({
        saving: false,
        error: err instanceof Error ? err.message : "Failed to create node",
      })
    }
  }

  // Hover anchor toolbar state + capabilities snapshot.
  //
  // Capability snapshot lives on PluginWebHostContext. When no host is
  // mounted (tests, preview shells, stories) we fall back to the
  // all-false snapshot so `requires`-gated actions stay hidden until a
  // provider supplies real flags.
  const host = useContext(PluginWebHostContext)
  const caps = createMemo<PluginCapabilities>(
    () => host?.capabilities() ?? PLUGIN_CAPABILITIES_NONE,
  )

  const [anchor, setAnchor] = createStore({
    open: false,
    nodeId: "",
    x: 0,
    y: 0,
  })
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let anchorPinned = false

  const clearHideTimer = () => {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = undefined
    }
  }

  const hideAnchor = () => {
    clearHideTimer()
    anchorPinned = false
    setAnchor({ open: false, nodeId: "" })
  }

  const scheduleHideAnchor = () => {
    clearHideTimer()
    hideTimer = setTimeout(() => {
      if (anchorPinned) return
      setAnchor({ open: false, nodeId: "" })
    }, 110)
  }

  const showAnchor = (nodeId: string) => {
    if (!graph) return
    const proj = (graph as unknown as { getViewportByCanvas?: (p: number[]) => number[] })
      .getViewportByCanvas
    if (!proj) return
    try {
      const gp = graph.getElementPosition(nodeId) as unknown as number[]
      const [vx, vy] = proj.call(graph, gp)
      clearHideTimer()
      setAnchor({ open: true, nodeId, x: vx - 24, y: vy })
    } catch {
      // g6 throws if the id is unknown mid-update; anchor stays closed.
    }
  }

  const hoverNode = (): N | undefined => {
    if (!anchor.open || !anchor.nodeId) return undefined
    const id = anchor.nodeId
    return props.nodes.find((n) => props.nodeAdapter.id(n) === id)
  }

  const defaultActions = (nodeId: string): DefaultAnchorAction[] => {
    const list: DefaultAnchorAction[] = []
    if (props.onEdgeCreate) {
      list.push({
        id: "add-edge",
        enabled: true,
        invoke: () => beginDraft(nodeId),
      })
    }
    if (props.onNodeDelete) {
      list.push({
        id: "delete",
        enabled: true,
        invoke: () => {
          hideAnchor()
          void props.onNodeDelete?.(nodeId)
        },
      })
    }
    if (props.onNodeClick) {
      list.push({
        id: "view-detail",
        enabled: true,
        invoke: () => {
          hideAnchor()
          props.onNodeClick?.(nodeId)
        },
      })
    }
    return list
  }

  const visibleActions = (node: N): Array<NodeAction<N>> => {
    const list = props.nodeActions ?? []
    const c = caps()
    return list.filter((a) => {
      if (a.enabled && !a.enabled(node)) return false
      if (a.requires && !c[a.requires]) return false
      return true
    })
  }

  const runAction = (action: NodeAction<N>, node: N) => {
    hideAnchor()
    void action.handler(node)
  }

  // Tooltip + focus pin + dim state.
  //
  // Focus pin is Ctrl/Cmd+click on a node: the dim neighborhood locks
  // to that node and the tooltip freezes at the click coordinates.
  // While pinned, hover on other nodes still toggles the anchor
  // toolbar but does not replace the tooltip or dim set. A plain
  // click (no modifier) just calls props.onNodeClick.
  const [tip, setTip] = createStore({
    open: false,
    nodeId: "",
    x: 0,
    y: 0,
  })
  const [focusedId, setFocusedId] = createSignal("")
  let dimTimer: ReturnType<typeof setTimeout> | undefined
  let pendingDimId = ""

  const clearDimTimer = () => {
    if (dimTimer) {
      clearTimeout(dimTimer)
      dimTimer = undefined
    }
  }

  const neighborsOf = (nodeId: string): Set<string> => {
    const set = new Set<string>()
    for (const e of props.edges) {
      const s = props.edgeAdapter.source(e)
      const t = props.edgeAdapter.target(e)
      if (s === nodeId) set.add(t)
      if (t === nodeId) set.add(s)
    }
    return set
  }

  type DimGraph = {
    getNodeData: () => Array<{ id: string | number }>
    getEdgeData: () => Array<{ id: string | number; source: string; target: string }>
    setElementState: (
      states: Record<string, string[]>,
      animate?: boolean,
    ) => Promise<void> | void
  }

  const applyDim = (nodeId: string) => {
    if (!graph) return
    const g = graph as unknown as DimGraph
    const neighbors = neighborsOf(nodeId)
    neighbors.add(nodeId)
    const states: Record<string, string[]> = {}
    for (const n of g.getNodeData()) {
      const id = String(n.id)
      states[id] = id === nodeId ? ["hover"] : neighbors.has(id) ? [] : ["dimmed"]
    }
    for (const ed of g.getEdgeData()) {
      const id = String(ed.id)
      states[id] = ed.source === nodeId || ed.target === nodeId ? [] : ["dimmed"]
    }
    void g.setElementState(states, true)
  }

  const clearDim = () => {
    if (!graph) return
    const g = graph as unknown as DimGraph
    const states: Record<string, string[]> = {}
    for (const n of g.getNodeData()) states[String(n.id)] = []
    for (const ed of g.getEdgeData()) states[String(ed.id)] = []
    void g.setElementState(states, true)
  }

  const scheduleDim = (nodeId: string) => {
    if (focusedId()) return
    clearDimTimer()
    pendingDimId = nodeId
    dimTimer = setTimeout(() => {
      if (focusedId()) return
      if (pendingDimId) applyDim(pendingDimId)
      else clearDim()
    }, 110)
  }

  const showTip = (nodeId: string, clientX: number, clientY: number) => {
    if (focusedId() && focusedId() !== nodeId) return
    setTip({ open: true, nodeId, x: clientX, y: clientY })
  }

  const moveTip = (clientX: number, clientY: number) => {
    if (focusedId()) return
    if (!tip.open) return
    setTip({ x: clientX, y: clientY })
  }

  const hideTip = () => {
    if (focusedId()) return
    setTip({ open: false, nodeId: "" })
  }

  const focusNode = (nodeId: string, clientX: number, clientY: number) => {
    clearDimTimer()
    setFocusedId(nodeId)
    applyDim(nodeId)
    setTip({ open: true, nodeId, x: clientX, y: clientY })
  }

  const unfocus = () => {
    if (!focusedId()) return
    setFocusedId("")
    clearDimTimer()
    clearDim()
    setTip({ open: false, nodeId: "" })
  }

  const tipNode = (): N | undefined => {
    if (!tip.open || !tip.nodeId) return undefined
    const id = tip.nodeId
    return props.nodes.find((n) => props.nodeAdapter.id(n) === id)
  }

  // Drag-to-connect state machine. Three phases:
  //
  // - "idle"     — not dragging
  // - "dragging" — anchor add-edge button has been clicked; pointer is
  //                being tracked, an SVG overlay line follows the
  //                cursor, and hovering a node visually marks it as a
  //                candidate target via "connect-target" element state
  // - "picking"  — pointer was released on a valid target; the kind
  //                picker popover is open, waiting for the user to
  //                choose an edge kind from `taxonomy.edgeKinds`.
  //
  // The handler in props.onEdgeCreate is only invoked from "picking";
  // simply releasing the drag never auto-creates an edge.
  type DraftPhase = "idle" | "dragging" | "picking"
  const [draft, setDraft] = createStore({
    phase: "idle" as DraftPhase,
    sourceId: "",
    targetId: "",
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    saving: false,
    error: "",
  })

  type StateGraph = {
    setElementState: (
      states: Record<string, string[]>,
      animate?: boolean,
    ) => Promise<void> | void
  }

  const setNodeState = (nodeId: string, states: string[]) => {
    if (!graph || !nodeId) return
    const g = graph as unknown as StateGraph
    void g.setElementState({ [nodeId]: states }, true)
  }

  const beginDraft = (sourceId: string) => {
    if (!props.onEdgeCreate || !graph || !containerRef) return
    const proj = (graph as unknown as { getViewportByCanvas?: (p: number[]) => number[] })
      .getViewportByCanvas
    if (!proj) return
    let x = 0
    let y = 0
    try {
      const gp = graph.getElementPosition(sourceId) as unknown as number[]
      const v = proj.call(graph, gp)
      x = v[0]
      y = v[1]
    } catch {
      return
    }
    hideAnchor()
    unfocus()
    closeEdgePop()
    setNodeState(sourceId, ["connect-source"])
    setDraft({
      phase: "dragging",
      sourceId,
      targetId: "",
      startX: x,
      startY: y,
      endX: x,
      endY: y,
      saving: false,
      error: "",
    })
  }

  const moveDraft = (clientX: number, clientY: number) => {
    if (draft.phase !== "dragging" || !containerRef) return
    const r = containerRef.getBoundingClientRect()
    setDraft({ endX: clientX - r.left, endY: clientY - r.top })
  }

  const cancelDraft = () => {
    if (draft.sourceId) setNodeState(draft.sourceId, [])
    if (draft.targetId) setNodeState(draft.targetId, [])
    setDraft({
      phase: "idle",
      sourceId: "",
      targetId: "",
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
      saving: false,
      error: "",
    })
  }

  const finishDraft = (targetId: string) => {
    if (draft.phase !== "dragging") return
    if (!targetId || targetId === draft.sourceId) {
      cancelDraft()
      return
    }
    setNodeState(targetId, ["connect-target"])
    setDraft({ phase: "picking", targetId })
  }

  const submitDraft = (kind: string) => {
    if (!props.onEdgeCreate || draft.phase !== "picking" || draft.saving) return
    const sourceID = draft.sourceId
    const targetID = draft.targetId
    setDraft({ saving: true, error: "" })
    void (async () => {
      try {
        await props.onEdgeCreate?.({ sourceID, targetID, kind })
        cancelDraft()
      } catch (err) {
        setDraft({
          saving: false,
          error: err instanceof Error ? err.message : "Failed to create relation",
        })
      }
    })()
  }

  // Edge popover state. Opened on edge:click when at least one of
  // onEdgeUpdate / onEdgeDelete is supplied; otherwise edge clicks are
  // ignored (Capability-Driven UI). The popover floats at the click
  // position relative to the container, lets the user pick a new kind
  // (which calls onEdgeUpdate with previousKind) and/or delete the edge.
  const [edgePop, setEdgePop] = createStore({
    open: false,
    edgeId: "",
    x: 0,
    y: 0,
    saving: false,
    error: "",
  })

  const edgeIdOf = (e: E): string => {
    if (props.edgeAdapter.id) return props.edgeAdapter.id(e)
    return `${props.edgeAdapter.source(e)}-${props.edgeAdapter.kind(e)}-${props.edgeAdapter.target(e)}`
  }

  const popoverEdge = (): E | undefined => {
    if (!edgePop.open || !edgePop.edgeId) return undefined
    const id = edgePop.edgeId
    return props.edges.find((e) => edgeIdOf(e) === id)
  }

  const closeEdgePop = () => {
    setEdgePop({ open: false, edgeId: "", saving: false, error: "" })
  }

  const updateEdgeKind = (edge: E, newKind: string) => {
    if (!props.onEdgeUpdate || edgePop.saving) return
    const previousKind = props.edgeAdapter.kind(edge)
    if (previousKind === newKind) {
      closeEdgePop()
      return
    }
    const sourceID = props.edgeAdapter.source(edge)
    const targetID = props.edgeAdapter.target(edge)
    setEdgePop({ saving: true, error: "" })
    void (async () => {
      try {
        await props.onEdgeUpdate?.({ sourceID, targetID, kind: newKind, previousKind })
        closeEdgePop()
      } catch (err) {
        setEdgePop({
          saving: false,
          error: err instanceof Error ? err.message : "Failed to update relation",
        })
      }
    })()
  }

  const removeEdge = (edge: E) => {
    if (!props.onEdgeDelete || edgePop.saving) return
    const sourceID = props.edgeAdapter.source(edge)
    const targetID = props.edgeAdapter.target(edge)
    const kind = props.edgeAdapter.kind(edge)
    setEdgePop({ saving: true, error: "" })
    void (async () => {
      try {
        await props.onEdgeDelete?.({ sourceID, targetID, kind })
        closeEdgePop()
      } catch (err) {
        setEdgePop({
          saving: false,
          error: err instanceof Error ? err.message : "Failed to delete relation",
        })
      }
    })()
  }

  // Per-node viewport positions used by slots.nodeBadge. Tracked as a
  // signal of {id → {x, y, size}} so badges can be positioned relative
  // to each node's current screen location and size; size is sourced
  // from the g6 node data so badges respect 2-hop degree sizing. The
  // map is rebuilt by syncNodePositions on viewportchange / node:drag
  // / afterlayout / afterrender (and once after initial render); when
  // no nodeBadge slot is provided we skip work entirely.
  const [nodePositions, setNodePositions] = createSignal<
    Record<string, { x: number; y: number; size: number }>
  >({})

  type NodesGraph = {
    getNodeData: () => Array<{ id: string | number; data?: { size?: number } }>
    getViewportByCanvas: (p: number[]) => number[]
  }

  const syncNodePositions = () => {
    if (!graph || !props.slots?.nodeBadge) return
    const g = graph as unknown as Partial<NodesGraph>
    if (!g.getViewportByCanvas || !g.getNodeData) return
    const sizeOf = new Map<string, number>()
    for (const n of g.getNodeData()) sizeOf.set(String(n.id), n.data?.size ?? 40)
    const positions: Record<string, { x: number; y: number; size: number }> = {}
    for (const n of props.nodes) {
      const id = props.nodeAdapter.id(n)
      try {
        const gp = graph.getElementPosition(id) as unknown as number[]
        const v = g.getViewportByCanvas(gp)
        positions[id] = { x: v[0], y: v[1], size: sizeOf.get(id) ?? 40 }
      } catch {
        // Node not yet rendered; skip until next sync.
      }
    }
    setNodePositions(positions)
  }

  const setContainerRef = (el: HTMLDivElement) => {
    containerRef = el
    el.oncontextmenu = (evt) => evt.preventDefault()
    setContainerReady(true)
  }

  const syncSize = () => {
    if (!graph || !containerRef) return false
    const w = containerRef.clientWidth
    const h = containerRef.clientHeight
    if (w <= 0 || h <= 0) return false
    graph.resize(w, h)
    return true
  }

  const currentViewport = () => {
    const rect = containerRef?.getBoundingClientRect()
    return { width: rect?.width ?? 800, height: rect?.height ?? 600 }
  }

  const initGraph = () => {
    if (!containerRef) return
    const data = applyCustomLayout(
      buildGraphData(props.nodes, props.edges, props.nodeAdapter, props.edgeAdapter),
      props.layout,
      currentViewport(),
    )
    try {
      graph = new Graph({
        container: containerRef,
        data,
        ...buildGraphOptions(props.taxonomy, props.layout),
      } as ConstructorParameters<typeof Graph>[0])
      syncSize()
      graph.render().catch(() => {})
      // Right-click anywhere on canvas → open the create form at click
      // position. On a node or edge, cancel any pending form so the
      // default browser context menu is suppressed without leaking a
      // half-open popover.
      graph.on("canvas:contextmenu", (evt) => {
        const e = (evt as { originalEvent?: MouseEvent | PointerEvent }).originalEvent
        if (!e) return
        e.preventDefault()
        if (draft.phase !== "idle") return
        closeEdgePop()
        openForm(e.clientX, e.clientY)
      })
      graph.on("node:contextmenu", (evt) => {
        ;(evt as { originalEvent?: MouseEvent | PointerEvent }).originalEvent?.preventDefault()
        closeForm()
      })
      graph.on("edge:contextmenu", (evt) => {
        ;(evt as { originalEvent?: MouseEvent | PointerEvent }).originalEvent?.preventDefault()
        closeForm()
      })
      graph.on("canvas:click", () => {
        closeForm()
        hideAnchor()
        unfocus()
        closeEdgePop()
      })
      // Edge click popover. Only opens when at least one of
      // onEdgeUpdate / onEdgeDelete is supplied; otherwise edge clicks
      // are inert per Capability-Driven UI.
      graph.on("edge:click", (evt) => {
        if (draft.phase !== "idle") return
        if (!props.onEdgeUpdate && !props.onEdgeDelete) return
        const id = (evt as { target?: { id?: string } }).target?.id
        if (!id || !containerRef) return
        const e = (evt as { originalEvent?: MouseEvent | PointerEvent }).originalEvent
        if (!e) return
        const r = containerRef.getBoundingClientRect()
        setEdgePop({
          open: true,
          edgeId: id,
          x: e.clientX - r.left,
          y: e.clientY - r.top,
          saving: false,
          error: "",
        })
      })
      // Hover anchor toolbar + tooltip + debounced dim. Anchor is
      // always refreshed on enter/leave so the toolbar can follow
      // around while focus is pinned; tooltip + dim are skipped while
      // focused so Ctrl+click stays sticky.
      //
      // While drag-to-connect is in "dragging" or "picking" phase,
      // tooltip / anchor / dim / click handlers are bypassed and node
      // hover instead toggles the "connect-target" element state.
      graph.on("node:pointerenter", (evt) => {
        const id = (evt as { target?: { id?: string } }).target?.id
        if (!id) return
        if (draft.phase === "dragging") {
          if (id !== draft.sourceId) setNodeState(id, ["connect-target"])
          return
        }
        if (draft.phase === "picking") return
        const e = (evt as { originalEvent?: MouseEvent | PointerEvent }).originalEvent
        showAnchor(id)
        if (focusedId()) return
        if (e) showTip(id, e.clientX, e.clientY)
        scheduleDim(id)
      })
      graph.on("node:pointermove", (evt) => {
        const e = (evt as { originalEvent?: MouseEvent | PointerEvent }).originalEvent
        if (draft.phase === "dragging" && e) {
          moveDraft(e.clientX, e.clientY)
          return
        }
        if (draft.phase === "picking") return
        if (focusedId()) return
        if (!e) return
        moveTip(e.clientX, e.clientY)
      })
      graph.on("node:pointerleave", (evt) => {
        if (draft.phase === "dragging") {
          const id = (evt as { target?: { id?: string } }).target?.id
          if (id && id !== draft.sourceId) setNodeState(id, [])
          return
        }
        if (draft.phase === "picking") return
        scheduleHideAnchor()
        if (focusedId()) return
        hideTip()
        scheduleDim("")
      })
      graph.on("node:click", (evt) => {
        if (draft.phase !== "idle") return
        const id = (evt as { target?: { id?: string } }).target?.id
        if (!id) return
        const e = (evt as { originalEvent?: MouseEvent | PointerEvent }).originalEvent
        const ctrl = !!e && (e.metaKey || e.ctrlKey)
        if (ctrl && e) {
          if (focusedId() === id) unfocus()
          else focusNode(id, e.clientX, e.clientY)
          return
        }
        props.onNodeClick?.(id)
      })
      // Drag-to-connect endpoints. Released on a node → finishDraft
      // (opens the kind picker if valid). Released on canvas → cancel.
      graph.on("canvas:pointermove", (evt) => {
        if (draft.phase !== "dragging") return
        const e = (evt as { originalEvent?: MouseEvent | PointerEvent }).originalEvent
        if (!e) return
        moveDraft(e.clientX, e.clientY)
      })
      graph.on("node:pointerup", (evt) => {
        if (draft.phase !== "dragging") return
        const id = (evt as { target?: { id?: string } }).target?.id
        if (id) finishDraft(id)
        else cancelDraft()
      })
      graph.on("canvas:pointerup", () => {
        if (draft.phase !== "dragging") return
        cancelDraft()
      })
      // Node badge position sync. Each event triggers a re-read of
      // every node's viewport coords so the badge layer follows pan,
      // zoom, layout, and per-node drag. Gated on slots.nodeBadge so
      // there is zero work when no lens supplies a badge slot.
      graph.on("viewportchange", syncNodePositions)
      graph.on("node:drag", syncNodePositions)
      graph.on("node:dragend", syncNodePositions)
      graph.on("afterlayout", syncNodePositions)
      graph.on("afterrender", syncNodePositions)
    } catch {
      graph?.destroy()
      graph = undefined
    }
  }

  const updateGraph = () => {
    if (!graph) return
    const data = applyCustomLayout(
      buildGraphData(props.nodes, props.edges, props.nodeAdapter, props.edgeAdapter),
      props.layout,
      currentViewport(),
    )
    graph.setData(data as Parameters<Graph["setData"]>[0])
    graph.render().catch(() => {})
    syncNodePositions()
  }

  onMount(() => {
    if (!containerRef) return
    ro = new ResizeObserver(() => {
      syncSize()
      syncNodePositions()
    })
    ro.observe(containerRef)
  })

  // Data + container readiness effect: create the graph on first ready
  // frame, then keep `setData` in sync with props on subsequent changes.
  createEffect(() => {
    // track dependencies
    props.nodes
    props.edges
    if (!containerReady() || !containerRef) return
    if (!graph) {
      initGraph()
      return
    }
    updateGraph()
  })

  // Layout effect: switch `graph.setLayout` when the hint changes
  // (custom LayoutFn is already handled via pre-applied positions
  // inside buildGraphData → applyCustomLayout).
  createEffect(() => {
    if (!graph) return
    const layout = props.layout
    if (typeof layout === "function") return
    const config = BUILTIN_LAYOUTS[layout ?? "force"]
    ;(async () => {
      try {
        await graph?.setLayout(config as Parameters<Graph["setLayout"]>[0])
        await graph?.layout()
      } catch {
        // g6 layout can throw if data is mid-update; next effect fires.
      }
    })()
  })

  // Pending placement effect: after `onNodeCreate` resolves, slam the
  // new node to the exact coordinates the user right-clicked as soon
  // as it appears in props.nodes.
  createEffect(() => {
    // track dependency
    props.nodes
    const p = pending()
    if (!p || !graph) return
    const found = props.nodes.some((n) => props.nodeAdapter.id(n) === p.id)
    if (!found) return
    ;(async () => {
      try {
        const update = graph as unknown as {
          updateNodeData: (args: Array<{ id: string; style: { x: number; y: number } }>) => void
        }
        update.updateNodeData([{ id: p.id, style: { x: p.x, y: p.y } }])
        await graph?.draw()
      } catch {
        // best-effort placement; graph may be mid-update.
      }
      setPending(undefined)
    })()
  })

  onCleanup(() => {
    ro?.disconnect()
    try {
      graph?.destroy()
    } catch {
      // destroy is best-effort.
    }
  })

  return (
    <div ref={setContainerRef} class="w-full h-full min-h-[400px] relative">
      <Show when={props.loading}>
        <div class="absolute inset-0 flex items-center justify-center text-sm text-slate-400 pointer-events-none">
          Loading graph…
        </div>
      </Show>
      <Show when={props.error}>
        <div class="absolute inset-0 flex items-center justify-center text-sm text-red-400 pointer-events-none">
          Failed to load graph
        </div>
      </Show>
      <Show when={form.open}>
        <div
          class="absolute z-30 w-[260px] overflow-hidden rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.96)] shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
          style={{
            left: `${form.vx}px`,
            top: `${form.vy}px`,
            "backdrop-filter": "blur(12px)",
          }}
          onClick={(evt) => evt.stopPropagation()}
          onMouseDown={(evt) => evt.stopPropagation()}
        >
          <Show
            when={props.slots?.createForm}
            fallback={
              <DefaultCreateForm
                form={form}
                setForm={setForm}
                taxonomy={props.taxonomy}
                saving={form.saving}
                submit={submit}
                cancel={closeForm}
              />
            }
          >
            {(slot) =>
              slot()({
                position: {
                  viewportX: form.vx,
                  viewportY: form.vy,
                  graphX: form.gx,
                  graphY: form.gy,
                },
                taxonomy: props.taxonomy,
                onSubmit: runCreate,
                onCancel: closeForm,
              })
            }
          </Show>
        </div>
      </Show>
      <Show when={!form.open && anchor.open ? hoverNode() : undefined}>
        {(node) => {
          const current = node()
          const defaults = defaultActions(anchor.nodeId)
          const actions = visibleActions(current)
          // If the primitive has nothing to show (no backing callbacks,
          // no slot override, no filtered nodeActions), suppress the
          // toolbar entirely per the Capability-Driven UI contract.
          const hasSlot = !!props.slots?.anchorActions
          if (!hasSlot && defaults.length === 0 && actions.length === 0) return null
          return (
            <div
              class="absolute z-20"
              style={{
                left: `${anchor.x}px`,
                top: `${anchor.y}px`,
                transform: "translate(calc(-100% - 4px), -50%)",
              }}
              onMouseEnter={() => {
                anchorPinned = true
                clearHideTimer()
              }}
              onMouseLeave={() => {
                anchorPinned = false
                scheduleHideAnchor()
              }}
            >
              <Show
                when={props.slots?.anchorActions}
                fallback={
                  <DefaultAnchorToolbar
                    defaults={defaults}
                    actions={actions}
                    node={current}
                    runAction={runAction}
                  />
                }
              >
                {(slot) => slot()(current, defaults)}
              </Show>
            </div>
          )
        }}
      </Show>
      <Show when={!form.open && tip.open ? tipNode() : undefined}>
        {(node) => {
          // Viewport clamping: assume a ~280x220 tooltip and keep it
          // 8px inside the window. Fixed positioning so it follows the
          // mouse regardless of container transforms.
          const pad = 8
          const w = 280
          const h = 220
          const left = Math.max(pad, Math.min(tip.x + 14, window.innerWidth - w - pad))
          const top = Math.max(pad, Math.min(tip.y + 14, window.innerHeight - h - pad))
          return (
            <div
              class="pointer-events-none fixed z-40"
              style={{ left: `${left}px`, top: `${top}px` }}
            >
              <Show
                when={props.slots?.tooltip}
                fallback={
                  <DefaultTooltip
                    node={node()}
                    taxonomy={props.taxonomy}
                    adapter={props.nodeAdapter}
                  />
                }
              >
                {(slot) => slot()(node())}
              </Show>
            </div>
          )
        }}
      </Show>
      <Show when={draft.phase === "dragging"}>
        <svg class="absolute inset-0 z-20 pointer-events-none overflow-visible">
          <line
            x1={draft.startX}
            y1={draft.startY}
            x2={draft.endX}
            y2={draft.endY}
            stroke="#818cf8"
            stroke-width="2"
            stroke-dasharray="6 4"
            stroke-linecap="round"
          />
        </svg>
      </Show>
      <Show when={draft.phase === "picking"}>
        <div
          class="absolute z-30 w-[240px] overflow-hidden rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.96)] shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
          style={{
            left: `${draft.endX}px`,
            top: `${draft.endY}px`,
            transform: "translate(12px, -50%)",
            "backdrop-filter": "blur(12px)",
          }}
          onClick={(evt) => evt.stopPropagation()}
          onMouseDown={(evt) => evt.stopPropagation()}
        >
          <DraftKindPicker
            taxonomy={props.taxonomy}
            saving={draft.saving}
            error={draft.error}
            submit={submitDraft}
            cancel={cancelDraft}
          />
        </div>
      </Show>
      <Show when={edgePop.open ? popoverEdge() : undefined}>
        {(edge) => (
          <div
            class="absolute z-30 w-[260px] overflow-hidden rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.96)] shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
            style={{
              left: `${edgePop.x}px`,
              top: `${edgePop.y}px`,
              transform: "translate(12px, -50%)",
              "backdrop-filter": "blur(12px)",
            }}
            onClick={(evt) => evt.stopPropagation()}
            onMouseDown={(evt) => evt.stopPropagation()}
          >
            <EdgeActionPopover
              edge={edge()}
              adapter={props.edgeAdapter}
              taxonomy={props.taxonomy}
              saving={edgePop.saving}
              error={edgePop.error}
              canUpdate={!!props.onEdgeUpdate}
              canDelete={!!props.onEdgeDelete}
              updateKind={(k) => updateEdgeKind(edge(), k)}
              deleteEdge={() => removeEdge(edge())}
              cancel={closeEdgePop}
            />
          </div>
        )}
      </Show>
      <Show when={props.slots?.nodeBadge}>
        {(slot) => (
          <For each={props.nodes}>
            {(node) => {
              const id = props.nodeAdapter.id(node)
              const pos = () => nodePositions()[id]
              return (
                <Show when={pos()}>
                  {(p) => {
                    const r = p().size / 2
                    return (
                      <div
                        class="pointer-events-none absolute z-10"
                        style={{
                          left: `${p().x + r * 0.7}px`,
                          top: `${p().y - r * 0.7}px`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        {slot()(node)}
                      </div>
                    )
                  }}
                </Show>
              )
            }}
          </For>
        )}
      </Show>
    </div>
  )
}

function DefaultAnchorToolbar<N>(props: {
  defaults: DefaultAnchorAction[]
  actions: Array<NodeAction<N>>
  node: N
  runAction: (action: NodeAction<N>, node: N) => void
}): JSX.Element {
  return (
    <div class="flex flex-col gap-1 rounded-lg border border-white/10 bg-[rgba(15,23,42,0.88)] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-sm">
      <For each={props.defaults}>
        {(d) => (
          <button
            class="flex h-7 w-7 items-center justify-center rounded-md text-[#94a3b8] transition-all hover:bg-indigo-500/20 hover:text-indigo-400 disabled:opacity-40"
            title={defaultActionLabel(d.id)}
            disabled={!d.enabled}
            onMouseDown={(evt) => {
              evt.preventDefault()
              evt.stopPropagation()
              if (!d.enabled) return
              d.invoke()
            }}
          >
            <DefaultActionIcon id={d.id} />
          </button>
        )}
      </For>
      <Show when={props.defaults.length > 0 && props.actions.length > 0}>
        <div class="mx-1 h-px bg-white/8" />
      </Show>
      <For each={props.actions}>
        {(action) => (
          <button
            class="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[11px] font-medium text-[#cbd5e1] transition-all hover:bg-white/10 hover:text-[#e2e8f0]"
            title={action.label}
            onClick={(evt) => {
              evt.preventDefault()
              evt.stopPropagation()
              props.runAction(action, props.node)
            }}
          >
            {action.label}
          </button>
        )}
      </For>
    </div>
  )
}

function defaultActionLabel(id: DefaultAnchorAction["id"]): string {
  if (id === "add-edge") return "Create relation"
  if (id === "delete") return "Delete node"
  return "View in detail"
}

function DefaultActionIcon(props: { id: DefaultAnchorAction["id"] }): JSX.Element {
  return (
    <Show
      when={props.id === "add-edge"}
      fallback={
        <Show
          when={props.id === "delete"}
          fallback={
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="1" y="1" width="14" height="14" rx="2" />
              <line x1="9" y1="1" x2="9" y2="15" />
              <polyline points="5.5 6 3.5 8 5.5 10" />
            </svg>
          }
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M2 4h12M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l.8 9.1A1 1 0 0 0 4.8 14h6.4a1 1 0 0 0 1-.9L13 4" />
          </svg>
        </Show>
      }
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M10.5 5.5 C10.5 3.57 9.93 2 8 2 C6.07 2 5.5 3.57 5.5 5.5 L5.5 10.5 C5.5 12.43 6.07 14 8 14 C9.93 14 10.5 12.43 10.5 10.5" />
        <circle cx="5.5" cy="5.5" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="10.5" cy="10.5" r="1.8" fill="currentColor" stroke="none" />
      </svg>
    </Show>
  )
}

/**
 * Default tooltip card. Renders node title + kind chip (color from
 * taxonomy.nodeKinds) + status chip (color from taxonomy.statusStates
 * if present) + a meta footer built from nodeAdapter.meta().
 */
function DefaultTooltip<N>(props: {
  node: N
  taxonomy: Taxonomy
  adapter: NodeAdapter<N>
}): JSX.Element {
  const kindId = () => props.adapter.kind(props.node)
  const kind = () => props.taxonomy.nodeKinds.find((k) => k.id === kindId())
  const statusId = () => props.adapter.status?.(props.node)
  const status = () =>
    props.taxonomy.statusStates?.find((s) => s.id === statusId())
  const meta = () => {
    const get = props.adapter.meta
    if (!get) return [] as Array<[string, string]>
    const entries = Object.entries(get(props.node))
    return entries
  }
  return (
    <div class="w-[280px] overflow-hidden rounded-xl border border-white/10 bg-[rgba(15,23,42,0.94)] shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-sm">
      <div class="px-3 py-2.5">
        <div class="text-[13px] font-medium leading-tight text-[#e2e8f0]">
          {props.adapter.title(props.node)}
        </div>
        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Show when={kind()}>
            {(k) => (
              <span
                class="inline-flex items-center gap-1 rounded-md px-1.5 h-5 text-[10px] font-medium leading-none"
                style={{ background: `${k().color}20`, color: k().color }}
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  style={{ background: k().color }}
                />
                {k().label}
              </span>
            )}
          </Show>
          <Show when={status()}>
            {(s) => (
              <span
                class="inline-flex items-center rounded-md px-1.5 h-5 text-[10px] font-medium leading-none"
                style={{ background: s().bg, color: s().color }}
              >
                {s().label}
              </span>
            )}
          </Show>
        </div>
      </div>
      <Show when={meta().length > 0}>
        <div class="border-t border-white/8 bg-white/[0.02] px-3 py-2">
          <For each={meta()}>
            {([key, value]) => (
              <div class="flex items-baseline justify-between gap-2 text-[10px] leading-relaxed">
                <span class="text-[#64748b]">{key}</span>
                <span class="truncate text-right text-[#cbd5e1]">{value}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

/**
 * Default edge-action popover opened on edge:click. Shows the current
 * relation kind highlighted; clicking another row calls `updateKind`.
 * The delete button is rendered iff `canDelete` is true (i.e., the
 * lens supplied `onEdgeDelete`). The kind list is hidden when the
 * lens supplied no `onEdgeUpdate` so a delete-only popover stays
 * compact.
 */
function EdgeActionPopover<E>(props: {
  edge: E
  adapter: EdgeAdapter<E>
  taxonomy: Taxonomy
  saving: boolean
  error: string
  canUpdate: boolean
  canDelete: boolean
  updateKind: (kind: string) => void
  deleteEdge: () => void
  cancel: () => void
}): JSX.Element {
  const currentKind = () => props.adapter.kind(props.edge)
  return (
    <div class="px-3 py-3">
      <div class="mb-2 flex items-center justify-between">
        <div class="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
          {props.taxonomy.legend?.edgeTitle ?? "Relation"}
        </div>
        <button
          type="button"
          class="text-[14px] leading-none text-[#64748b] hover:text-white disabled:opacity-50"
          disabled={props.saving}
          onClick={props.cancel}
        >
          ×
        </button>
      </div>
      <Show when={props.canUpdate}>
        <div class="flex flex-col gap-1">
          <For each={props.taxonomy.edgeKinds}>
            {(kind) => {
              const selected = () => kind.id === currentKind()
              return (
                <button
                  type="button"
                  class="flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
                  classList={{
                    "border-white/20 bg-white/[0.08] text-white": selected(),
                    "border-white/5 bg-white/[0.03] text-[#e2e8f0] hover:bg-white/[0.08]":
                      !selected(),
                  }}
                  disabled={props.saving}
                  onClick={() => props.updateKind(kind.id)}
                >
                  <span
                    class="h-2 w-2 rounded-full"
                    style={{ background: kind.color }}
                  />
                  <span class="truncate">{kind.label}</span>
                  <Show when={selected()}>
                    <span class="ml-auto text-[10px] text-[#94a3b8]">current</span>
                  </Show>
                </button>
              )
            }}
          </For>
        </div>
      </Show>
      <Show when={props.error}>
        <div class="mt-2 rounded-md bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
          {props.error}
        </div>
      </Show>
      <Show when={props.canDelete}>
        <button
          type="button"
          class="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[12px] text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={props.saving}
          onClick={props.deleteEdge}
        >
          Delete relation
        </button>
      </Show>
    </div>
  )
}

/**
 * Default edge-kind picker shown after a successful drag-to-connect.
 * Lists `taxonomy.edgeKinds` as clickable rows; selecting a row calls
 * `submit(kind)`. Cancel closes the popover without creating an edge.
 */
function DraftKindPicker(props: {
  taxonomy: Taxonomy
  saving: boolean
  error: string
  submit: (kind: string) => void
  cancel: () => void
}): JSX.Element {
  return (
    <div class="px-3 py-3">
      <div class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
        {props.taxonomy.legend?.edgeTitle ?? "Relation"}
      </div>
      <div class="flex flex-col gap-1">
        <For each={props.taxonomy.edgeKinds}>
          {(kind) => (
            <button
              type="button"
              class="flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.03] px-2 py-1.5 text-left text-[12px] text-[#e2e8f0] hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={props.saving}
              onClick={() => props.submit(kind.id)}
            >
              <span
                class="h-2 w-2 rounded-full"
                style={{ background: kind.color }}
              />
              <span class="truncate">{kind.label}</span>
            </button>
          )}
        </For>
      </div>
      <Show when={props.error}>
        <div class="mt-2 rounded-md bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
          {props.error}
        </div>
      </Show>
      <div class="mt-2 flex justify-end">
        <button
          type="button"
          class="rounded-md px-2 py-1 text-[11px] text-[#94a3b8] hover:text-white disabled:opacity-50"
          disabled={props.saving}
          onClick={props.cancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

type FormStore = {
  open: boolean
  vx: number
  vy: number
  gx: number
  gy: number
  name: string
  kind: string
  saving: boolean
  error: string
}

function DefaultCreateForm(props: {
  form: FormStore
  setForm: SetStoreFunction<FormStore>
  taxonomy: Taxonomy
  saving: boolean
  submit: () => Promise<void>
  cancel: () => void
}): JSX.Element {
  return (
    <>
      <div class="border-b border-white/8 px-4 py-3">
        <div class="text-[10px] font-medium tracking-wider text-[#475569]">NEW NODE</div>
        <div class="mt-1 text-[13px] font-medium text-[#e2e8f0]">
          Create node at this location
        </div>
      </div>
      <div class="flex flex-col gap-3 px-4 py-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-medium text-[#94a3b8]">Name</label>
          <input
            value={props.form.name}
            onInput={(evt) => {
              props.setForm({ name: evt.currentTarget.value, error: "" })
            }}
            onKeyDown={(evt) => {
              if (evt.key === "Enter") {
                evt.preventDefault()
                void props.submit()
              } else if (evt.key === "Escape") {
                evt.preventDefault()
                props.cancel()
              }
            }}
            placeholder="e.g. Gradient stability bound"
            class="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-[13px] text-[#e2e8f0] outline-none transition-colors placeholder:text-[#475569] focus:border-cyan-400/60"
            autofocus
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-medium text-[#94a3b8]">Type</label>
          <div class="overflow-hidden rounded-lg border border-white/8 bg-white/[0.02] py-1">
            {props.taxonomy.nodeKinds.map((k) => {
              const selected = props.form.kind === k.id
              return (
                <button
                  class="w-full flex items-center gap-2.5 px-3 h-8 transition-colors text-left"
                  style={{
                    background: selected ? "rgba(99,102,241,0.15)" : "transparent",
                  }}
                  onClick={() => props.setForm({ kind: k.id, error: "" })}
                >
                  <span
                    class="w-2 h-2 rounded-full"
                    style={{ background: k.color }}
                  />
                  <span
                    class="text-[12px] leading-none"
                    style={{ color: selected ? "#e2e8f0" : "#cbd5e1" }}
                  >
                    {k.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <Show when={props.form.error}>
          <div class="text-[11px] text-red-400">{props.form.error}</div>
        </Show>
        <div class="flex items-center gap-2">
          <button
            class="h-8 rounded-md border border-white/10 bg-white/[0.02] px-3 text-[12px] text-[#94a3b8] transition-colors hover:text-[#e2e8f0]"
            onClick={props.cancel}
            disabled={props.saving}
          >
            Cancel
          </button>
          <button
            class="h-8 flex-1 rounded-md border border-cyan-400/40 bg-cyan-400/15 px-3 text-[12px] font-medium text-cyan-300 transition-colors hover:bg-cyan-400/25 disabled:opacity-50"
            onClick={() => void props.submit()}
            disabled={props.saving}
          >
            {props.saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </>
  )
}
