export const RESEARCH_AGENT_MENTIONS = [
  "research_project_init",
  "experiment_plan",
  "experiment_deploy",
  "experiment_local_download",
  "experiment_remote_download",
  "experiment_sync_resource",
  "experiment_setup_env",
  "experiment_run",
] as const

export const RESEARCH_IDEA_ACTION = {
  id: "add_new_idea",
  display: "add_new_idea",
  agent: "research_idea",
}

export function buildResearchIdeaPrompt(idea: string) {
  return [
    "Build a validation-oriented atom tree for the following research idea.",
    "",
    `Idea: ${idea}`,
    "",
    "The tree should consider whether this idea is related to existing atoms and should link conservatively when appropriate.",
    "If the idea extends an existing direction, treat it incrementally instead of rebuilding unrelated trees.",
  ].join("\n")
}
