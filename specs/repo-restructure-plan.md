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
- the workspace still uses `@palimpsest/*` package scopes
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

`packages/web/src/components/dialog-new-project.tsx` already uses a preset-driven flow:

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

- `/api/plugin-sdks/registry`
- `/api/plugin-sdks/presets`
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
- package names still use `@palimpsest/*`
- server code still refers to `opencode.ai`, `palimpsest.local`, `x-palimpsest-*`, `Flag.PALIMPSEST_*`

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

- `packages/web`
- `packages/opencode`
- `packages/plugin-sdk`
- `packages/sdk`
- `packages/ui`
- `packages/shared`
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

`packages/web` and `packages/opencode` are product entrypoints, but they live beside small utility packages as if they were all peers of the same kind.

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

#### `packages/plugin-sdk-sdk`

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

- `packages/web` -> `apps/web`
- `packages/opencode` -> `apps/server`
- `packages/plugin-sdk` -> `packages/plugin-sdk-sdk`
- `packages/shared` -> `packages/shared`
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
- `@palimpsest/*`
- `x-palimpsest-*` headers
- `PALIMPSEST_*` env vars
- `opencode.ai`/`palimpsest.local` runtime references
- OpenCode theme/desktop naming

### 7.3 Stop tolerating temporary host/plugin-sdk shortcuts

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
- no new plugin logic directly under `packages/web/src/...` unless it is a temporary bridge with a removal note
- no new `@palimpsest/*` package names
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
   - `packages/plugin-sdk-sdk`
   - `packages/shared`
   - `tooling/scripts`
   - `tooling/containers`

2. Move package entrypoints:
   - web entrypoint from `packages/web` -> `apps/web`
   - server entrypoint from `packages/opencode` -> `apps/server`

3. Update root workspace config:
   - include `apps/*`
   - include `plugins/*`
   - include `packages/*`
   - include `tooling/*` only if they remain package-like

4. Update root scripts:
   - `dev` -> `apps/web`
   - `dev:server` -> `apps/server`
   - `typecheck` to include new apps/packages/plugin-sdks

### Acceptance Criteria

- the repo no longer presents `packages/opencode` as the platform center
- app and server are visibly product entrypoints

## Phase 2: Rename and Normalize Package Identity

### Tasks

1. Rename package scopes:
   - `@palimpsest/*` -> `@palimpsest/*`

2. Update imports incrementally:
   - app
   - server
   - plugin SDK
   - ui
   - shared utilities
   - plugin packages

3. Rename package names:
   - `@palimpsest/web` -> `@palimpsest/web`
   - `opencode` -> `@palimpsest/server`
   - `@palimpsest/plugin-sdk` -> `@palimpsest/plugin-sdk-sdk`
   - `@palimpsest/shared` -> `@palimpsest/shared`
   - `@palimpsest/sdk` -> `@palimpsest/sdk`

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
   - `packages/web/src/...`

2. Replace with stable dependencies:
   - `packages/domain`
   - `packages/plugin-sdk-sdk`
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

2. Route action handling through lens/plugin-sdk action providers
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
   - `palimpsest.local`
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
- `packages/web`
- `packages/plugin-sdk`
- `packages/shared`

### Priority B: runtime identity and routing

- server entrypoint
- runtime headers/cookies/envs
- auth/workspace wiring
- product/plugin-sdk registry wiring

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
3. move `packages/web` -> `apps/web`
4. move `packages/plugin-sdk` -> `packages/plugin-sdk-sdk`
5. move `packages/shared` -> `packages/shared`
6. update workspace/package names
7. block new code from landing in old paths

That gives the rebuild the right physical spine before deeper domain/plugin-sdk work continues.

## 15. Sprint 1 Outcome and Amendments

Sprint 1 originally scoped as a "cleanup pass" ended up covering the substrate cut for de-OpenCode. The scope expanded mid-flight after the user's explicit "越干净越彻底越好" directive. This section records the decisions that diverged from the earlier plan.

### 15.1 Abandoned: `plugin-sdk -> plugin-sdk-sdk` rename

The Section 6.1 direct rename of `packages/plugin-sdk` to `packages/plugin-sdk-sdk` is abandoned. The doubled `-sdk-sdk` suffix conveys no useful distinction, the current `@palimpsest/plugin-sdk` name already maps cleanly, and the rename would churn every plugin manifest for zero payoff. Sprint 1 deleted the ghost `packages/plugin-sdk-sdk/` and `packages/plugin/` directories instead.

### 15.2 Deferred to Sprint 4.5: Plugin Host API

Section 7.3's step "stop plugin imports from `packages/opencode/src/...`" was partially done: `import-boundary.test.ts` now enforces that plugin bundles cannot import from `@/...`, `@palimpsest/server/...`, `@palimpsest/web/...`, or relative `apps/{server,web}/` paths. But research-specific logic (`apps/server/src/research/research.ts`, `research.sql.ts`, `experiment-*.ts`) still lives in the server host because moving it into `plugins/research/server/` would immediately break the import-boundary contract — those files depend on `@/session`, `@/bus/bus-event`, `@/storage/db`, `@/util/log`.

Migration gate: the research business logic cannot leave the host until a **plugin host API** is defined in `@palimpsest/plugin-sdk` that exposes stable contracts for session, bus, database, and logging. This work is **Sprint 4.5**, sequenced between Core Tabs (Sprint 3) and Plugin Symmetry (Sprint 4).

Until then, treat `apps/server/src/research/` and `apps/server/src/server/routes/research.ts` as tracked debt, not permanent residents.

### 15.3 New Package: `packages/runner`

Sprint 1 extracted pure remote-execution utilities into `packages/runner`:

