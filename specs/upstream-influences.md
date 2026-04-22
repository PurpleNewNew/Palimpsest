# Upstream Influences

> Reference archive: this document captures what Palimpsest intentionally
> absorbed from upstream projects and what it explicitly rejected. It remains a
> durable design reference, but it is not the main current-state spec.

Palimpsest is not meant to remain an OpenCode product line, but it also was **not** intended to ignore useful upstream ideas.

This document records what we explicitly wanted to absorb from:

- `OpenCode`
- `oh-my-openagent`

Reference clones for those repos are intentionally kept outside the product repo under:

- `/home/cheyanne/reference-repos/opencode`
- `/home/cheyanne/reference-repos/oh-my-openagent`

The rule is:

**absorb the capabilities, not the old product shape**

## Design Principle

We wanted Palimpsest to become its own system while still learning from upstream work.

That means:

- keep useful ideas
- internalize them
- rename and reshape them under Palimpsest
- avoid carrying old brands, old UX assumptions, or duplicate mechanisms forward

## What We Wanted From OpenCode

OpenCode had useful platform infrastructure we explicitly considered worth absorbing.

### 1. Control Plane Ideas

The most valuable OpenCode-style ideas were around a shared runtime that can manage:

- multiple projects
- multiple worktrees
- multiple sessions
- shareable session state

That fed directly into Palimpsest’s move toward:

- workspace teams
- multi-project collaboration
- session-backed workflows

### 2. Workspace / Share / Auth Foundations

We explicitly liked the direction of:

- workspace identity
- member and invite flows
- sharing infrastructure
- plugin-aware auth hooks

Those ideas fit Palimpsest’s collaborative platform direction.

### 3. Plugin Hooking Model

OpenCode’s plugin and hook structure helped validate that it was practical to let plugins influence:

- tools
- auth
- routing
- runtime behavior

But in Palimpsest, this needed to be unified into one plugin system and renamed around:

- plugin
- preset
- lens
- action

### 4. AGENTS.md as a Useful Convention

We explicitly wanted to keep `AGENTS.md` as a context-injection convention.

That file name was treated as useful and neutral enough to keep rather than rename.

## What We Did Not Want to Keep From OpenCode

We explicitly did **not** want to keep these OpenCode-era assumptions as part of Palimpsest’s final shape:

- desktop-first product packaging
- TUI as a first-class product surface
- build/plan style top-level mode language
- “research” being implemented as a special-case product on top of the old shell
- extension/plugin duplication
- broad multi-platform desktop obligations

We wanted the code, not the product shape.

## What We Wanted From oh-my-openagent

The main value we saw in `oh-my-openagent` was not branding or compatibility layers. It was the **agent harness discipline**.

### 1. Intent Gate

We liked the idea that not every input should blindly become the same kind of agent run.

This maps well to Palimpsest because:

- some inputs should become proposals
- some should become runs
- some should stay as ask/inspect operations

### 2. Planner / Orchestrator / Specialist Separation

We explicitly liked the separation between:

- planning
- orchestration
- specialist execution
- review / verification

This fits Palimpsest’s architecture much better than a single undifferentiated chat agent.

### 3. Category-Based Routing

We wanted the product to evolve toward routing by category rather than exposing internal agent names.

Examples of intended categories:

- research
- engineering
- security
- analysis
- writing
- quick
- deep

This is one of the reasons we wanted product actions to become:

- Ask
- Propose
- Review
- Run
- Inspect

### 4. Recovery / Doctor / Fallback

We explicitly discussed absorbing the stronger operational behavior from oh-my-openagent:

- session recovery
- doctor flows
- fallback chains
- more robust error recovery

These features matter because Palimpsest is supposed to be a durable system, not a brittle one-shot chat shell.

### 5. More Disciplined Agent Execution

The key lesson was:

Palimpsest should not be “a better prompt.”

It should be:

- a system where agents are first-class actors
- agent outputs are attributable
- proposal/review/commit boundaries are preserved
- important actions become durable system events

## What We Did Not Want to Keep From oh-my-openagent

We did **not** want to copy:

- its branding
- its compatibility-story identity
- its terminal-centric product assumptions
- any secondary ecosystem layer that would compete with Palimpsest’s own plugin system

Again, the intent was to absorb the capability pattern, not inherit a second product shell.

## How These Influences Were Supposed to Land in Palimpsest

### OpenCode Influence -> Platform Layer

OpenCode-inspired ideas were mostly supposed to land in:

- workspace/auth/share
- server runtime and project/session orchestration
- plugin hook surfaces

### oh-my-openagent Influence -> Agent Harness Layer

oh-my-openagent-inspired ideas were mostly supposed to land in:

- intent gate
- planner / orchestrator / specialist structure
- category routing
- doctor / recovery
- fallback handling
- stronger agent execution discipline

## The Synthesis

The intended Palimpsest synthesis was:

- take the useful collaborative/runtime spine from OpenCode
- take the useful execution discipline from oh-my-openagent
- rebuild both under a domain-first, proposal-first, plugin-first Palimpsest architecture

So the final system would be:

- not OpenCode
- not oh-my-openagent
- but informed by the strongest parts of each

## Rebuild Reminder

When rebuilding, do not collapse into either of these mistakes:

### Mistake 1

“Since we came from OpenCode, we should preserve its product surface.”

No. Preserve only the pieces that fit Palimpsest’s architecture.

### Mistake 2

“Since oh-my-openagent had a stronger harness, we should rebuild Palimpsest as an agent framework.”

Also no. The harness supports the platform. It does not replace the platform.

## Practical Takeaway

If we have to choose what to restore later, the priority is:

1. Palimpsest’s domain / collaboration / plugin spine
2. OpenCode-inspired control plane pieces that still help that spine
3. oh-my-openagent-inspired harness improvements that reinforce that spine

Not the other way around.
