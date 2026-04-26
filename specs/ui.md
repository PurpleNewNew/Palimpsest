# UI

This spec covers the Palimpsest UI shell: the routes, sidebar, workbench
tabs, object workspaces, session panel, and contextual tooling that
assemble the product surface users actually see.

Scope:

- `apps/web/src/` — the host web app
- `packages/ui/` — shared UI primitives consumed by apps/web and plugins

Plugin-owned pages are covered in `plugin.md`; the shared graph workbench
primitive is covered in `graph-workbench-pattern.md`.

## Top-Level Routes

### Current reality

The router mounts at `apps/web/src/app.tsx:296-323`. Route tree
(rooted under `/:dir` — the project directory):

| Path | Component | Role |
| --- | --- | --- |
| `/` | `HomeRoute` | project picker |
| `/:dir` | `DirectoryLayout` → `DirectoryIndexRoute` | project root |
| `/:dir/session/:id?` | `SessionRoute` | session page |
| `/:dir/reviews` | `ReviewsRoute` | review queue |
| `/:dir/reviews/:proposalID` | `ProposalWorkspaceRoute` | proposal workspace |
| `/:dir/nodes` | `NodesRoute` | nodes tab |
| `/:dir/nodes/:nodeID` | `NodeWorkspaceRoute` | node workspace |
| `/:dir/runs` | `RunsRoute` | runs tab |
| `/:dir/runs/:runID` | `RunWorkspaceRoute` | run workspace |
| `/:dir/artifacts` | `ArtifactsRoute` | artifacts tab |
| `/:dir/artifacts/:artifactID` | same | artifact detail |
| `/:dir/decisions` | `DecisionsRoute` | decisions tab |
| `/:dir/decisions/:decisionID` | `DecisionWorkspaceRoute` | decision workspace |
| `/:dir/commits` | `CommitsRoute` | commits tab |
| `/:dir/commits/:commitID` | same | commit detail |
| `/:dir/sources` | `SourcesRoute` | sources tab |
| `/:dir/monitors` | `MonitorsRoute` | monitors tab |
| `/:dir/research` | `ResearchRoute` | research lens page (plugin-owned) |
| `/:dir/literature` | `LiteratureRoute` | research lens page (plugin-owned) |
| `/:dir/security` | `SecurityRoute` | security-audit lens page (plugin-owned) |
| `/:dir/findings` | `FindingsRoute` | security-audit lens page (plugin-owned) |
| `/:dir/workspace` | `WorkspaceRoute` | workspace admin |

**Every core domain entity has a workbench tab and an object workspace
route.** The seven `core.shell` lens workspace tabs from
`plugins/core/plugin.ts:57-65` all have backing routes.

### Intended direction

- The route tree is coherent; the main pending surface work is shell
  consistency (see Sidebar and Session Page below).

## Sidebar and Shell Layout

### Current reality

Shell composition lives in `apps/web/src/pages/layout.tsx` (92394 bytes;
large) and `apps/web/src/pages/layout/` (16 files). Notable components:

- `layout/sidebar-shell.tsx` — top-level sidebar container
- `layout/sidebar-project.tsx` — project-scoped section
- `layout/sidebar-workspace.tsx` — workspace/member section
- `layout/sidebar-items.tsx` — shared item rendering
- `layout/sidebar-domain-overview.tsx` — domain entity counts
- `layout/sidebar-research-tree.tsx` — **research-specific, lives in
  host** (should move to `plugins/research/web/` per `plugin.md` Web
  Ownership)
- `layout/deep-links.ts` — desktop deep-link handlers; residual from
  native-shell era

Directory layout component (`layout/directory-layout.tsx` at
`apps/web/src/pages/directory-layout.tsx`) wraps every project-scoped
route, mounting the shell sidebar and context providers.

### Intended direction

- `layout.tsx` is too large (~92k bytes). Candidate for decomposition
  into per-surface modules. Not blocking the restructure.
