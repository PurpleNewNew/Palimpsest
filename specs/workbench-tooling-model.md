# Workbench Tooling Model

This document defines the role of files, terminal, diff, logs, and review in
the current Palimpsest product.

## Core Principle

These capabilities are **important**, but they are not the product skeleton.

They should behave as:

- strong tools
- highly reachable tools
- context-aware tools

not as the thing that determines what Palimpsest fundamentally is.

## Main Distinction

### Product skeleton

The product skeleton is:

- workbench tabs
- object workspaces
- graph objects
- runs
- artifacts
- decisions
- proposals
- commits

### Tooling layer

The tooling layer is:

- files
- terminal
- diff
- logs
- provenance side rail
- contextual review details

The tooling layer supports object work. It should not replace object work.

## Terminal

Terminal should remain powerful and easy to reach.

That means:

- easy to open
- callable from many contexts
- usable while working on nodes, runs, proposals, and decisions
- usable for validation and execution tasks

But terminal should not determine the whole product identity.

The right stance is:

- **strong capability**
- **weak structural privilege**

## Files

Files should remain available, but default file interaction should be more
contextual than "entire repository tree as the main world model."

Preferred default:

- working set around the current object
- linked files
- related diffs
- relevant excerpts

Full repository browsing is still useful, but it should not dominate the whole
shell.

## Review

Review is not a generic side panel anymore.

It should now be understood as object work around:

- proposals
- commits
- decisions

Proposal detail should live in a full review workspace, not primarily in a
floating panel.

## Right Rail

The right rail is the correct place for:

- linked objects
- provenance
- refs
- related artifacts
- related runs
- decision chain

This is where Palimpsest should feel "assetized" rather than chat-like.

## Object-first Flow

The recommended interaction order is:

1. open a workbench tab
2. open an object workspace
3. inspect linked context
4. invoke files/terminal/diff/review/logs as tools within that context

This is the opposite of the old IDE-shell-first flow.

## Remaining Cleanup Goal

The remaining cleanup is not to delete tooling.

It is to make sure:

- files no longer feel like the main product
- review no longer feels like a generic session sidebar
- terminal remains powerful without becoming the platform identity
- session pages stop preserving more shell privilege than object workspaces do
