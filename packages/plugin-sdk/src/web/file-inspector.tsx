import { createMemo, createResource, createSignal, For, Match, onCleanup, onMount, Show, Switch } from "solid-js"

import { pluginWebHostFetchJson, usePluginWebHost } from "../host-web"

/**
 * Read-only file inspector primitive exported from
 * `@palimpsest/plugin-sdk/web/file-inspector`.
 *
 * Sits in the `fileOverlay` slot of `<ObjectWorkspaceFullscreen>` (or
 * any positioned container the lens chooses). Fetches the file
 * content via the plugin web host bridge — `pluginWebHostFetchJson`
 * around `GET /file/content?path=...` — and renders it as a
 * line-numbered text block. Optional `highlightLine` scrolls to and
 * highlights one row, so a finding's source citation pill can drill
 * directly into the cited line.
 *
 * Read-only on purpose. The host lens (research) keeps a richer
 * `FileDetailPanel` with markdown rendering, file watching, and
 * edit/save — that surface stays host-side because it depends on host
 * context (`useFile`, `useSDK.event`). Plugin web lenses (e.g.
 * security-audit) get this lite primitive instead. The two co-exist:
 * research uses its host wrapper, security uses this primitive, both
 * pass through the same `ObjectWorkspaceFullscreen.fileOverlay` slot.
 */
export type FileInspectorProps = {
  /** File path relative to the project worktree. */
  path: string
  /** Optional title shown in the header; defaults to the path basename. */
  title?: string
  /**
   * Optional 1-indexed line number to scroll into view and highlight.
   * Used by security-audit to jump from a finding's source-citation
   * pill to the cited line.
   */
  highlightLine?: number
  /** Called when the user requests close (Esc or close button). */
  onClose: () => void
  /**
   * Pixels of left offset; used inside `ObjectWorkspaceFullscreen` so
   * the file overlay sits beside an active `leftOverlay` (e.g. chat
   * panel) rather than under it. Defaults to `0`.
   */
  leftOffset?: number
}

type FileContent = {
  type: "text" | "binary"
  content: string
}

/**
 * File inspector primitive. See `FileInspectorProps` for the contract.
 */
export function FileInspector(props: FileInspectorProps) {
  const host = usePluginWebHost()

  const [resource] = createResource(
    () => props.path,
    async (path) => {
      const url = `/file/content?path=${encodeURIComponent(path)}`
      return pluginWebHostFetchJson<FileContent>(host, url)
    },
  )

  const lines = createMemo(() => {
    const data = resource()
    if (!data) return []
    if (data.type === "binary") return []
    return data.content.split("\n")
  })

  const basename = createMemo(() => {
    const path = props.path
    const idx = path.lastIndexOf("/")
    return idx === -1 ? path : path.slice(idx + 1)
  })

  let scroller: HTMLDivElement | undefined

  const [scrolled, setScrolled] = createSignal(false)
  function scrollToHighlight() {
    if (scrolled()) return
    const target = props.highlightLine
    if (!target || !scroller) return
    const row = scroller.querySelector(
      `[data-line="${target}"]`,
    ) as HTMLElement | null
    if (!row) return
    const top = row.offsetTop - scroller.clientHeight / 3
    scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
    setScrolled(true)
  }

  // Re-scroll whenever the resource resolves OR the highlightLine changes.
  // createResource exposes `latest`/() so the memo above triggers updates;
  // a simple effect via `onMount` covers the initial render.
  onMount(() => {
    setTimeout(scrollToHighlight, 50)
  })

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      props.onClose()
    }
  }
  onMount(() => document.addEventListener("keydown", handleKeyDown, true))
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown, true))

  return (
    <div
      class="absolute bg-background-base flex flex-col"
      style={{
        top: "0",
        right: "0",
        bottom: "0",
        left: `${props.leftOffset ?? 0}px`,
        "z-index": "10",
        animation: "file-inspector-slide-in 200ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
      }}
      data-component="file-inspector"
    >
      <style>{`
        @keyframes file-inspector-slide-in {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        [data-component="file-inspector"] .line.highlight {
          background: var(--background-stronger, rgba(255, 255, 0, 0.08));
        }
      `}</style>

      {/* Header */}
      <div class="flex items-center justify-between px-4 py-2.5 border-b border-border-base shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <button
            onClick={props.onClose}
            class="flex items-center justify-center w-7 h-7 rounded-md bg-transparent text-text-weak cursor-pointer hover:text-text-base hover:bg-background-stronger transition-colors shrink-0"
            title="Back (Esc)"
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
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span class="text-sm font-semibold text-text-base truncate">
            {props.title ?? basename()}
          </span>
          <span class="text-[11px] text-text-weakest truncate">{props.path}</span>
          <Show when={props.highlightLine}>
            {(line) => (
              <span class="text-[11px] font-mono text-text-weak rounded bg-background-stronger px-1.5 py-0.5 shrink-0">
                line {line()}
              </span>
            )}
          </Show>
        </div>
      </div>

      {/* Content */}
      <div ref={scroller} class="flex-1 min-h-0 overflow-auto bg-background-base">
        <Switch>
          <Match when={resource.loading}>
            <div class="p-6 text-12-regular text-text-weak">Loading…</div>
          </Match>
          <Match when={resource.error}>
            <div class="p-6 text-12-regular text-text-weak">
              Failed to read file: {String(resource.error?.message ?? resource.error ?? "unknown error")}
            </div>
          </Match>
          <Match when={resource()?.type === "binary"}>
            <div class="p-6 text-12-regular text-text-weak">Binary file — preview not available.</div>
          </Match>
          <Match when={resource()}>
            <pre class="font-mono text-12-regular leading-5 m-0 p-0">
              <For each={lines()}>
                {(text, idx) => {
                  const lineNumber = idx() + 1
                  const isHighlight = createMemo(() => lineNumber === props.highlightLine)
                  return (
                    <div
                      class="line flex"
                      classList={{ highlight: isHighlight() }}
                      data-line={lineNumber}
                    >
                      <span class="select-none w-12 shrink-0 px-2 text-right text-text-weakest">
                        {lineNumber}
                      </span>
                      <span class="flex-1 min-w-0 whitespace-pre px-2 text-text-base">
                        {text || " "}
                      </span>
                    </div>
                  )
                }}
              </For>
            </pre>
          </Match>
        </Switch>
      </div>
    </div>
  )
}