- `sidebar-research-tree.tsx` should move into `plugins/research/web/`.
  Tracked as part of step 9 (research migration).
- `deep-links.ts` should be reviewed for removal or narrowed scope per
  `product.md` Runtime Boundary.

## Core Workbench Tabs

### Current reality

Seven workbench tabs are provided by `core.shell` lens
(`plugins/core/plugin.ts:57-65`). Each has a page in `apps/web/src/pages/`:

| Tab | List page | Object workspace |
| --- | --- | --- |
| Nodes | `nodes.tsx` (5464 b) | `workspace/node-workspace.tsx` |
| Runs | `runs.tsx` (2518 b) | `workspace/run-workspace.tsx` |
| Artifacts | `artifacts.tsx` (5564 b) | inline detail in `artifacts.tsx` |
| Decisions | `decisions.tsx` (2815 b) | `workspace/decision-workspace.tsx` |
| Reviews | `reviews.tsx` (37204 b) | `workspace/proposal-workspace.tsx` |
| Monitors | `monitors.tsx` (6593 b) | inline — event log of domain.proposal.* events |
| Sources | `sources.tsx` (8545 b) | inline detail via `tab/entity-tab.tsx` |

All pages exist and have real content; none are stub placeholders.
`monitors.tsx` currently listens on the five `domain.proposal.*` bus
events (`apps/web/src/pages/monitors.tsx:10-15`). `sources.tsx`
aggregates both domain `source`-kind nodes and files in
`.palimpsest/sources/` (`apps/web/src/pages/sources.tsx:12-14`).

### Intended direction

- `reviews.tsx` at 37k bytes mirrors `layout.tsx`'s oversize pattern;
  decomposition is pending but not blocking.
- `monitors.tsx` today shows only proposal bus events. Intended
  broader role (run lifecycle, workflow progress, long-running task
  status) is not scoped. Pending product decision.
- `artifacts.tsx` inlines its detail view; other core tabs use
  dedicated object workspace routes. The inconsistency should be
  resolved (either give artifacts a workspace route, or drop inline
  detail in the others for consistency).

## Object Workspaces

### Current reality

Object workspaces are the full-page surfaces that center the product on
durable domain objects rather than on sessions. Shared shell:
`apps/web/src/pages/workspace/object-workspace.tsx:9-64` exposes the
`ObjectWorkspace` component with props:

```ts
type ObjectWorkspaceProps = {
  kind: string
  id: string
  breadcrumb?: Crumb[]
  title: string | JSX.Element
  subtitle?: string | JSX.Element
  status?: JSX.Element
  meta?: JSX.Element
  actions?: JSX.Element
  main: JSX.Element                              // the primary surface
  rail?: JSX.Element                             // right side rail
  readonly?: boolean
  accessLabel?: string                           // e.g., "editor", "viewer"
  publishSlot?: JSX.Element                      // share/publish controls
  backHref?: string
  backLabel?: string
}
```

Four object workspaces consume this shell:

- `workspace/node-workspace.tsx` — node detail + linked runs / artifacts / decisions
- `workspace/run-workspace.tsx` — run detail + linked artifacts / decisions
- `workspace/proposal-workspace.tsx` — proposal detail + review + commit chain
- `workspace/decision-workspace.tsx` — decision detail + provenance chain

Each workspace uses `useWorkspaceCapabilities()` from
`apps/web/src/context/permissions.ts:36-44` to gate write / review /
share actions via `readonly`, `accessLabel`, and per-button flags. See
`workspace/publish-button.tsx:1-30` for the canonical share-button
pattern consuming `useCanShare()`.

Right-rail composition (`rail` prop) today carries linked-object
navigation and provenance summaries; it is the surface where
`workbench-tooling-model.md` (DEPRECATED) framed files / terminal / diff
as contextual tools.

### Intended direction

