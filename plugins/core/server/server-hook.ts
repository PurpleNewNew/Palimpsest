import type { PluginServerHook } from "@palimpsest/plugin-sdk/host"

/**
 * Core plugin server hook.
 *
 * Core has no plugin-specific background work; it owns the base shell
 * and canonical tabs. This hook exists for symmetry with research and
 * security-audit so every builtin plugin is loaded through the same
 * `server(host)` contract.
 */
export const serverHook: PluginServerHook = async ({ host, pluginID }) => {
  const log = host.log.create({ service: "bootstrap" })
  log.info("core server hook initialized", { pluginID })
  return {}
}
