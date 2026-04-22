# Permissions v1 Model

This document describes the current first enforceable permission model for
Palimpsest.

## Roles

Current workspace roles are:

- `owner`
- `editor`
- `viewer`

This is intentionally a small first version.

## Behavioral Expectations

### Viewer

May:

- read project state
- read proposals, reviews, commits, and decisions
- open object workspaces

May not:

- create normal domain writes
- approve proposals
- mutate project state

### Editor

May:

- perform normal project writes
- create proposals
- review proposals
- use standard collaboration flows

May not:

- perform owner-only workspace administration

### Owner

May:

- do everything an editor can do
- manage membership and invites
- manage workspace-level administration

## Domain Write Gate

Permissions v1 is not just a settings page concept.

The important implementation rule is:

**domain write paths must be role-gated.**

That includes proposal creation, proposal review, and other project-state writes.

This gate now exists in the server layer and should remain the foundation of the
permission model.

## UI Expectations

The UI should consume permissions as product capabilities such as:

- canWrite
- canReview
- canShare
- canRun

This is preferable to scattering raw role checks across every component.

## Relationship to Object Workspaces

Object workspaces should treat permissions as capability inputs.

Examples:

- a proposal workspace should hide or disable review actions for viewers
- a node workspace should hide publish or mutate actions when write access is
  unavailable
- a decision workspace should expose provenance even when write actions are
  unavailable

## Review Queue

Review queue management should remain an editor-or-owner capability.

That includes:

- assigning proposals
- changing priority
- setting due dates
- setting SLA expectations

## Sharing

Object-level sharing should also respect write/admin permissions.

In practice this means:

- ordinary viewers should not create or revoke public shares
- edit-capable roles should handle publish/unpublish flows

## Remaining Cleanup

The largest remaining permission gap is not the existence of role checks.

It is the remaining product-language confusion between:

- workspace role permissions
- older tool/AI permission prompts

The hard enforcement layer is increasingly correct, but the surrounding naming
still needs cleanup so "permissions" clearly means collaboration and write
authority first.
