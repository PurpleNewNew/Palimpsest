import type { Taxonomy } from "@palimpsest/plugin-sdk/web/graph-workbench";
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
export declare const SECURITY_TAXONOMY: Taxonomy;
