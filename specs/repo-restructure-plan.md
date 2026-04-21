# Repository Restructure Plan

This document replaces the idea of a separate `current-state-gap-analysis.md`.

It combines:

- the current-state deviation analysis after the partial restore
- the repository/package restructuring plan
- the remaining implementation work needed to get back to the intended Palimpsest architecture

The goal is not a cosmetic rename pass.

The goal is to make the repository itself reflect the product we actually want to build:

- `Palimpsest`
- web-only
- Linux server first
- multi-user
- domain-core first
- proposal/review/commit driven
- plugin-extensible through one extension system

## 1. Executive Summary

The restored codebase is in an **in-between state**.

Important parts of the intended architecture have already reappeared:

- plugin directories exist
- preset-driven project creation exists
- core/research/security plugins already declare presets, lenses, and product actions
- the product action model (`Ask / Propose / Review / Run / Inspect`) is present in plugin definitions
- the `specs/` directory now preserves the target architecture

But the repository and runtime are still structurally dominated by the old OpenCode shape:

- the main runtime still lives in `packages/opencode`
- the workspace still uses `@opencode-ai/*` package scopes
- the app shell still looks session/review/file-tree centric instead of domain/lens centric
- session handling is still too tied to legacy shell behavior
- `research` still leaks through dedicated APIs and special-case assumptions
- plugins are not yet first-class workspace packages with clean dependency boundaries

In short:

**The design direction is partially restored, but the repository still expresses the wrong product.**

That is why repo restructuring is not an optional cleanup pass. It is a core rebuild step.

## 2. Current State Gap Analysis

This section captures the most important deviations between the restored codebase and the intended Palimpsest design.

### 2.1 What Is Already Back

These parts are meaningfully aligned with the intended architecture:

#### Project creation is no longer purely research-first

`packages/app/src/components/dialog-new-project.tsx` already uses a preset-driven flow:

- fetch presets from `product.presets()`
- store `presetID`
- call `product.create({ directory, name, presetID, input })`

This is much closer to the intended `New Project -> choose preset -> create project -> preset postCreate` pipeline.

#### Product plugin directories exist

The repository already contains:

- `plugins/core`
- `plugins/research`
- `plugins/security-audit`

Each currently has:

- `manifest.ts`
- `plugin.ts`
- `server/index.ts`
- `web/index.ts`

That is a meaningful recovery of the intended directoryized plugin model.

#### Plugins already encode product intent

The current plugin definitions already include meaningful platform concepts:

- core shell lens
- core workspace tabs
- core session tabs
- product actions
- research preset/lens
- security-audit preset/lens

This means the plugin layer is no longer just a backend hook system; it already contains real product semantics.

#### Product registry calls already exist

The app-side product context already calls endpoints such as:

- `/api/plugins/registry`
- `/api/plugins/presets`
- `/api/projects/:id/shell`
- `POST /api/projects`

That is aligned with the intended preset/lens-driven platform architecture.

### 2.2 What Is Still Wrong

These deviations are serious and architectural, not cosmetic.

#### The runtime is still structurally OpenCode

The main runtime still lives in:

- `packages/opencode`

Current repo evidence:

- root `dev:server` still points at `packages/opencode`
- package names still use `@opencode-ai/*`
- server code still refers to `opencode.ai`, `opencode.local`, `x-opencode-*`, `Flag.OPENCODE_*`

This means the repo still narrates the system as an OpenCode runtime with Palimpsest features layered on top.

That is the opposite of the intended direction.

#### The app shell still looks like an old session workstation

The current app shell is still heavily centered around:

- session tabs
- review panel
- file tree
- terminal
- context tabs
- diff views

This shell may be useful in places, but it is still the wrong primary product model.

The intended Palimpsest shell is:

- domain-first
- core tabs first
- proposal/review/commit visible
- lens overlays second

At the moment, the app shell is still too close to the old OpenCode interaction frame.

#### Sessions are still not cleanly domain-attached

The intended design is:

session attaches to:

- `project`
- `node`
- `run`
- `proposal`
- `decision`

Then the current lens interprets the attachment.

The restored code still appears to treat sessions as part of a legacy shell model with review/context/file behavior at the center.

That means session architecture is still behind the intended design.

#### Research is still not fully demoted to “just another plugin”

Even though research now has plugin definitions, the restored system still shows signs of research-specific leakage:

- dedicated research client surfaces
- research-specific assumptions in UI and session flows
- research-specific concepts still appearing outside plugin boundaries

The intended architecture requires:

- `research` and `security-audit` to be equal builtin plugins
- neither to occupy privileged product territory

