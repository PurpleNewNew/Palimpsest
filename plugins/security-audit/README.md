# Security Audit Plugin

`security-audit` is a Palimpsest builtin plugin. It is the
**AI-first security reasoning lens** — not a wrapper around heavy
static scanners, not a vulnerability dashboard.

For platform-level docs (domain, plugin system, UI, graph workbench),
see `specs/`.

## Thesis

Security-audit proves that Palimpsest is not a research-only system.
It reuses the same durable asset chain as every other lens
(`node / edge / run / artifact / decision / proposal / review /
commit` — see `specs/domain.md`) and contributes security-specific:

- taxonomy (target / surface / finding / control / assumption / risk)
- workflows (AI-driven with human review gate)
- prompts / skills / resources
- decision vocabulary (accept_risk / mitigate_risk / false_positive /
  needs_validation / defer_risk)

## Product Shape

1. Create a `Security Audit` project (preset
   `security-audit.audit` at `plugin.ts:19-77`).
2. Seed a security graph via the `security_audit_v1` workflow
   (`workflows/security-audit-v1/`).
3. Inspect and curate security nodes through the shared graph
   workbench primitive (`specs/graph-workbench-pattern.md`).
4. Launch AI-first workflows from nodes (through `nodeActions`).
5. Let AI gather evidence, generate finding hypotheses, and produce
   proposals.
6. Require human review before risk-state changes land.

## Graph Model

### Node kinds (`plugin.ts:11`)

- `target` — the audited service or component
- `surface` — entry points / attack surfaces within the target
- `finding` — a hypothesis about a vulnerability
- `control` — a security control or mitigation
- `assumption` — an audit assumption that must be validated
- `risk` — a durable risk statement derived from findings

### Edge kinds (`plugin.ts:12`)

- `affects` — a surface affects a target
- `mitigates` — a control mitigates a finding or risk
- `depends_on` — ordering / prerequisite
- `verified_by`, `evidenced_by`, `contradicts`, `derived_from` — evidence
  and provenance relations

This keeps the plugin graph-native instead of collapsing into a flat
finding table.

## Workflow

Canonical flow is `security-audit-v1`
(`workflows/security-audit-v1/index.ts`):

```
gather_scope → seed_graph → map_surface → hypothesize_findings
  → gather_evidence → validate_findings → review_risk
```

Every step except `review_risk` runs autonomously
(`can_wait_interaction: false`). `review_risk` is the human gate
(`can_wait_interaction: true`).

Workflow output enters the graph with `status="proposed"` because the
workflow runs as `actor.type: "agent"` and `domain.md` decision 1
never auto-approves agent-origin writes.

## AI Autonomy

AI may:

- map attack surface
- generate finding hypotheses
- gather evidence
- run validation workflows
- update proposals and rationale

Humans must remain the final authority for:

- `accept_risk`
- `mitigate_risk`
- `false_positive`
- `defer_risk`
- any durable risk-state commit

This boundary is enforced through the decision vocabulary: the five
decision kinds above require a human reviewer on the originating
proposal before the commit lands (per `domain.md` Proposal → Review →
Commit Chain).

## UX Contract

Security-audit consumes the shared graph workbench primitive
(`specs/graph-workbench-pattern.md`). The graph UX contract — free-
form layout, hover anchor toolbar, Ctrl+click focus pin, rich tooltip,
click-to-detail, action registry — is **identical to research's**.
Differences are parameterized:

- taxonomy (node kinds / edge kinds / decision kinds)
- tooltip content (severity / CVSS / source run)
- `nodeActions` set (Ask, Run, Accept, Reject, Mark false positive,
  Request evidence)
- right-panel content (Workflow playbook / Hypothesis / Evidence /
  Assessment / Runs)

The earlier "page/workspace semantics differ" framing is narrower than
it sounded: only the right-panel content differs; the graph itself is
shared.

## Current Implementation

- `plugin.ts` — taxonomy, preset, lens, actions
- `server/` — server hook + security-specific routes
- `web/` — pages (`security.tsx`, `findings.tsx`), context
  (`context/security-audit.tsx`), workbench
  (`web/components/workbench.tsx`)
- `workflows/security-audit-v1/` — workflow template + steps
- `prompts/` — AI prompts
- `skills/`, `resources/`, `rules/` — AI-visible assets

The `web/components/workbench.tsx` file (746 lines) is slated for
rewrite: today it uses hand-rolled SVG and a `kind-columns` layout.
Per `specs/graph-workbench-pattern.md`, it will migrate to the shared
`<NodeGraphWorkbench>` primitive with security-specific taxonomy and
`nodeActions`, landing it on the same free-form graph interaction as
research.

## Non-Goals

If a design choice makes `security-audit` feel like any of these, it
is wrong:

- a scanner dashboard
- a vulnerability list
- a host feature with plugin branding

If it makes security-audit feel like any of these, it is aligned:

- a graph-native security workbench
- an AI-first reasoning surface
- a proposal / review / decision pipeline for security judgment

## Relationship to Research

Security and research share:

- graph model (`specs/domain.md`)
- proposal / review / commit chain (`specs/domain.md`)
- run / artifact / decision structure (`specs/domain.md`)
- session attachment model (`specs/domain.md`)
- graph workbench primitive (`specs/graph-workbench-pattern.md`)

They differ in:

- taxonomy (per-plugin `plugin.ts`)
- workflows (per-plugin `workflows/`)
- prompts / skills (per-plugin `prompts/` / `skills/`)
- decision vocabulary
- right-panel content in the graph workbench fullscreen

This is one of the strongest proofs that Palimpsest is a platform, not
a research-only app.
