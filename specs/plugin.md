# Plugin

This spec covers the Palimpsest plugin system: the one extension point
for adding presets, lenses, workflows, actions, server behavior, and
web surfaces on top of the domain spine.

Scope:

- `packages/plugin-sdk/` — the stable contract plugins consume
- `apps/server/src/plugin/` — host-side wiring of the plugin contract
- `plugins/core/`, `plugins/research/`, `plugins/security-audit/` — the
  three builtin plugin bundles
- `apps/server/test/plugin/` — structural guards

## One Extension System

### Current reality

Palimpsest has exactly one extension mechanism: **plugin**. Everything
else — preset, lens, action, workflow, tool, capability — is a surface
exposed by a plugin.

Plugin SDK entry points (`packages/plugin-sdk/package.json:12-19`):

- `.` → `src/index.ts` (event / tool / config hooks, a subset of the
  OpenCode-style `Plugin` shape at `src/index.ts:29-237`)
- `./product` → `src/product.ts` (preset / lens / taxonomy / action
  schemas, used by every builtin plugin)
- `./host` → `src/host.ts` (server-side `PluginHostAPI` a plugin
  receives through its `server(host)` hook)
- `./host-web` → `src/host-web.ts` (browser-side `PluginWebHost`
  bridge for plugin web bundles)
- `./tool`, `./workflow` → supporting schemas

### Intended direction

- **Product commitment (from `product.md`)**: there should not be
  separate long-lived extension systems for extension packs, preset
  packs, lens packs, or expert modes. New capabilities belong inside
  the plugin system.

## Contract Schema

### Current reality

Every builtin plugin returns a `ProductPlugin` record via
`defineProductPlugin(...)` at `packages/plugin-sdk/src/product.ts:159-161`.
Shape at `:145-157`:

```ts
type ProductPlugin = {
  manifest: PluginInfo
  taxonomies?: Record<string, Taxonomy>
  presets?: PresetRuntime[]
  lenses?: LensRuntime[]
  server?: PluginServerHook
}
```

Sub-schemas (all Zod-validated):

- `PluginInfo` — `id`, `version`, `title`, `description`,
  `capabilities: string[]`
  (`packages/plugin-sdk/src/product.ts:17-24`)
- `PresetInfo` — `id`, `pluginID`, `title`, `icon`,
  `defaultTaxonomyID`, `defaultLensIDs`, `fields`, `defaults`
  (`:53-64`)
- `LensInfo` — `id`, `pluginID`, `title`, `priority`,
  `appliesToPresets`, `appliesToTaxonomies`, `requiresCapabilities`,
  `workspaceTabs`, `sessionTabs`, `actions`
  (`:66-81`)
- `ActionInfo` — `id` (enum: `ask | propose | review | run | inspect`),
  `title`, `description`, `prompt`, `icon`, `priority`
  (`:41-51`). **The five product-level verbs are pinned in the schema.**
- `WorkspaceTab` / `SessionTab` — `id`, `title`, `icon`, `priority`,
  `kind: "core" | "lens"`, `pluginID?`, `lensID?`
  (`:26-39`)
- `Taxonomy` — per-project rule set; keys match the taxonomy columns
  in `domain.md`

### Intended direction

- Taxonomy editing UI at the preset / lens level does not exist; today
  taxonomy is fixed at preset creation.

## Manifest, Preset, Lens

### Current reality

**Manifest.** A one-file identity record. Example — research:
`plugins/research/manifest.ts:1-8` and security-audit:
`plugins/security-audit/manifest.ts:1-8`. Both follow the same shape:
`{ id, version, title, description, capabilities }`.

**Preset.** A project creation recipe. `plugins/research/plugin.ts:19-62`
declares `research.inquiry`: `defaultTaxonomyID: "research.core"`,
`defaultLensIDs: ["core.shell", "research.workbench"]`, creation fields
for `question` / `background`, and an `async create(input)` that writes
an initial brief to `.palimpsest/research/brief.md`.

Security-audit preset: `plugins/security-audit/plugin.ts:19-77`, same
shape, different fields (`target` / `objective` / `constraints`).

**Lens.** An additive interpretation layer. Example:
`plugins/research/plugin.ts:63-106` declares `research.workbench`:
`priority: 60`, `appliesToPresets`, `appliesToTaxonomies`,
`workspaceTabs: [research, literature]`,
`actions: [ask, propose, run]`.

