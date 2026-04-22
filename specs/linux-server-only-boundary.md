# Linux Server Only Product Boundary

## Purpose

Palimpsest is a web product backed by a Linux server runtime.

Users may access it from many client operating systems through the browser, but
the supported runtime target for the product is:

- Linux server

This spec clarifies the product boundary so the codebase does not keep drifting
back toward desktop or local multi-platform runtime assumptions.

## Core Product Statement

Palimpsest should be:

- Web-only
- Linux server first

Palimpsest should not be:

- a desktop product
- a TUI product
- a Windows/macOS local runtime product
- a WSL-specialized product surface

## Important Distinction

This boundary does **not** mean:

- users on Windows cannot open the web UI
- users on macOS cannot access a hosted instance

It means:

- the Palimpsest runtime we support and optimize is a Linux server
- the product shell should not carry desktop-runtime assumptions

## What Must Be Removed

The following categories should not remain in the active product surface.

### Desktop Runtime Concepts

- desktop-specific platform branches
- desktop-first shell logic
- desktop-only storage assumptions
- desktop product naming in the UI

### WSL-Specific Product Guidance

- WSL settings panels
- WSL-specific onboarding as a core product path
- WSL language in primary user-facing settings

### Local Multi-Platform Runtime Branding

- "Palimpsest Desktop"
- OS-specific local runtime positioning
- product copy implying first-class Windows/macOS runtime support

## What May Remain

The following may still exist where justified:

- browser compatibility across operating systems
- code paths that detect browser environment constraints
- provider compatibility with external systems
- tests or utilities that mention foreign OS path behavior when narrowly scoped

These should not become product framing.

## UI Implications

The UI should read like:

- browser client
- project workspace
- collaboration platform

It should not read like:

- desktop shell
- local app wrapper
- platform-switching environment

## Runtime Implications

The server build, deployment assumptions, and documentation should target Linux.

That includes:

- service startup assumptions
- filesystem assumptions
- deployment docs
- package metadata
- CLI help text

## Cleanup Rules

### Rule 1: Remove product-facing desktop language

If a label, setting, or onboarding string treats desktop as a first-class
product mode, it should be removed or rewritten.

### Rule 2: Remove desktop-only shell branches where possible

If layout or persistence logic exists only to preserve an old desktop shell
shape, it should be deleted.

### Rule 3: Keep browser-side adaptability, not desktop identity

Responsive UI and browser capability detection are fine.
Desktop product identity is not.

## Acceptance Criteria

This spec is considered implemented when:

- the active product UI no longer presents a desktop product identity
- WSL and desktop settings are not part of the normal product surface
- Linux server is the only supported runtime target expressed by the product
- browser access remains cross-platform without implying cross-platform runtime support
