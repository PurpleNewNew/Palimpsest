import type { PluginAgentDefinition } from "@palimpsest/plugin-sdk/host"

import {
  PROMPT_SECURITY_AUDIT,
  PROMPT_SECURITY_PROJECT_INIT,
  PROMPT_ATTACK_SURFACE_MAP,
  PROMPT_FINDING_HYPOTHESIS,
  PROMPT_EVIDENCE_GATHERING,
  PROMPT_FINDING_VALIDATION,
  PROMPT_MITIGATION_REVIEW,
  PROMPT_RISK_DECISION,
} from "./index"

/**
 * All security-audit-owned agents (8 total: one primary + seven
 * subagents, one per audit workflow step).
 *
 * Each carries `lensID: "security-audit.workbench"` so `Agent.list()`
 * on non-security projects (research, plain projects, ...) filters
 * them out automatically — mirroring the research plugin's 17-agent
 * registration. See `plugins/research/server/agents.ts` for the
 * companion file.
 *
 * Permission rules are shipped as a plain JSON record. The host
 * merges them on top of the agent-default ruleset + user-config
 * ruleset at Agent.state init time, so plugin code doesn't need to
 * import `PermissionNext`.
 *
 * Two permission key flavours appear here:
 * - Unprefixed (`security_overview`, `security_findings`,
 *   `security_graph`) — for query tools registered with
 *   `rawId: true`.
 * - Prefixed (`"security-audit_bootstrap"`,
 *   `"security-audit_finding_hypothesis"`, ...) — for the four
 *   proposal tools that kept the auto-prefixed tool id.
 */
const LENS_ID = "security-audit.workbench"

export const SecurityAuditAgents: PluginAgentDefinition[] = [
  // ─── primary audit agent ────────────────────────────────────────
  {
    lensID: LENS_ID,
    info: {
      name: "security_audit",
      description:
        "The primary security audit agent. Turns a target into a durable security graph (targets / surfaces / findings / controls / assumptions / risks) and drives the audit workflow from scope gathering through human-reviewed risk decisions.",
      options: {},
      permission: {
        question: "allow",
        plan_enter: "allow",
        bash: "ask",
        edit: {
          "*": "deny",
          "*.md": "allow",
          "**/*.md": "allow",
        },
        // security-audit proposal tools (auto-prefixed by the plugin host)
        "security-audit_bootstrap": "allow",
        "security-audit_finding_hypothesis": "allow",
        "security-audit_finding_validation": "allow",
        "security-audit_risk_decision": "allow",
        // security-audit query tools (registered with rawId: true)
        security_overview: "allow",
        security_findings: "allow",
        security_graph: "allow",
      },
      prompt: PROMPT_SECURITY_AUDIT,
      mode: "primary",
    },
  },

  // ─── audit subagents ────────────────────────────────────────────
  {
    lensID: LENS_ID,
    info: {
      name: "security_project_init",
      description:
        "Initialize a security audit project by seeding the initial graph: targets, surfaces, controls, and assumptions derived from the scope document.",
      prompt: PROMPT_SECURITY_PROJECT_INIT,
      permission: {
        "*": "deny",
        "security-audit_bootstrap": "allow",
        security_overview: "allow",
        security_graph: "allow",
        question: "allow",
        read: "allow",
        glob: "allow",
        grep: "allow",
      },
      options: {},
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "attack_surface_map",
      description:
        "Expand the initial graph into a conservative attack surface map. Reads code, manifests, and configuration to identify entry points, trust boundaries, and data flows.",
      prompt: PROMPT_ATTACK_SURFACE_MAP,
      permission: {
        "*": "deny",
        security_overview: "allow",
        security_graph: "allow",
        "security-audit_bootstrap": "allow",
        read: "allow",
        glob: "allow",
        grep: "allow",
        codesearch: "allow",
        list: "allow",
      },
      options: {},
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "finding_hypothesis",
      description:
        "Propose candidate security findings from the mapped attack surface. Each hypothesis becomes a pending proposal with linked risk and evidence placeholders — never a direct commit.",
      prompt: PROMPT_FINDING_HYPOTHESIS,
      permission: {
        "*": "deny",
        "security-audit_finding_hypothesis": "allow",
        security_graph: "allow",
        security_findings: "allow",
        read: "allow",
        glob: "allow",
        grep: "allow",
      },
      options: {},
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "evidence_gathering",
      description:
        "Collect evidence notes and supporting artifacts for the strongest candidate findings. Favors concrete file:line citations, test outputs, log snippets, and reproducible commands over narrative claims.",
      prompt: PROMPT_EVIDENCE_GATHERING,
      permission: {
        "*": "deny",
        security_findings: "allow",
        security_graph: "allow",
        read: "allow",
        glob: "allow",
        grep: "allow",
        bash: "ask",
        webfetch: "allow",
        codesearch: "allow",
      },
      options: {},
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "finding_validation",
      description:
        "Run validation loops on existing findings and classify them as supported, contradicted, or still unresolved. Produces a validation proposal plus an audit run record with outcome.",
      prompt: PROMPT_FINDING_VALIDATION,
      permission: {
        "*": "deny",
        "security-audit_finding_validation": "allow",
        security_findings: "allow",
        security_graph: "allow",
        read: "allow",
        bash: "ask",
      },
      options: {},
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "mitigation_review",
      description:
        "Review existing controls and proposed mitigations against the active finding set. Identify which controls are insufficient, which need stronger evidence, and which are defensive placeholders.",
      prompt: PROMPT_MITIGATION_REVIEW,
      permission: {
        "*": "deny",
        security_findings: "allow",
        security_graph: "allow",
        security_overview: "allow",
        read: "allow",
        grep: "allow",
      },
      options: {},
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "risk_decision",
      description:
        "Build the case for a final risk decision (accept / mitigate / false-positive / needs-validation / defer) and emit a reviewable proposal. Never lands the verdict — the proposal is explicitly human-gated.",
      prompt: PROMPT_RISK_DECISION,
      permission: {
        "*": "deny",
        "security-audit_risk_decision": "allow",
        security_findings: "allow",
        security_graph: "allow",
        read: "allow",
        question: "allow",
      },
      options: {},
      mode: "subagent",
    },
  },
]