Security-audit lens: `plugins/security-audit/plugin.ts:79-131`:
`workspaceTabs: [security, findings]`,
`sessionTabs: [security-graph, security-findings, security-workflows, security-evidence]`,
`actions: [review, run, inspect]`.

**Lens ordering** is deterministic: `priority` field first, then lens
declaration order, then lexical id.

### Intended direction

- Lens applicability remains declarative (`appliesToPresets`,
  `appliesToTaxonomies`, `requiresCapabilities`). This is important
  both for registry behavior and for any future dynamic loading.
- A dynamic plugin loading / hot-reload flow is out of scope for the
  current maturity phase; see Web Ownership below for the current
  compile-time ownership stance.

## Builtin Plugins

### Current reality

Three plugin bundles:

**`plugins/core/`** (`plugins/core/plugin.ts`):

- Taxonomy `core.default` — neutral nodeKinds/edgeKinds/etc.
- Preset `core.blank` — "General Project", minimal brief field
- Lens `core.shell` at priority 100 — provides the 7 core workspace
  tabs (`nodes / runs / artifacts / decisions / reviews / monitors /
  sources`, declared at `plugins/core/plugin.ts:57-65`), the 3 core
  session tabs (`conversation / context / review` at `:66-70`), and
  the 5 core actions (`ask / propose / review / run / inspect` at
  `:71-112`).
- `core.shell` `appliesToPresets` the other two builtin presets too,
  so every Palimpsest project carries the core tabs automatically.
- Server hook at `plugins/core/server/server-hook.ts`.

**`plugins/research/`** (`plugins/research/plugin.ts`):

- Taxonomy `research.core` — 5 nodeKinds (`question / hypothesis / claim
  / finding / source`), 4 edgeKinds (`supports / refutes / relates_to
  / raises`), etc.
- Preset `research.inquiry`
- Lens `research.workbench` at priority 60 — adds `research` and
  `literature` tabs on top of the core shell

**`plugins/security-audit/`** (`plugins/security-audit/plugin.ts`):

- Taxonomy `security-audit.core` — 6 nodeKinds (`target / surface /
  finding / control / assumption / risk`), 7 edgeKinds, 5 decisionKinds
  (`accept_risk / mitigate_risk / false_positive / needs_validation /
  defer_risk`)
- Preset `security-audit.audit`
- Lens `security-audit.workbench` at priority 60 — adds `security` and
  `findings` workspace tabs plus 4 session tabs

### Intended direction

- Research trails security-audit in web page ownership (see Web
  Ownership below). Parity is scheduled during the restructure.
- All seven `core.shell` workspace tabs have backing routes and pages
  in `apps/web/src/pages/` (`nodes.tsx`, `runs.tsx`, `artifacts.tsx`,
  `decisions.tsx`, `reviews.tsx`, `monitors.tsx`, `sources.tsx`). The
  `monitors` page today is narrowly scoped to proposal bus events
  (`apps/web/src/pages/monitors.tsx:10-15`); broader product-wide
  definition is pending. See `ui.md` Known Gaps.

## Server Hook

### Current reality

Server-side plugin behavior is added through an optional `server` hook
in `ProductPlugin`. Signature: `PluginServerHook` at
`packages/plugin-sdk/src/host.ts`. Plugins receive a stable
`PluginHostAPI` (`:50-` in the same file) exposing:

- `log.create({ service })` — scoped logger
- `identifier.ascending(prefix)` — id minter
- `db.use(cb) / db.transaction(cb)` — Drizzle access
- `bus.define / publish / subscribe` — event bus
- `session.get / create` — session primitives
- ...

Security-audit uses this at `plugins/security-audit/server/server-hook.ts`;
its server routes live at `plugins/security-audit/server/security.ts`.

**The boundary is enforced by test.**
`apps/server/test/plugin/import-boundary.test.ts` scans every
`.ts|.tsx|.mts|.cts` file under `plugins/` and rejects imports of:

- `@/...` (host alias)
- `@palimpsest/server/...` (server package private path)
- `@palimpsest/web/...` (web package private path)
- relative paths into `apps/server/` or `apps/web/`

This is the canonical example of spec = test for the plugin system.

### Intended direction

- More builtin server behavior should move from `apps/server/src/` into
  plugin server hooks as plugins mature.

## Web Ownership

### Current reality

Plugin web pages are owned by plugin packages and lazy-imported by the
host:

