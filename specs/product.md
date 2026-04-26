# Product

This spec is the product-level commitment layer. It covers what Palimpsest
is, what it is not, and the cross-cutting product commitments that do not
belong to any single subsystem (domain / plugin / ui / graph-workbench).

Unlike the other specs, some claims here cannot be reduced to an automated
test. Those are explicitly marked **Product commitment (north star)** and
live only in Intended direction — they are the criteria against which
architectural decisions are judged, not contracts the CI can enforce.

Scope:

- `apps/web/` — the browser UI
- `apps/server/` — the Linux-server runtime
- `plugins/core/`, `plugins/research/`, `plugins/security-audit/` — builtin lenses

## Product Identity

### Current reality

**Browser-first UI.** The user interface is a Vite + SolidJS web app.
Build entrypoint `apps/web/package.json:16` (`vite build`); dev entrypoint
`apps/web/package.json:14` (`vite`). There is no Electron, Tauri, or
native-shell wrapper in the repository. The only Tauri references are
filetype icons in `packages/ui/src/components/file-icons/types.ts:93`
(decorative, not runtime).

**Linux-server runtime.** The server binary is a single-entry Bun program:
`apps/server/bin/palimpsest`, declared at `apps/server/package.json` `bin`.
File-watcher platform dependencies at `apps/server/package.json` list
`@parcel/watcher-linux-*` for x64 and arm64 (glibc + musl) but **no**
macOS or Windows variants. This is mechanical evidence that the supported
runtime target is Linux.

**Multi-user workspace model.** `apps/server/src/control-plane/control-plane.sql.ts`
defines `AccountUserTable`, `AccountSessionTable`, `AccountWorkspaceTable`,
`WorkspaceMembershipTable`, `WorkspaceInviteTable`, `WorkspaceShareTable`,
`WorkspaceReviewQueueTable`. Roles are `owner | editor | viewer` via
`ControlPlane.Role` at `apps/server/src/control-plane/control-plane.ts:36-37`.

**Domain-first (not research-first).** `packages/domain/` is generic
across lenses. Each lens declares its own node / edge / run / artifact /
decision kinds in its plugin manifest, not in the domain core. Research
declares `question / hypothesis / claim / finding / source` node kinds
(`plugins/research/plugin.ts:10-17`); security-audit declares
`target / surface / finding / control / assumption / risk`
(`plugins/security-audit/plugin.ts:10-17`). The same domain tables
back both lenses' graph data.

**Proposal-first mutation.** Every domain mutation in the HTTP layer
writes a proposal record before (optionally) auto-committing. Auto-commit
is decided by `shouldAutoApprove` at
`apps/server/src/server/routes/domain.ts:49-55` (agent writes never
auto-commit; user / system writes default to auto-commit). See
`domain.md` Proposal → Review → Commit Chain Current reality.

### Intended direction

- **Product commitment (north star)**: Palimpsest reads as one coherent
  product, not as "research plus a security demo plus host chrome."
  Success criterion: a first-time user of either lens cannot tell which
  is "older" or "more built-in" from the UI alone.
- Single-binary server deploy story is partial: the binary exists; a
  documented `palimpsest serve` deployment recipe does not yet live in
  `README.md`. (See restructure sequence step 8.)

## Core Promise

Palimpsest turns reasoning into durable, reviewable project assets.

### Current reality

The seven durable reasoning assets are all backed by tables and typed
operations:

- **Graph objects** (node / edge) — `packages/domain/src/domain.sql.ts:22-58`
- **Runs** — `:60-85`
- **Artifacts** — `:87-108`
- **Decisions** — `:110-137` (including `superseded_by` for supersession chain)
- **Proposals / Reviews / Commits** — `:139-203`
- **Public shares** (object-kind) — `WorkspaceShareTable` in
  `apps/server/src/control-plane/control-plane.sql.ts`; six kinds
  (`project | session | node | run | proposal | decision`) at
  `apps/server/src/control-plane/control-plane.ts:92-111`

