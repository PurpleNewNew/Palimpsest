# Security Audit Plugin

This document describes the current intended shape of the `security-audit`
builtin plugin.

It should be read as an **AI-first security reasoning lens**, not as a wrapper
around heavy static scanners.

## Thesis

`security-audit` should prove that Palimpsest is not a research-only system.

It should reuse the same durable asset chain as the rest of the platform:

- node
- run
- artifact
- decision
- proposal
- review
- commit

while contributing security-specific:

- taxonomy
- workflows
- prompts
- skills
- labels
- workspaces
- decision vocabulary

## Product Shape

The right user experience is:

1. create a `Security Audit` project
2. seed a security graph
3. inspect security atoms
4. launch AI-first workflows from those atoms
5. let AI gather evidence and refine proposals
6. require human final review before durable risk-state changes land

This should feel structurally similar to research, but it is not a reskin.

## Atomic Graph Model

### Node kinds

The security lens should revolve around nodes such as:

- `target`
- `surface`
- `finding`
- `control`
- `assumption`
- `risk`

### Edge kinds

Important relationships include:

- `affects`
- `depends_on`
- `mitigates`
- `evidenced_by`
- `contradicts`
- `derived_from`

This keeps the plugin graph-native instead of collapsing into a flat finding
table.

## Workflow Model

The center of gravity is AI-first workflow execution.

Important workflow families include:

- `security_project_init`
- `attack_surface_map`
- `finding_hypothesis`
- `evidence_gathering`
- `finding_validation`
- `mitigation_review`
- `risk_decision`

## AI Autonomy Model

The plugin should grant AI relatively high autonomy for large codebases, but it
must stop short of silently finalizing risk state.

AI may:

- map attack surface
- generate finding hypotheses
- gather evidence
- run validation workflows
- update proposals and rationale

Humans must remain the final authority for:

- accept risk
- mitigate risk
- false positive
- defer risk
- durable risk-state commits

## Current Implementation Direction

The plugin now has real substance in:

- taxonomy / preset / lens / actions
- AI-first server helper logic
- prompts / skills / resources / workflows
- plugin-owned web pages for security and findings

This means the plugin has moved beyond scaffolding.

## Relationship to Research

Security and research should share:

- graph model
- proposal/review/commit chain
- run/artifact/decision structure
- session attachment model
- workbench conventions

They should differ in:

- taxonomy
- workflows
- prompts/skills
- decision vocabulary
- page/workspace semantics

This is one of the strongest proofs that Palimpsest is a platform, not a
research-only app.

## Remaining Gaps

The main remaining work is maturity, not identity:

- continue deepening security-specific object workspaces
- keep shrinking any residual host-owned security UI
- keep improving evidence/provenance and review flows
- avoid reintroducing scanner-centric product framing

## Rule of Thumb

If a design choice makes `security-audit` feel like:

- a scanner dashboard
- a vulnerability list
- or a host feature with plugin branding

it is probably wrong.

If it makes `security-audit` feel like:

- a graph-native security workbench
- an AI-first reasoning surface
- a proposal/review/decision pipeline for security judgment

it is probably aligned.
