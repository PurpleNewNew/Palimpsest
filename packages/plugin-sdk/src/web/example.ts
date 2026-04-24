// Compile-time usage sample for `NodeAction<N>`. This file exists to
// keep the type surface exercised by `tsgo --noEmit` inside plugin-sdk
// itself, so regressions in the NodeAction contract (Decision 2 of the
// spec restructure, see `specs/graph-workbench-pattern.md`) surface as
// a typecheck failure in this package rather than only in downstream
// plugins.
//
// This sample is not exported from the package's `exports` map.

import type { NodeAction } from "./graph-workbench"

type SampleNode = {
  id: string
  kind: "atom" | "finding" | "control"
  title: string
  severity?: "low" | "medium" | "high"
}

// Minimum shape: id, label, handler.
const ask: NodeAction<SampleNode> = {
  id: "ask",
  label: "Ask",
  handler: async (node) => {
    // `node` is typed as SampleNode.
    void node.id
    void node.kind
  },
}

// With all optional fields: icon, enabled (per-node gate),
// requires (keyof PluginCapabilities).
const run: NodeAction<SampleNode> = {
  id: "run",
  label: "Run",
  icon: "play",
  enabled: (node) => node.kind === "finding" || node.kind === "atom",
  requires: "canRun",
  handler: async () => undefined,
}

// Lens-specific id string (non product-level verb) is allowed.
const markFalsePositive: NodeAction<SampleNode> = {
  id: "mark-false-positive",
  label: "Mark false positive",
  icon: "x-circle",
  requires: "canReview",
  enabled: (node) => node.kind === "finding",
  handler: () => {
    // synchronous handler is allowed.
  },
}

// Array of NodeAction<N> is the shape the graph workbench primitive
// expects on its `nodeActions` prop.
export const sampleNodeActions: Array<NodeAction<SampleNode>> = [ask, run, markFalsePositive]

// Negative assertion: `requires` must be a key of PluginCapabilities.
// The `requires` line intentionally uses an invalid key to lock the
// contract. If PluginCapabilities loses a flag or gains a non-boolean
// field, this file stops type-checking and the contract is rebroken in
// the open.
const invalidRequires: NodeAction<SampleNode> = {
  id: "bogus",
  label: "Bogus",
  // @ts-expect-error requires must be keyof PluginCapabilities
  requires: "canTeleport",
  handler: () => undefined,
}
void invalidRequires
