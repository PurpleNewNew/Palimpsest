# Permissions V1 Model

## Purpose

Palimpsest needs a simple, enforceable first version of permissions that matches
its collaboration model.

The goal is not a complete enterprise matrix.
The goal is to make proposal-first collaboration trustworthy.

## Roles

Permissions v1 uses three roles:

- `owner`
- `editor`
- `viewer`

Roles are granted at workspace membership level.

Project-scoped refinements may come later, but are not required for v1.

## Core Principle

Permissions v1 must enforce role-based gates on domain and session writes.

It is not enough to gate:

- workspace settings
- invites
- member management

The same role model must reach:

- proposal creation
- review approval / rejection
- project mutation
- share management
- export/import operations
- session-attached domain mutations

## Role Capabilities

### Owner

Owners may:

- manage workspace membership
- manage invites
- change workspace settings
- create proposals
- approve / reject / request changes
- mutate domain objects through approved flows
- export/import project data
- manage public shares

### Editor

Editors may:

- create proposals
- approve / reject / request changes
- mutate domain objects through approved flows
- run workflows
- manage normal project work

Editors do not automatically manage workspace membership or global settings.

### Viewer

Viewers may:

- inspect projects
- inspect proposals, commits, decisions, and artifacts
- open shareable/read-only work areas when permitted

Viewers may not:

- create proposals
- approve or reject reviews
- mutate domain objects
- manage shares
- import/export project data

## Required Write Gates

Permissions v1 must gate at least these classes of actions.

### Proposal Creation

Creating or updating a proposal requires:

- `owner` or `editor`

### Review Actions

Approve / reject / request changes requires:

- `owner` or `editor`

### Domain Writes

Any route or tool that changes:

- node
- edge
- run
- artifact
- decision
- proposal
- review
- commit

must require the correct write role.

The system should not rely on "has project context" as a proxy for permission.

### Session-Attached Mutations

Sessions may attach to domain objects, but session presence must not imply write
authority.

Any write routed through a session must still check:

- workspace membership
- role
- project scope

### Share Management

Creating, revoking, or editing public shares requires:

- `owner` or `editor`

### Export / Import

Export and import should be gated.

At minimum:

- export: `owner` or `editor`
- import: `owner`

## Product Implications

Permissions should be visible in the UI.

Examples:

- disabled create buttons for viewers
- disabled approve/reject controls for viewers
- read-only review inbox state where appropriate
- clear "insufficient permission" messaging

## Server-Side Rule

All meaningful write protection must be server-enforced.

UI hiding alone is not sufficient.

## Anti-Goals

Permissions v1 should avoid:

- project-level ACL explosion
- per-object custom grants
- complicated inheritance trees
- plugin-specific ad hoc permission systems

Plugins must use the host role model instead of inventing parallel access logic.

## Acceptance Criteria

This spec is considered implemented when:

- workspace control-plane operations are role-gated
- proposal/review/domain/session mutation routes are role-gated
- viewers cannot mutate state through domain or session paths
- plugins rely on the same role gates as the host
