import { createContext, useContext } from "solid-js"

/**
 * Stable plugin web host API.
 *
 * Plugin web bundles should never reach into the host app (apps/web) directly.
 * Instead they consume the {@link PluginWebHost} handed to them via Solid
 * context. The host wires a concrete implementation around the plugin
 * subtree with `<PluginWebHostContext.Provider value={host}>...</>`.
 *
 * The import-boundary test (apps/server/test/plugin/import-boundary.test.ts)
 * enforces that plugin code never imports `@/...`, `@palimpsest/server/...`,
 * or `@palimpsest/web/...`. This bridge is the approved alternative.
 */
export type PluginWebActor = {
  type: "user" | "agent" | "system"
  id: string
  version?: string
}

/**
 * Typed capability snapshot for the current workspace actor.
 *
 * Keys are boolean flags only so that graph workbench primitives and
 * plugin UI code can use `keyof PluginCapabilities` for precise action
 * gating (see `specs/graph-workbench-pattern.md` `NodeAction.requires`).
 *
 * Derivation lives in the host (see
 * `apps/web/src/context/permissions.ts`). Plugins never infer these
 * flags from HTTP 401/403 responses or from `role` strings directly.
 */
export type PluginCapabilities = {
  /** May mutate durable project state (create/update/delete nodes, edges, ...). */
  canWrite: boolean
  /** May approve, reject, or request changes on pending proposals. */
  canReview: boolean
  /** May create or revoke workspace shares. */
  canShare: boolean
  /** May export project data or import snapshots. */
  canExportImport: boolean
  /** May invite, remove, or change role of workspace members. */
  canManageMembers: boolean
  /** May start a run (plugin workflow, AI session, long-running task). */
  canRun: boolean
}

/** Everything capability-wise a viewer (or an unauthenticated guest) sees. */
export const PLUGIN_CAPABILITIES_NONE: PluginCapabilities = Object.freeze({
  canWrite: false,
  canReview: false,
  canShare: false,
  canExportImport: false,
  canManageMembers: false,
  canRun: false,
})

export type PluginWebHost = {
  /** Current project/workspace directory, if any. */
  directory(): string | undefined
  /** Current workspace id, used as the `x-palimpsest-workspace` header. */
  workspaceID(): string | undefined
  /** Current authenticated actor, or a `system:web` fallback. */
  actor(): PluginWebActor
  /**
   * Typed capability snapshot for the current actor. Gates write /
   * review / share / export / manage / run actions in plugin UI.
   * Returns {@link PLUGIN_CAPABILITIES_NONE} for guests.
   */
  capabilities(): PluginCapabilities
  /** Base server URL for building API requests. */
  baseURL(): string | URL | undefined
  /**
   * Server-aware fetch. Takes the same shape as `globalThis.fetch` but
   * goes through the host's CSRF/auth wrapper so plugins do not need to
   * know those details.
   */
  fetch(input: URL | string, init?: RequestInit): Promise<Response>
}

export const PluginWebHostContext = createContext<PluginWebHost>()

export function usePluginWebHost(): PluginWebHost {
  const value = useContext(PluginWebHostContext)
  if (!value) throw new Error("usePluginWebHost called outside a PluginWebHostProvider")
  return value
}

/**
 * Convenience helper for calling host-bridged JSON endpoints from a plugin.
 * The host's `fetch` is pre-wired with CSRF/auth; this helper just handles
 * directory + workspace headers and JSON (de)serialization.
 */
export async function pluginWebHostFetchJson<T = unknown>(
  host: PluginWebHost,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = host.baseURL()
  if (!base) throw new Error("Plugin web host has no base URL")
  const url = new URL(path, base)
  const dir = host.directory()
  if (dir) url.searchParams.set("directory", dir)
  const headers = new Headers(init?.headers)
  const workspace = host.workspaceID()
  if (workspace) headers.set("x-palimpsest-workspace", workspace)
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json")
  const res = await host.fetch(url, { ...init, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => undefined)
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? (body.message as string)
        : `Request failed: ${res.status}`
    throw new Error(message)
  }
  return (await res.json()) as T
}
