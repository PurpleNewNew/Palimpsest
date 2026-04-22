# Builtin Plugin Web Ownership

## Purpose

Palimpsest already treats builtin plugins as first-class workspace units on the
server side.

The remaining gap is on the web side:

- plugin manifests exist
- plugin presets and lenses exist
- plugin routes increasingly exist
- but large parts of lens-specific UI still live in the host app

This spec defines the target end-state for builtin plugin web ownership.

## Problem

The current shape is still partly:

- host app pages own the real UI
- plugin `web/index.ts` exports metadata
- the host decides too much of the lens-specific rendering story

This is directionally better than the old research-first shell, but it still
leaves builtin plugins behaving like:

**host features with plugin wrappers**

rather than:

**true bundles that own their own web contribution**

## Goals

Builtin plugins should own their own web contributions.

This means:

- plugin-specific pages
- plugin-specific tabs
- plugin-specific detail renderers
- plugin-specific action entrypoints
- plugin-specific create/import forms

should be implemented inside the plugin directory whenever they are not part of
the shared host shell.

## Non-Goals

This spec does not require:

- fully dynamic remote microfrontends
- a marketplace plugin loader
- runtime-downloaded UI bundles

Builtin plugins may remain compile-time workspace packages.

## Ownership Boundary

### Host Owns

The host app should own:

- the core workspace shell
- routing infrastructure
- product shell registry
- session attachment primitives
- shared review/workbench primitives
- generic domain pages
- shared UI components and layout systems

### Plugin Owns

A builtin plugin should own:

- lens-specific workspace tabs
- lens-specific session tabs
- lens-specific overview pages
- lens-specific detail panels
- lens-specific create/import forms
- lens-specific action cards and flows
- lens-specific visual vocabulary and labels

## Web Contribution Contract

Builtin plugins should provide stable web entrypoints through their package.

At minimum:

- `web/index.ts`

The web entrypoint may expose:

- workspace tab contributions
- session tab contributions
- page registrations
- detail renderers
- action renderers
- preset form fragments

The host should consume these through the plugin SDK, not by reaching into
plugin source internals ad hoc.

## Research and Security

Research and security should be equally structured.

That does **not** mean they must have identical amounts of code.
It means they should have the same ownership model.

### Correct Shape

Both plugins should be able to own:

- plugin-specific landing pages
- plugin-specific object views
- plugin-specific workflow forms
- plugin-specific action UI
- plugin-specific session interpretation

### Anti-Goal

Avoid this split:

- `research` owns real web UI in the plugin
- `security-audit` is only host pages plus metadata

If one builtin plugin uses the new ownership model, the other builtin plugins
should follow the same structure.

## Migration Rules

### Rule 1: Move implementation, not just metadata

Do not stop at:

- labels
- tab declarations
- route names

The actual UI logic must move when it is lens-specific.

### Rule 2: Keep shared primitives in the host

Do not duplicate:

- generic list pages
- common layout primitives
- shared review widgets
- shared provenance views

If a component is domain-generic, keep it in shared host packages.

### Rule 3: Move lens-specific composition into plugins

If a page is fundamentally about a lens-specific concept, it belongs in the
plugin.

Examples:

- research atom workbench
- security findings workbench
- security risk decision workspace
- research experiment planning surface

## Practical Mapping

### Host-level pages that should become plugin-owned where possible

Examples of likely plugin-owned surfaces:

- security overview
- findings list
- research-specific graph overlays
- research-specific creation forms
- security-specific validation or decision panels

### Shared host pages that should remain host-owned

Examples:

- generic nodes list
- generic runs list
- generic artifacts list
- generic decisions list
- generic reviews inbox
- generic commit timeline

## Routing Model

The host should provide stable route registration primitives.

Plugins should register:

- lens-specific pages
- lens-specific routes
- lens-specific attachment renderers

The host should not hardcode plugin page ownership in its own page tree when
the page is fundamentally plugin-specific.

## Acceptance Criteria

This spec is considered implemented when:

- builtin plugins own their real web contribution logic, not only metadata
- host app pages no longer carry large plugin-specific workbench implementations
- `research` and `security-audit` are equally structured in ownership model
- the host keeps only shared shell, shared domain UI, and integration contracts
