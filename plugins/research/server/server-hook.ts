import type { PluginServerHook } from "@palimpsest/plugin-sdk/host"
import { Hono } from "hono"
import z from "zod"

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
      }),
    )
  host.routes.register(api)

  log.info("research server hook initialized", { pluginID })

  return {
    dispose: async () => {
      unsubCommits()
      log.info("research server hook disposed", { pluginID })
    },
  }
}
