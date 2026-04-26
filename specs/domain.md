# Domain

This spec covers the Palimpsest domain layer: the canonical entities, their
runtime contract, and how sessions, sharing, permissions, and the
proposal/review/commit chain bind to them.

Scope:

- `packages/domain/` — the domain core (schemas, operations, taxonomy)
- `apps/server/src/domain/` — server-side wiring of the domain core
- `apps/server/src/server/routes/domain.ts` — HTTP surface for the domain
- `apps/server/src/session/attachment.ts` — session ↔ domain binding
- `apps/server/src/control-plane/` — workspace roles, shares, review queue

## Entities

### Current reality

Seven canonical entity tables live in `packages/domain/src/domain.sql.ts`.
All share the `Timestamps` mixin (`time_created`, `time_updated`) from
`packages/domain/src/schema.sql.ts:3-10`.

| Entity | Table | Primary refs | File |
| ------ | ----- | ------------ | ---- |
| Node | `node` | `project_id`, `kind`, `title`, optional `body`/`data` | `packages/domain/src/domain.sql.ts:22-34` |
| Edge | `edge` | `project_id`, `kind`, `source_id → node.id`, `target_id → node.id` | `packages/domain/src/domain.sql.ts:36-58` |
| Run | `run` | `project_id`, `node_id → node.id?`, `session_id?`, `kind`, `status`, `manifest` | `packages/domain/src/domain.sql.ts:60-85` |
| Artifact | `artifact` | `project_id`, `run_id?`, `node_id?`, `kind`, `storage_uri`, `provenance` | `packages/domain/src/domain.sql.ts:87-108` |
| Decision | `decision` | `project_id`, `node_id?`, `run_id?`, `artifact_id?`, `kind`, `state`, `superseded_by` | `packages/domain/src/domain.sql.ts:110-137` |
| Proposal | `proposal` | `project_id`, `status`, `changes` (JSON Change array), actor, `refs` | `packages/domain/src/domain.sql.ts:139-159` |
| Review | `review` | `project_id`, `proposal_id → proposal.id` (cascade), reviewer actor, `verdict` | `packages/domain/src/domain.sql.ts:161-182` |
| Commit | `domain_commit` | `project_id`, `proposal_id?`, `review_id?`, committer actor, `applied_changes` | `packages/domain/src/domain.sql.ts:184-203` |

Zod schemas for each entity live in `packages/domain/src/domain.ts:115-131`
(`Node`), `:133-150` (`Edge`), `:152-173` (`Run`), `:175-195` (`Artifact`),
`:197-219` (`Decision`), `:1309-1328` (`Proposal`), `:1330-1347` (`Review`),
`:1349-1366` (`Commit`).

All IDs use typed prefixes validated via `Identifier.schema(prefix)` from
`packages/domain/src/identifier.ts:4-23` (prefixes: `nod`, `edg`, `run`,
`art`, `dec`, `pro`, `rev`, `cmt`, `ses`, `wrk`, `usr`).

