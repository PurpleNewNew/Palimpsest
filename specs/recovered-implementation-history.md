# Recovered Implementation History

> Historical archive: milestone narrative and implementation notes recovered
> from prior rollouts. Use this for context, not as the current architecture
> entrypoint.

This document captures implementation-level facts recovered from `record.txt`.

Additional evidence also came from the preserved `.codex` session transcript at:

- `/home/cheyanne/.codex/sessions/2026/04/19/rollout-2026-04-19T15-06-49-019da490-3bd5-7140-995f-78650b4f8a84.jsonl`

For a more file-oriented reconstruction map, also see:

- [recovered-commit-index.md](./recovered-commit-index.md)

It is not a source-of-truth architecture spec by itself. It exists to preserve:

- what we had already implemented
- what we had already proven out
- what issues we hit late in the refactor

## Important Architectural Clarifications Recovered From Record

### 1. Preset vs Lens Boundaries Were Tightened

These points had already been converged on:

- preset is chosen only at project creation time
- preset cannot be installed after creation
- lens can be installed after creation
- presets are more than taxonomy defaults
- presets may own postCreate initialization

### 2. Client-side Applicability Needed Declarative Rules

We explicitly rejected a function-style lens applicability API because it cannot be serialized cleanly to the client.

The intended direction was:

- `applies_to_taxonomies`
- `requires_capabilities`
- `applies_to_presets`

### 3. Create UI Was Intentionally Component-Driven

We explicitly did **not** want to promise a full JSON-schema-driven dynamic form runtime in v1.

Day 1 expectation was:

- server validates preset input
- clients render preset-specific form fragments/components

### 4. Lens Removal Should Gracefully Degrade

We explicitly wanted plugin/lens removal to degrade safely:

- project remains readable
- domain-core shell remains usable
- lens-specific tabs/actions disappear
- stored lens metadata/config remains preserved but inactive

### 5. Lens Installation Needed Versioning

We had already identified that installed lenses need:

- `plugin_version`
- `config_version`

Without this, upgrading plugin-owned config would be too fragile.

### 6. Actions Needed a Lens-Provided Routing Layer

We had explicitly identified a missing middle layer:

The UI should show:

- Ask
- Propose
- Review
- Run
- Inspect

But the actual routing for those actions should be provided by the active lens/plugin.

This was an explicit design need, not an optional nicety.

## Recovered Milestones That Had Already Been Implemented

These milestones were explicitly mentioned in the record as having been completed in the lost line.

### Plugin-Owned Presets and Lenses

At one point, the refactor had already reached:

- plugin SDK support for preset and lens contracts
- `/api/plugins/presets`
- `POST /api/projects` accepting `presetID + presetInput`
- `research` and `security-audit` both registering through the same plugin contract
- removal of the old `taxonomyID` override shortcut from project creation

The transcript also preserved the exact milestone commit message:

- `f1100f9` / `Add plugin-owned project presets and lenses`

### Directoryized Plugin Bundles

We had already introduced:

- `plugins/core`
- `plugins/research`
- `plugins/security-audit`

And loader support for:

- builtin `plugins/*/plugin.ts`
- local `.palimpsest/plugins/<id>/plugin.ts`

This was explicitly tracked in the recovered implementation timeline as a discrete milestone.

### Lens-Driven App Shell

The record shows that we had already pushed the shell away from hardcoded `research_core` logic toward:

- workspace tabs resolved from installed lenses
- session shell informed by lens registry
- preset UI opened via plugin web contribution

Recovered milestone evidence:

- `cb4993a` / `Make app shell lens-driven`

### Product Actions Had Been Reframed

The product-level action language had already been pushed toward:

- Ask
- Propose
- Review
- Run
- Inspect

Internal agent names were intentionally being hidden behind that layer.

This later converged with the session-domain work in:

- `3ba5405` / `Unify plugin sessions and product actions`

### Sessions Had Started Moving to Domain Attachments

The session model had started shifting toward attachment-based interpretation:

- node
- run
- proposal
- decision

Instead of hardcoding atom/experiment session classes as shell-level page types.

### Research and Security Were Being Physically Relocated

The record shows multiple stages of real migration into plugin directories, including:

- plugin-owned prompts
- plugin-owned web contributions
- plugin-owned server entrypoints
- research route/preset logic being moved under `plugins/research/server`
- security capability/workflow logic being moved under `plugins/security-audit/server`

Recovered milestone evidence includes:

- `1ebffd7` / directory server/web ownership moved into plugin directories
- `1cb5201` / `Move research workbench into plugin bundles`

### Proposal-First Platform Core Had Already Been Established

The platform already had, at one point:

- proposal / review / commit model
- actor model
- permission v1
- share/export/timeline wired around proposal/review/commit

This means the rebuild does not need to re-decide those concepts from scratch.

## Recovered Product-Level Concerns

### 1. Research and Security Were Still Not Fully Symmetric

We explicitly recognized that:

- research still had too much special treatment
- security-audit still risked being “just a capability pack”

The intended end-state remained:

- both are equal plugin-owned builtin lenses

### 2. UI Hardcoding Was a Recurrent Source of Debt

The record repeatedly identified these anti-patterns:

- `taxonomy.id === "research_core"` hardcoding
- workspace split into `research` vs `domain`
- session shell determined by research object type

Those patterns were considered architectural debt, not harmless shortcuts.

### 3. Plugin Directory Migration Was Expected to Be Incremental

We had already accepted that some migrations would be:

- directory shell first
- real ownership later

Bridge re-exports were considered acceptable as an intermediate step, but not the end-state.

## Recovered Late-Stage Issues

The record also preserves some of the last issues we hit after major refactors.

### Platform/Auth Request Timing

We identified that repeated `401/403` noise on:

- `/api/plugins/presets`
- `/api/projects/:id/lenses`

was not primarily a backend permission bug.

The deeper issue was:

- frontend components issuing platform-scoped requests before login/workspace/project scope was fully ready
- old persisted project/workspace state causing requests for projects no longer visible in the current workspace

This matters because it should shape the rebuilt app shell and persisted-state cleanup strategy.

### Persisted Local State Was Polluting Workspace UI

We also identified that stale persisted state could resurrect invalid project/workspace references through:

- server-side project-open memory
- layout page memory
- workspace ordering / expanded state
- last-project-session memory

That problem should be explicitly guarded against during rebuild.

### Drag-and-Drop Cleanup Warnings

We also saw solid-dnd style warnings about:

- removing nonexistent draggable/droppable/transformer entries

These were treated as a separate lifecycle cleanup issue, not the same root cause as auth/workspace request timing.

## Practical Takeaway

The most important lesson from the record is:

By the time the line was lost, we had already moved far beyond “rough idea” stage.

We had:

- strong product language
- a settled collaboration model
- a settled plugin philosophy
- a clear de-OpenCode cleanup direction
- partially implemented plugin-owned, lens-driven architecture

So the rebuild should proceed as a recovery of an already-converged system, not as a fresh exploration.