- **Product commitment (from `product.md`)**: object workspaces are the
  canonical product surface for durable objects, not generic session
  side panels. Sessions attach to objects; they do not replace object
  workspaces.
- No workspace exists for **artifact** (today inline in `artifacts.tsx`)
  or **commit** (today inline in `commits.tsx`). Decision pending:
  formalize as workspaces or keep as list-centric surfaces.
- `proposal-workspace.tsx` is the intended canonical review surface
  (not a session side panel). The existing route at
  `/:dir/reviews/:proposalID` confirms this. Session-only review panels
  must go when the legacy review rail is removed.

## Session Page

### Current reality

`apps/web/src/pages/session.tsx` (37094 bytes) is the primary session
route at `/:dir/session/:id?`. It is flanked by
`apps/web/src/pages/session/` which contains **57 items**, a mix of:

- General session infrastructure (`message-timeline.tsx`,
  `session-side-panel.tsx`, `composer/`, `terminal-panel.tsx`, etc.)
- **Research-specific code that squats in the host**:
  - `atoms-tab.tsx`, `atom-graph-view.tsx`, `atom-detail-*.tsx`,
    `atom-session-tab.tsx`, `atom-chat-panel.tsx`
  - `experiment-tab.tsx`, `exp-detail-panel.tsx`
  - `graph-state-manager.ts`
  - `research-legacy-sdk.ts`

The squatting files are direct copies from the OpenResearch baseline
and should move into `plugins/research/web/` per `plugin.md` Web
Ownership. They are the primary target of step 9 in the restructure
sequence.

Session side panel (`session-side-panel.tsx`) today branches on
`isResearchProject` / `isAtomSession` to decide which tabs to render.
This is host code knowing about lens identity, which violates the
plugin.md Web Ownership principle.

### Intended direction

- Step 9 work moves the 11+ atom-*/experiment-* files out of host into
  `plugins/research/web/` and wires them through lens-contributed
  session tabs (per plugin.md `LensInfo.sessionTabs`) rather than host
  branching.
- Session archive sharing (via `SessionShareTable`) continues to work
  in parallel until object-share UI matures. See `domain.md` Sharing
  Intended direction.
- Mobile fallbacks should default to workbench and overview rather
  than file- or review-specific alternates. Pending.

## Shell Primitives (packages/ui)

### Current reality

`packages/ui/src/` supplies reusable primitives consumed by both host
and plugins:

- `components/` — buttons, dialogs, selects, dropdowns, tabs, toast,
  spinner, etc.
- `context/` — dialog / file / marked providers
- `theme/` — theme provider
- `i18n/` — locale bundles (en, es, br, fr, zh, ja)
- `hooks/` — shared Solid hooks
- `pierre/` — icon set
- `storybook/` — component explorer

Plugins import these via `@palimpsest/ui/<name>`; plugin-sdk peers on
`solid-js`. See `packages/plugin-sdk/package.json:27-35` for the peer
setup.

### Intended direction

- The shared graph workbench primitive
  (`packages/plugin-sdk/src/web/graph-workbench.tsx`, per
  `graph-workbench-pattern.md`) is **not yet implemented**. It is step
  9 work. Until then, research atom-graph-view and security-audit
  workbench duplicate the graph UI.

## Contextual Tooling

### Current reality

Files, terminal, diff, logs, and review panels exist across the shell.
Canonical mounts:

- Terminal — `apps/web/src/pages/session/terminal-panel.tsx` (mounted
  inside the session page)
- Files — `apps/web/src/pages/session/file-detail-panel.tsx` +
  `file-tabs.tsx` (session-scoped; also the right rail in object
  workspaces)
- Diff — via session composer / session snapshot code paths
- Review details — inside proposal-workspace rail

None of these should be treated as product skeleton; they are
**contextual tools** invoked within an object or session surface.

### Intended direction

