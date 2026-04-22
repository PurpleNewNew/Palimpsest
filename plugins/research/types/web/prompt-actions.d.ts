export declare const RESEARCH_AGENT_MENTIONS: readonly ["research_project_init", "experiment_plan", "experiment_deploy", "experiment_local_download", "experiment_remote_download", "experiment_sync_resource", "experiment_setup_env", "experiment_run"];
export declare const RESEARCH_IDEA_ACTION: {
    id: string;
    display: string;
    agent: string;
};
export declare function buildResearchIdeaPrompt(idea: string): string;
