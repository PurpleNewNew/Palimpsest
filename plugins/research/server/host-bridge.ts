import type { PluginHostAPI } from "@palimpsest/plugin-sdk/host"

/**
 * Late-bound access to the Palimpsest host API for plugin modules.
 *
 * Research business modules (experiment-execution-watch.ts,
 * experiment-watcher.ts, experiment-remote-task.ts,
 * experiment-remote-task-watcher.ts, …) can't be factory-functions
 * without a significant refactor of every host-side caller, because
 * they currently expose their functionality as top-level `namespace`s
 * with direct database access. To make migration incremental we bind
 * the host once per instance in the server-hook and let every module
 * reach it through `bridge()`.
 *
 * Usage:
 *
 * ```ts
 * // plugins/research/server/server-hook.ts
 * import { bindHost } from "./host-bridge"
 *
 * export const serverHook: PluginServerHook = async (ctx) => {
 *   bindHost(ctx.host)
 *   // ... set up scheduler, routes, etc.
 * }
 *
 * // plugins/research/server/some-module.ts
 * import { bridge } from "./host-bridge"
 * const client = bridge().db.use(...)
 * ```
 *
 * Module-load order is safe in practice: the research plugin modules
 * are only reached through host routes or Hono middleware, which all
 * run after InstanceBootstrap → Product.init() → serverHook. In the
 * narrow window between import-time and server-hook execution, any
 * accidental access to `bridge()` throws a loud error instead of
 * silently pointing at undefined primitives.
 */

let host: PluginHostAPI | null = null

export function bindHost(next: PluginHostAPI): void {
  host = next
}

export function bridge(): PluginHostAPI {
  if (!host) {
    throw new Error(
      "@palimpsest/plugin-research: host not bound yet. Make sure server-hook.ts runs (InstanceBootstrap) before any plugin business module is imported.",
    )
  }
  return host
}
