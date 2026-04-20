# Recovered Commit Index

This document records the milestone commits that could be reconstructed from the preserved `.codex` session transcript.

Primary evidence source:

- `/home/cheyanne/.codex/sessions/2026/04/19/rollout-2026-04-19T15-06-49-019da490-3bd5-7140-995f-78650b4f8a84.jsonl`

The transcript preserved many exact `git add ... && git commit -m "..."` commands and their outputs.

That means we can often recover:

- commit sha
- commit message
- working directory
- explicit file list

But not always. Some commits used coarse staging like `git add -A` or `git add packages/app packages/server plugins`, which means we only know the milestone scope, not every exact file.

## How To Use This Index

- Treat this as a **rebuild clue map**, not a perfect source-of-truth patch log.
- When rebuilding a milestone, use this index together with:
  - [recovered-implementation-history.md](./recovered-implementation-history.md)
  - [recovery-sources.md](./recovery-sources.md)
  - the refreshed upstream reference repos

## Phase A: OpenResearch -> Generic Domain

### `cfcf6dd` — `Refactor research core into generic domain`

- repo state: `openresearch`
- evidence: preserved in transcript
- exact staged file list: **not fully recoverable**
- note: the first commit attempt failed because git identity was unset; the milestone still clearly existed and later appeared as `cfcf6dd`

This is the strategic pivot where the system stopped treating research objects as the only core model and introduced the generic domain spine.

### `de4fc49` — `Add generic domain tool surface`

Recovered files:

- `packages/opencode/src/tool/domain.ts`
- `packages/opencode/src/tool/registry.ts`
- `packages/opencode/test/tool/domain.test.ts`

### `762be9c` — `Rename taxonomy capabilities for domain core`

Recovered files:

- `packages/opencode/src/capability/builtin.ts`
- `packages/opencode/src/capability/schema.ts`
- `packages/opencode/test/capability/registry.test.ts`
- `packages/plugin/src/capability.ts`
- `packages/sdk/js/src/v2/gen/types.gen.ts`

### `0617e98` — `Bind projects to taxonomy presets`

Recovered files:

- `packages/opencode/src/project/project.sql.ts`
- `packages/opencode/src/project/project.ts`
- `packages/opencode/src/project/taxonomy.ts`
- `packages/opencode/src/server/routes/project.ts`
- `packages/opencode/src/server/routes/research.ts`
- `packages/opencode/test/project/project.test.ts`
- `packages/opencode/migration/20260419153000_project_taxonomy/migration.sql`
- `packages/sdk/js/src/v2/gen/sdk.gen.ts`
- `packages/sdk/js/src/v2/gen/types.gen.ts`

### `21ba67b` — `Add project taxonomy preset picker`

Recovered files:

- `packages/app/src/components/dialog-edit-project.tsx`

### `2d714ce` — `Add builtin security audit plugin`

Recovered files:

- `packages/opencode/src/capability/builtin/security.ts`
- `packages/opencode/src/plugin/security.ts`
- `packages/opencode/src/workflow/templates/security-audit-v1`
- `packages/opencode/src/plugin/index.ts`
- `packages/opencode/src/plugin/codex.ts`
- `packages/opencode/src/plugin/copilot.ts`
- `packages/opencode/test/capability/registry.test.ts`
- `packages/opencode/test/tool/registry.test.ts`
- `packages/plugin/src/index.ts`

### `2613c8d` — `Make research writes domain-first`

Recovered files:

- `packages/opencode/src/research/domain-sync.ts`
- `packages/opencode/src/research/experiment-watcher.ts`
- `packages/opencode/src/server/routes/research.ts`
- `packages/opencode/src/session/experiment-guard.ts`
- `packages/opencode/src/tool/atom.ts`
- `packages/opencode/src/tool/experiment-watch.ts`
- `packages/opencode/src/tool/experiment.ts`
- `packages/opencode/test/research/domain-sync.test.ts`

### `0164fa4` — `Enforce taxonomy at domain runtime`

Recovered files:

- `packages/opencode/src/domain/domain.ts`
- `packages/opencode/src/project/taxonomy.ts`
- `packages/opencode/src/server/routes/domain.ts`
- `packages/opencode/src/server/routes/project.ts`
- `packages/opencode/src/tool/domain.ts`
- `packages/opencode/test/project/project.test.ts`
- `packages/opencode/test/tool/domain.test.ts`
- `packages/sdk/js/src/v2/gen/sdk.gen.ts`
- `packages/sdk/js/src/v2/gen/types.gen.ts`

