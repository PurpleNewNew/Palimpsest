import type { Hono } from "hono"
import type { ZodType, z } from "zod"

/**
 * Stable plugin host API.
 *
 * Plugins receive a {@link PluginHostAPI} through their optional
 * `server(host)` hook. Everything a plugin needs from the Palimpsest host —
 * database, bus, session, logger, config, identifier minting, HTTP routes,
 * scheduled tasks — is exposed here, so plugins never have to reach into
 * `@/...` or `@palimpsest/server/...`.
 *
 * The import-boundary test (apps/server/test/plugin/import-boundary.test.ts)
 * enforces this rule. The host implementation lives in
 * apps/server/src/plugin/host.ts and delegates to the real server primitives.
 */

export type PluginLogger = {
  info: (message: string, data?: Record<string, unknown>) => void
  warn: (message: string, data?: Record<string, unknown>) => void
  error: (message: string, data?: Record<string, unknown>) => void
  debug?: (message: string, data?: Record<string, unknown>) => void
}

export type BusEventDefinition<T = unknown> = {
  type: string
  properties: ZodType<T>
}

export type PluginActor = {
  type: "user" | "agent" | "system"
  id: string
  version?: string
}

export type PluginSession = {
  id: string
  projectID: string
  parentID?: string
  directory?: string
  time: { created: number; updated: number }
}

export type PluginProject = {
  id: string
  worktree: string
  name?: string
}

export type PluginHostAPI = {
  /**
   * Logger factory. Pass a service name; the logger is automatically
   * tagged with the plugin id.
   */
  log: {
    create(options: { service: string }): PluginLogger
  }

  /**
   * Scoped unique-id minter. Prefix convention is shared with the
   * rest of the system (e.g. `ses_`, `run_`, `art_`).
   */
  identifier: {
    ascending(prefix: string, existing?: string): string
    slug(): string
  }

  /**
   * Drizzle-compatible database access. `use(cb)` runs a synchronous
   * callback against the current transaction or a fresh client.
   * `transaction(cb)` wraps all writes inside the callback atomically.
   */
  db: {
    use<T>(callback: (client: any) => T): T
    transaction<T>(callback: () => T): T
  }

  /**
   * Event bus. Plugins can publish their own events (namespaced by
   * plugin id) and subscribe to any event on the host bus.
   */
  bus: {
    define<P>(type: string, schema: ZodType<P>): BusEventDefinition<P>
    publish<Def extends BusEventDefinition>(
      def: Def,
      properties: z.infer<Def["properties"]>,
    ): Promise<void>
    subscribe<Def extends BusEventDefinition>(
      def: Def,
      callback: (event: { type: Def["type"]; properties: z.infer<Def["properties"]> }) => void,
    ): () => void
    subscribeAll(callback: (event: { type: string; properties: unknown }) => void): () => void
  }

  /**
   * Session primitives scoped to the current project instance.
   */
  session: {
    get(id: string): Promise<PluginSession>
  }

  /**
   * Current project/instance context. Evaluated lazily — the host
   * ensures calls happen inside an Instance.provide scope.
   */
  instance: {
    directory(): string
    worktree(): string
    project(): PluginProject
  }

  /**
   * Read-only config access. Plugins should not mutate host config;
   * declarative config belongs in the plugin's own manifest.
   */
  config: {
    get(): Promise<Record<string, unknown>>
  }

  /**
   * Currently authenticated actor. Returns `undefined` when called
   * outside a request-scoped handler.
   */
  actor: {
    current(): PluginActor | undefined
  }

  /**
   * HTTP route mount point. The host mounts every registered sub-app
   * under `/api/plugin/<pluginID>/*`, so plugins do not need to worry
   * about path collisions or prefix management.
   *
   * Plugins build their own {@link Hono} instance, attach handlers with
   * the usual `.get / .post / .route` etc, and pass the instance to
   * `register()` from inside the `server` hook. The host picks all
   * registered apps up when it finalizes the main Hono app.
   */
  routes: {
    register(subApp: Hono): void
  }

  /**
   * Background task scheduler. Each task runs on its own interval
   * (milliseconds) scoped to the plugin. Task ids are namespaced with
   * the plugin id to prevent collisions with host-owned jobs.
   *
   * `scope: "instance"` (default) ties the task to the current project
   * instance and auto-disposes on teardown. `scope: "global"` runs once
   * per process, ignoring the instance lifecycle.
   */
  scheduler: {
    register(task: {
      id: string
      interval: number
      run: () => Promise<void>
      scope?: "instance" | "global"
    }): void
  }

  /**
   * Minimal filesystem primitives. Plugins should use these instead of
   * importing fs/promises or the host's Filesystem util so the import
   * boundary stays clean. Paths are treated as-is — callers are
   * responsible for resolving against `instance.worktree()` or similar
   * if they want project-scoped paths.
   */
  filesystem: {
    exists(path: string): Promise<boolean>
    readText(path: string): Promise<string>
    readJson<T = unknown>(path: string): Promise<T>
    write(path: string, content: string | Uint8Array): Promise<void>
    writeJson(path: string, data: unknown): Promise<void>
    mkdirp(path: string): Promise<void>
  }
}

export type PluginServerContext = {
  host: PluginHostAPI
  /**
   * Plugin's own manifest id. Useful for tagging events and routes.
   */
  pluginID: string
}

/**
 * Optional return value from a `server(host)` hook. When the plugin
 * returns a disposal function the host will call it during teardown.
 */
export type PluginServerHandle = {
  dispose?: () => Promise<void>
}

export type PluginServerHook = (input: PluginServerContext) => Promise<PluginServerHandle | void>
