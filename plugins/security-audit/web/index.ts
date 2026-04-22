export const web = {
  id: "security-audit.web",
  description:
    "Security audit web ownership for security graph tabs, findings workbench, and decision-oriented audit panels.",
  workspaceTabs: ["security", "findings"],
  sessionTabs: ["audit-log"],
  actions: ["review", "run", "inspect"],
  pages: {
    security: "@palimpsest/plugin-security-audit/web/pages/security",
    findings: "@palimpsest/plugin-security-audit/web/pages/findings",
  },
}
