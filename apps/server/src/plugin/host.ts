import type {
  BusEventDefinition,
  PluginActor,
  PluginHostAPI,
  PluginLogger,
  PluginProject,
  PluginServerContext,
  PluginSession,
} from "@palimpsest/plugin-sdk/host"
import type { ZodType } from "zod"

import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Config } from "@/config/config"
import { ControlPlane } from "@/control-plane/control-plane"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { Log } from "@/util/log"
import { Slug } from "@palimpsest/shared/slug"

function fromSession(row: Awaited<ReturnType<typeof Session.get>>): PluginSession {
  return {
    id: row.id,
    projectID: row.projectID,
    parentID: row.parentID,
    directory: row.directory,
    time: row.time,
  }
}

export function createPluginHost(pluginID: string): PluginHostAPI {
  const tag = `plugin:${pluginID}`

  const log: PluginHostAPI["log"] = {
    create: (options) => {
      const inner = Log.create({ service: `${tag}:${options.service}` })
      return inner as unknown as PluginLogger
    },
  }

  const identifier: PluginHostAPI["identifier"] = {
    ascending: (prefix, existing) => Identifier.ascending(prefix as Parameters<typeof Identifier.ascending>[0], existing),
    slug: () => Slug.create(),
  }

  const db: PluginHostAPI["db"] = {
    use: Database.use,
    transaction: (callback) => Database.transaction(() => callback()),
  }

  const bus: PluginHostAPI["bus"] = {
    define<P>(type: string, schema: ZodType<P>): BusEventDefinition<P> {
      return BusEvent.define(type, schema) as unknown as BusEventDefinition<P>
    },
    publish: async <Def extends BusEventDefinition>(def: Def, properties: any) => {
      await Bus.publish(def as any, properties)
    },
    subscribe<Def extends BusEventDefinition>(
      def: Def,
      callback: (event: { type: Def["type"]; properties: any }) => void,
    ) {
      return Bus.subscribe(def as any, callback as any)
    },
    subscribeAll(callback) {
      return Bus.subscribeAll(callback as any)
    },
  }

  const session: PluginHostAPI["session"] = {
    get: async (id) => fromSession(await Session.get(id)),
  }

  const instance: PluginHostAPI["instance"] = {
    directory: () => Instance.directory,
    worktree: () => Instance.worktree,
    project: () => {
      const info = Instance.project
      const project: PluginProject = {
        id: info.id,
        worktree: info.worktree,
        name: info.name,
      }
      return project
    },
  }

  const config: PluginHostAPI["config"] = {
    get: async () => {
      const value = (await Config.get()) as unknown as Record<string, unknown>
      return value
    },
  }

  const actor: PluginHostAPI["actor"] = {
    current: () => {
      const resolved = ControlPlane.actor()
      if (!resolved) return undefined
      return resolved as PluginActor
    },
  }

  return {
    log,
    identifier,
    db,
    bus,
    session,
    instance,
    config,
    actor,
  }
}

export function createServerContext(pluginID: string): PluginServerContext {
  return {
    host: createPluginHost(pluginID),
    pluginID,
  }
}