- `plugins/security-audit/web/index.ts` exports page entrypoints
  (`security.tsx`, `findings.tsx`) plus a context provider
  (`context/security-audit.tsx`). The workbench component
  (`web/components/workbench.tsx`, 746 lines) consumes the
  context.
- `plugins/research/web/index.ts` exports page entrypoints
  (`research.tsx`, `literature.tsx`) plus a context provider. It is
  further behind security-audit in completeness.

Plugin web code reaches host behavior only through
`packages/plugin-sdk/src/host-web.ts`:

```ts
type PluginWebHost = {
  directory(): string | undefined
  workspaceID(): string | undefined
  actor(): PluginWebActor
  baseURL(): string | URL | undefined
  fetch(input: URL | string, init?: RequestInit): Promise<Response>
}
```

Plugins never import `@/...` or `@palimpsest/web/...`. The same
import-boundary test that guards server-side plugin code also guards
web-side plugin code.

### Intended direction

- **Product commitment**: research and security-audit are peer bundles
  with the same architectural status. Today security-audit owns more
  of its web surface; research has files (`atom-*.tsx`,
  `experiment-*.tsx`, `atoms-tab.tsx`, `graph-state-manager.ts`,
  `research-legacy-sdk.ts`) still sitting in `apps/web/src/pages/session/`
  that must be moved into `plugins/research/web/`.
- **Decision 3** from the current restructure (`domain.md` Permissions
  Intended direction) adds `capabilities(): PluginCapabilities` to
  `PluginWebHost`. Scheduled.
- Dynamic plugin web registration (runtime component registry, hot
  reload) remains out of scope. The current compile-time ownership
  model with stable package exports is the approved model.

## Workflows

### Current reality

Plugins define workflow templates declaratively. Each workflow lives in
`plugins/<id>/workflows/<workflow-id>-v<N>/` with:

- `index.ts` — declares the `WorkflowTemplate` record (`kind / title /
  summary / prompt / policy / defs / flows`) via
  `WorkflowSchema.Template.parse(...)` from
  `@palimpsest/plugin-sdk/workflow`
- `flows/default.ts` — flow-level metadata
- `steps/<kind>.ts` — per-step prompts, inputs, outputs, validation

Example templates:

- `plugins/research/workflows/research-idea-tree-v1/index.ts` — 6 steps
  (`gather_idea → clarify_idea → find_existing_context → build_idea_tree
  → link_idea_tree → review_tree`)
- `plugins/security-audit/workflows/security-audit-v1/index.ts` — 7
  steps (`gather_scope → seed_graph → map_surface →
  hypothesize_findings → gather_evidence → validate_findings →
  review_risk`)

Each step declares an edit policy
(`{ can_next, can_wait_interaction, can_edit_future, allowed_edit_ops }`)
that constrains what the running step may mutate. The review step is the
only one with `can_wait_interaction: true` in both templates, reflecting
the product commitment that human review is the gate to risk-state
changes.

### Intended direction

- Actor attribution for workflow runs currently depends on the workflow
  runner supplying `actor.type: "agent"` on domain writes. See
  `domain.md` Decision 1 scheduled work.

## Locked Architectural Decisions (reminder)

The three decisions locked during the current restructure that touch
the plugin system:

1. `NodeAction` registry in `graph-workbench-pattern.md` — the five
   product-level verbs (`ActionID` at
   `packages/plugin-sdk/src/product.ts:4`) become entries in a lens's
   `nodeActions` array. Lenses may also add custom verbs
   (e.g., `mark-false-positive`).
2. `PluginCapabilities` snapshot exposed via `PluginWebHost`
   (`domain.md` Permissions Intended direction).
3. Actor-based autoApprove on domain writes
   (`domain.md` Proposal → Review → Commit Chain Intended direction).
   The workflow runner must supply `actor.type: "agent"` when mutating
   domain state on behalf of a plugin workflow; this is the callsite
   that enforces the "AI output is review-required" policy.

## Relationship to Other Specs

- `domain.md` — what plugins write to and read from
- `product.md` — the product-level commitments the plugin system
  realizes (proposal-first, five stable verbs, peer builtin lenses)
- `ui.md` — where plugin tabs / pages / workspaces render
- `graph-workbench-pattern.md` — the graph UI primitive that plugin web
  bundles consume through `@palimpsest/plugin-sdk/web/graph-workbench`