The restored state is not there yet.

#### Plugin boundaries are logical, not yet physical enough

The current plugin folders exist, but the dependency boundary is still too weak.

Examples of the wrong shape:

- plugin code importing directly from `packages/opencode/src/...`
- plugin definitions depending on runtime internals instead of stable package surfaces

This means plugins are not truly independent product modules yet. They are still feature folders over a host runtime.

#### De-OpenCode cleanup is far from complete

The repo still contains many OpenCode-era traces:

- package names
- runtime headers
- cookie names and flags
- theme IDs
- desktop/WSL-era strings
- container scripts and tooling names
- `packages/opencode` as the canonical server package

This is not compatible with the intended Palimpsest identity.

### 2.3 Current State Assessment

Rough assessment:

- design concepts recovered: `60-70%`
- product shell alignment: `35-45%`
- de-OpenCode migration: `20-30%`

This is enough to rebuild from.

It is not close enough to treat the restored repo structure as acceptable long-term.

## 3. Why the Current Repository Structure Is Wrong

The current structure still encodes the wrong assumptions.

Current top-level shape:

- `packages/app`
- `packages/opencode`
- `packages/plugin`
- `packages/sdk`
- `packages/ui`
- `packages/util`
- `plugins/*`
- `sdks/*`
- `packages/containers`
- `packages/script`

Problems:

### 3.1 The main package still implies OpenCode is the platform

As long as the runtime lives in `packages/opencode`, the repository is teaching every future contributor the wrong story:

- OpenCode is the core
- Palimpsest is layered on top
- plugins are secondary

That is not what we want.

### 3.2 Product apps and shared packages are mixed together

`packages/app` and `packages/opencode` are product entrypoints, but they live beside small utility packages as if they were all peers of the same kind.

This makes product boundaries harder to understand.

### 3.3 Plugin directories are present but not first-class workspace units

They exist physically, but not cleanly as the main modular boundary of the system.

### 3.4 Tooling and runtime are mixed too casually

Things like:

- container build logic
- release scripts
- support scripts

still live near runtime packages in a way that pollutes the product architecture.

### 3.5 Historical product lines still influence the topology

Even after partial cleanup, the current layout still reflects a history that included:

- desktop/TUI assumptions
- IDE-oriented interaction patterns
- OpenCode-era branding
- session/review/file-centric shell assumptions

We do not want the rebuilt repository to carry those assumptions forward.

## 4. Repo Restructure Principles

### 4.1 Product entrypoints live under `apps/`

The system should have explicit product applications:

- `apps/web`
- `apps/server`

No more `packages/opencode` pretending to be a shared package.

### 4.2 Shared core packages live under `packages/`

Only genuinely reusable platform primitives belong there.

### 4.3 Plugins are first-class workspace units

Builtin plugins should live in `plugins/*` as real package boundaries.

Each plugin should own its:

- manifest
- server code
- web contributions
- prompts
- skills
- resources
- workflows
- rules/assets

### 4.4 No second extension system

We keep one extension model:

- plugin

Within plugin:

- preset
- lens
- action handlers
- server hooks
- web contributions

We do not reintroduce:

- extensions
- separate lens packs
- separate preset packs

### 4.5 The repo should teach the right story

A new contributor should immediately understand:

- Palimpsest is the main product
- server and web are product apps
- plugins are first-class
- research is a builtin plugin, not the core

## 5. Target Repository Structure

The target repository shape should be:

```txt
apps/
  web/
  server/

packages/
  domain/
  plugin-sdk/
  sdk/
  ui/
  shared/
  identity/

plugins/
  core/
    package.json
    manifest.ts
    plugin.ts
    server/
    web/
    prompts/
    skills/
    assets/
  research/
    package.json
    manifest.ts
    plugin.ts
    server/
    web/
    prompts/
    skills/
    assets/
  security-audit/
    package.json
    manifest.ts
    plugin.ts
    server/
    web/
    prompts/
    skills/
    assets/
    rules/

tooling/
  scripts/
  containers/

docs/
specs/
```

### 5.1 What Goes in `apps/`

#### `apps/server`

Owns:

- API server
- auth/session handling
- workspace control plane
- plugin loading
- runtime orchestration
- background jobs/workers
- storage integration

It should not be named or framed as OpenCode.

#### `apps/web`

Owns:

- browser UI
- product shell
- lens-driven workspace shell
- domain views
- proposal/review/commit product surfaces
- plugin web contribution host

### 5.2 What Goes in `packages/`

#### `packages/domain`

Owns:

