# Recovered Decisions

> Historical archive: these are recovered architecture decisions from the
> rebuild period. Many remain valid, but the current architecture docs should be
> treated as the live reference.

This document records decisions that had already been converged on before the rollback.

These are not open brainstorming notes. They should be treated as established design direction unless a new RFC explicitly changes them.

## Product and Runtime

### 1. Rename and Product Identity

The intended product name is:

- `Palimpsest`

The old `OpenResearch` identity is no longer the intended final product identity.

### 2. Runtime Shape

Palimpsest should be:

- Web-only
- Linux server first

It should not prioritize:

- desktop packaging
- TUI as a primary product surface
- Windows/macOS-native runtime targets

### 3. Multi-user by Default

The intended platform shape is workspace-oriented multi-user collaboration, not a single-user local shell.

## Architecture

### 4. Domain Is the Core

The system should be rebuilt around:

- workspace
- project
- node
- edge
- run
- artifact
- decision
- proposal
- review
- commit

Research-specific entities are lens-level interpretations, not the core world model.

### 5. Research Is Not the Product World

Research is important, but it is not the system identity.

Research should exist as:

- a preset
- a lens
- a plugin bundle

The same rule applies to `security-audit`.

### 6. One Extension System

There should not be a permanent split between:

- plugin
- extension
- lens-pack
- preset-pack

There is one extension system: plugin.

Presets and lenses are plugin capabilities.

### 7. Plugin as Directory Boundary

A plugin should be a directory that may own:

- manifest
- server logic
- web logic
- prompts
- skills
- resources
- rules
- assets

This was a deliberate move away from scattering plugin logic throughout app and server packages.

## Collaboration

### 8. Async Collaboration Was Chosen

The system should use async collaboration:

- proposal
- review
- commit

Realtime CRDT-style co-editing is not the intended v1 model.

### 9. Proposal-First Writes

Ordinary mutations should become proposals first.

The system should not normalize direct accepted-state mutation as the default path.

### 10. Public Direct Commit Is Wrong

Direct public commit creation bypassing proposal/review was considered architecturally wrong and should not be part of the stable model.

### 11. Actors Are First-Class

Three actor types were chosen:

- user
- agent
- system

Agent versioning matters. The system should show which agent version proposed a change.

## Product Experience

### 12. Product Actions Should Be Stable

The intended top-level action language is:

- Ask
- Propose
- Review
- Run
- Inspect

Internal agent names like `build`, `plan`, `experiment_plan`, or `research_project_init` should not dominate the product surface.

### 13. Session Should Be Domain-Based

Sessions should attach to domain objects:

- node
- run
- proposal
- decision

Hardcoded atom-session / experiment-session page classes were identified as legacy debt.

### 14. Core-First Tabs

The UI should center on stable core tabs:

- Nodes
- Runs
- Artifacts
- Decisions
- Reviews
- Monitors
- Sources

Lenses may add tabs, but should not replace the entire shell.

## Permissions and Governance

### 15. Permission v1

The initial workspace role model is:

- owner
- editor
- viewer

That is intentionally simple but sufficient for proposal/review boundaries.

### 16. Assetization Means Exportability

The product promise includes:

- shareable history
- exportable history
- recoverable history

Proposal/review/commit should be visible in share/export/replay flows, not hidden as internal-only metadata.

## Rebuild Priority

### 17. Spine Before Polish

When rebuilding after rollback, the correct order is:

1. domain model
2. proposal/review/commit
3. workspace/auth/permissions
4. plugin system
5. lens-driven UI shell
6. builtin plugins
7. experience polish

### 18. Do Not Rebuild Research-First by Accident

One of the biggest risks is recreating the old product shape:

- project creation starts from paper upload
- research hardcodes top-level tabs
- internal agents become user-facing modes

That should be treated as regression, even if it is easier to reintroduce during rebuild.
