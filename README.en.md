# Palimpsest

**Palimpsest turns reasoning into assets.**

Palimpsest is a:

- Web-only product
- Linux-server-first platform
- workspace-based multi-user system
- domain-core-first collaboration product
- plugin-extensible system with one extension model

It is explicitly not:

- a desktop app
- a TUI-first shell
- an IDE extension product
- a research-only application
- “OpenCode plus research patches”

## Source Of Truth

The [`specs/`](./specs) directory is the implementation contract. Anything
not described there is not promised by the repository.

The five specs are:

- [`specs/product.md`](./specs/product.md) — product identity, core promise,
  runtime boundary, success criteria
- [`specs/domain.md`](./specs/domain.md) — the canonical domain layer
  (entities, tables, operations, session attachment, sharing, permissions)
- [`specs/plugin.md`](./specs/plugin.md) — the one extension system
  (manifest, preset, lens, server hook, web ownership, workflows)
- [`specs/ui.md`](./specs/ui.md) — the UI shell (routes, workbench tabs,
  object workspaces, session page, contextual tooling)
- [`specs/graph-workbench-pattern.md`](./specs/graph-workbench-pattern.md)
  — the shared graph workbench primitive consumed by graph-shaped lenses

Every section in every spec uses a strict **Current reality** /
**Intended direction** split: Current-reality claims must cite concrete
code, Intended-direction claims name the gap. See
[`specs/README.md`](./specs/README.md) for the format rule and the
spec = test discipline.

If code and specs disagree, the specs win.

## Product Concepts

Palimpsest centers on:

- Workspace
- Project
- Node
- Run
- Artifact
- Decision
- Proposal
- Review
- Commit

Stable user-facing actions should become:

- Ask
- Propose
- Review
- Run
- Inspect

## Current Product Shape

Palimpsest is now close enough to the target architecture that the useful mental
model is:

1. open a project
2. move through workbench tabs such as `Nodes`, `Runs`, `Artifacts`,
   `Decisions`, and `Reviews`
3. open an object workspace for a proposal, node, run, or decision
4. use files, terminal, diff, logs, and review as contextual tools
5. preserve the resulting provenance through proposals, commits, decisions,
   shares, and exports

The main remaining gaps are shell consistency, final ownership cleanup, and
polish of collaboration surfaces, not the absence of a core architecture.

## Local Development

The current package layout is:

- server: `apps/server`
- web app: `apps/web`
- domain: `packages/domain`
- runner: `packages/runner`
- builtin plugins: `plugins/{core,research,security-audit}`

See [README.quick-start.md](./README.quick-start.md) for the current local development entrypoints.
