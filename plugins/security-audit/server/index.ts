export const server = {
  id: "security-audit.server",
  description: "Security audit server ownership for preset initialization, workflow wiring, rules, and audit-specific routes.",
  resourcesDir: new URL("../resources/", import.meta.url).pathname,
  rulesDir: new URL("../rules/", import.meta.url).pathname,
  workflowsDir: new URL("../workflows/", import.meta.url).pathname,
}
