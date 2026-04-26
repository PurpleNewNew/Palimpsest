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
    atom_evidence_type: string;
    atom_evidence_status: string;
    atom_evidence_path: string | null;
    atom_evidence_assessment_path: string | null;
    article_id: string | null;
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
export type ResearchArticle = {
    article_id: string;
    filename: string;
    title: string | null;
};
export type ResearchCodePath = {
    name: string;
    path: string;
};
export type ResearchBranch = {
    branch: string;
    displayName: string;
    experimentId: string | null;
};
export type ResearchCode = {
    code_id: string;
    research_project_id: string;
    code_name: string;
    article_id: string | null;
    time_created: number;
    time_updated: number;
};
export type ResearchServerConfig = {
    mode: "direct";
    address: string;
    port: number;
    user: string;
    password?: string;
    resource_root?: string;
    wandb_api_key?: string;
    wandb_project_name?: string;
} | {
    mode: "ssh_config";
    host_alias: string;
    ssh_config_path?: string;
    user?: string;
    password?: string;
    resource_root?: string;
    wandb_api_key?: string;
    wandb_project_name?: string;
};
export type ResearchServer = {
    id: string;
    config: ResearchServerConfig;
    time_created: number;
    time_updated: number;
};
export type ResearchExperiment = {
    exp_id: string;
    research_project_id: string;
    exp_name: string;
    exp_session_id: string | null;
    baseline_branch_name: string | null;
    exp_branch_name: string | null;
    exp_result_path: string | null;
    atom_id: string | null;
    exp_result_summary_path: string | null;
    exp_plan_path: string | null;
    remote_server_id: string | null;
    remote_server_config: ResearchServerConfig | null;
    code_path: string;
    status: "pending" | "running" | "done" | "idle" | "failed";
    started_at: number | null;
    finished_at: number | null;
    time_created: number;
    time_updated: number;
};
export type ResearchExperimentSession = (ResearchExperiment & {
    atom: ResearchAtom | null;
    article: {
        article_id: string;
        research_project_id: string;
        path: string;
        title: string | null;
        source_url: string | null;
        status: "pending" | "parsed" | "failed";
        time_created: number;
        time_updated: number;
    } | null;
}) | null;
export type ResearchCommitDiff = {
    hash: string;
    message: string;
    author: string;
    date: string;
    diffs: unknown[];
};
export type ResearchWatch = {
    watch_id: string;
    kind: "experiment";
    exp_id: string;
    exp_session_id: string | null;
    exp_result_path: string | null;
    title: string;
    status: "pending" | "running" | "finished" | "failed" | "canceled";
    stage: "planning" | "coding" | "deploying_code" | "setting_up_env" | "remote_downloading" | "verifying_resources" | "running_experiment" | "watching_wandb";
    message: string | null;
    error_message: string | null;
    started_at: number | null;
    finished_at: number | null;
    time_created: number;
    time_updated: number;
    wandb_entity: string | null;
    wandb_project: string | null;
    wandb_run_id: string | null;
    remote_task_title: string | null;
    remote_task_kind: "resource_download" | "experiment_run" | null;
    remote_task_status: "pending" | "running" | "finished" | "failed" | "canceled" | null;
    remote_task_target_path: string | null;
    remote_task_screen_name: string | null;
    remote_task_log_path: string | null;
    remote_task_error_message: string | null;
};
export type ResearchAtomsListResponse = {
    atoms: ResearchAtom[];
    relations: ResearchRelation[];
};
export type ResearchSessionAtomGetResponse = {
    atom: (ResearchAtom & {
        experiments: ResearchExperiment[];
    }) | null;
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
        experiments: {
            list: (input: {
                atomId: string;
            }) => Promise<{
                data: {
                    experiments: ResearchExperiment[];
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
    article: {
        list: (input: {
            researchProjectId: string;
        }) => Promise<{
            data: ResearchArticle[];
        }>;
        create: (input: {
            researchProjectId: string;
            sourcePath: string;
            title?: string;
            sourceUrl?: string;
        }) => Promise<{
            data: {
                article_id: string;
                path: string;
                title: string | null;
                source_url: string | null;
            };
        }>;
    };
    session: {
        atom: {
            get: (input: {
                sessionId: string;
            }) => Promise<{
                data: ResearchSessionAtomGetResponse;
            }>;
        };
    };
    codePaths: () => Promise<{
        data: ResearchCodePath[];
    }>;
    branches: (input: {
        codePath: string;
    }) => Promise<{
        data: ResearchBranch[];
    }>;
    code: {
        list: (input: {
            researchProjectId: string;
        }) => Promise<{
            data: ResearchCode[];
        }>;
        get: (input: {
            codeId: string;
        }) => Promise<{
            data: ResearchCode;
        }>;
        delete: (input: {
            codeId: string;
        }) => Promise<{
            data: {
                success: boolean;
            };
        }>;
        create: (input: {
            researchProjectId: string;
            codeName: string;
            source: string;
            articleId?: string;
        }) => Promise<{
            data: ResearchCode;
        }>;
    };
    experiment: {
        create: (input: {
            atomId: string;
            expName: string;
            baselineBranch?: string;
            remoteServerId?: string;
            codePath: string;
        }) => Promise<{
            data: {
                exp_id: string;
                exp_name: string;
                atom_id: string;
                atom_name: string;
                session_id: string;
                baseline_branch: string;
                exp_branch: string;
                exp_result_path: string;
                exp_result_summary_path: string;
                remote_server_config: ResearchServerConfig | null;
            };
        }>;
        session: {
            create: (input: {
                expId: string;
            }) => Promise<{
                data: {
                    session_id: string;
                    created: boolean;
                };
            }>;
        };
        ready: (input: {
            expId: string;
        }) => Promise<{
            data: {
                ready: boolean;
                message?: string;
            };
        }>;
        bySession: (input: {
            sessionId: string;
        }) => Promise<{
            data: ResearchExperimentSession;
        }>;
        diff: (input: {
            expId: string;
        }) => Promise<{
            data: {
                commits: ResearchCommitDiff[];
            };
        }>;
        delete: (input: {
            expId: string;
        }) => Promise<{
            data: {
                success: boolean;
            };
        }>;
        update: (input: {
            expId: string;
            expName?: string;
            baselineBranch?: string;
            remoteServerId?: string | null;
            codePath?: string;
        }) => Promise<{
            data: ResearchExperiment;
        }>;
        runs: (input: {
            expId: string;
        }) => Promise<{
            data: {
                name: string;
                path: string;
                files: string[];
            }[];
        }>;
    };
    server: {
        list: () => Promise<{
            data: ResearchServer[];
        }>;
        create: (input: {
            config: ResearchServerConfig;
        }) => Promise<{
            data: {
                id: string;
                config: ResearchServerConfig;
            };
        }>;
        delete: (input: {
            serverId: string;
        }) => Promise<{
            data: {
                success: boolean;
            };
        }>;
    };
    experimentWatch: {
        list: () => Promise<{
            data: ResearchWatch[];
        }>;
        delete: (input: {
            watchId: string;
        }) => Promise<{
            data: {
                success: boolean;
            };
        }>;
        refresh: (input: {
            watchId: string;
        }) => Promise<{
            data: {
                success: boolean;
                message: string;
            };
        }>;
        refreshWandb: (input: {
            watchId: string;
        }) => Promise<{
            data: {
                success: boolean;
                message: string;
            };
        }>;
        refreshRemoteTask: (input: {
            watchId: string;
        }) => Promise<{
            data: {
                success: boolean;
                message: string;
            };
        }>;
        log: (input: {
            watchId: string;
        }) => Promise<{
            data: {
                ok: boolean;
                path: string;
                content: string;
            };
        }>;
    };
};