Chat sessions are **not** a domain entity in this layer; they live in
`apps/server/src/session/session.sql.ts` and bind to domain entities via
`SessionAttachmentTable` (see [Session Attachment](#session-attachment)).

### Intended direction

None. The seven-entity spine is intentional and complete.

## Operations

### Current reality

The domain core exposes typed operations under the `Domain` namespace in
`packages/domain/src/domain.ts`. Every operation is wrapped in `fn(...)`
with Zod-validated input.

Per-entity CRUD:

- Node: `createNode / updateNode / getNode / listNodes / removeNode`
  — `packages/domain/src/domain.ts:506-610`
- Edge: `createEdge / getEdge / listEdges / updateEdge / removeEdge`
  — `packages/domain/src/domain.ts:612-731`
- Run: `createRun / updateRun / getRun / listRuns / removeRun`
  — `packages/domain/src/domain.ts:733-859`
- Artifact: `createArtifact / getArtifact / listArtifacts / updateArtifact / removeArtifact`
  — `packages/domain/src/domain.ts:861-987`
- Decision: `createDecision / updateDecision / getDecision / listDecisions / removeDecision`
  — `packages/domain/src/domain.ts:989-1124`

Aggregations:

- `graph(projectID)` returns `{ nodes, edges }` for a project
  — `packages/domain/src/domain.ts:1126-1135`
- `summary(projectID)` returns entity counts — `:1136-1154`
- `context(projectID)` via `apps/server/src/domain/domain.ts:75-93` returns
  `{ project, workspaces, taxonomy, summary }`

Proposal/review/commit chain (see [that section](#proposal--review--commit-chain)):

- `propose / getProposal / listProposals / withdrawProposal / reviseProposal / reviewProposal`
  — `packages/domain/src/domain.ts:1740-1953`
- `getReview / listReviews / getCommit / listCommits`
  — `packages/domain/src/domain.ts:1954-1999`

All operations throw typed errors defined at
`packages/domain/src/domain.ts:51-97`: `ProjectNotFoundError`,
`EntityNotFoundError`, `CrossProjectError`, `InvalidTaxonomyError`,
`AuthorizationError`, `ProposerMismatchError`, plus `ProposalStateError` at
`:1379`.

### Intended direction

None for the CRUD surface. It is already complete and strictly typed.

## Taxonomy

### Current reality

Project-level taxonomy rules live in `ProjectTaxonomyTable` at
`packages/domain/src/domain.sql.ts:16-20`. Shape:

```ts
type TaxonomyData = {
  nodeKinds: string[]
  edgeKinds: string[]
  runKinds: string[]
  artifactKinds: string[]
  decisionKinds: string[]
  decisionStates: string[]
}
```

Schema: `packages/domain/src/domain.ts:101-113`.

**Runtime validation is real.** `createNode` rejects `kind` values not in
`taxonomy.nodeKinds` via `InvalidTaxonomyError`; same for edges, runs,
artifacts, decisions, and decision states. See the `rule(...)` helper usage
at `packages/domain/src/domain.ts:539` (nodes), and the `case` arms under
the change-application switch for proposals.

Plugins seed their default taxonomy through the preset system; see
`plugins/research/plugin.ts:10-17` and
`plugins/security-audit/plugin.ts:10-17`. Each preset declares a
`defaultTaxonomyID` that binds a preset at project creation to a specific
`TaxonomyData` entry.

Taxonomy is updated via `setTaxonomy` at
`packages/domain/src/domain.ts:462-505`. The HTTP surface is
`GET /domain/taxonomy` and `PUT /domain/taxonomy` at
`apps/server/src/server/routes/domain.ts:180-232` (the `PUT` goes through
the `guardDomainWrite` middleware).

### Intended direction

No user-facing taxonomy editor exists yet. Today taxonomy is effectively
fixed at project creation; changing it requires an API call or a plugin
preset edit. A taxonomy-editing object workspace is out of scope for the
current spec.

## Actor Model

### Current reality

Actor identity is captured as a `{ type, id, version? }` record.
Schema: `packages/domain/src/domain.ts:1155-1164`. `type` is one of
`"user" | "agent" | "system"` (validated by the Zod enum in
`Actor` schema; see `:1155-1163`).

Actor attribution is **stored directly** on:

- Run (`triggered_by_actor_*`) — `packages/domain/src/domain.sql.ts:70-72`
- Decision (`decided_by_actor_*`) — `packages/domain/src/domain.sql.ts:121-123`
- Proposal (`proposed_by_actor_*`) — `packages/domain/src/domain.sql.ts:147-149`
- Review (`reviewer_actor_*`) — `packages/domain/src/domain.sql.ts:169-171`
- Commit (`committed_by_actor_*`) — `packages/domain/src/domain.sql.ts:191-193`

Node, Edge, and Artifact tables do **not** have dedicated actor columns.
Actor attribution for those objects lives in the `provenance` or `data`
JSON fields when recorded at all.

### Intended direction

Either add first-class actor columns to Node/Edge/Artifact, or declare via
this spec that provenance for those entities is always indirect (through
the proposal/commit that created them). The current ambiguity means
"who created this node" is only answerable via commit history, not the
node itself.

## Session Attachment

### Current reality

Sessions bind to domain entities through `SessionAttachmentTable` at
`apps/server/src/session/session.sql.ts:87-104`. The binding is a
composite `(session_id, entity, entity_id, lens_id?, title?)`.

Attachment kinds are enforced at write time in
`apps/server/src/session/attachment.ts:27-54`. The `switch` covers exactly
five cases:

- `"project"` — must match the session's own `project_id`
- `"node"` — looked up via `Domain.getNode`, cross-project rejected
- `"run"` — looked up via `Domain.getRun`, cross-project rejected
- `"proposal"` — looked up via `Domain.getProposal`, cross-project rejected
- `"decision"` — looked up via `Domain.getDecision`, cross-project rejected

The schema itself is shared with plugin-sdk: attachment.ts imports
`SessionAttachment` from `@palimpsest/plugin-sdk/product`. The type is
declared at `packages/plugin-sdk/src/product.ts:108-114` as
`z.object({ entity: z.enum(["project","node","run","proposal","decision"]), ... })`,
so any attach call is validated at both write time (via
`Info.array()` parsing in `attachment.ts:66-95`) and read time (via
`Info.parse(...)` in `attachment.ts:18-25`).

The underlying `session_attachment.entity` column at
`session.sql.ts:93` is `text().notNull()` (SQLite has no enum type).
All writes go through plugin-sdk's schema, so only the five valid values
reach the DB. There is no practical gap.

### Intended direction

- `graph-workbench-pattern.md` exposes a lens-provided `nodeActions`
  registry; each action handler is free to attach any of the five
  session targets. Surfacing proposal and decision attachment from the
  graph remains a lens concern, not a primitive concern.
- UI surface for proposal-attached and decision-attached sessions is
  not yet designed. Pending `ui.md`.

## Proposal → Review → Commit Chain

### Current reality

The proposal chain is the canonical mutation path for domain entities.

Status enum: `ProposalStatus = "pending" | "approved" | "rejected" | "withdrawn"`
at `packages/domain/src/domain.ts:1166-1167`.

Verdict enum: `ReviewVerdict = "approve" | "reject" | "request_changes"`
at `:1169-1170`.

Change shape: `Change` is a discriminated union covering create/update/delete
for every entity kind; see `packages/domain/src/domain.ts:1172-1307`. A
Proposal carries an array of these changes.

Flow implemented today:

1. `Domain.propose({ projectID, actor, changes, ... })`
   — `packages/domain/src/domain.ts:1740-1775`
2. `Domain.reviewProposal({ proposalID, actor, verdict, comments })`
   — `:1865-1953`. If `verdict === "approve"`, `applyChanges` is called
   to write the entity mutations and a `Commit` record is produced.
3. `Domain.withdrawProposal` and `Domain.reviseProposal` for pending edits
   — `:1804-1864`.

The HTTP surface uses actor-based auto-approve (Decision 1, locked).
The helper `shouldAutoApprove(actor, requested)` at
`apps/server/src/server/routes/domain.ts:49-55` picks the default by
actor type:

- `actor.type === "agent"` → always `false`. Safety invariant: AI /
  workflow output must go through human review, even if the caller
  explicitly requests `autoApprove: true`.
- `actor.type === "user" | "system"` → defaults to `true`. Callers may
  still explicitly pass `autoApprove: false` to stage the write as a
  pending proposal.

The `queued(input, change, fallback)` wrapper at `:78-95` composes this
with a shared `autoCommit(proposal, actor, note)` helper at `:62-76`
which runs `Domain.reviewProposal` plus the `ProposalReviewed` /
`ProposalCommitted` bus publishes.

The same policy is applied by `POST /domain/proposal` (at `:1210-1222`)
and `POST /domain/import` (at `:2248-2250`), so bulk writes behave
identically to per-entity writes.

Write endpoints for domain entities (`POST /node`, `PATCH /node/:id`,
`DELETE /node/:id`, etc.) all route through `queued(...)`. See examples
at `apps/server/src/server/routes/domain.ts:346-463` for node writes.

This means: **every domain mutation in the HTTP layer already goes through
a proposal record**, whether autoApproved or not. The proposal chain is
not optional — it is the only path.

Invariants are covered by tests at
`apps/server/test/server/domain-auto-approve.test.ts` (7 tests: user /
system default, agent default, agent override, user opt-out, system
opt-out, `POST /domain/proposal` honors same policy).

### Intended direction

- Workflow-runner callsites that mutate domain state must supply
  `actor: { type: "agent", id: workflowID, version: workflowVersion }`.
  Today `author()` at `apps/server/src/server/routes/domain.ts:27-32`
  falls back to `ControlPlane.actor()` when the caller omits the
  `author` field; that fallback carries the logged-in user's identity
  into agent contexts. Workflow runners should pass an explicit agent
  actor rather than relying on any default. Not yet enforced by a
  structural guard.
- `graph-workbench-pattern.md`'s Proposed vs. Committed Nodes section
  requires a client-side helper to project `{ proposal.status, latest
  commit }` onto `nodeAdapter.status()`. Will be added during the
  primitive implementation (step 9 in `specs/README.md`).

## Sharing

### Current reality

Two parallel sharing systems coexist.

**Object shares (workspace-scoped, multi-kind):**

- `WorkspaceShareTable` lives in
  `apps/server/src/control-plane/control-plane.sql.ts`
- `Share` schema enumerates six kinds at
  `apps/server/src/control-plane/control-plane.ts:92-111`:
  `project | session | node | run | proposal | decision`
- `ShareEntityKind` is the tighter four-object subset at `:89-90`:
  `"node" | "run" | "proposal" | "decision"`

**Legacy session shares:**

- `SessionShareTable` at `apps/server/src/share/share.sql.ts:5-13`
- Published via `apps/server/src/share/share-next.ts:68+`, which calls out
  to a separate enterprise share endpoint
- This path syncs session transcript data on every `Session.Event.Updated`
  bus event (`share-next.ts:22-65`)

Both systems exist **simultaneously**. The legacy session share is still
actively subscribed to bus events and actively publishes transcripts; it
is not just a compatibility stub.

### Intended direction

- Workspace-share UIs for the four object kinds exist in the control
  plane but require end-to-end UI work to surface them in object
  workspaces. No spec assertion at the routes/UI level.
- The legacy session share should be reframed as an "archive" surface
  per the product commitment to object-centric sharing. Today the code
  does not make that distinction: it is a full sync channel.
- Workspace shares and session shares live in two different tables with
  different lifetimes and different publishing paths. Unification or
  explicit separation (rename `SessionShareTable` → `SessionArchiveTable`)
  remains pending.

## Permissions

### Current reality

Workspace roles: `owner | editor | viewer` via
`ControlPlane.Role` at
`apps/server/src/control-plane/control-plane.ts:36-37`.

Domain writes are role-gated server-side in
`apps/server/src/server/routes/domain.ts:113-140`:

- `guardDomainWrite` returns 401 if unauthenticated
- otherwise calls `ControlPlane.allowProject({ userID, projectID, need: "editor" })`
- returns 403 if the user is not at least `editor`
- the middleware is mounted on both the main Hono router and the
  `accepted` sub-router

Read methods (`GET / HEAD / OPTIONS`) bypass the guard
(`:111, :129-134, :136-140`).

**Capability snapshot on the plugin bridge** (Decision 3, locked).
`PluginCapabilities` is defined in
`packages/plugin-sdk/src/host-web.ts:32-45` as a pure boolean snapshot:

```ts
type PluginCapabilities = {
  canWrite: boolean
  canReview: boolean
  canShare: boolean
  canExportImport: boolean
  canManageMembers: boolean
  canRun: boolean
}
```

and exported alongside a `PLUGIN_CAPABILITIES_NONE` constant
(all-`false`, for guest / pre-provider defaults) at `:48-55`.
`PluginWebHost` exposes `capabilities(): PluginCapabilities` at
`:64-69`, called by plugins that need to gate UI on workspace role.

The host derivation lives in
`apps/web/src/context/permissions.ts`:

- `WorkspaceCapabilities` (at `:16-19`) is `PluginCapabilities` intersected
  with app-level display fields (`role`, `roleLabel`)
- `workspaceCapabilities(role)` at `:28-40` derives from role; `canRun`
  starts as a mirror of `canWrite` (a future policy may decouple them)
- `pluginCapabilities(ws)` at `:47-56` projects `WorkspaceCapabilities`
  down to the SDK shape
- Hooks at `:58-112` (`useWorkspaceCapabilities`, `useCanWrite`,
  `useCanReview`, `useCanShare`, `useCanExportImport`, `useCanRun`,
  `useIsOwner`)

Wiring: `PluginWebHostProvider` at
`apps/web/src/context/plugin-host.tsx:12-48` calls
`useWorkspaceCapabilities()` at the provider level and returns
`pluginCapabilities(ws)` from `capabilities()`.

`NodeAction.requires?: keyof PluginCapabilities` in
`packages/plugin-sdk/src/web/graph-workbench.tsx:43-74` is the binding
that lets lens `nodeActions` entries gate on this snapshot; the primitive
hides an action whose corresponding flag is `false`.

Tests: `apps/web/src/context/permissions.test.ts` (7 tests covering role
→ capabilities derivation, viewer / guest projections, the
role-stripping projection).

### Intended direction

Future granularity (not yet scheduled):

- Distinguish `canShare` from `canWrite` when workspace policy differs.
- Introduce a dedicated reviewer role, or per-proposal assignee permission.
- Object-share publish/unpublish gating independent of `canWrite`.
- Decouple `canRun` from `canWrite` once a separate runtime-execution
  policy exists.

## Review Queue

### Current reality

`WorkspaceReviewQueueTable` holds queue metadata at the workspace level;
see import at `apps/server/src/control-plane/control-plane.ts:21`.

`ReviewQueueItem` schema at `:116-131` carries:

- `proposalID`, `workspaceID`, `projectID`
- `assigneeUserID?`, `assignedByUserID?`
- `priority: "low" | "normal" | "high" | "urgent"` — `:113`
- `dueAt?` (epoch ms)
- `slaHours?`

The queue is queryable via `listReviewQueue` and writable via
`setReviewQueue` at `:1075+` and `:1090+`.

### Intended direction

- No automated SLA enforcement or due-date reminder pipeline exists.
- **(closed)** ~~The queue is visible via API but surfacing it as a
  "Reviews" workbench tab is pending on the `ui.md` spec.~~ Resolved:
  the `reviews` tab is registry-driven from `core.shell.workspaceTabs`
  (`plugins/core/plugin.ts:62`) and surfaces in
  `apps/web/src/pages/layout/sidebar-domain-overview.tsx` as a
  first-class tile labeled "Reviews" with a pending-proposal count,
  alongside the other 6 core tabs and a Commits timeline tile. The
  full queue UI lives at `apps/web/src/pages/reviews.tsx` (route
  `/:dir/reviews`) with proposal detail at `/:dir/reviews/:proposalID`
  (`apps/web/src/pages/workspace/proposal-workspace.tsx`).

## Known Gaps (flagged from review)

These are gaps identified during the restructure.

**Decided and implemented** (see the `Current reality` subsections
cited):

1. **Proposal-first boundary** — actor-based autoApprove (Decision 1).
   `shouldAutoApprove` at
   `apps/server/src/server/routes/domain.ts:49-55` plus the shared
   `autoCommit` helper at `:62-76`. Tests at
   `apps/server/test/server/domain-auto-approve.test.ts`.
2. **Capability API** (`canWrite` / `canReview` / `canShare` /
   `canExportImport` / `canManageMembers` / `canRun`) — typed snapshot
   on `PluginWebHost` (Decision 3).
   `PluginCapabilities` at `packages/plugin-sdk/src/host-web.ts:32-45`,
   `PluginWebHost.capabilities()` at `:64-69`. Host derivation at
   `apps/web/src/context/permissions.ts:16-56`. Wiring in
   `PluginWebHostProvider` at
   `apps/web/src/context/plugin-host.tsx:12-48`. Tests at
   `apps/web/src/context/permissions.test.ts`.

**Still open** (no decision yet):

3. **Workflow-runner actor enforcement.** Agent actor is a safety
   invariant on auto-approve, but today the HTTP `author()` fallback at
   `apps/server/src/server/routes/domain.ts:27-32` defaults to the
   logged-in user. Workflow runners should pass an explicit agent actor;
   no structural guard yet forces this at the runner level.
4. **Session attachment to proposal / decision has no UI surface.** The
   schema supports these targets; the graph workbench is node-scoped by
   design. How proposal/decision workspaces expose their sessions is a
   `ui.md` concern, pending.
5. **Actor attribution on Node / Edge / Artifact is implicit.** Must be
   read through proposal/commit history, not directly from the entity.
   No decision yet on whether to add first-class actor columns or to
   formalize the "provenance is through commits only" rule.
6. **Two share systems coexist.** The legacy `SessionShareTable` still
   actively syncs session transcripts via bus events. Unification or
   explicit rename (e.g., `SessionArchiveTable`) is pending.

Decisions 1 and 3 are implemented; gaps 3-6 await runner discipline,
`ui.md`, or product decisions.
