# Rebuild Retrospective

> **DEPRECATED — scheduled for deletion.** Historical context only; not authoritative. Consult `git log` if you need the timeline. See `specs/README.md` for the restructure plan.

> Historical archive: this retrospective captures lessons from the rebuild
> phase. It remains useful for engineering judgment, but it no longer defines
> the current product state by itself.

This document records what we would do differently if we were rebuilding Palimpsest from scratch again.

It is not a rejection of the recovered architecture. In fact, most of the recovered end-state still looks right.

The point of this retrospective is narrower:

- identify where we lost time
- identify where complexity arrived too early
- identify where we should have cut harder
- identify where better sequencing would have reduced rework

## Executive Summary

If we were doing this again, the biggest improvement would **not** be “choose a radically different framework.”

The biggest improvement would be:

- kill the old shell earlier
- establish the domain and proposal-first write model earlier
- delay plugin-system freedom until the builtin plugins are clean
- make the UI and the domain speak the same language from the start

The main pain was not that we lacked a better library. The main pain was that:

- the OpenCode-era shell survived too long
- research remained privileged too long
- plugin boundaries arrived logically before they arrived physically
- UI shell and domain model did not converge early enough

## What Still Looks Correct

These decisions still look right and should remain the baseline for a rebuild:

- `Palimpsest turns reasoning into assets`
- Web-only
- Linux server first
- multi-user workspace model
- domain-first core:
  - `workspace / project / node / run / artifact / decision / proposal / review / commit`
- async collaboration
- proposal-first write model
- actor model:
  - `user / agent / system`
- `research` and `security-audit` as equal builtin plugins/lenses
- one extension system only:
  - `plugin`
- product action language:
  - `Ask / Propose / Review / Run / Inspect`

These are not the parts we would rethink.

## What We Would Change Earlier

### 1. Kill the Old Product Shell Earlier

If we were doing this again, we would cut these things much earlier:

- desktop product line
- TUI as a first-class product surface
- research-first project creation
- build/plan style top-level modes
- leftover OpenCode product language

The earlier this gets cut, the less confusion leaks into:

- navigation
- naming
- plugin boundaries
- onboarding

The major lesson is:

**Old product surfaces are not neutral.**

They actively distort the shape of the new architecture if left in place too long.

### 2. Build Domain + Proposal-First Before Rich Product Surfaces

The real foundation was always:

- domain model
- taxonomy
- actor model
- proposal / review / commit
- permission v1

If we were sequencing from scratch again, we would push those to the very front.

We would delay:

- rich graph workbench polish
- session-specific specialized shells
- plugin-rich UI contributions

until the domain-first write path was already stable.

The reason is simple:

Once the write model is wrong, every UI layer built on top of it gets reworked later.

### 3. Make Sessions Domain-Attached From Day 1

We learned this the hard way.

The correct shape is:

- a session is a general container
- it may attach to:
  - `project`
  - `node`
  - `run`
  - `proposal`
  - `decision`
- lens logic decides how to interpret those attachments

What we would avoid rebuilding first:

- atom session
- experiment session
- research main session

These may feel convenient early, but they become structural debt.

### 4. Product Actions Should Have Been Frozen Earlier

We eventually converged on:

- Ask
- Propose
- Review
- Run
- Inspect

If we were doing it again, we would lock that product language earlier and refuse to let internal agent names leak into the UI.

We would not let users see internal runtime names like:

- `build`
- `plan`
- `experiment_plan`
- `research_project_init`

Those are implementation details, not product primitives.

### 5. Freeze the Plugin Boundaries Earlier

The plugin direction was correct, but the freedom level was too open too early.

If rebuilding again, we would start with a narrower plugin contract:

- preset
- lens tabs / renderers
- actions
- server hooks

We would **not** start by optimizing for a very general external plugin ecosystem.

Instead we would:

1. make builtin plugins real
2. make plugin boundaries physically obvious
3. only then open the system outward

This would reduce early cognitive load and lower the cost of migration.

### 6. Physical Directory Ownership Should Have Happened Earlier

A major source of friction was that plugin boundaries became conceptually correct before they became physically real.

That meant:

- research logic scattered across app/server/plugin bridges
- security logic partly plugin-owned, partly core-owned
- lots of bridge re-exports lasting too long

If we were doing it again, we would establish a harder directory structure earlier:

```txt
apps/
  web/
  server/

packages/
  domain/
  sdk/
  plugin-sdk/
  ui/
  shared/

plugins/
  core/
  research/
  security-audit/
```

Then we would force all lens-owned logic to move into those directories quickly.

### 7. RFCs Should Have Started Earlier

This project crossed the “needs governance” threshold before we treated it that way.

If rebuilding again, we would write RFCs earlier for:

- collaboration model
- actor model
- domain model
- plugin system
- UI product model

We would also explicitly introduce “freeze” windows:

- no new concepts
- only convergence
- only reduction of inconsistency

That would have cut down on drift.

## Technology Stack Retrospective

### Postgres vs SQLite

If Palimpsest is truly a multi-user collaborative platform, Postgres looks like the better long-term database choice.

SQLite is still attractive for:

