import type { ZodType, z } from "zod"

/**
 * Stable plugin host API.
 *
 * Plugins receive a {@link PluginHostAPI} through their optional
 * `server(host)` hook. Everything a plugin needs from the Palimpsest host —
 * database, bus, session, logger, config, identifier minting — is exposed
 * here, so plugins never have to reach into `@/...` or `@palimpsest/server/...`.
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
