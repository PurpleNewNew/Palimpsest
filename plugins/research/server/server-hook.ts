import type { PluginServerHook } from "@palimpsest/plugin-sdk/host"
import { Hono } from "hono"
import z from "zod"

import { bindHost } from "./host-bridge"
import { routes as researchRoutes } from "./routes"
import { ArticleQueryTool, ArticleStatusUpdateTool } from "./tools/article"
import {
  AtomCreateTool,
  AtomQueryTool,
  AtomBatchCreateTool,
  AtomStatusUpdateTool,
  AtomDeleteTool,
  AtomRelationQueryTool,
  AtomRelationCreateTool,
  AtomRelationDeleteTool,
} from "./tools/atom"
import { AtomGraphPromptTool } from "./tools/atom-graph-prompt"
import { AtomGraphPromptSmartTool } from "./tools/atom-graph-prompt-smart"
import { ExperimentCreateTool } from "./tools/experiment"
import { ExperimentQueryTool } from "./tools/experiment-query"
import { ExperimentWatchTool } from "./tools/experiment-watch"
import { ExperimentExecutionWatchInitTool, ExperimentExecutionWatchUpdateTool } from "./tools/experiment-execution-watch"
import { ExperimentRemoteTaskGetTool, ExperimentRemoteTaskStartTool } from "./tools/experiment-remote-task"
import { ResearchBackgroundTool, ResearchGoalTool, ResearchMacroTool } from "./tools/research-background"
import { ResearchInfoTool } from "./tools/research-info"

/**
 * Server-side initialization for the research plugin.
 *
 * Uses only @palimpsest/plugin-sdk/host — no imports from @/... or
 * @palimpsest/server/... are allowed (enforced by the plugin
 * import-boundary test).
 *
 * Stage B turns this hook into a real smoke test of the expanded host
 * API: it subscribes to the domain bus, registers a scheduled heartbeat
 * via `host.scheduler`, and mounts a small Hono sub-app under
 * `/api/plugin/research/*` via `host.routes.register`. The heavier
 * research business logic gets migrated in (see specs Section 20
 * Stage B breakdown).
 */
export const serverHook: PluginServerHook = async ({ host, pluginID }) => {
  bindHost(host)
  const log = host.log.create({ service: "observer" })
  let heartbeats = 0

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
    const changes = event.properties.changes ?? []
    log.info("saw proposal commit", {
      pluginID,
      commitID: event.properties.id,
      changeCount: changes.length,
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
    ArticleQueryTool,
    ArticleStatusUpdateTool,
    AtomCreateTool,
    AtomQueryTool,
    AtomBatchCreateTool,
    AtomStatusUpdateTool,
    AtomDeleteTool,
    AtomRelationQueryTool,
    AtomRelationCreateTool,
    AtomRelationDeleteTool,
    AtomGraphPromptTool,
    AtomGraphPromptSmartTool,
    ExperimentCreateTool,
    ExperimentQueryTool,
    ExperimentWatchTool,
    ExperimentExecutionWatchInitTool,
    ExperimentExecutionWatchUpdateTool,
    ExperimentRemoteTaskStartTool,
    ExperimentRemoteTaskGetTool,
    ResearchBackgroundTool,
    ResearchGoalTool,
    ResearchMacroTool,
    ResearchInfoTool,
  ]
  for (const tool of researchTools) await host.tools.register(tool)

  log.info("research server hook initialized", { pluginID, toolsRegistered: researchTools.length })

  return {
    dispose: async () => {
      unsubCommits()
      log.info("research server hook disposed", { pluginID })
    },
  }
}
