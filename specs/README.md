# Palimpsest Architecture Recovery

This directory is the recovered source of truth for the intended Palimpsest architecture after the repo was rolled back.

The core idea is simple:

**Palimpsest turns reasoning into assets.**

That means the platform is not primarily a chat UI, an IDE shell, or an automated research bot. It is a collaborative system for turning hypotheses, runs, artifacts, reviews, and decisions into durable project memory.

## Core Documents

- [project.md](./project.md)
  Product vision, scope, principles, and non-goals.
- [domain-model.md](./domain-model.md)
  Canonical core entities and relationships.
- [collaboration-model.md](./collaboration-model.md)
  Async collaboration, actor model, and proposal-first change flow.
- [plugin-system.md](./plugin-system.md)
  The single extension system: plugin, preset, and lens.
- [ui-product-model.md](./ui-product-model.md)
  Product-facing interaction model, tabs, actions, and sessions.
- [rebuild-roadmap.md](./rebuild-roadmap.md)
  Practical rebuild order after losing the refactor work.
- [recovered-decisions.md](./recovered-decisions.md)
  Explicit architectural decisions that had already been made before the rollback.
- [deopencode-cleanup.md](./deopencode-cleanup.md)
  The intended repo cleanup and de-OpenCode migration plan before rebuilding the product on top.
- [upstream-influences.md](./upstream-influences.md)
  What Palimpsest intentionally wanted to absorb from OpenCode and oh-my-openagent, and what it explicitly did not want to keep.
- [recovered-implementation-history.md](./recovered-implementation-history.md)
  Recovered milestones, accepted implementation details, and late-stage issues remembered from the lost refactor line.
- [recovered-commit-index.md](./recovered-commit-index.md)
  Recovered milestone commits and the file sets we could still reconstruct from the preserved `.codex` transcript.
- [cleanup-checklist.md](./cleanup-checklist.md)
  Concrete cleanup checklist for removing repo clutter, dead product lines, and lingering OpenCode-era surfaces during the rebuild.
- [recovery-sources.md](./recovery-sources.md)
  Where the recovered architecture memory came from, what can still be trusted, and what could not be recovered as code.
- [rebuild-retrospective.md](./rebuild-retrospective.md)
  What we would do differently if rebuilding Palimpsest from scratch again, including sequencing, plugin complexity, and technology-stack tradeoffs.
- [repo-restructure-plan.md](./repo-restructure-plan.md)
  The integrated current-state gap analysis plus the detailed remaining repository and architecture refactor plan needed to get from the restored OpenCode-shaped repo to the intended Palimpsest package topology.
- [security-audit-plugin-plan.md](./security-audit-plugin-plan.md)
  The AI-first security lens design: graph-native security reasoning, workflow-driven evidence gathering, and human-final risk review.

## Product Summary

Palimpsest should be:

- Web-only
- Linux server first
- Multi-user
- Proposal/review/commit driven
- Plugin-extensible through one unified plugin system

Palimpsest should not be:

- Research-only
- Desktop-first
- TUI-first
- IDE-extension-first
- A second shell around OpenCode

## Product Language vs Implementation Language

We made an explicit distinction between what users see and how the system is implemented.

Product language:

- Workspace
- Project
- Lens
- Ask
- Propose
- Review
- Run
- Inspect

Implementation language:

- Plugin
- Preset
- Lens
- Action handler
- Tool
- Agent
- Capability

Users should not need to understand internal plugin structure to use the product.

## Design Status

These documents intentionally describe the intended end-state and the accepted design direction, even if the current codebase has fallen behind or reverted.

If there is a conflict between current code and these specs, treat these specs as the target architecture for the rebuild.

## Recovery Evidence

These specs are not based on memory alone.

The main recovery sources are:

- `record.txt` in the repository
- `.codex` session transcript history under `/home/cheyanne/.codex/sessions/...`
- `.codex/history.jsonl`
- refreshed reference repositories in `/home/cheyanne/reference-repos/`
  - `opencode`
  - `oh-my-openagent`

The most useful source turned out to be the full `.codex` session transcript. It preserves:

- architectural decisions
- milestone summaries
- commit messages
- many exact `git add` file lists
- late-stage debugging context

It does **not** appear to preserve a directly restorable patch stream for the full lost refactor line.
