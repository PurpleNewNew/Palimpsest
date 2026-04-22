# Workbench and Tooling Model

## Purpose

Palimpsest should keep powerful work tools such as terminal, files, diff, logs,
and review detail views.

The goal is **not** to remove those tools.

The goal is to place them at the correct layer in the product:

- the **product skeleton** is domain-first
- the **tooling layer** is contextual and task-oriented

This matters because Palimpsest is not an IDE shell with extra metadata.
It is a reasoning-asset platform where graph objects, runs, evidence,
proposals, reviews, and decisions are the primary surface.

## Core Principle

`terminal`, `files`, and `review` must remain highly accessible, but they must
not define the top-level product worldview.

In practical terms:

- keep them easy to summon
- keep them deeply integrated into workflows
- stop letting them determine the default session shell

## Product Layers

Palimpsest should be understood in three layers.

### 1. Domain Workbench

This is the main stage.

The default project shell should foreground:

- Nodes
- Runs
- Artifacts
- Decisions
- Reviews
- Monitors
- Sources

This layer answers:

- What are we reasoning about?
- What has been proposed?
- What evidence exists?
- What decisions were made?
- What work is currently pending?

### 2. Domain Object Workspace

Users do not only work at project level.
They also work around a focused domain object or task.

A session or work area may center on:

- a project
- a node
- a run
- a proposal
- a decision

From there, the user should see:

- graph context
- linked artifacts
- linked runs
- linked proposals
- linked decisions
- open work items

This is the correct place to open supporting tools.

### 3. Tooling Layer

The tooling layer includes:

- Terminal
- Files
- Diff
- Logs
- Search
- Review detail

These are critical tools, but they are not the product skeleton.

They should be available:

- as drawers
- as sheets
- as detachable utility panels
- as task-scoped side panels
- through global shortcuts

They should not be the user's first and strongest mental model of the product.

## Terminal

Terminal is a first-class tool and should remain easy to access.

### Terminal Principles

- Terminal should be globally summonable.
- Terminal may be pinned to the current project.
- Terminal may be attached to a node, run, proposal, or decision.
- Terminal output should be capturable as artifacts.
- Workflows may open terminal pre-scoped to the current task.

### Terminal Anti-Goals

- Terminal should not define the entire session shell.
- Terminal should not be the first product concept a new user sees.
- Terminal should not make the web app feel like "a browser IDE with some graph features."

### Correct Product Position

Terminal is a **strong tool** with **weak structural privilege**.

That means:

- high accessibility
- low control over the top-level layout

## Files

File access remains necessary, especially for code-heavy projects and plugin workflows.

### File Principles

- Files should be available from any relevant domain object.
- The default file experience should be task-scoped.
- Full repository browsing should still exist, but should not dominate the shell.

### Default File Model

The primary file surface should be a **working set**, not a global tree.

Examples:

- files related to the current node
- files touched by a proposal
- files produced by a run
- files referenced by an artifact
- files relevant to a security finding or research claim

### Secondary File Model

Users can still open a full repository browser when needed.

This remains useful for:

- broad navigation
- manual exploration
- recovery when context inference is incomplete

But it should be an explicit move into repository browsing, not the default
landing experience.

## Review

Review must stay central to Palimpsest, but as a domain workflow rather than a
generic paneling habit.

### Review Principles

Review should primarily mean:

- proposal review
- commit review
- decision review

That means review is not just "a side panel with comments."
It is a structured object workflow.

### Review Surfaces

A review workspace should show:

- rationale
- affected objects
- refs and provenance
- linked artifacts
- linked runs
- resulting commits
- resulting decisions
- approve / reject / request changes

### Review Anti-Goals

- Review should not be treated as a generic shell tab that is always equal to files and context.
- Review should not be the default center of every session regardless of attachment type.
- Review layout should follow the domain object under review, not legacy UI habits.

## Sessions and Tooling

Sessions should remain generic domain attachments.

Sessions attach to:

- project
- node
- run
- proposal
- decision

The attachment determines the domain context.
Lenses determine how that context is interpreted.
Tools are then opened in service of that context.

This avoids:

- file session as a hardcoded skeleton
- review session as a hardcoded skeleton
- terminal session as a hardcoded skeleton
- research object types defining the entire layout

## Research and Security

Research and security should both use the same workbench model.

### Shared Structure

Both should provide:

- graph objects
- contextual sessions
- workflows
- artifacts
- proposals
- reviews
- decisions

Both should allow the user to:

- inspect a domain object
- open related files
- summon terminal
- review changes
- inspect provenance

### Different Semantics

Research may center on:

- claims
- evidence
- experiments
- assessments

Security may center on:

- findings
- risks
- controls
- assumptions
- validation runs

The user experience may feel similar, but the semantics remain lens-specific.

## Product Rules

The following rules should guide future shell changes.

### Rule 1: Do not use tools as the primary project landing frame

Projects should open into a workbench, not a repository browser or terminal shell.

### Rule 2: Do not let tool panels determine session class

Session layout should be attachment-driven and lens-interpreted, not file-driven
or terminal-driven.

### Rule 3: Keep terminal globally fast

Terminal should remain one of the easiest tools to reach.
Removing friction is good.
Making it the worldview is not.

### Rule 4: Prefer working sets over global trees

Task-scoped file context should be the primary path.
Full repository browsing remains secondary but available.

### Rule 5: Review follows domain objects

The review surface should adapt to the object being reviewed instead of acting
as a generic side panel.

## UI Implications

The shell should move toward the following behavior:

- the project shell foregrounds canonical core tabs
- lens tabs are additive
- the side panel defaults to attachment-aware object context
- files appear first as a contextual working set
- terminal is globally summonable
- review is object-centric and provenance-centric

## Implementation Implications

This spec does not require removing:

- terminal execution
- repository browsing
- diff views
- review detail UI

It does require lowering their structural privilege.

Practical signs of progress include:

- fewer shell-wide assumptions about `files`, `reviews`, or `terminal`
- more routing and rendering based on session attachments
- more contextual "open related files" behavior
- more artifact capture from terminal and workflow output
- more proposal/decision-centric review workspaces

## Acceptance Criteria

This model is considered implemented when:

- opening a project reads first as a Palimpsest workbench, not a coding shell
- terminal remains easy to summon from anywhere
- file access remains strong but defaults to contextual working sets
- review is primarily experienced as proposal/commit/decision workflow
- session layout is driven by domain attachments rather than legacy tool panel classes
