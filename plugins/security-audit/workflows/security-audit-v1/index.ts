import { WorkflowSchema } from "@palimpsest/plugin-sdk/workflow"

export const SecurityAuditWorkflowTemplateDir = import.meta.dirname

export const SecurityAuditWorkflowTemplate = WorkflowSchema.Template.parse({
  id: "security_audit_v1",
  name: "Security Audit Workflow",
  version: "1.0",
  description: "Run an AI-first security audit that maps attack surface, proposes findings, validates evidence, and ends in human-reviewed risk decisions.",
  defs: {
    gather_scope: {
      kind: "gather_scope",
      title: "Gather scope",
      summary: "Read the audit scope, target, objective, and constraints.",
      prompt: "gather-scope",
      policy: { can_next: [], can_wait_interaction: false, can_edit_future: false, allowed_edit_ops: [] },
    },
    seed_graph: {
      kind: "seed_graph",
      title: "Seed graph",
      summary: "Create the initial target, surface, control, and assumption graph.",
      prompt: "seed-graph",
      policy: { can_next: [], can_wait_interaction: false, can_edit_future: false, allowed_edit_ops: [] },
    },
    map_surface: {
      kind: "map_surface",
      title: "Map attack surface",
      summary: "Expand the initial graph into a conservative surface map.",
      prompt: "map-surface",
      policy: { can_next: [], can_wait_interaction: false, can_edit_future: false, allowed_edit_ops: [] },
    },
    hypothesize_findings: {
      kind: "hypothesize_findings",
      title: "Hypothesize findings",
      summary: "Propose candidate findings and risks from the mapped graph.",
      prompt: "hypothesize-findings",
      policy: { can_next: [], can_wait_interaction: false, can_edit_future: false, allowed_edit_ops: [] },
    },
    gather_evidence: {
      kind: "gather_evidence",
      title: "Gather evidence",
      summary: "Collect evidence notes and supporting artifacts for the strongest findings.",
      prompt: "gather-evidence",
      policy: { can_next: [], can_wait_interaction: false, can_edit_future: false, allowed_edit_ops: [] },
    },
    validate_findings: {
      kind: "validate_findings",
      title: "Validate findings",
      summary: "Run validation loops and classify findings as supported, contradicted, or still unresolved.",
      prompt: "validate-findings",
      policy: { can_next: [], can_wait_interaction: false, can_edit_future: false, allowed_edit_ops: [] },
    },
    review_risk: {
      kind: "review_risk",
      title: "Review risk with human",
      summary: "Present findings, evidence, and decision recommendations for final human review.",
      prompt: "review-risk",
      policy: { can_next: [], can_wait_interaction: true, can_edit_future: true, allowed_edit_ops: ["insert"] },
    },
  },
  flows: {
    default: {
      title: "Default",
      summary: "default",
      steps: ["gather_scope", "seed_graph", "map_surface", "hypothesize_findings", "gather_evidence", "validate_findings", "review_risk"],
    },
  },
  default_flow: "default",
})