- early self-hosted velocity
- local development simplicity
- reduced operational burden

But the platform’s actual center of gravity is:

- workspace membership
- proposal/review/commit history
- append-only audit trails
- multiple concurrent actors

That leans strongly toward Postgres.

If we were rebuilding again, we would seriously consider:

- Postgres as the main database
- storage interfaces kept clean enough that local/dev modes still remain ergonomic

### Prisma vs SQL-First ORM

We would be cautious about centering the system on Prisma.

Prisma is attractive for:

- straightforward CRUD
- fast onboarding
- common web-app schema flows

But Palimpsest is not just a CRUD business app.

It has:

- graph-like relationships
- timeline queries
- append-only history
- plugin-owned semantics
- provenance-heavy reads

That suggests the system benefits more from:

- SQL-first query control
- explicit migrations
- a thinner abstraction

If rebuilding again, we would likely prefer:

- Postgres
- Drizzle or Kysely
- direct SQL where it helps clarity

instead of making Prisma the architectural center.

### Effect

Effect looks useful, but only in the right places.

We would **not** make Palimpsest fully Effect-first.

Why:

- plugin authors should not have to learn Effect just to participate
- most UI and CRUD paths do not benefit enough from the extra abstraction
- the main earlier problem was architecture shape, not missing effect management

Where Effect could be worth using:

- worker / queue / background tasks
- run orchestration
- retry / timeout / fallback chains
- doctor / recovery logic
- long-lived resource lifecycle handling
- more complex harness logic

So if rebuilding again, the likely stance would be:

- keep the public plugin and route surfaces plain TypeScript + Zod
- use Effect selectively in the server workflow/worker/harness layer

### Frontend Framework

Solid was not the root problem.

The bigger issues were:

- shell architecture
- privilege drift
- product language drift

So we would not automatically rewrite the app just to change frameworks.

However, if the long-term goal includes:

- a broader external plugin ecosystem
- more contributors
- richer integration surfaces

then React would deserve a strategic reconsideration purely on ecosystem grounds.

This is not a “must change,” but it is a legitimate question for v2.

### Bun

Bun gave useful speed, but it also introduced tooling edges.

If rebuilding again, we would explicitly evaluate:

- Bun for runtime only
- or a more conservative Node + pnpm baseline

This is not the first thing we would change, but it is worth deciding deliberately rather than inheriting by momentum.

## Code and Repo Discipline Lessons

### 1. Bridge Layers Need an Expiration Date

Temporary bridge re-exports were often necessary.

But if we rebuild again, every bridge needs:

- an explicit migration purpose
- an expected removal phase

Otherwise they become invisible permanent architecture.

### 2. Giant Files Should Be Split Earlier

When giant files survive too long, they hide:

- mixed concerns
- old world assumptions
- implicit product decisions

We would be more aggressive about splitting:

- session shell logic
- plugin routing
- lens-specific renderers
- create flows

### 3. Core Packages Must Stay Vocabulary-Clean

If a package is core, it should not casually accumulate:

- research terms
- security-specific semantics
- old OpenCode runtime assumptions

We would enforce that boundary harder.

### 4. Persisted Client State Needs More Discipline

Late-stage issues showed that stale local persisted state can poison:

- workspace selection
- project visibility
- lens requests
- session restoration

If rebuilding again, we would treat persisted local state as a compatibility boundary from the start, not a convenience detail.

## Complexity We Would Delay

If starting over, we would intentionally delay:

- highly dynamic external plugin packaging
- very free-form web contribution injection
- excessive preset/lens configurability
- overly fancy graph/session specialization
- harness sophistication beyond what the product can actually surface

The goal would be:

**make builtin plugins clean before making plugins powerful.**

## What We Would Keep Exactly As A Hard Lesson

There are a few lessons we would not soften:

### Keep PTY/Terminal

We explicitly concluded that PTY/Terminal still fits the platform.

It helps:

- runs
- debugging
- reproduction
- agent execution workflows

It should not be mistaken for the old IDE shell.

### Do Not Keep Two Extension Systems

One extension system only:

- `plugin`

Everything else:

- preset
- lens
- action

should be capability surfaces inside that system.

### Do Not Let Research Stay Privileged

This is probably the single most important product-boundary lesson.

Research can be important.
It can even be the best builtin lens.

But it cannot remain the hidden default product identity.

## Rebuild If We Had To Start Again Tomorrow

If we truly restarted tomorrow, the order would be:

1. de-OpenCode cleanup
2. domain model + taxonomy + actor + proposal/review/commit
3. workspace/auth/permission v1
4. minimal plugin SDK
5. core-first lens-driven shell
6. builtin `research` and `security-audit` plugins
7. stronger harness/workers/recovery layer
8. final product polish

That order optimizes for convergence and minimizes architectural churn.

## Final Takeaway

If we summarize the retrospective in one sentence:

The biggest missed opportunity was not failing to choose a more advanced framework. It was allowing old shells, temporary bridges, and privileged special cases to survive longer than the new architecture could tolerate.

If we rebuild with stricter boundaries and earlier convergence, the recovered Palimpsest design still looks strong.
