# Builtin Plugin Web Ownership

This document describes what it means for builtin plugins to genuinely own their
web surfaces.

## Goal

Builtin plugins should not stop at:

- metadata
- tab labels
- host-owned pages with plugin badges

They should increasingly own:

- plugin pages
- plugin object workspaces
- plugin-specific panels
- plugin-specific action flows

while the host retains:

- route assembly
- shared shell primitives
- shared providers
- common object workspace scaffolding

## Current State

### `security-audit`

`security-audit` is already much closer to true web ownership:

- plugin package exports page entrypoints
- host lazily imports those pages from the plugin package
- plugin-owned product semantics are visible in the web layer

### `research`

`research` has started moving in the same direction, but it still trails
security in completeness.

The repo now has plugin-owned research pages, but some research-oriented host
surfaces and older session/product assumptions still exist.

## Ownership Model

### Host should own

- route shells
- top-level app composition
- generic object workspace layout
- generic side rail primitives
- generic publish/provenance/timeline components

### Plugin should own

- domain-specific pages
- domain-specific workspaces
- domain-specific labels and summaries
- domain-specific actions and empty states
- domain-specific context fetch helpers

## Current Preferred Implementation Strategy

The current practical model is:

- compile-time plugin web ownership
- stable package exports
- host lazy-importing plugin pages through package boundaries

This is sufficient to make ownership real without yet introducing a full
dynamic component registration system into the plugin SDK.

## Future Dynamic Web Registration

A more dynamic plugin web registration system is still desirable in the future,
especially once plugin hot reload becomes important.

But that should be a later step.

The current rule is:

- make ownership real now
- keep exports stable
- do not force a large SDK redesign into every plugin migration

## Remaining Work

To reach full builtin plugin web ownership:

1. keep moving research-specific pages and workspaces into `plugins/research`
2. continue shrinking host-owned research/security UI bodies
3. ensure object workspaces remain reusable shared shells rather than plugin
   duplicates
4. keep host/package boundaries strict so ownership is enforceable by imports

## Success Condition

Builtin plugin web ownership is complete when:

- the host app no longer contains large business pages for research/security
- builtin plugins export their own pages and workspaces
- the host only assembles routes and shared shell primitives
- research and security feel like equal bundles rather than one special system
  and one plugin