- canonical data model
- SQL schema / migrations
- repositories / query layer
- core services for node/run/artifact/decision/proposal/review/commit

#### `packages/plugin-sdk`

Owns:

- plugin manifest types
- preset contract
- lens contract
- action contract
- web/server contribution types

#### `packages/sdk`

Owns:

- API client
- generated/openapi-bound types
- thin client helpers for web and plugin consumption

#### `packages/ui`

Owns:

- reusable UI primitives
- generic product components
- no research/security-specific product logic

#### `packages/shared`

Owns:

- cross-cutting utilities
- shared errors
- path/encoding helpers
- stable shared types that are not domain-specific

#### `packages/identity`

Owns:

- brand assets
- favicons/logos/marks
- no runtime product logic

### 5.3 What Goes in `plugins/`

Each plugin owns:

- its `manifest`
- its runtime registration entrypoint
- server logic
- web contributions
- prompts
- skills
- workflows
- static assets / rules

Builtin plugins should become real package-like workspace units.

## 6. Package Mapping from Current State to Target State

This is the intended migration map.

### 6.1 Direct renames

- `packages/app` -> `apps/web`
- `packages/opencode` -> `apps/server`
- `packages/plugin` -> `packages/plugin-sdk`
- `packages/util` -> `packages/shared`
- `packages/script` -> `tooling/scripts`
- `packages/containers` -> `tooling/containers`

### 6.2 Keep with limited scope

- `packages/sdk` stays `packages/sdk`
- `packages/ui` stays `packages/ui`
- `packages/identity` stays `packages/identity`

### 6.3 New package to create

- `packages/domain`

This should become the stable home for domain models and storage-facing core logic, instead of leaving those concepts buried inside the server runtime.

### 6.4 Plugin normalization

Current:

- `plugins/core`
- `plugins/research`
- `plugins/security-audit`

Target:

- keep them under `plugins/`
- make them clean workspace units
- stop importing host internals directly from old runtime paths

## 7. What Must Be Deleted or Rewritten

This section is intentionally blunt.

### 7.1 Delete as product concepts

The rebuilt repo should not preserve these as core product surfaces:

- OpenCode branding
- old OpenCode shell language
- desktop-first assumptions
- WSL-first user-facing language
- TUI-first product paths
- build/plan as top-level user modes

### 7.2 Rewrite aggressively

These things should be rewritten, not lightly aliased:

- `packages/opencode`
- `@opencode-ai/*`
- `x-opencode-*` headers
- `OPENCODE_*` env vars
- `opencode.ai`/`opencode.local` runtime references
- OpenCode theme/desktop naming

### 7.3 Stop tolerating temporary host/plugin shortcuts

Examples:

- plugin imports from `packages/opencode/src/...`
- plugin web code living permanently inside the app shell
- server routes with research/security special treatment outside plugin boundaries

These may exist temporarily during migration, but they should be tracked as debt with explicit removal steps.

## 8. Architecture Corrections Required Alongside the Restructure

The repo restructure is not enough by itself. It must happen together with these architectural corrections.

### 8.1 Lens-driven UI shell

The UI should be organized around:

- core tabs
- plugin/lens contributions

Not:

- research vs domain shell forks
- hardcoded taxonomy checks

### 8.2 Domain-attached sessions

Sessions should attach to:

- `project`
- `node`
- `run`
- `proposal`
- `decision`

Then lenses interpret those attachments.

We should not restore:

- atom session shell
- experiment session shell
- special research main session shell

### 8.3 Product actions instead of internal agent modes

User-facing actions should remain:

- `Ask`
- `Propose`
- `Review`
- `Run`
- `Inspect`

Internal agent/tool names may exist, but must stay implementation-side.

### 8.4 Research and security as equal plugins

Both must be:

- builtin plugins
- preset providers
- lens providers
- action providers
- server and web contributors

Neither should own the system shell.

## 9. Recommended Technical Direction During the Rebuild

This captures the conclusions from the rebuild retrospective and later discussion.

### 9.1 Database

Recommended target:

- `Postgres`

Reason:

- multi-user collaboration
- proposal/review/commit audit trails
- workspace/member permissions
- timeline/history queries
- better long-term platform fit than SQLite

### 9.2 ORM / query layer

Recommended direction:

- SQL-first
- `Drizzle` or `Kysely`
- avoid making Prisma the central abstraction

Reason:

- the platform will need complex domain queries and timeline/audit-style access patterns
- Prisma would likely push many paths back to raw SQL anyway

### 9.3 Validation

Keep:

- `Zod`

### 9.4 Effect

