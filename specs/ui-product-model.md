# UI Product Model

> **DEPRECATED — will be rewritten as `specs/ui.md`.** This file is no longer authoritative; read `specs/README.md` for the restructure plan and do not add new content here.

This document describes how the current Palimpsest product should read to end
users.

## Product Goal

The UI should read as one coherent Palimpsest workbench, not as:

- a research-only app
- a coding shell with extra tabs
- a collection of plugin demos

## Project Creation

Project creation should stay unified:

1. choose a preset
2. fill preset-specific inputs
3. create the core project
4. run preset initialization
5. install default lenses

Research and security should both appear here as presets, not as special
hardcoded products.

## Canonical Core Tabs

The primary workbench should still center on:

- Nodes
- Runs
- Artifacts
- Decisions
- Reviews
- Monitors
- Sources

These are the stable product skeleton.

Lens tabs are additive.

## Object Workspaces

One of the biggest changes in the current product is the move toward explicit
object workspaces.

Important object workspaces now include:

- proposal workspace
- decision workspace
- node workspace
- run workspace

This is the correct direction because it lets the product pivot around durable
objects instead of around generic session side panels.

## Reviews

Reviews should behave in two levels:

1. a project-level inbox / queue
2. a full proposal review workspace

The inbox is where users find work.
The proposal workspace is where they actually perform review.

That means review should not collapse back into a generic session sidebar.

The review queue now also carries operational metadata such as:

- assignee
- priority
- due date
- SLA window

## Decisions

Decisions are a first-class product surface.

A decision workspace should expose:

- rationale
- linked node/run/artifact context
- provenance chain
- related proposal/review/commit history
- supersession history

## Sessions

Sessions are still useful, but their job is narrower now.

They are generic containers that may attach to:

- project
- node
- run
- proposal
- decision

This means the product should avoid letting sessions define the entire UI model.

The object workspace should increasingly be the durable, canonical surface.

Mobile session fallbacks should default to workbench and overview rather than to
review/file-specific alternates.

## Product Actions

Top-level user actions should stay stable:

- Ask
- Propose
- Review
- Run
- Inspect

Internal implementation details such as agent names or workflow IDs should not
dominate the top-level product language.

## Tooling Surfaces

Files, terminal, diff, logs, and context inspection remain important, but they
must behave like contextual tools rather than shell-defining primitives.

The right mental model is:

- first open the object or workbench you care about
- then invoke files/terminal/review/logs in that context

## Sharing and Provenance

The UI should increasingly present:

- object-centric share actions
- provenance deep links
- commit timeline visibility
- decision provenance visibility

This is central to the "reasoning into assets" promise.

## Remaining UX Gaps

The biggest remaining UI inconsistencies are:

- some session pages still retain coding-shell structure
- some legacy session tools still carry old shell language
- research web ownership is improving but still trails security in deeper
  workspaces
- session archive sharing still exists as a compatibility surface beside the
  newer object-centric public pages

Those are the next polish layer, not evidence that the UI direction is wrong.
