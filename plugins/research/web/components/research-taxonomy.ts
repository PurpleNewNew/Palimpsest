import type { Taxonomy } from "@palimpsest/plugin-sdk/web/graph-workbench"

/**
 * Research lens taxonomy. The shape and colour vocabulary derive from
 * the OpenResearch V1.2 baseline (worktree `Palimpsest-baseline-053a2d39`,
 * tag V1.2, commit 053a2d3) graph view, but the node kinds and status
 * states have been de-ML'd into a generic research vocabulary in
 * Step 11 (B2). Edge kinds are unchanged.
 *
 * Node kinds: question / hypothesis / claim / finding / source.
 * Status states are generic: pending / in_progress / supported / refuted.
 * Both stroke (`color`) and chip background (`bg`) colors are kept so
 * the default tooltip renders status as a coloured chip like baseline.
 */
export const RESEARCH_TAXONOMY: Taxonomy = {
  nodeKinds: [
    { id: "question", label: "Question", color: "#60a5fa" },
    { id: "hypothesis", label: "Hypothesis", color: "#fbbf24" },
    { id: "claim", label: "Claim", color: "#f87171" },
    { id: "finding", label: "Finding", color: "#34d399" },
    { id: "source", label: "Source", color: "#94a3b8" },
  ],
  edgeKinds: [
    { id: "motivates", label: "Motivates", color: "#8b5cf6" },
    { id: "formalizes", label: "Formalizes", color: "#06b6d4" },
    { id: "derives", label: "Derives", color: "#f97316" },
    { id: "analyzes", label: "Analyzes", color: "#ec4899" },
    { id: "validates", label: "Validates", color: "#22c55e" },
    { id: "contradicts", label: "Contradicts", color: "#ef4444" },
    { id: "other", label: "Other", color: "#94a3b8" },
  ],
  statusStates: [
    { id: "pending", label: "Pending", color: "#64748b", bg: "rgba(100,116,139,0.15)" },
    { id: "in_progress", label: "In Progress", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
    { id: "supported", label: "Supported", color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
    { id: "refuted", label: "Refuted", color: "#f87171", bg: "rgba(248,113,113,0.15)" },
  ],
  legend: { nodeTitle: "ATOM TYPES", edgeTitle: "RELATIONS" },
}
