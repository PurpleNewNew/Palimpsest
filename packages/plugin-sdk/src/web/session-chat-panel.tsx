import { createEffect, createMemo, createResource, createSignal, For, on, onCleanup, onMount, Show } from "solid-js"

import { pluginWebHostFetchJson, usePluginWebHost, type PluginWebHost } from "../host-web"

/**
 * Lite session chat primitive exported from
 * `@palimpsest/plugin-sdk/web/session-chat-panel`.
 *
 * Sits in the `leftOverlay` slot of `<ObjectWorkspaceFullscreen>` (or
 * any positioned container the lens chooses). Talks to the host
 * session API through the plugin web bridge:
 *
 * - `GET /session/:id/message` lists messages with their parts
 * - `POST /session/:id/prompt_async` sends a text user message
 *
 * Polls every 2s for new messages while mounted. Read-only on tool
 * calls / reasoning / file parts — only text parts are surfaced to
 * keep the surface lean. The host's richer chat UI (composer state
 * machine, history window, timeline staging, multi-part composer) is
 * intentionally not duplicated here. Plugin lenses needing those
 * features should embed the host shell itself rather than this
 * primitive.
 *
 * Use case: a security-audit reviewer interrogating an AI-generated
 * finding ("why do you think this is SSRF?") in place, without
 * leaving the finding's detail context.
 */
export type SessionChatPanelProps = {
  /** Session id to attach the chat to. The session must already exist. */
  sessionID: string
  /** Called when the user requests close (Esc handler is owned by the
   *  parent fullscreen primitive). */
  onClose: () => void
  /** Optional title shown in the header; defaults to "Session chat". */
  title?: string
  /** Optional pause flag — when true, polling is suspended (e.g. for
   *  tests or backgrounded views). */
  paused?: boolean
}

const POLL_INTERVAL_MS = 2_000

/**
 * Minimal message shape the primitive renders. The server returns a
 * richer `MessageV2.WithParts` structure; this shape is the subset we
 * surface (text parts only, role-tagged).
 */
type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  time: number
}

/**
 * Server-side `MessageV2.WithParts` is a discriminated union over part
 * types; we model only the fields we read.
 */
type ServerMessage = {
  info: { id: string; role: "user" | "assistant"; time?: { created?: number } }
  parts: Array<{ type: string; text?: string }>
}

function flatten(server: ServerMessage[]): ChatMessage[] {
  return server.flatMap((msg): ChatMessage[] => {
    const role = msg.info.role
    if (role !== "user" && role !== "assistant") return []
    const text = msg.parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string)
      .join("\n\n")
      .trim()
    if (!text) return []
    return [
      {
        id: msg.info.id,
        role,
        text,
        time: msg.info.time?.created ?? 0,
      },
    ]
  })
}

async function postPromptAsync(host: PluginWebHost, sessionID: string, text: string) {
  const base = host.baseURL()
  if (!base) throw new Error("Plugin web host has no base URL")
  const url = new URL(`/session/${encodeURIComponent(sessionID)}/prompt_async`, base)
  const dir = host.directory()
  if (dir) url.searchParams.set("directory", dir)
  const headers = new Headers({ "content-type": "application/json" })
  const workspace = host.workspaceID()
  if (workspace) headers.set("x-palimpsest-workspace", workspace)
  const res = await host.fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ parts: [{ type: "text", text }] }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => undefined)
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? (body.message as string)
        : `Failed to send message: ${res.status}`
    throw new Error(message)
  }
}

/**
 * Session chat panel primitive. See `SessionChatPanelProps`.
 */