- **Product commitment**: these remain strong-capability / weak-
  structural-privilege. They are available from many contexts; they do
  not determine product identity. Any UI flow that makes "open
  terminal" feel like "open Palimpsest" is pulling toward an IDE shell
  identity and should be reconsidered.

## Capability Gating in UI

### Current reality

Every write / share / review / export action in object workspaces
consumes the capability hooks at
`apps/web/src/context/permissions.ts:52-79`:

- `useCanWrite()` — mutate domain state
- `useCanReview()` — approve/reject proposals
- `useCanShare()` — create / revoke workspace shares
- `useCanExportImport()` — export/import flows
- `useIsOwner()` — member management

The `WorkspaceCapabilities` snapshot
(`apps/web/src/context/permissions.ts:6-14`) is the type. Unit tests
exist at `apps/web/src/context/permissions.test.ts`.

### Intended direction

- **Decision 3** (locked, in `domain.md` and `plugin.md`): expose the
  same snapshot through `PluginWebHost.capabilities()` so plugin web
  code reaches it via the stable bridge, not by importing host
  internals. Scheduled.
- Add `canRun` to `WorkspaceCapabilities` during the same scheduled
  move; initial mapping is `canRun === canWrite`.

## Locked UI Commitments

### Current reality

Three decisions locked during the restructure that shape the UI:

1. **Graph workbench is the spatial home of lens projects.** Research
   and security-audit both consume the same `<NodeGraphWorkbench>`
   primitive (`graph-workbench-pattern.md`).
2. **Session creation is lazy.** Inspect paths (hover, click-to-detail,
   listing related objects) must not call session-creating endpoints.
   Sessions exist only when the user has acted.
3. **Project-level session is a first-class surface**, not a
   sessionStorage-fallback discovery. A persistent "Project" or "Main"
   entry must be visible from any sub-view.

**Decision 2 (inspect ≠ create)** is now partially surfaced:
`apps/web/src/pages/session/atoms-tab.tsx` plain-click handler
(formerly `handleAtomClick`) was deleted; list-view card click and
graph plain click both route to `handleAtomViewDetail` (open detail,
no session-create). Residual: `atom-detail-panel.tsx:183-205`
`fetchExperiments` still calls `research.atom.session.create` to
obtain a sessionId for `session.atom.get`; closing this requires a
read-only `research.atom.experiments.list` endpoint (tracked in
`graph-workbench-pattern.md` Intended direction).

**Decision 3 (project-level session as first-class surface)** is not
yet implemented; tracked separately.

### Intended direction

Per `product.md` Success Criteria (north star):

- UI reads as one coherent product, not "research app with security
  tab."
- Research and security-audit feel like equal builtin lenses.
- Proposals / reviews / commits are visible to end users as product
  chain, not hidden implementation.
- Decisions are visibly tied to provenance.
- Object-level shares preserve reasoning history.

## Known Gaps

### Still open (no decision yet)

1. **No workspace for artifact or commit.** Today both are inline in
   their list pages. Decision pending in this spec.
2. **`monitors.tsx` is narrowly scoped** (proposal bus events only).
   Product-wide definition of "monitor" is undefined.
3. **Session side panel branches on lens identity** (`isResearchProject`,
   `isAtomSession`). Should be driven by lens-contributed `sessionTabs`
   per `plugin.md`. Tracked in step 9.
4. **`layout.tsx` and `reviews.tsx` are oversize.** Not blocking, but a
   maintainability concern.
5. **Mobile fallbacks** default to session-specific surfaces. Should
   default to workbench / overview.

## Relationship to Other Specs

- `domain.md` — the durable objects object workspaces center on
- `product.md` — the product-level commitments (proposal-first,
  session-per-object) the UI realizes
- `plugin.md` — lens-contributed workspace tabs, session tabs, pages,
  actions, and the web ownership boundary
- `graph-workbench-pattern.md` — the spatial home primitive consumed
  by graph-shaped lenses
