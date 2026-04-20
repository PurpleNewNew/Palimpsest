# Plugin System

## Principle

Palimpsest should have **one extension system**:

**plugin**

There should not be separate long-lived systems for:

- extensions
- preset packs
- lens packs
- expert modes

Instead, presets and lenses are capability surfaces within plugins.

## Terminology

### Plugin

Implementation boundary and extension package.

### Preset

A plugin-owned project creation recipe.

### Lens

A plugin-owned project interpretation and UI/behavior layer.

## Product Language vs Implementation Language

Users should mostly see:

- project types
- lenses
- actions

Developers implement:

- plugins
- presets
- lenses
- actions
- server hooks
- web contributions

## Plugin Directory Shape

A plugin should be a real directory boundary, not scattered source files.

Example:

```txt
plugins/
  core/
    plugin.ts
    manifest.ts
    server/
    web/
    assets/
    skills/

  research/
    plugin.ts
    manifest.ts
    server/
      routes/
      tools/
      preset/
      prompts/
    web/
      forms/
      tabs/
      panels/
    assets/
    skills/

  security-audit/
    plugin.ts
    manifest.ts
    server/
      tools/
      workflow/
      rules/
    web/
      tabs/
      panels/
    assets/
    skills/
    ql/
```

## Preset Contract

Presets are chosen only at project creation time.

A preset should be able to define:

- `id`
- `plugin_id`
- `title`
- `description`
- `icon`
- `default_taxonomy_id`
- `default_lens_ids`
- `create schema`
- `create defaults`
- `postCreate init`

Important rule:

**A preset cannot be installed later.**

It defines initial project shape.

## Lens Contract

Lenses can be installed onto a project after creation.

A lens should be able to define:

- identity and plugin ownership
- applicability rules
- workspace tabs
- session tabs
- detail renderers
- action handlers
- default ordering

Applicability should be declared, not executable-only.

Preferred style:

- `applies_to_taxonomies`
- `requires_capabilities`
- `applies_to_presets`

This keeps client-side registry logic possible.

### Lens Ordering

When multiple lenses contribute tabs or actions, ordering should be stable and explicit.

Preferred ordering rule:

- `priority`
- then installation time
- then lexical plugin/lens id

Ordering should not depend on incidental plugin load order.

## Action Contract

Plugins should be able to contribute product-level actions.

User-facing actions:

- Ask
- Propose
- Review
- Run
- Inspect

The currently installed lenses decide what those actions do.

Examples:

- `Propose` inside a research project may route to research-specific proposal helpers
- `Run` inside a security project may route to a security scan

Users should not need to choose internal agent names.

## Web Contribution Contract

Plugins should be able to contribute web UI in a structured way.

Examples:

- preset form fragments
- workspace tabs
- session tabs
- detail panels
- action cards
- specialized renderers

Day 1 expectation:

- the client may still use component-driven contribution registration
- the server validates preset input schemas
- this does not imply fully dynamic JSON-schema-driven form rendering

In other words:

- preset create schema is for validation
- preset form UI is still expected to come from plugin-owned form fragments or components

## Builtin Plugins

The first builtin plugins should be:

- `core`
- `research`
- `security-audit`

These must be treated symmetrically.

Research should not retain a privileged product path.

## Plugin Removal / Missing Plugin Behavior

If a plugin is missing or removed:

- the project should remain readable at the domain-core level
- lens-specific tabs and actions disappear
- plugin metadata remains stored
- unknown lens-specific config is preserved but inactive

This allows graceful degradation instead of data loss.

## Versioning

Project-installed lenses should track:

- `plugin_version`
- `config_version`

This provides a basis for future config migration.

Installed lens config should be treated as plugin-owned versioned data, not an unversioned JSON blob.
