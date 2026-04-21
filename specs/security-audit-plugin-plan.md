# Security Audit Plugin Plan

This document defines the intended `security-audit` plugin as a first-class Palimpsest lens.

It is **not** a scanner console, a vulnerability dashboard, or a thin wrapper around static analysis tooling.

It is an AI-first security reasoning plugin built on the same durable asset chain as the rest of the platform:

- `node`
- `run`
- `artifact`
- `decision`
- `proposal`
- `review`
- `commit`

The goal is to make security analysis feel structurally similar to research while preserving security-specific semantics and review discipline.

## Core Thesis

The `security-audit` plugin should prove that Palimpsest is not a research-only system.

Security should use:

- the same graph-backed workbench model
- the same proposal/review/commit flow
- the same run/artifact/decision chain
- the same session attachment model

while supplying its own:

- taxonomy
- workflows
- prompts
- skills
- renderers
- decision vocabulary

## Product Shape

The intended user experience is:

1. Create a `Security Audit` project preset
2. Seed a security graph for the target repository or subsystem
3. Inspect graph atoms such as targets, surfaces, findings, controls, assumptions, and risks
4. Launch AI-driven workflows from those atoms
5. Let AI gather evidence and refine hypotheses
6. Require humans to perform the final review before durable risk state changes land

The plugin should feel like a **Security Workbench**, not like a “run scanner” page.

## Interaction Model

The interaction style should be **isomorphic to research**, but not a reskin.

Research uses:

- claim
- evidence
- experiment
- assessment

Security should use:

- finding
- risk
- surface
- control
- assumption
- target
- evidence
- validation run
- risk decision

The user flow should feel similar:

- start from the graph
- click into an atom
- inspect graph context, artifacts, runs, proposals, and decisions
- launch workflows against that atom

But the semantics differ:

- research asks: “is this claim true?”
- security asks: “does this risk exist, what evidence supports it, and how should we handle it?”

## Atomic Graph Model

### Node Kinds

The security graph should at minimum support:

- `target`
- `surface`
- `finding`
- `control`
- `assumption`
- `risk`

### Edge Kinds

The graph should at minimum support:

- `affects`
- `depends_on`
- `mitigates`
- `evidenced_by`
- `contradicts`
- `derived_from`

### Why this matters

This makes the plugin graph-native and reasoning-native.

Security analysis should not collapse into a flat list of issues. It should become a causal and evidentiary graph that can answer:

- what is being protected
- what surface introduces exposure
- what controls mitigate it
- what findings are currently hypothesized or validated
- what assumptions remain unresolved
- what decisions were made and why

## Workflow Model

The plugin should be AI-first and workflow-first.

The main workflow family should be:

- `security_project_init`
- `attack_surface_map`
- `finding_hypothesis`
- `evidence_gathering`
- `finding_validation`
- `mitigation_review`
- `risk_decision`

### 1. `security_project_init`

Purpose:

- create the initial security graph
- record target, objective, and constraints
- seed initial nodes such as target, surface, control, and assumption

Outputs:

- initial `proposal`
- initial `run`
- initial `artifact`
- initial graph atoms

### 2. `attack_surface_map`

Purpose:

- let AI map trust boundaries, entry points, privileged operations, sensitive components, and high-consequence paths

Outputs:

- new or updated `surface` nodes
- linked artifacts and evidence notes
- candidate assumptions

### 3. `finding_hypothesis`

Purpose:

- let AI propose potential findings and risk hypotheses tied to specific surfaces, targets, or control failures

Outputs:

- pending `proposal`
- `finding` nodes
- optional `risk` nodes
- linked evidence artifacts

### 4. `evidence_gathering`

Purpose:

- collect code excerpts, config excerpts, historical clues, validation notes, diffs, and additional rationale

Outputs:

- `artifact` chain
- improved proposal refs
- stronger provenance for later review

### 5. `finding_validation`

Purpose:

- let AI push a finding toward one of:
  - supported
  - contradicted
  - needs_validation

Outputs:

- `validation` run
- evidence artifact
- updated proposal
- optional candidate decision

### 6. `mitigation_review`

Purpose:

- evaluate remediation ideas, alternative controls, residual risk, and implementation tradeoffs

Outputs:

- new artifacts
- proposal updates
- mitigation-oriented rationale

### 7. `risk_decision`

Purpose:

- produce the final structured risk outcome

Outputs:

- decision proposal of kind:
  - `accept_risk`
  - `mitigate_risk`
  - `false_positive`
  - `needs_validation`
  - `defer_risk`

## AI Autonomy Model

For large repositories, AI autonomy should be higher than in many other workflows.

The plugin should explicitly allow AI to:

- decompose attack surface
- generate findings and risk hypotheses
- collect and organize evidence
- validate or contradict earlier hypotheses
- update proposals and rationale iteratively

But that autonomy stops before final durable risk state changes.

### AI can automate

- graph bootstrap
- finding hypothesis generation
- evidence gathering
- validation runs
- proposal refinement

### AI should not auto-finalize by default

