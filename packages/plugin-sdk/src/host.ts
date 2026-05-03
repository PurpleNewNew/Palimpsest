import type { Hono } from "hono"
import type { ZodError, ZodType, z } from "zod"

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
  time: { created: number; updated: number; archived?: number }
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
    create(input?: { parentID?: string; title?: string }): Promise<PluginSession>
    remove(id: string): Promise<void>
  }

  /**
   * Current project/instance context. Evaluated lazily — the host
   * ensures calls happen inside an Instance.provide scope.
   */
  instance: {
    directory(): string
    worktree(): string
    project(): PluginProject
    reload(input: { directory: string; worktree?: string; project?: PluginProject }): Promise<void>
  }

  /**
   * Read-only config access. Plugins should not mutate host config;
   * declarative config belongs in the plugin's own manifest.
   */
  config: {
    get(): Promise<Record<string, unknown>>
  }

  /**
   * Environment variable access. Returns `undefined` when the variable
   * isn't set. Plugins should not mutate `process.env` directly —
   * always funnel lookups through this helper so intercept/observability
   * hooks stay consistent with the host.
   */
  env: {
    get(name: string): string | undefined
  }

  /**
   * Auth/credential lookups for providers (LLMs, remote services).
   * Plugins that need to call external APIs on the user's behalf use
   * these shims instead of reaching into `@/auth` directly.
   */
  auth: {
    get(providerID: string): Promise<unknown>
  }

  /**
   * Model metadata registry. `models.get()` returns the
   * models.dev-style provider map so plugins can look up API base
   * URLs, env-var conventions, and dimensions for embeddings etc.
   */
  models: {
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
   * File time tracking + edit/change broadcast. Plugins that write to
   * the project worktree should call `files.edited(path)` followed by
   * `files.updated(path, "add" | "change" | "delete")` and then
   * `files.recordRead(sessionID, path)` so the host's format/vcs/read
   * invariants stay in sync.
   */
  files: {
    recordRead(sessionID: string, path: string): void
    assertRead(sessionID: string, path: string): Promise<void>
    edited(path: string): Promise<void>
    updated(path: string, event: "add" | "change" | "delete"): Promise<void>
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
    /** Resolve a path relative to process.cwd(), like Node's path.resolve. */
    resolve(path: string): string
    /** Returns true when `path` points at a directory. */
    isDir(path: string): Promise<boolean>
    /** Synchronous stat that returns undefined when the path is missing. */
    stat(path: string): { isDirectory(): boolean; isFile(): boolean; size: number | bigint } | undefined
  }

  /**
   * Git wrapper. Runs a raw git subprocess inside `cwd` with
   * stdin ignored and no-throw semantics, matching the host's
   * `@/util/git` helper. Plugins still own their command vocabulary
   * (init, commit, diff, etc.); the host only mediates the process
   * launch so every git invocation shows up in the same audit trail
   * and can be intercepted for tests.
   */
  git: {
    run(args: string[], opts: { cwd: string; env?: Record<string, string> }): Promise<{
      exitCode: number
      stdout: Buffer
      stderr: Buffer
      text(): string
    }>
    /**
     * Compute file-level diffs between two refs (or between a ref and the
     * working tree) for a given code path. Mirrors the host's
     * `@/util/git-diff` helper with binary detection, untracked file
     * handling, and numstat aggregation.
     */
    diffFiles(codePath: string, from: string, to?: string): Promise<Array<{
      file: string
      before: string
      after: string
      additions: number
      deletions: number
      status?: "added" | "deleted" | "modified"
    }>>
  }

  /**
   * Snapshot primitives backed by the host's per-project git shadow
   * repo. Snapshots are keyed by tree hash, live outside the project's
   * own .git directory, and are safe for plugins to take around
   * arbitrary operations.
   */
  snapshot: {
    track(): Promise<string | undefined>
    restore(hash: string): Promise<void>
    patch(hash: string): Promise<{ hash: string; files: string[] }>
    diff(hash: string): Promise<string>
    diffFull(from: string, to: string): Promise<
      Array<{
        file: string
        before: string
        after: string
        additions: number
        deletions: number
        status?: "added" | "deleted" | "modified"
      }>
    >
  }

  /**
   * Project-level path math. `metadataDir(worktree)` resolves
   * `<worktree>/.palimpsest`, etc. These exist so plugins don't have
   * to hardcode the `.palimpsest` prefix or guess which folder holds
   * plans vs. worktrees — the host owns those conventions.
   */
  project: {
    metadataDir(worktree: string): string
    plansDir(worktree: string): string
    worktreesDir(root: string): string
    /**
     * Look up a project by id. Returns `undefined` when the project is
     * not registered (matches the host `Project.get` semantics).
     */
    get(id: string): PluginProject | undefined
    /**
     * Resolve a project from a directory on disk. Triggers project
     * registration on first call, like the host `Project.fromDirectory`.
     */
    fromDirectory(directory: string): Promise<{ project: PluginProject }>
  }

  /**
   * Tool registration. Plugins can publish tools into the host's
   * tool registry from inside the `server` hook. The registered tool's
   * id is auto-prefixed with `<pluginID>_` to prevent collisions with
   * host-owned tools and other plugins.
   *
   * Shape mirrors the host's internal `Tool.Info` closely enough that
   * tools migrated from `apps/server/src/tool/` can keep their rich
   * return shape (title + output + metadata) without flattening into
   * the simpler plugin-sdk `tool()` helper.
   */
  tools: {
    register<Parameters extends ZodType, Metadata extends Record<string, unknown> = Record<string, unknown>>(
      def: PluginToolDefinition<Parameters, Metadata>,
    ): Promise<void>
  }

  /**
   * Agent registration. Plugins can publish agents (primary or
   * subagent) into the host's agent registry from inside the `server`
   * hook.
   *
   * Visibility gating is lens-driven: an agent with `lensID` is only
   * visible to `Agent.list()` / `Agent.get()` in projects whose active
   * lens set contains that lens. Omit `lensID` to register a plugin
   * agent that is visible on every project (rare — most plugin agents
   * should declare their lens).
   *
   * Registered agents carry through the whole chat pipeline (@-mention,
   * task tool, CLI `/agent`, session.prompt) — see
   * `apps/server/src/agent/agent.ts`.
   */
  agents: {
    register(def: PluginAgentDefinition): Promise<void>
  }
}