- `ssh-config.ts` — SSH config file parser (0 dependencies)
- `remote-server.ts` — RemoteServerConfig schema + path resolution
- `remote-task.ts` — SSH + screen-based remote task runner with injected logger

These were originally under `apps/server/src/research/` but had no research-specific coupling. The new package uses the same runtime-config pattern as `@palimpsest/domain` (`configureRunner({ logger })` called from `apps/server/src/runner.ts`). Plugins can now depend on `@palimpsest/runner` for remote execution primitives without breaching import-boundary rules.

### 15.4 Known Exceptions to deopencode-cleanup.md

The following three items intentionally retain OpenCode identity at runtime, as a conscious trade-off rather than an oversight:

1. **`plugins/codex.ts` + `plugins/copilot.ts`** — first-party Palimpsest plugins that reuse users' existing ChatGPT Plus/Pro and GitHub Copilot subscriptions as Palimpsest AI providers. Both emit `User-Agent: opencode/...` and `originator: "opencode"` because that is the only third-party client identity OpenAI and GitHub tolerate. These are justified because users own the underlying subscription; we are borrowing the vendor-approved client fingerprint, not freeloading on OpenCode infrastructure.
2. **`opencode` AI provider (Layer A)** — the `CUSTOM_LOADERS.opencode` adapter and associated auth / transform / header logic are preserved so that users with OpenCode Zen or OpenCode Go subscriptions can connect to Palimpsest. This is compatibility with a user-owned resource, not endorsement: Palimpsest does not list `opencode` in `popularProviders`, does not render the Zen onboarding card, does not tag it "Recommended". It appears only in the generic "Other" provider list. The UI was explicitly deflated to Layer A (technical channel) in Sprint 1.
3. **Anthropic subscription auth is explicitly NOT retained.** The `opencode-anthropic-auth` npm plugin was dropped. Anthropic does not tolerate third-party client impersonation the way OpenAI and GitHub do, and we respect that.

### 15.5 Deletions (runtime + tooling)

Sprint 1 removed the following as first-party Palimpsest concerns:

- `apps/server/src/cli/cmd/github.ts` (~1400 lines of OpenCode GitHub App bot integration)
- `apps/server/src/ide/index.ts` `install()` function (auto-install of `sst-dev.opencode` VS Code extension)
- `script/beta.ts`, `script/changelog.ts`, `script/duplicate-pr.ts`, `script/stats.ts`, `script/version.ts`, `script/release` (OpenCode release pipeline)
- `apps/server/script/publish.ts` (npm/docker publish for `opencode-ai`)
- `github/` (OpenCode GitHub Action package)
- `aset/`, `graphrag-user-guide.md`, `STATS.md` (legacy research documentation)
- Dead research UI shells: `codes-tab.tsx`, `servers-tab.tsx`, `graph-state-manager.ts` — these referenced an `sdk.client.research` surface that no longer exists. They are scheduled to be rebuilt as part of Sprint 4 inside `plugins/research/web/`.
- Test files whose source was deleted: `test/cli/github-action.test.ts`, `test/cli/github-remote.test.ts`, `test/plugin/codex.test.ts` (the last one was restored along with the Codex plugin, see 15.4), orphan `test/tool/__snapshots__/`.
- Entire `.github/` directory: all workflows (OpenCode CI/CD, vouch system, stats, beta, nix, notify-discord, release actions, compliance, pr-standards), actions, issue templates, CODEOWNERS, TEAM_MEMBERS, VOUCHED.td. Palimpsest will build its own CI posture when it reaches that phase.

### 15.6 Renamed Runtime Surfaces

- `/.well-known/opencode` remote config path → `/.well-known/palimpsest`
- `https://opencode.ai/config.json` schema URL → `https://palimpsest.dev/config.json`
- MCP client `name: "opencode"` → `name: "palimpsest"`
- MCP OAuth `client_uri: "https://opencode.ai"` → `client_uri: "https://palimpsest.dev"`
- `webfetch` fallback `User-Agent: "opencode"` → `"palimpsest"`
- Session LLM non-Anthropic `User-Agent` → `palimpsest/${VERSION}` (opencode provider still emits `opencode/...` UA per 15.4)
- `agent/agent.ts` description "primary OpenResearch agent" → "primary research agent"
- `opencode-uploads` temp directory → `palimpsest-uploads`
- `.git/opencode` id marker → `.git/palimpsest`
- Various test fixtures, local variable names, i18n keys, gitignore entries

### 15.7 Acceptance

Sprint 1 is considered complete when:

- `rg "opencode|OpenCode|openresearch|OpenResearch"` across the repo returns only:
  - specs history docs (`specs/recovered-*`, `deopencode-cleanup.md`, etc.)
  - intentional Known Exceptions (15.4) with inline comments explaining the exception
  - real opencode provider IDs in test fixtures and E2E model strings
  - historic references in README files preserved as context
- `bun run typecheck` passes across all 8 workspace packages with cache miss
- `test/plugin/import-boundary.test.ts` passes
- The repo no longer contains a `.github/` directory, a `github/` subtree, or an OpenCode-branded CI pipeline
- Stale research UI files (`codes-tab`, `servers-tab`, `graph-state-manager`) are gone

## 16. Sprint 2 Outcome: Proposal-First Write Path

Sprint 2 turned the proposal/review/commit skeleton into a real write path. Before Sprint 2 the domain tables were present but every `Domain.createNode` caller could mutate accepted state without going through a proposal. After Sprint 2 the direct write methods are system-only, so any non-system actor must route writes through `Domain.propose -> Domain.reviewProposal`.

### 16.1 Actor Gating on Direct Writes

