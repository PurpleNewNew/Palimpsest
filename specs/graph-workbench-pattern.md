# Graph Workbench Pattern

This document fixes the interaction pattern and abstraction contract for the
lens-owned graph workbench that both `plugins/research` and
`plugins/security-audit` (and any future graph-shaped lens) must consume.

The pattern is derived from the OpenResearch V1.2 baseline worktree
(`/home/cheyanne/Palimpsest-baseline-053a2d39`, tag `V1.2`, commit `053a2d3`),
whose atom graph + fullscreen detail interaction the product has committed to
preserve 1:1 during the move to domain-first Palimpsest.

This spec is the contract. Implementation work that touches the graph workbench
must honor the shape below or amend this document first.

## Implementation Status

### Current reality

The primitive is shipped and consumed by both builtin lenses.

- **Primitive** — `packages/plugin-sdk/src/web/graph-workbench.tsx:674-1829`
  exports `<NodeGraphWorkbench<N, E>>`. Type contract at lines 27-76
  (`NodeGraphWorkbenchProps`), 85-96 (`NodeAdapter`), 102-111 (`EdgeAdapter`),
  118-132 (`Taxonomy`), 197-228 (`NodeAction`), 235 / 242-246 (`LayoutHint` /
  `LayoutFn`), 255-258 (`DefaultAnchorAction`), 265-278 (`NodeGraphSlots`),
  285-295 (`CreateFormContext`).
- **Research lens binding** —
  `plugins/research/web/components/atom-graph-view.tsx:107-168` exports
  `<AtomGraphView>` wrapping the primitive. Taxonomy at
  `plugins/research/web/components/research-taxonomy.ts:17-40`.
- **Security-audit lens binding** —
  `plugins/security-audit/web/components/security-graph-canvas.tsx:132-157`
  exports `<SecurityGraphCanvas>`. Taxonomy at
  `plugins/security-audit/web/components/security-taxonomy.ts:23-47`.
  Consumer at `plugins/security-audit/web/components/workbench.tsx`.
- **Capabilities snapshot** — `packages/plugin-sdk/src/host-web.ts:32-45`
  defines `PluginCapabilities`; `NodeAction.requires` is typed as
  `keyof PluginCapabilities` (Decision 2, locked in step 8).

The host no longer ships a graph view. `apps/web/src/pages/session/atom-graph-view.tsx`
and `graph-state-manager.ts` were removed in step 9b.3; `atoms-tab.tsx`
imports `<AtomGraphView>` from the research plugin package.

### Intended direction

Tracked as known follow-ups; none block primitive validation:

- Move the remaining research-specific files (atom-detail-* / atom-chat-panel
  / atom-session-tab / atoms-tab / experiment-tab / exp-detail-panel /
  research-legacy-sdk) from `apps/web/src/pages/session/` into
  `plugins/research/web/`. Pure file move (P0.c residual).
- `session-side-panel.tsx` still branches on `isResearchProject` /
  `isAtomSession`; per P0.d these become lens-contributed session tabs.
- security-audit's `SecurityNode` does not yet expose a `reviewState`
  field, so `nodeAdapter.status()` in the security binding returns
  `undefined` and the proposed/committed/rejected status chip stays
  hidden until the server adds it.
- (closed) baseline's plain-click → session-create divergence is resolved
  at the research consumer level: `apps/web/src/pages/session/atoms-tab.tsx`
  now wires both list-view card click and graph plain click to
  `handleAtomViewDetail` (inspect-only). The `<AtomGraphView>` lens
  binding still forwards `onNodeClick` to `props.onAtomClick`; the
  inspect-vs-act split is enforced by the consumer, not the binding.
- residual session-create on **detail open** in
  `apps/web/src/pages/session/atom-detail-panel.tsx:183-205`:
  `fetchExperiments` calls `research.atom.session.create` to obtain a
  sessionId for `session.atom.get`. Closing this requires a read-only
  endpoint `research.atom.experiments.list({ atomId })` (server change,
  ~30-60 min) so the detail panel can load experiments without
  side-effects. Tracked as a follow-up; not blocking step 9 closure.

## Product Purpose

The graph workbench is the spatial home of a lens' project. It is **not** just
one of several views; it is the surface users return to when they want to see
where they are in the problem.

Users must be able to:

- see every domain object (node) as a colored node in a graph
- see every relation (edge) with its kind
- hover to preview, ctrl-click to pin-focus, click to drill in
- right-click to create at a location (if the lens permits manual creation)
- drag node to node to create a relation
- open a single node in fullscreen without leaving the project's spatial context
- enter a node-bound session as the "workflow" entry from the graph

## Three-Level Navigation

```
┌───────────────────────────────────────────────────────────────┐
│ Level 1 — Workbench                                           │
│   Project-level shell; hosts the Nodes tab (graph workbench)  │
│   plus lens-contributed session tabs.                         │
├───────────────────────────────────────────────────────────────┤
│ Level 2 — Graph Workbench (List / Graph / Detail)             │
│   Three sub-views of the same underlying nodes + edges.       │
│   "Detail" is a top-right button that opens Level 3.          │
├───────────────────────────────────────────────────────────────┤
│ Level 3 — Object Workspace Fullscreen                         │
│   Clip-path inset animation from the trigger button's rect.   │
│   3-pane: center graph + right object panel (+ alt swap) +    │
│   optional left chat overlay + optional file overlay.         │
│   Drilling into sub-objects swaps panes — URL stays stable.   │
└───────────────────────────────────────────────────────────────┘
```

## Sessions

