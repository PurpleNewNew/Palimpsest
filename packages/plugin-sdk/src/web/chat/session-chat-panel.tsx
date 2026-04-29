import { createEffect, createMemo, For, on, Show, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { base64Encode } from "@palimpsest/shared/encode"
import { DataProvider } from "@palimpsest/ui/context"
import { createAutoScroll } from "@palimpsest/ui/hooks"
import { Icon } from "@palimpsest/ui/icon"
import { SessionTurn } from "@palimpsest/ui/session-turn"
import type { AssistantMessage, Message, UserMessage } from "@palimpsest/sdk/v2/client"

import { usePluginWebHost } from "../../host-web"
import { createSessionComposerState } from "./composer/session-composer-state"
import {
  SessionComposerRegion,
  type SessionComposerPromptInputProps,
} from "./composer/session-composer-region"
import { createSessionHistoryWindow } from "./history-window"
import { SessionIDProvider } from "./session-id"
import { createTimelineStaging } from "./timeline-staging"

const CHAT_MIN_WIDTH = 360
const CHAT_MAX_WIDTH = 900
const CHAT_DEFAULT_WIDTH = 520

export type SessionChatPanelProps = {
  sessionID: string
  onClose: () => void
  title?: string
  input: Component<SessionComposerPromptInputProps>
  paused?: boolean
}

export function SessionChatPanel(props: SessionChatPanelProps) {
  const host = usePluginWebHost()
  const sdk = host.sdk()
  const sync = host.sync()
  const [state, setState] = createStore({
    width: CHAT_DEFAULT_WIDTH,
    dragging: false,
    stack: [] as string[],
  })

  createEffect(
    on(
      () => props.sessionID,
      (id) => {
        if (!props.paused) void sync.session.sync(id)
      },
    ),
  )

  const current = createMemo(() => {
    const stack = state.stack
    return stack.length > 0 ? stack[stack.length - 1] : props.sessionID
  })
  const canBack = createMemo(() => state.stack.length > 0)

  const navigate = (sessionID: string): true => {
    setState("stack", (stack) => [...stack, sessionID])
    if (!props.paused) void sync.session.sync(sessionID)
    return true
  }

  const back = () => {
    setState("stack", (stack) => stack.slice(0, -1))
  }

  createEffect(() => {
    props.sessionID
    setState("stack", [])
  })

  const resize = (event: MouseEvent) => {
    event.preventDefault()
    const start = event.clientX
    const width = state.width
    setState("dragging", true)

    const move = (item: MouseEvent) => {
      setState("width", Math.min(CHAT_MAX_WIDTH, Math.max(CHAT_MIN_WIDTH, width + item.clientX - start)))
    }

    const up = () => {
      setState("dragging", false)
      document.removeEventListener("mousemove", move)
      document.removeEventListener("mouseup", up)
    }

    document.addEventListener("mousemove", move)
    document.addEventListener("mouseup", up)
  }

  const href = (sessionID: string) => `/${base64Encode(sdk.directory)}/session/${sessionID}`

  return (
    <div
      class="bg-background-base border-r border-border-base flex flex-col overflow-hidden relative"
      style={{
        width: `${state.width}px`,
        height: "100%",
        "flex-shrink": "0",
        "user-select": state.dragging ? "none" : "auto",
      }}
    >
      <div
        onMouseDown={resize}
        class="absolute right-0 top-0 w-[5px] h-full z-10 cursor-col-resize"
        classList={{
          "bg-accent-base": state.dragging,
        }}
        style={{
          background: state.dragging ? undefined : "transparent",
          transition: state.dragging ? "none" : "background 0.15s",
        }}
        onMouseEnter={(event) => {
          if (!state.dragging) event.currentTarget.style.background = "var(--border-base)"
        }}
        onMouseLeave={(event) => {
          if (!state.dragging) event.currentTarget.style.background = "transparent"
        }}
      />

      <div class="flex items-center justify-between px-4 py-2.5 border-b border-border-base shrink-0">
        <span class="text-sm font-semibold text-text-base">{props.title ?? "Session Chat"}</span>
        <button
          onClick={props.onClose}
          class="flex items-center justify-center w-6 h-6 border border-border-base rounded-md bg-transparent text-text-weak cursor-pointer hover:text-text-base hover:bg-background-stronger transition-colors"
        >
          <svg
            width="12"
            height="12"
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

      <SessionIDProvider sessionID={current()} directory={sdk.directory}>
        <DataProvider data={sync.data} directory={sdk.directory} onNavigateToSession={navigate} onSessionHref={href}>
          <SessionChatInner sessionID={current()} canBack={canBack()} onBack={back} input={props.input} />
        </DataProvider>
      </SessionIDProvider>
    </div>
  )
}

function SessionChatInner(props: {
  sessionID: string
  canBack: boolean
  onBack: () => void
  input: Component<SessionComposerPromptInputProps>
}) {
  const host = usePluginWebHost()
  const settings = host.settings()
  const sync = host.sync()
  const composer = createSessionComposerState()
  let scroller: HTMLDivElement | undefined

  const empty: Message[] = []
  const messages = createMemo(() => sync.data.message[props.sessionID] ?? empty)
  const users = createMemo(() => messages().filter((msg): msg is UserMessage => msg.role === "user"))
  const status = createMemo(() => sync.data.session_status[props.sessionID]?.type ?? "idle")
  const working = createMemo(() => status() === "busy")

  const pending = createMemo(() =>
    messages()
      .filter((item): item is AssistantMessage => item.role === "assistant" && typeof item.time.completed !== "number")
      .at(-1),
  )

  const activeID = createMemo(() => {
    const all = messages()
    const message = pending()
    if (message?.parentID) {
      const parent = all.find((item) => item.id === message.parentID)
      if (parent?.role === "user") return parent.id
    }
    if (status() === "idle") return undefined
    return all.filter((item): item is UserMessage => item.role === "user").at(-1)?.id
  })

  const scroll = createAutoScroll({
    working,
    overflowAnchor: "dynamic",
  })

  const more = createMemo(() => sync.session.history.more(props.sessionID))
  const loading = createMemo(() => sync.session.history.loading(props.sessionID))

  const history = createSessionHistoryWindow({
    sessionID: () => props.sessionID,
    messagesReady: () => messages().length > 0,
    visibleUserMessages: users,
    historyMore: more,
    historyLoading: loading,
    loadMore: (id) => sync.session.history.loadMore(id),
    userScrolled: scroll.userScrolled,
    scroller: () => scroller,
  })

  const staging = createTimelineStaging({
    sessionKey: () => props.sessionID,
    turnStart: () => history.turnStart(),
    messages: () => history.renderedUserMessages(),
    config: { init: 1, batch: 3 },
  })

  const rendered = createMemo(() => staging.messages().map((msg) => msg.id))
  const [state, setState] = createStore({
    scroll: { overflow: false, bottom: true },
  })
  let raf: number | undefined

  const schedule = (el: HTMLDivElement) => {
    if (raf !== undefined) cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      raf = undefined
      const max = el.scrollHeight - el.clientHeight
      const overflow = max > 1
      const bottom = !overflow || Math.abs(el.scrollTop) <= 2 || !scroll.userScrolled()
      setState("scroll", { overflow, bottom })
    })
  }

  createEffect(
    on(
      () => props.sessionID,
      () => scroll.snapToBottom(),
      { defer: true },
    ),
  )

  const handle = () => {
    scroll.handleScroll()
    history.onScrollerScroll()
    if (scroller) schedule(scroller)
  }

  return (
    <div class="flex flex-col flex-1 min-h-0 bg-background-stronger">
      <Show when={props.canBack}>
        <div class="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border-base">
          <button
            onClick={props.onBack}
            class="flex items-center gap-1.5 text-xs text-text-weak hover:text-text-base transition-colors cursor-pointer bg-transparent border-none p-0"
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
              <path d="M19 12H5" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to parent session
          </button>
        </div>
      </Show>

      <div class="relative flex-1 min-h-0">
        <div
          class="absolute left-1/2 -translate-x-1/2 bottom-4 z-[60] pointer-events-none transition-all duration-200 ease-out"
          classList={{
            "opacity-100 translate-y-0 scale-100":
              state.scroll.overflow && !state.scroll.bottom && !staging.isStaging(),
            "opacity-0 translate-y-2 scale-95 pointer-events-none":
              !state.scroll.overflow || state.scroll.bottom || staging.isStaging(),
          }}
        >
          <button
            class="pointer-events-auto size-8 flex items-center justify-center rounded-full bg-background-base border border-border-base shadow-sm text-text-base hover:bg-background-stronger transition-colors"
            onClick={() => scroll.smoothScrollToBottom()}
          >
            <Icon name="arrow-down-to-line" />
          </button>
        </div>

        <div
          ref={(el) => {
            scroller = el
            scroll.scrollRef(el)
          }}
          onScroll={handle}
          onMouseDown={scroll.handleInteraction}
          class="h-full overflow-y-auto"
          style={{ display: "flex", "flex-direction": "column-reverse" }}
        >
          <div ref={(el) => scroll.contentRef(el)} class="flex flex-col gap-0 items-start justify-start pb-16 pt-4 w-full">
            <Show when={history.turnStart() > 0 || more()}>
              <div class="w-full flex justify-center py-2">
                <button
                  onClick={() => void history.loadAndReveal()}
                  disabled={loading()}
                  class="text-xs text-text-weak hover:text-text-base transition-colors cursor-pointer bg-transparent border-none p-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading() ? "Loading earlier messages..." : "Load earlier messages"}
                </button>
              </div>
            </Show>

            <Show
              when={users().length > 0}
              fallback={<div class="px-5 py-4 text-text-weak text-xs text-center w-full">No messages yet. Start a conversation below.</div>}
            >
              <For each={rendered()}>
                {(id) => {
                  const fresh = staging.ready()
                  const active = createMemo(() => activeID() === id)
                  const queued = createMemo(() => {
                    if (active()) return false
                    const current = activeID()
                    if (current) return id > current
                    return false
                  })
                  return (
                    <div class="min-w-0 w-full max-w-full">
                      <SessionTurn
                        sessionID={props.sessionID}
                        messageID={id}
                        active={active()}
                        queued={queued()}
                        animate={fresh || active()}
                        showReasoningSummaries={settings.general.showReasoningSummaries()}
                        shellToolDefaultOpen={settings.general.shellToolPartsExpanded()}
                        editToolDefaultOpen={settings.general.editToolPartsExpanded()}
                        classes={{
                          root: "min-w-0 w-full relative",
                          content: "flex flex-col justify-between !overflow-visible",
                          container: "w-full px-4 md:px-5",
                        }}
                      />
                    </div>
                  )
                }}
              </For>
            </Show>
          </div>
        </div>
      </div>

      <div class="shrink-0">
        <SessionComposerRegion
          state={composer}
          ready={true}
          centered={false}
          input={props.input}
          inputRef={() => {}}
          newSessionWorktree="main"
          onNewSessionWorktreeReset={() => {}}
          onSubmit={() => scroll.smoothScrollToBottom()}
          onResponseSubmit={() => scroll.smoothScrollToBottom()}
          setPromptDockRef={() => {}}
        />
      </div>
    </div>
  )
}
