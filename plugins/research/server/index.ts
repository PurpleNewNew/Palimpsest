import PROMPT_RESEARCH from "../prompts/research.txt"
import PROMPT_RESEARCH_SOURCE_TREE_BUILD from "../prompts/research_source_tree_build.txt"
import PROMPT_RESEARCH_IDEA from "../prompts/research_idea.txt"
import PROMPT_RESEARCH_IDEA_TREE_BUILD from "../prompts/research_idea_tree_build.txt"
import PROMPT_RESEARCH_PROJECT_INIT from "../prompts/research_project_init.txt"
import PROMPT_RESEARCH_TREE_LINK from "../prompts/research_tree_link.txt"
import PROMPT_EXPERIMENT from "../prompts/experiment.txt"
import PROMPT_EXPERIMENT_COMMIT from "../prompts/experiment_commit.txt"
import PROMPT_EXPERIMENT_DEPLOY from "../prompts/experiment_deploy.txt"
import PROMPT_EXPERIMENT_PLAN from "../prompts/experiment_plan.txt"
import PROMPT_EXPERIMENT_REMOTE_DOWNLOAD from "../prompts/experiment_remote_download.txt"
import PROMPT_EXPERIMENT_RUN from "../prompts/experiment_run.txt"
import PROMPT_EXPERIMENT_SETUP_ENV from "../prompts/experiment_setup_env.txt"
import PROMPT_EXPERIMENT_SUCCESS from "../prompts/experiment_success.txt"
import PROMPT_EXPERIMENT_SUMMARY from "../prompts/experiment_summary.txt"
import PROMPT_EVIDENCE_ASSESSMENT from "../prompts/evidence_assessment.txt"
import PROMPT_ATOM_FORMULA_CLEANUP from "../prompts/atom_formula_cleanup.txt"
import { ResearchIdeaTreeWorkflowTemplate, ResearchIdeaTreeWorkflowTemplateDir } from "../workflows/research-idea-tree-v1"

export const ResearchPrompts = {
  research: PROMPT_RESEARCH,
  research_source_tree_build: PROMPT_RESEARCH_SOURCE_TREE_BUILD,
  research_idea: PROMPT_RESEARCH_IDEA,
  research_idea_tree_build: PROMPT_RESEARCH_IDEA_TREE_BUILD,
  research_project_init: PROMPT_RESEARCH_PROJECT_INIT,
  research_tree_link: PROMPT_RESEARCH_TREE_LINK,
  experiment: PROMPT_EXPERIMENT,
  experiment_commit: PROMPT_EXPERIMENT_COMMIT,
  experiment_deploy: PROMPT_EXPERIMENT_DEPLOY,
  experiment_plan: PROMPT_EXPERIMENT_PLAN,
  experiment_remote_download: PROMPT_EXPERIMENT_REMOTE_DOWNLOAD,
  experiment_run: PROMPT_EXPERIMENT_RUN,
  experiment_setup_env: PROMPT_EXPERIMENT_SETUP_ENV,
  experiment_success: PROMPT_EXPERIMENT_SUCCESS,
  experiment_summary: PROMPT_EXPERIMENT_SUMMARY,
  evidence_assessment: PROMPT_EVIDENCE_ASSESSMENT,
  atom_formula_cleanup: PROMPT_ATOM_FORMULA_CLEANUP,
} as const

export {
  PROMPT_RESEARCH,
  PROMPT_RESEARCH_SOURCE_TREE_BUILD,
  PROMPT_RESEARCH_IDEA,
  PROMPT_RESEARCH_IDEA_TREE_BUILD,
  PROMPT_RESEARCH_PROJECT_INIT,
  PROMPT_RESEARCH_TREE_LINK,
  PROMPT_EXPERIMENT,
  PROMPT_EXPERIMENT_COMMIT,
  PROMPT_EXPERIMENT_DEPLOY,
  PROMPT_EXPERIMENT_PLAN,
  PROMPT_EXPERIMENT_REMOTE_DOWNLOAD,
  PROMPT_EXPERIMENT_RUN,
  PROMPT_EXPERIMENT_SETUP_ENV,
  PROMPT_EXPERIMENT_SUCCESS,
  PROMPT_EXPERIMENT_SUMMARY,
  PROMPT_EVIDENCE_ASSESSMENT,
  PROMPT_ATOM_FORMULA_CLEANUP,
  ResearchIdeaTreeWorkflowTemplate,
  ResearchIdeaTreeWorkflowTemplateDir,
}

export const server = {
  id: "research.server",
  description: "Research server ownership for preset initialization, workbench prompts, routes, and workflow assets.",
  prompts: Object.keys(ResearchPrompts),
  workflows: [ResearchIdeaTreeWorkflowTemplate.id],
}
