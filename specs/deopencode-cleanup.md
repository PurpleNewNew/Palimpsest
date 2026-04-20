# De-OpenCode and Cleanup Plan

This document captures a major part of the earlier refactor direction that must not be lost:

**Palimpsest should not be rebuilt as “OpenCode + research patches.”**

Before or alongside feature rebuilding, we intended to remove the remaining OpenCode-era product assumptions, package structure, and dead product lines.

## Why This Matters

If we only rebuild the new architecture while leaving the old repo shape intact, we will drift back into:

- research-first product assumptions
- OpenCode naming and package debt
- dead platform lines that add maintenance cost
- duplicate extension systems
- old interaction models leaking into the product

The cleanup is not cosmetic. It is part of the architecture.

## Guiding Principle

We are not trying to stay “compatible with OpenCode.”

We are trying to:

- keep the code we still need
- internalize it
- rename it
- delete product lines we do not want
- rebuild Palimpsest as its own platform

## Runtime and Product Scope

The intended runtime scope is:

- Web-only
- Linux server first
- browser as the only client surface
- multi-user workspace collaboration

This means the repo should stop carrying the weight of:

- desktop app packaging
- TUI as a first-class product
- Windows/macOS-native product paths
- SaaS/cloud control planes that are not part of the current self-hosted platform

## What Should Be Kept

These categories were still considered strategically useful:

- the core server runtime
- the web app
- the plugin SDK
- the shared SDK
- shared UI and util packages
- PTY / Terminal support
  because it still fits run/debug/repro workflows

These categories were considered “keep but reevaluate later”:

- MCP
- LSP / formatter

PTY/Terminal was explicitly treated as useful enough to keep.

## What Should Be Removed

The following categories were previously identified as cleanup targets.

### Obvious Repo Clutter

- `.zed`
- `.signpath`
- storybook debug logs
- fake scripts and junk fields in `package.json`
- leftover release/CI paths tied to removed product lines

### OpenCode-era Product Lines

These were identified as not belonging in the Palimpsest product repo:

- `packages/desktop`
- `packages/desktop-electron`
- `packages/enterprise`
- `packages/web` as a separate public site/docs product line
- `packages/function`
- `packages/console/*`
- related `infra/*` for those removed products

### IDE / Extension Product Lines

These were also identified as removable:

- Zed extension
- VS Code extension
- related publish/sync scripts

Reason:

Palimpsest is not supposed to be an IDE-extension-first product.

### Sidecar Integrations Outside the Core Product

These were considered removable or at least not part of the primary repo path:

- Slack sidecar integration

## What Should Be Renamed

The rename work was not just branding. It was intended to remove old product assumptions from the runtime surface.

### Product Identity

- `OpenResearch` -> `Palimpsest`
- `OpenCode` references removed from user-visible runtime

### Package and Namespace Direction

The intended direction was:

- `packages/opencode` -> `packages/server`
- app and runtime package names under `@palimpsest/*`

### Runtime Surface

The intended runtime surface should become:

- `PALIMPSEST_*` environment variables
- `x-palimpsest-workspace` header
- `palimpsest_session` cookie
- `.palimpsest/` project metadata directory

Not:

- `OPENCODE_*`
- `OPENRESEARCH_*`
- `.openresearch*`

### Stable API Direction

The desired stable API style was resource-oriented:

- `/api/auth/*`
- `/api/workspaces/*`
- `/api/projects/*`
- `/api/nodes/*`
- `/api/runs/*`
- `/api/artifacts/*`
- `/api/decisions/*`
- `/api/reviews/*`
- `/api/shares/*`
- `/api/plugins/*`

And importantly:

- no long-lived OpenResearch compatibility prefix
- no leaking domain-internal naming where a stable resource name is better

## What Should Be Simplified

### One Plugin System

We explicitly decided:

- do not preserve a split between extension and plugin systems
- do not preserve a second mechanism just because it came from OpenCode

Everything should converge into one plugin system.

### Action Language

We also explicitly wanted to remove old top-level user-facing modes such as:

- build
- plan
- experiment
- research_project_init as a first-class user mode

The product should instead expose:

- Ask
- Propose
- Review
- Run
- Inspect

### Session Model

OpenCode-style or research-specialized session classes should not remain the shell-level product model.

The desired direction is:

- session as a generic container
- domain attachments determine what the session is about
- lenses interpret attached objects

## Cleanup Risks We Already Identified

### Risk 1: Rebuilding on Top of the Old World

The biggest risk is accidentally restoring:

- research-first project creation
- hardcoded research tabs
- OpenCode-style mode switching
- dual plugin/extension mechanisms

That would recreate the same architectural debt we had already decided to remove.

### Risk 2: Keeping Dead Product Lines “Just in Case”

Keeping unused packages increases:

- install time
- typecheck noise
- contributor confusion
- rebuild effort

The earlier direction was to delete aggressively rather than keep dormant lines around.

### Risk 3: Confusing Internal Reuse With External Dependency

We wanted to keep useful code, but **internalize it under Palimpsest**, not preserve OpenCode as an external conceptual base.

That means:

- keep code we still want
- rename it
- own it
- stop narrating the system as “built on OpenCode”

## Rebuild Order for Cleanup

The intended cleanup order was roughly:

### Phase A: Remove obvious clutter

- editor/project-local files
- logs
- fake scripts
- dead CI/release fragments

### Phase B: Remove dead product lines

- desktop
- SaaS console / enterprise
- docs/site product lines that are not core
- cloud functions not in the current product

### Phase C: Remove IDE extension lines

- Zed
- VS Code
- related scripts

### Phase D: Collapse runtime naming

- environment variables
- cookies
- headers
- metadata paths
- package names
- runtime labels

### Phase E: Remove old interaction-model debt

- TUI-first path
- top-level build/plan/experiment language
- session special cases

### Phase F: Rebuild on top of the cleaned spine

Only after the cleanup should the rebuilt plugin/lens/product shell be considered “stable.”

## Practical Rebuild Reminder

If we are rebuilding from an older snapshot, we should not judge success only by whether features reappear.

We should also ask:

- Did we remove the OpenCode-era product lines?
- Did we avoid reintroducing research as the system world model?
- Did we keep only one plugin system?
- Did we stop carrying dead packaging and extension surfaces?

If not, the rebuild is incomplete even if the app “works.”
