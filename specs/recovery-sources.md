# Recovery Sources

This document records what we were able to recover after the repository fell back to an older snapshot.

Its purpose is to distinguish:

- reliable recovery sources
- partial recovery sources
- sources that did **not** contain usable code snapshots

## Primary Recovery Sources

### 1. `record.txt`（Deleted）

The repository-local `record.txt` preserved a large amount of the product and architecture discussion.

This was the clearest source for:

- product intent
- architectural direction
- naming decisions
- rebuild priorities

### 2. `.codex` Session Transcript

The most valuable technical recovery source is:

- `/home/cheyanne/.codex/sessions/2026/04/19/rollout-2026-04-19T15-06-49-019da490-3bd5-7140-995f-78650b4f8a84.jsonl`

This transcript preserved much more than plain chat history. It contains:

- assistant milestone summaries
- exact commit commands
- many `git add` file lists
- command outputs
- late-stage debugging traces
- architectural clarifications made during implementation

This transcript is the reason we can reconstruct the lost refactor as a concrete plan instead of a vague memory.

### 3. `.codex/history.jsonl`

This was useful as a lighter-weight conversation history, but the full session transcript was more valuable.

### 4. Refreshed Reference Repositories

We refreshed the two upstream reference repos under:

- `/home/cheyanne/reference-repos/opencode`
- `/home/cheyanne/reference-repos/oh-my-openagent`

At the time of recovery:

- `opencode` was refreshed from `https://github.com/sst/opencode.git`
- `oh-my-openagent` was refreshed from `https://github.com/code-yeongyu/oh-my-openagent.git`

These repos are reference material only. They are not intended to become runtime dependencies again.

### 5. Recovery Environment Permissions

During the rebuild, elevated local development permissions were explicitly granted, including permission to use Docker commands when helpful.

This matters because it removes doubt around using containers for:

- Postgres evaluation
- local service dependencies
- migration rehearsal
- reproducible rebuild experiments

## Sources That Did Not Contain Recoverable Code

### 1. `.codex/shell_snapshots`

The shell snapshots that still existed under:

- `/home/cheyanne/.codex/shell_snapshots/`

turned out to be environment shell-state snapshots, not patch snapshots.

They preserved things like:

- environment variables
- shell setup
- path state

They did **not** preserve:

- repository diffs
- patch hunks
- restorable source files

### 2. `.codex` SQLite State

We attempted to inspect `.codex` sqlite stores, but the local environment did not have `sqlite3` available at the time.

More importantly, we already had enough evidence from the session transcript to conclude:

- design recovery was feasible
- full code recovery was still unlikely without a proper code snapshot

## What Could Be Recovered Reliably

From the transcript and record history, we could recover with high confidence:

- the target Palimpsest product identity
- the core domain model
- the async collaboration model
- the actor model
- the plugin/preset/lens architecture
- the de-OpenCode cleanup direction
- the product action model
- the major milestone order of the lost refactor

We could also recover many concrete implementation breadcrumbs:

- commit messages
- specific touched file sets
- migration order
- tests that had existed
- recurring late-stage bugs

## What Could Not Be Recovered Reliably

We did **not** recover a complete restorable code snapshot of the lost line.

Specifically, we did not find:

- a full patch bundle
- a hidden tarball/archive
- a directly replayable change stream
- a preserved alternate git branch in this repo state

That means the rebuild still needs to be treated as a reconstruction effort, not a simple restore operation.

However, the design and milestone history are now recoverable well enough that the rebuild can proceed with high confidence.

## Recovered Commit / Milestone Evidence

The session transcript preserved direct evidence for a number of milestone commits, including:

- `cfcf6dd` / “Refactor research core into generic domain”
- `2d714ce` / “Add builtin security audit plugin”
- `2613c8d` / “Make research writes domain-first”
- `0164fa4` / “Enforce taxonomy at domain runtime”
- `4952908` / “Move research routes into builtin plugin”
- `f1100f9` / “Add plugin-owned project presets and lenses”
- `cb4993a` / “Make app shell lens-driven”
- `3ba5405` / “Unify plugin sessions and product actions”
- `1cb5201` / “Move research workbench into plugin bundles”

This evidence is one of the reasons the rebuild docs can describe implementation direction with unusual specificity.

## Practical Rebuild Rule

Use the recovery sources in this order:

1. `specs/*` as the rebuilt target architecture
2. `record.txt` and `.codex` transcript as recovery evidence
3. reference repos under `/home/cheyanne/reference-repos/` for upstream comparison

Do **not** treat the old OpenCode or upstream harness repos as the target product shape.
