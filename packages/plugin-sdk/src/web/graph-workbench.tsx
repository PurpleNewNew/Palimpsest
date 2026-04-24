import type { JSX } from "solid-js"

import type { PluginCapabilities } from "../host-web"

/**
 * Prop surface for the `<NodeGraphWorkbench>` primitive that ships (at
 * runtime) from `@palimpsest/plugin-sdk/web/graph-workbench`.
 *
 * This file declares only the **type contract**. The runtime primitive
 * itself is step 9 of the restructure (see `specs/README.md`); until
 * that lands, plugin code can still author strongly-typed prop objects
 * against this contract.
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
