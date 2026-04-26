import { type JSX } from "solid-js";
export type ResearchAtomKind = "fact" | "method" | "theorem" | "verification";
/**
 * Minimal shape of a research atom that this lens binding needs.
 * Matches the field-level subset of `ResearchAtomsListResponse["atoms"][number]`
 * in `apps/web/src/pages/session/research-legacy-sdk.ts` that the graph
 * workbench reads. Kept narrow so the host's legacy SDK changes do not
 * ripple into the plugin package.
 */
export type ResearchAtomShape = {
    atom_id: string;
    atom_name: string;
    atom_type: string;
    atom_evidence_status: string;
    atom_evidence_type: string;
};
export type ResearchRelationShape = {
    atom_id_source: string;
    atom_id_target: string;
    relation_type: string;
    note?: string | null;
};
export type AtomGraphViewProps = {
    atoms: ResearchAtomShape[];
    relations: ResearchRelationShape[];
    loading: boolean;
    error: boolean;
    onAtomClick: (atomId: string) => void;
    onAtomCreate: (input: {
        name: string;
        type: ResearchAtomKind;
    }) => Promise<ResearchAtomShape>;
    onAtomDelete: (atomId: string) => Promise<void>;
    onRelationCreate: (input: {
        sourceAtomId: string;
        targetAtomId: string;
        relationType: string;
    }) => Promise<void>;
    onRelationUpdate: (input: {
        sourceAtomId: string;
        targetAtomId: string;
        relationType: string;
        nextRelationType: string;
    }) => Promise<void>;
    onRelationDelete: (input: {
        sourceAtomId: string;
        targetAtomId: string;
        relationType: string;
    }) => Promise<void>;
    onAtomViewDetail?: (atomId: string) => void;
    researchProjectId: string;
};
/**
 * Research lens binding around the generic `<NodeGraphWorkbench>`.
 *
 * Maps the lens-shaped Atom / Relation field names to the primitive's
 * adapter contract via `NODE_ADAPTER` and `EDGE_ADAPTER`, supplies
 * `RESEARCH_TAXONOMY` for kind / status colors, and translates each
 * lens-flavored callback (onAtomCreate / onAtomDelete / onRelation*)
 * into the primitive's (onNodeCreate / onNodeDelete / onEdge*) shape.
 *
 * Plain node click is wired to `props.onAtomClick` and the consumer
 * (`apps/web/src/pages/session/atoms-tab.tsx`) is expected to make it
 * inspect-only (open detail view, no session-create) per
 * `specs/graph-workbench-pattern.md` Sessions ("Inspect does not
 * create sessions"). The anchor toolbar's view-detail button is also
 * routed to `props.onAtomViewDetail` for explicit inspect intent.
 *
 * Persistence is keyed by lensID="research" so a future security-audit
 * binding on the same project does not collide.
 */
export declare function AtomGraphView(props: AtomGraphViewProps): JSX.Element;