The three-level navigation above is about visual layout. It is orthogonal to
how sessions are attached to domain objects and when they are created. This
section fixes the lifecycle rules that baseline's OpenResearch implementation
got structurally right but implemented too eagerly.

### Five Attachment Targets

Per `domain-model.md`, a session may attach to any of five domain object
kinds:

- **project** — cross-cutting exploration, onboarding, scratchpad
- **node** — deep work on a single claim / finding / hypothesis
- **run** — an individual execution (experiment, analysis, audit step)
- **proposal** — work on a pending change set spanning multiple nodes
- **decision** — work on a durable judgment and its rationale

The graph workbench primitive itself only exposes node-bound actions (via
`nodeActions`, see Primitive section). Session creation for any of the five
attachment targets is a lens concern: lenses decide inside their action
handlers which target kind to create and attach. Project / proposal /
decision session entries live in sibling UI surfaces (project shell,
proposal workspace, decision workspace). But the overall product must
expose all five; a lens that covers only node and run is incomplete.

This explicitly supersedes baseline, which implemented only node (atom) and
run (experiment) attachment and left project attachment as an implicit
sessionStorage fallback.

### Inspect vs. Act

The primitive strictly separates two classes of user intent, and only the
second creates a session.

**Inspect** (read-only; no session is created):

- hovering, clicking, ctrl+click pinning, opening a node in fullscreen detail
- listing runs / artifacts / decisions associated with a node
- viewing a node's claim / evidence / history / linked files

**Act** (drives work; a session is created on first invocation):

- asking the AI about the node (opens chat)
- running a workflow for the node
- proposing a change derived from the node
- reviewing a proposal linked to the node

**Rule**: Inspect paths **must not** call session-creation endpoints and
**must not** piggyback on `*.session.create` responses to fetch read-only
data. Read-only data (experiments list, evidence files, edges, associated
runs, etc.) must come from dedicated read-only endpoints (e.g.,
`research.atom.experiments.list({ atomId })`).

This rule exists because baseline's `atoms-tab.tsx:191-205` and
`atom-detail-panel.tsx:183-194` both eagerly called
`research.atom.session.create({ atomId })` on view-only interactions,
causing session proliferation and making it impossible to distinguish
"browsed" from "actually worked on."

### Project Session is First-Class

The project-level session must have an **explicit, always-visible entry
point** — it may not remain a sessionStorage fallback.

Acceptable implementations:

- a pinned "Project" item in the sidebar that opens the project session
- a top-of-workbench "Main" tab that switches to it
- a persistent crumb `← {project name}` that resolves to the project session
  rather than inferring one from history

Baseline's `"research-project-main-session-<projectID>"` sessionStorage key
remains legitimate as a **return-target hint**, but it is not the primary
surface for reaching the project session.

### Return Navigation

`sessionStorage` breadcrumbs are a **return hint**, not the primary
navigation surface:

- `"<lensID>-session-return-<sessionID>"` = parent session id to pop back to
- `"<lensID>-project-main-session-<projectID>"` = last main (non-object) session

The `← Return` button in an object session (baseline:
`atom-session-tab.tsx:40-50`) must resolve in this order:

1. `window.history.back()` if there is a history entry to pop
2. the session-specific `<lensID>-session-return-<sessionID>` hint
3. the project-level fallback `<lensID>-project-main-session-<projectID>`
4. the explicit project-session entry point (sidebar pin / Main tab)

Naming must be lens-scoped so multiple lenses coexist on one project without
overwriting each other's return state.

## Proposed vs. Committed Nodes

The graph is the shared durable state of the project. It grows through two
input paths, which must coexist:

- **Human authoring** — user right-clicks canvas, drags edges, edits
  directly. Nodes enter the graph with `status="committed"`.
- **Workflow proposing** — an AI workflow run produces
  new or modified nodes. Each workflow-produced node enters the graph with
  `status="proposed"` and remains there until a human acts on it.

Humans promote or demote proposed nodes by acting on them inside the
lens-owned object workspace (not on the graph workbench hover toolbar):

- **Accept** — node becomes `status="committed"`; a proposal/review/commit
  record is written per `domain-model.md`
- **Reject** — node becomes `status="rejected"` (soft-deleted) or is
  removed from the graph; a decision record is written with rationale
- **Modify and accept** — user edits the node's fields, then accepts; the
  commit carries the human-edited version

### Primitive contract

The `<NodeGraphWorkbench>` primitive does not understand proposals,
reviews, or commits. It only reads `status` from `nodeAdapter.status()`
and renders it via `taxonomy.statusStates`. To participate in the
proposed/committed flow, a lens must:

1. Include at minimum `{ id: "proposed", label: "Proposed", color: …, bg: … }`
   and `{ id: "committed", label: "Committed", color: …, bg: … }` in
   `taxonomy.statusStates`. `rejected` is optional; lenses that hard-delete
   rejected nodes don't need it.
2. Map `nodeAdapter.status(node)` to one of those state ids.
3. Provide accept/reject/modify UI in the `right` pane of
   `<ObjectWorkspaceFullscreen>` (or equivalent lens-owned surface). The
   primitive itself does not render these actions.

### Visual convention

Proposed nodes must be visually distinguishable at a glance. Recommended
convention (not enforced by the primitive):

- proposed: dashed or reduced-opacity stroke, distinctive fill color
- committed: full-opacity solid stroke (the "normal" look)
- rejected: strongly muted, or not rendered at all

Lenses control the exact colors and opacities through
`taxonomy.statusStates`. The primitive reads those values and applies them
uniformly across the node, tooltip chip, and status badge.

