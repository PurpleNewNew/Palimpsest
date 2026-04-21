import type { PluginServerHook } from "@palimpsest/plugin-sdk/host"
import z from "zod"

/**
 * Server-side initialization for the research plugin.
 *
 * Uses only @palimpsest/plugin-sdk/host — no imports from @/... or
 * @palimpsest/server/... are allowed (enforced by the plugin
 * import-boundary test).
 *
 * For Sprint 3.5 this hook is intentionally minimal: it subscribes to
 * the domain proposal/commit bus and logs research-relevant activity.
 * The heavy research business logic (research.ts, experiment-*.ts,
 * routes/research.ts) stays in the host as tracked migration debt
 * (see specs Section 15.2 and 18). That migration unblocks once
 * cross-package schema packaging is settled.
 */
export const serverHook: PluginServerHook = async ({ host, pluginID }) => {
  const log = host.log.create({ service: "observer" })

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

  log.info("research server hook initialized", { pluginID })

  return {
    dispose: async () => {
      unsubCommits()
      log.info("research server hook disposed", { pluginID })
    },
  }
}
