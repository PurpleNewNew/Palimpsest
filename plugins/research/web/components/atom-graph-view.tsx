import { For, Show, type JSX } from "solid-js"
import {
  NodeGraphWorkbench,
  type DefaultAnchorAction,
  type EdgeAdapter,
  type NodeAdapter,
} from "@palimpsest/plugin-sdk/web/graph-workbench"

import { RESEARCH_TAXONOMY } from "./research-taxonomy"

export type ResearchAtomKind = "fact" | "method" | "theorem" | "verification"

/**
 * Minimal shape of a research atom that this lens binding needs.
 * Matches the field-level subset of `ResearchAtomsListResponse["atoms"][number]`
 * in `apps/web/src/pages/session/research-legacy-sdk.ts` that the graph
 * workbench reads. Kept narrow so the host's legacy SDK changes do not
 * ripple into the plugin package.
 */
export type ResearchAtomShape = {
  atom_id: string
  atom_name: string
  atom_type: string
  atom_evidence_status: string
  atom_evidence_type: string
}

export type ResearchRelationShape = {
  atom_id_source: string
  atom_id_target: string
  relation_type: string
  note?: string | null
}

const evidenceLabel = (t: string): string => {
  if (t === "math") return "Math"
  if (t === "experiment") return "Experiment"
  return t
}

const NODE_ADAPTER: NodeAdapter<ResearchAtomShape> = {
  id: (a) => a.atom_id,
  kind: (a) => a.atom_type,
  title: (a) => a.atom_name,
  status: (a) => a.atom_evidence_status,
  meta: (a) => ({ Evidence: evidenceLabel(a.atom_evidence_type) }),
}

const EDGE_ADAPTER: EdgeAdapter<ResearchRelationShape> = {
  id: (r) => `${r.atom_id_source}-${r.relation_type}-${r.atom_id_target}`,
  source: (r) => r.atom_id_source,
  target: (r) => r.atom_id_target,
  kind: (r) => r.relation_type,
  note: (r) => r.note ?? undefined,
}

export type AtomGraphViewProps = {
  atoms: ResearchAtomShape[]
  relations: ResearchRelationShape[]
  loading: boolean
  error: boolean
  onAtomClick: (atomId: string) => void
  onAtomCreate: (input: { name: string; type: ResearchAtomKind }) => Promise<ResearchAtomShape>
  onAtomDelete: (atomId: string) => Promise<void>
  onRelationCreate: (input: {
    sourceAtomId: string
    targetAtomId: string
    relationType: string
  }) => Promise<void>
  onRelationUpdate: (input: {
    sourceAtomId: string
    targetAtomId: string
    relationType: string
    nextRelationType: string
  }) => Promise<void>
  onRelationDelete: (input: {
    sourceAtomId: string
    targetAtomId: string
    relationType: string
  }) => Promise<void>
  onAtomViewDetail?: (atomId: string) => void
  researchProjectId: string
}

/**
 * Research lens binding around the generic `<NodeGraphWorkbench>`.
 *
 * Maps the lens-shaped Atom / Relation field names to the primitive's
 * adapter contract via `NODE_ADAPTER` and `EDGE_ADAPTER`, supplies
 * `RESEARCH_TAXONOMY` for kind / status colors, and translates each
 * lens-flavored callback (onAtomCreate / onAtomDelete / onRelation*)
 * into the primitive's (onNodeCreate / onNodeDelete / onEdge*) shape.
 *
 * Preserves baseline 1:1 by wiring `onNodeClick` to `props.onAtomClick`
 * (which the host typically uses to create a session). The default
 * anchor "view-detail" button — which would also route through
 * `onNodeClick` and therefore session-create — is overridden via
 * `slots.anchorActions` so it continues to call
 * `props.onAtomViewDetail` (fullscreen inspect) per baseline. This
 * intentionally keeps the inspect-vs-act split that baseline relies
 * on; the spec-flagged "click should not session-create" cleanup is
 * tracked separately (see `specs/graph-workbench-pattern.md` Sessions).
 *
 * Persistence is keyed by lensID="research" so a future security-audit
 * binding on the same project does not collide.
 */
