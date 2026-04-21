# Palimpsest

**Palimpsest turns reasoning into assets.**

Palimpsest is being rebuilt as a:

- Web-only product
- Linux server first platform
- workspace-based multi-user system
- domain-core-first collaboration product
- plugin-extensible system with one extension model

It is **not** being rebuilt as:

- a desktop app
- a TUI-first shell
- an IDE extension product
- a research-only application
- “OpenCode plus research patches”

## Source Of Truth

During the rebuild, the source of truth is the [`specs/`](./specs) directory.

Start with:

- [`specs/project.md`](./specs/project.md)
- [`specs/rebuild-roadmap.md`](./specs/rebuild-roadmap.md)
- [`specs/deopencode-cleanup.md`](./specs/deopencode-cleanup.md)
- [`specs/domain-model.md`](./specs/domain-model.md)
- [`specs/collaboration-model.md`](./specs/collaboration-model.md)

If the code and the specs disagree, the specs win.

## Rebuild Direction

The intended rebuild order is:

1. preserve architecture and terminology
2. remove the old OpenCode-era product shell
3. restore the domain spine
4. restore proposal/review/commit
5. restore workspace/auth/permissions
6. restore the unified plugin system
7. restore the lens-driven product shell
8. restore builtin plugins such as `research` and `security-audit`

The main rule is:

**Rebuild the spine first, then restore lenses.**

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

## Current Repo Reality

This repository is still mid-cleanup.

Some directory names and package names still carry legacy `opencode` naming because the full rename is not finished yet. That should be treated as temporary implementation debt, not the target product identity.

## Local Development

The current rebuild still runs from the existing package layout:

- server: `apps/server`
- web app: `apps/web`

See [README.quick-start.md](./README.quick-start.md) for the current local development entrypoints.
