import { createContext, useContext, type Accessor } from "solid-js"
import type {
  Command,
  FileDiff,
  Message,
  McpStatus,
  Part,
  PermissionRequest,
  QuestionRequest,
  ProviderListResponse,
  SessionStatus,
  Session,
  Todo,
  PalimpsestClient,
} from "@palimpsest/sdk/v2/client"
import type { AsyncStorage, SyncStorage } from "@solid-primitives/storage"

import type { ContextItem, FileContextItem, Prompt, SelectedLineRange } from "./web/chat/types"

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
  /**
   * Build a fresh client targeting a different directory. Used by the
   * composer when starting a new session in a worktree other than the
   * current project's main worktree.
   */
  createClient(opts: { directory: string; throwOnError?: boolean }): PalimpsestClient
}

/**
 * Optimistic message addition payload, used by the chat composer to
 * insert a user message before the server confirms.
 */
export type PluginWebHostSyncOptimisticAdd = {
  directory: string
  sessionID: string
  message: Message
  parts: ReadonlyArray<unknown>
}

export type PluginWebHostSyncOptimisticRemove = {
  directory: string
  sessionID: string
  messageID: string
}

/** Custom user-defined slash command surfaced via the host sync store. */
export type PluginWebHostCommand = {
  name: string
  [key: string]: unknown
}

/** Agent metadata surfaced via the host sync store (distinct from `local.agent`). */
export type PluginWebHostAgent = {
  name: string
  [key: string]: unknown
}

/** File diff entry surfaced via the host sync store under `session_diff`. */
export type PluginWebHostSessionDiff = {
  file: string
  [key: string]: unknown
}

/**
 * Slice of the host's reactive sync store that chat code reads/writes.
 * All `data.*` records are reactive — read inside `createMemo` etc.
 * to track changes. Mutations happen via `session.sync()`,
 * `session.history.loadMore()`, `session.optimistic.*`, and the
 * generic `set()`.
 */
export interface PluginWebHostSync {
  data: {
    config: { share?: string; [key: string]: unknown }
    session: Session[]
    permission: Record<string, PermissionRequest[] | undefined>
    question: Record<string, QuestionRequest[] | undefined>
    message: Record<string, Message[]>
    mcp: Record<string, McpStatus>
    part: Record<string, Part[]>
    session_status: Record<string, SessionStatus>
    workflow: Record<string, PluginWebHostWorkflow | undefined>
    session_diff: Record<string, FileDiff[]>
    command: Command[]
    agent: PluginWebHostAgent[]
    provider: PluginWebHostProviderData
  }
  /** Currently-active project metadata. */
  project?: { id: string; name?: string } | undefined
  /**
   * Generic typed setter. Chat composer uses
   * `set("session_status", id, { type })` to flip optimistic status.
   * Untyped string key keeps the slice loose; concrete keys are owned
   * by the host store schema.
   */
  set(...args: unknown[]): void
  session: {
    sync(sessionID: string): Promise<void> | void
    /** Read a session by ID (reactive). */
    get(sessionID: string): Session | undefined
    history: {
      more(sessionID: string): boolean
      loading(sessionID: string): boolean
      loadMore(sessionID: string): Promise<void> | void
    }
    optimistic: {
      add(input: PluginWebHostSyncOptimisticAdd): void
      remove(input: PluginWebHostSyncOptimisticRemove): void
    }
  }
}

/**
 * Provider metadata surfaced via the host global-sync store.
 * Used by `useProviders()`-style hooks to enumerate connected /
 * popular AI provider entries for the prompt model selector.
 */
export type PluginWebHostProvider = ProviderListResponse["all"][number]

export type PluginWebHostProviderData = ProviderListResponse

export type PluginWebHostModelKey = {
  providerID: string
  modelID: string
}

export type PluginWebHostModel = PluginWebHostProvider["models"][string] & {
  provider: PluginWebHostProvider
  latest?: boolean
}

/**
 * Per-directory child store returned by `globalSync.child(dir)`. The
 * host's tuple shape is `[store, setStore]` but the store itself
 * also exposes `provider` (used by use-providers) and `session`
 * (read by composer when initialising a new directory).
 */
export type PluginWebHostGlobalSyncChildStore = {
  provider: PluginWebHostProviderData
  session?: Session[]
  [key: string]: unknown
}

export type PluginWebHostGlobalSyncChild = readonly [
  PluginWebHostGlobalSyncChildStore,
  (key: string, id: string, value: unknown) => void,
]