### Why this belongs in the primitive's contract

The primitive could remain fully agnostic ("status is just a string, do
what you want"), but AI-first lenses are a product commitment, and their
interaction pattern is shared enough that pinning down the convention here
prevents each lens from reinventing it with subtle inconsistencies. The
convention is non-binding for lenses that don't generate workflow
proposals — research, for example, uses `pending / in_progress / proven /
disproven` for evidence status and never needs `proposed / committed /
rejected`.

## Reusable Primitive: `<NodeGraphWorkbench>`

### Location

`packages/plugin-sdk/src/web/graph-workbench.tsx`

Exported as `@palimpsest/plugin-sdk/web/graph-workbench`.

### Dependencies

- `@antv/g6` as **optional peerDependency** of `@palimpsest/plugin-sdk` (the
  primitive is the only consumer; lenses get g6 through the primitive). Set
  in `packages/plugin-sdk/package.json:28-40`.
- `solid-js` is already peered.

### Current reality

The TypeScript types match the spec block below 1:1; line numbers are
authoritative as of the most recent build.

| Type | File:lines |
| --- | --- |
| `NodeGraphWorkbenchProps<N, E>` | `packages/plugin-sdk/src/web/graph-workbench.tsx:27-76` |
| `NodeAdapter<N>` | `packages/plugin-sdk/src/web/graph-workbench.tsx:85-96` |
| `EdgeAdapter<E>` | `packages/plugin-sdk/src/web/graph-workbench.tsx:102-111` |
| `Taxonomy` | `packages/plugin-sdk/src/web/graph-workbench.tsx:118-132` |
| `NodeCreateInput` / `EdgeCreateInput` / `EdgeUpdateInput` / `EdgeDeleteInput` | `packages/plugin-sdk/src/web/graph-workbench.tsx:135-155` |
| `NodeAction<N>` | `packages/plugin-sdk/src/web/graph-workbench.tsx:197-228` |
| `LayoutHint` / `LayoutFn` | `packages/plugin-sdk/src/web/graph-workbench.tsx:235 / 242-246` |
| `DefaultAnchorAction` | `packages/plugin-sdk/src/web/graph-workbench.tsx:255-258` |
| `NodeGraphSlots<N>` | `packages/plugin-sdk/src/web/graph-workbench.tsx:265-278` |
| `CreateFormContext` | `packages/plugin-sdk/src/web/graph-workbench.tsx:285-295` |

The runtime component is `NodeGraphWorkbench` at
`packages/plugin-sdk/src/web/graph-workbench.tsx:674`. Its in-scope behavior
is spelled out in the file header comment block at
`packages/plugin-sdk/src/web/graph-workbench.tsx:297-343`.

### Props

```ts
type NodeGraphWorkbenchProps<N, E> = {
  // ─── Data ──────────────────────────────────────────────────
  nodes: N[]
  edges: E[]
  loading?: boolean
  error?: boolean

  // ─── A. Field adapters (map lens objects to graph fields) ──
  nodeAdapter: NodeAdapter<N>
  edgeAdapter: EdgeAdapter<E>

  // ─── B. Taxonomy (node/edge kinds as data) ─────────────────
  taxonomy: Taxonomy

  // ─── C. Action callbacks (business ops) ────────────────────
  onNodeClick?: (id: string) => void                     // plain click in graph; open detail in place
  nodeActions?: Array<NodeAction<N>>                     // per-node actions shown in anchor toolbar / object workspace
  onNodeCreate?: (input: NodeCreateInput) => Promise<N>  // if absent, right-click canvas is no-op
  onNodeDelete?: (id: string) => Promise<void>
  onEdgeCreate?: (input: EdgeCreateInput) => Promise<void>
  onEdgeUpdate?: (input: EdgeUpdateInput) => Promise<void>
  onEdgeDelete?: (input: EdgeDeleteInput) => Promise<void>

  // ─── D. Presentation slots (Solid JSX; Portal-mounted) ─────
  slots?: NodeGraphSlots<N>

  // ─── E. Persistence ─────────────────────────────────────────
  projectID: string
  lensID: string                                          // distinguishes storage per lens

  // ─── F. Layout strategy (optional; capability-driven default) ─
  layout?: LayoutHint | LayoutFn
}

type NodeAdapter<N> = {
  id: (n: N) => string
  kind: (n: N) => string                                  // matches a Taxonomy.nodeKinds entry id
  title: (n: N) => string
  status?: (n: N) => string | undefined                   // matches a Taxonomy.statusStates entry id
  meta?: (n: N) => Record<string, string>                 // freeform; used by default tooltip footer
}

type EdgeAdapter<E> = {
  id?: (e: E) => string                                   // default: `${source}-${kind}-${target}`
  source: (e: E) => string
  target: (e: E) => string
  kind: (e: E) => string                                  // matches a Taxonomy.edgeKinds entry id
  note?: (e: E) => string | undefined
}

type Taxonomy = {
  nodeKinds: Array<{ id: string; label: string; color: string }>
  edgeKinds: Array<{ id: string; label: string; color: string }>
  statusStates?: Array<{ id: string; label: string; color: string; bg: string }>
  legend?: { nodeTitle?: string; edgeTitle?: string }     // default: "NODE TYPES" / "RELATIONS"
}

type NodeCreateInput = { name: string; kind: string; position: { x: number; y: number } }
type EdgeCreateInput = { sourceID: string; targetID: string; kind: string }
type EdgeUpdateInput = EdgeCreateInput & { previousKind: string }
type EdgeDeleteInput = { sourceID: string; targetID: string; kind: string }

type NodeAction<N> = {
  id: string                             // "ask" | "run" | "propose" | "review" | "mark-false-positive" | …
  label: string
  icon?: string                          // lucide icon name, optional
  handler: (node: N) => void | Promise<void>
  enabled?: (node: N) => boolean         // optional per-node gating (e.g., hide "run" on controls)
  requires?: keyof PluginCapabilities    // optional capability gate (see `plugin-sdk/host-web`)
}

type LayoutHint = "force" | "dagre" | "radial" | "circular"
type LayoutFn = (ctx: {
  nodes: Array<{ id: string; kind: string }>
  edges: Array<{ source: string; target: string; kind: string }>
  viewport: { width: number; height: number }
}) => Record<string, { x: number; y: number }>

type DefaultAnchorAction =
  | { id: "add-edge"; enabled: boolean; invoke: () => void }
  | { id: "delete"; enabled: boolean; invoke: () => void }
  | { id: "view-detail"; enabled: boolean; invoke: () => void }

type NodeGraphSlots<N> = {
  tooltip?: (node: N) => JSX.Element                      // replaces default hover tooltip
  createForm?: (ctx: CreateFormContext) => JSX.Element    // replaces default right-click create form
  nodeBadge?: (node: N) => JSX.Element                    // small overlay on node (e.g., severity dot)
  anchorActions?: (node: N, defaults: DefaultAnchorAction[]) => JSX.Element
                                                          // replaces default hover anchor toolbar contents
}

type CreateFormContext = {
  position: { viewportX: number; viewportY: number; graphX: number; graphY: number }
  taxonomy: Taxonomy
  onSubmit: (input: NodeCreateInput) => Promise<void>     // wraps onNodeCreate with positioning
  onCancel: () => void
}
```

### Abstraction Classification (Why this shape)

Every coupling point identified in the baseline `atom-graph-view.tsx` falls
into exactly one of five categories:

- **A. Field adapter**: field-name coupling (17 sites of `atom.atom_*` /
  `rel.atom_id_*`). Resolved by `nodeAdapter` / `edgeAdapter`.
- **B. Taxonomy config**: `TYPE_COLORS`, `TYPE_LABELS`, `RELATION_COLORS`,
  `RELATION_LABELS`, `STATUS_COLORS`, `STATUS_DOT_BG`,
  `EVIDENCE_STATUS_LABELS`. Resolved by `taxonomy` prop.
- **C. Action callback**: all mutating operations (create/delete/update) and
  the two distinct click semantics (in-place detail vs open session). Already
  lived in props in baseline; only renamed to lens-neutral terms here.
- **D. UI slot**: tooltip HTML and create-form layout. Replaced by Solid JSX
  slots that the primitive mounts via `<Portal mount={document.body}>` (or
  directly via `render()` into a fixed floating div when g6 needs a canvas
  overlay with mouse-following behavior).
- **E. Pure primitive**: hover anchor toolbar, ctrl-click focus/dim,
  drag-to-connect, layout picker, zoom/pan, node size-by-degree-2,
  @antv/g6 lifecycle, `GraphStateManager` persistence.

Approximately 88% of baseline code (lines of primitive behavior) falls in
category E and ships inside the primitive.

### Behavior Contracts

#### Implementation pointers

Each behavior below maps to a specific block in
`packages/plugin-sdk/src/web/graph-workbench.tsx`:

| Behavior | Function / block |
| --- | --- |
| Capability-Driven UI gating | `defaultActions` `:825-855`, `visibleActions` `:857-865`, `runAction` `:867` |
| Right-click create form | `openForm` `:704`, `closeForm` `:700`, `runCreate` `:732`, `submit` `:740`, `canvas:contextmenu` handler `:1370`, default UI `DefaultCreateForm` `:2163` |
| Tooltip (default + slot) | `showTip` / `moveTip` / `hideTip` `:953-967`, `tipNode` `:984`, `DefaultTooltip` `:1946` |
| Hover anchor toolbar | `clearHideTimer` `:783`, `hideAnchor` `:790`, `scheduleHideAnchor` `:796`, `showAnchor` `:804`, `DefaultAnchorToolbar` `:1831`, `defaultActionLabel` `:1878`, `DefaultActionIcon` `:1884` |
| Node click + Ctrl/Cmd focus pin | `node:click` handler `:1457`, `focusNode` `:969`, `unfocus` `:976` |
| 110ms debounced dim | `scheduleDim` `:942`, `applyDim` `:916`, `clearDim` (inline) |
| Drag-to-connect | `beginDraft` `:1029`, `moveDraft` `:1061`, `cancelDraft` `:1067`, `finishDraft` `:1083`, `submitDraft` `:1093`; `DraftKindPicker` `:2102` |
| Edge click popover | `edge:click` handler `:1395`, `closeEdgePop` `:1136`, `updateEdgeKind` `:1140`, `removeEdge` `:1163`; `EdgeActionPopover` `:2019` |
| `slots.nodeBadge` overlay | `syncNodePositions` `:1198`, badge layer JSX `:1798-1826` |
| GraphStateManager persistence | module-level `loadGraphState` `:434`, `writeGraphState` `:471`, `clearGraphState` `:480`; component-level `readGraphState` `:1242`, `saveStateNow` `:1280`, `scheduleSave` `:1291`, `canRestore` `:1296`, `applySavedState` `:1302` |
| g6 graph options + state styling | `buildGraphOptions` `:571` (carries `hover` / `dimmed` / `connect-source` / `connect-target` element states for nodes and `hover` / `dimmed` for edges) |
| Data projection (2-hop degree size) | `buildGraphData` `:489`, `applyCustomLayout` `:551` |

#### Capability-Driven UI

Every graph interaction is gated by the presence of its corresponding
callback. A capability that is not configured is not hidden behind an
error or a disabled-looking button — the entire UI for that capability
is simply not rendered. This lets workflow-generated graphs (e.g.,
security-audit) ship a clean read/triage surface without needing to
suppress affordances that don't apply.

| Callback               | Absent means                                       |
| ---------------------- | -------------------------------------------------- |
| `onNodeCreate`         | right-click canvas is a no-op; no create popover   |
| `onNodeDelete`         | anchor toolbar has no delete button                |
| `onEdgeCreate`         | drag-to-connect is disabled                        |
| `onEdgeUpdate`         | edge click does not show kind-editing popover      |
| `onEdgeDelete`         | edge popover (if any) has no delete button         |
| `nodeActions`          | empty/absent → no lens action buttons in toolbar   |

The hover anchor toolbar is rendered iff at least one of its default
actions is enabled or `slots.anchorActions` is provided. If none, the
toolbar does not appear on hover at all.

#### Right-click create

- `onNodeCreate` absent → right-click on canvas is a **no-op**. No popover
  opens. No error is thrown.
- `onNodeCreate` present, `slots.createForm` absent → primitive renders its
  **default form** (name input + kind picker driven by `taxonomy.nodeKinds`),
  labeled "New node" (lens-neutral language, not "NEW ATOM").
- `slots.createForm` present → lens' JSX is rendered inside the floating
  popover; the primitive still owns positioning, viewport clamping, esc/click-
  away dismissal, and the `onSubmit` wrapper that feeds `onNodeCreate`.

#### Tooltip

- Default renders node title, kind chip (color from `taxonomy.nodeKinds`), and
  status chip (color from `taxonomy.statusStates` if present). Meta fields
  from `nodeAdapter.meta()` render as a small footer.
- `slots.tooltip` replaces the card contents entirely but keeps the mount
  (fixed floating div, follows mouse, viewport-clamped, hidden on
  `pointerleave` unless focused).

#### Storage

`GraphStateManager` storage key is `graph-state-<lensID>-<projectID>`. The
baseline key `graph-state-<projectID>` is not read; the project is mid-
refactor and existing saved positions are not migrated.

#### Node click

- **Plain click** → `onNodeClick?(id)`. Conventional lens behavior: open the
  node's detail in place (fullscreen overlay or right panel).
- **Ctrl/Cmd + click** → internal focus pin (never calls any callback).
- **Hover** → `slots.tooltip` renders, anchor toolbar appears after 110ms.

The primitive does not bind any lens action to a mouse gesture. Lenses
expose workflow entry through `nodeActions`, which the primitive renders
as buttons in the hover anchor toolbar (alongside the default add-edge /
delete / view-detail set) and, optionally, in the object workspace right
panel. Each `NodeAction` maps to a product-level verb:

- `ask` — opens a node-attached chat session
- `run` — starts a workflow run bound to this node
- `propose` — creates a proposal referencing this node
- `review` — jumps to the review queue filtered to proposals about this node
- any lens-specific verb (e.g., security-audit: `mark-false-positive`,
  `request-evidence`, `open-playbook`)

A `NodeAction` whose `requires` is set is hidden when the corresponding
`PluginCapabilities` flag is `false`. `PluginCapabilities` lives at
`packages/plugin-sdk/src/host-web.ts:32-45`; `NodeAction<N>` lives at
`packages/plugin-sdk/src/web/graph-workbench.tsx:43-74` (Decision 2,
locked). Lens bundles import it via
`@palimpsest/plugin-sdk/web/graph-workbench`.

This keeps click semantics stable across lenses while letting the workflow
entry live where the lens' UX requires.

#### Edge create

- Drag from one node onto another fires `onEdgeCreate(input)`.
- The relation-type chooser popover reads `taxonomy.edgeKinds` to render kind
  options. No lens-specific strings appear in the popover.
- If `onEdgeCreate` is absent, drag-to-connect is disabled entirely; pointer
  gestures on nodes do not initiate a draft edge.

#### Layout

The primitive supports four built-in layout hints:

- `"force"` — @antv/g6 force-directed (default)
- `"dagre"` — hierarchical top-down
- `"radial"` — important nodes centered, sort by degree
- `"circular"` — ring arrangement

All four produce a free-form graph that users can drag and explore. The
primitive deliberately does not ship pipeline / stage-gate layouts as
built-ins: the product stance is that lens graphs grow through interaction,
not along a fixed pipeline. Lenses that genuinely need a bespoke layout
(e.g., a DAG of pipeline stages, a temporal timeline, a risk-heatmap grid)
may pass a `LayoutFn` instead, receiving `{ nodes, edges, viewport }` and
returning an `{id: {x, y}}` map. The primitive feeds the result into g6 via
`graph.updateNodeData`; the layout function does not need to know g6
internals.

All built-in hints and custom functions coexist with `GraphStateManager`:
user-dragged positions override the computed layout and persist to
localStorage.

If `layout` is absent, the primitive uses `"force"`. This holds for both
user-driven and workflow-generated lenses — see
`Proposed vs. Committed Nodes` above for how AI-first lenses express
workflow output without changing the layout contract.

## Object Workspace Fullscreen: `<ObjectWorkspaceFullscreen>`

> **Status: deferred.** Not yet shipped as a shared primitive. Each lens
> currently rolls its own fullscreen overlay:
> `apps/web/src/pages/session/atom-detail-fullscreen.tsx` (research) and
> `DetailFullscreen` inside
> `plugins/security-audit/web/components/workbench.tsx:359-389` (security-audit).
> Both implement the clip-path inset animation and the 3-pane layout
> below, so the contract is honored — but the abstraction has no shared
> code yet. Promotion to a shared primitive happens when a third lens
> needs it; until then the duplication is acceptable and the spec
> documents what the eventual shared shape must be.

Ships in the same package; wraps the graph workbench when in "Detail" mode,
plus lens-owned side panels.

### Props

```ts
type ObjectWorkspaceFullscreenProps = {
  visible: boolean
  originRect: { x: number; y: number; width: number; height: number }
  onClose: () => void

  title?: string                                          // top bar
  icon?: JSX.Element

  // Center: almost always a <NodeGraphWorkbench> instance
  center: JSX.Element

  // Right pane: lens-owned object panel (e.g., AtomDetailPanel,
  // FindingDetailPanel). Swaps to rightAlt when drilling into a sub-object.
  right?: JSX.Element
  rightAlt?: JSX.Element                                  // e.g., experiment/run detail

  // Left overlay: lens-owned session chat (slide-in from left, z-20)
  leftOverlay?: JSX.Element

  // File inspector overlay (z-10, beside leftOverlay)
  fileOverlay?: JSX.Element
}
```

### Animation

- Open: `clip-path: inset(<originRect>)` → `inset(0)`, 300ms
  `cubic-bezier(0.4, 0, 0.2, 1)`.
- Close: reverse. `visibility: hidden` only after `transitionend` fires.
- `document.body.overflow = "hidden"` while visible.
- `Escape` closes.

### Layout

```
┌───────────────────────────────────────────────────────────┐
│  [icon] Title                                    ✕ Close  │
├────────────────┬──────────────────────────┬───────────────┤
│                │                          │               │
│ leftOverlay    │  center                  │  right or     │
│ (z-20)         │  (NodeGraphWorkbench)    │  rightAlt     │
│ fileOverlay    │                          │               │
│ (z-10)         │                          │               │
│                │                          │               │
└────────────────┴──────────────────────────┴───────────────┘
```

Overlays are absolutely positioned siblings, not siblings of the graph. This
means drilling into a sub-object (right → rightAlt swap) or toggling chat
(leftOverlay appear/disappear) never reflows the graph.

## Lens Consumption Examples

The TypeScript blocks below are the contract examples that drove the
implementation. The shipped lens bindings now live in:

- **research** —
  `plugins/research/web/components/atom-graph-view.tsx:107-168`
  (taxonomy at `plugins/research/web/components/research-taxonomy.ts:17-40`)
- **security-audit** —
  `plugins/security-audit/web/components/security-graph-canvas.tsx:132-157`
  (taxonomy at `plugins/security-audit/web/components/security-taxonomy.ts:23-47`)

The shipped versions diverge from the examples in two notable places:

- **Research `onAtomViewDetail`** is preserved via `slots.anchorActions`
  override rather than mapping to `onNodeClick` — see the
  `ResearchAnchorToolbar` at
  `plugins/research/web/components/atom-graph-view.tsx:170-214`.
- **Security-audit `nodeActions`** are not yet supplied; the workbench
  currently exposes mutation through the proposal review tray rather than
  per-node actions. The `accept-proposal` / `reject-proposal` /
  `mark-false-positive` examples below are aspirational, gated on
  `SecurityNode` first growing a `reviewState` field server-side.

### research (baseline-preserving)

```ts
<NodeGraphWorkbench
  nodes={atoms}
  edges={relations}
  nodeAdapter={{
    id: a => a.atom_id,
    kind: a => a.atom_type,                     // fact | method | theorem | verification
    title: a => a.atom_name,
    status: a => a.atom_evidence_status,        // pending | in_progress | proven | disproven
    meta: a => ({ Evidence: evidenceTypeLabel(a.atom_evidence_type) }),
  }}
  edgeAdapter={{
    source: r => r.atom_id_source,
    target: r => r.atom_id_target,
    kind: r => r.relation_type,
  }}
  taxonomy={researchTaxonomy}
  onNodeClick={openAtomDetail}                  // opens fullscreen in place
  nodeActions={[
    { id: "ask", label: "Ask", icon: "message-square", handler: askAtom, requires: "canWrite" },
    { id: "run", label: "Run", icon: "play", handler: runExperiment, requires: "canRun" },
    { id: "propose", label: "Propose", icon: "lightbulb", handler: proposeAtom, requires: "canWrite" },
  ]}
  onNodeCreate={createAtom}                     // right-click creates; uses default form
  onEdgeCreate={createRelation}
  // ... etc
  projectID={projectID}
  lensID="research"
/>
```

### security-audit (AI-first, human-curated graph)

The security audit graph is primarily grown by workflow runs (see the
workflow in `plugins/security-audit/workflows/security-audit-v1/`), but
the UX contract is identical to research's: free-form graph, hover anchor
toolbar, Ctrl+click focus pin, rich tooltip, click-to-detail, explicit
actions via `nodeActions`. Workflow output enters the graph as
`status="proposed"` nodes (because the workflow calls the domain API with
`actor.type === "agent"`, which never auto-approves — see `domain.md`).
Proposed nodes are promoted to `status="committed"` only after human
review. Humans retain the right to create, connect, and delete directly at
any point — AI-first does not mean human-locked.

```ts
<NodeGraphWorkbench
  nodes={securityNodes}
  edges={securityEdges}
  nodeAdapter={{
    id: n => n.id,
    kind: n => n.kind,                           // target | surface | finding | control | assumption | risk
    title: n => n.title,
    status: n => n.reviewState,                  // proposed | committed | rejected
    meta: n => ({
      Severity: n.severity,
      Confidence: n.confidence,
      Source: n.sourceRunID ?? "manual",
    }),
  }}
  edgeAdapter={securityEdgeAdapter}
  taxonomy={securityAuditTaxonomy}                // statusStates includes proposed / committed / rejected
  // No `layout` — default "force" gives the free-form graph research uses;
  // the security graph is discovered through interaction, not pipelined.
  onNodeClick={openNodeDetail}                    // inspect — opens fullscreen detail in place
  nodeActions={[
    { id: "ask", label: "Ask", icon: "message-square", handler: askNode, requires: "canWrite" },
    { id: "run", label: "Run", icon: "play", handler: runAudit, requires: "canRun",
      enabled: (n) => n.kind === "finding" || n.kind === "surface" },
    { id: "accept-proposal", label: "Accept", icon: "check", handler: acceptProposal,
      requires: "canReview", enabled: (n) => n.reviewState === "proposed" },
    { id: "reject-proposal", label: "Reject", icon: "x", handler: rejectProposal,
      requires: "canReview", enabled: (n) => n.reviewState === "proposed" },
    { id: "mark-false-positive", label: "False positive", icon: "shield-off",
      handler: markFalsePositive, requires: "canReview",
      enabled: (n) => n.kind === "finding" },
  ]}
  onNodeCreate={createSecurityNode}               // human-intervention escape hatch
  onNodeDelete={deleteSecurityNode}
  onEdgeCreate={createSecurityEdge}
  onEdgeUpdate={updateSecurityEdge}
  onEdgeDelete={deleteSecurityEdge}
  slots={{
    tooltip: (n) => <SecurityTooltip node={n} />, // richer tooltip with severity/CVSS
    nodeBadge: (n) => <SeverityBadge level={n.severity} />,
    // anchorActions omitted — default (add-edge / delete / view-detail) +
    // nodeActions above is the complete affordance set.
  }}
  projectID={projectID}
  lensID="security-audit"
/>
```

## Principles to Preserve (Non-Negotiable)

1.  **Graph is the spatial home of the project.** Users must be able to
    return to it from any sub-view without losing context.
2.  **Overlay-based drilling, not route navigation**, inside fullscreen. The
    URL reflects the current session, not the current overlay pane.
3.  **Session-per-object.** Entering "workflow" from a node means creating or
    reusing a session attached to that node (or its run).
4.  **Breadcrumbs via sessionStorage**, lens-scoped, so return buttons always
    have a destination.
5.  **Contextual overlays for tools** (chat, file detail, run detail). These
    are panes inside the object workspace, not new routes.
6.  **Hover anchor toolbar** for primary per-node actions (add-edge, delete,
    view-detail). This is the discoverability surface on the graph itself.
7.  **Right-click create** at cursor position — spatial semantics. Off by
    default (`onNodeCreate` absent) so lenses that shouldn't allow manual
    creation don't have to hide UI.
8.  **Clip-path inset animation** for fullscreen entry and exit. Preserves
    spatial continuity from the click origin.
9.  **Inspect does not create sessions.** View-only interactions (hover,
    click-to-detail, listing related objects) must not call session-creating
    endpoints. Sessions exist iff the user has acted.
10. **Project-level session is a first-class surface.** It must have an
    explicit, always-visible entry point and may not be implicit through
    sessionStorage fallbacks alone.
11. **Session attachment is not limited to node and run.** The product must
    support sessions attached to project, node, run, proposal, and decision.
    The graph workbench creates node-attached sessions; sibling surfaces
    create the rest.
12. **Capability-driven UI.** Every graph interaction is gated by the
    presence of its corresponding callback. Missing callbacks do not render
    disabled buttons or error messages; the affordance simply does not
    appear. This keeps read-only and workflow-generated lenses clean
    without per-lens suppression logic.
13. **The graph grows through interaction.** AI-first lenses propose nodes
    and edges; user-first lenses let humans author them directly. Either
    way, the graph is the shared durable state, and users must retain the
    ability to edit, accept, reject, extend, or redirect at any point.
    Lenses that suppress human-intervention affordances (no right-click
    create, no drag-to-connect, no anchor toolbar) are implementing an
    automation dashboard, not Palimpsest. AI autonomy is expressed through
    `status="proposed"` nodes awaiting review — not through withholding
    human-intervention UI.

## Migration Sequence

The sequence below is informative; it translates this contract into concrete
work. Actual implementation plans live in roadmap or rebuild docs.

1. **P0.a** ✅ — Implement `<NodeGraphWorkbench>` in
   `packages/plugin-sdk/src/web/graph-workbench.tsx`, generic over `N` / `E`.
   Behavior = baseline, parameterized. Shipped across step 9a.1–9a.6d
   (commits `0f73c6f` → `e1e4eea`). `<ObjectWorkspaceFullscreen>` is
   deferred; the existing per-lens fullscreen overlays
   (`atom-detail-fullscreen.tsx`, security-audit's `DetailFullscreen` inside
   `workbench.tsx`) cover the immediate need and the abstraction can land
   when a third lens demands it.
2. **P0.b** ✅ — Security-audit graph view ported to the primitive in step 9c
   (commits `a88e2fc` → `b725526`). `plugins/security-audit/web/components/workbench.tsx`
   now renders `<SecurityGraphCanvas>` (which wraps `<NodeGraphWorkbench>`)
   in both `GraphView` and `DetailFullscreen`. Hand-rolled SVG canvas, fixed
   720x560 viewBox, and column `layout()` helper deleted. This is the
   incremental proof per spec: security-audit works via the primitive, so
   the primitive is right.
3. **P0.c** ⚠ partial — The graph rewire shipped in step 9b
   (commits `f57d18a` → `d80b12a`). `<AtomGraphView>` now lives at
   `plugins/research/web/components/atom-graph-view.tsx` and consumes
   `<NodeGraphWorkbench>`; `apps/web/src/pages/session/atoms-tab.tsx`
   imports it from the plugin. Legacy `apps/web/src/pages/session/atom-graph-view.tsx`
   (~2100 lines) and `graph-state-manager.ts` (~200 lines) deleted.
   The remaining file relocation (atom-detail-* / atom-chat-panel /
   atom-session-tab / atoms-tab / experiment-tab / exp-detail-panel /
   research-legacy-sdk → `plugins/research/web/`) is a pure file move and
   is tracked separately as 9b' (no behavior change).
4. **P0.d** — Host's `session-side-panel.tsx` stops branching on
   `isResearchProject` / `isAtomSession`; those branches become lens-
   contributed session tabs consumed through the normal lens registry.
   Not yet started; depends on P0.c residual.

## Open Questions (Resolved)

These were the live design questions as of this spec's creation and are now
closed:

- **Where does the primitive live?** `packages/plugin-sdk/src/web/graph-workbench.tsx`.
- **Keep `@antv/g6`?** Yes. Both lenses now consume the shared primitive
  through it; security-audit's hand-rolled SVG canvas was deleted in
  step 9c.3.
- **`onNodeCreate` always required?** No. Optional. Absent → right-click is a
  no-op, no error. See `defaultActions` at
  `packages/plugin-sdk/src/web/graph-workbench.tsx:736-766`.
- **Storage key migration?** None. Hard cutover to
  `graph-state-<lensID>-<projectID>` shipped in step 9a.6d. Baseline
  `graph-state-<projectID>` entries are not read; users get a fresh
  layout on first load after the restructure.
- **Tooltip rendering model?** A Solid JSX layer mounted as an
  absolutely-positioned `<div class="pointer-events-none fixed">` inside
  the workbench container; lens passes JSX via `slots.tooltip`; primitive
  owns mount, positioning, viewport clamping, and lifecycle. See the
  tooltip section in `NodeGraphWorkbench`'s return at
  `packages/plugin-sdk/src/web/graph-workbench.tsx`.
- **Does click-to-view create a session?** No. Baseline's eager
  `*.session.create` on click was a bug; closed at the consumer level
  in `apps/web/src/pages/session/atoms-tab.tsx` — both list card click
  and graph plain click now route to `handleAtomViewDetail`. A
  residual session-create on detail-panel open (via `fetchExperiments`
  in `atom-detail-panel.tsx:183-205`) is tracked under Intended
  direction; closing it requires adding a read-only
  `research.atom.experiments.list` server endpoint.
- **May the project-level session remain implicit (sessionStorage only)?**
  No. It must have an explicit, always-visible UI entry.
- **Is node-and-run attachment enough?** No. Proposal and decision
  attachment are first-class. The graph workbench creates node-attached
  sessions only; other attachments are driven from sibling workspaces.
- **Is layout pluggable?** Yes. `layout` prop accepts one of
  `force / dagre / radial / circular` or a custom `LayoutFn`. Default is
  `"force"` for all lenses. Pipeline / stage-gate layouts are deliberately
  not built-in — the product stance is that lens graphs grow through
  interaction, not along a fixed pipeline. Lenses that genuinely need such
  a layout pass a `LayoutFn`.
- **Is drag-to-connect always on?** No. It is gated by `onEdgeCreate`.
  Lenses whose edges are workflow-generated (e.g., security-audit) omit the
  callback and the interaction disappears.
- **Can lenses fully customize the anchor toolbar?** Yes. `slots.anchorActions`
  receives the node and the default action set and returns the complete
  toolbar JSX. If absent, the primitive renders defaults (add-edge / delete
  / view-detail, gated by Capability-Driven UI) plus the lens' `nodeActions`
  list.
- **How does the primitive express "enter workflow" / "ask" / "run" /
  "propose" / "review"?** Through a single `nodeActions: Array<NodeAction>`
  prop, not separate callbacks. Each action declares `id`, `label`, `icon`,
  `handler`, optional `enabled` (per-node gating), and optional `requires`
  (capability gate). The primitive renders each entry as a toolbar button;
  the object workspace right panel may also surface them as primary CTAs.
  This replaces the earlier single `onNodeEnterWorkflow` callback, which
  could not distinguish Ask from Run from Propose.

## Relationship to Other Specs

- `ui-product-model.md` — this doc refines the "Nodes" workbench tab and
  object workspaces referenced there with a concrete shared primitive.
- `builtin-plugin-web-ownership.md` — this primitive is a pre-condition for
  research web ownership (P0.c above).
- `plugin-system.md` — the primitive is the first entry under
  `packages/plugin-sdk/src/web/`; future web-side plugin primitives (e.g.,
  diff viewer, decision timeline) follow the same packaging rule.
- `security-audit-plugin-plan.md` — the AI-first security lens consumes this
  primitive for its graph-native seed view and per-finding drill-down.
