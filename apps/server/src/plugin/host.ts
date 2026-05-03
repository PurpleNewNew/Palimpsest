import type {
  BusEventDefinition,
  PluginActor,
  PluginAgentDefinition,
  PluginHostAPI,
  PluginLogger,
  PluginProject,
  PluginServerContext,
  PluginSession,
  PluginToolDefinition,
} from "@palimpsest/plugin-sdk/host"
import type { Hono } from "hono"
import type { ZodType } from "zod"

import { Auth } from "@/auth"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Config } from "@/config/config"
import { ControlPlane } from "@/control-plane/control-plane"
import { Env } from "@/env"
import { File } from "@/file"
import { FileTime } from "@/file/time"
import { FileWatcher } from "@/file/watcher"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProjectPaths } from "@/project/paths"
import { Project } from "@/project/project"
import { ModelsDev } from "@/provider/models"
import { Scheduler } from "@/scheduler"
import { Session } from "@/session"
import { Snapshot } from "@/snapshot"
import { Database } from "@/storage/db"
import { Filesystem } from "@/util/filesystem"
import { git } from "@/util/git"
import { computeExperimentDiff } from "@/util/git-diff"
import { Log } from "@/util/log"
import { Tool } from "@/tool/tool"
import { ToolRegistry } from "@/tool/registry"
import { AgentRegistry } from "@/agent/registry"
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

const routes = new Map<string, Hono[]>()

export function getPluginRoutes(): ReadonlyMap<string, readonly Hono[]> {
  return routes
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
    create: async (input) => fromSession(await Session.create({ parentID: input?.parentID, title: input?.title })),
    remove: async (id) => {
      await Session.remove(id)
    },
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
    reload: async (input) => {
      const next = input.project
        ? ({
            ...Instance.project,
            id: input.project.id,
            worktree: input.project.worktree,
            name: input.project.name,
          } satisfies Project.Info)
        : undefined
      await Instance.reload({ directory: input.directory, worktree: input.worktree, project: next })
    },
  }

  const config: PluginHostAPI["config"] = {
    get: async () => {
      const value = (await Config.get()) as unknown as Record<string, unknown>
      return value
    },
  }

  const env: PluginHostAPI["env"] = {
    get: (name) => Env.get(name as Parameters<typeof Env.get>[0]),
  }

  const authApi: PluginHostAPI["auth"] = {
    get: (providerID) => Auth.get(providerID),
  }

  const models: PluginHostAPI["models"] = {
    get: async () => {
      const value = (await ModelsDev.get()) as unknown as Record<string, unknown>
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

  const routesApi: PluginHostAPI["routes"] = {
    register: (subApp: Hono) => {
      const list = routes.get(pluginID) ?? []
      list.push(subApp)
      routes.set(pluginID, list)
    },
  }

  const scheduler: PluginHostAPI["scheduler"] = {
    register: (task) => {
      Scheduler.register({
        id: `${pluginID}:${task.id}`,
        interval: task.interval,
        run: task.run,
        scope: task.scope,
      })
    },
  }

  const files: PluginHostAPI["files"] = {
    recordRead: (sessionID, p) => FileTime.read(sessionID, p),
    assertRead: (sessionID, p) => FileTime.assert(sessionID, p),
    edited: async (p) => {
      await Bus.publish(File.Event.Edited, { file: p })
    },
    updated: async (p, event) => {
      await Bus.publish(FileWatcher.Event.Updated, {
        file: p,
        event: event === "delete" ? "unlink" : event,
      })
    },
  }

  const filesystem: PluginHostAPI["filesystem"] = {
    exists: Filesystem.exists,
    readText: Filesystem.readText,
    readJson: Filesystem.readJson,
    write: (p, content) => Filesystem.write(p, content as string | Buffer),
    writeJson: Filesystem.writeJson,
    mkdirp: Filesystem.mkdirp,
    resolve: Filesystem.resolve,
    isDir: Filesystem.isDir,
    stat: (p) => {
      const s = Filesystem.stat(p)
      if (!s) return undefined
      return {
        isDirectory: () => s.isDirectory(),
        isFile: () => s.isFile(),
        size: s.size,
      }
    },
  }

  const gitApi: PluginHostAPI["git"] = {
    run: (args, opts) => git(args, opts),
    diffFiles: (codePath, from, to) => computeExperimentDiff(codePath, from, to),
  }

  const snapshot: PluginHostAPI["snapshot"] = {
    track: () => Snapshot.track(),
    restore: (hash) => Snapshot.restore(hash),
    patch: (hash) => Snapshot.patch(hash),
    diff: (hash) => Snapshot.diff(hash),
    diffFull: (from, to) => Snapshot.diffFull(from, to),
  }

  const project: PluginHostAPI["project"] = {
    metadataDir: ProjectPaths.metadataDir,
    plansDir: ProjectPaths.plansDir,
    worktreesDir: ProjectPaths.worktreesDir,
    get: (id) => {
      const info = Project.get(id)
      if (!info) return undefined
      return { id: info.id, worktree: info.worktree, name: info.name }
    },
    fromDirectory: async (directory) => {
      const result = await Project.fromDirectory(directory)
      const info = result.project
      return { project: { id: info.id, worktree: info.worktree, name: info.name } }
    },
  }

  const agents: PluginHostAPI["agents"] = {
    register: async (def: PluginAgentDefinition) => {
      AgentRegistry.register(pluginID, def)
    },
  }

  const tools: PluginHostAPI["tools"] = {
    register: async <P extends ZodType, M extends Record<string, unknown>>(def: PluginToolDefinition<P, M>) => {
      const prefixed = def.rawId ? def.id : `${pluginID}_${def.id}`
      const wrapped = Tool.define<P, M>(prefixed, async (ctx) => {
        const inner = await def.init({ agent: ctx?.agent?.name })
        return {
          description: inner.description,
          parameters: inner.parameters,
          execute: async (args, outerCtx) => {
            const pluginCtx = {
              sessionID: outerCtx.sessionID,
              messageID: outerCtx.messageID,
              agent: outerCtx.agent,
              abort: outerCtx.abort,
              callID: outerCtx.callID,
              metadata: outerCtx.metadata,
              ask: (req: {
                permission: string
                patterns: string[]
                always?: string[]
                metadata?: Record<string, unknown>
              }) => outerCtx.ask({ ...req, always: req.always ?? [], metadata: req.metadata ?? {} }),
            }
            const result = await inner.execute(args, pluginCtx)
            return {
              title: result.title,
              output: result.output,
              metadata: result.metadata,
            }
          },
          formatValidationError: inner.formatValidationError,
        }
      })
      await ToolRegistry.register(wrapped)
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
    env,
    auth: authApi,
    models,
    actor,
    routes: routesApi,
    scheduler,
    files,
    filesystem,
    git: gitApi,
    snapshot,
    project,
    tools,
    agents,
  }
}

export function createServerContext(pluginID: string): PluginServerContext {
  return {
    host: createPluginHost(pluginID),
    pluginID,
  }
}
