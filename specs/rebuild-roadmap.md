# Rebuild Roadmap

This roadmap captures the intended rebuild order after losing the refactor work.

The main rule is:

**Rebuild the spine first, then restore lenses.**

## Phase 0: Preserve the Architecture

Before rebuilding code, preserve the design.

Deliverables:

- this specs directory
- stable terminology
- agreed end-state
- recovery environment assumptions, including permission to use Docker where it reduces rebuild risk

## Phase 0.5: Remove the Old Product Shell

Before rebuilding too much behavior on top of the repo, remove the parts of the old product shell that no longer belong to Palimpsest.

See:

- [deopencode-cleanup.md](./deopencode-cleanup.md)
- [upstream-influences.md](./upstream-influences.md)

This phase exists to prevent rebuilding the new platform on top of the same old OpenCode-era assumptions.

## Phase 1: Rebuild the Core Domain Spine

Restore:

- workspace
- project
- node
- edge
- run
- artifact
- decision
- taxonomy

Goal:

The platform should be domain-core first again.

## Phase 2: Rebuild Async Collaboration

Restore:

- actor model
- proposal
- review
- commit
- proposal-first mutation flow

Goal:

The main write path should again be proposal -> review -> commit.

## Phase 3: Rebuild Platform Control Plane

Restore:

- local auth
- cookie session
- workspace membership
- roles
- invites
- shares
- audit context

Goal:

Palimpsest is again a workspace-scoped multi-user product.

## Phase 4: Rebuild the Unified Plugin System

Restore:

- plugin SDK
- preset contract
- lens contract
- action contract
- directoryized plugin loading

Goal:

One extension system, no dual plugin/extension structure.

## Phase 5: Rebuild the Product Shell

Restore:

- unified new project flow
- core tabs
- lens-driven UI shell
- generic session container
- product action surface

Goal:

The UI again reflects the new platform model rather than the legacy research-first shell.

## Phase 6: Restore Builtin Plugins

Restore the builtin plugins as proper bundles:

- core
- research
- security-audit

Order:

1. prompts / skills / resources
2. server logic
3. web contributions

Goal:

Research and security become equal plugin-owned product surfaces.

## Phase 7: Restore Product Experience

Refine:

- review inbox
- commit timeline
- decision provenance
- share experience
- export/import experience
- permissions v1

Goal:

The assetization model becomes obvious in the UI.

## Suggested Near-Term Execution Order

If rebuilding from the reverted repo, the recommended order is:

1. preserve specs
2. restore domain entities
3. restore proposal/review/commit
4. restore workspace/auth/permissions
5. restore plugin SDK and registry
6. restore lens-driven UI shell
7. restore research and security plugins
8. polish review/share/export

## Definition of “Back on Track”

We can consider the rebuild back on track when:

- projects are no longer research-first
- research and security are both plugins
- ordinary writes create proposals
- reviews create commits
- sessions attach to domain objects
- the UI uses the stable action model

## Definition of “Version 1 Candidate”

Palimpsest is close to a first serious release when:

- the core domain is stable
- the plugin system is singular and documented
- proposal/review/commit is the visible write model
- share/export preserve reasoning history
- at least research and security are fully plugin-owned
