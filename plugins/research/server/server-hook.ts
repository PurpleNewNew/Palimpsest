import type { PluginServerHook } from "@palimpsest/plugin-sdk/host"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import z from "zod"

import { bindHost } from "./host-bridge"
import { Research, initResearchEvents } from "./research"
import { ResearchProjectTable, atomKinds, linkKinds } from "./research-schema"
import { routes as researchRoutes } from "./routes"
import { SourceQueryTool, SourceStatusUpdateTool } from "./tools/source"
import {
  AtomCreateTool,
  AtomQueryTool,
  AtomBatchCreateTool,
  AtomStatusUpdateTool,
  AtomUpdateTool,
  AtomDeleteTool,
  AtomRelationQueryTool,
  AtomRelationCreateTool,
  AtomRelationUpdateTool,
  AtomRelationDeleteTool,
} from "./tools/atom"
import { AtomGraphPromptTool } from "./tools/atom-graph-prompt"
import { AtomGraphPromptSmartTool } from "./tools/atom-graph-prompt-smart"
import { ResearchBackgroundTool, ResearchGoalTool, ResearchMacroTool } from "./tools/research-background"
import { ResearchInfoTool } from "./tools/research-info"
import { ResearchAgents } from "./agents"

/**
 * Server-side initialization for the research plugin.
 *
 * Uses only @palimpsest/plugin-sdk/host — no imports from @/... or
 * @palimpsest/server/... are allowed (enforced by the plugin
 * import-boundary test).
 *
 * Beyond registering tools, agents, and routes, this hook also:
 *
 *   1. Subscribes to `domain.proposal.committed` so that every accepted
 *      change which touches an atom-kind node or atom-kind edge is
 *      mirrored as a `research.graph.updated` plugin event. UI consumers
 *      (atom graph, session tree) listen for the plugin event without
 *      knowing about the underlying Domain change vocabulary.
 *
 *   2. Ensures the project taxonomy registers the atom node kinds
 *      (question/hypothesis/claim/finding/source) and atom relation
 *      kinds (motivates/derives/.../evidence_from). Without this the
 *      `Domain.propose({ changes: [{ op: "create_node", kind: ... }] })`
 *      call would be rejected by `Domain.rule()`.
 */
export const serverHook: PluginServerHook = async ({ host, pluginID }) => {
  bindHost(host)
  initResearchEvents()
  const log = host.log.create({ service: "observer" })
  let heartbeats = 0

  const CommittedEvent = host.bus.define(
    "domain.proposal.committed",
    z
      .object({
        id: z.string(),
        projectID: z.string(),
        proposalID: z.string().optional(),
        reviewID: z.string().optional(),
        changes: z.array(z.record(z.string(), z.unknown())),
      })
      .passthrough(),
  )

  const unsubCommits = host.bus.subscribe(CommittedEvent, async (event) => {
    const changes = event.properties.changes ?? []
    if (!changes.some(touchesAtomGraph)) return
    const research = host.db.use((db) =>
      db
        .select()
        .from(ResearchProjectTable)
        .where(eq(ResearchProjectTable.project_id, event.properties.projectID))
        .get(),
    )
    if (!research) return
    await host.bus.publish(Research.Event.GraphUpdated, {
      researchProjectId: research.research_project_id,
    })
  })

  host.scheduler.register({
    id: "heartbeat",
    interval: 60_000,
    scope: "instance",
    run: async () => {
      heartbeats += 1
    },
  })

  const api = new Hono()
    .get("/ping", (c) => c.json({ ok: true, pluginID, heartbeats }))
    .get("/status", (c) =>
      c.json({
        pluginID,
        heartbeats,
        project: host.instance.project(),
        metadataDir: host.project.metadataDir(host.instance.worktree()),
      }),
    )
  host.routes.register(api)
  host.routes.register(researchRoutes)

  await ensureTaxonomy(host.instance.project().id)

  await host.tools.register({
    id: "hello",
    init: async () => ({
      description: "Research plugin smoke tool: echoes the input back with the worktree.",
      parameters: z.object({ message: z.string().default("hi") }),
      execute: async (args) => ({
        title: "research.hello",
        output: `${args.message} from research plugin at ${host.instance.worktree()}`,
        metadata: { worktree: host.instance.worktree() },
      }),
    }),
  })

  // Register the research tool namespace. `rawId: true` on each
  // definition keeps the public tool id unprefixed (e.g. `atom_query`
  // rather than `research_atom_query`) so agent permissions, prompts,
  // and existing call sites keep matching.
  const researchTools = [
    SourceQueryTool,
    SourceStatusUpdateTool,
    AtomCreateTool,
    AtomQueryTool,
    AtomBatchCreateTool,
    AtomStatusUpdateTool,
    AtomUpdateTool,
    AtomDeleteTool,
    AtomRelationQueryTool,
    AtomRelationCreateTool,
    AtomRelationUpdateTool,
    AtomRelationDeleteTool,
    AtomGraphPromptTool,
    AtomGraphPromptSmartTool,
    ResearchBackgroundTool,
    ResearchGoalTool,
    ResearchMacroTool,
    ResearchInfoTool,
  ]
  for (const tool of researchTools) await host.tools.register(tool)

  for (const def of ResearchAgents) await host.agents.register(def)

  log.info("research server hook initialized", {
    pluginID,
    toolsRegistered: researchTools.length,
    agentsRegistered: ResearchAgents.length,
  })

  return {
    dispose: async () => {
      unsubCommits()
      log.info("research server hook disposed", { pluginID })
    },
  }

  async function ensureTaxonomy(projectID: string) {
    const current = await host.domain.taxonomy(projectID)
    const merged = {
      nodeKinds: union(current.nodeKinds, atomKinds),
      edgeKinds: union(current.edgeKinds, linkKinds),
    }
    if (
      merged.nodeKinds.length === current.nodeKinds.length &&
      merged.edgeKinds.length === current.edgeKinds.length
    ) {
      return
    }
    await host.domain.setTaxonomy({
      projectID,
      nodeKinds: merged.nodeKinds,
      edgeKinds: merged.edgeKinds,
    })
  }

  function touchesAtomGraph(change: unknown): boolean {
    if (!change || typeof change !== "object") return false
    const op = (change as { op?: string }).op
    if (!op) return false
    if (op === "create_node" || op === "update_node" || op === "delete_node") {
      const kind = (change as { kind?: string }).kind
      if (!kind) return op === "delete_node"
      return (atomKinds as readonly string[]).includes(kind)
    }
    if (op === "create_edge" || op === "update_edge" || op === "delete_edge") {
      const kind = (change as { kind?: string }).kind
      if (!kind) return op === "delete_edge"
      return (linkKinds as readonly string[]).includes(kind)
    }
    return false
  }

  function union<T extends string>(a: string[], b: readonly T[]): string[] {
    const set = new Set<string>(a)
    for (const value of b) set.add(value)
    return Array.from(set)
  }
}
