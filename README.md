# Palimpsest

**Palimpsest turns reasoning into assets.**

Palimpsest is a:

- Web-only product
- Linux server first platform
- workspace-based multi-user system
- domain-core-first collaboration product
- plugin-extensible system with one extension model

It is **not**:

- a desktop app
- a TUI-first shell
- an IDE extension product
- a research-only application
- “OpenCode plus research patches”

## Source Of Truth

The source of truth is the [`specs/`](./specs) directory, read primarily as the
current architecture guide.

Start with:

- [`specs/project.md`](./specs/project.md)
- [`specs/domain-model.md`](./specs/domain-model.md)
- [`specs/collaboration-model.md`](./specs/collaboration-model.md)
- [`specs/plugin-system.md`](./specs/plugin-system.md)
- [`specs/ui-product-model.md`](./specs/ui-product-model.md)

If the code and the specs disagree, the specs win.

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

The current package layout:

- server: `apps/server`
- web app: `apps/web`
- domain: `packages/domain`
- runner: `packages/runner`
- builtin plugins: `plugins/{core,research,security-audit}`

See [README.quick-start.md](./README.quick-start.md) for the current local development entrypoints.
