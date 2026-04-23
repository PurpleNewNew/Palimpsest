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

The HTTP surface has a `queued(meta, change, fallback)` helper at
`apps/server/src/server/routes/domain.ts:38-63` that:

- creates a proposal with the given change
- if `meta.autoApprove === true`, immediately reviews with verdict
  `"approve"` and returns the proposal (plus commit)

Write endpoints for domain entities (`POST /node`, `PATCH /node/:id`,
`DELETE /node/:id`, etc.) all route through `queued(...)`. See examples
at `apps/server/src/server/routes/domain.ts:314-391` for node writes.

This means: **every domain mutation in the HTTP layer already goes through
a proposal record**, whether autoApproved or not. The proposal chain is
not optional — it is the only path.

### Intended direction

The proposal-first boundary is decided: **actor-based autoApprove**.

Decision (locked):

- `actor.type === "user"` → `autoApprove: true` (user-initiated mutations
  auto-commit; the proposal record still exists for audit)
- `actor.type === "agent"` → `autoApprove: false` (workflow / AI output is
  always review-required)
- `actor.type === "system"` → `autoApprove: true` (host-initiated writes,
  such as project bootstrap)

Scheduled for implementation during the current restructure:

- `queued(...)` at `apps/server/src/server/routes/domain.ts:38-63` picks
  its `autoApprove` default from `actor.type`, rather than requiring every
  caller to pass it explicitly.
- Workflow-runner callsites that mutate domain state must explicitly
  supply `actor: { type: "agent", id: workflowID, version: workflowVersion }`.
  Today `author()` at `:27-32` falls back to the logged-in user, which would
  incorrectly auto-approve agent output.
- `graph-workbench-pattern.md`'s Proposed vs. Committed Nodes section
  requires a client-side helper to project `{ proposal.status, latest
  commit }` onto `nodeAdapter.status()`. That helper will be added during
  the primitive implementation.

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
`apps/server/src/server/routes/domain.ts:81-102`:

- `guardDomainWrite` returns 401 if unauthenticated
- otherwise calls `ControlPlane.allowProject({ userID, projectID, need: "editor" })`
- returns 403 if the user is not at least `editor`
- the middleware is mounted on both the main Hono router and the
  `accepted` sub-router

Read methods (`GET / HEAD / OPTIONS`) bypass the guard
(`:97-102`).

### Intended direction

**Capability API** is decided: expose the existing host-level
`WorkspaceCapabilities` through `plugin-sdk/host-web` so plugins can
consume it through the stable bridge.

Note: the capability type and derivation **already exist** in the host.
`apps/web/src/context/permissions.ts:6-14` defines:

```ts
type WorkspaceCapabilities = {
  role: WorkspaceRole
  roleLabel: string
  canWrite: boolean
  canReview: boolean
  canShare: boolean
  canExportImport: boolean
  canManageMembers: boolean
}
```

with derivation via `workspaceCapabilities(role)` at
`permissions.ts:23-34` and hooks at `:36-79`
(`useWorkspaceCapabilities`, `useCanWrite`, `useCanReview`,
`useCanShare`, `useCanExportImport`, `useIsOwner`).

Apps/web workspace pages already consume it
(`apps/web/src/pages/workspace.tsx:31, 170, 186`; object workspaces
under `apps/web/src/pages/workspace/*`).

Decision (locked): expose via plugin-sdk so plugins can reach the same
snapshot.

Scheduled for implementation during the current restructure:

- Move the `WorkspaceCapabilities` type to
  `packages/plugin-sdk/src/host-web.ts` (rename to `PluginCapabilities`
  or re-export). Apps/web keeps the derivation; plugin code reaches it
  through the host bridge.
- Add to `PluginWebHost`: `capabilities(): PluginCapabilities`, wired in
  apps/web by calling `useWorkspaceCapabilities()` at the provider
  level and exposing the snapshot.
- `NodeAction.requires?: keyof PluginCapabilities` in
  `graph-workbench-pattern.md` binds this type into the graph
  workbench: action buttons whose `requires` flag is `false` are hidden.
- The `canRun` flag referenced by the graph workbench examples does not
  yet exist on `WorkspaceCapabilities`. Add it during the move; initial
  mapping is `canRun = canWrite`.

Future granularity (not yet scheduled):

- Distinguish `canShare` from `canWrite` when workspace policy differs.
- Introduce a dedicated reviewer role, or per-proposal assignee permission.
- Object-share publish/unpublish gating independent of `canWrite`.

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
- The queue is visible via API but surfacing it as a "Reviews" workbench
  tab is pending on the `ui.md` spec.

## Known Gaps (flagged from review)

These are gaps identified during the restructure.

**Decided and scheduled for implementation** (see section-level
`Intended direction` subsections for each):

1. Proposal-first boundary — **decided actor-based autoApprove** (Decision 1).
   Implementation scheduled in this restructure.
2. Capability API (`canWrite` / `canReview` / `canShare` / `canExportImport`
   / `canRun`) — **decided** typed snapshot on `PluginWebHost` (Decision 3).
   Host already derives `WorkspaceCapabilities`; remaining work is
   exposing it through `plugin-sdk/host-web.ts`. Scheduled.

**Still open** (no decision yet):

3. **Session attachment to proposal / decision has no UI surface.** The
   schema supports these targets; the graph workbench is node-scoped by
   design. How proposal/decision workspaces expose their sessions is a
   `ui.md` concern, pending.
4. **Actor attribution on Node / Edge / Artifact is implicit.** Must be
   read through proposal/commit history, not directly from the entity.
   No decision yet on whether to add first-class actor columns or to
   formalize the "provenance is through commits only" rule.
5. **Two share systems coexist.** The legacy `SessionShareTable` still
   actively syncs session transcripts via bus events. Unification or
   explicit rename (e.g., `SessionArchiveTable`) is pending.

Decisions 1-2 are made and scheduled; gaps 3-5 await `ui.md` or
product decisions.