export type PluginToolContext = {
  sessionID: string
  messageID: string
  agent: string
  abort: AbortSignal
  callID?: string
  metadata(input: { title?: string; metadata?: Record<string, unknown> }): void
  /**
   * Permission-gate prompt. Matches the host's `ctx.ask(...)` — the
   * plugin never has to know about the surrounding Ruleset, the host
   * splices the session's permission rules in automatically.
   */
  ask(input: {
    permission: string
    patterns: string[]
    always?: string[]
    metadata?: Record<string, unknown>
  }): Promise<void>
}

export type PluginToolInit<Parameters extends ZodType, Metadata extends Record<string, unknown>> = (ctx?: {
  agent?: string
}) => Promise<{
  description: string
  parameters: Parameters
  execute(
    args: z.infer<Parameters>,
    ctx: PluginToolContext,
  ): Promise<{
    title: string
    metadata: Metadata
    output: string
  }>
  formatValidationError?(error: ZodError): string
}>

export type PluginToolDefinition<
  Parameters extends ZodType = ZodType,
  Metadata extends Record<string, unknown> = Record<string, unknown>,
> = {
  id: string
  /**
   * When true, skip the default `${pluginID}_` prefix and register the
   * tool under its literal `id`. Only first-party plugins that "own"
   * an existing tool namespace should opt in (e.g. research keeping
   * `atom_query`, `article_query`, etc. so agent configs and prompt
   * files don't need to rewrite dozens of permission entries).
   */
  rawId?: boolean
  init: PluginToolInit<Parameters, Metadata>
}

/**
 * Shape mirrors the host's `Agent.Info` (apps/server/src/agent/agent.ts)
 * with two key differences for the plugin boundary:
 *
 * - `permission` is a loose ruleset record (plain JSON). The host turns
 *   it into a proper `PermissionNext.Ruleset` when merging into
 *   `Agent.state`, so plugins never have to depend on the host's
 *   permission internals.
 * - `model` accepts a string (`providerID/modelID` or just `modelID`)
 *   or the parsed `{providerID, modelID}` shape. The host normalizes
 *   it through `Provider.parseModel`.
 */
export type PluginAgentInfo = {
  name: string
  description?: string
  mode: "subagent" | "primary" | "all"
  hidden?: boolean
  topP?: number
  temperature?: number
  color?: string
  permission?: Record<string, unknown>
  model?: string | { providerID: string; modelID: string }
  variant?: string
  prompt?: string
  options?: Record<string, unknown>
  steps?: number
}

export type PluginAgentDefinition = {
  /**
   * Full agent information. `name` is registered verbatim (no plugin
   * prefix): research's `research_project_init` agent keeps that name
   * across the whole chat pipeline, since existing agent names are
   * already conventionally scoped (`research_*`, `experiment_*`, etc).
   */
  info: PluginAgentInfo
  /**
   * Lens this agent belongs to. When set, the agent is only visible
   * through `Agent.list()` / `Agent.get()` for projects whose active
   * lens set contains `lensID`. When omitted, the agent is visible on
   * every project — discouraged for lens-owned verbs; intended only
   * for plugin-shipped cross-cutting utilities.
   */
  lensID?: string
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
