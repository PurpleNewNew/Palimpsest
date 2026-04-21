import PROMPT_ATTACK_SURFACE_MAP from "../prompts/attack_surface_map.txt"
import PROMPT_EVIDENCE_GATHERING from "../prompts/evidence_gathering.txt"
import PROMPT_FINDING_HYPOTHESIS from "../prompts/finding_hypothesis.txt"
import PROMPT_FINDING_VALIDATION from "../prompts/finding_validation.txt"
import PROMPT_MITIGATION_REVIEW from "../prompts/mitigation_review.txt"
import PROMPT_RISK_DECISION from "../prompts/risk_decision.txt"
import PROMPT_SECURITY_PROJECT_INIT from "../prompts/security_project_init.txt"
import { SecurityAuditWorkflowTemplate, SecurityAuditWorkflowTemplateDir } from "../workflows/security-audit-v1"

export const SecurityAuditPrompts = {
  security_project_init: PROMPT_SECURITY_PROJECT_INIT,
  attack_surface_map: PROMPT_ATTACK_SURFACE_MAP,
  finding_hypothesis: PROMPT_FINDING_HYPOTHESIS,
  evidence_gathering: PROMPT_EVIDENCE_GATHERING,
  finding_validation: PROMPT_FINDING_VALIDATION,
  mitigation_review: PROMPT_MITIGATION_REVIEW,
  risk_decision: PROMPT_RISK_DECISION,
} as const

export {
  PROMPT_ATTACK_SURFACE_MAP,
  PROMPT_EVIDENCE_GATHERING,
  PROMPT_FINDING_HYPOTHESIS,
  PROMPT_FINDING_VALIDATION,
  PROMPT_MITIGATION_REVIEW,
  PROMPT_RISK_DECISION,
  PROMPT_SECURITY_PROJECT_INIT,
  SecurityAuditWorkflowTemplate,
  SecurityAuditWorkflowTemplateDir,
}

export const server = {
  id: "security-audit.server",
  description: "Security audit server ownership for AI-first workflows, prompts, rules, and audit-specific routes.",
  prompts: Object.keys(SecurityAuditPrompts),
  workflows: [SecurityAuditWorkflowTemplate.id],
  resourcesDir: new URL("../resources/", import.meta.url).pathname,
  rulesDir: new URL("../rules/", import.meta.url).pathname,
  workflowsDir: new URL("../workflows/", import.meta.url).pathname,
}
