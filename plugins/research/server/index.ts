import PROMPT_RESEARCH from "../prompts/research.txt"
import PROMPT_RESEARCH_SOURCE_TREE_BUILD from "../prompts/research_source_tree_build.txt"
import PROMPT_RESEARCH_IDEA from "../prompts/research_idea.txt"
import PROMPT_RESEARCH_IDEA_TREE_BUILD from "../prompts/research_idea_tree_build.txt"
import PROMPT_RESEARCH_PROJECT_INIT from "../prompts/research_project_init.txt"
import PROMPT_RESEARCH_TREE_LINK from "../prompts/research_tree_link.txt"
import { ResearchIdeaTreeWorkflowTemplate, ResearchIdeaTreeWorkflowTemplateDir } from "../workflows/research-idea-tree-v1"

export const ResearchPrompts = {
  research: PROMPT_RESEARCH,
  research_source_tree_build: PROMPT_RESEARCH_SOURCE_TREE_BUILD,
  research_idea: PROMPT_RESEARCH_IDEA,
  research_idea_tree_build: PROMPT_RESEARCH_IDEA_TREE_BUILD,
  research_project_init: PROMPT_RESEARCH_PROJECT_INIT,
  research_tree_link: PROMPT_RESEARCH_TREE_LINK,
} as const

export {
  PROMPT_RESEARCH,
  PROMPT_RESEARCH_SOURCE_TREE_BUILD,
  PROMPT_RESEARCH_IDEA,
  PROMPT_RESEARCH_IDEA_TREE_BUILD,
  PROMPT_RESEARCH_PROJECT_INIT,
  PROMPT_RESEARCH_TREE_LINK,
  ResearchIdeaTreeWorkflowTemplate,
  ResearchIdeaTreeWorkflowTemplateDir,
}

export const server = {
  id: "research.server",
  description: "Research server ownership for preset initialization, workbench prompts, routes, and workflow assets.",
  prompts: Object.keys(ResearchPrompts),
  workflows: [ResearchIdeaTreeWorkflowTemplate.id],
}