All mutations are actor-attributed on proposal / review / commit records
(`packages/domain/src/domain.ts:1155-1164`; see `domain.md` Actor Model).

### Intended direction

- **Product commitment (north star)**: a team using Palimpsest can, at any
  point, answer: *what object are we discussing? what evidence exists?
  which runs produced that evidence? what proposal changed project state?
  who reviewed it? what commit applied it? what decision did we make and
  why? can we share or export that history later?*
- **Exportable history** is only partially realized. Per-object export
  (a single node + its provenance chain) has no current API surface.
  Tracked as a `domain.md` Known Gap.

## Stable Product Surface

### Current reality

**Nouns** (all backed by domain tables and Zod schemas):

- Workspace, Project, Node, Run, Artifact, Decision, Proposal, Review,
  Commit — see `packages/domain/src/domain.ts` and
  `apps/server/src/control-plane/control-plane.ts`
- Lens — `packages/plugin-sdk/src/product.ts:10-30` (lens manifest schema)

**Verbs** (user-facing actions, declared per lens):

- `Ask / Propose / Run / Inspect / Review` — declared in
  `plugins/research/plugin.ts:77-102` (research)
  and `plugins/security-audit/plugin.ts:99-127` (security-audit). Each
  action carries `id`, `title`, `description`, `prompt`, `icon`,
  `priority`.

The graph workbench primitive surfaces these through `nodeActions`
(see `graph-workbench-pattern.md`, Decision 2).

### Intended direction

- **Product commitment**: users should encounter stable nouns and verbs
  in the UI, not implementation vocabulary (`workflow`, `session`,
  `capability`, `manifest`). These remain internal terms.
- Action surfacing in the UI is inconsistent: the workbench shell does
  not uniformly render lens `actions` as entry points. Pending `ui.md`.

## Builtin Lenses

### Current reality

Three builtin plugin bundles live under `plugins/`:

- `plugins/core/` — the base shell lens (`core.shell`) required by both
  `plugins/research/plugin.ts:27` and `plugins/security-audit/plugin.ts:27`
- `plugins/research/` — research-oriented taxonomy, preset, lens,
  workflow (`research-idea-tree-v1`), prompts, actions
- `plugins/security-audit/` — security-oriented taxonomy, preset, lens,
  workflow (`security-audit-v1`), prompts, actions, server hook

Each plugin declares its own:

- `manifest.ts` — identity and version
- `plugin.ts` — taxonomy, presets, lens, actions
- `server/` — plugin-specific server routes (security-audit only so far)
- `web/` — plugin-specific web pages (security-audit is further along)
- `workflows/` — workflow templates
- `prompts/`, `skills/`, `resources/`, `rules/` — AI-visible assets

### Intended direction

- **Product commitment**: research and security-audit are peer bundles
  with the same architectural status. Today security-audit is further
  along in web ownership (see `builtin-plugin-web-ownership.md`
  DEPRECATED, and `plugin.md` when it lands). Parity pending the
  research plugin migration in the restructure sequence.
- `plugins/core/` is underdocumented; its role vs. host shell is not
  clearly separated in any spec. Pending `plugin.md`.

## Locked Product Commitments

These three decisions are settled this restructure; they are the product
policy (not just technical details) behind implementation. All three are
now implemented in code; outstanding follow-up work is tracked in the
cited specs.

### Proposal-first mutation with actor-based autoApprove

Every domain mutation is a proposal record. Auto-commit is decided by
`actor.type`:

- `user` → `autoApprove: true` — personal edits auto-commit with audit trail
- `agent` → `autoApprove: false` — AI output requires human review
  (safety invariant; even explicit `autoApprove: true` from the caller
  is overridden)
- `system` → `autoApprove: true` — host-initiated writes (bootstrap)

Implemented by `shouldAutoApprove` at
`apps/server/src/server/routes/domain.ts:49-55`; see `domain.md`
Proposal → Review → Commit Chain Current reality and tests at
`apps/server/test/server/domain-auto-approve.test.ts`.

### Graph workbench actions as data (`nodeActions` registry)

