# Collaboration Model

## Chosen Model

Palimpsest uses **asynchronous collaboration**, not real-time CRDT-style collaborative editing.

This decision is intentional and foundational.

## Why Async Collaboration

Palimpsest is optimized for:

- approval
- review
- auditability
- agent participation
- durable project history

That makes GitHub/Linear-style workflows a better fit than Google Docs/Figma-style co-editing.

## Core Write Flow

The primary write path is:

**Proposal -> Review -> Commit**

Not:

**chat -> direct mutation**

## Proposal-First Principle

Ordinary user and agent changes should default to creating proposals.

Approved proposals then produce commits, and commits update accepted state.

System-level actions may bypass proposal in a small number of explicitly controlled cases, but those should remain the exception.

## Actor Model

Every meaningful action should be attributable to an actor.

### Actor Types

- `user`
- `agent`
- `system`

### Agent Versioning

Agent identity must include version information.

Examples:

- `agent:research_project_init@1.2.3`
- `agent:security_scan@0.4.1`

The platform should be able to show which agent version proposed a change.

## Proposal Semantics

A proposal should include:

- project scope
- actor identity
- structured change set
- rationale
- refs / provenance
- status

Proposal statuses:

- `pending`
- `approved`
- `rejected`
- `withdrawn`

## Review Semantics

A review should include:

- proposal reference
- reviewer actor
- verdict
- comments

Review verdicts:

- `approve`
- `reject`
- `request_changes`

## Commit Semantics

A commit should represent:

- the accepted change
- who committed it
- when it was committed
- the applied change set
- merged refs / provenance

Commits are the primary audit timeline unit.

## Approval Guarantees

Approving a proposal should obey these rules:

- change application is atomic
- taxonomy validation is enforced
- proposal refs are preserved
- resulting domain entities remain attributable
- direct public commit endpoints should not bypass review

## Permissions v1

The initial permission model is intentionally simple:

- `owner`
- `editor`
- `viewer`

Minimum permission boundaries:

- who can propose
- who can review
- who can manage members

Viewers should not be able to approve changes.

## Replay Expectations

Replay should be treated as a layered capability.

### L1: State Replay

Reconstruct graph state at a prior commit boundary.

### L2: Conversation Replay

Replay the related chat / tool interaction history.

### L3: Intent Replay

Re-run an action with the same high-level inputs and compare outcomes.

### L4: Environment Replay

Best-effort rerun of the same environment and dependencies.

### L5: Time-Travel Editing

Not a v1 promise.

Practical v1 commitment:

- platform should aim to guarantee L1, L2, and L3
- L4 is adapter-dependent best effort
- L5 is out of scope

## Collaboration Anti-Goals

Palimpsest should not attempt, in v1:

- CRDT-based rich-text co-editing
- field-level merge resolution for arbitrary node bodies
- invisible live edits that bypass review
