/**
 * Research API client moved out of `apps/web/src/pages/session/research-legacy-sdk.ts`
 * (step 9b' file move). The plugin owns the research method surface;
 * the host shell at `apps/web/src/pages/session/research-legacy-sdk.ts`
 * remains as a thin shim that merges this with the host SDK so existing
 * `sdk.client.research.*` callsites keep working unchanged.
 *
 * Network calls go through the plugin web host bridge
 * (`pluginWebHostFetchJson`) which already handles directory + workspace
 * headers and JSON (de)serialization. The legacy `request` helper's
 * shape (`{ data: T }`) is preserved on the public surface so callers
 * do not need to refactor for unwrapping.
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
 * Returns the research API client. This is the moved counterpart of the
 * legacy `useResearchLegacySDK().client.research`. Callers can either
 * use this directly (`research.atoms.list({ ... })`) or stay on the
 * shim at `apps/web/src/pages/session/research-legacy-sdk.ts` which
 * preserves the `sdk.client.research.*` shape.
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
