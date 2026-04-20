# UI and Product Interaction Model

## Product Surface Goal

The user should experience one coherent Palimpsest product, not a stack of special-case apps.

That means:

- the UI must be core-first
- lenses extend the shell rather than replacing it
- agent implementation details should not leak into top-level interaction modes

## Project Creation

Project creation should follow one unified flow.

### Entry Points

- Open Existing Project
- New Project
- Import Project

### New Project Flow

1. Choose a preset
2. Fill preset-specific creation inputs
3. Create core project
4. Run preset postCreate initialization
5. Install default lenses

Research should appear here as a preset, not as the singular default creation path.

## Core Workspace Tabs

The stable product shell should center on:

- Nodes
- Runs
- Artifacts
- Decisions
- Reviews
- Monitors
- Sources

Lenses may contribute more tabs, but the core tabs remain the default frame.

## Lens Tabs

Lenses can contribute project-specific views such as:

- Research
- Security
- Eval

But those are extensions to the shell, not replacements for it.

## Session Model

Sessions should be generic containers.

A session may attach to:

- project
- node
- run
- proposal
- decision

Lenses interpret and render those attachments.

Palimpsest should avoid letting special domain objects define the entire session shell.

Anti-goal examples:

- atom session as a hardcoded page class
- experiment session as a hardcoded page class
- research main session as a hardcoded page class

## Product Actions

Top-level interaction should be framed around stable actions:

- Ask
- Propose
- Review
- Run
- Inspect

These are product concepts.

The underlying implementation may use internal agents, tools, or workflows, but those should remain secondary.

Examples of internal implementation details that should not dominate the UI:

- `build`
- `plan`
- `experiment_plan`
- `research_project_init`

## Review as a First-Class Surface

Proposal / review / commit should be visible in the main UI.

The Reviews area should expose:

- proposal inbox
- proposal detail
- review history
- resulting commits
- related decisions

The timeline should make reasoning provenance visible.

## Share / Export Product Expectations

Assetization should be user-visible, not only schema-visible.

That means:

- share pages should show proposal and decision provenance
- exports should include proposal/review/commit timelines
- history should be inspectable, not hidden in internal tables

## UI Anti-Goals

Palimpsest should avoid:

- research-first entry framing
- exposing internal agent families as top-level product modes
- mixing legacy mode systems with the new action system
- splitting the shell into separate research/domain products
