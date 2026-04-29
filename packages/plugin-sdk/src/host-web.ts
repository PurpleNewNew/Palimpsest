import { createContext, useContext, type Accessor } from "solid-js"
import type {
  Message,
  PermissionRequest,
  QuestionRequest,
  Session,
  Todo,
  PalimpsestClient,
} from "@palimpsest/sdk/v2/client"

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

/**
 * Workflow instance shape consumed by the chat composer's
 * SessionWorkflowDock. Mirrors the host's domain `Workflow` shape but
 * declared structurally here so plugin code does not depend on the
 * host's domain package directly.
 */
export type PluginWebHostWorkflowStepStatus =
  | "pending"
  | "active"
  | "done"
  | "waiting_interaction"
  | "skipped"

export type PluginWebHostWorkflowStep = {
  id: string
  title: string
  summary: string
  status: PluginWebHostWorkflowStepStatus
}

export type PluginWebHostWorkflowStatus =
  | "running"
  | "waiting_interaction"
  | "completed"
  | "failed"
  | "cancelled"

export interface PluginWebHostWorkflow {
  flow_summary?: string
  instance: {
    title: string
    flow_title: string
    status: PluginWebHostWorkflowStatus
    current_index: number
    current_step?: {
      title: string
      summary: string
      result?: Record<string, unknown>
      interaction?: {
        reason?: string
        message?: string
      }
    }
    steps: PluginWebHostWorkflowStep[]
  }
}

/**
 * Slice of the host SDK that chat code calls. The SDK client itself is
 * the public `PalimpsestClient` from `@palimpsest/sdk/v2`, so chat
 * gets the full SDK surface; only the `directory` field is also
 * needed for building child-session links.
 */
export interface PluginWebHostSDK {
  directory: string
  client: PalimpsestClient
}

/**
 * Slice of the host's reactive sync store that chat code reads/writes.
 * All `data.*` records are reactive — read inside `createMemo` etc.
 * to track changes. Mutations happen via `session.sync()` and
 * `session.history.loadMore()`.
 */
export interface PluginWebHostSync {
  data: {
    session: Session[]
    permission: Record<string, PermissionRequest[] | undefined>
    question: Record<string, QuestionRequest[] | undefined>
    message: Record<string, Message[]>
    session_status: Record<string, { type: "idle" | "busy" } | undefined>
    workflow: Record<string, PluginWebHostWorkflow | undefined>
  }
  session: {
    sync(sessionID: string): Promise<void> | void
    history: {
      more(sessionID: string): boolean
      loading(sessionID: string): boolean
      loadMore(sessionID: string): Promise<void> | void
    }
  }
}

/** Slice of the host's global (cross-session) sync store. */
export interface PluginWebHostGlobalSync {
  data: {
    session_todo: Record<string, Todo[] | undefined>
    session_workflow: Record<string, PluginWebHostWorkflow | undefined>
  }
}

/** Slice of the host's settings store that chat surfaces honour. */
export interface PluginWebHostSettings {
  general: {
    showReasoningSummaries: Accessor<boolean>
    shellToolPartsExpanded: Accessor<boolean>
    editToolPartsExpanded: Accessor<boolean>
  }
}

/** Host's i18n entry point. Only `t(key)` is used by chat. */
export interface PluginWebHostLanguage {
  t(key: string): string
}

/**
 * Host permission helper used by the composer to decide whether to
 * show a permission dock for an incoming `PermissionRequest`.
 */
export interface PluginWebHostPermission {
  autoResponds(item: PermissionRequest, directory?: string): boolean
}

/**
 * Multi-part composer prompt parts that the host's prompt store
 * tracks. A subset (`type: "text" | "file" | "agent" | "image"`) is
 * what the composer renders. Full part types live in the host's
 * `prompt` context; this is the minimum chat needs.
 */
export type PluginWebHostPromptPart =
  | { type: "text"; content: string }
  | { type: "file"; path: string; content?: string }
  | { type: "agent"; name: string; content?: string }
  | { type: "image"; filename: string }

/** Slice of the host's prompt-input store. */
export interface PluginWebHostPrompt {
  ready: Accessor<boolean>
  current: Accessor<PluginWebHostPromptPart[]>
}

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

  // ─── Chat subsystem accessors ─────────────────────────────────
  // Each accessor returns a host-implemented slice of the host's
  // reactive stores. Chat code (composer + history-window +
  // timeline-staging + session-chat-panel) consumes these instead of
  // reaching into `apps/web/src/context/*` directly. The slices
  // declare ONLY the fields chat reads/writes; host's richer stores
  // satisfy them by structural assignability.

  /** Host SDK slice (directory + client). */
  sdk(): PluginWebHostSDK
  /** Host reactive sync store slice. */
  sync(): PluginWebHostSync
  /** Host global (cross-session) sync store slice. */
  globalSync(): PluginWebHostGlobalSync
  /** Host settings store slice. */
  settings(): PluginWebHostSettings
  /** Host i18n. */
  language(): PluginWebHostLanguage
  /** Host permission helper. */
  permission(): PluginWebHostPermission
  /** Host prompt-input store slice. */
  prompt(): PluginWebHostPrompt
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
