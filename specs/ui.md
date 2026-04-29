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
`apps/web/src/pages/session/` which is a mix of:

- General session infrastructure (`message-timeline.tsx`,
  `session-side-panel.tsx`, `composer/`, `terminal-panel.tsx`, etc.)
- **Research lens host adapter layer** (kept in host because these
  files lean on host context hooks like `useFile` / `useSDK` /
  `SessionComposerRegion`; reframed as adapter layer in step 9b'):
  - `atoms-tab.tsx`, `atom-detail-panel.tsx`,
    `atom-detail-fullscreen.tsx`, `atom-chat-panel.tsx`
  - `research-legacy-sdk.ts` (thin shim merging the plugin's
    `useResearchSDK()` into the host SDK)

The pure ML files (`experiment-tab.tsx`, `exp-detail-panel.tsx`,
`watches-tab.tsx`, `codes-tab.tsx`, `servers-tab.tsx`,
`atom-session-tab.tsx`, `remote-task-panel.tsx`, `graph-state-manager.ts`)
that used to sit here have all been deleted as part of Step 10 (de-ML);
the atom graph view itself was earlier moved into
`plugins/research/web/components/atom-graph-view.tsx` in step 9b.3.

Session side panel (`session-side-panel.tsx`) drives project-level
triggers and content from `shell.sessionTabs` (lens-contributed via
plugin.ts). Lens identity checks (`isResearchProject` /
`isSecurityProject`) derive from `shell.lenses` (the canonical
registry). The `isAtomSession` / `isExpSession` host probes were
dropped in Step 10 phase A1 along with the atom/experiment session
sub-role tabs.

### Intended direction

- (closed) Full host-context promotion that would let the surviving
  atom-* files move into `plugins/research/web/` was deferred as
  P0.c residual / 9b' DEFERRED. The promotion landed across Phase
  2.11–2.13: the chat composer + history-window + timeline-staging +
  prompt-input + commands + persist + base64 utilities are now in
  `@palimpsest/plugin-sdk/web/chat`, and `PluginWebHostSDK.event` +
  `PluginWebHostFile.save` were widened. Phase 2.13 (commit
  `6dca95c`) moved `atom-detail-panel.tsx`, `atom-detail-fullscreen
  .tsx`, `atoms-tab.tsx`, `file-detail-panel.tsx` into
  `plugins/research/web/components/`; `atom-chat-panel.tsx` was
  inlined into `<SessionChatPanel input={chatInput}>` and
  `research-legacy-sdk.ts` was deleted. `session-side-panel.tsx`
  now consumes `useResearchSDK()` from the plugin directly.
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
  (`packages/plugin-sdk/src/web/graph-workbench.tsx`) is shipped
  (Step 9 closed). Both research's `<AtomGraphView>` and security-
  audit's `<SecurityGraphCanvas>` consume it. See
  `graph-workbench-pattern.md` Implementation Status.

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

**Decision 2 (inspect ≠ create)** is fully surfaced. Both eager-create
sites are closed:
- `apps/web/src/pages/session/atoms-tab.tsx` plain-click handler was
  deleted; list-view card click and graph plain click both route to
  `handleAtomViewDetail` (open detail, no session-create).
- `apps/web/src/pages/session/atom-detail-panel.tsx`'s
  `navigateToAtomSession` lazy-creates a session only when the user
  explicitly clicks the "Session" header button. Step 10 phase A3
  removed the experiment-listing surface from this panel entirely,
  closing the prior fetch-on-mount path.

**Decision 3 (project-level session as first-class surface)** is
satisfied at the UI navigation surface: every session page mounts
`apps/web/src/components/session/session-shell-bar.tsx` at the top,
which renders the project title as a clickable "← project home"
back-link (`/${dir}`) plus a "Project Context" attachment pill row
linking to project sub-pages (nodes / runs / reviews / etc.). From any
session sub-view the user has a persistent, always-visible entry back
to the project surface.

A stronger interpretation of this rule — namely, a designated *main
session per project* with a server-tracked `main_session_id` so the
"Project session" link points to a specific session entity rather
than the project workspace home — is intentionally deferred. It would
either auto-create a session at project init (violating Decision 2's
lazy-session-creation rule) or require a separate "Make Main" UX
gesture that has no real product use case yet. The UI surface
delivers the persistent-entry requirement; the entity-level
designation can be added when concrete user feedback drives it.

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
3. **(closed)** ~~Session side panel branches on lens identity
   (`isResearchProject`, `isAtomSession`). Should be driven by
   lens-contributed `sessionTabs` per `plugin.md`.~~ Resolved at the
   project-tab level: `apps/web/src/pages/session/session-side-panel.tsx`
   drives project-level triggers and content from `shell.sessionTabs`
   (lens-contributed metadata, see
   `plugins/research/plugin.ts:77-82` and
   `plugins/security-audit/plugin.ts:93-98`). Lens identity checks
   (`isResearchProject` / `isSecurityProject`) now derive from
   `shell.lenses` (the canonical registry). Residual: atom/exp session
   sub-role tabs remain host-hardcoded because `SessionTab` schema
   does not yet model session sub-roles; tracked as a follow-up
   (lens-contributed `ComponentDescriptor` for tab render is also a
   future SDK extension).
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
