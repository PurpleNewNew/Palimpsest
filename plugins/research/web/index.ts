export const web = {
  id: "research.web",
  description: "Research web ownership for preset forms, research tabs, and evidence-focused panels.",
  workspaceTabs: ["research", "literature"],
  sessionTabs: ["research-notes"],
  actions: ["ask", "propose", "run"],
  pages: {
    research: "@palimpsest/plugin-research/web/pages/research",
    literature: "@palimpsest/plugin-research/web/pages/literature",
  },
}