Recommended stance:

- do **not** make the whole project Effect-first
- allow Effect in bounded layers:
  - worker
  - orchestration
  - retry / fallback
  - agent harness
  - resource lifecycle

Reason:

- the bigger problem is architecture boundaries, not effect typing
- plugin authors and product code should not be forced into a high-overhead abstraction everywhere

### 9.5 Frontend framework

No mandatory change is required immediately.

Solid is not the main problem.

But the rebuilt shell should reduce complexity regardless of framework by:

- using clearer product boundaries
- removing session-shell legacy assumptions
- making lens contributions explicit

## 10. Detailed Remaining Refactor Plan

This is the actual remaining refactor plan from the current restored repo to the intended Palimpsest architecture.

## Phase 0: Freeze New Debt

### Goals

- stop adding new code to the wrong places
- stop reinforcing OpenCode-era package boundaries

### Rules

- no new product logic in `packages/opencode/src/...` unless it is migration-only
- no new plugin logic directly under `packages/app/src/...` unless it is a temporary bridge with a removal note
- no new `@opencode-ai/*` package names
- no new user-facing references to OpenCode

### Deliverables

- phase rules documented in developer notes
- migration TODO markers for temporary bridges

## Phase 1: Establish the New Package Topology

### Tasks

1. Create new top-level directories:
   - `apps/server`
   - `apps/web`
   - `packages/domain`
   - `packages/plugin-sdk`
   - `packages/shared`
   - `tooling/scripts`
   - `tooling/containers`

2. Move package entrypoints:
   - web entrypoint from `packages/app` -> `apps/web`
   - server entrypoint from `packages/opencode` -> `apps/server`

3. Update root workspace config:
   - include `apps/*`
   - include `plugins/*`
   - include `packages/*`
   - include `tooling/*` only if they remain package-like

4. Update root scripts:
   - `dev` -> `apps/web`
   - `dev:server` -> `apps/server`
   - `typecheck` to include new apps/packages/plugins

### Acceptance Criteria

- the repo no longer presents `packages/opencode` as the platform center
- app and server are visibly product entrypoints

## Phase 2: Rename and Normalize Package Identity

### Tasks

1. Rename package scopes:
   - `@opencode-ai/*` -> `@palimpsest/*`

2. Update imports incrementally:
   - app
   - server
   - plugin SDK
   - ui
   - shared utilities
   - plugin packages

3. Rename package names:
   - `@opencode-ai/app` -> `@palimpsest/web`
   - `opencode` -> `@palimpsest/server`
   - `@opencode-ai/plugin` -> `@palimpsest/plugin-sdk`
   - `@opencode-ai/util` -> `@palimpsest/shared`
   - `@opencode-ai/sdk` -> `@palimpsest/sdk`

### Acceptance Criteria

- no package identity implies OpenCode as the product
- new imports express Palimpsest as the canonical system

## Phase 3: Extract the True Domain Package

### Tasks

1. Move canonical domain model and storage contracts into `packages/domain`
2. Extract:
   - node
   - edge
   - run
   - artifact
   - decision
   - proposal
   - review
   - commit
   - actor
   - taxonomy
3. Move migrations and query/repository layer behind domain-facing packages
4. Keep app and plugin code from reaching directly into server internals for core entity logic

### Acceptance Criteria

- domain is not hidden inside the server package
- plugins depend on a stable domain layer rather than runtime internals

## Phase 4: Turn Plugins into Real Workspace Units

### Tasks

1. Add `package.json` for each builtin plugin if missing or incomplete
2. Ensure each plugin exports through stable entrypoints:
   - `plugin.ts`
   - `server/index.ts`
   - `web/index.ts`
3. Move plugin-specific assets under each plugin:
   - prompts
   - skills
   - workflows
   - rules/resources
4. Ban direct plugin imports from host private internals

### Acceptance Criteria

- plugins behave like true modules, not source folders over host internals
- `research` and `security-audit` are equally structured

## Phase 5: Cut Plugin-to-Host Source Coupling

### Tasks

1. Find all imports from plugins into:
   - `packages/opencode/src/...`
   - future `apps/server/src/...`
   - `packages/app/src/...`

2. Replace with stable dependencies:
   - `packages/domain`
   - `packages/plugin-sdk`
   - `packages/sdk`
   - `packages/shared`
   - explicit host integration contracts

3. Introduce small host integration surfaces if necessary:
   - product shell registry
   - route registration
   - workflow registration
   - prompt loading

### Acceptance Criteria

- plugin code does not reach into private host source trees
- plugin boundaries are enforceable by imports

