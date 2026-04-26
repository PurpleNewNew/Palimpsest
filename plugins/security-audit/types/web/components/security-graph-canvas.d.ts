import { type JSX } from "solid-js";
import type { SecurityEdge, SecurityNode } from "../context/security-audit";
/**
 * Security audit lens binding around the generic `<NodeGraphWorkbench>`.
 *
 * Replaces the hand-rolled SVG `GraphCanvas` in `workbench.tsx` with the
 * shared primitive driven by `SECURITY_TAXONOMY`, the security
 * `NodeAdapter` / `EdgeAdapter`, and a fixed column layout that
 * reproduces the baseline visual arrangement.
 *
 * No mutation callbacks are wired (no `onNodeCreate` / `onNodeDelete` /
 * `onEdgeCreate` / `onEdgeUpdate` / `onEdgeDelete`) — security-audit's
 * graph is workflow-driven; humans reach mutations through the proposal
 * review tray and per-node session, not by editing the graph directly.
 * Per the primitive's Capability-Driven UI, this means the right-click
 * create form, drag-to-connect, edge popover, and anchor delete /
 * add-edge buttons are all suppressed automatically.
 *
 * Plain click on a node calls `props.onSelect(node)`, which the
 * workbench wires to its detail panel / fullscreen overlay. The default
 * anchor toolbar shows only a single `view-detail` button (because that
 * is the only default action whose backing callback is supplied), and
 * it routes through the same `onNodeClick` handler.
 *
 * Persistence keys are scoped to `lensID="security-audit"` so a future
 * research lens on the same project does not collide.
 */
export declare function SecurityGraphCanvas(props: {
    nodes: SecurityNode[];
    edges: SecurityEdge[];
    projectID: string;
    onSelect: (node: SecurityNode) => void;
}): JSX.Element;
