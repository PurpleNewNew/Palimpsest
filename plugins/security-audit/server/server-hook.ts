import type { PluginServerHook } from "@palimpsest/plugin-sdk/host"
import { Hono } from "hono"
import type { Context } from "hono"
import z from "zod"

import {
  AssumptionAddInput,
  BootstrapInput,
  ControlAddInput,
  EvidenceAddInput,
  FindingHypothesisInput,
  FindingValidationInput,
  RiskDecisionInput,
  SurfaceAddInput,
  findings,
  graph,
  nodeSession,
  overview,
  proposeAssumptionAdd,
  proposeBootstrap,
  proposeControlAdd,
  proposeEvidenceAdd,
  proposeFindingHypothesis,
  proposeFindingValidation,
  proposeRiskDecision,
  proposeSurfaceAdd,
  status,
} from "./security"
import { SecurityAuditAgents } from "./agents"

export const serverHook: PluginServerHook = async ({ host, pluginID }) => {
  const log = host.log.create({ service: "security-audit" })

  const CommittedEvent = host.bus.define(
    "domain.proposal.committed",
    z.object({
      id: z.string(),
      projectID: z.string(),
      proposalID: z.string().optional(),
      reviewID: z.string().optional(),
      changes: z.array(z.record(z.string(), z.unknown())),
    }).passthrough(),
  )

  const unsubCommits = host.bus.subscribe(CommittedEvent, (event) => {
    const props = event.properties as z.infer<typeof CommittedEvent.properties>
    const securityChanges = (props.changes ?? []).filter((change: Record<string, unknown>) => {
      const kind = change.kind
      return typeof kind === "string" && ["finding", "risk", "control", "surface", "assumption"].includes(kind)
    })
    if (securityChanges.length === 0) return
    log.info("security proposal committed", {
      pluginID,
      commitID: props.id,
      changeCount: securityChanges.length,
    })
  })

  const api = new Hono()
    .get("/ping", (c: Context) => c.json({ ok: true, pluginID }))
    .get("/status", async (c: Context) => c.json(await status(host)))
    .get("/overview", async (c: Context) => c.json(await overview(host)))
    .get("/graph", async (c: Context) => c.json(await graph(host)))
    .get("/findings", async (c: Context) => c.json(await findings(host)))
    .post("/node-session", async (c: Context) => c.json(await nodeSession(host, await c.req.json())))
    .post("/bootstrap", async (c: Context) => c.json(await proposeBootstrap(host, await c.req.json().catch(() => ({})))))
    .post("/finding-hypothesis", async (c: Context) =>
      c.json(await proposeFindingHypothesis(host, FindingHypothesisInput.parse(await c.req.json()))),
    )
    .post("/validate-finding", async (c: Context) =>
      c.json(await proposeFindingValidation(host, FindingValidationInput.parse(await c.req.json()))),
    )
    .post("/risk-decision", async (c: Context) =>
      c.json(await proposeRiskDecision(host, RiskDecisionInput.parse(await c.req.json()))),
    )
  host.routes.register(api)

  await host.tools.register({
    id: "bootstrap",
    init: async () => ({
      description: "Seed a security audit graph for the current project and create a reviewable bootstrap proposal.",
      parameters: BootstrapInput,
      execute: async (args) => {
        const proposal = await proposeBootstrap(host, args)
        return {
          title: "security-audit.bootstrap",
          output: `Created bootstrap proposal ${proposal.id} for ${proposal.title ?? "security graph seeding"}.`,
          metadata: {
            proposalID: proposal.id,
            projectID: proposal.projectID,
            status: proposal.status,
          },
        }
      },
    }),
  })

  await host.tools.register({
    id: "finding_hypothesis",
    init: async () => ({
      description: "Create a pending proposal for a security finding hypothesis with linked risk and evidence nodes.",
      parameters: FindingHypothesisInput,
      execute: async (args) => {
        const proposal = await proposeFindingHypothesis(host, args)
        return {
          title: "security-audit.finding-hypothesis",
          output: `Created finding hypothesis proposal ${proposal.id} for ${args.title}.`,
          metadata: {
            proposalID: proposal.id,
            severity: args.severity,
            confidence: args.confidence,
          },
        }
      },
    }),
  })

  await host.tools.register({
    id: "finding_validation",
    init: async () => ({
      description: "Create a validation proposal for an existing security finding, including evidence and a validation run.",
      parameters: FindingValidationInput,
      execute: async (args) => {
        const proposal = await proposeFindingValidation(host, args)
        return {
          title: "security-audit.finding-validation",
          output: `Created validation proposal ${proposal.id} for finding ${args.findingID}.`,
          metadata: {
            proposalID: proposal.id,
            findingID: args.findingID,
            outcome: args.outcome,
          },
        }
      },
    }),
  })

  await host.tools.register({
    id: "risk_decision",
    init: async () => ({
      description: "Create a reviewable risk decision proposal for a finding or risk node.",
      parameters: RiskDecisionInput,
      execute: async (args) => {
        const proposal = await proposeRiskDecision(host, args)
        return {
          title: "security-audit.risk-decision",
          output: `Created risk decision proposal ${proposal.id} with kind ${args.kind}.`,
          metadata: {
            proposalID: proposal.id,
            nodeID: args.nodeID,
            kind: args.kind,
            state: args.state,
          },
        }
      },
    }),
  })

  // Read-only query tools. The agents (see `./agents.ts`) reference
  // these by their unprefixed ids in permission rules, so we register
  // them with `rawId: true` to keep the permission config readable.
  // Existing proposal tools above (bootstrap / finding_hypothesis /
  // finding_validation / risk_decision) keep the auto-prefixed
  // `security-audit_*` id because an existing test (apps/server/test/
  // plugin/host-api.test.ts) pins those names.
  await host.tools.register({
    id: "security_overview",
    rawId: true,
    init: async () => ({
      description:
        "Project-level security overview: scope, taxonomy, node/run/decision counts by kind, and recent pending proposals / commits.",
      parameters: z.object({}),
      execute: async () => {
        const data = await overview(host)
        return {
          title: "security.overview",
          output: JSON.stringify(data, null, 2),
          metadata: { projectID: data.projectID },
        }
      },
    }),
  })

  await host.tools.register({
    id: "security_findings",
    rawId: true,
    init: async () => ({
      description:
        "All findings with severity / confidence / evidence-count / linked-decisions, plus the surfaces, controls, and risks they relate to.",
      parameters: z.object({}),
      execute: async () => {
        const data = await findings(host)
        return {
          title: "security.findings",
          output: JSON.stringify(data, null, 2),
          metadata: {
            findingCount: data.findings.length,
            riskCount: data.risks.length,
            pendingProposalCount: data.pendingProposals.length,
          },
        }
      },
    }),
  })

  await host.tools.register({
    id: "security_graph",
    rawId: true,
    init: async () => ({
      description:
        "Full security graph: nodes (targets / surfaces / findings / controls / assumptions / risks), edges, runs, decisions, artifacts, and pending proposals. Use this when you need the whole picture.",
      parameters: z.object({}),
      execute: async () => {
        const data = await graph(host)
        return {
          title: "security.graph",
          output: JSON.stringify(data, null, 2),
          metadata: {
            nodeCount: data.nodes.length,
            edgeCount: data.edges.length,
          },
        }
      },
    }),
  })

  // Incremental graph-editing tools. Complement the multi-node
  // proposal tools above (`bootstrap`, `finding_hypothesis`,
  // `finding_validation`, `risk_decision`) for the common mid-audit
  // case of growing the graph one node at a time — adding an extra
  // evidence artifact to an existing finding, recording a newly
  // discovered attack surface, pinning down an undocumented control,
  // surfacing a hidden assumption. All use `rawId: true` for readable
  // permission rules.
  await host.tools.register({
    id: "evidence_add",
    rawId: true,
    init: async () => ({
      description:
        "Attach an additional evidence artifact to an existing finding or risk node. Produces a review-gated proposal (run + artifact), so new proof lands with audit trail.",
      parameters: EvidenceAddInput,
      execute: async (args) => {
        const proposal = await proposeEvidenceAdd(host, args)
        return {
          title: "security.evidence-add",
          output: `Created evidence proposal ${proposal.id} for finding ${args.findingID}.`,
          metadata: { proposalID: proposal.id, findingID: args.findingID },
        }
      },
    }),
  })

  await host.tools.register({
    id: "surface_add",
    rawId: true,
    init: async () => ({
      description:
        "Add a newly discovered attack surface (entry point, trust boundary, data-flow junction) to the security graph. Emits a proposal with the surface node plus an edge to the audit target when one exists.",
      parameters: SurfaceAddInput,
      execute: async (args) => {
        const proposal = await proposeSurfaceAdd(host, args)
        return {
          title: "security.surface-add",
          output: `Created surface proposal ${proposal.id} for ${args.title}.`,
          metadata: { proposalID: proposal.id },
        }
      },
    }),
  })

  await host.tools.register({
    id: "control_add",
    rawId: true,
    init: async () => ({
      description:
        "Record a security control, invariant, or guardrail as a node in the graph. Optionally link it to a specific finding via a `mitigates` edge.",
      parameters: ControlAddInput,
      execute: async (args) => {
        const proposal = await proposeControlAdd(host, args)
        return {
          title: "security.control-add",
          output: `Created control proposal ${proposal.id} for ${args.title}.`,
          metadata: {
            proposalID: proposal.id,
            mitigatesFindingID: args.mitigatesFindingID,
          },
        }
      },
    }),
  })

  await host.tools.register({
    id: "assumption_add",
    rawId: true,
    init: async () => ({
      description:
        "Surface a security assumption as a first-class graph node. Hidden assumptions are a frequent source of missed findings; making them reviewable improves audit quality.",
      parameters: AssumptionAddInput,
      execute: async (args) => {
        const proposal = await proposeAssumptionAdd(host, args)
        return {
          title: "security.assumption-add",
          output: `Created assumption proposal ${proposal.id} for ${args.title}.`,
          metadata: {
            proposalID: proposal.id,
            derivedFromSurfaceID: args.derivedFromSurfaceID,
          },
        }
      },
    }),
  })

  // Register the security-audit agents. Each carries
  // `lensID: "security-audit.workbench"` so `Agent.list()` only
  // surfaces them in projects whose active lens set contains that
  // lens — i.e. research / plain projects do not see
  // `@security_project_init`, `@finding_hypothesis`, etc. in the @
  // picker, mirroring the research plugin's 17-agent registration.
  for (const def of SecurityAuditAgents) await host.agents.register(def)

  log.info("security-audit server hook initialized", {
    pluginID,
    agentsRegistered: SecurityAuditAgents.length,
  })

  return {
    dispose: async () => {
      unsubCommits()
      log.info("security-audit server hook disposed", { pluginID })
    },
  }
}
