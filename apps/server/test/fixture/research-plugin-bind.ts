import { createPluginHost } from "../../src/plugin/host"
import { bindHost } from "@palimpsest/plugin-research/server/host-bridge"

/**
 * Bind a real `PluginHostAPI` instance to the research plugin's host
 * bridge so that tool modules calling `bridge()` work outside of the
 * normal `InstanceBootstrap → Product.init() → serverHook` flow.
 *
 * In production the bind is performed once per Instance from
 * `plugins/research/server/server-hook.ts`. Test files that import
 * research tool modules directly (e.g. `community.ts`,
 * `token-budget.ts`, `builder.ts`) skip that flow and trip the loud
 * "host not bound yet" error from `host-bridge.ts`.
 *
 * Importing this module for its side effect (or calling `bindResearchPlugin()`
 * once at the top of a test file) installs a real host built from the
 * server's internal namespaces. The host's `instance.directory()` etc.
 * are getters reading dynamic scope from `Instance.provide({...})`, so
 * a single bind survives every per-test `Instance.provide` block.
 *
 * Mirrors the design hinted at by `helpers.ts` lines 49 / 91-96
 * comments which explicitly call out a "research-plugin-bind.ts during
 * tests" hook point.
 */

let bound = false

export function bindResearchPlugin(): void {
  if (bound) return
  bindHost(createPluginHost("@palimpsest/plugin-research"))
  bound = true
}

bindResearchPlugin()
