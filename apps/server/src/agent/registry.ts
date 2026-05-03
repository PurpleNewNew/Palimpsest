import type { PluginAgentDefinition, PluginAgentInfo } from "@palimpsest/plugin-sdk/host"

import { Instance } from "../project/instance"

/**
 * Per-instance registry of plugin-contributed agents.
 *
 * Plugins register agents via `host.agents.register(...)` from inside
 * their `server(host)` hook (see
 * `apps/server/src/plugin/host.ts` → `agents.register`). The host hook
 * runs inside `Instance.provide`, so registrations are scoped to the
 * current project's Instance and will not leak across projects.
 *
 * `Agent.state` (apps/server/src/agent/agent.ts) reads `all()` during
 * its lazy init to merge plugin-contributed agents on top of the host
 * defaults. `Agent.list()` / `Agent.get()` then filter visibility by
 * the current project's active lens set — an agent with `lensID` is
 * only visible when that lens is installed for the project.
 */
export namespace AgentRegistry {
  export type Entry = {
    pluginID: string
    lensID?: string
    info: PluginAgentInfo
  }

  const state = Instance.state(() => {
    return {
      entries: new Map<string, Entry>(),
    }
  })

  /**
   * Register (or replace) a plugin-contributed agent. Keyed on
   * `info.name`; duplicate registrations from the same or different
   * plugins last-write-wins.
   */
  export function register(pluginID: string, def: PluginAgentDefinition) {
    state().entries.set(def.info.name, {
      pluginID,
      lensID: def.lensID,
      info: def.info,
    })
  }

  /**
   * Snapshot of all plugin-contributed agents registered against the
   * current Instance. `Agent.state` calls this once during init.
   */
  export function all(): Entry[] {
    return [...state().entries.values()]
  }
}