/** Slice of the host's global (cross-session) sync store. */
export interface PluginWebHostGlobalSync {
  data: {
    session_todo: Record<string, Todo[] | undefined>
    session_workflow: Record<string, PluginWebHostWorkflow | undefined>
    provider: PluginWebHostProviderData
  }
  /** Per-session todo control. */
  todo: {
    set(sessionID: string, todos: Todo[]): void
  }
  /**
   * Get/initialise the per-directory child store. Returns the host's
   * tuple `[store, setStore]`; chat code calls
   * `globalSync.child(dir)` for side-effect (init) or unpacks the
   * setter for `setStore("todo", id, [])`.
   */
  child(directory: string): PluginWebHostGlobalSyncChild
}

/** Slice of the host's settings store that chat surfaces honour. */
export interface PluginWebHostSettings {
  general: {
    showReasoningSummaries: Accessor<boolean>
    shellToolPartsExpanded: Accessor<boolean>
    editToolPartsExpanded: Accessor<boolean>
  }
}

/** Host's i18n entry point. */
export interface PluginWebHostLanguage {
  t(key: string, params?: Record<string, string | number>): string
  intl(): string
}

/**
 * Host permission helper used by the composer to decide whether to
 * show a permission dock for an incoming `PermissionRequest`, plus
 * the auto-accept policy controls the prompt-input toolbar surfaces.
 */
export interface PluginWebHostPermission {
  autoResponds(item: PermissionRequest, directory?: string): boolean
  /** Enable auto-accept for a freshly-created session. */
  enableAutoAccept(sessionID: string, directory?: string): void
  /** Whether a session is currently auto-accepting. */
  isAutoAccepting(sessionID: string, directory?: string): boolean
  /** Whether the project directory is auto-accepting (for new sessions). */
  isAutoAcceptingDirectory(directory: string): boolean
  /** Toggle auto-accept for the given session. */
  toggleAutoAccept(sessionID: string, directory?: string): void
  /** Toggle auto-accept for the given directory (no session yet). */
  toggleAutoAcceptDirectory(directory: string): void
}

/**
 * Slice of the host's `platform` info store. Chat composer uses
 * `os` for keyboard-shortcut conditionals, `readClipboardImage` as
 * a native-shell clipboard fallback, `storage(key)` for prompt
 * history persistence, and `fetch` as a custom transport.
 *
 * All fields are optional / loosely typed so the host's richer
 * `Platform` type structurally satisfies this slice without casts on
 * the call sites that pass a `Platform` value to chat utilities (e.g.
 * `removePersisted(target, platform)`). The `storage` return uses
 * `@solid-primitives/storage`'s `SyncStorage | AsyncStorage` types so
 * persist.ts can call setItem/getItem/removeItem without further casts.
 */
export interface PluginWebHostPlatform {
  os?: string
  readClipboardImage?: () => Promise<File | null>
  storage?: (key?: string) => SyncStorage | AsyncStorage
  fetch?: typeof globalThis.fetch
}

/**
 * Slice of the host's `file` viewer store. Chat composer uses these
 * to open cited files / search the project tree / map between path
 * and tab id when a context-pill click navigates the user.
 */
export interface PluginWebHostFile {
  tab(path: string): string
  pathFromTab(tab: string): string | undefined
  get(path: string): { content?: { content?: string } } | undefined
  selectedLines(path: string): SelectedLineRange | null | undefined
  load(path: string): Promise<unknown> | void
  searchFilesAndDirectories(query: string): Promise<string[]>
}

/**
 * Slice of the host's `comments` store. Chat composer adds/reads
 * line-comment metadata to surface inline comments in the prompt
 * context strip.
 */
export interface PluginWebHostCommentFocus {
  file: string
  id: string
}

export interface PluginWebHostCommentEntry {
  id: string
  file: string
  selection: SelectedLineRange
  comment: string
  time: number
  [key: string]: unknown
}

export interface PluginWebHostComments {
  setActive(focus: PluginWebHostCommentFocus | undefined): void
  setFocus(focus: PluginWebHostCommentFocus | undefined): void
  active(): PluginWebHostCommentFocus | undefined
  focus(): PluginWebHostCommentFocus | undefined
  all(): PluginWebHostCommentEntry[]
  replace(items: PluginWebHostCommentEntry[]): void
  remove(file: string, id: string): void
}

/**
 * Slice of the host's `command` registry. Chat composer registers
 * its own command bag (file.attach, prompt.mode.shell, ...) and
 * reads the registered command list to surface in the slash popover.
 */
export interface PluginWebHostCommandEntry {
  id: string
  title: string
  description?: string
  category?: string
  keybind?: string
  disabled?: boolean
  slash?: string
  onSelect?(source?: string): void | Promise<void>
}

