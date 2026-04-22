# Domain Model

This document describes the canonical domain layer that builtin plugins and the
host shell build on top of.

## Core Principle

Palimpsest does not treat chat transcripts as the primary durable object.

The primary durable objects are:

- nodes
- edges
- runs
- artifacts
- decisions
- proposals
- reviews
- commits

Sessions are important, but they are **containers and interfaces**, not the
canonical source of project truth.

## Top-level Boundaries

### Workspace

The collaboration boundary.

A workspace owns:

- members
- invites
- projects
- shares
- review queue metadata
- audit history

### Project

A project is the main unit of graph, work, and provenance.

A project owns:

- graph objects
- runs
- artifacts
- decisions
- proposals
- reviews
- commits
- installed lenses
- taxonomy

### Lens installation

Lens installation is project-scoped metadata layered on top of the domain. It
does not replace the base project model.

## Canonical Entities

### Node

A node is the smallest durable reasoning unit.

Depending on lens, a node may mean:

- claim
- finding
- hypothesis
- risk
- source
- control
- assumption

Nodes belong to the **project**, not to a plugin.

### Edge

A typed relationship between nodes.

Examples:

- supports
- refutes
- relates_to
- affects
- mitigates
- evidenced_by

### Run

A run is an executed unit of work.

Examples:

- experiment
- analysis
- validation pass
- workflow execution
- security audit step

Runs should preserve:

- triggering actor
- kind
- status
- manifest
- timing
- linked outputs

### Artifact

A durable output or evidence object.

Examples:

- note
- report
- dataset
- log
- diff
- trace
- evidence bundle

Artifacts are where generated evidence becomes reusable project memory.

### Decision

A durable conclusion or judgment.

Examples:

- advance_claim
- reject_claim
- accept_risk
- mitigate_risk
- false_positive

Decisions are not just labels. They must preserve provenance.

### Proposal

A pending change set before acceptance.

A proposal includes:

- changes
- rationale
- refs
- actor
- status
- revision history

### Review

A response to a proposal.

Current verdict model:

- approve
- reject
- request_changes

### Commit

The accepted and applied change record derived from proposal approval.

Commits are the backbone of the durable change timeline.

## Supporting Models

### Actor

Every meaningful mutation should be attributable to:

- `user`
- `agent`
- `system`

Actors matter on:

- proposals
- reviews
- commits
- runs
- decisions

### Taxonomy

Taxonomy is a project-level runtime rule set.

It constrains allowed:

- node kinds
- edge kinds
- run kinds
- artifact kinds
- decision kinds
- decision states

Taxonomy is not just metadata. It participates in runtime validation, plugin
behavior, and UI labeling.

### Session attachment

Sessions attach to domain objects rather than owning their own parallel object
system.

Current attachment targets are:

- project
- node
- run
- proposal
- decision

This is the key bridge between domain truth and interactive work surfaces.

### Share

Shares are workspace-owned public publishing records.

Current share kinds include:

- session
- node
- run
- proposal
- decision

The long-term center of gravity should be the domain-object share kinds rather
than session-centric sharing.

### Review queue metadata

Review queue state is workspace-level collaboration metadata attached to domain
proposals.

It currently includes:

- assignee
- assigned by
- priority
- due date
- SLA hours

This is not a replacement for review/commit provenance; it is collaborative
queue state layered on top.

## Ownership Rules

### Projects own core entities

Nodes, runs, artifacts, decisions, proposals, reviews, and commits all belong
to a project.

### Plugins add interpretation, workflow, and UI

Plugins may contribute:

- taxonomy defaults
- workflows
- prompts
- skills
- renderers
- workspaces
- actions

But they should not create a second hidden data system when the domain already
has a core entity type.

### Tools are contextual, not canonical

Files, terminal, diff, logs, and review panels are important tools, but they do
not replace the domain model. They should attach to domain work, not become the
data model.
