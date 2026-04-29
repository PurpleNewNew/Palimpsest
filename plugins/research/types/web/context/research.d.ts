export type ResearchProject = {
    research_project_id: string;
    project_id: string;
    background_path?: string | null;
    goal_path?: string | null;
    macro_table_path?: string | null;
    time_created?: number;
    time_updated?: number;
};
export type ResearchAtom = {
    atom_id: string;
    research_project_id: string;
    atom_name: string;
    atom_type: string;
    atom_claim_path: string | null;
    atom_evidence_status: string;
    atom_evidence_path: string | null;
    atom_evidence_assessment_path: string | null;
    source_id: string | null;
    session_id: string | null;
    time_created: number;
    time_updated: number;
};
export type ResearchSource = {
    source_id: string;
    filename: string;
    title: string | null;
};
export type ResearchRelation = {
    atom_id_source: string;
    atom_id_target: string;
    relation_type: string;
    note: string | null;
    time_created: number;
    time_updated: number;
};
type DomainProject = {
    id: string;
    name?: string;
    worktree: string;
};
export declare function useResearch(getDirectory?: () => string | undefined): {
    project: () => Promise<DomainProject>;
    researchProject(): Promise<ResearchProject>;
    atoms(researchProjectID: string): Promise<{
        atoms: ResearchAtom[];
        relations: ResearchRelation[];
    }>;
    sources(researchProjectID: string): Promise<ResearchSource[]>;
};
export {};
