---
name: semgrep-evidence
description: Run Semgrep against the audit target to gather deterministic, source-cited evidence for a security finding hypothesis.
---

# Semgrep Evidence Gathering

Purpose:
- supplement AI reasoning about a finding with deterministic static-analysis hits
- ground every evidence artifact in a concrete `file:line` citation that a human reviewer can verify

Use when:
- a finding hypothesis names a vulnerability class Semgrep covers (injection, ssrf, xss, hardcoded-creds, deserialization, weak-crypto, path-traversal, etc.)
- the codebase is local and inside the audit project worktree (so `semgrep` runs via the bash tool stay in scope)
- you want to falsify or strengthen a hypothesis with rule-based output, not replace reasoning

Workflow:

1. Identify the target scope from the audit project (project worktree path).
2. Pick a relevant ruleset:
   - `p/security-audit` — broad starter coverage
   - `p/owasp-top-ten` — OWASP-aligned classes
   - `p/<language>` — language-specific (e.g. `p/python`, `p/typescript`, `p/javascript`)
   - or a hypothesis-specific bundle, e.g. `p/ssrf` for SSRF findings, `p/sql-injection` for SQLi
3. Run via the bash tool, scoped to the worktree:

   ```
   semgrep --config=<ruleset> --json --severity=ERROR --severity=WARNING <target-path>
   ```

4. For each hit, write an `evidence` artifact attached to the finding node:
   - `title`: `Semgrep: <rule-id>` (e.g. `Semgrep: python.lang.security.audit.dangerous-template`)
   - `data` must include: `{ source: { file, line, column?, snippet? }, ruleID, ruleSeverity, ruleMessage, ruleConfig }`
   - link via an `evidenced_by` edge from finding → evidence artifact
5. If hits contradict the hypothesis, recommend `false_positive` to the finding-validator skill.
6. If hits confirm, raise the finding's `confidence` and set `validationStatus: validated`.

Rules:

- Treat Semgrep hits as evidence, not conclusions. AI must still reason about whether each hit truly supports the finding.
- One hit per evidence artifact. Multi-line hits go in `data.snippet`.
- Always include `source.file` and `source.line` — reviewers must be able to jump to the citation. **A finding without a source citation is unreviewable** and defeats the human-in-the-loop guarantee.
- Stay inside the audit project's worktree. Never run Semgrep against arbitrary host paths.
- If `semgrep` is not installed, surface that as a `needs_validation` finding rather than silently skipping evidence gathering.

Output:

- Number of hits found / hits accepted as evidence / hypothesis confidence delta.
- Evidence artifacts attached and linked back to the finding.
