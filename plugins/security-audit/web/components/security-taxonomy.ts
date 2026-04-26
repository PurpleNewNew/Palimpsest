import type { Taxonomy } from "@palimpsest/plugin-sdk/web/graph-workbench"

/**
 * Security audit lens taxonomy. Migrated from the hand-rolled SVG
 * canvas in `workbench.tsx` (NODE_COLORS / column layout / KIND_LABELS)
 * into the shape `<NodeGraphWorkbench>` consumes via `props.taxonomy`.
 *
 * Node kinds match the six security-audit atom types declared in
 * `plugin.ts:11` (target / surface / finding / control / assumption /
 * risk). Edge kinds match the seven relation types at `plugin.ts:12`.
 *
 * statusStates carries a minimal proposed / committed / rejected set
 * per spec `graph-workbench-pattern.md` Proposed vs Committed Nodes;
 * security-audit-v1 workflow output enters the graph as `proposed`
 * nodes (because the workflow calls the domain API with
 * `actor.type === "agent"`, which never auto-approves), and humans
 * promote them through the proposal review tray. The lens does not
 * yet wire `nodeAdapter.status()` to surface this distinction, so
 * the chip only renders when a node's adapter resolves a status id;
 * adding that wiring is a future cleanup once SecurityNode exposes
 * a `reviewState` field server-side.
 */
export const SECURITY_TAXONOMY: Taxonomy = {
  nodeKinds: [
    { id: "target", label: "Target", color: "#60a5fa" },
    { id: "surface", label: "Surface", color: "#22c55e" },
    { id: "finding", label: "Finding", color: "#f97316" },
    { id: "risk", label: "Risk", color: "#f43f5e" },
    { id: "control", label: "Control", color: "#a78bfa" },
    { id: "assumption", label: "Assumption", color: "#facc15" },
  ],
  edgeKinds: [
    { id: "affects", label: "Affects", color: "#f97316" },
    { id: "mitigates", label: "Mitigates", color: "#a78bfa" },
    { id: "depends_on", label: "Depends on", color: "#06b6d4" },
    { id: "verified_by", label: "Verified by", color: "#22c55e" },
    { id: "evidenced_by", label: "Evidenced by", color: "#10b981" },
    { id: "contradicts", label: "Contradicts", color: "#ef4444" },
    { id: "derived_from", label: "Derived from", color: "#94a3b8" },
  ],
  statusStates: [
    { id: "proposed", label: "Proposed", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
    { id: "committed", label: "Committed", color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
    { id: "rejected", label: "Rejected", color: "#94a3b8", bg: "rgba(148,163,184,0.15)" },
  ],
  legend: { nodeTitle: "AUDIT KINDS", edgeTitle: "RELATIONS" },
}
