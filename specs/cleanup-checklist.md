# Cleanup Checklist

> **DEPRECATED — scheduled for deletion.** Historical context only; not authoritative. Consult `git log` if you need the timeline. See `specs/README.md` for the restructure plan.

> Historical archive: this checklist tracked the large de-OpenCode and dead-code
> cleanup campaign. Keep it as history and reference for future pruning.

This checklist turns the earlier cleanup direction into an execution document.

It exists so the rebuild does not repeat this failure mode:

- architecture improves on paper
- old repo shape stays in place
- legacy product surfaces quietly come back

Use this as a practical companion to:

- [deopencode-cleanup.md](./deopencode-cleanup.md)
- [rebuild-roadmap.md](./rebuild-roadmap.md)

## Status Meanings

- `remove`
  Should be deleted from the product repo.
- `keep`
  Still belongs in the Palimpsest product.
- `evaluate`
  Keep for now, but reassess after the core rebuild.
- `rewrite`
  The category remains, but the implementation or product framing needs replacement.

## A. Repo Clutter

### A1. Editor / Local Artifacts

- `remove` `.zed`
- `remove` stray local editor config that is not team-wide
- `remove` local logs such as storybook debug logs
- `remove` leftover signing config not relevant to Linux/Web-only runtime

### A2. Fake / Junk Scripts

- `remove` fake placeholder scripts like `hello`, `random`, or one-off toy commands from root `package.json`
- `remove` junk fields in package manifests that are not used by build/runtime
- `remove` stale publish/release helper scripts tied to deleted product lines

### A3. Dead README / Launch Instructions

- `remove` or rewrite docs that still describe OpenCode-era startup flows
- `remove` desktop/Tauri/Electron launch docs
- `rewrite` README text that still frames the system as OpenResearch or OpenCode

## B. Dead Product Lines

### B1. Desktop Product

- `remove` `packages/desktop`
- `remove` `packages/desktop-electron`
- `remove` any remaining desktop menus, updater logic, or packaging scripts
- `remove` Tauri/Electron release workflows

### B2. SaaS / Enterprise Product Lines

- `remove` `packages/enterprise`
- `remove` `packages/console/*`
- `remove` `packages/function`
- `remove` matching `infra/*` that only exists to support those product lines

### B3. Separate Marketing / Site Product Line

- `remove` or archive `packages/web` if it is a separate website/docs product line not needed for the core product
- `rewrite` docs hosting assumptions so the product repo centers on the platform itself

## C. IDE / Extension Surfaces

These were explicitly considered non-core to the product.

### C1. Editor Extensions

- `remove` Zed extension
- `remove` VS Code extension
- `remove` extension publish/sync scripts
- `remove` extension-specific README and release notes from the core repo path

### C2. IDE Helper Surfaces

- `evaluate` LSP support
- `evaluate` formatter API
- `remove` if they continue to act like IDE-first product scaffolding instead of platform support

Guideline:

- PTY/Terminal stays
- IDE-shell assumptions do not

## D. OpenCode-Era Runtime Surface

### D1. Naming

- `rewrite` product name to `Palimpsest`
- `remove` user-visible `OpenResearch` branding from runtime
- `remove` user-visible `OpenCode` branding from runtime

### D2. Package / Workspace Naming

- `rewrite` old package names and scopes toward `@palimpsest/*`
- `rewrite` `packages/opencode` style naming into Palimpsest-owned package names

### D3. Env / Header / Cookie / Metadata Paths

- `rewrite` to `PALIMPSEST_*`
- `rewrite` to `x-palimpsest-workspace`
- `rewrite` to `palimpsest_session`
- `rewrite` to `.palimpsest/`
- `remove` lingering `PALIMPSEST_*`
- `remove` lingering `OPENRESEARCH_*`
- `remove` lingering `.openresearch*`

### D4. API Surface

- `rewrite` old OpenResearch/OpenCode-era API paths into stable resource-oriented `/api/*`
- `remove` long-lived compatibility prefixes and compatibility routes once the new surface is stable

## E. Interaction-Model Debt

### E1. Top-Level Mode Language

- `remove` `build` as a primary product mode
- `remove` `plan` as a primary product mode
- `remove` `experiment` as a primary product mode
- `rewrite` product actions into:
  - Ask
  - Propose
  - Review
  - Run
  - Inspect

### E2. Session Special Cases

- `remove` shell-level atom session special treatment
- `remove` shell-level experiment session special treatment
- `remove` research main session as a distinct top-level shell class
- `rewrite` sessions as generic containers attached to domain objects

### E3. Research-First Project Entry

- `remove` “upload paper first” as the primary product entry
- `rewrite` project creation as preset-driven
- `rewrite` research as a preset/lens, not the default worldview

## F. Extension System Consolidation

### F1. Parallel Extension Mechanisms

- `remove` any split between extension and plugin systems
- `remove` ad hoc lens-pack/preset-pack side channels
- `rewrite` all extension surfaces under one plugin SDK

### F2. Scattered Plugin Ownership

- `rewrite` plugin logic that is spread across app/server into plugin directory bundles
- `rewrite` builtin plugin server/web entrypoints into plugin-owned directories
- `rewrite` prompts / skills / assets / rules into plugin directories

Target examples:

- `plugins/core`
- `plugins/research`
- `plugins/security-audit`

## G. Builtin Lens Asymmetry

This is not clutter, but it is architecture debt.

### G1. Research Special Treatment

- `remove` research-only privileged product paths
- `remove` hardcoded `research_core` checks where registry-driven lens logic should be used
- `rewrite` research as a fully plugin-owned builtin lens

### G2. Security-Audit Underspecification

- `rewrite` security-audit so it is not “just a capability pack”
- `rewrite` it as a full builtin plugin bundle with:
  - preset
  - lens
  - actions
  - workflows
  - assets/rules

## H. Platform Surfaces to Keep

These are intentionally **not** cleanup targets.

### H1. Keep

- `keep` core server runtime
- `keep` web app
- `keep` plugin SDK
- `keep` shared SDK
- `keep` shared UI/util packages
- `keep` PTY/Terminal

### H2. Keep But Reframe

- `rewrite` terminal support as part of run/debug/repro workflows, not as a TUI-era product center

## I. Evaluate Later

These should not distract the early rebuild, but should stay on the radar.

- `evaluate` MCP
- `evaluate` LSP / formatter
- `evaluate` any remaining sidecar integrations that are not central to the platform

## J. Suggested Execution Order

The practical order should be:

1. Remove obvious clutter
2. Remove dead product lines
3. Remove IDE/extension lines
4. Collapse runtime naming
5. Remove old interaction-model debt
6. Consolidate plugin system
7. Rebuild on the cleaned spine

## K. Rebuild Gate

Do not consider the rebuild healthy if:

- desktop/TUI/enterprise shells are still treated as first-class
- research still dominates project creation and session shell behavior
- OpenCode-era naming is still the main runtime surface
- there are still two parallel extension systems

The app may run in that state, but the architectural recovery would still be incomplete.
