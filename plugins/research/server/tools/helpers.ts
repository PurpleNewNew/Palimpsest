import type { PluginToolContext, PluginToolDefinition } from "@palimpsest/plugin-sdk/host"
import type { SQLiteBunDatabase } from "drizzle-orm/bun-sqlite"
import type { z, ZodType } from "zod"

import { bridge } from "../host-bridge"

type ToolResult<M extends Record<string, unknown>> = {
  title: string
  output: string
  metadata: M
}

/**
 * Compact helper to define a plugin tool without having to spell out the
 * `{ id, rawId, init }` envelope for every one of the 15+ research
 * tools we migrate. Equivalent to the host's `Tool.define(id, {...})`
 * shape, but produces a `PluginToolDefinition` that
 * `host.tools.register(...)` understands.
 *
 * `rawId: true` keeps the registered tool id literal (e.g. `atom_query`
 * rather than `research_atom_query`) so existing agent configs, prompt
 * text, and permission entries keep matching.
 */
export function tool<Params extends ZodType, M extends Record<string, unknown> = Record<string, unknown>>(
  id: string,
  def: {
    description: string
    parameters: Params
    execute: (args: z.infer<Params>, ctx: PluginToolContext) => Promise<ToolResult<M>>
  },
): PluginToolDefinition<Params, M> {
  return {
    id,
    rawId: true,
    init: async () => ({
      description: def.description,
      parameters: def.parameters,
      execute: def.execute,
    }),
  }
}

/**
 * Host-surface shims that mirror the tool-facing API from
 * `@/storage/db`, `@/util/filesystem`, `@/util/git`, `@/project/instance`,
 * `@/project/paths`, `@/session`, `@/bus`, and the `File*` namespaces.
 *
 * Each shim delegates to `bridge()`, which is bound once per Instance
 * in server-hook.ts (or in research-plugin-bind.ts during tests).
 *
 * The shape intentionally matches the host names one-to-one so the
 * migrated tool files read nearly identically to their pre-migration
 * forms, and so we can audit diffs cheaply.
 */

export const Filesystem = {
  exists: (p: string) => bridge().filesystem.exists(p),
  readText: (p: string) => bridge().filesystem.readText(p),
  readJson: <T = unknown>(p: string) => bridge().filesystem.readJson<T>(p),
  write: (p: string, c: string | Uint8Array) => bridge().filesystem.write(p, c),
  writeJson: (p: string, data: unknown) => bridge().filesystem.writeJson(p, data),
  mkdirp: (p: string) => bridge().filesystem.mkdirp(p),
  resolve: (p: string) => bridge().filesystem.resolve(p),
  isDir: (p: string) => bridge().filesystem.isDir(p),
  stat: (p: string) => bridge().filesystem.stat(p),
}

export const Database = {
  use: <T,>(cb: (db: SQLiteBunDatabase) => T): T => bridge().db.use(cb),
  transaction: <T,>(cb: () => T): T => bridge().db.transaction(cb),
}

export const git = (args: string[], opts: { cwd: string; env?: Record<string, string> }) =>
  bridge().git.run(args, opts)

export const Bus = {
  publish: async <T,>(def: T, properties: unknown) => {
    await bridge().bus.publish(def as any, properties)
  },
}

export const Session = {
  get: (id: string) => bridge().session.get(id),
  create: (input?: { parentID?: string; title?: string }) => bridge().session.create(input),
  remove: (id: string) => bridge().session.remove(id),
}

/**
 * Per-directory state cache. Host's `Instance.state(factory)` keys
 * cached state by `Instance.directory` so state resets with each
 * `Instance.provide` scope (important for tests). The plugin side
 * can't hook into the Instance context lifecycle directly, so we
 * approximate it with a directory-keyed Map + a WeakRef-style lazy
 * factory. Results are deterministic per directory for the life of
 * the process, which matches the host's behavior in tests that
 * don't cross Instance boundaries.
 */
const stateCache = new Map<string, Map<unknown, unknown>>()
function stateFactory<T>(factory: () => T): () => T {
  return () => {
    const dir = bridge().instance.directory()
    let entries = stateCache.get(dir)
    if (!entries) {
      entries = new Map()
      stateCache.set(dir, entries)
    }
    if (!entries.has(factory)) entries.set(factory, factory())
    return entries.get(factory) as T
  }
}

export const Instance = {
  get directory() {
    return bridge().instance.directory()
  },
  get worktree() {
    return bridge().instance.worktree()
  },
  get project() {
    return bridge().instance.project()
  },
  reload: (input: { directory: string; worktree?: string; project?: { id: string; worktree: string; name?: string } }) =>
    bridge().instance.reload(input),
  state: stateFactory,
}

export const Env = {
  get: (name: string) => bridge().env.get(name),
}

export const Auth = {
  get: (providerID: string) => bridge().auth.get(providerID) as Promise<any>,
}

export const ModelsDev = {
  get: () => bridge().models.get() as Promise<Record<string, any>>,
}

export const Config = {
  get: () => bridge().config.get() as Promise<any>,
}

export const FileTime = {
  read: (sessionID: string, p: string) => bridge().files.recordRead(sessionID, p),
  assert: (sessionID: string, p: string) => bridge().files.assertRead(sessionID, p),
}

/**
 * Bus-event shims for the host's File / FileWatcher channels. Tools
 * call `Bus.publish(File.Event.Edited, ...)` in the same shape as the
 * host; internally `host.files.edited(...)` replays the event through
 * the host's own BusEvent registry so host subscribers (format, vcs,
 * read-gating) still see the same event.
 */
export const File = {
  Event: {
    Edited: Symbol.for("file.edited") as unknown as { __edited: true },
  },
}

export const FileWatcher = {
  Event: {
    Updated: Symbol.for("file.watcher.updated") as unknown as { __updated: true },
  },
}

/**
 * Override Bus.publish for the File/FileWatcher tag objects so tool
 * code that calls `Bus.publish(File.Event.Edited, { file })` keeps
 * working unchanged after migration. The dispatch is forwarded through
 * `host.files.edited()` / `host.files.updated()` so host subscribers
 * stay in sync.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rawBusPublish = Bus.publish
;(Bus as any).publish = async (def: unknown, properties: any) => {
  if (def === File.Event.Edited) {
    await bridge().files.edited(properties.file)
    return
  }
  if (def === FileWatcher.Event.Updated) {
    await bridge().files.updated(
      properties.file,
      properties.event === "unlink" ? "delete" : (properties.event as "add" | "change"),
    )
    return
  }
  await rawBusPublish(def, properties)
}
