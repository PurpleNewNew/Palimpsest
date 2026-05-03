import type { PluginServerHook } from "@palimpsest/plugin-sdk/host"
import { Hono } from "hono"
import type { Context } from "hono"
import z from "zod"

import {
  BootstrapInput,
  FindingHypothesisInput,
  FindingValidationInput,
  RiskDecisionInput,
  findings,
  graph,
  nodeSession,
  overview,
  proposeBootstrap,
  proposeFindingHypothesis,
  proposeFindingValidation,
  proposeRiskDecision,
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
