import { WorkflowSchema } from "@palimpsest/plugin-sdk/workflow"

export const SecurityAuditWorkflowTemplateDir = import.meta.dirname

// Policy shortcuts for the security-audit workflow.
//
// The four "mid-flight" steps (map_surface, hypothesize_findings,
// gather_evidence, validate_findings) all carry
// `can_edit_future: true` with both `insert` and `delete` allowed,
// because audit scope is intrinsically discovery-driven: we learn
// about new surfaces as we read code, the number of findings we want
// to validate depends on how many hypotheses survived triage, etc.
// Locking these steps into rigid linear execution (like the previous
// all-`can_edit_future: false` config) forced the AI to either
// over-commit to a plan up-front or bail out on audits that didn't
// match the seven-step shape.
//
// `gather_scope` and `seed_graph` stay rigid — they are deterministic
// project-wide setup. `review_risk` stays rigid-with-interaction —
// it is the human-gated terminal step, not a place for the AI to
// insert more work.
const RIGID = { can_next: [], can_wait_interaction: false, can_edit_future: false, allowed_edit_ops: [] }
const FLEXIBLE = {
  can_next: [],
  can_wait_interaction: false,
  can_edit_future: true,
  allowed_edit_ops: ["insert", "delete"] as Array<"insert" | "delete">,
}
const REVIEW = { can_next: [], can_wait_interaction: true, can_edit_future: true, allowed_edit_ops: ["insert"] as Array<"insert" | "delete"> }

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
      policy: RIGID,
    },
    seed_graph: {
      kind: "seed_graph",
      title: "Seed graph",
      summary: "Create the initial target, surface, control, and assumption graph.",
      prompt: "seed-graph",
      policy: RIGID,
    },
    map_surface: {
      kind: "map_surface",
      title: "Map attack surface",
      summary: "Expand the initial graph into a conservative surface map.",
      prompt: "map-surface",
      policy: FLEXIBLE,
    },
    hypothesize_findings: {
      kind: "hypothesize_findings",
      title: "Hypothesize findings",
      summary: "Propose candidate findings and risks from the mapped graph.",
      prompt: "hypothesize-findings",
      policy: FLEXIBLE,
    },
    gather_evidence: {
      kind: "gather_evidence",
      title: "Gather evidence",
      summary: "Collect evidence notes and supporting artifacts for the strongest findings.",
      prompt: "gather-evidence",
      policy: FLEXIBLE,
    },
    validate_findings: {
      kind: "validate_findings",
      title: "Validate findings",
      summary: "Run validation loops and classify findings as supported, contradicted, or still unresolved.",
      prompt: "validate-findings",
      policy: FLEXIBLE,
    },
    review_risk: {
      kind: "review_risk",
      title: "Review risk with human",
      summary: "Present findings, evidence, and decision recommendations for final human review.",
      prompt: "review-risk",
      policy: REVIEW,
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