export interface PluginWebHostCommandRegistry {
  register(scope: string, factory: () => PluginWebHostCommandEntry[]): void
  options: PluginWebHostCommandEntry[]
  trigger(id: string, source?: string): void
  keybind(id: string): string | undefined
}

/**
 * Slice of the host's `local` store covering the agent and model
 * selectors that the prompt-input toolbar reads.
 */
export interface PluginWebHostLocal {
  model: {
    current():
      | PluginWebHostModel
      | undefined
    list(): PluginWebHostModel[]
    visible(model: PluginWebHostModelKey): boolean
    set(model: PluginWebHostModelKey | undefined, options?: { recent?: boolean }): void
    variant: {
      current(): string | undefined
      list(): string[]
      set(value: string | undefined): void
      cycle(): void
    }
  }
  agent: {
    current(): { name: string } | undefined
    list(): Array<{ name: string }>
    set(name: string): void
    move(offset: number): void
  }
}

/**
 * Slice of the host's `layout` store covering the parts the prompt
 * composer touches: the cross-navigation tab handoff, the per-session
 * tabs/view accessors used to open file diffs/comments, and the file
 * tree's tab selector.
 */
export interface PluginWebHostLayout {
  handoff: {
    setTabs(directory: string, sessionID: string): void
  }
  tabs(key: () => string): {
    all(): string[]
    active(): string | undefined
    setActive(value: string): void
    open(value: string): void
    close(value: string): void
  }
  view(key: () => string): {
    reviewPanel: {
      open(): void
      opened(): boolean
      toggle(): void
    }
    terminal: {
      open(): void
      toggle(): void
    }
  }
  fileTree: {
    opened(): boolean
    tab(): string
    setTab(name: string): void
    toggle(): void
  }
}

/**
 * Slice of the host's `product` registry covering session-attachment
 * mutation. Used by the composer when starting a new session that
 * should be attached to the current project.
 */
export interface PluginWebHostProduct {
  replaceSessionAttachments(
    sessionID: string,
    attachments: Array<{ entity: string; id: string; title?: string }>,
  ): Promise<unknown>
}

/**
 * Slice of the host's prompt-input store. Mirrors the full
 * createPromptSession API surface in apps/web/src/context/prompt.tsx
 * so the chat composer can drive multi-part prompts (text + file +
 * agent + image) plus the file-context sidebar.
 *
 * The Prompt / ContextItem / FileContextItem types are defined in
 * `web/chat/types.ts` — chat code imports them directly; this slice
 * imports them from there too so host-web is the single source of
 * truth for the adapter shape.
 */
/**
 * Context items stored by the host prompt session always carry a
 * synthetic `key` (for stable Solid keying) added on insert. Plugin
 * code reads items through this typed wrapper.
 */
export type PluginWebHostContextItem = ContextItem & { key: string }

export interface PluginWebHostPrompt {
  ready: Accessor<boolean>
  current: Accessor<Prompt>
  cursor: Accessor<number | undefined>
  dirty: Accessor<boolean>
  context: {
    items: Accessor<PluginWebHostContextItem[]>
    add(item: ContextItem): void
    remove(key: string): void
    removeComment(path: string, commentID: string): void
    updateComment(path: string, commentID: string, next: Partial<FileContextItem> & { comment?: string }): void
    replaceComments(items: FileContextItem[]): void
  }
  set(prompt: Prompt, cursorPosition?: number): void
  reset(): void
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

  /** Host SDK slice (directory + client + createClient factory). */
  sdk(): PluginWebHostSDK
  /** Host reactive sync store slice. */
  sync(): PluginWebHostSync
  /** Host global (cross-session) sync store slice. */
  globalSync(): PluginWebHostGlobalSync
  /** Host settings store slice. */
  settings(): PluginWebHostSettings
  /** Host i18n. */
  language(): PluginWebHostLanguage
  /** Host permission helper + auto-accept policy. */
  permission(): PluginWebHostPermission
  /** Host prompt-input store slice. */
  prompt(): PluginWebHostPrompt
  /** Host `local` store slice (agent + model selectors). */
  local(): PluginWebHostLocal
  /** Host `layout` store slice (handoff + tabs/view accessors). */
  layout(): PluginWebHostLayout
  /** Host `product` registry slice (session attachment mutation). */
  product(): PluginWebHostProduct
  /** Host `platform` info slice (OS + clipboard helpers). */
  platform(): PluginWebHostPlatform
  /** Host `file` viewer slice (path/tab map + load + search). */
  file(): PluginWebHostFile
  /** Host `comments` slice (inline comment focus tracking). */
  comments(): PluginWebHostComments
  /** Host `command` registry slice. */
  command(): PluginWebHostCommandRegistry
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
