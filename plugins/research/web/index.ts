export { buildResearchIdeaPrompt, RESEARCH_AGENT_MENTIONS, RESEARCH_IDEA_ACTION } from "./prompt-actions"

export const web = {
  id: "research.web",
  description: "Research web ownership for preset forms, research tabs, and evidence-focused panels.",
  workspaceTabs: ["research", "literature"],
  actions: ["ask", "propose", "run"],
  pages: {
    research: "@palimpsest/plugin-research/web/pages/research",
    literature: "@palimpsest/plugin-research/web/pages/literature",
  },
}
