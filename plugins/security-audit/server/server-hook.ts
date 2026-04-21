import type { PluginServerHook } from "@palimpsest/plugin-sdk/host"

/**
 * Security-audit plugin server hook.
 *
 * Structural parity with the research plugin. For Sprint 3.5 this hook
 * is a no-op beyond log registration; the audit rule engine, scan
 * adapters, and findings ingestion will land here once Sprint 4.5
 * opens the door for richer plugin workloads.
 */
export const serverHook: PluginServerHook = async ({ host, pluginID }) => {
  const log = host.log.create({ service: "bootstrap" })
  log.info("security-audit server hook initialized", { pluginID })
  return {}
}
