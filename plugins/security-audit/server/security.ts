import { Domain } from "@palimpsest/domain"
import type { PluginActor, PluginHostAPI } from "@palimpsest/plugin-sdk/host"
import { z } from "zod"

import { manifest } from "../manifest"

const ScopeSections = z.object({
  target: z.string().default("Unnamed target"),
  objective: z.string().default("Audit objective not recorded."),
  constraints: z.string().default("No explicit constraints recorded yet."),
})

const Severity = z.enum(["low", "medium", "high", "critical"])
const Confidence = z.enum(["low", "medium", "high"])
const FindingKind = z.enum(["ssrf", "auth_bypass", "deserialization", "rce", "generic"])

/**
 * Input schemas for the incremental graph-editing tools. Each tool
 * emits a single-node-centric proposal (optionally plus an edge linking
 * it into the existing graph) so the AI can grow the security graph
 * step by step during an audit — in contrast to `bootstrap` /
 * `finding_hypothesis` which bundle multi-node changesets.
 */
export const EvidenceAddInput = z.object({
  sessionID: z.string().optional(),
  findingID: z.string(),
  title: z.string().min(3),
  content: z.string().min(10),
  severity: Severity.optional(),
  confidence: Confidence.optional(),
})

export const SurfaceAddInput = z.object({
  sessionID: z.string().optional(),
  title: z.string().min(3),
  description: z.string().min(10),
  targetID: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

export const ControlAddInput = z.object({
  sessionID: z.string().optional(),
  title: z.string().min(3),
  description: z.string().min(10),
  mitigatesFindingID: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

export const AssumptionAddInput = z.object({
  sessionID: z.string().optional(),
  title: z.string().min(3),
  description: z.string().min(10),
  derivedFromSurfaceID: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

export const BootstrapInput = z.object({
  sessionID: z.string().optional(),
  target: z.string().optional(),
  objective: z.string().optional(),
  constraints: z.string().optional(),
})

export const FindingHypothesisInput = z.object({
  sessionID: z.string().optional(),
  targetID: z.string().optional(),
  surfaceID: z.string().optional(),
  findingKind: FindingKind.default("generic"),
  title: z.string().min(3),
  description: z.string().min(10),
  evidence: z.string().optional(),
  severity: Severity.default("medium"),
  confidence: Confidence.default("medium"),
  riskTitle: z.string().optional(),
})

export const FindingValidationInput = z.object({
  sessionID: z.string().optional(),
  findingID: z.string(),
  summary: z.string().min(10),
  evidence: z.string().optional(),
  outcome: z.enum(["supports", "contradicts", "needs_validation"]).default("needs_validation"),
})

export const RiskDecisionInput = z.object({
  sessionID: z.string().optional(),
  nodeID: z.string(),
  kind: z.enum(["accept_risk", "mitigate_risk", "false_positive", "needs_validation", "defer_risk"]),
  state: z.enum(["accepted", "rejected", "pending"]).default("pending"),
  rationale: z.string().min(10),
  evidence: z.string().optional(),
})

function fromHostActor(actor: PluginActor | undefined): Domain.Actor {
  if (!actor) {
    return Domain.Actor.parse({
      type: "agent",
      id: "agent:security-audit",
      version: manifest.version,
    })
  }
  return Domain.Actor.parse({
    type: actor.type,
    id: actor.id,
    version: actor.version ?? (actor.type === "agent" ? manifest.version : undefined),
  })
}

function section(markdown: string, title: string) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`##\\s+${escaped}\\s*\\n+([\\s\\S]*?)(?=\\n##\\s+|$)`, "i")
  const match = markdown.match(regex)
  return match?.[1]?.trim()
}

async function readScope(host: PluginHostAPI) {
  const worktree = host.instance.worktree()
  const file = `${host.project.metadataDir(worktree)}/security-audit/scope.md`
  const exists = await host.filesystem.exists(file)
  if (!exists) return ScopeSections.parse({})
  const markdown = await host.filesystem.readText(file)
  return ScopeSections.parse({
    target: section(markdown, "Target"),
    objective: section(markdown, "Objective"),
    constraints: section(markdown, "Constraints"),
  })
}

function projectID(host: PluginHostAPI) {
  return host.instance.project().id
}

function ts() {
  return Date.now()
}

async function defaultTargetID(projectID: string) {
  const targets = await Domain.listNodes({ projectID, kind: "target" })
  return targets[0]?.id
}

function scopeRefs(input: z.infer<typeof ScopeSections>) {
  return {
    plugin: manifest.id,
    scope: input,
  }
}

function nodeFindingKind(node: Domain.Node | undefined) {
  const data = node?.data as Record<string, unknown> | undefined
  const value = data?.findingKind
  if (typeof value === "string" && FindingKind.safeParse(value).success) return value

  const haystack = `${node?.title ?? ""}\n${node?.body ?? ""}`.toLowerCase()
  if (haystack.includes("ssrf") || haystack.includes("server-side request")) return "ssrf"
  if (haystack.includes("auth") || haystack.includes("authorization") || haystack.includes("access control")) {
    return "auth_bypass"
  }
  if (haystack.includes("deserialize") || haystack.includes("deserialization")) return "deserialization"
  if (haystack.includes("rce") || haystack.includes("remote code") || haystack.includes("command injection")) {
    return "rce"
  }
  return "generic"
}

function proposalSummary(item: Domain.Proposal) {
  return {
    id: item.id,
    title: item.title ?? "Untitled proposal",
    rationale: item.rationale,
    refs: item.refs,
    revision: item.revision,
    actor: item.actor,
    status: item.status,
    time: item.time,
  }
}

export async function status(host: PluginHostAPI) {
  const scope = await readScope(host)
  const project = host.instance.project()
  const summary = await Domain.summary(project.id)
  return {
    pluginID: manifest.id,
    project,
    scope,
    summary,
    prompts: [
      "security_audit_init",
      "attack_surface_map",
      "finding_hypothesis",
      "evidence_gathering",
      "finding_validation",
      "mitigation_review",
      "risk_decision",
    ],
    skills: ["security-audit-agent", "finding-validator", "risk-reviewer", "semgrep-evidence", "codeql-evidence"],
    workflows: ["security_audit_v1"],
    rules: ["severity-rubric", "confidence-rubric", "decision-rubric"],
    resources: ["evidence-checklist", "decision-checklist", "large-repo-playbook"],
  }
}

export async function overview(host: PluginHostAPI) {
  const pid = projectID(host)
  const [scope, taxonomy, summary, nodes, runs, decisions, proposals, commits] = await Promise.all([
    readScope(host),
    Domain.taxonomy(pid),
    Domain.summary(pid),
    Domain.listNodes({ projectID: pid }),
    Domain.listRuns({ projectID: pid }),
    Domain.listDecisions({ projectID: pid }),
    Domain.listProposals({ projectID: pid, status: "pending" }),
    Domain.listCommits({ projectID: pid }),
  ])

  const nodeCountMap = new Map<string, number>()
  for (const node of nodes) {
    nodeCountMap.set(node.kind, (nodeCountMap.get(node.kind) ?? 0) + 1)
  }
  const nodeCounts = Object.fromEntries(nodeCountMap)

  const runCountMap = new Map<string, number>()
  for (const run of runs) {
    runCountMap.set(run.kind, (runCountMap.get(run.kind) ?? 0) + 1)
  }
  const runCounts = Object.fromEntries(runCountMap)

  const decisionCountMap = new Map<string, number>()
  for (const decision of decisions) {
    decisionCountMap.set(decision.kind, (decisionCountMap.get(decision.kind) ?? 0) + 1)
  }
  const decisionCounts = Object.fromEntries(decisionCountMap)

  return {
    pluginID: manifest.id,
    projectID: pid,
    scope,
    taxonomy,
    summary,
    nodeCounts,
    runCounts,
    decisionCounts,
    pendingProposals: proposals.slice(-5).map((item: Domain.Proposal) => ({
      id: item.id,
      title: item.title ?? "Untitled proposal",
      rationale: item.rationale,
      revision: item.revision,
      actor: item.actor,
      status: item.status,
      time: item.time,
    })),
    recentCommits: commits.slice(-5).map((item: Domain.Commit) => ({
      id: item.id,
      proposalID: item.proposalID,
      actor: item.actor,
      time: item.time,
      changeCount: item.changes.length,
    })),
  }
}

export async function graph(host: PluginHostAPI) {
  const pid = projectID(host)
  const [scope, nodes, edges, runs, decisions, artifacts, proposals] = await Promise.all([
    readScope(host),
    Domain.listNodes({ projectID: pid }),
    Domain.listEdges({ projectID: pid }),
    Domain.listRuns({ projectID: pid }),
    Domain.listDecisions({ projectID: pid }),
    Domain.listArtifacts({ projectID: pid }),
    Domain.listProposals({ projectID: pid, status: "pending" }),
  ])

  return {
    pluginID: manifest.id,
    projectID: pid,
    scope,
    nodes: nodes.map((node: Domain.Node) => ({
      ...node,
      findingKind: node.kind === "finding" || node.kind === "risk" ? nodeFindingKind(node) : undefined,
    })),
    edges,
    runs,
    decisions,
    artifacts,
    pendingProposals: proposals.map(proposalSummary),
  }
}

export async function findings(host: PluginHostAPI) {
  const pid = projectID(host)
  const [nodes, edges, decisions, artifacts, proposals] = await Promise.all([
    Domain.listNodes({ projectID: pid }),
    Domain.listEdges({ projectID: pid }),
    Domain.listDecisions({ projectID: pid }),
    Domain.listArtifacts({ projectID: pid }),
    Domain.listProposals({ projectID: pid, status: "pending" }),
  ])

  const findings = nodes.filter((node: Domain.Node) => node.kind === "finding")
  const risks = nodes.filter((node: Domain.Node) => node.kind === "risk")
  const surfaces = nodes.filter((node: Domain.Node) => node.kind === "surface")
  const controls = nodes.filter((node: Domain.Node) => node.kind === "control")

  const findingCards = findings.map((finding: Domain.Node) => ({
    ...finding,
    findingKind: nodeFindingKind(finding),
    evidenceCount: artifacts.filter((item: Domain.Artifact) => item.nodeID === finding.id).length,
    relatedDecisionKinds: decisions.filter((item: Domain.Decision) => item.nodeID === finding.id).map((item: Domain.Decision) => item.kind),
    links: edges.filter((item: Domain.Edge) => item.sourceID === finding.id || item.targetID === finding.id),
  }))

  return {
    findings: findingCards,
    risks,
    surfaces,
    controls,
    pendingProposals: proposals.map(proposalSummary),
  }
}

export async function nodeSession(host: PluginHostAPI, raw: unknown) {
  const input = z.object({ nodeID: z.string(), parentID: z.string().optional() }).parse(raw)
  const [node, runs] = await Promise.all([
    Domain.getNode(input.nodeID),
    Domain.listRuns({ projectID: projectID(host) }),
  ])
  const existing = runs.find((run: Domain.Run) => run.nodeID === input.nodeID && run.sessionID)
  if (existing?.sessionID) return await host.session.get(existing.sessionID)
  return await host.session.create({ parentID: input.parentID, title: `Security workflow: ${node.title}` })
}

export async function proposeBootstrap(host: PluginHostAPI, raw?: z.input<typeof BootstrapInput>) {
  const input = BootstrapInput.parse(raw ?? {})
  const actor = fromHostActor(host.actor.current())
  const scope = await readScope(host)
  const target = input.target?.trim() || scope.target
  const objective = input.objective?.trim() || scope.objective
  const constraints = input.constraints?.trim() || scope.constraints
  const pid = projectID(host)

  const targetID = host.identifier.ascending("node")
  const surfaceID = host.identifier.ascending("node")
  const controlID = host.identifier.ascending("node")
  const assumptionID = host.identifier.ascending("node")
  const runID = host.identifier.ascending("run")
  const artifactID = host.identifier.ascending("artifact")

  return Domain.propose({
    projectID: pid,
    title: `Bootstrap security graph for ${target}`,
    actor,
    rationale:
      "Create the initial security graph for this project: target, attack surface, controls, assumptions, and a first analysis run. This proposal seeds later finding and validation workflows.",
    refs: {
      ...scopeRefs({ target, objective, constraints }),
      workflow: "security_audit_init",
    },
    changes: [
      {
        op: "create_node",
        id: targetID,
        kind: "target",
        title: target,
        body: objective,
        data: { constraints, source: "security_audit_init" },
      },
      {
        op: "create_node",
        id: surfaceID,
        kind: "surface",
        title: `${target} attack surface`,
        body: "Initial AI-generated attack surface placeholder. Expand this into concrete entry points and trust boundaries.",
        data: { status: "seeded" },
      },
      {
        op: "create_node",
        id: controlID,
        kind: "control",
        title: `${target} control inventory`,
        body: "Known or expected controls, invariants, and guardrails should be attached here.",
        data: { status: "seeded" },
      },
      {
        op: "create_node",
        id: assumptionID,
        kind: "assumption",
        title: `${target} security assumptions`,
        body: "Track assumptions that still need explicit evidence or validation.",
        data: { status: "open" },
      },
      {
        op: "create_edge",
        kind: "affects",
        sourceID: surfaceID,
        targetID,
        note: "The mapped attack surface affects the target system.",
      },
      {
        op: "create_edge",
        kind: "mitigates",
        sourceID: controlID,
        targetID: surfaceID,
        note: "Known controls should mitigate parts of the attack surface.",
      },
      {
        op: "create_edge",
        kind: "depends_on",
        sourceID: assumptionID,
        targetID,
        note: "Security assumptions depend on the target's real behavior and guarantees.",
      },
      {
        op: "create_run",
        id: runID,
        nodeID: targetID,
        sessionID: input.sessionID,
        kind: "analysis",
        status: "completed",
        title: "Security project initialization",
        actor,
        manifest: { workflow: "security_audit_init" },
        startedAt: ts(),
        finishedAt: ts(),
      },
      {
        op: "create_artifact",
        id: artifactID,
        runID,
        nodeID: targetID,
        kind: "note",
        title: "Initial audit scope note",
        mimeType: "text/markdown",
        data: {
          target,
          objective,
          constraints,
        },
      },
    ],
  })
}

export async function proposeFindingHypothesis(host: PluginHostAPI, raw: z.input<typeof FindingHypothesisInput>) {
  const input = FindingHypothesisInput.parse(raw)
  const actor = fromHostActor(host.actor.current())
  const pid = projectID(host)
  const targetID = input.targetID ?? (await defaultTargetID(pid))
  const findingID = host.identifier.ascending("node")
  const riskID = host.identifier.ascending("node")
  const runID = host.identifier.ascending("run")
  const artifactID = host.identifier.ascending("artifact")

  return Domain.propose({
    projectID: pid,
    title: `Finding hypothesis: ${input.title}`,
    actor,
    rationale:
      "Record a candidate security finding, connect it to the known graph, and preserve the evidence gathered so far before any durable risk decision lands.",
    refs: {
      plugin: manifest.id,
      workflow: "finding_hypothesis",
      findingKind: input.findingKind,
      severity: input.severity,
      confidence: input.confidence,
    },
    changes: [
      {
        op: "create_node",
        id: findingID,
        kind: "finding",
        title: input.title,
        body: input.description,
        data: {
          findingKind: input.findingKind,
          status: "hypothesis",
          severity: input.severity,
          confidence: input.confidence,
        },
      },
      {
        op: "create_node",
        id: riskID,
        kind: "risk",
        title: input.riskTitle?.trim() || `${input.title} risk`,
        body: `Potential risk derived from finding hypothesis: ${input.title}`,
        data: {
          findingKind: input.findingKind,
          sourceFindingTitle: input.title,
          severity: input.severity,
          confidence: input.confidence,
        },
      },
      {
        op: "create_edge",
        kind: "derived_from",
        sourceID: riskID,
        targetID: findingID,
        note: "Risk summary derived from the proposed finding.",
      },
      ...(input.surfaceID
        ? [
            {
              op: "create_edge" as const,
              kind: "derived_from",
              sourceID: findingID,
              targetID: input.surfaceID,
              note: "This finding hypothesis was derived from the mapped surface.",
            },
          ]
        : []),
      ...(targetID
        ? [
            {
              op: "create_edge" as const,
              kind: "affects",
              sourceID: findingID,
              targetID,
              note: "If validated, this finding would affect the target system.",
            },
          ]
        : []),
      {
        op: "create_run",
        id: runID,
        nodeID: findingID,
        sessionID: input.sessionID,
        kind: "analysis",
        status: "completed",
        title: `Finding hypothesis: ${input.title}`,
        actor,
        manifest: {
          workflow: "finding_hypothesis",
          findingKind: input.findingKind,
          severity: input.severity,
          confidence: input.confidence,
        },
        startedAt: ts(),
        finishedAt: ts(),
      },
      {
        op: "create_artifact",
        id: artifactID,
        runID,
        nodeID: findingID,
        kind: input.evidence?.trim() ? "evidence" : "note",
        title: `${input.title} evidence note`,
        mimeType: "text/markdown",
        data: {
          evidence: input.evidence?.trim() || "Evidence still needs to be gathered.",
          findingKind: input.findingKind,
          severity: input.severity,
          confidence: input.confidence,
        },
      },
    ],
  })
}

export async function proposeFindingValidation(host: PluginHostAPI, raw: z.input<typeof FindingValidationInput>) {
  const input = FindingValidationInput.parse(raw)
  const actor = fromHostActor(host.actor.current())
  const pid = projectID(host)
  const finding = await Domain.getNode(input.findingID)
  const baseData = (finding.data ?? {}) as Record<string, unknown>
  const findingKind = nodeFindingKind(finding)
  const runID = host.identifier.ascending("run")
  const artifactID = host.identifier.ascending("artifact")
  const decisionID = input.outcome === "supports" ? undefined : host.identifier.ascending("decision")

  return Domain.propose({
    projectID: pid,
    title: `Validate finding: ${finding.title}`,
    actor,
    rationale:
      "Capture validation evidence for a security finding, update its status, and recommend the next risk posture without bypassing final human review.",
    refs: {
      plugin: manifest.id,
      workflow: "finding_validation",
      outcome: input.outcome,
      findingID: input.findingID,
      findingKind,
    },
    changes: [
      {
        op: "create_run",
        id: runID,
        nodeID: finding.id,
        sessionID: input.sessionID,
        kind: "validation",
        status: "completed",
        title: `Validation: ${finding.title}`,
        actor,
        manifest: {
          workflow: "finding_validation",
          findingKind,
          outcome: input.outcome,
        },
        startedAt: ts(),
        finishedAt: ts(),
      },
      {
        op: "create_artifact",
        id: artifactID,
        runID,
        nodeID: finding.id,
        kind: input.evidence?.trim() ? "evidence" : "note",
        title: `Validation evidence: ${finding.title}`,
        mimeType: "text/markdown",
        data: {
          summary: input.summary,
          evidence: input.evidence?.trim() || "No extra evidence supplied.",
          findingKind,
          outcome: input.outcome,
        },
      },
      {
        op: "update_node",
        id: finding.id,
        data: {
          ...baseData,
          validationStatus: input.outcome,
          findingKind,
          lastValidationSummary: input.summary,
          lastValidationAt: ts(),
        },
      },
      ...(decisionID
        ? [
            {
              op: "create_decision" as const,
              id: decisionID,
              nodeID: finding.id,
              runID,
              artifactID,
              kind: input.outcome === "contradicts" ? "false_positive" : "needs_validation",
              state: "pending",
              rationale: input.summary,
              data: {
                outcome: input.outcome,
              },
              refs: {
                plugin: manifest.id,
                evidenceArtifactID: artifactID,
              },
            },
          ]
        : []),
    ],
  })
}

export async function proposeRiskDecision(host: PluginHostAPI, raw: z.input<typeof RiskDecisionInput>) {
  const input = RiskDecisionInput.parse(raw)
  const actor = fromHostActor(host.actor.current())
  const pid = projectID(host)
  const node = await Domain.getNode(input.nodeID)
  const findingKind = nodeFindingKind(node)
  const runID = host.identifier.ascending("run")
  const artifactID = input.evidence?.trim() ? host.identifier.ascending("artifact") : undefined
  const decisionID = host.identifier.ascending("decision")

  return Domain.propose({
    projectID: pid,
    title: `Risk decision: ${input.kind.replaceAll("_", " ")}`,
    actor,
    rationale:
      "Capture a human-reviewable risk decision proposal so the final security posture is visible, auditable, and grounded in explicit reasoning.",
    refs: {
      plugin: manifest.id,
      workflow: "risk_decision",
      decisionKind: input.kind,
      decisionState: input.state,
      findingKind,
    },
    changes: [
      {
        op: "create_run",
        id: runID,
        nodeID: input.nodeID,
        sessionID: input.sessionID,
        kind: "triage",
        status: "completed",
        title: `Risk decision: ${input.kind.replaceAll("_", " ")}`,
        actor,
        manifest: {
          workflow: "risk_decision",
          decisionKind: input.kind,
          decisionState: input.state,
          findingKind,
        },
        startedAt: ts(),
        finishedAt: ts(),
      },
      ...(artifactID
        ? [
            {
              op: "create_artifact" as const,
              id: artifactID,
              runID,
              nodeID: input.nodeID,
              kind: "note",
              title: `Decision note: ${input.kind}`,
              mimeType: "text/markdown",
              data: { evidence: input.evidence },
            },
          ]
        : []),
      {
        op: "create_decision",
        id: decisionID,
        nodeID: input.nodeID,
        runID,
        artifactID,
        kind: input.kind,
        state: input.state,
        rationale: input.rationale,
        actor,
        refs: {
          plugin: manifest.id,
          evidenceArtifactID: artifactID,
          findingKind,
        },
      },
    ],
  })
}

// ─── Incremental graph-editing proposals ─────────────────────────────
//
// The four functions below are the plumbing behind the matching tools
// registered in `server-hook.ts` (`evidence_add`, `surface_add`,
// `control_add`, `assumption_add`). Each emits a single-node-centric
// proposal so AI-driven audits can grow the security graph one item
// at a time (finding more evidence, discovering a new attack surface
// mid-audit, spotting an undocumented control, etc.) without having to
// re-seed the whole graph via `bootstrap`.

export async function proposeEvidenceAdd(host: PluginHostAPI, raw: z.input<typeof EvidenceAddInput>) {
  const input = EvidenceAddInput.parse(raw)
  const actor = fromHostActor(host.actor.current())
  const pid = projectID(host)
  const finding = await Domain.getNode(input.findingID)
  if (!finding || (finding.kind !== "finding" && finding.kind !== "risk")) {
    throw new Error(`evidence_add: node ${input.findingID} is not a finding/risk node`)
  }
  const findingKind = nodeFindingKind(finding)
  const runID = host.identifier.ascending("run")
  const artifactID = host.identifier.ascending("artifact")

  return Domain.propose({
    projectID: pid,
    title: `Evidence: ${input.title}`,
    actor,
    rationale:
      "Attach additional evidence to an existing finding so reviewers can see the full chain of observation → claim → proof.",
    refs: {
      plugin: manifest.id,
      workflow: "evidence_add",
      findingID: input.findingID,
      findingKind,
    },
    changes: [
      {
        op: "create_run",
        id: runID,
        nodeID: input.findingID,
        sessionID: input.sessionID,
        kind: "analysis",
        status: "completed",
        title: `Evidence gathered: ${input.title}`,
        actor,
        manifest: {
          workflow: "evidence_add",
          findingKind,
          severity: input.severity,
          confidence: input.confidence,
        },
        startedAt: ts(),
        finishedAt: ts(),
      },
      {
        op: "create_artifact",
        id: artifactID,
        runID,
        nodeID: input.findingID,
        kind: "evidence",
        title: input.title,
        mimeType: "text/markdown",
        data: {
          evidence: input.content,
          findingKind,
          severity: input.severity,
          confidence: input.confidence,
        },
      },
    ],
  })
}

export async function proposeSurfaceAdd(host: PluginHostAPI, raw: z.input<typeof SurfaceAddInput>) {
  const input = SurfaceAddInput.parse(raw)
  const actor = fromHostActor(host.actor.current())
  const pid = projectID(host)
  const nodeID = host.identifier.ascending("node")
  const targetID = input.targetID ?? (await defaultTargetID(pid))

  return Domain.propose({
    projectID: pid,
    title: `Surface: ${input.title}`,
    actor,
    rationale:
      "Add an attack-surface node to the security graph. Surfaces represent entry points, trust boundaries, or data-flow junctions that later findings can hang off of.",
    refs: { plugin: manifest.id, workflow: "surface_add" },
    changes: [
      {
        op: "create_node",
        id: nodeID,
        kind: "surface",
        title: input.title,
        body: input.description,
        data: { ...(input.data ?? {}), status: "added" },
      },
      ...(targetID
        ? [
            {
              op: "create_edge" as const,
              kind: "affects",
              sourceID: nodeID,
              targetID,
              note: "New surface added to the target attack surface map.",
            },
          ]
        : []),
    ],
  })
}

export async function proposeControlAdd(host: PluginHostAPI, raw: z.input<typeof ControlAddInput>) {
  const input = ControlAddInput.parse(raw)
  const actor = fromHostActor(host.actor.current())
  const pid = projectID(host)
  const nodeID = host.identifier.ascending("node")

  return Domain.propose({
    projectID: pid,
    title: `Control: ${input.title}`,
    actor,
    rationale:
      "Record a security control, invariant, or guardrail. Controls can later be linked to findings via `mitigates` edges so reviewers see what defends against each risk.",
    refs: { plugin: manifest.id, workflow: "control_add" },
    changes: [
      {
        op: "create_node",
        id: nodeID,
        kind: "control",
        title: input.title,
        body: input.description,
        data: { ...(input.data ?? {}), status: "added" },
      },
      ...(input.mitigatesFindingID
        ? [
            {
              op: "create_edge" as const,
              kind: "mitigates",
              sourceID: nodeID,
              targetID: input.mitigatesFindingID,
              note: "Control proposed as a mitigation for this finding.",
            },
          ]
        : []),
    ],
  })
}

export async function proposeAssumptionAdd(host: PluginHostAPI, raw: z.input<typeof AssumptionAddInput>) {
  const input = AssumptionAddInput.parse(raw)
  const actor = fromHostActor(host.actor.current())
  const pid = projectID(host)
  const nodeID = host.identifier.ascending("node")

  return Domain.propose({
    projectID: pid,
    title: `Assumption: ${input.title}`,
    actor,
    rationale:
      "Record a security assumption explicitly. Hidden assumptions are a frequent source of missed findings — surfacing them as graph nodes makes them reviewable.",
    refs: { plugin: manifest.id, workflow: "assumption_add" },
    changes: [
      {
        op: "create_node",
        id: nodeID,
        kind: "assumption",
        title: input.title,
        body: input.description,
        data: { ...(input.data ?? {}), status: "added" },
      },
      ...(input.derivedFromSurfaceID
        ? [
            {
              op: "create_edge" as const,
              kind: "derived_from",
              sourceID: nodeID,
              targetID: input.derivedFromSurfaceID,
              note: "This assumption was surfaced while mapping the attack surface.",
            },
          ]
        : []),
    ],
  })
}