export function SessionChatPanel(props: SessionChatPanelProps) {
  const host = usePluginWebHost()

  const [draft, setDraft] = createSignal("")
  const [sending, setSending] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const [resource, { refetch }] = createResource(
    () => props.sessionID,
    async (id) => {
      const url = `/session/${encodeURIComponent(id)}/message`
      return pluginWebHostFetchJson<ServerMessage[]>(host, url)
    },
  )

  const messages = createMemo(() => flatten(resource() ?? []))

  // Poll for new messages while mounted and not paused. We refetch
  // rather than spin up SSE because (a) the read endpoint is cheap and
  // (b) plugins should not depend on SSE infrastructure that the host
  // bridge has not exposed yet.
  let timer: ReturnType<typeof setInterval> | undefined
  function startPolling() {
    if (timer || props.paused) return
    timer = setInterval(() => {
      if (!props.paused) refetch()
    }, POLL_INTERVAL_MS)
  }
  function stopPolling() {
    if (!timer) return
    clearInterval(timer)
    timer = undefined
  }
  onMount(startPolling)
  onCleanup(stopPolling)
  createEffect(
    on(
      () => props.paused,
      (paused) => {
        if (paused) stopPolling()
        else startPolling()
      },
    ),
  )

  let scroller: HTMLDivElement | undefined
  // Auto-scroll to bottom when message count grows (new turn).
  createEffect(
    on(
      () => messages().length,
      () => {
        if (!scroller) return
        scroller.scrollTo({ top: scroller.scrollHeight })
      },
    ),
  )

  async function send() {
    const text = draft().trim()
    if (!text || sending()) return
    setSending(true)
    setError(null)
    try {
      await postPromptAsync(host, props.sessionID, text)
      setDraft("")
      // Optimistic refetch; the server may still be appending the
      // assistant turn, but we'll catch it on the next poll.
      refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  function handleComposerKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div
      class="h-full w-[420px] bg-background-base border-r border-border-base flex flex-col"
      data-component="session-chat-panel"
    >
      {/* Header */}
      <div class="flex items-center justify-between h-11 shrink-0 px-3 border-b border-border-base">
        <div class="flex items-center gap-2 min-w-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-text-weak shrink-0"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span class="text-13-semibold text-text-strong truncate">{props.title ?? "Session chat"}</span>
        </div>
        <button
          onClick={props.onClose}
          class="flex items-center justify-center w-7 h-7 rounded-md bg-transparent text-text-weak cursor-pointer hover:text-text-base hover:bg-background-stronger transition-colors shrink-0"
          title="Close chat"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={scroller} class="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        <Show when={resource.loading && messages().length === 0}>
          <div class="text-12-regular text-text-weak">Loading…</div>
        </Show>
        <Show when={resource.error && messages().length === 0}>
          <div class="text-12-regular text-text-weak">
            Failed to load messages: {String(resource.error?.message ?? resource.error ?? "unknown error")}
          </div>
        </Show>
        <Show when={messages().length === 0 && !resource.loading && !resource.error}>
          <div class="text-12-regular text-text-weak">No messages yet. Send one to start the conversation.</div>
        </Show>
        <For each={messages()}>
          {(msg) => (
            <div
              class="mb-3"
              classList={{
                "text-right": msg.role === "user",
              }}
            >
              <div class="text-11-medium uppercase tracking-wide text-text-weak mb-1">
                {msg.role === "user" ? "You" : "Assistant"}
              </div>
              <div
                class="inline-block rounded-lg px-3 py-2 text-12-regular whitespace-pre-wrap text-left"
                classList={{
                  "bg-surface-raised-base text-text-strong": msg.role === "user",
                  "bg-background-stronger text-text-base": msg.role === "assistant",
                }}
              >
                {msg.text}
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Composer */}
      <div class="shrink-0 border-t border-border-base p-3">
        <Show when={error()}>
          {(message) => (
            <div class="mb-2 text-11-regular text-icon-warning-base">{message()}</div>
          )}
        </Show>
        <textarea
          value={draft()}
          placeholder="Ask the agent…  (Cmd/Ctrl+Enter to send)"
          rows={3}
          class="w-full resize-none rounded border border-border-base bg-background-stronger px-2 py-1.5 text-12-regular text-text-base outline-none focus:border-border-accent-base"
          onInput={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={handleComposerKeyDown}
          disabled={sending()}
        />
        <div class="mt-2 flex justify-end">
          <button
            type="button"
            onClick={send}
            disabled={sending() || !draft().trim()}
            class="rounded border border-border-accent-base bg-accent-base/10 px-3 py-1 text-12-medium text-accent-base hover:bg-accent-base/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {sending() ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  )
}
