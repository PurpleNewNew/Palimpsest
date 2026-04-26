import type { Taxonomy } from "@palimpsest/plugin-sdk/web/graph-workbench";
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
export declare const RESEARCH_TAXONOMY: Taxonomy;
