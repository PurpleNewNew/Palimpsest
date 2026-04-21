import { defineProductPlugin } from "@opencode-ai/plugin/product"

import { manifest } from "./manifest"

export default defineProductPlugin({
  manifest,
  taxonomies: {
    "security-audit.core": {
      nodeKinds: ["target", "surface", "finding", "control"],
      edgeKinds: ["affects", "mitigates", "depends_on", "verified_by"],
      runKinds: ["scan", "audit", "validation"],
      artifactKinds: ["report", "evidence", "log", "patch"],
      decisionKinds: ["accept_risk", "mitigate_risk", "defer_risk"],
      decisionStates: ["accepted", "rejected", "pending"],
    },
  },
  presets: [
    {
      id: "security-audit.audit",
      pluginID: manifest.id,
      title: "Security Audit",
      description: "Create a security-focused project with audit tabs, actions, and structured scope notes.",
      icon: "shield",
      defaultTaxonomyID: "security-audit.core",
      defaultLensIDs: ["core.shell", "security-audit.workbench"],
      fields: [
        {
          id: "target",
          label: "Audit Target",
          type: "text",
          placeholder: "Service, repository, or component under review",
        },
        {
          id: "objective",
          label: "Audit Objective",
          type: "textarea",
          placeholder: "What risks or guarantees matter for this audit?",
        },
      ],
      defaults: {
        target: "",
        objective: "",
      },
      async create(input) {
        const { Filesystem } = await import("../../packages/opencode/src/util/filesystem")
        const lines = [
          "# Audit Scope",
          "",
          "## Target",
          "",
          input.values.target?.trim() || "TBD",
          "",
          "## Objective",
          "",
          input.values.objective?.trim() || "TBD",
          "",
        ]
        await Filesystem.write(`${input.directory}/.palimpsest/security-audit/scope.md`, lines.join("\n"))
      },
    },
  ],
  lenses: [
    {
      id: "security-audit.workbench",
      pluginID: manifest.id,
      title: "Security Workbench",
      description: "Security-specific tabs and action routing for audits and validation loops.",
      priority: 60,
      appliesToPresets: ["security-audit.audit"],
      appliesToTaxonomies: ["security-audit.core"],
      requiresCapabilities: ["security-audit"],
      workspaceTabs: [
        { id: "security", title: "Security", icon: "shield", priority: 65, kind: "lens" },
        { id: "findings", title: "Findings", icon: "alert-triangle", priority: 55, kind: "lens" },
      ],
      sessionTabs: [{ id: "audit-log", title: "Audit Log", icon: "clipboard-list", priority: 55, kind: "lens" }],
      actions: [
        {
          id: "review",
          title: "Review",
          description: "Review open findings, evidence, and proposed mitigations.",
          prompt: "Review the current audit findings, related evidence, and pending mitigations. Identify what is credible, what is risky, and what needs deeper validation.",
          icon: "git-pull-request",
          priority: 115,
        },
        {
          id: "run",
          title: "Run",
          description: "Plan the next audit run, scan, or validation pass.",
          prompt: "Plan the next security audit run for this project, including scope, evidence to collect, and the findings it should confirm or reject.",
          icon: "play",
          priority: 105,
        },
        {
          id: "inspect",
          title: "Inspect",
          description: "Inspect attack surface, mitigations, and accepted risk state.",
          prompt: "Inspect this audit project's current attack surface, findings, controls, and accepted risk state. Summarize the strongest signals and the biggest unknowns.",
          icon: "search",
          priority: 95,
        },
      ],
      configVersion: 1,
      pluginVersion: manifest.version,
    },
  ],
})
