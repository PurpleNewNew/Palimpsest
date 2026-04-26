import "@dschz/solid-flow/styles";
import type { ResearchAtomsListResponse } from "../research-sdk";
type Atom = ResearchAtomsListResponse["atoms"][number];
type Relation = ResearchAtomsListResponse["relations"][number];
type AtomKind = "fact" | "method" | "theorem" | "verification";
export declare function AtomDetailView(props: {
    atoms: Atom[];
    relations: Relation[];
    loading: boolean;
    error: boolean;
    focusAtomId?: string | null;
    onAtomClick: (atomId: string) => void;
    onAtomCreate: (input: {
        name: string;
        type: AtomKind;
    }) => Promise<Atom>;
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
    researchProjectId: string;
}): import("solid-js").JSX.Element;
export {};