`Domain.createNode / updateNode / removeNode / createEdge / updateEdge / removeEdge / createRun / updateRun / removeRun / createArtifact / updateArtifact / removeArtifact / createDecision / updateDecision / removeDecision` now require an `actor: Actor` input and throw `DomainAuthorizationError` when `actor.type !== "system"`. The HTTP `/domain/accepted/*` sub-app injects a fixed `SYSTEM = { type: "system", id: "accepted_bridge" }` so direct writes are only reachable through that deliberate bridge. Ordinary public routes (`POST /domain/node` etc.) were already proxying through `queued()` to `Domain.propose`, so no behavior changed at the client contract level — they just no longer need the caller to pass `actor` in the body.

`Run` and `Decision` retain a separate `triggeredBy` / `decidedBy` field for their entity-attribution semantics, distinct from the gating actor.

### 16.2 Resolved Applied Changes

`Domain.reviewProposal(approve)` previously stored `applied_changes: item.changes` verbatim. When a proposal omitted an id (`{ op: "create_node", kind, title }`), the generated id was never captured back into the commit's `applied_changes`. Sprint 2 refactored `apply(projectID, change)` to return the resolved change, and `reviewProposal` now collects and persists the resolved list. Commit history is now a faithful record of what was actually applied.

### 16.3 Revision Tracking

A new `revision` integer column (default 1) was added to the `proposal` table via migration `20260421180000_proposal_revision`. A new `Domain.reviseProposal` method lets the proposer iterate after a `request_changes` review without opening a fresh proposal: same `proposal.id`, bumped `revision`, optional updates to `changes` / `title` / `rationale` / `refs`. `DomainProposerMismatchError` fires if a non-system caller attempts to revise someone else's proposal.

`Domain.withdrawProposal` gained the same proposer-match guard.

### 16.4 Bus Events

`apps/server/src/domain/domain.ts` now exposes `Domain.Event.*` definitions for the proposal lifecycle:

- `domain.proposal.created`
- `domain.proposal.revised`
- `domain.proposal.reviewed` (fires for every verdict)
- `domain.proposal.committed` (fires only when the review verdict is approve)
- `domain.proposal.withdrawn`

Events are published from the HTTP routes layer (`apps/server/src/server/routes/domain.ts`). Subscribers elsewhere in the host (and, once Sprint 4.5 plugin host API lands, plugins) can hook into these without polling.

### 16.5 Ship vs Review Mode

The `POST /domain/proposal` endpoint and the `queued()` helper (used by `POST /domain/node`, `/edge`, `/run`, `/artifact`, `/decision` and their PATCH/DELETE counterparts) accept an optional `autoApprove: boolean`. When true, the server creates the proposal and immediately approves + commits it in the same request, still emitting `proposal.created`, `proposal.reviewed`, and `proposal.committed` so the audit trail is complete. This is the "ship" mode; default is "review" (proposal stays pending until someone reviews).

### 16.6 Web: /:dir/reviews Route

A new page `apps/web/src/pages/reviews.tsx` is mounted at `/:dir/reviews` and `/:dir/reviews/:proposalID`. It shows:

- a pending/all filter toggle
- a left rail of proposals sorted by most recently updated
- a right pane with rationale, changes JSON, reviews timeline, and the resulting commit once approved
- approve / reject / request_changes buttons for reviewers who are not the proposer
- a withdraw button for the proposer
- an inline "Propose" composer that creates an `add_node` proposal (optionally with an `add_edge` to an existing node), with an auto-approve checkbox for ship mode

`DomainSidebarOverview` now links pending proposals into the Reviews route. The core lens's `propose` and `review` actions, when clicked in `SessionShellBar`, navigate to `/:dir/reviews` instead of seeding the prompt input.

### 16.7 Deferred

- **Playwright e2e:** the full UI click-through (propose in dialog -> inbox -> approve -> Nodes list shows it) is deferred to Sprint 2.5 as a soak test after the UI settles. The unit suite in `apps/server/test/domain/domain.test.ts` covers the same end-to-end path via the SDK (propose multi-change -> approve -> graph shows nodes + edge -> commit has resolved ids -> revision iteration -> withdraw -> bus events fire).
- **Permissions v1:** reviewer cannot approve own proposal is enforced by domain layer (`ProposerMismatchError`), but workspace-role enforcement (owner/editor/viewer) stays deferred to Sprint 5.
- **Commit provenance tab:** commits are rendered inside the proposal detail for now. Pulling them into the Decisions timeline is Sprint 3 work.

### 16.8 Acceptance

Sprint 2 is considered complete when:

- `bun test test/domain test/server/domain.test.ts` passes 12/12 (10 domain tests + 2 server route tests)
- `bun run typecheck` passes across all 8 workspace packages
- `Domain.createNode` (and all sibling direct writes) refuses any non-system actor at runtime
- A commit's `applied_changes` entries include the resolved ids generated by `apply()`
- `Domain.reviewProposal` with `verdict: "request_changes"` keeps `status: "pending"` and does not create a commit; a subsequent `Domain.reviseProposal` bumps `proposal.revision`
- `domain.proposal.*` bus events are emitted by the HTTP routes for create / revise / review / commit / withdraw
- The web `/:dir/reviews` route renders the proposal inbox, detail pane, and composer, and `autoApprove` ship mode works

## 17. Sprint 3 Outcome: Core Tabs Materialized

Before Sprint 3, the core lens (`plugins/core/plugin.ts`) declared seven workspace tabs — nodes, runs, artifacts, decisions, reviews, monitors, sources — but only Reviews (from Sprint 2) and Session actually had a route. The tabs were display chips in `SessionShellBar` with no destination. Sprint 3 makes the remaining six tabs real pages and wires them into the shell.

### 17.1 Routes