- `accept_risk`
- `mitigate_risk`
- `false_positive`
- `defer_risk`
- any commit that changes the accepted project risk posture

### Rule

AI may push work to “strong evidence and a well-formed proposal”.

Humans remain the final authority for:

- approval
- rejection
- request changes
- final risk disposition

## Proposal-First Security Flow

The plugin must stay aligned with Palimpsest’s proposal-first architecture.

A healthy loop looks like:

1. AI initializes a security graph
2. AI identifies suspicious atoms
3. AI creates a `proposal`
4. AI gathers `artifact` evidence
5. AI runs validation workflows
6. AI updates the proposal with stronger rationale
7. Humans review the resulting proposal
8. Approved changes become `commit`
9. Durable decisions become part of project memory

This preserves:

- auditability
- provenance
- replayability
- human accountability

## Session Model

The plugin should not reintroduce special-purpose “security session types”.

Sessions must remain generic domain containers that attach to:

- `project`
- `node`
- `run`
- `proposal`
- `decision`

The security lens should only interpret those attachments.

Examples:

- a session attached to a `finding`
- a session attached to a `validation run`
- a session attached to a `risk decision`

This keeps the plugin aligned with the same session architecture used by research and the rest of the platform.

## Workbench Shape

The security workbench should feel like a first-class Palimpsest lens.

### Expected top-level security views

- `Security`
- `Findings`
- `Risks`
- `Surfaces`
- `Controls`

These can be implemented as lens views, tabs, or focused slices of canonical core tabs, but they must remain additive to the core shell.

### Atom detail expectations

Every security atom should be inspectable with:

- graph context
- related artifacts
- linked runs
- open proposals
- past decisions
- connected nodes and edges

### Product actions

The top-level product actions should remain:

- `Ask`
- `Propose`
- `Review`
- `Run`
- `Inspect`

The plugin should map those actions into security-specific behavior.

Examples:

- `Ask`
  - summarize current risk posture
  - explain a finding
  - surface weak evidence
- `Propose`
  - propose a new finding
  - propose a new control
  - propose a revised risk decision
- `Run`
  - run attack surface mapping
  - run finding validation
  - run mitigation review
- `Inspect`
  - inspect evidence, graph relationships, and prior decisions
- `Review`
  - review pending proposals and associated rationale

The user should never need to think in terms of internal workflow identifiers.

## Artifacts

Artifacts should be evidence-first, not scanner-first.

Expected artifact kinds include:

- evidence notes
- code excerpts
- config excerpts
- diffs
- traces
- patch suggestions
- validation logs
- reasoning summaries

Heavy scanners are optional evidence adapters at most. They are not the center of the plugin.

## Decisions

The plugin becomes valuable when it turns security work into durable, reviewable decisions.

Expected decision kinds:

- `accept_risk`
- `mitigate_risk`
- `false_positive`
- `needs_validation`
- `defer_risk`

Each decision should carry:

- rationale
- linked evidence
- originating proposal
- reviewing actor
- supersession chain if later revised

## Skills and Prompts

The plugin should own its own security-specific reasoning assets.

### Skills

Minimal useful builtin skills:

- `security-audit-agent`
  - graph-first audit behavior
  - conservative finding proposal discipline
- `finding-validator`
  - validate or contradict evidence chains
- `risk-reviewer`
  - frame final risk decisions for human review

### Prompts

Minimal useful builtin prompts:

- `security_project_init`
- `attack_surface_map`
- `finding_hypothesis`
- `evidence_gathering`
- `finding_validation`
- `mitigation_review`
- `risk_decision`

## Static Rules

The plugin should ship simple builtin rules, but not depend on heavyweight scanners.

The first rules should be lightweight rubrics and classification aids:

- severity rubric
- confidence rubric
- decision rubric
- evidence checklist
- large-repo playbook

These help the AI behave consistently without turning the plugin into a static-analysis platform.

## V1 Success Criteria

The first good version of `security-audit` should satisfy all of the following:

1. A user can create a `Security Audit` project without needing a scanner.
2. The plugin can bootstrap a security graph from scope metadata.
3. AI can generate `finding` proposals and linked evidence.
4. AI can run validation loops against specific findings.
5. Humans can review and approve resulting risk decisions.
6. The workbench feels structurally similar to research while remaining security-native.
7. The plugin proves that Palimpsest is a platform for multiple reasoning domains, not just research.

## Non-Goals for V1

The plugin does **not** need to start with:

- CodeQL integration
- Semgrep integration
- heavyweight static analysis orchestration
- scanner-specific UI
- external marketplace packaging

Those may become optional evidence adapters later, but they are not part of the primary product thesis.

## Summary

The right mental model is:

`security-audit` is an AI-first security reasoning lens built on top of Palimpsest’s durable asset chain.

Its core loop is:

`scope -> security graph -> finding proposal -> review -> validation -> decision`

If implemented well, it becomes the clearest proof that Palimpsest is a platform:

- same bones as research
- different semantics
- different workflows
- same durable asset model