The five product-level verbs (Ask / Propose / Review / Run / Inspect)
are not special-cased callbacks. They are entries in each lens's
`nodeActions: Array<NodeAction>` prop, alongside lens-specific verbs.

The `NodeAction<N>` type contract lives at
`packages/plugin-sdk/src/web/graph-workbench.tsx:43-74`; see
`graph-workbench-pattern.md` for the full primitive contract and
consumer examples. The primitive that renders the registry is step 9 of
the restructure.

### Typed capability snapshot exposed via plugin-sdk

The host derives `WorkspaceCapabilities` from workspace role
(`apps/web/src/context/permissions.ts:16-40`). Plugins reach the same
snapshot via `PluginWebHost.capabilities()` at
`packages/plugin-sdk/src/host-web.ts:64-69`, and action buttons in the
graph workbench gate on these flags via `NodeAction.requires`
(`keyof PluginCapabilities`). See `domain.md` Permissions Current
reality.

## What Palimpsest is Not

These are product commitments (north star), enforceable through product
direction rather than tests. Any feature that pulls the product toward
one of these anti-shapes is probably a wrong turn.

### Intended direction (commitments)

- **Not a desktop product line.** No Electron, no Tauri, no native shell
  as a first-class delivery. The one residual "native shell" reference
  at `apps/web/src/components/prompt-input/attachments.ts:95` is a
  clipboard-fallback comment; it is not a product identity.
- **Not a TUI.** No `tui/` directory; no ACP runtime. These were removed
  in earlier cleanup.
- **Not a research-only application.** `packages/domain/` is generic.
  Research-specific concerns live behind `plugins/research/`.
- **Not a scanner dashboard.** `security-audit-plugin-plan.md`
  (DEPRECATED, pending move to `plugins/security-audit/README.md`)
  explicitly rejects this framing.
- **Not an IDE shell with extra panels.** Files, terminal, diff, logs,
  review are contextual tools, not the product skeleton. Pending
  `ui.md`.
- **Not a thin OpenCode fork.** The repo originated from OpenCode but
  has diverged; domain layer, plugin system, workspaces, and domain
  objects are Palimpsest-specific.

## Runtime Boundary

### Current reality

Supported product shape:

- browser client (Vite + SolidJS, see `apps/web/package.json`)
- Linux-server runtime (Bun binary, Linux-only parcel watcher deps)
- multi-user workspace access (control-plane tables + role middleware)

The boundary is enforced by code structure: there is no packaging target
for macOS/Windows server runtime; there is no desktop application
bundler; there is no TUI renderer. These are absent, not hidden behind
flags.

### Intended direction

- **Product commitment**: users can open the web app against a Linux
  server and expect the full product. "Open Palimpsest" is never "run
  the desktop app" or "run the TUI."
- Remaining cleanup: a few translation keys and UI strings still carry
  desktop/native-shell language (see
  `apps/web/src/components/prompt-input/attachments.ts:95` clipboard
  fallback comment as the minor remaining trace). Not a blocker for
  product identity.

## Success Criteria

### Intended direction (north star)

Palimpsest is succeeding when:

- the UI reads as one coherent product (not "research app with security
  tab")
- research and security-audit feel like equal builtin lenses, neither
  dominant
- proposals / reviews / commits are visible to end users as product
  chain, not hidden implementation detail
- decisions are visibly tied to provenance (which proposal / which run
  / which evidence)
- object-level shares preserve reasoning history, not just a transcript
- plugins feel like complete bundles, with their own pages and
  workspaces, not host feature folders
- a first-time user can name at least three of *node / run / artifact /
  decision / proposal* as what they do in Palimpsest, unprompted

None of the criteria above are testable by CI. They are the acceptance
bar against which the restructure (and all future architectural choices)
is judged.

## Relationship to Other Specs

- `domain.md` — the durable reasoning assets and their runtime contract
- `plugin.md` — the plugin system that hosts builtin and future lenses
- `ui.md` — the UI shell that assembles the product surface
- `graph-workbench-pattern.md` — the shared primitive that makes two
  plugins feel like peer builtin lenses
