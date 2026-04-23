# Palimpsest Architecture Guide

`specs/` is the implementation contract for Palimpsest. Anything not
described here is not promised by the repository.

## This directory is being restructured

Until recently, `specs/` contained 21 narrative documents that overlapped
heavily and freely mixed "what exists today" with "what we intend to build."
This made specs unusable as a contract: every "should" was plausibly a fact
or a wish, and updating code no longer failed any spec.

The restructure collapses 21 specs into 5, adopts a strict two-column format
that separates fact from intent, and requires every "should" in a
Current-reality section to be backed by a test or structural guard.

See `Target Structure` and `In-Flight Restructure` below.

## Format Rule

Every section in every spec has two subsections:

### Current reality

- only what today's `master` branch actually implements
- must cite specific files, line ranges, tests, endpoints, or exports
- if you cannot cite, it is not current reality

### Intended direction

- explicit product commitments not yet realized
- must name the gap and, where feasible, the success test that will close it

Mixing current and intended in a single paragraph is banned.

## Rule: Spec = Test

Every "should" in a `Current reality` subsection needs at least one of:

- a typecheck, unit, or e2e test that fails if violated
- a lint rule that rejects the violation
- a structural guard (see `apps/server/test/plugin/import-boundary.test.ts`
  for the current canonical example)

Verbal-only guarantees are not allowed in Current reality. A "should"
without a verification path must either be demoted to Intended direction or
deleted.

## Target Structure

After the restructure, `specs/` contains exactly these files:

| File | Role | Corresponding code boundary |
| ---- | ---- | --------------------------- |
| `product.md` | Product-level commitments: proposal-first, session-per-object, Linux-server-first, domain-first. Aspirational north-star, with tests only where feasible. | none (commitment layer) |
| `domain.md` | The current domain implementation: entities, tables, API routes, session attachment, taxonomy shape, sharing, collaboration chain, permissions. | `packages/domain/` |
| `plugin.md` | The plugin system as implemented: plugin-sdk exports, preset/lens contract, server hooks, web ownership model. | `packages/plugin-sdk/src/` + `plugins/` |
| `ui.md` | The UI shell: workbench tabs, object workspaces, session side panel, contextual tooling, right rail. | `apps/web/src/` + `packages/ui/` |
| `graph-workbench-pattern.md` | The shared graph workbench primitive that graph-shaped lenses consume. Already in the correct shape; serves as the template for how the four new specs above should read. | `packages/plugin-sdk/src/web/` + consuming lenses |

Per-plugin narrative (such as "what is the security-audit plugin for")
lives in each plugin's own README (e.g.,
`plugins/security-audit/README.md`), not in `specs/`.

## In-Flight Restructure

All files except `README.md` and `graph-workbench-pattern.md` are currently
**DEPRECATED**. They carry a banner at the top identifying the target
spec that will absorb their content (or identifying them as scheduled for
deletion).

Do not treat deprecated specs as authoritative. Until the target spec lands,
read the deprecated file **only** to recover intent during the merge; do not
add new content to it.

### Deprecation map

| Deprecated spec | Disposition |
| --------------- | ----------- |
| `project.md` | merge into `product.md` |
| `linux-server-only-boundary.md` | merge into `product.md` |
| `domain-model.md` | rewrite as `domain.md` |
| `collaboration-model.md` | merge into `domain.md` |
| `domain-sharing-model.md` | merge into `domain.md` |
| `permissions-v1-model.md` | merge into `domain.md` |
| `plugin-system.md` | rewrite as `plugin.md` |
| `builtin-plugin-web-ownership.md` | merge into `plugin.md` |
| `ui-product-model.md` | rewrite as `ui.md` |
| `workbench-tooling-model.md` | merge into `ui.md` |
| `security-audit-plugin-plan.md` | move to `plugins/security-audit/README.md` |
| `rebuild-roadmap.md` | delete (use `git log`) |
| `rebuild-retrospective.md` | delete (use `git log`) |
| `repo-restructure-plan.md` | delete (use `git log`) |
| `recovery-sources.md` | delete (use `git log`) |
| `recovered-decisions.md` | delete (use `git log`) |
| `recovered-implementation-history.md` | delete (use `git log`) |
| `recovered-commit-index.md` | delete (use `git log`) |
| `deopencode-cleanup.md` | delete (use `git log`) |
| `cleanup-checklist.md` | delete (use `git log`) |
| `upstream-influences.md` | delete (use `git log`) |

### Restructure sequence

1. Write new `specs/README.md` and mark all old specs DEPRECATED. *(done)*
2. Author `specs/domain.md` from the four domain-related deprecated specs.
   Every assertion either cites current code or is labeled Intended direction. *(done)*
3. Physically delete the historical archive (`rebuild-*`, `recovered-*`,
   `recovery-*`, `deopencode-cleanup.md`, `cleanup-checklist.md`,
   `repo-restructure-plan.md`, `upstream-influences.md`). One commit. *(done)*
4. Author `specs/product.md` absorbing `project.md` and `linux-server-only-boundary.md`.
5. Author `specs/plugin.md` and `specs/ui.md` absorbing the remaining four.
6. Move `security-audit-plugin-plan.md` to `plugins/security-audit/README.md`.
7. Delete every deprecated spec in `specs/`.
8. Rewrite the top-level `README.md` to point at the new 5-spec structure.
9. Implement the three locked architectural decisions (actor-based
   autoApprove, `nodeActions` registry, `PluginCapabilities` snapshot) in
   code; tighten `SessionAttachment.entity` to a Zod enum.

## Working Vocabulary

### Product language (user-visible)

- Workspace
- Project
- Lens
- Node
- Run
- Artifact
- Decision
- Proposal
- Review
- Commit

With top-level actions:

- Ask
- Propose
- Review
- Run
- Inspect

### Implementation language (developer-visible)

- plugin
- preset
- lens
- object workspace
- action handler
- server hook
- workflow
- tool
- capability
