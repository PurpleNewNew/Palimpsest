# Project Definition

## One-line Definition

**Palimpsest is a collaborative platform for turning reasoning into durable,
reviewable project assets.**

Those assets are not only final answers. They include:

- graph objects
- runs
- artifacts
- decisions
- proposals
- reviews
- commits
- public shares
- exportable history

## Product Identity

Palimpsest is intended to be:

- a browser-first product
- Linux server first
- multi-user and workspace-based
- domain-first rather than research-first
- proposal/review/commit driven
- plugin-extensible through one plugin system

Palimpsest is **not** intended to be:

- a desktop product line
- a TUI product line
- a research-only application
- a scanner dashboard
- an IDE shell with extra domain panels
- a thin fork of OpenCode

## Core Promise

Palimpsest should let a team answer:

- What object are we discussing?
- What evidence exists?
- Which runs produced that evidence?
- What proposal changed the project state?
- Who reviewed it?
- What commit applied it?
- What decision did we make and why?
- Can we share or export that history later?

## Stable Product Surface

The product should read around:

- Workspace
- Project
- Node
- Run
- Artifact
- Decision
- Proposal
- Review
- Commit

User-facing actions should remain stable:

- Ask
- Propose
- Review
- Run
- Inspect

Internal tools, agents, and workflows may evolve, but that top-level language
should stay stable.

## Builtin Lenses

Builtin lenses are first-class product surfaces, not feature piles inside the
host app.

The two most important builtin lenses today are:

- `research`
- `security-audit`

They should be treated as **peer bundles** with the same architectural status:

- plugin-owned preset
- plugin-owned lens
- plugin-owned workflows
- plugin-owned prompts/skills/resources
- plugin-owned server behavior
- plugin-owned web pages and workspaces

## Current Product Shape

The platform now has enough structure that the correct mental model is:

1. open a project
2. move through workbench tabs such as `Nodes`, `Runs`, `Artifacts`,
   `Decisions`, and `Reviews`
3. open an object workspace for a proposal, decision, node, or run
4. use contextual tools such as files, terminal, diff, logs, and review
5. preserve the resulting provenance through proposals, commits, decisions,
   shares, and exports

## Current Maturity Statement

Palimpsest is no longer best described as a recovery project.

A more accurate statement is:

- the repo and package topology largely reflect the target architecture
- builtin plugins are real modules
- the domain spine is in place
- collaboration and provenance are visible in the product
- the remaining work is mostly about final ownership cleanup, shell consistency,
  and maturity of collaboration surfaces

## Success Criteria

Palimpsest is succeeding when:

- the UI reads like one coherent product
- research and security both feel native without owning the whole world
- proposals, reviews, and commits are obvious to end users
- decisions are visibly tied to provenance
- object-level shares and exports preserve reasoning history
- plugins feel like complete bundles rather than host feature folders
