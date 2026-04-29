import type { SecurityFindingKind } from "../context/security-audit"

/**
 * Per-finding-kind review playbook shown in the Detail panel's
 * "Workflow" section. Surfaces a step-by-step checklist that helps the
 * human reviewer interrogate an AI-proposed finding (the
 * human-in-the-loop side of the AI-first audit lens).
 *
 * Extracted from workbench.tsx as part of step 9d follow-ups so a new
 * finding kind can be added without touching the UI component.
 *
 * The shape stays plain TS (not markdown) on purpose: the rendering
 * (numbered step bubbles) is structural, not free-form prose; AI- or
 * non-engineer-authored content lives in `prompts/` and `skills/`,
 * which are loaded at runtime. These review checklists are part of
 * the lens's own UI contract.
 */
export const PLAYBOOKS: Record<SecurityFindingKind, { title: string; steps: string[] }> = {
  ssrf: {
    title: "SSRF workflow",
    steps: [
      "Locate outbound request construction and URL parser behavior.",
      "Trace user-controlled URL, host, scheme, redirect, and DNS inputs.",
      "Validate internal network, metadata, redirect, and protocol bypass cases.",
      "Record impact boundary and mitigation: allowlist, resolver guard, egress policy.",
    ],
  },
  auth_bypass: {
    title: "Auth bypass workflow",
    steps: [
      "Map identity source, session state, authorization middleware, and protected routes.",
      "Trace role, tenant, ownership, and direct object reference checks.",
      "Validate bypass with missing guard, confused deputy, or stale permission paths.",
      "Record impact scope and mitigation: policy centralization, deny-by-default, tests.",
    ],
  },
  deserialization: {
    title: "Deserialization workflow",
    steps: [
      "Locate decode, unmarshal, object hydration, and gadget entry points.",
      "Trace attacker-controlled bytes through content type, class, and resolver boundaries.",
      "Validate gadget reachability, type confusion, and sandbox escape preconditions.",
      "Record impact and mitigation: safe parser, schema validation, class allowlist.",
    ],
  },
  rce: {
    title: "RCE workflow",
    steps: [
      "Locate command execution, template evaluation, plugin loading, and dynamic import paths.",
      "Trace attacker-controlled data into shell, interpreter, filesystem, and env boundaries.",
      "Validate exploitability, privilege, reachable sink, and post-execution impact.",
      "Record mitigation: strict arguments, escaping, sandbox, least privilege, regression tests.",
    ],
  },
  generic: {
    title: "General finding workflow",
    steps: [
      "State the hypothesis and the violated security property.",
      "Trace source, transformation, sink, and trust boundary.",
      "Collect evidence that supports or contradicts the hypothesis.",
      "Land a reviewed risk decision with explicit remediation or false-positive rationale.",
    ],
  },
}

/**
 * Per-node-kind review playbook for non-finding nodes (target,
 * surface, control, assumption). Same shape and rendering as
 * `PLAYBOOKS`. Looked up in `playbookFor` below; falls back to
 * `PLAYBOOKS.generic` for unknown kinds.
 */
export const NODE_PLAYBOOKS: Record<string, { title: string; steps: string[] }> = {
  target: {
    title: "Target scoping workflow",
    steps: [
      "Confirm the audited repository, service boundary, and deployment assumptions.",
      "Identify high-value assets, privilege levels, and sensitive data flows.",
      "Attach evidence for architecture, trust boundaries, and excluded areas.",
      "Seed attack surfaces and controls that should receive dedicated workflows.",
    ],
  },
  surface: {
    title: "Attack surface mapping workflow",
    steps: [
      "Break the surface into concrete entry points, routes, jobs, parsers, and integrations.",
      "Trace inputs through authentication, validation, storage, and outbound boundaries.",
      "Create finding hypotheses for suspicious paths, grouped by vulnerability kind.",
      "Attach evidence and promote validated hypotheses into risk workflows.",
    ],
  },
  control: {
    title: "Control verification workflow",
    steps: [
      "State the promised security control and the threat it should mitigate.",
      "Find all call sites and bypass paths that rely on this control.",
      "Validate enforcement with code evidence, tests, and negative cases.",
      "Link supported or contradicted findings back to the control.",
    ],
  },
  assumption: {
    title: "Assumption validation workflow",
    steps: [
      "State the assumption and why the audit depends on it.",
      "Find evidence that proves, weakens, or invalidates the assumption.",
      "Create finding hypotheses when an assumption is unsafe or unverifiable.",
      "Close the assumption with an explicit decision or keep it pending with evidence gaps.",
    ],
  },
}

/**
 * Resolve the right playbook for any node. Findings/risks key off
 * `findingKind`; other node kinds key off `node.kind`; unknowns fall
 * back to the `generic` playbook.
 */
export function playbookFor(
  kind: SecurityFindingKind,
  nodeKind: string,
): { title: string; steps: string[] } {
  if (nodeKind === "finding" || nodeKind === "risk") return PLAYBOOKS[kind]
  return NODE_PLAYBOOKS[nodeKind] ?? PLAYBOOKS.generic
}
