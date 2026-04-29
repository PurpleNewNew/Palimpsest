import type { SecurityFindingKind } from "../context/security-audit";
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
export declare const PLAYBOOKS: Record<SecurityFindingKind, {
    title: string;
    steps: string[];
}>;
/**
 * Per-node-kind review playbook for non-finding nodes (target,
 * surface, control, assumption). Same shape and rendering as
 * `PLAYBOOKS`. Looked up in `playbookFor` below; falls back to
 * `PLAYBOOKS.generic` for unknown kinds.
 */
export declare const NODE_PLAYBOOKS: Record<string, {
    title: string;
    steps: string[];
}>;
/**
 * Resolve the right playbook for any node. Findings/risks key off
 * `findingKind`; other node kinds key off `node.kind`; unknowns fall
 * back to the `generic` playbook.
 */
export declare function playbookFor(kind: SecurityFindingKind, nodeKind: string): {
    title: string;
    steps: string[];
};