### `4952908` — `Move research routes into builtin plugin`

Recovered files:

- `packages/plugin/src/route.ts`
- `packages/plugin/src/index.ts`
- `packages/opencode/src/plugin/index.ts`
- `packages/opencode/src/plugin/research.ts`
- `packages/opencode/src/server/server.ts`
- `packages/opencode/test/server/plugin-routes.test.ts`

### `3331af7` — `Add domain audit replay export substrate`

Recovered files:

- `packages/opencode/src/domain/domain.sql.ts`
- `packages/opencode/src/domain/domain.ts`
- `packages/opencode/src/domain/archive.ts`
- `packages/opencode/src/server/routes/domain.ts`
- `packages/opencode/src/server/routes/project.ts`
- `packages/opencode/src/tool/domain.ts`
- `packages/opencode/test/domain/domain.test.ts`
- `packages/opencode/test/domain/archive.test.ts`
- `packages/opencode/migration/20260420003000_domain_audit_archive/migration.sql`
- `packages/sdk/js/src/v2/gen/sdk.gen.ts`
- `packages/sdk/js/src/v2/gen/types.gen.ts`

### `0098f12` — `Complete generic workspace tabs`

Recovered files:

- `packages/app/src/components/dialog-new-research-project.tsx`
- `packages/app/src/pages/session/atom-view.ts`
- `packages/app/src/pages/session/domain-tab.tsx`
- `packages/app/src/pages/session/session-side-panel.tsx`
- `packages/app/src/pages/session/workspace-view.ts`
- `packages/app/src/pages/session/workspace-view.test.ts`

### `8e511a3` — `Complete security audit plugin loop`

Recovered files:

- `packages/opencode/src/plugin/security.ts`
- `packages/opencode/src/workflow/templates/security-audit-v1/steps/collect-findings.md`
- `packages/opencode/src/workflow/templates/security-audit-v1/steps/record-outcome.md`
- `packages/opencode/src/workflow/templates/security-audit-v1/steps/scope-target.md`
- `packages/opencode/test/tool/registry.test.ts`

## Phase B: OpenResearch -> Palimpsest

### `9a59531` — RFC set for async collaboration / actor / data model

Recovered files:

- `specs/project.md`
- `specs/0001-collaboration-model.md`
- `specs/0002-actor-model.md`
- `specs/0003-data-model-v1.md`

### `fd0b7e6` — proposal / review / commit domain model

Recovered files:

- `packages/server/src/domain/domain.sql.ts`
- `packages/server/src/domain/domain.ts`
- `packages/server/src/storage/schema.ts`
- `packages/server/test/domain/domain.test.ts`
- `packages/server/migration/20260420143000_proposal_history/migration.sql`

### `fd0f732` — hardened proposal approval flow

Recovered files:

- `packages/server/src/domain/domain.ts`
- `packages/server/src/server/routes/domain-api.ts`
- `packages/server/test/domain/domain.test.ts`
- `specs/project.md`
- `specs/0004-tool-proposal-translation.md`

### `e5be22b` — remove TUI main path / fix web runtime entry

Recovered files:

- `package.json`
- `packages/app/AGENTS.md`
- `packages/app/playwright.config.ts`
- `packages/sdk/js/script/build.ts`
- `packages/sdk/js/src/v2/gen/sdk.gen.ts`
- `packages/sdk/js/src/v2/gen/types.gen.ts`
- `packages/sdk/openapi.json`
- `packages/server/src/index.ts`
- `packages/server/src/mcp/index.ts`
- `packages/server/src/server/server.ts`
- `packages/server/test/server/session-select.test.ts`
- `packages/server/test/server/web-runtime.test.ts`
- `packages/server/tsconfig.json`
- `script/dev-web.sh`

### `542d920` — `Fix web runtime bootstrap and session finish reasons`

Recovered files:

- `packages/app/src/context/global-sync.tsx`
- `packages/app/src/pages/layout/sidebar-workspace.tsx`
- `packages/app/src/pages/session/session-side-panel.tsx`
- `packages/server/src/server/routes/research.ts`
- `packages/server/src/server/server.ts`
- `packages/server/src/session/message-v2.ts`
- `packages/server/src/session/processor.ts`
- `packages/server/test/server/plugin-routes.test.ts`
- `packages/server/test/server/web-runtime.test.ts`
- `packages/server/test/session/structured-output.test.ts`

### `db13243` — research mutation tools proposal-first

Recovered files:

