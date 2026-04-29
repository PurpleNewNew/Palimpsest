import { createMemo, createResource, createSignal, For, Match, Show, Switch, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { Button } from "@palimpsest/ui/button"
import { ObjectWorkspaceFullscreen } from "@palimpsest/plugin-sdk/web/object-workspace-fullscreen"
import { FileInspector } from "@palimpsest/plugin-sdk/web/file-inspector"

import {
  type SecurityFindingKind,
  type SecurityGraph,
  type SecurityNode,
  useSecurityAudit,
} from "../context/security-audit"
import { SecurityGraphCanvas } from "./security-graph-canvas"
import { PLAYBOOKS, playbookFor } from "./playbooks"

type View = "graph" | "findings" | "workflows" | "evidence"
type Node = SecurityGraph["nodes"][number]

const KIND_LABELS: Record<SecurityFindingKind, string> = {
  ssrf: "SSRF",
  auth_bypass: "Auth bypass",
  deserialization: "Deserialization",
  rce: "RCE",
  generic: "Generic",
}

const NODE_COLORS: Record<string, string> = {
  target: "#60a5fa",
  surface: "#22c55e",
  finding: "#f97316",
  risk: "#f43f5e",
  control: "#a78bfa",
  assumption: "#facc15",
}

function playbook(node: Node) {
  return playbookFor(findingKind(node), node.kind)
}

function data(node: SecurityNode | undefined, key: string) {
  const value = node?.data?.[key]
  return typeof value === "string" ? value : undefined
}

/**
 * Evidence source citation extractor. Reads the standardised
 * `data.source = { file, line, snippet?, ... }` shape that the
 * `semgrep-evidence` and `codeql-evidence` skills push agents toward.
 * Falsy when the artifact carries no recognisable citation; reviewers
 * then fall back to the stringified metadata blob below.
 *
 * Accepts both Semgrep's `line` and CodeQL's `startLine`.
 */
function evidenceCitation(d: unknown): { file: string; line?: number; snippet?: string } | undefined {
  if (!d || typeof d !== "object") return undefined
  const source = (d as Record<string, unknown>).source
  if (!source || typeof source !== "object") return undefined
  const s = source as Record<string, unknown>
  if (typeof s.file !== "string") return undefined
  const line = typeof s.line === "number"
    ? s.line
    : typeof s.startLine === "number"
      ? s.startLine
      : undefined
  const snippet = typeof s.snippet === "string" ? s.snippet : undefined
  return { file: s.file, line, snippet }
}

/**
 * Stringify the rest of the artifact metadata for reviewer context,
 * with the `source` field stripped (it is rendered as a citation
 * pill above). Truncated to 180 chars by the caller.
 */
function evidenceRest(d: unknown): string | undefined {
  if (!d || typeof d !== "object") return undefined
  const { source: _drop, ...rest } = d as Record<string, unknown>
  if (Object.keys(rest).length === 0) return undefined
  return JSON.stringify(rest)
}

function findingKind(node: Node | undefined): SecurityFindingKind {
  if (!node) return "generic"
  if (node.findingKind) return node.findingKind
  const stored = data(node, "findingKind")
  if (stored === "ssrf" || stored === "auth_bypass" || stored === "deserialization" || stored === "rce") return stored
  const haystack = `${node.title}\n${node.body ?? ""}`.toLowerCase()
  if (haystack.includes("ssrf") || haystack.includes("server-side request")) return "ssrf"
  if (haystack.includes("auth") || haystack.includes("authorization") || haystack.includes("access control")) {
    return "auth_bypass"
  }
  if (haystack.includes("deserialize") || haystack.includes("deserialization")) return "deserialization"
  if (haystack.includes("rce") || haystack.includes("remote code") || haystack.includes("command injection")) return "rce"
  return "generic"
}

function short(value?: string, fallback = "No detail yet.") {
  const text = value?.trim()
  if (!text) return fallback
  return text.length > 180 ? `${text.slice(0, 177)}...` : text
}

function nodeTone(node: SecurityNode) {
  return NODE_COLORS[node.kind] ?? "#94a3b8"
}

function Badge(props: { children: JSX.Element; tone?: string }) {
  return (
    <span class="inline-flex items-center rounded-full bg-background-stronger px-2 py-0.5 text-10-medium uppercase tracking-wide text-text-weak">
      <Show when={props.tone}>
        {(tone) => <span class="mr-1 size-1.5 rounded-full" style={{ background: tone() }} />}
      </Show>
      {props.children}
    </span>
  )
}

function Empty(props: { title: string; body: string }) {
  return (
    <div class="flex h-full items-center justify-center p-8 text-center">
      <div>
        <div class="text-13-medium text-text-strong">{props.title}</div>
        <div class="mt-1 max-w-72 text-12-regular text-text-weak">{props.body}</div>
      </div>
    </div>
  )
}

function NodeCard(props: { node: Node; active?: boolean; onClick: () => void }) {
  return (
    <button
      class="w-full rounded-md border px-3 py-2.5 text-left transition-colors"
      classList={{
        "border-border-accent-base bg-background-stronger": props.active,
        "border-border-weak-base bg-background-base hover:bg-background-stronger": !props.active,
      }}
      onClick={props.onClick}
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 truncate text-13-semibold text-text-strong">{props.node.title}</div>
        <Badge tone={nodeTone(props.node)}>{props.node.kind}</Badge>
      </div>
      <div class="mt-1 text-11-regular text-text-weak">{short(props.node.body, "No body recorded.")}</div>
      <Show when={props.node.kind === "finding"}>
        <div class="mt-2 flex gap-1">
          <Badge>{KIND_LABELS[findingKind(props.node)]}</Badge>
          <Show when={data(props.node, "severity")}>{(value) => <Badge>{value()}</Badge>}</Show>
        </div>
      </Show>
    </button>
  )
}

function DetailPanel(props: {
  node: Node
  graph: SecurityGraph
  sessionID?: string
  onClose: () => void
  onOpenFile?: (input: { path: string; line?: number }) => void
}) {
  const audit = useSecurityAudit()
  const params = useParams()
  const navigate = useNavigate()
  const [opening, setOpening] = createSignal(false)
  const kind = createMemo(() => findingKind(props.node))
  const book = createMemo(() => playbook(props.node))
  const runs = createMemo(() => props.graph.runs.filter((run) => run.nodeID === props.node.id))
  const artifacts = createMemo(() => props.graph.artifacts.filter((item) => item.nodeID === props.node.id))
  const decisions = createMemo(() => props.graph.decisions.filter((item) => item.nodeID === props.node.id))
  const proposals = createMemo(() =>
    props.graph.pendingProposals.filter((item) => {
      const refs = item.refs ?? {}
      return refs.findingID === props.node.id || refs.nodeID === props.node.id || item.title?.includes(props.node.title)
    }),
  )

  async function openSession() {
    if (opening()) return
    setOpening(true)
    try {
      const session = await audit.nodeSession({ nodeID: props.node.id, parentID: props.sessionID })
      if (session.id && params.dir) navigate(`/${params.dir}/session/${session.id}`)
    } finally {
      setOpening(false)
    }
  }

  return (
    <div class="flex h-full flex-col border-l border-border-base bg-background-base">
      <div class="flex h-11 shrink-0 items-center justify-between border-b border-border-base px-3">
        <div class="min-w-0">
          <div class="truncate text-13-semibold text-text-strong">{props.node.title}</div>
          <div class="flex items-center gap-1">
            <Badge tone={nodeTone(props.node)}>{props.node.kind}</Badge>
            <Show when={props.node.kind === "finding" || props.node.kind === "risk"}>
              <Badge>{KIND_LABELS[kind()]}</Badge>
            </Show>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <Button size="small" variant="secondary" onClick={openSession} disabled={opening()}>
            {opening() ? "..." : "Session"}
          </Button>
          <button class="rounded-md px-2 py-1 text-16-regular text-text-weak hover:bg-background-stronger hover:text-text-base" onClick={props.onClose}>
            ×
          </button>
        </div>
      </div>
      <div class="min-h-0 flex-1 overflow-auto p-3">
        <section class="rounded-md border border-border-weak-base bg-background-stronger p-3">
          <div class="text-11-medium uppercase tracking-wide text-text-weak">Workflow</div>
          <div class="mt-1 text-14-medium text-text-strong">{book().title}</div>
          <div class="mt-3 flex flex-col gap-2">
            <For each={book().steps}>
              {(step, idx) => (
                <div class="flex gap-2 rounded-md bg-background-base p-2">
                  <div class="flex size-5 shrink-0 items-center justify-center rounded-full bg-background-stronger text-10-medium text-text-weak">
                    {idx() + 1}
                  </div>
                  <div class="text-12-regular text-text-base">{step}</div>
                </div>
              )}
            </For>
          </div>
        </section>

        <section class="mt-3 rounded-md border border-border-weak-base bg-background-stronger p-3">
          <div class="text-11-medium uppercase tracking-wide text-text-weak">Hypothesis</div>
          <div class="mt-2 whitespace-pre-wrap text-12-regular text-text-base">{props.node.body || "No hypothesis body yet."}</div>
          <div class="mt-3 flex flex-wrap gap-1">
            <Show when={data(props.node, "severity")}>{(value) => <Badge>severity {value()}</Badge>}</Show>
            <Show when={data(props.node, "confidence")}>{(value) => <Badge>confidence {value()}</Badge>}</Show>
            <Show when={data(props.node, "validationStatus")}>{(value) => <Badge>validation {value()}</Badge>}</Show>
          </div>
        </section>

        <section class="mt-3 rounded-md border border-border-weak-base bg-background-stronger p-3">
          <div class="flex items-center justify-between">
            <div class="text-11-medium uppercase tracking-wide text-text-weak">Evidence</div>
            <div class="text-11-regular text-text-weak">{artifacts().length}</div>
          </div>
          <div class="mt-2 flex flex-col gap-2">
            <For each={artifacts()} fallback={<div class="text-12-regular text-text-weak">No evidence attached yet.</div>}>
              {(item) => {
                const cite = evidenceCitation(item.data)
                return (
                  <div class="rounded-md bg-background-base p-2">
                    <div class="text-12-medium text-text-strong">{item.title ?? item.kind}</div>
                    <Show when={cite}>
                      {(c) => (
                        <Show
                          when={props.onOpenFile}
                          fallback={
                            <div
                              class="mt-1 inline-block rounded bg-background-stronger px-1.5 py-0.5 font-mono text-11-regular text-text-base"
                              title="Source citation"
                            >
                              {c().file}
                              <Show when={c().line}>
                                {(line) => <>:{line()}</>}
                              </Show>
                            </div>
                          }
                        >
                          {(open) => (
                            <button
                              type="button"
                              class="mt-1 inline-flex items-center rounded bg-background-stronger px-1.5 py-0.5 font-mono text-11-regular text-text-base hover:bg-background-stronger-hover hover:text-text-strong cursor-pointer transition-colors"
                              title="Open cited file"
                              onClick={() => open()({ path: c().file, line: c().line })}
                            >
                              {c().file}
                              <Show when={c().line}>
                                {(line) => <>:{line()}</>}
                              </Show>
                            </button>
                          )}
                        </Show>
                      )}
                    </Show>
                    <Show when={cite?.snippet}>
                      {(snippet) => (
                        <pre class="mt-1 overflow-x-auto rounded bg-background-stronger p-2 text-11-regular text-text-base whitespace-pre">
                          {snippet()}
                        </pre>
                      )}
                    </Show>
                    <Show when={evidenceRest(item.data)}>
                      {(rest) => (
                        <div class="mt-1 text-11-regular text-text-weak">{rest().slice(0, 180)}</div>
                      )}
                    </Show>
                  </div>
                )
              }}
            </For>
          </div>
        </section>

        <section class="mt-3 rounded-md border border-border-weak-base bg-background-stronger p-3">
          <div class="flex items-center justify-between">
            <div class="text-11-medium uppercase tracking-wide text-text-weak">Assessment</div>
            <div class="text-11-regular text-text-weak">{decisions().length}</div>
          </div>
          <div class="mt-2 flex flex-col gap-2">
            <For each={decisions()} fallback={<div class="text-12-regular text-text-weak">No risk decision yet.</div>}>
              {(item) => (
                <div class="rounded-md bg-background-base p-2">
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-12-medium text-text-strong">{item.kind.replaceAll("_", " ")}</div>
                    <Badge>{item.state ?? "pending"}</Badge>
                  </div>
                  <Show when={item.rationale}>
                    {(text) => <div class="mt-1 text-11-regular text-text-weak">{text()}</div>}
                  </Show>
                </div>
              )}
            </For>
          </div>
        </section>

        <section class="mt-3 rounded-md border border-border-weak-base bg-background-stronger p-3">
          <div class="flex items-center justify-between">
            <div class="text-11-medium uppercase tracking-wide text-text-weak">Runs & Proposals</div>
            <div class="text-11-regular text-text-weak">{runs().length + proposals().length}</div>
          </div>
          <div class="mt-2 flex flex-col gap-2">
            <For each={runs()}>
              {(run) => (
                <div class="rounded-md bg-background-base p-2">
                  <div class="text-12-medium text-text-strong">{run.title ?? run.kind}</div>
                  <div class="mt-1 text-11-regular text-text-weak">
                    {run.kind} · {run.status}
                    <Show when={run.sessionID}> · session linked</Show>
                  </div>
                </div>
              )}
            </For>
            <For each={proposals()}>
              {(item) => (
                <div class="rounded-md bg-background-base p-2">
                  <div class="text-12-medium text-text-strong">{item.title ?? item.id}</div>
                  <div class="mt-1 text-11-regular text-text-weak">proposal · {item.status ?? "pending"}</div>
                </div>
              )}
            </For>
            <Show when={runs().length + proposals().length === 0}>
              <div class="text-12-regular text-text-weak">No workflow history yet.</div>
            </Show>
          </div>
        </section>
      </div>
    </div>
  )
}

function DetailFullscreen(props: {
  visible: boolean
  graph: SecurityGraph
  node: Node | undefined
  sessionID?: string
  onSelect: (node: Node) => void
  onClose: () => void
}) {
  // Migrated from a hand-rolled 2-pane fullscreen to the
  // <ObjectWorkspaceFullscreen> primitive in step 9d.3 (specs/
  // graph-workbench-pattern.md P0.e). The fileOverlay slot is wired
  // through the <FileInspector> primitive so a finding's source
  // citation pill (Gap 1) can drill into the cited code without the
  // lens needing host context. The leftOverlay slot is still empty;
  // a reviewer-AI chat primitive (B) will plug in there next.
  const icon = (
    <span class="size-2 rounded-full bg-icon-warning-base" aria-hidden="true" />
  )
  const [fileToView, setFileToView] = createSignal<{ path: string; line?: number } | null>(null)
  return (
    <ObjectWorkspaceFullscreen
      visible={props.visible}
      onClose={props.onClose}
      title="Security Object Workflow"
      icon={icon}
      center={<SecurityGraphCanvas graph={props.graph} onSelect={props.onSelect} />}
      right={
        <Show when={props.node}>
          {(node) => (
            <div class="w-[440px] shrink-0">
              <DetailPanel
                node={node()}
                graph={props.graph}
                sessionID={props.sessionID}
                onClose={props.onClose}
                onOpenFile={(input) => setFileToView({ path: input.path, line: input.line })}
              />
            </div>
          )}
        </Show>
      }
      fileOverlay={({ leftOverlayWidth }) => (
        <Show when={fileToView()}>
          {(file) => (
            <FileInspector
              path={file().path}
              highlightLine={file().line}
              onClose={() => setFileToView(null)}
              leftOffset={leftOverlayWidth()}
            />
          )}
        </Show>
      )}
    />
  )
}

function GraphView(props: {
  graph: SecurityGraph
  selected?: string
  bootstrapping: boolean
  reviewingID?: string
  onBootstrap: () => void
  onReview: (proposalID: string, verdict: "approve" | "reject") => void
  onOpen: (node: Node) => void
}) {
  return (
    <div class="flex h-full flex-col">
      <div class="flex h-10 shrink-0 items-center justify-between px-3">
        <div>
          <div class="text-12-semibold text-text-weak uppercase tracking-wider">Graph</div>
          <div class="text-11-regular text-text-weak">Attack surface map. Click a node to open its own workflow.</div>
        </div>
        <div class="flex items-center gap-2">
          <div class="text-11-regular text-text-weak">{props.graph.nodes.length} nodes</div>
          <Button size="small" variant="secondary" onClick={props.onBootstrap} disabled={props.bootstrapping}>
            {props.bootstrapping ? "Bootstrapping..." : "Bootstrap"}
          </Button>
        </div>
      </div>
      <div class="min-h-0 flex-1 px-3 pb-3">
        <SecurityGraphCanvas graph={props.graph} onSelect={props.onOpen} />
      </div>
      <Show when={props.graph.pendingProposals.length > 0}>
        <div class="shrink-0 border-t border-border-base bg-background-stronger px-3 py-2">
          <div class="mb-2 flex items-center justify-between">
            <div class="text-11-medium uppercase tracking-wide text-text-weak">Pending security proposals</div>
            <div class="text-11-regular text-text-weak">{props.graph.pendingProposals.length}</div>
          </div>
          <div class="flex max-h-32 flex-col gap-1 overflow-auto">
            <For each={props.graph.pendingProposals}>
              {(item) => (
                <div class="flex items-center gap-2 rounded-md bg-background-base px-2 py-1.5">
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-12-medium text-text-strong">{item.title ?? item.id}</div>
                    <div class="truncate text-11-regular text-text-weak">{item.rationale ?? item.id}</div>
                  </div>
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={props.reviewingID === item.id}
                    onClick={() => props.onReview(item.id, "reject")}
                  >
                    Reject
                  </Button>
                  <Button
                    size="small"
                    variant="primary"
                    disabled={props.reviewingID === item.id}
                    onClick={() => props.onReview(item.id, "approve")}
                  >
                    {props.reviewingID === item.id ? "..." : "Approve"}
                  </Button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}

function FindingsView(props: { graph: SecurityGraph; selected?: string; onOpen: (node: Node) => void }) {
  const findings = createMemo(() => props.graph.nodes.filter((node) => node.kind === "finding" || node.kind === "risk"))
  return (
    <div class="flex h-full flex-col">
      <div class="flex h-10 shrink-0 items-center justify-between px-3">
        <div class="text-12-semibold text-text-weak uppercase tracking-wider">Findings</div>
        <div class="text-11-regular text-text-weak">{findings().length}</div>
      </div>
      <div class="min-h-0 flex-1 overflow-auto px-3 pb-3">
        <div class="flex flex-col gap-2">
          <For each={findings()} fallback={<Empty title="No findings yet" body="Create or approve a finding hypothesis to start node-specific workflows." />}>
            {(node) => <NodeCard node={node} active={props.selected === node.id} onClick={() => props.onOpen(node)} />}
          </For>
        </div>
      </div>
    </div>
  )
}

function WorkflowsView(props: { graph: SecurityGraph; selected?: string; onOpen: (node: Node) => void }) {
  const nodes = createMemo(() => props.graph.nodes.filter((node) => node.kind === "finding" || node.kind === "risk"))
  const runs = (node: SecurityNode) => props.graph.runs.filter((run) => run.nodeID === node.id)
  return (
    <div class="flex h-full flex-col">
      <div class="flex h-10 shrink-0 items-center justify-between px-3">
        <div class="text-12-semibold text-text-weak uppercase tracking-wider">Workflows</div>
        <div class="text-11-regular text-text-weak">per finding</div>
      </div>
      <div class="min-h-0 flex-1 overflow-auto px-3 pb-3">
        <div class="flex flex-col gap-2">
          <For each={nodes()} fallback={<Empty title="No workflows yet" body="Every security finding gets its own workflow once it exists." />}>
            {(node) => (
              <button
                class="rounded-md border border-border-weak-base bg-background-base p-3 text-left hover:bg-background-stronger"
                onClick={() => props.onOpen(node)}
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="truncate text-13-semibold text-text-strong">{node.title}</div>
                  <Badge>{KIND_LABELS[findingKind(node)]}</Badge>
                </div>
                <div class="mt-2 text-11-regular text-text-weak">{PLAYBOOKS[findingKind(node)].title}</div>
                <div class="mt-2 flex flex-wrap gap-1">
                  <Badge>{runs(node).length} runs</Badge>
                  <Show when={data(node, "validationStatus")}>{(value) => <Badge>{value()}</Badge>}</Show>
                </div>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}

function EvidenceView(props: { graph: SecurityGraph; onOpen: (node: Node) => void }) {
  const map = createMemo(() => new Map(props.graph.nodes.map((node) => [node.id, node])))
  return (
    <div class="flex h-full flex-col">
      <div class="flex h-10 shrink-0 items-center justify-between px-3">
        <div class="text-12-semibold text-text-weak uppercase tracking-wider">Evidence</div>
        <div class="text-11-regular text-text-weak">{props.graph.artifacts.length}</div>
      </div>
      <div class="min-h-0 flex-1 overflow-auto px-3 pb-3">
        <div class="flex flex-col gap-2">
          <For each={props.graph.artifacts} fallback={<Empty title="No evidence yet" body="Validation runs and evidence notes will appear here." />}>
            {(item) => {
              const node = createMemo(() => (item.nodeID ? map().get(item.nodeID) : undefined))
              return (
                <button
                  class="rounded-md border border-border-weak-base bg-background-base p-3 text-left hover:bg-background-stronger"
                  onClick={() => {
                    const target = node()
                    if (target) props.onOpen(target)
                  }}
                >
                  <div class="text-13-semibold text-text-strong">{item.title ?? item.kind}</div>
                  <div class="mt-1 text-11-regular text-text-weak">
                    {item.kind}
                    <Show when={node()}> · {node()!.title}</Show>
                  </div>
                </button>
              )
            }}
          </For>
        </div>
      </div>
    </div>
  )
}

export function SecurityAuditWorkbench(props: {
  view?: View
  sessionID?: string
  class?: string
}) {
  const audit = useSecurityAudit()
  const [refresh, setRefresh] = createSignal(0)
  const [graph] = createResource(refresh, () => audit.graph())
  const [selected, setSelected] = createSignal<Node | undefined>()
  const [detailOpen, setDetailOpen] = createSignal(false)
  const [bootstrapping, setBootstrapping] = createSignal(false)
  const [reviewingID, setReviewingID] = createSignal<string | undefined>()
  const view = createMemo(() => props.view ?? "graph")

  function open(node: Node) {
    setSelected(node)
    setDetailOpen(true)
  }

  async function bootstrap() {
    if (bootstrapping()) return
    setBootstrapping(true)
    try {
      await audit.bootstrap({ sessionID: props.sessionID })
      setRefresh((value) => value + 1)
    } finally {
      setBootstrapping(false)
    }
  }

  async function review(proposalID: string, verdict: "approve" | "reject") {
    if (reviewingID()) return
    setReviewingID(proposalID)
    try {
      await audit.review({ proposalID, verdict, comments: `${verdict} from security workbench.` })
      setRefresh((value) => value + 1)
    } finally {
      setReviewingID(undefined)
    }
  }

  return (
    <div class={`relative flex h-full min-h-0 flex-col overflow-hidden bg-background-base ${props.class ?? ""}`}>
      <Switch>
        <Match when={graph.loading}>
          <Empty title="Loading security graph" body="Preparing the audit map and node workflows." />
        </Match>
        <Match when={graph.error}>
          <div class="flex h-full items-center justify-center p-6 text-center">
            <div>
              <div class="text-13-medium text-text-strong">Security graph failed to load</div>
              <div class="mt-1 text-12-regular text-text-weak">{graph.error?.message ?? "Unknown error"}</div>
              <Button class="mt-3" size="small" variant="secondary" onClick={() => setRefresh((value) => value + 1)}>
                Retry
              </Button>
            </div>
          </div>
        </Match>
        <Match when={graph()}>
          {(data) => (
            <>
              <Switch>
                <Match when={view() === "graph"}>
                  <GraphView
                    graph={data()}
                    selected={selected()?.id}
                    bootstrapping={bootstrapping()}
                    reviewingID={reviewingID()}
                    onBootstrap={bootstrap}
                    onReview={review}
                    onOpen={open}
                  />
                </Match>
                <Match when={view() === "findings"}>
                  <FindingsView graph={data()} selected={selected()?.id} onOpen={open} />
                </Match>
                <Match when={view() === "workflows"}>
                  <WorkflowsView graph={data()} selected={selected()?.id} onOpen={open} />
                </Match>
                <Match when={view() === "evidence"}>
                  <EvidenceView graph={data()} onOpen={open} />
                </Match>
              </Switch>
              <DetailFullscreen
                visible={detailOpen()}
                graph={data()}
                node={selected()}
                sessionID={props.sessionID}
                onSelect={setSelected}
                onClose={() => setDetailOpen(false)}
              />
            </>
          )}
        </Match>
      </Switch>
    </div>
  )
}
