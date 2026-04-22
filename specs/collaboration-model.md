# Collaboration Model

Palimpsest is designed around **async collaboration with durable provenance**.

The core collaboration path is:

**proposal -> review -> commit -> decision**

## Why Async

The product optimizes for:

- inspection
- reasoning history
- attribution
- approval
- replay/export

not for Google-Docs-style real-time shared editing.

## Actor Model

Every meaningful action should be attributable to:

- `user`
- `agent`
- `system`

Actor identity belongs on:

- proposals
- reviews
- commits
- runs
- decisions

Agent identity should remain explicit enough that a team can later ask:

- which agent proposed this
- which version was used
- who approved it
- which decision came out of it

## Proposal-first Change Model

Ordinary project mutations should not silently land as accepted state.

The expected path is:

1. create a proposal
2. review it
3. accept it into a commit
4. let resulting decisions, runs, and artifacts reflect that accepted state

This does not mean every tiny internal mutation must be manually reviewed, but
it does mean that the **default product-facing write path** should be
proposal-first.

## Review

Review is not a generic right-side panel anymore.

It should exist as:

- a project-level inbox and queue
- a full proposal review workspace
- a provenance bridge to resulting commits and decisions

### Current review queue expectations

Review queue metadata now belongs at the workspace level and may include:

- assignee
- assigned by
- priority
- due date
- SLA hours

This queue state is collaborative scheduling metadata layered onto proposals.

## Commit Timeline

Commits are the durable accepted-change timeline.

They should remain visible and navigable as the answer to:

- what landed
- when it landed
- who caused it to land
- what proposal and review chain led to it

## Decision Provenance

Decisions are not final labels detached from history.

A decision should be traceable to:

- the creating proposal
- the review chain
- the commit that applied it
- linked node/run/artifact context
- later supersession or update commits

This provenance should be visible in both UI and public share/export surfaces.

## Permissions v1

Current collaboration is based on workspace roles:

- `owner`
- `editor`
- `viewer`

The important behavioral split is:

- viewers may read
- editors may write/propose/review in normal project flows
- owners additionally manage membership and workspace administration

The exact product surface is still being cleaned up, but the collaboration model
assumes write gates are role-based and enforced on domain routes.

## Sharing

Sharing is moving from a session-centric model toward an object-centric one.

The intended collaboration surface is:

- share a node
- share a run
- share a proposal
- share a decision

with provenance and linked context visible on the public page.

Session sharing still exists for some older paths, but it should no longer be
the dominant share model.

## Export / Import

Export and import are part of the collaboration model because durable reasoning
assets must survive:

- project migration
- workspace movement
- later replay/review

The platform should export more than graph state. It should carry:

- proposals
- reviews
- commits
- decisions
- provenance links

## Success Condition

The collaboration model is healthy when a team can move from:

- idea
- to proposal
- to review
- to commit
- to decision
- to share/export

without losing who did what, why they did it, or what evidence existed at the
time.
