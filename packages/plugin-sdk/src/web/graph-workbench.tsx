import type { PluginCapabilities } from "../host-web"

/**
 * Entry in a lens's per-node action registry.
 *
 * Decision 2 of the spec restructure (see
 * `specs/graph-workbench-pattern.md`) replaces the old
 * `onNodeEnterWorkflow` callback with a `nodeActions: Array<NodeAction<N>>`
 * prop on `<NodeGraphWorkbench>`. The primitive renders each entry as a
 * button in the hover anchor toolbar (alongside the default add-edge /
 * delete / view-detail set) and, optionally, in the object workspace
 * right panel.
 *
 * Product-level verbs
 * (mirroring `@palimpsest/plugin-sdk/product` `ActionID`):
 *
 * - `"ask"`     — open a node-attached chat session
 * - `"run"`     — start a workflow run bound to this node
 * - `"propose"` — draft a change against the node (proposal-first)
 * - `"review"`  — review the latest proposal for this node
 * - `"inspect"` — inspect provenance / assets
 *
 * Lens-specific verbs are allowed as free-form string ids (for example
 * `"mark-false-positive"`, `"request-evidence"`, `"open-playbook"`).
 *
 * Gating:
 *
 * - `enabled(node)` — optional per-node gating (e.g., hide "run" on
 *   `control` nodes in security-audit).
 * - `requires` — optional capability gate; `keyof PluginCapabilities`
 *   ensures only valid boolean flags are accepted. The primitive hides
 *   an action whose corresponding flag is `false`. See
 *   `packages/plugin-sdk/src/host-web.ts` for the capability snapshot.
 *
 * The `handler` runs the action. Session creation, proposal drafting,
 * and all other domain side effects are lens concerns; the primitive
 * only supplies click wiring and capability gating.
 *
 * The `N` parameter is the lens's node type (for example research's
 * `ResearchAtom` or security-audit's `SecurityNode`), supplied by the
 * consumer of `<NodeGraphWorkbench>`.
 */
export type NodeAction<N> = {
  /**
   * Unique id for this action within the lens. Product-level verbs use
   * `"ask" | "propose" | "review" | "run" | "inspect"`; lens-specific
   * verbs (e.g., `"mark-false-positive"`) use any other string.
   */
  id: string
  /** Short label shown on the toolbar button. */
  label: string
  /** Optional Lucide icon name; defaults to a generic action icon. */
  icon?: string
  /** Runs when the user invokes this action against `node`. */
  handler: (node: N) => void | Promise<void>
  /**
   * Optional per-node gating. If provided and returns `false` for a
   * node, the action is hidden for that node. Useful for kind-scoped
   * verbs (e.g., only show `"run"` on `finding` nodes).
   */
  enabled?: (node: N) => boolean
  /**
   * Optional capability gate. If set and the corresponding
   * {@link PluginCapabilities} flag is `false`, the action is hidden
   * for every node regardless of `enabled`.
   *
   * Example:
   *
   * ```ts
   * { id: "run", label: "Run", handler, requires: "canRun" }
   * ```
   */
  requires?: keyof PluginCapabilities
}
