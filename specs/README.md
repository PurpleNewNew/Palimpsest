# Palimpsest Architecture Guide

`specs/` now serves two purposes:

1. document the **current intended architecture and product model**
2. preserve the **historical recovery/rebuild record** that got the project here

The important change is that Palimpsest is no longer primarily in a "rebuild" phase.
The repo is now close enough to the intended shape that the top of this directory
should be read as a **current architecture guide**, not as a disaster-recovery pack.

## Product Thesis

**Palimpsest turns reasoning into assets.**

The platform exists to preserve and operationalize the path from question to
conclusion:

- nodes
- runs
- artifacts
- decisions
- proposals
- reviews
- commits

The product is not primarily a chat surface, not an IDE shell, and not a
research-only tool. It is a collaborative system for building durable reasoning
history.

## Current Product Shape

Palimpsest is:

- web-first
- Linux server first
- multi-user and workspace-based
- proposal/review/commit driven
- plugin-extensible through one plugin system
- domain-first rather than research-first

Builtin lenses currently matter most:

- `core`
- `research`
- `security-audit`

## Read This First

These documents describe the **active target architecture** and should be used as
the current source of truth when implementing features.

- [project.md](./project.md)
  Product definition, goals, non-goals, and current maturity model.
- [domain-model.md](./domain-model.md)
  Canonical entities and ownership rules for workspaces, projects, graph
  objects, proposals, reviews, commits, shares, and permissions.
- [collaboration-model.md](./collaboration-model.md)
  Async collaboration model, actor model, review queue, commit timeline, and
  provenance expectations.
- [plugin-system.md](./plugin-system.md)
  The one extension system: plugin, preset, lens, actions, server hooks, and
  web ownership.
- [ui-product-model.md](./ui-product-model.md)
  The current shell model: core workbench tabs, object workspaces, sessions,
  reviews, and product actions.
- [workbench-tooling-model.md](./workbench-tooling-model.md)
  How terminal, files, diff, logs, and review fit into Palimpsest as contextual
  tooling rather than shell-defining skeleton.
- [domain-sharing-model.md](./domain-sharing-model.md)
  Object-centric sharing for node/run/proposal/decision and the remaining gap
  from older session-centric public URLs.
- [permissions-v1-model.md](./permissions-v1-model.md)
  Current role model, write gates, review permissions, and remaining cleanup.
- [linux-server-only-boundary.md](./linux-server-only-boundary.md)
  Product boundary for Linux-server-first delivery and the remaining cleanup of
  desktop/WSL assumptions.
- [builtin-plugin-web-ownership.md](./builtin-plugin-web-ownership.md)
  What it means for builtin plugins to truly own their web pages and workspaces,
  and what still needs to move out of the host.
- [security-audit-plugin-plan.md](./security-audit-plugin-plan.md)
  The AI-first security lens: graph-native security reasoning, workflow-driven
  evidence gathering, and human-final review.

## Working Vocabulary

### Stable product language

Users should mostly see:

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

### Implementation language

Developers implement:

- plugin
- preset
- lens
- object workspace
- action handler
- server hook
- workflow
- tool
- capability

## Current Maturity

As of the current repo state:

- the domain spine is in place
- preset/lens/plugin ownership is real
- proposal/review/commit is a visible product chain
- object workspaces exist for proposals, decisions, nodes, and runs
- security is now an AI-first builtin plugin rather than a placeholder
- object sharing and review queue infrastructure exist

The largest remaining gaps are mostly **shell consistency and final ownership
cleanup**, not basic architecture.

## Historical Archive

The following documents are still valuable, but they are now primarily **history
and rationale**, not the top-level source of truth for day-to-day implementation:

- [rebuild-roadmap.md](./rebuild-roadmap.md)
- [repo-restructure-plan.md](./repo-restructure-plan.md)
- [rebuild-retrospective.md](./rebuild-retrospective.md)
- [recovery-sources.md](./recovery-sources.md)
- [recovered-decisions.md](./recovered-decisions.md)
- [recovered-implementation-history.md](./recovered-implementation-history.md)
- [recovered-commit-index.md](./recovered-commit-index.md)
- [deopencode-cleanup.md](./deopencode-cleanup.md)
- [cleanup-checklist.md](./cleanup-checklist.md)
- [upstream-influences.md](./upstream-influences.md)

Use these when you need:

- why a decision was made
- how the repo got from the old OpenCode shape to Palimpsest
- which cleanup phases were already completed
- what prior rollouts implemented and validated

## Rule of Thumb

If current code conflicts with older rebuild or recovery documents:

- prefer the **current architecture docs** above
- use the historical docs only to recover intent or justify tradeoffs
