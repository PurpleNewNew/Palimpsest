# Domain Model

This document defines the canonical platform data model independent of any single lens.

## Core Entities

### Workspace

A workspace is the top-level collaboration boundary.

It owns:

- users
- members
- projects
- invites
- shares
- audit context

### Project

A project is a body of work inside a workspace.

A project owns:

- nodes
- edges
- runs
- artifacts
- decisions
- proposals
- reviews
- commits
- installed lenses

### Node

A node is the smallest durable reasoning unit in the graph.

Depending on the lens, a node may represent:

- a claim
- a finding
- a hypothesis
- a risk
- a method
- a verification point

Nodes belong to the project, not to a lens.

### Edge

An edge expresses a typed relationship between nodes.

Examples:

- motivates
- derives
- validates
- contradicts
- related_to

### Run

A run is any executed unit of work:

- experiment
- scan
- benchmark
- evaluation
- reproduction

Runs should carry:

- kind
- status
- manifest
- triggering actor
- output artifacts
- linked nodes
- linked decisions

### Artifact

An artifact is a durable output or evidence object.

Examples:

- file
- log
- metric
- diff
- dataset slice
- report
- SARIF
- trace

Artifacts should preserve provenance and replay metadata.

### Decision

A decision is a durable conclusion or judgment.

Examples:

- accept_claim
- reject_claim
- accepted_risk
- false_positive
- superseded

Decisions should be revisable and traceable.

### Proposal

A proposal is a pending set of changes before acceptance.

It should include:

- proposed changes
- rationale
- refs / provenance
- actor identity
- status

### Review

A review is a response to a proposal:

- approve
- reject
- request_changes

### Commit

A commit is the accepted and applied change record derived from a proposal or system action.

Commits should be the core audit timeline unit.

## Supporting Models

### Actor

All meaningful changes should be attributable to an actor:

- user
- agent
- system

Actor identity must be visible on:

- proposals
- reviews
- commits
- runs
- decisions

### Taxonomy

Taxonomy is a project-level runtime rule set.

It defines allowed:

- node kinds
- edge kinds
- run kinds
- artifact kinds
- decision kinds / states

Taxonomy is not only metadata. It should drive runtime validation and UI behavior.

## Entity Ownership Rules

### Nodes and Runs Belong to Projects

Lenses may interpret them, annotate them, or extend them, but the base entities remain project-owned.

### Lenses Add Meaning, Not Ownership

Lenses should attach:

- metadata
- rendering
- actions
- workflows

They should not split the graph into parallel data systems.

## Suggested Shape

At a minimum, the intended model includes:

```ts
type Workspace = {
  id: string
  name: string
}

type Project = {
  id: string
  workspace_id: string
  name: string
  taxonomy_id: string
}

type Node = {
  id: string
  project_id: string
  kind: string
  title: string
  body?: string
  data?: unknown
}

type Edge = {
  id: string
  project_id: string
  kind: string
  source_id: string
  target_id: string
}

type Run = {
  id: string
  project_id: string
  kind: string
  status: string
  triggered_by_actor_id?: string
  manifest?: unknown
}

type Artifact = {
  id: string
  project_id: string
  kind: string
  storage_uri?: string
  mime_type?: string
  produced_by_run_id?: string
  provenance?: unknown
}

type Decision = {
  id: string
  project_id: string
  kind: string
  decided_by_actor_id?: string
  rationale?: string
  superseded_by?: string
}

type Proposal = {
  id: string
  project_id: string
  proposed_by_actor_id: string
  changes: unknown[]
  rationale?: string
  refs?: unknown
  status: "pending" | "approved" | "rejected" | "withdrawn"
}

type Review = {
  id: string
  proposal_id: string
  reviewer_actor_id: string
  verdict: "approve" | "reject" | "request_changes"
  comments?: string
}

type Commit = {
  id: string
  project_id: string
  from_proposal_id?: string
  committed_by_actor_id: string
  applied_changes: unknown[]
  refs?: unknown
}
```

## Provenance Expectations

The system should eventually allow the user to see:

- which proposal introduced a change
- which review approved it
- which commit applied it
- which artifacts were produced afterward
- which decision used those artifacts