## Phase 6: Replace the Legacy App Shell

### Tasks

1. Rework the top-level shell to be:
   - domain-first
   - lens-driven
   - proposal/review/commit visible

2. Reduce file-tree/review/terminal shell privilege
3. Make core tabs canonical:
   - Nodes
   - Runs
   - Artifacts
   - Decisions
   - Reviews
   - Monitors
   - Sources

4. Keep lens tabs additive

### Acceptance Criteria

- the app shell no longer feels like a repurposed OpenCode session IDE
- the UI reads like Palimpsest, not a legacy coding shell

## Phase 7: Rebuild Sessions as Domain Attachments

### Tasks

1. Replace special session shell logic with generic attachments
2. Make session attach to:
   - project
   - node
   - run
   - proposal
   - decision
3. Let lenses provide session interpretation and rendering

### Acceptance Criteria

- session skeleton does not depend on research object types
- research/security only customize interpretation

## Phase 8: Make Product Actions the Main UX

### Tasks

1. Standardize visible actions:
   - Ask
   - Propose
   - Review
   - Run
   - Inspect

2. Route action handling through lens/plugin action providers
3. Remove or hide direct user-facing exposure of internal agent mode names

### Acceptance Criteria

- users interact through product actions
- implementation-specific tool/agent names do not dominate UX

## Phase 9: Complete De-OpenCode Runtime Migration

### Tasks

1. Replace runtime names:
   - headers
   - cookies
   - env vars
   - docs/help text
   - theme IDs
   - schema IDs

2. Remove runtime OpenCode references:
   - `opencode.ai`
   - `opencode.local`
   - OpenCode app metadata
   - OpenCode desktop wording

3. Update networking and mdns/dev assumptions to Palimpsest terms

### Acceptance Criteria

- the system no longer presents itself as OpenCode at runtime
- branding and runtime contracts align with Palimpsest

## Phase 10: Harden the Platform Shape

### Tasks

1. Stabilize plugin-owned presets/lenses/actions
2. Strengthen proposal/review/commit product flows
3. Complete review/share/export/replay product surfaces
4. Evaluate and stage the Postgres migration
5. Optionally introduce Effect in:
   - orchestration
   - worker
   - harness
   - retry/fallback layers

### Acceptance Criteria

- the repo shape and runtime shape agree
- the product shell and domain shell agree
- plugins are first-class and equal

## 11. Concrete File and Directory Priorities

These are the highest-leverage concrete areas to attack first.

### Priority A: root and package topology

- root `package.json`
- workspace configuration
- package scopes and names
- `packages/opencode`
- `packages/app`
- `packages/plugin`
- `packages/util`

### Priority B: runtime identity and routing

- server entrypoint
- runtime headers/cookies/envs
- auth/workspace wiring
- product/plugin registry wiring

### Priority C: app shell

- top-level app shell
- workspace sidebar
- session shell
- review surfaces
- file-tree/terminal privilege

### Priority D: plugin boundary enforcement

- plugin imports
- server/web contribution contracts
- resource ownership

## 12. Risks and Tradeoffs

### 12.1 Biggest risk

Trying to preserve too much of the old runtime shape while also introducing the new plugin/lens architecture.

That path recreates the same ambiguity we already learned was unhealthy.

### 12.2 What to avoid

- endless bridge layers
- permanent re-export chains
- old package names kept “for compatibility”
- continuing to add product logic to `packages/opencode`
- letting session/review/file-tree remain the primary shell model

### 12.3 Where to be pragmatic

- temporary bridges are acceptable if explicitly tracked
- plugin loading can remain compile-time/static before a more dynamic system exists
- Effect can wait until the orchestration layers are actually ready for it
- Postgres migration can be staged after package topology is corrected

## 13. Definition of Success

This repo restructure is successful when:

- Palimpsest is visibly the primary system in directory structure, packages, and runtime language
- app and server live in `apps/`
- domain lives outside the server host package
- plugins are real first-class modules
- `research` and `security-audit` are symmetric builtin plugins
- the UI shell is domain/lens-driven
- sessions are domain-attached
- old OpenCode identity is no longer the repo’s dominant story

## 14. Recommended Immediate Next Step

The next practical step should be:

1. create the new top-level package topology
2. move `packages/opencode` -> `apps/server`
3. move `packages/app` -> `apps/web`
4. move `packages/plugin` -> `packages/plugin-sdk`
5. move `packages/util` -> `packages/shared`
6. update workspace/package names
7. block new code from landing in old paths

That gives the rebuild the right physical spine before deeper domain/plugin work continues.
