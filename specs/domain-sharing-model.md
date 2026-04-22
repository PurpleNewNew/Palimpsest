# Domain Sharing Model

Palimpsest sharing is moving from older session-centric public URLs toward
domain-object sharing.

## Core Principle

The thing worth sharing publicly is often not "a chat session."

It is more often:

- a node
- a run
- a proposal
- a decision

with provenance and linked context.

## Current Share Kinds

The system currently supports workspace shares for:

- session
- node
- run
- proposal
- decision

This is already enough to treat object sharing as a real product capability, not
just a future idea.

Public share pages now render object-specific workspaces for:

- node shares
- run shares
- proposal shares
- decision shares

## Why Object-centric Sharing Matters

Object-centric sharing better fits the product thesis:

- nodes represent durable reasoning units
- runs represent executed work
- proposals represent pending change
- decisions represent durable judgment

Those are the real assets.

## Expected Public Share Shape

### Node share

Should show:

- node identity
- graph context
- linked proposals
- linked runs
- linked artifacts
- linked decisions

### Run share

Should show:

- run status and manifest
- linked node
- produced artifacts
- related proposals and decisions

### Proposal share

Should show:

- rationale
- changes
- affected objects
- review history
- resulting commit if any

### Decision share

Should show:

- rationale
- provenance chain
- linked node/run/artifact
- supersession history

## Relationship to Session Sharing

Session sharing still exists and remains useful for some flows.

Its role is now explicitly archival:

- transcript history
- compatibility links
- lightweight session replay

The public wording should treat these as session archives rather than as the
canonical sharing model.

But the long-term product center of gravity should be:

- object-first sharing
- provenance-first sharing
- decision-first sharing

not generic session transcripts.

## Remaining Gap

The remaining product gap is not the absence of object shares.

It is mostly:

- continuing to make public share pages feel like object workspaces
- reducing old session-centric wording in surrounding product surfaces
- ensuring deep links and share entrypoints appear naturally in object
  workspaces, review surfaces, and provenance views
- continuing to move session-share language toward "archive" semantics in the
  remaining compatibility routes and helpers

## Success Condition

The sharing model is complete when a user naturally thinks:

- "share this node"
- "share this proposal"
- "share this decision"

before they think "share this session."
