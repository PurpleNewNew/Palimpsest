import { defineProductPlugin } from "@palimpsest/plugin-sdk/product"

import { manifest } from "./manifest"
import { serverHook } from "./server/server-hook"

export default defineProductPlugin({
  manifest,
  server: serverHook,
  taxonomies: {
    "security-audit.core": {
      nodeKinds: ["target", "surface", "finding", "control", "assumption", "risk"],
      edgeKinds: ["affects", "mitigates", "depends_on", "verified_by", "evidenced_by", "contradicts", "derived_from"],
      runKinds: ["analysis", "audit", "validation", "triage"],
      artifactKinds: ["evidence", "note", "report", "log", "diff", "patch", "trace"],
      decisionKinds: ["accept_risk", "mitigate_risk", "false_positive", "needs_validation", "defer_risk"],
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
        {
          id: "constraints",
          label: "Constraints",
          type: "textarea",
          placeholder: "Critical assumptions, forbidden actions, or areas to avoid changing during the audit",
        },
      ],
      defaults: {
        target: "",
        objective: "",
        constraints: "",
      },
      async create(input) {
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
          "## Constraints",
          "",
          input.values.constraints?.trim() || "No explicit constraints recorded yet.",
          "",
          "## Human Review Policy",
          "",
          "- AI may map attack surface, generate finding hypotheses, gather evidence, and run validation loops.",
          "- Human reviewers remain the final authority for accepted risk, mitigation, and false-positive decisions.",
          "",
        ]
        await input.host.writeText(".palimpsest/security-audit/scope.md", lines.join("\n"))
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
      sessionTabs: [
        { id: "security-graph", title: "Graph", icon: "git-branch", priority: 70, kind: "lens" },
        { id: "security-findings", title: "Findings", icon: "alert-triangle", priority: 60, kind: "lens" },
        { id: "security-workflows", title: "Workflows", icon: "play", priority: 50, kind: "lens" },
        { id: "security-evidence", title: "Evidence", icon: "file-text", priority: 40, kind: "lens" },
      ],
      actions: [
        {
          id: "review",
          title: "Review",
          description: "Review open findings, evidence chains, and pending risk decisions.",
          prompt:
            "Review the current security graph, open findings, linked evidence, and pending risk decisions. Identify which conclusions are credible, which need stronger proof, and which proposals should be revised before landing.",
          icon: "git-pull-request",
          priority: 115,
        },
        {
          id: "run",
          title: "Run",
          description: "Plan the next AI-led audit or validation workflow.",
          prompt:
            "Plan the next security workflow for this project. Focus on attack-surface mapping, finding validation, evidence collection, and explicit decision criteria for human review.",
          icon: "play",
          priority: 105,
        },
        {
          id: "inspect",
          title: "Inspect",
          description: "Inspect attack surface, controls, findings, and accepted risk state.",
          prompt:
            "Inspect this audit project's targets, attack surfaces, controls, findings, and risk decisions. Summarize the strongest signals, the weakest evidence, and the most important unresolved assumptions.",
          icon: "search",
          priority: 95,
        },
      ],
      configVersion: 1,
      pluginVersion: manifest.version,
    },
  ],
})