- `packages/server/src/capability/builtin/research.ts`
- `packages/server/src/domain/domain.ts`
- `packages/server/src/plugin/security.ts`
- `packages/server/src/research/domain-sync.ts`
- `packages/server/src/research/proposal.ts`
- `packages/server/src/server/routes/domain-api.ts`
- `packages/server/src/tool/article.ts`
- `packages/server/src/tool/atom.ts`
- `packages/server/src/tool/domain.ts`
- `packages/server/src/tool/experiment.ts`
- `packages/server/src/tool/proposal.ts`
- `packages/server/test/tool/domain.test.ts`
- `packages/server/test/tool/registry.test.ts`
- `packages/server/test/tool/research-proposal.test.ts`

### `f304801` — `Add proposal review inbox UI`

Recovered files:

- `packages/app/src/pages/session/domain-tab.tsx`
- `packages/app/src/pages/session/session-side-panel.tsx`

### `5162c31` — actor model productized

Recovered files:

- `packages/app/src/pages/session/atom-view.ts`
- `packages/app/src/pages/session/domain-tab.tsx`
- `packages/sdk/js/src/v2/gen/sdk.gen.ts`
- `packages/sdk/js/src/v2/gen/types.gen.ts`
- `packages/sdk/openapi.json`
- `packages/server/src/domain/domain.sql.ts`
- `packages/server/src/domain/domain.ts`
- `packages/server/src/server/routes/domain-api.ts`
- `packages/server/src/server/routes/domain.ts`
- `packages/server/src/share/share-next.ts`
- `packages/server/src/tool/article.ts`
- `packages/server/src/tool/atom.ts`
- `packages/server/src/tool/experiment.ts`
- `packages/server/src/tool/proposal.ts`
- `packages/server/test/domain/domain.test.ts`
- `packages/server/test/tool/research-proposal.test.ts`
- `packages/server/migration/20260420184500_domain_actor_fields/migration.sql`

### `d26da23` — permission v1 + proposal/commit-centric export/share/timeline

Recovered files:

- `packages/app/src/context/platform-session.tsx`
- `packages/app/src/pages/session/domain-tab.tsx`
- `packages/sdk/js/src/v2/gen/types.gen.ts`
- `packages/sdk/openapi.json`
- `packages/server/src/cli/cmd/import.ts`
- `packages/server/src/domain/archive.ts`
- `packages/server/src/domain/domain.ts`
- `packages/server/src/platform/context.ts`
- `packages/server/src/platform/workspace.ts`
- `packages/server/src/server/routes/domain-api.ts`
- `packages/server/src/server/routes/platform-scope.ts`
- `packages/server/src/server/routes/project-api.ts`
- `packages/server/src/server/routes/project.ts`
- `packages/server/src/server/server.ts`
- `packages/server/src/share/share-next.ts`
- `packages/server/src/tool/proposal.ts`
- `packages/server/test/cli/import.test.ts`
- `packages/server/test/domain/archive.test.ts`
- `packages/server/test/server/platform-domain-scope.test.ts`

### `f1100f9` — `Add plugin-owned project presets and lenses`

Recovered files:

- `specs/0005-plugin-preset-lens-contract.md`
- `specs/project.md`
- `specs/0004-tool-proposal-translation.md`
- `packages/plugin/src/index.ts`
- `packages/plugin/src/preset.ts`
- `packages/plugin/src/lens.ts`
- `packages/server/src/plugin/index.ts`
- `packages/server/src/plugin/core.ts`
- `packages/server/src/plugin/research.ts`
- `packages/server/src/plugin/security.ts`
- `packages/server/src/project/project.sql.ts`
- `packages/server/src/project/project.ts`
- `packages/server/src/server/routes/project-api.ts`
- `packages/server/src/server/routes/plugin-api.ts`
- `packages/server/src/server/routes/research.ts`
- `packages/server/src/server/server.ts`
- `packages/server/src/research/preset.ts`
- `packages/server/migration/20260420193000_project_presets_lenses/migration.sql`
- `packages/server/test/server/project-preset-flow.test.ts`
- `packages/app/src/components/dialog-new-project.tsx`
- `packages/app/src/components/dialog-new-research-project.tsx`
- `packages/sdk/openapi.json`
- `packages/sdk/js/src/v2/gen/sdk.gen.ts`
- `packages/sdk/js/src/v2/gen/types.gen.ts`

### `262f5cb` — `Scaffold directoryized plugin bundles`

Exact file list was not fully reconstructed from transcript in this repo state, but the milestone scope is known to have included:

- RFC `0006`
- plugin bundle manifest types
- top-level `plugins/` bundle scaffolding
- builtin bundle loader support

