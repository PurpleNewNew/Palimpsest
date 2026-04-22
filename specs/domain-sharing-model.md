# Domain Object Sharing Model

## Purpose

Palimpsest should make reasoning assets shareable as public, inspectable domain
objects.

Session sharing is useful, but it is not the right long-term sharing model for
the platform.

The platform should primarily share:

- nodes
- runs
- proposals
- decisions
- optionally commits and artifacts

## Problem

Session-centric sharing preserves a conversation shell.

That is often the wrong level of abstraction for Palimpsest because the system's
value is not the existence of a session itself.
The value is in:

- the object
- its provenance
- linked evidence
- review history
- resulting decisions

## Goal

Shift the product's public sharing model from:

- shared session transcripts

to:

- shared domain objects with provenance

## Sharing Targets

The first-class public share targets should be:

- `node`
- `run`
- `proposal`
- `decision`

Optional later targets:

- `commit`
- `artifact`
- `project` overview

## Share Semantics

Sharing should be read-only.

Public share pages should expose:

- object summary
- linked project identity when allowed
- provenance chain
- linked artifacts
- linked runs
- linked proposals / reviews / commits / decisions
- timestamps
- actor history when permitted

## Share Page Expectations

### Node Share

A node share page should show:

- node identity
- node kind and current state
- graph context
- linked artifacts
- linked runs
- linked proposals
- linked decisions

### Run Share

A run share page should show:

- run summary
- status
- manifest or execution metadata
- linked artifacts
- produced nodes
- related proposals and decisions

### Proposal Share

A proposal share page should show:

- rationale
- affected objects
- refs
- review history
- resulting commit if approved
- linked decisions

### Decision Share

A decision share page should show:

- decision kind and verdict
- rationale
- evidence chain
- originating proposal
- resulting commit
- later superseding decisions if present

## Provenance Requirements

All share pages should make provenance visible.

At minimum, domain sharing should include:

- proposal linkage
- review linkage
- commit linkage
- decision linkage
- artifact linkage

Deep links between those objects should be preserved.

## Product Rules

### Rule 1: Sharing is about assets, not chat shells

Do not make session sharing the default mental model for collaboration.

### Rule 2: Shared pages must expose context

A shared object without provenance is not enough.
Shared pages should explain how the object came to be.

### Rule 3: Public pages remain read-only

No write, approve, or mutate actions should be exposed through public share
pages.

### Rule 4: Session sharing may remain as a compatibility or specialist path

Session sharing does not have to be deleted immediately.
It simply should not remain the primary sharing model.

## API Direction

The control plane and share routes should move toward:

- share target kind
- target object ID
- share visibility and revocation
- object-specific hydration

rather than assuming a session-first payload.

## Acceptance Criteria

This spec is considered implemented when:

- domain objects can be shared directly
- public share pages are object-centric rather than session-centric
- provenance is visible on share pages
- session sharing is no longer the only meaningful share path
