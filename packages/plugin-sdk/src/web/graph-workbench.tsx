import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { JSX } from "solid-js"
import { Graph } from "@antv/g6"

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
// Step 9a.2 scope: minimal render only. g6 lifecycle, data projection
// through adapters (including 2-hop degree → node size), taxonomy-driven
// node/edge coloring, and 4 built-in layouts (force / dagre / radial /
// circular) + custom LayoutFn.
//
// Out of scope for 9a.2 (landing in 9a.3–9a.6):
// interactions (click / hover / drag-to-connect), slots (tooltip /
// createForm / nodeBadge / anchorActions), focus pin + debounced dim,
// and `GraphStateManager` persistence.

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
  }

  onMount(() => {
    if (!containerRef) return
    ro = new ResizeObserver(() => {
      syncSize()
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
    </div>
  )
}
