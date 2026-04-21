# Palimpsest

**Palimpsest turns reasoning into assets.**

Palimpsest is being rebuilt as a:

- Web-only product
- Linux-server-first platform
- workspace-based multi-user system
- domain-core-first collaboration product
- plugin-extensible system with one extension model

It is explicitly not being rebuilt as:

- a desktop app
- a TUI-first shell
- an IDE extension product
- a research-only application
- “OpenCode plus research patches”

## Source Of Truth

During the rebuild, the [`specs/`](./specs) directory is the source of truth.

Start with:

- [`specs/project.md`](./specs/project.md)
- [`specs/rebuild-roadmap.md`](./specs/rebuild-roadmap.md)
- [`specs/deopencode-cleanup.md`](./specs/deopencode-cleanup.md)
- [`specs/domain-model.md`](./specs/domain-model.md)
- [`specs/collaboration-model.md`](./specs/collaboration-model.md)

If code and specs disagree, the specs win.

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

The core rule is:

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

The repository is still mid-cleanup. Sprint 1 completed the de-OpenCode substrate cut: the runtime, auth, MCP, and tooling surfaces no longer advertise themselves as OpenCode. Two subscription paths (OpenAI Codex, GitHub Copilot) are intentionally retained as OpenCode-client impersonations, because that is the third-party client identity those vendors accept. See `specs/repo-restructure-plan.md` for rationale.

## Local Development

The current rebuild still runs from the existing package layout:

- server: `apps/server`
- web app: `apps/web`

See [README.quick-start.md](./README.quick-start.md) for the current local development entrypoints.