`apps/web/src/app.tsx` gained these routes under `/:dir`:

- `/nodes` and `/nodes/:nodeID`
- `/runs` and `/runs/:runID`
- `/artifacts` and `/artifacts/:artifactID`
- `/decisions` and `/decisions/:decisionID`
- `/sources` and `/sources/:sourceID`
- `/monitors`

Each route lazy-loads its page component. The existing `/reviews` path from Sprint 2 stays the Reviews tab.

### 17.2 Shared Tab Scaffold

`apps/web/src/pages/tab/entity-tab.tsx` provides a reusable `EntityTab<T>` component that every entity tab composes:

- header with subtitle / title / optional kind filter / optional action slot
- left rail: list with item title + kind badge + subtitle, sorted and selectable
- right pane: detail renderer with the currently selected item
- loading / error / empty states baked in

Each tab page (nodes, runs, artifacts, decisions, sources) passes a `fetch()` that calls the SDK, an `itemID`/`itemTitle`/`itemSubtitle`/`itemBadge` set for rendering the list, and a `detail` render prop for the right pane. Filter changes bump an internal `version` signal that retriggers the fetch.

### 17.3 Tab Pages

- **Nodes (`pages/nodes.tsx`):** list filtered by node kind, detail shows body / data / incoming edges / outgoing edges. Edge targets are clickable and cross-navigate between nodes.
- **Runs (`pages/runs.tsx`):** list filtered by status, detail shows kind / status / triggered-by actor / started / finished / manifest / linked node.
- **Artifacts (`pages/artifacts.tsx`):** list filtered by kind, detail shows mime / storage uri / linked run and node / data / provenance.
- **Decisions (`pages/decisions.tsx`):** list filtered by state, detail shows state / rationale / linked node-run-artifact / supersede chain (both directions).
- **Sources (`pages/sources.tsx`):** minimal core view showing nodes with `kind: "source"`. Carries an inline note that richer renderer (citation count, fetch status, paper metadata) lands via research lens contribution once Sprint 3.5's plugin host API exists.
- **Monitors (`pages/monitors.tsx`):** intentional empty placeholder. Core does not own monitor sources; the page explains what a plugin (security-audit, research) will contribute once Sprint 3.5 lands.

Each page's header carries a "Propose {entity}" button that navigates to `/reviews` — all writes still route through the proposal spine from Sprint 2.

### 17.4 Shell Integration

- `SessionShellBar` renders core tab chips as actual `<A>` navigation links via a `CORE_TAB_ROUTES` map. Lens tabs remain as non-navigable chips until Sprint 3.5.
- `DomainSidebarOverview` stat cards became clickable: nodes / runs / artifacts / decisions link to their tabs; pending and commits link to `/reviews`.

### 17.5 Deferred to Sprint 3.5

- **Lens renderer extension points:** the Nodes detail pane, for example, currently shows only core fields. Sprint 3.5 introduces the plugin host API so `research` and `security-audit` lenses can contribute extra detail panels (e.g. a Sources entry renders a "related papers" strip, a Run renders a SARIF violation count). Core is intentionally lens-opaque for now.
- **Cross-tab filters and saved views:** every tab is stateless beyond its path. Sprint 4 or later pulls these behaviors in if plugin contributions need them.
- **Monitors data source:** remains blank in core; the scaffold is in place for plugin contributions.

### 17.6 Acceptance

Sprint 3 is considered complete when:

- `bun run typecheck` passes across all 8 workspace packages
- All six new routes mount their respective page component and render the list / detail / empty / loading layout
- `SessionShellBar` core tab chips deep-link to the new routes
- `DomainSidebarOverview` stat cards deep-link to the new routes (or Reviews for commits/pending)
- No write mutation is introduced at the tab level; every "Propose X" button routes to `/reviews` so the Sprint 2 proposal spine remains the only write path

## 18. Sprint 3.5 + 4 Outcome: Plugin Host API and Plugin Symmetry

Sprint 3.5 (plugin host API) and Sprint 4 (plugin symmetry) were executed as a single pass. Together they give every builtin plugin a stable contract for reaching the Palimpsest server without breaching the import-boundary rule that keeps `plugins/*` decoupled from `apps/server/src/*`.

Research business logic (`apps/server/src/research/*` and `apps/server/src/server/routes/research.ts`, ~4700 lines combined) was **not** moved in this pass because its Drizzle schema has foreign keys to host-owned tables (`project`, `session`) and the cross-package schema packaging story is not yet designed. That migration is the renamed **Sprint 4.5** below; it was originally scoped as the plugin host API step but the API is now done, so Sprint 4.5 becomes the research-code migration instead.

### 18.1 Plugin Host API Contract

New module `packages/plugin-sdk/src/host.ts` defines `PluginHostAPI`. The contract exposes exactly what a plugin needs from the host and nothing more:

- `log.create({ service })` → scoped logger auto-tagged with the plugin id
- `identifier.ascending(prefix, existing?) / identifier.slug()` → id minting
- `db.use(cb) / db.transaction(cb)` → Drizzle-compatible database access
- `bus.define / bus.publish / bus.subscribe / bus.subscribeAll` → BusEvent-compatible event channel
- `session.get(id)` → read a session by id
- `instance.directory() / instance.worktree() / instance.project()` → current project context
- `config.get()` → current config snapshot
- `actor.current()` → resolved caller actor or undefined

The contract is surfaced via `@palimpsest/plugin-sdk/host` subpath export. The loader implementation lives at `apps/server/src/plugin/host.ts` and delegates to the real server primitives (`Bus`, `Database`, `Log`, `Session`, `Instance`, `ControlPlane`, `Identifier`, `Config`, `Slug`).

