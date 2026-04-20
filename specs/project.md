# Project Vision

## One-line Vision

**Palimpsest turns reasoning into assets.**

The platform exists to preserve and operationalize the path from question to conclusion:

- hypotheses
- runs
- artifacts
- reviews
- decisions

The goal is not merely faster output. The goal is durable, inspectable, reusable project memory.

## Product Shape

Palimpsest is intended to be:

- a Web-only product
- Linux server first
- multi-user and workspace-based
- domain-core first, not research-first
- plugin-extensible through one unified plugin system

## What Palimpsest Is Not

Palimpsest is not intended to be:

- a desktop app product
- a TUI product
- an IDE plugin product
- a research-only application
- a thin fork of OpenCode
- an agent shell where chat is the primary durable object

## Primary Product Promise

Palimpsest should let a team answer questions like:

- What did we propose?
- What evidence was produced?
- Which agent or user produced it?
- Who approved or rejected it?
- What changed after that decision?
- Can we export and replay this history later?

## Guiding Principles

### 1. Domain First

The core platform manages durable project entities, not domain-specific chat transcripts.

### 2. Proposal First

Ordinary changes should produce proposals before they become accepted state.

### 3. Async Collaboration

Palimpsest should optimize for GitHub/Linear-style review workflows rather than CRDT real-time co-editing.

### 4. Research Is a Lens

Research is an important builtin workflow, but it is not the system world model.

### 5. One Extension System

There should be one plugin system. Presets and lenses are capability surfaces within plugins, not parallel extension mechanisms.

### 6. Users See Stable Product Language

Users should see stable product actions and concepts, while internal agents, tools, and workflows remain implementation details.

## Product-Level Concepts

Palimpsest should present the platform around:

- Workspace
- Project
- Node
- Run
- Artifact
- Decision
- Proposal
- Review
- Commit

With user-facing actions:

- Ask
- Propose
- Review
- Run
- Inspect

## Builtin Lenses

The first two builtin lenses we converged on are:

- `research`
- `security-audit`

Both should be treated as equal plugin-owned product surfaces.

## Future Lenses

The architecture should make room for additional lenses, such as:

- `llm-eval`
- `incident`
- `growth-experiment`
- `lit-review`

## Success Criteria

Palimpsest is succeeding when:

- the user does not feel they are inside two different products
- projects can host multiple lenses at once
- proposals, reviews, and commits are central visible product concepts
- exports preserve reasoning history, not just final state
- plugins feel like complete bundles, not scattered code fragments
