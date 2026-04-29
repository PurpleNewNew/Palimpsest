import { createEffect, createMemo, createSignal, on, Show, type Component } from "solid-js"
import { ObjectWorkspaceFullscreen } from "@palimpsest/plugin-sdk/web/object-workspace-fullscreen"
import { SessionChatPanel } from "@palimpsest/plugin-sdk/web/chat/session-chat-panel"
import { AtomDetailView } from "./atom-detail-view"
import { AtomDetailPanel } from "./atom-detail-panel"
import { FileDetailPanel } from "./file-detail-panel"
import type { ResearchAtomsListResponse } from "../research-sdk"

type Atom = ResearchAtomsListResponse["atoms"][number]
type Relation = ResearchAtomsListResponse["relations"][number]
type AtomKind = "fact" | "method" | "theorem" | "verification"

/**
 * Plugin-owned research-lens fullscreen overlay. Composes the
 * `<ObjectWorkspaceFullscreen>` primitive (clip-path animation, top bar,
 * 3-pane layout, body lock, Escape, Portal) with the research lens's
 * own slot content (graph, atom detail panel, atom chat, file inspector).
 *
 * Migrated from `apps/web/src/pages/session/atom-detail-fullscreen.tsx`
 * in step 9d.3 of the host-context promotion. The host shell injects
 * its prompt-input component via the `chatInput` slot so the research
 * plugin does not depend on `apps/web` directly.
 */
export function AtomDetailFullscreen(props: {
  atoms: Atom[]
  relations: Relation[]
  loading: boolean
  error: boolean
  onAtomClick: (atomId: string) => void
  onAtomCreate: (input: { name: string; type: AtomKind }) => Promise<Atom>
  onAtomDelete: (atomId: string) => Promise<void>
  onRelationCreate: (input: { sourceAtomId: string; targetAtomId: string; relationType: string }) => Promise<void>
  onRelationUpdate: (input: {
    sourceAtomId: string
    targetAtomId: string
    relationType: string
    nextRelationType: string
  }) => Promise<void>
  onRelationDelete: (input: { sourceAtomId: string; targetAtomId: string; relationType: string }) => Promise<void>
  researchProjectId: string
  originRect: { x: number; y: number; width: number; height: number }
  visible: boolean
  focusAtomId?: string | null
  onClose: () => void
  /** Host-provided prompt-input component for the inline chat slot. */
  chatInput: Component
}) {
  const [selectedAtomId, setSelectedAtomId] = createSignal<string | null>(null)
  const [atomSessionId, setAtomSessionId] = createSignal<string | null>(null)
  const [chatOpen, setChatOpen] = createSignal(false)
  const [fileDetail, setFileDetail] = createSignal<{ path: string; title: string } | null>(null)
  const selectedAtom = createMemo(() => {
    const id = selectedAtomId()
    if (!id) return null
    return props.atoms.find((a) => a.atom_id === id) ?? null
  })

  // When opened with a focus atom, pre-select it to open the side panel.
  createEffect(
    on(
      () => [props.visible, props.focusAtomId] as const,
      ([visible, focusId]) => {
        if (visible && focusId) {
          setAtomSessionId(null)
          setChatOpen(false)
          setFileDetail(null)
          setSelectedAtomId(focusId)
        }
      },
    ),
  )

  const atomIcon = (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="text-accent-base"
    >
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="3" x2="12" y2="9" />
      <line x1="12" y1="15" x2="12" y2="21" />
      <line x1="3" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="21" y2="12" />
    </svg>
  )

  return (
    <>
      {/* Lens-owned global styles for the AtomDetailView graph (solid-flow)
          and the chat-panel slide-in animation. The fullscreen primitive
          intentionally does not own graph CSS or per-overlay animations. */}
      <style>{`
        @keyframes chat-panel-slide-in {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .solid-flow {
          --xy-edge-label-background-color: rgba(15, 23, 42, 0.85);
          --xy-edge-label-color: #94a3b8;
          --xy-handle-background-color: #334155;
          --xy-handle-border-color: #475569;
          --xy-connectionline-stroke-default: #60a5fa;
          --xy-connectionline-stroke-width-default: 2;
        }
        .solid-flow__connectionline {
          overflow: visible !important;
        }
        .solid-flow__connection-path {
          stroke-dasharray: 6 3;
          animation: connectionLineDash 0.5s linear infinite;
        }
        @keyframes connectionLineDash {
          to { stroke-dashoffset: -9; }
        }
        .solid-flow__edge:hover .solid-flow__edge-path {
          stroke-width: 3px !important;
          filter: drop-shadow(0 0 3px currentColor);
        }
        .solid-flow__handle.connectingfrom,
        .solid-flow__handle.connectionindicator {
          --xy-handle-background-color: #60a5fa;
          --xy-handle-border-color: #93c5fd;
        }
        .solid-flow__edge-label {
          border-radius: 4px;
          padding: 2px 6px !important;
          font-size: 10px;
          backdrop-filter: blur(4px);
        }
      `}</style>
      <ObjectWorkspaceFullscreen
        visible={props.visible}
        originRect={props.originRect}
        onClose={props.onClose}
        title="Atom Detail"
        icon={atomIcon}
        center={
          <AtomDetailView
            atoms={props.atoms}
            relations={props.relations}
            loading={props.loading}
            error={props.error}
            focusAtomId={props.focusAtomId}
            onAtomClick={(atomId) => {
              setChatOpen(false)
              setSelectedAtomId(atomId)
            }}
            onAtomCreate={props.onAtomCreate}
            onAtomDelete={props.onAtomDelete}
            onRelationCreate={props.onRelationCreate}
            onRelationUpdate={props.onRelationUpdate}
            onRelationDelete={props.onRelationDelete}
            researchProjectId={props.researchProjectId}
          />
        }
        leftOverlay={
          <Show when={chatOpen() && atomSessionId()}>
            {(sessionId) => (
              <div
                style={{
                  height: "100%",
                  animation: "chat-panel-slide-in 250ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              >
                <SessionChatPanel
                  sessionID={sessionId()}
                  onClose={() => setChatOpen(false)}
                  title="Atom Chat"
                  input={props.chatInput}
                />
              </div>
            )}
          </Show>
        }
        fileOverlay={({ leftOverlayWidth }) => (
          <Show when={fileDetail()}>
            {(detail) => (
              <FileDetailPanel
                path={detail().path}
                title={detail().title}
                onClose={() => setFileDetail(null)}
                leftOffset={leftOverlayWidth()}
              />
            )}
          </Show>
        )}
        right={
          <Show when={selectedAtom()}>
            {(atom) => (
              <AtomDetailPanel
                atom={atom()}
                onClose={() => {
                  setSelectedAtomId(null)
                  setAtomSessionId(null)
                  setChatOpen(false)
                  setFileDetail(null)
                }}
                onDelete={props.onAtomDelete}
                onAtomSessionId={(id) => {
                  setAtomSessionId(id)
                }}
                chatOpen={chatOpen()}
                onToggleChat={() => setChatOpen((v) => !v)}
                onOpenFileDetail={(path, title) => setFileDetail({ path, title })}
              />
            )}
          </Show>
        }
      />
    </>
  )
}