### 18.2 Plugin Server Hook

`ProductPlugin.server?: PluginServerHook` is a new optional field on the product plugin definition. Signature:

```ts
type PluginServerHook = (input: { host: PluginHostAPI; pluginID: string }) =>
  Promise<{ dispose?: () => Promise<void> } | void>
```

`apps/server/src/plugin/product.ts` wires a per-instance `serverState` that iterates all registered plugins, calls `server({ host, pluginID })` for each, and records any returned handles for disposal. `InstanceBootstrap` now invokes `Product.init()` immediately after `Plugin.init()`, so plugin server hooks run once per instance boot.

### 18.3 Symmetric Builtin Plugins

All three builtin plugins now have the same on-disk shape and declare a `server` hook:

```
plugins/<id>/
  manifest.ts
  plugin.ts                  -> defineProductPlugin({ manifest, server, ... })
  server/
    index.ts                 -> legacy server metadata exports (prompts, workflows)
    server-hook.ts           -> PluginServerHook implementation using host API
  web/
    index.ts
```

- **core**: hook is a no-op log line. Exists purely for symmetry; core does not own plugin-specific background work.
- **research**: hook subscribes to `domain.proposal.committed` via `host.bus.subscribe` and logs research-relevant activity. This proves the API is usable — the plugin uses only `@palimpsest/plugin-sdk/host` and `zod`, no host imports.
- **security-audit**: hook is a no-op log line; structural parity with research, ready to carry rule-engine / scan adapter / findings ingestion work once Sprint 4.5 lands the data layer.

### 18.4 Import-Boundary Enforcement

`apps/server/test/plugin/import-boundary.test.ts` gains a second assertion: every `server-hook.ts` file under `plugins/` must contain an `import ... from "@palimpsest/plugin-sdk/host"`. Combined with the existing rule that blocks `@/...`, `@palimpsest/server/...`, `@palimpsest/web/...`, and relative `apps/*` paths, this closes the loop: plugins can only touch the host through the published contract.

### 18.5 Symmetry Test

New `apps/server/test/plugin/plugin-symmetry.test.ts` asserts:

- Every builtin plugin ships `manifest.ts`, `plugin.ts`, `server/server-hook.ts`, `server/index.ts`, and `web/index.ts`
- Every builtin plugin's default export has `manifest.id` matching its directory name
- Every builtin plugin declares `server: PluginServerHook`
- Every builtin plugin has at least one preset and one lens

All four assertions pass.

### 18.6 Deferred to Sprint 4.5 (renamed)

Sprint 4.5 now specifically tracks the deep research code migration. Items:

- Move `Research` namespace (`apps/server/src/research/research.ts`, 82 lines) into `plugins/research/server/` using the host API. Requires a strategy for exporting `ResearchProjectTable` across the host/plugin boundary.
- Move `experiment-*.ts` (4 files, ~721 lines combined) and the Scheduler integration into the research plugin, using host API for db/bus/log and accepting a new `host.scheduler` primitive if that stays the cleanest path.
- Shrink `apps/server/src/server/routes/research.ts` (3671 lines) by letting the research plugin register its own Hono routes via a `host.routes.register(app)` extension. This likely means adding `routes: Router` to the plugin host API in Sprint 4.5.
- Move `research.sql.ts` schema out of host once cross-package FK references are solved (candidate: expose `@palimpsest/domain/schema` with host tables as shared primitives, let plugins co-locate their own tables in `plugins/<id>/server/schema.sql.ts`).

### 18.7 Acceptance

Sprint 3.5 + 4 are considered complete when:

- `bun run typecheck` passes across all 8 workspace packages
- `bun test test/plugin` passes all suites (`import-boundary`, `plugin-symmetry`, plus existing `codex` and `auth-override`)
- Every builtin plugin exposes a `server` hook that runs once per instance boot and disposes on teardown
- No builtin plugin file imports from `@/...`, `@palimpsest/server/...`, `@palimpsest/web/...`, or relative `apps/*` paths
- At least one plugin (research) demonstrably uses the host API at runtime (subscribes to a bus event and logs through `host.log`)

## 19. Stage A Outcome: Filling the Sprint 2 / 3 Scaffolds

Stage A exists to turn the skeletons produced by Sprints 2 and 3 into real product surfaces. Before this stage, Reviews and the six new Core Tabs could typecheck and render an empty shell, but nothing had been exercised end-to-end, every detail pane dumped raw JSON, and Sources/Monitors were literal placeholder text. Stage A targets four threads: UI polish, data substance for Sources/Monitors, default routing, and e2e coverage.

### 19.1 UI Polish (A2)

**A2.1 Proposal changes become structured.** `apps/web/src/pages/reviews/change-view.tsx` replaces `<pre>{JSON.stringify(change)}</pre>` with a per-op renderer that prints a coloured action tag (Create / Update / Delete), entity label, key-value row list (id / kind / title / state / linked ids / mime / storage / note), and block sections for body, rationale, data, manifest, provenance, refs, actor. Cross-entity references (sourceID, targetID, nodeID, runID, artifactID, supersededBy) render as clickable deep links into the right tab. Reviews also gained `data-component` / `data-action` / `data-field` attributes throughout so e2e tests have stable selectors.

**A2.2 Decisions become a timeline.** The `EntityTab` scaffold now supports optional `groupItems(items)` grouping with sticky group headers, plus a shared `groupByTime` helper that buckets by Today / Yesterday / This week / Earlier. The Decisions page uses `groupByTime` for its list. The detail pane now renders a vertical **supersede chain** timeline that walks both directions of the `supersededBy` graph, highlights the currently-selected decision, and lets any node in the chain be navigated to. The raw "Supersedes" list and "Superseded by" card have been absorbed into the chain view.