### `cb4993a` — `Make app shell lens-driven`

Recovered files:

- `packages/app/src/plugin/shell.ts`
- `packages/app/src/plugin/web.tsx`
- `packages/app/src/components/dialog-new-project.tsx`
- `packages/app/src/pages/layout/sidebar-workspace.tsx`
- `packages/app/src/pages/session/session-side-panel.tsx`
- `packages/app/src/pages/session/workspace-view.ts`
- `packages/app/src/pages/session/workspace-view.test.ts`

### `3ba5405` — `Unify plugin sessions and product actions`

Recovered files:

- `packages/app/src/components/prompt-input.tsx`
- `packages/app/src/components/prompt-input/slash-popover.tsx`
- `packages/app/src/context/global-sdk.tsx`
- `packages/app/src/context/sdk.tsx`
- `packages/app/src/pages/session.tsx`
- `packages/app/src/pages/session/session-side-panel.tsx`
- `packages/app/src/plugin/shell.ts`
- `packages/app/src/plugin/web.tsx`
- `packages/app/src/plugin/web-contract.ts`
- `packages/app/src/utils/server.ts`
- `packages/app/tsconfig.json`
- `packages/sdk/js/src/v2/client.ts`
- `packages/server/src/domain/domain.ts`
- `packages/server/src/server/routes/domain-api.ts`
- `plugins/core/web/index.tsx`
- `plugins/research/plugin.ts`
- `plugins/research/prompts`
- `plugins/research/server/index.ts`
- `plugins/research/web/index.tsx`
- `plugins/security-audit/plugin.ts`
- `plugins/security-audit/server/index.ts`
- `plugins/security-audit/web/index.tsx`

### `1ebffd7` — deeper plugin ownership of research/security server+web entrypoints

Recovered files:

- `package.json`
- `bun.lock`
- `packages/server/tsconfig.json`
- `packages/server/src/plugin/research.ts`
- `packages/server/src/plugin/security.ts`
- `packages/app/src/pages/session/session-side-panel.tsx`
- `packages/app/src/plugin/web-contract.ts`
- `packages/app/src/plugin/web.tsx`
- `plugins/core/package.json`
- `plugins/core/web/index.tsx`
- `plugins/research/package.json`
- `plugins/research/server/index.ts`
- `plugins/research/web/index.tsx`
- `plugins/security-audit/package.json`
- `plugins/security-audit/server/index.ts`
- `plugins/security-audit/web/index.tsx`

### `6f45554` — deeper research/security asset relocation

Recovered files:

- `bun.lock`
- `packages/app/src/components/dialog-path-picker.tsx`
- `packages/app/src/components/dialog-import-research-project.tsx`
- `packages/app/src/components/dialog-new-project.tsx`
- `packages/app/src/components/dialog-new-research-project.tsx`
- `packages/app/src/pages/session/codes-tab.tsx`
- `packages/app/src/pages/session/servers-tab.tsx`
- `packages/app/src/pages/session/session-side-panel.tsx`
- `packages/server/src/capability/builtin/security.ts`
- `packages/server/src/research/preset.ts`
- `packages/server/src/server/routes/research.ts`
- `packages/server/src/workflow/templates/security-audit-v1/index.ts`
- `plugins/research/package.json`
- `plugins/research/server/index.ts`
- `plugins/research/server/preset.ts`
- `plugins/research/server/routes.ts`
- `plugins/research/web/index.tsx`
- `plugins/research/web/dialog-new-research-project.tsx`
- `plugins/security-audit/server/index.ts`
- `plugins/security-audit/server/capability.ts`
- `plugins/security-audit/server/workflow`

### `1cb5201` — `Move research workbench into plugin bundles`

Recovered scope from transcript output:

- `packages/app`
- `packages/plugin`
- `packages/server`
- `plugins`
- `bun.lock`

The transcript additionally preserved rename evidence showing that this milestone moved research workbench UI into plugin-owned web directories, including:

- `atom-chat-panel.tsx`
- `atom-detail-fullscreen.tsx`
- `atom-detail-node.tsx`
- `atom-detail-panel.tsx`
- `atom-detail-view.tsx`
- `atom-graph-view.tsx`
- `atom-session-tab.tsx`
- `atom-view.ts`

## Important Limitation

This index is intentionally incomplete.

Where the preserved transcript only showed:

- `git add -A`
- broad package-level staging
- or a milestone summary without exact staging

we record the scope honestly rather than inventing a more precise file list than the evidence supports.
