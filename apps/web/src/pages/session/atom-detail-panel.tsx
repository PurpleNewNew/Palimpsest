import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@palimpsest/shared/encode"
import { useFile } from "@/context/file"
import { useResearchLegacySDK } from "@/pages/session/research-legacy-sdk"
import { Markdown } from "@palimpsest/ui/markdown"
import type { ResearchAtomsListResponse } from "@/pages/session/research-legacy-sdk"

type Atom = ResearchAtomsListResponse["atoms"][number]

const TYPE_COLORS: Record<string, string> = {
  question: "#60a5fa",
  hypothesis: "#fbbf24",
  claim: "#f87171",
  finding: "#34d399",
  source: "#94a3b8",
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#64748b",
  in_progress: "#f59e0b",
  supported: "#22c55e",
  refuted: "#f87171",
}

const PANEL_MIN_WIDTH = 400
const PANEL_MAX_WIDTH = 1200
const PANEL_DEFAULT_WIDTH = 680

export function AtomDetailPanel(props: {
  atom: Atom
  onClose: () => void
  onDelete?: (atomId: string) => Promise<void>
  onAtomSessionId?: (sessionId: string | null) => void
  chatOpen?: boolean
  onToggleChat?: () => void
  onOpenFileDetail?: (path: string, title: string) => void
}) {
  const file = useFile()
  const sdk = useResearchLegacySDK()
  const navigate = useNavigate()
  const [atomSessionId, setAtomSessionId] = createSignal<string | null>(props.atom.session_id)

  // Sync atomSessionId when the atom prop changes (e.g. user switches
  // to a different atom inside the fullscreen).
  createEffect(() => {
    setAtomSessionId(props.atom.session_id)
  })
  const [confirmDelete, setConfirmDelete] = createSignal(false)
  const [deleting, setDeleting] = createSignal(false)
  const [updatingStatus, setUpdatingStatus] = createSignal(false)
  const [panelWidth, setPanelWidth] = createSignal(PANEL_DEFAULT_WIDTH)
  const [dragging, setDragging] = createSignal(false)

  const handleResizeStart = (e: MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = panelWidth()
    setDragging(true)

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      const newWidth = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, startWidth + delta))
      setPanelWidth(newWidth)
    }

    const onMouseUp = () => {
      setDragging(false)
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  const typeColor = () => TYPE_COLORS[props.atom.atom_type] ?? "#64748b"
  const statusColor = () => STATUS_COLORS[props.atom.atom_evidence_status] ?? "#64748b"

  // Load & watch claim file
  createEffect(() => {
    const path = props.atom.atom_claim_path
    if (!path) return
    file.load(path).catch(console.error)
    let mounted = true
    const unsub = sdk.event.on("file.watcher.updated" as any, (event: { file: string; event: string }) => {
      if (!mounted) return
      if (
        (event.file === path || event.file.endsWith(path) || path.endsWith(event.file)) &&
        (event.event === "change" || event.event === "add")
      ) {
        file.load(path, { force: true }).catch(console.error)
      }
    })
    onCleanup(() => {
      mounted = false
      unsub()
    })
  })

  // Load & watch evidence file
  createEffect(() => {
    const path = props.atom.atom_evidence_path
    if (!path) return
    file.load(path).catch(console.error)
    let mounted = true
    const unsub = sdk.event.on("file.watcher.updated" as any, (event: { file: string; event: string }) => {
      if (!mounted) return
      if (
        (event.file === path || event.file.endsWith(path) || path.endsWith(event.file)) &&
        (event.event === "change" || event.event === "add")
      ) {
        file.load(path, { force: true }).catch(console.error)
      }
    })
    onCleanup(() => {
      mounted = false
      unsub()
    })
  })

  // Load & watch evidence assessment file
  createEffect(() => {
    const path = props.atom.atom_evidence_assessment_path
    if (!path) return
    file.load(path).catch(console.error)
    let mounted = true
    const unsub = sdk.event.on("file.watcher.updated" as any, (event: { file: string; event: string }) => {
      if (!mounted) return
      if (
        (event.file === path || event.file.endsWith(path) || path.endsWith(event.file)) &&
        (event.event === "change" || event.event === "add")
      ) {
        file.load(path, { force: true }).catch(console.error)
      }
    })
    onCleanup(() => {
      mounted = false
      unsub()
    })
  })

  const claimContent = createMemo(() => {
    const path = props.atom.atom_claim_path
    if (!path) return null
    return file.get(path)?.content?.content ?? null
  })

  const evidenceContent = createMemo(() => {
    const path = props.atom.atom_evidence_path
    if (!path) return null
    return file.get(path)?.content?.content ?? null
  })

  const assessmentContent = createMemo(() => {
    const path = props.atom.atom_evidence_assessment_path
    if (!path) return null
    return file.get(path)?.content?.content ?? null
  })

  const [evidenceTab, setEvidenceTab] = createSignal<"evidence" | "assessment">("evidence")

  // Notify parent of atom session ID changes
  createEffect(() => {
    props.onAtomSessionId?.(atomSessionId())
  })

  // Lazy session creation on explicit user intent. If the atom already
  // has a session, navigate to it; otherwise create one now (this is
  // the "act" step in the inspect-vs-act split) and then navigate.
  const navigateToAtomSession = async () => {
    let sessionId = atomSessionId()
    if (!sessionId) {
      try {
        const res = await sdk.client.research.atom.session.create({ atomId: props.atom.atom_id })
        sessionId = res.data?.session_id ?? null
        if (sessionId) setAtomSessionId(sessionId)
      } catch (e) {
        console.error("[atom-detail-panel] failed to create atom session", e)
        return
      }
    }
    if (sessionId) {
      navigate(`/${base64Encode(sdk.directory)}/session/${sessionId}`)
    }
  }

  const handleDelete = async () => {
    if (!props.onDelete || deleting()) return
    setDeleting(true)
    try {
      await props.onDelete(props.atom.atom_id)
      props.onClose()
    } catch (e) {
      console.error("[atom-detail-panel] failed to delete atom", e)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleUpdateStatus = async (status: string) => {
    if (updatingStatus()) return
    setUpdatingStatus(true)
    try {
      await sdk.client.research.atom.update({
        researchProjectId: props.atom.research_project_id,
        atomId: props.atom.atom_id,
        evidence_status: status as any,
      })
    } catch (e) {
      console.error("[atom-detail-panel] failed to update status", e)
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <div
      class="bg-background-base border-l border-border-base flex flex-col overflow-hidden relative"
      style={{
        width: `${panelWidth()}px`,
        height: "100%",
        "flex-shrink": "0",
        animation: "panel-slide-in 250ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "user-select": dragging() ? "none" : "auto",
      }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        class="absolute left-0 top-0 w-[5px] h-full z-10 cursor-col-resize"
        style={{
          background: dragging() ? "var(--accent-base)" : "transparent",
          transition: dragging() ? "none" : "background 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!dragging()) e.currentTarget.style.background = "var(--border-base)"
        }}
        onMouseLeave={(e) => {
          if (!dragging()) e.currentTarget.style.background = "transparent"
        }}
      />
      {/* Header */}
      <div class="flex items-start justify-between p-4 border-b border-border-base shrink-0">
        <div class="flex-1 min-w-0">
          <div class="flex items-start gap-2 mb-2">
            <div class="text-sm font-semibold text-text-base break-words leading-snug flex-1 min-w-0">
              {props.atom.atom_name}
            </div>
            <Show when={atomSessionId()}>
              <Show when={props.onToggleChat}>
                <button
                  onClick={props.onToggleChat}
                  title={props.chatOpen ? "Close chat panel" : "Open chat panel"}
                  class="flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] cursor-pointer shrink-0 whitespace-nowrap transition-colors"
                  classList={{
                    "border-accent-base bg-accent-base/10 text-accent-base": props.chatOpen,
                    "border-border-base bg-transparent text-text-weak hover:text-text-base": !props.chatOpen,
                  }}
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
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Chat
                </button>
              </Show>
              <button
                onClick={navigateToAtomSession}
                title="Go to atom session"
                class="flex items-center gap-1 px-2 py-0.5 rounded border border-border-base bg-transparent text-accent-base text-[11px] cursor-pointer shrink-0 whitespace-nowrap hover:bg-background-stronger transition-colors"
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
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Session
              </button>
            </Show>
            <Show when={props.onDelete}>
              <Show
                when={!confirmDelete()}
                fallback={
                  <div class="flex items-center gap-1 shrink-0">
                    <button
                      onClick={handleDelete}
                      disabled={deleting()}
                      class="flex items-center gap-1 px-2 py-0.5 rounded border border-red-600 bg-red-600 text-white text-[11px] whitespace-nowrap"
                      style={{
                        cursor: deleting() ? "not-allowed" : "pointer",
                        opacity: deleting() ? "0.6" : "1",
                      }}
                    >
                      {deleting() ? "Deleting..." : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      class="px-2 py-0.5 rounded border border-border-base bg-transparent text-text-weak text-[11px] cursor-pointer whitespace-nowrap hover:text-text-base transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                }
              >
                <button
                  onClick={() => setConfirmDelete(true)}
                  title="Delete atom"
                  class="flex items-center gap-1 px-2 py-0.5 rounded border border-border-base bg-transparent text-red-400 text-[11px] cursor-pointer shrink-0 whitespace-nowrap hover:border-red-400 transition-colors"
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
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
                  </svg>
                  Delete
                </button>
              </Show>
            </Show>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <span
              class="text-[11px] font-medium px-2 py-0.5 rounded"
              style={{
                background: `${typeColor()}22`,
                color: typeColor(),
              }}
            >
              {props.atom.atom_type}
            </span>
            <StatusSelector
              current={props.atom.atom_evidence_status}
              updating={updatingStatus()}
              onSelect={handleUpdateStatus}
            />
          </div>
        </div>
        <button
          onClick={props.onClose}
          class="flex items-center justify-center w-7 h-7 border border-border-base rounded-md bg-transparent text-text-weak cursor-pointer shrink-0 ml-3 hover:text-text-base hover:bg-background-stronger transition-colors"
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

      {/* Two-column content */}
      <div class="flex-1 min-h-0 flex">
        {/* Left column: Claim */}
        <div class="flex-1 min-w-0 p-4 flex flex-col gap-4 border-r border-border-base">
          <Section
            title="Claim"
            fill
            action={
              <Show when={props.onOpenFileDetail && props.atom.atom_claim_path}>
                <DetailButton onClick={() => props.onOpenFileDetail!(props.atom.atom_claim_path!, "Claim")} />
              </Show>
            }
          >
            <Show when={claimContent()} fallback={<EmptyHint text="No claim yet" />}>
              {(content) => <Markdown text={content()} class="text-12-regular" />}
            </Show>
          </Section>
        </div>

        {/* Right column: Evidence / Assessment */}
        <div class="flex-1 min-w-0 p-4 flex flex-col">
          <div class="bg-background-stronger rounded-lg border border-border-base flex flex-col flex-1 min-h-0">
            <div class="px-3 py-0 border-b border-border-base shrink-0 flex items-center gap-0">
              <button
                onClick={() => setEvidenceTab("evidence")}
                class="px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 bg-transparent cursor-pointer transition-colors"
                classList={{
                  "border-accent-base text-accent-base": evidenceTab() === "evidence",
                  "border-transparent text-text-weak hover:text-text-base": evidenceTab() !== "evidence",
                }}
              >
                Evidence
              </button>
              <button
                onClick={() => setEvidenceTab("assessment")}
                class="px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 bg-transparent cursor-pointer transition-colors"
                classList={{
                  "border-accent-base text-accent-base": evidenceTab() === "assessment",
                  "border-transparent text-text-weak hover:text-text-base": evidenceTab() !== "assessment",
                }}
              >
                Assessment
              </button>
              <Show when={props.onOpenFileDetail}>
                <div class="flex-1" />
                <DetailButton
                  onClick={() => {
                    const path =
                      evidenceTab() === "evidence"
                        ? props.atom.atom_evidence_path
                        : props.atom.atom_evidence_assessment_path
                    if (path) props.onOpenFileDetail!(path, evidenceTab() === "evidence" ? "Evidence" : "Assessment")
                  }}
                />
              </Show>
            </div>
            <div class="p-3 overflow-y-auto flex-1 min-h-0">
              <Show when={evidenceTab() === "evidence"}>
                <Show when={evidenceContent()} fallback={<EmptyHint text="No evidence yet" />}>
                  {(content) => <Markdown text={content()} class="text-12-regular" />}
                </Show>
              </Show>
              <Show when={evidenceTab() === "assessment"}>
                <Show when={assessmentContent()} fallback={<EmptyHint text="No assessment yet" />}>
                  {(content) => <Markdown text={content()} class="text-12-regular" />}
                </Show>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section(props: { title: string; fill?: boolean; action?: any; children: any }) {
  return (
    <div
      class="bg-background-stronger rounded-lg border border-border-base flex flex-col"
      classList={{
        "flex-1 min-h-0": props.fill,
      }}
    >
      <div class="px-3 py-2.5 border-b border-border-base text-xs font-semibold text-text-weak uppercase tracking-wider shrink-0 flex items-center justify-between">
        {props.title}
        {props.action}
      </div>
      <div
        class="p-3"
        classList={{
          "overflow-y-auto flex-1 min-h-0": props.fill,
        }}
      >
        {props.children}
      </div>
    </div>
  )
}

const EVIDENCE_STATUSES = ["pending", "in_progress", "supported", "refuted"] as const

function StatusSelector(props: { current: string; updating: boolean; onSelect: (status: string) => void }) {
  const [open, setOpen] = createSignal(false)
  const color = () => STATUS_COLORS[props.current] ?? "var(--text-weakest)"

  return (
    <div class="relative">
      <button
        onClick={() => setOpen(!open())}
        disabled={props.updating}
        class="text-[11px] font-medium px-2 py-0.5 rounded border-none flex items-center gap-1"
        style={{
          background: `${color()}22`,
          color: color(),
          cursor: props.updating ? "not-allowed" : "pointer",
          opacity: props.updating ? "0.6" : "1",
        }}
      >
        {props.updating ? "Updating..." : props.current}
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <Show when={open()}>
        <div class="absolute top-full left-0 mt-1 z-50 bg-background-stronger border border-border-base rounded-md p-1 shadow-lg min-w-[120px]">
          <For each={EVIDENCE_STATUSES}>
            {(status) => {
              const c = () => STATUS_COLORS[status] ?? "var(--text-weakest)"
              return (
                <button
                  onClick={() => {
                    setOpen(false)
                    if (status !== props.current) props.onSelect(status)
                  }}
                  class="flex items-center gap-2 w-full px-2 py-1 border-none rounded text-[11px] cursor-pointer text-left"
                  classList={{
                    "bg-background-base": status === props.current,
                    "bg-transparent hover:bg-background-base": status !== props.current,
                  }}
                  style={{ color: c() }}
                >
                  <span class="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c() }} />
                  {status}
                </button>
              )
            }}
          </For>
        </div>
      </Show>
    </div>
  )
}

function EmptyHint(props: { text: string }) {
  return <div class="text-xs text-text-weakest">{props.text}</div>
}

function DetailButton(props: { onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      title="View detail"
      class="px-1.5 py-px border border-border-base rounded bg-transparent text-text-weak text-[11px] cursor-pointer whitespace-nowrap hover:text-text-base transition-colors"
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
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </button>
  )
}