**A2.3 Artifacts gain a MIME preview.** `apps/web/src/pages/artifacts/artifact-preview.tsx` is a new component that classifies the artifact's `mimeType` (text / json / image / binary / unknown) and renders accordingly: text and JSON are fetched via `sdk.client.file.read` and rendered in a pretty-printed pane, images render inline, unknown or binary show a URI hint. Missing storage URIs get their own "attach one in a follow-up proposal" card.

**A2.4 Nodes list groups by kind.** The Nodes page now groups items by their kind (claim / finding / question / source / …) with a sticky header above each group. Graph visualization is deferred to Stage B when the richer Node renderer extension points come online via the plugin host API.

All four polish threads carry new `data-component` / `data-entity` / `data-action` / `data-field` attributes throughout, enabling e2e selectors (A1).

### 19.2 Real Content for Sources and Monitors (A3)

**A3.1 Sources merges nodes and filesystem.** The Sources tab previously rendered only `kind=source` nodes. It now also scans `.palimpsest/sources/` via `sdk.client.file.list` and surfaces every file as an **unclaimed source**. The list is split into two sticky groups — "Accepted sources" (nodes) and "Unclaimed in `.palimpsest/sources`" (files) — and selecting a file opens a preview + "Propose as source" button that routes into the Reviews composer. Clicking the propose button jumps to `/reviews`; the hand-off to actual `create_node` with the file's content and path gets finalized in Stage B after we settle the file-attachment story in proposals.

**A3.2 Monitors becomes a live event log.** `monitors.tsx` subscribes to `domain.proposal.created / revised / reviewed / committed / withdrawn` via the web SDK event emitter (`sdk.event.on`). Incoming events are rendered into a reverse-chronological log capped at 50 entries, with a Pause / Resume toggle, a Clear action, and a status line (`Live · N events` or `Paused`). This is the first surface on the web that actually proves the Sprint 2 bus wiring publishes events the client can see, and it doubles as the Monitors tab's "no-plugin-yet" default content.

### 19.3 Default Landing Moves to Nodes (A4)

`/:dir/` previously redirected to `/:dir/session` (`SessionIndexRoute`). The spec has always been clear the shell is core-first, not session-first, so Stage A swaps to `DirectoryIndexRoute`, navigating to `/:dir/nodes`. Sessions remain reachable through explicit navigation. A richer project dashboard with activity + pending reviews + quick actions is an open idea for later polish, but the "domain-first" default is now honoured.

### 19.4 Playwright E2E Specs (A1)

Seven e2e spec files were written against the polished UI:

- `apps/web/e2e/reviews/reviews.spec.ts` — empty state; propose→autoApprove→commit→verify node in Nodes; propose→approve-as-reviewer→commit lands with resolved IDs; proposer withdraw flow
- `apps/web/e2e/tabs/nodes.spec.ts` — empty state; kind-grouped list renders; detail link
- `apps/web/e2e/tabs/runs.spec.ts` — empty state; autoApproved run with status tone
- `apps/web/e2e/tabs/artifacts.spec.ts` — empty state; preview panel renders regardless of storage URI
- `apps/web/e2e/tabs/decisions.spec.ts` — empty state; supersede chain walks both directions
- `apps/web/e2e/tabs/sources.spec.ts` — mixed feed renders accepted node + unclaimed filesystem file
- `apps/web/e2e/tabs/monitors.spec.ts` — empty state; log captures `domain.proposal.created` and `committed` after a ship-mode proposal

The fixtures in `apps/web/e2e/fixtures.ts` gained three helpers — `gotoPath`, `gotoTab`, `gotoReviews` — that handle the required `localStorage` seeding before navigating outside the session route. `apps/web/e2e/selectors.ts` centralizes Reviews, EntityTab, and Monitor selectors so specs stay insulated from markup drift.

**All 7 specs typecheck cleanly** (`cd apps/web/e2e && tsc --noEmit` passes). Running them via `bun test:e2e:local` hits a **pre-existing** infrastructure bug in `apps/web/script/e2e-local.ts` / `apps/server/src/storage/db.ts`: after `seed-e2e.ts` populates the sandbox DB, the main server process's first request triggers a second `migrate()` run that fails on `CREATE TABLE domain_commit` (FK resolution). The bug is fully reproducible against `origin/master` without any Stage A changes (verified by `git stash` bisect) and is orthogonal to this stage's scope. Fixing it is a dedicated Stage A.5 ticket — probably requires making `seed-e2e.ts` share the instance lifecycle with the server process rather than spawn/exit/respawn, or passing proper `hash` fields into drizzle's `migrate()`.

### 19.5 Deferred to Stage A.5

- Fix `e2e-local.ts` so Playwright specs actually execute locally (pre-existing bug)
- Wire the Sources "Propose as source" button to deep-link the composer with the file body pre-populated (requires file attachment in the composer)
- Expose `Source file` entries in the URL (`/:dir/sources/file/<path>`) so the source detail can be shared
- Node graph visualization (d3-force or reaflow) once the Stage B lens renderer extension points ship

### 19.6 Acceptance

Stage A is considered complete when:

- `bun run typecheck` passes across all 8 workspace packages
- `bun test test/domain test/server/domain.test.ts test/plugin` (32 cases) keeps passing
- `bun test:unit` (web) shows **no new regressions** beyond the 8 pre-existing failures on `dbcc706`
- Reviews changes render per-op, not raw JSON
- Decisions detail shows a supersede-chain timeline; list groups by time bucket
- Artifacts detail mounts an `artifact-preview` panel regardless of storage URI
- Nodes list groups by kind
- Sources tab merges `kind=source` nodes with `.palimpsest/sources/` files into two labelled groups
- Monitors tab subscribes to `domain.proposal.*` events and renders them in a live log (`Paused` / `Live · N events` status switch)
- `/:dir/` lands on `/:dir/nodes` instead of session
- Seven Playwright specs compile and cover the flows above; actual execution is blocked on the Stage A.5 infra fix

