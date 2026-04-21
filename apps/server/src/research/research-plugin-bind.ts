/**
 * Test-time / fallback host bind for the research plugin.
 *
 * The canonical path is: Product.serverState() runs the research
 * server-hook during InstanceBootstrap, which calls bindHost(host).
 *
 * But apps/server tests often import the plugin's business modules
 * directly (e.g. `ExperimentRemoteTask`) without booting an instance,
 * so the server-hook never fires and `bridge()` would throw.
 *
 * This shim module is imported as a side-effect by every
 * `apps/server/src/research/*.ts` re-export. It lazily creates a plugin
 * host scoped to the "research" plugin id and binds it once. In a real
 * runtime the server-hook also calls bindHost, but bindHost is
 * idempotent — the last writer wins and the host API it produces is
 * equivalent.
 */
import { bindHost } from "@palimpsest/plugin-research/server/host-bridge"

import { createPluginHost } from "@/plugin/host"

let bound = false

export function ensureResearchPluginBound(): void {
  if (bound) return
  bound = true
  bindHost(createPluginHost("research"))
}

ensureResearchPluginBound()
