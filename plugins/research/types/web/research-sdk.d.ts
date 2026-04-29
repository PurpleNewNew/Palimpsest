/**
 * Research API client. The plugin owns the research method surface
 * end-to-end — callers reach this through `useResearchSDK()` and the
 * host does not re-export or merge it.
 *
 * Network calls go through the plugin web host bridge
 * (`pluginWebHostFetchJson`) which already handles directory + workspace
 * headers and JSON (de)serialization. Public method shape returns
 * `{ data: T }` envelopes so consumers can pattern-match results
 * uniformly.
 */
export type ResearchProject = {
    research_project_id: string;
    project_id: string;
    background_path: string | null;
    goal_path: string | null;
    macro_table_path: string | null;
    time_created: number;
    time_updated: number;
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
export type ResearchRelation = {
    atom_id_source: string;
    atom_id_target: string;
    relation_type: string;
    note: string | null;
    time_created: number;
    time_updated: number;
};
export type ResearchSource = {
    source_id: string;
    filename: string;
    title: string | null;
};
export type ResearchAtomsListResponse = {
    atoms: ResearchAtom[];
    relations: ResearchRelation[];
};
/**
 * Returns the research API client. Use directly:
 * `useResearchSDK().atoms.list({ ... })`.
 */
export declare function useResearchSDK(): {
    project: {
        get: (input: {
            projectId: string;
        }) => Promise<{
            data: ResearchProject;
        }>;
    };
    atoms: {
        list: (input: {
            researchProjectId: string;
        }) => Promise<{
            data: ResearchAtomsListResponse;
        }>;
    };
    atom: {
        create: (input: {
            researchProjectId: string;
            name: string;
            type: "fact" | "method" | "theorem" | "verification";
        }) => Promise<{
            data: ResearchAtom;
        }>;
        delete: (input: {
            researchProjectId: string;
            atomId: string;
        }) => Promise<{
            data: {
                atom_id: string;
                deleted: true;
            };
        }>;
        update: (input: {
            researchProjectId: string;
            atomId: string;
            evidence_status?: "pending" | "in_progress" | "proven" | "disproven";
            evidence_type?: "math" | "experiment";
        }) => Promise<{
            data: ResearchAtom;
        }>;
        session: {
            create: (input: {
                atomId: string;
            }) => Promise<{
                data: {
                    session_id: string;
                    created: boolean;
                };
            }>;
        };
    };
    relation: {
        create: (input: {
            researchProjectId: string;
            source_atom_id: string;
            target_atom_id: string;
            relation_type: string;
            note?: string;
        }) => Promise<{
            data: ResearchRelation;
        }>;
        update: (input: {
            researchProjectId: string;
            source_atom_id: string;
            target_atom_id: string;
            relation_type: string;
            next_relation_type: string;
        }) => Promise<{
            data: ResearchRelation;
        }>;
        delete: (input: {
            researchProjectId: string;
            source_atom_id: string;
            target_atom_id: string;
            relation_type: string;
        }) => Promise<{
            data: {
                source_atom_id: string;
                target_atom_id: string;
                relation_type: string;
                deleted: true;
            };
        }>;
    };
    source: {
        list: (input: {
            researchProjectId: string;
        }) => Promise<{
            data: ResearchSource[];
        }>;
        create: (input: {
            researchProjectId: string;
            sourcePath: string;
            title?: string;
            sourceUrl?: string;
        }) => Promise<{
            data: {
                source_id: string;
                path: string;
                title: string | null;
                source_url: string | null;
            };
        }>;
    };
};
