import type { Taxonomy } from "@palimpsest/plugin-sdk/web/graph-workbench"

/**
 * Research lens taxonomy. Migrated 1:1 from the OpenResearch baseline
 * `apps/web/src/pages/session/atom-graph-view.tsx` constants
 * (TYPE_COLORS / TYPE_LABELS / RELATION_COLORS / RELATION_LABELS /
 * STATUS_COLORS / STATUS_DOT_BG / EVIDENCE_STATUS_LABELS) into the
 * shape `<NodeGraphWorkbench>` consumes via `props.taxonomy`.
 *
 * Node kinds match the four research atom types (fact / method /
 * theorem / verification). Edge kinds match the seven relation types.
 * Status states mirror evidence_status with both stroke (`color`) and
 * chip background (`bg`) colors so the default tooltip can render
 * status as a colored chip identical to baseline.
 */
export const RESEARCH_TAXONOMY: Taxonomy = {
  nodeKinds: [
    { id: "fact", label: "Fact", color: "#60a5fa" },
    { id: "method", label: "Method", color: "#34d399" },
    { id: "theorem", label: "Theorem", color: "#f87171" },
    { id: "verification", label: "Verification", color: "#fbbf24" },
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
    { id: "proven", label: "Proven", color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
    { id: "disproven", label: "Disproven", color: "#f87171", bg: "rgba(248,113,113,0.15)" },
  ],
  legend: { nodeTitle: "ATOM TYPES", edgeTitle: "RELATIONS" },
}
