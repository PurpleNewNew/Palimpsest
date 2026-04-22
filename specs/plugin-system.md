# Plugin System

Palimpsest has one extension system:

**plugin**

Everything else should be understood as capability surfaces inside plugins.

## Terms

### Plugin

The implementation boundary and packaging unit.

### Preset

A plugin-owned project creation recipe.

### Lens

A plugin-owned interpretation and UI/behavior layer installed onto a project.

## Core Rule

There should not be separate long-lived extension systems for:

- extension packs
- preset packs
- lens packs
- expert modes

If the product needs those capabilities, they should live inside the plugin
system.

## Current Package Shape

Builtin plugins are expected to be real workspace units under `plugins/`.

Current important bundles:

- `plugins/core`
- `plugins/research`
- `plugins/security-audit`

Each plugin should own, as appropriate:

- `plugin.ts`
- `manifest`
- `server`
- `web`
- `prompts`
- `skills`
- `workflows`
- `rules/resources`

## Presets

Presets are chosen at project creation time only.

A preset should define:

- id
- owning plugin
- title/description/icon
- default taxonomy
- default lenses
- creation fields/defaults
- post-create initialization

Important rule:

**A preset is not a thing users install later.** It describes the initial shape
of a project.

## Lenses

Lenses are additive layers on top of the core project shell.

A lens may contribute:

- workspace tabs
- session tabs
- actions
- renderers
- workflow entry points
- labels and descriptions

But it should not replace the existence of the core shell.

### Applicability

Lens applicability should stay declarative:

- preset-based
- taxonomy-based
- capability-based

This is important both for registry behavior and for future dynamic loading.

### Ordering

Tab/action ordering should remain stable and explicit:

- `priority`
- then installation order
- then lexical fallback

## Web Ownership

Builtin plugins should increasingly own their own pages and object workspaces.

Current direction:

- `security-audit` already owns real plugin web pages
- `research` is moving in the same direction
- host app should eventually only assemble routes and shared shell primitives,
  not own plugin business pages

### Current stance on dynamic web registration

Today the repo is using a practical compile-time ownership model:

- pages live in plugin packages
- host lazily imports them through stable package exports

This is enough to make ownership real without yet requiring a full dynamic SDK
for Solid component registration.

A future dynamic registration model is still valid, but it belongs to a later
plugin hot-reload phase rather than the current maturity phase.

## Server Ownership

The host should keep:

- registry
- dispatch
- route mounting surfaces
- integration contracts

Plugins should increasingly own:

- plugin business routes
- plugin workflows
- plugin prompts/skills/resources
- plugin-specific logic

The goal is to avoid "host feature plus plugin wrapper" designs.

## Product Language vs Implementation Language

Users should mostly see:

- project types
- lenses
- object workspaces
- actions

Developers should implement:

- plugins
- presets
- lenses
- actions
- server hooks
- web exports

## Current Remaining Gaps

The plugin system is far more mature than it was during rebuild, but it is not
perfectly symmetric yet.

Main remaining gaps:

- research web ownership still trails security in some places
- some host bridging remains for builtin plugin pages and helpers
- a future dynamic plugin web contract has not been built yet

Those are maturity gaps, not direction gaps.
