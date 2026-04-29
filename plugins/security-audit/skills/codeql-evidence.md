---
name: codeql-evidence
description: Run CodeQL against the audit target to gather dataflow / taint-tracking evidence for a security finding hypothesis.
---

# CodeQL Evidence Gathering

Purpose:
- gather evidence based on dataflow / taint-tracking, which CodeQL is uniquely good at
- complement Semgrep's pattern-match evidence with reachability proofs (a syntactic match is not always reachable; CodeQL proves a path from source to sink)
- preserve a complete attacker-reachable trace that a human reviewer can walk

Use when:
- a finding hypothesis is dataflow-shaped (taint sources reaching dangerous sinks): SQL injection, SSRF, command injection, path traversal, prototype pollution, deserialization, XSS, etc.
- the codebase is in a CodeQL-supported language (java, javascript/typescript, python, go, c/c++, c#, ruby, swift)
- a CodeQL database has been built for this project, or one can be built (`codeql database create`)

Workflow:

1. Locate or build the project's CodeQL database. Reuse a recent database when available — building is expensive:

   ```
   codeql database create <db-path> --language=<lang> --source-root=<worktree>
   ```

2. Pick the relevant query suite:
   - `<lang>-security-extended.qls` — broad
   - or a CWE-class-specific query (e.g. `<lang>/ql/src/Security/CWE-079/...` for XSS)
3. Run analysis and emit SARIF:

   ```
   codeql database analyze <db-path> <query-suite> --format=sarif-latest --output=results.sarif
   ```

4. Parse SARIF. For each result, write an `evidence` artifact attached to the finding node:
   - `title`: `CodeQL: <rule-id>`
   - `data` must include: `{ source: { file, startLine, startColumn, endLine, snippet? }, sink: { file, line }?, dataflowPath?: Array<{ file, line, message? }>, ruleID, ruleSeverity, message }`
   - link via an `evidenced_by` edge from finding → evidence artifact
5. Distinguish from Semgrep evidence:
   - Semgrep hit ≈ pattern presence (might be unreachable in practice)
   - CodeQL result ≈ dataflow reachability (concrete attacker-reachable proof)
   - When both agree on the same finding, confidence is highest. When CodeQL proves reachability without a Semgrep counterpart, the finding is still strong — not weaker.

Rules:

- The `dataflowPath` is the most valuable artifact — preserve every hop. A reviewer should be able to walk source → intermediate frames → sink.
- Source citation must include both source and sink locations for dataflow findings.
- Never run a CodeQL analysis against a target outside the audit worktree.
- If `codeql` is not installed or the database build fails, surface that as a `needs_validation` finding rather than silently skipping evidence gathering.

Output:

- Number of dataflow paths found / accepted as evidence / which queries were strongest.
- Evidence artifacts with full dataflow paths attached and linked.