export function AtomGraphView(props: AtomGraphViewProps): JSX.Element {
  return (
    <NodeGraphWorkbench<ResearchAtomShape, ResearchRelationShape>
      nodes={props.atoms}
      edges={props.relations}
      loading={props.loading}
      error={props.error}
      nodeAdapter={NODE_ADAPTER}
      edgeAdapter={EDGE_ADAPTER}
      taxonomy={RESEARCH_TAXONOMY}
      projectID={props.researchProjectId}
      lensID="research"
      onNodeClick={props.onAtomClick}
      onNodeCreate={async (input) =>
        props.onAtomCreate({ name: input.name, type: input.kind as ResearchAtomKind })
      }
      onNodeDelete={props.onAtomDelete}
      onEdgeCreate={(input) =>
        props.onRelationCreate({
          sourceAtomId: input.sourceID,
          targetAtomId: input.targetID,
          relationType: input.kind,
        })
      }
      onEdgeUpdate={(input) =>
        props.onRelationUpdate({
          sourceAtomId: input.sourceID,
          targetAtomId: input.targetID,
          relationType: input.previousKind,
          nextRelationType: input.kind,
        })
      }
      onEdgeDelete={(input) =>
        props.onRelationDelete({
          sourceAtomId: input.sourceID,
          targetAtomId: input.targetID,
          relationType: input.kind,
        })
      }
      slots={{
        anchorActions: (node, defaults) => (
          <ResearchAnchorToolbar
            defaults={defaults.filter((d) => d.id !== "view-detail")}
            viewDetail={
              props.onAtomViewDetail ? () => props.onAtomViewDetail?.(node.atom_id) : undefined
            }
          />
        ),
      }}
    />
  )
}

/**
 * Anchor toolbar override for the research lens. Renders the primitive's
 * default add-edge / delete buttons (passed through `defaults`) plus a
 * custom "View detail" button that calls `props.onAtomViewDetail`
 * instead of the primitive's default view-detail handler (which would
 * route through `onNodeClick` = `onAtomClick` = session-create).
 *
 * Markup mirrors the primitive's `DefaultAnchorToolbar` so the visual
 * experience is identical; only the view-detail callback differs.
 */
function ResearchAnchorToolbar(props: {
  defaults: DefaultAnchorAction[]
  viewDetail?: () => void
}): JSX.Element {
  return (
    <div class="flex flex-col gap-1 rounded-lg border border-white/10 bg-[rgba(15,23,42,0.88)] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-sm">
      <For each={props.defaults}>
        {(d) => (
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-md text-[#94a3b8] transition-all hover:bg-indigo-500/20 hover:text-indigo-400 disabled:opacity-40"
            title={d.id === "add-edge" ? "Create relation" : "Delete atom"}
            disabled={!d.enabled}
            onMouseDown={(evt) => {
              evt.preventDefault()
              evt.stopPropagation()
              if (!d.enabled) return
              d.invoke()
            }}
          >
            <Show when={d.id === "add-edge"} fallback={<DeleteIcon />}>
              <ConnectIcon />
            </Show>
          </button>
        )}
      </For>
      <Show when={props.viewDetail}>
        {(invoke) => (
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-md text-[#94a3b8] transition-all hover:bg-indigo-500/20 hover:text-indigo-400"
            title="View in detail"
            onMouseDown={(evt) => {
              evt.preventDefault()
              evt.stopPropagation()
              invoke()()
            }}
          >
            <ViewDetailIcon />
          </button>
        )}
      </Show>
    </div>
  )
}

function ConnectIcon(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M10.5 5.5 C10.5 3.57 9.93 2 8 2 C6.07 2 5.5 3.57 5.5 5.5 L5.5 10.5 C5.5 12.43 6.07 14 8 14 C9.93 14 10.5 12.43 10.5 10.5" />
      <circle cx="5.5" cy="5.5" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="10.5" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function DeleteIcon(): JSX.Element {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M2 4h12M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l.8 9.1A1 1 0 0 0 4.8 14h6.4a1 1 0 0 0 1-.9L13 4" />
    </svg>
  )
}

function ViewDetailIcon(): JSX.Element {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="1" y="1" width="14" height="14" rx="2" />
      <line x1="9" y1="1" x2="9" y2="15" />
      <polyline points="5.5 6 3.5 8 5.5 10" />
    </svg>
  )
}