## 20. Stage B Outcome: Research Plugin Descends From the Host

Stage B opens by noting that Sprint 3.5 + 4 (the Plugin host API and plugin symmetry) produced a working API surface but **no real consumer**. The research plugin's `server(host)` hook in `dbcc706` was intentionally a one-line bus subscriber + logger; everything that makes Palimpsest a "research workbench" still lived at `apps/server/src/research/*`, `apps/server/src/server/routes/research.ts`, and `apps/server/src/tool/{atom,experiment,research-*,article,plan}*.ts` — ~9,350 lines of host-owned research code behind zero plugin ownership. Stage B's goal is to walk that code into `plugins/research/` while the host API grows to meet it.

The work is too big for one commit. It was shipped as a four-step sequence (`fe778f6`, `0544471`, `f9f02fb`, `282c9f5`) covering B1 (host-API expansion) + B2a-c (schema + watcher + business API migration), while B2d (routes) and B2e (tool/*) are parked as Stage B.5 because they need a much wider host API.

### 20.1 B1 — Plugin Host API Expansion

Three new capabilities on `PluginHostAPI`:

- **`host.routes.register(subApp: Hono)`** — plugins hand over a Hono sub-app. The host records it in `routes: Map<pluginID, Hono[]>` and a `/api/plugin/:pluginID/*` middleware in `Server.App()` dispatches any incoming request through every registered sub-app. The namespace is closed: unknown plugins return 404 rather than sinking into the web catch-all proxy. Middleware runs after the workspace/auth chain, so plugin routes get full `ControlPlane`/`Instance` context for free.
- **`host.scheduler.register(task)`** — thin wrapper around `Scheduler.register` that auto-prefixes task ids with `<pluginID>:` and keeps the instance/global scope semantics.
- **`host.filesystem`** — `exists / readText / readJson / write / writeJson / mkdirp`, enough for a plugin to persist artifacts and read its own worktree state without importing `fs/promises` or the host's internal `Filesystem` util.

Plugin-sdk side:
- `packages/plugin-sdk/src/host.ts` gains `routes / scheduler / filesystem` blocks + a `peerDependencies: { hono }` so plugins can `import type { Hono }` without bundling the package.
- Research plugin's server hook now exercises every new primitive: subscribes to `domain.proposal.committed`, registers a 60-second heartbeat via `host.scheduler`, and mounts a `/ping / /status` Hono sub-app via `host.routes.register`. A new `apps/server/test/plugin/host-api.test.ts` end-to-end round-trips all three through `Server.App().request(...)` — it exercises the production path, not a mock.

### 20.2 B2a — Schema moved into the plugin

`apps/server/src/research/research.sql.ts` (237 lines, 9 tables + `remote_server`) moves to `plugins/research/server/research-schema.ts`. Table shapes and index names are byte-identical, so drizzle-kit's snapshot tracks unchanged:

```
$ bun run db check
Everything's fine 🐶🔥
```

Cross-boundary foreign keys to host-owned tables (`project_id → Project`, `session_id → Session`) become plain `text()` columns — they lose their `onDelete` cascade, and the plugin will subscribe to the domain bus to clean up its own rows when the proposer deletes a project. Intra-plugin FKs (`experiment → research_project`, `atom → research_project`, `atom_relation → atom`, `watch → experiment`, etc.) keep their `.references()` since both sides are plugin-owned.

Drizzle config:
- `schema` glob widens from `./src/**/*.sql.ts` to `["./src/**/*.sql.ts", "../../plugins/**/server/*-schema.ts"]`. The `*-schema.ts` suffix is deliberate so drizzle-kit doesn't accidentally ingest non-schema plugin modules.
- `apps/server/src/research/research.sql.ts` becomes a thin `export { … } from "@palimpsest/plugin-research/server/research-schema"` re-export shim so every host-side caller (experiment-*.ts, routes/research.ts, tool/*) keeps compiling without touching import paths.

### 20.3 B2b-c — Watchers + Remote-Task migrate with late-bound host bridge

Four tightly-coupled modules (721 lines total) move together because they import each other:

- `plugins/research/server/experiment-execution-watch.ts`
- `plugins/research/server/experiment-remote-task.ts`
- `plugins/research/server/experiment-remote-task-watcher.ts`
- `plugins/research/server/experiment-watcher.ts`

These modules keep their top-level `namespace ExperimentX { export function … }` shape (so every host caller keeps its import path) but every internal `Database.use(...)`, `Log.create(...)`, `Scheduler.register(...)`, `Filesystem.write(...)` call is rewritten to `bridge().db.use(...)`, `bridge().log.create(...)`, `bridge().scheduler.register(...)`, `bridge().filesystem.write(...)`.

`plugins/research/server/host-bridge.ts` provides the late binding — a single `PluginHostAPI` reference, set once by `server-hook.ts` on every instance boot via `bindHost(host)`. `apps/server/src/research/research-plugin-bind.ts` is a side-effect-import shim that also calls `bindHost` (via `createPluginHost("research")`) on first `@/research/*` import, so tests that import the plugin's business modules directly (before `InstanceBootstrap` runs) still get a functioning bridge. `bindHost` is idempotent.

`apps/server/src/research/experiment-*.ts` files become `import "./research-plugin-bind"` + re-export shims pointing at their plugin counterparts.

Type-level fixes that fell out:
- `experiment-remote-task-watcher.ts` "stopped-beyond-grace" branch rewritten to narrow `stopAt` into `number` (pre-existing strict-null-check trap exposed once the file moved out from under the host tsconfig's cache).
- `experiment-remote-task.ts` `listByExp / listActive / latest` got explicit `Row = $inferSelect` return types because `bridge().db.use(...)` must stay generic for plugin-API contract and loses concrete drizzle return type inference.

### 20.4 B2a-extension — research.ts business API moves too

The 82-line `Research` namespace (`getParentSessionId`, `getResearchProjectId`, `getResearchProject`, `updateBackgroundPath/GoalPath/MacroTablePath`, `Event.AtomsUpdated`) moves to `plugins/research/server/research.ts`. The bus-event registry uses a getter that lazy-defines and caches `Research.Event.AtomsUpdated` through `host.bus.define("research.atoms.updated", schema)`; subsequent accesses from the 12 `Bus.publish(Research.Event.AtomsUpdated, …)` call sites in `routes/research.ts` + `tool/atom.ts` reuse the same stable handle. `initResearchEvents()` is also exported so the server-hook / bind-shim can warm the cache eagerly if they want to.

`apps/server/src/research/research.ts` becomes the same `import "./research-plugin-bind" + re-export` shim pattern.

### 20.5 Deferred to Stage B.5 — routes/research.ts and tool/*.ts

These two are left standing on purpose. Moving them surfaces host primitives that haven't been abstracted yet:

**`apps/server/src/server/routes/research.ts` (3,671 lines)** reaches into:
- `git` (`@/util/git`) — plugin host API has no `git` yet
- `Snapshot` (`@/snapshot`)
- `Project` + `ProjectPaths` (`@/project/*`) — partially covered by `host.instance.project()` but not worktree path math
- `Vcs` (`@/project/vcs`)
- `ensureGitignore / GIT_ENV / gitErr / ensureRepoInitialized / checkExperimentReadyByExpId` from `@/session/experiment-guard`
- `computeExperimentDiff` from `@/util/git-diff`
- `ZipReader / ZipWriter / BlobReader / BlobWriter` (ok, those are npm deps)

The routes are also currently **zombie** — `ResearchRoutes` is defined but not `.route()`-mounted in `Server.App()`, so migrating it is a net-new product feature, not a refactor. Not shipping this pair without a clear sponsor.

**`apps/server/src/tool/{atom,atom-graph-prompt,atom-graph-prompt-smart,article,experiment,experiment-query,experiment-watch,experiment-execution-watch,experiment-remote-task,plan,research-background,research-info}.ts` (~5,000 lines across 20 files)** use the host-internal `Tool.Info` / `Tool` base type from `@/tool/tool.ts`, not the plugin-sdk `ToolDefinition`. ToolRegistry (`@/tool/registry.ts`) hard-imports each one and includes them in `ToolRegistry.all()`. Migrating them would need:
- Either a `host.tools.register(tool)` API so plugins can self-register into the registry
- Or a unified `ToolDefinition` base that works on both sides (host + plugin)
- Every tool rewritten to go through `bridge()` for its internal DB / Session / Log / Filesystem / git access

Both of those are one-stage investments and deserve their own commit sequence.

### 20.6 Stage B.5 Backlog

Carried forward explicitly so the status is legible:

1. **`host.git`** — thin wrapper around `@/util/git` (init, commit, branch, current, diff, status)
2. **`host.snapshot`** — snapshot create / restore / list
3. **`host.project`** — project resolve / paths / worktree math (right now `host.instance` only exposes id/worktree/name)
4. **`host.tools.register(tool: ToolDefinition)`** — let plugin server-hooks register tools that end up in ToolRegistry.all()
5. **`session/experiment-guard.ts` → `plugins/research/server/session-guard.ts`** — 100 lines, once host.git + host.project are available
6. **`routes/research.ts` → `plugins/research/server/routes/*.ts`** — likely split into `research-project.ts`, `experiment.ts`, `atom.ts`, `article.ts`, `remote-task.ts`, `wandb.ts`, each ~300-700 lines
7. **`tool/{atom,experiment,research-*,article,plan}*.ts` → `plugins/research/server/tools/*.ts`** — 20 files via the tool-registry bridge above
8. **Delete `apps/server/src/research/` directory** — remove the bind shim + re-export files once nothing imports them
9. **Wire `ExperimentWatcher.init()` and `ExperimentRemoteTaskWatcher.init()`** into the server-hook — the Scheduler migration in B1 unblocks this, but turning them on today would start polling wandb from every developer's laptop. It's a product decision gated on Flag

### 20.7 Acceptance

Stage B (the shipped slice) is considered complete when:

- `bun run typecheck` passes across all 8 workspace packages
- `bun run db check` prints `Everything's fine 🐶🔥` (schema in plugin is identical to host's old snapshot)
- `bun test test/plugin` (21/21) passes, including the new `host-api.test.ts` that round-trips `/api/plugin/research/ping` + `/status` + 404 closure
- `bun test test/domain test/server/domain.test.ts` (12/12) passes
- `bun test test/tool/experiment-remote-task-lifecycle.test.ts` shows exactly the same 1 pre-existing failure as on `fe778f6` (no new regressions caused by the migration)
- Every `plugins/research/server/*.ts` file goes through `bridge()` for host access — no `@/...` or `@palimpsest/server/...` imports (verified by the existing import-boundary test, which passes)
- Schema, experiment watchers + remote-task + watcher, research business API all live in `plugins/research/server/*` and the host directory is a thin shim layer
- Section 20.6 is populated with a concrete Stage B.5 plan so the remaining 3,671 + 5,000 lines of host-side research code have a named owner and scope
