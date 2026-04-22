import { createMemo, createResource, createSignal, For, Match, Show, Switch, type JSX } from "solid-js"
import { useNavigate, useParams, useSearchParams } from "@solidjs/router"
import type { DomainEdge, DomainNode } from "@palimpsest/sdk/v2"
import { Button } from "@palimpsest/ui/button"

import { useSDK } from "@/context/sdk"
import { EntityTab } from "./tab/entity-tab"
import { NodeGraph } from "./nodes/node-graph"

export default function Nodes(): JSX.Element {
  const sdk = useSDK()
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams, setSearchParams] = useSearchParams<{ view?: string }>()

  const [version, setVersion] = createSignal(0)
  const [kindFilter, setKindFilter] = createSignal<string>("")
  const [edges, setEdges] = createSignal<DomainEdge[]>([])

  const graphMode = createMemo(() => searchParams.view === "graph")

  async function fetch() {
    const [nodeRes, edgeRes, taxRes] = await Promise.all([
      sdk.client.domain.node.list(kindFilter() ? { kind: kindFilter() } : {}),
      sdk.client.domain.edge.list(),
      sdk.client.domain.taxonomy(),
    ])
    const items = (nodeRes.data ?? []).slice().sort((a, b) => b.time.updated - a.time.updated)
    setEdges(edgeRes.data ?? [])
    return { items, kinds: taxRes.data?.nodeKinds ?? [] }
  }

  const [graphData] = createResource(
    () => (graphMode() ? version() : undefined),
    async () => {
      const [nodeRes, edgeRes] = await Promise.all([
        sdk.client.domain.node.list(),
        sdk.client.domain.edge.list(),
      ])
      return {
        nodes: nodeRes.data ?? [],
        edges: edgeRes.data ?? [],
      }
    },
  )

  function select(id: string) {
    navigate(`/${params.dir}/nodes/${id}`)
  }

  function setView(view: "list" | "graph") {
    setSearchParams({ ...searchParams, view: view === "graph" ? "graph" : undefined })
  }

  const incoming = (node: DomainNode) => edges().filter((edge) => edge.targetID === node.id)
  const outgoing = (node: DomainNode) => edges().filter((edge) => edge.sourceID === node.id)

  const filterProps = createMemo(() => {
    return {
      label: "Kind",
      value: kindFilter(),
      onChange: (value: string) => {
        setKindFilter(value)
        setVersion((v) => v + 1)
      },
      options: [{ label: "All", value: "" }].concat(
        ["claim", "finding", "question", "source", "hypothesis", "risk"].map((kind) => ({ label: kind, value: kind })),
      ),
    }
  })

  const headerActions = () => (
    <div class="flex items-center gap-1" data-component="nodes-view-toggle">
      <div class="flex items-center gap-1 rounded-lg bg-surface-raised-base p-1">
        <button
          type="button"
          data-action="view-list"
          data-active={!graphMode()}
          class={`rounded-md px-3 py-1 text-12-medium ${!graphMode() ? "bg-background-base text-text-strong" : "text-text-weak"}`}
          onClick={() => setView("list")}
        >
          List
        </button>
        <button
          type="button"
          data-action="view-graph"
          data-active={graphMode()}
          class={`rounded-md px-3 py-1 text-12-medium ${graphMode() ? "bg-background-base text-text-strong" : "text-text-weak"}`}
          onClick={() => setView("graph")}
        >
          Graph
        </button>
      </div>
      <Button variant="primary" size="small" onClick={() => navigate(`/${params.dir}/reviews`)}>
        Propose node
      </Button>
    </div>
  )

  return (
    <Switch>
      <Match when={graphMode()}>
        <div class="flex h-full flex-col" data-component="nodes-graph-view">
          <div class="flex items-center justify-between border-b border-border-weak-base px-6 py-4">
            <div>
              <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Nodes</div>
              <div class="mt-1 text-20-medium text-text-strong">Graph view</div>
              <div class="mt-1 text-12-regular text-text-weak">
                Durable reasoning units with their edges. Click any node to open its detail.
              </div>
            </div>
            {headerActions()}
          </div>
          <div class="min-h-0 flex-1">
            <Show
              when={!graphData.loading && graphData()}
              fallback={
                <div class="flex h-full items-center justify-center text-12-regular text-text-weak">
                  Loading graph…
                </div>
              }
            >
              {(value) => (
                <NodeGraph
                  nodes={value().nodes}
                  edges={value().edges}
                  selectedID={params.nodeID}
                  onSelect={select}
                />
              )}
            </Show>
          </div>
        </div>
      </Match>
      <Match when={true}>
        <ListNodes
          headerActions={headerActions()}
          select={select}
          incoming={incoming}
          outgoing={outgoing}
          filterProps={filterProps}
          fetch={fetch}
          version={version}
          nodeID={params.nodeID}
        />
      </Match>
    </Switch>
  )
}

function ListNodes(props: {
  headerActions: JSX.Element
  select: (id: string) => void
  incoming: (node: DomainNode) => DomainEdge[]
  outgoing: (node: DomainNode) => DomainEdge[]
  filterProps: () => { label: string; value: string; onChange: (v: string) => void; options: Array<{ label: string; value: string }> }
  fetch: () => Promise<{ items: DomainNode[]; kinds: string[] }>
  version: () => number
  nodeID?: string
}): JSX.Element {
  return (
    <EntityTab<DomainNode>
      title="Nodes"
      subtitle="Durable reasoning units"
      emptyMessage="No nodes yet. Propose one from the Reviews tab."
      selectedID={props.nodeID}
      onSelect={props.select}
      version={props.version}
      entityKind="node"
      groupItems={(items) => {
        const buckets = new Map<string, DomainNode[]>()
        for (const item of items) {
          const list = buckets.get(item.kind) ?? []
          list.push(item)
          buckets.set(item.kind, list)
        }
        return Array.from(buckets.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([label, bucket]) => ({ label, items: bucket }))
      }}
      filter={props.filterProps()}
      headerActions={props.headerActions}
      fetch={props.fetch}
      itemID={(item) => item.id}
      itemTitle={(item) => item.title}
      itemBadge={(item) => item.kind}
      itemSubtitle={(item) => (
        <span>
          {item.id}
        </span>
      )}
      detail={(node) => (
        <>
          <div>
            <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">{node.kind}</div>
            <h1 class="mt-1 text-20-medium text-text-strong">{node.title}</h1>
            <div class="mt-1 text-11-regular text-text-weak">{node.id}</div>
          </div>

          <Show when={node.body}>
            <div class="mt-4 rounded-lg bg-surface-raised-base px-4 py-3 text-13-regular text-text-strong whitespace-pre-wrap">
              {node.body}
            </div>
          </Show>

          <Show when={node.data}>
            <div class="mt-4">
              <div class="text-11-medium uppercase tracking-wide text-text-weak">Data</div>
              <pre class="mt-2 overflow-x-auto rounded-lg bg-surface-raised-base px-3 py-2 text-11-regular text-text-weak">
                {JSON.stringify(node.data, null, 2)}
              </pre>
            </div>
          </Show>

          <Show when={props.outgoing(node).length > 0}>
            <div class="mt-6">
              <div class="text-11-medium uppercase tracking-wide text-text-weak">Outgoing edges</div>
              <ul class="mt-2 flex flex-col gap-1">
                <For each={props.outgoing(node)}>
                  {(edge) => (
                    <li class="flex items-center gap-2 rounded-lg bg-surface-raised-base px-3 py-2 text-12-regular text-text-strong">
                      <span class="text-10-medium uppercase tracking-wide text-text-weak">{edge.kind}</span>
                      <span>→</span>
                      <button
                        type="button"
                        class="text-text-interactive-base hover:underline"
                        onClick={() => props.select(edge.targetID)}
                      >
                        {edge.targetID}
                      </button>
                      <Show when={edge.note}>
                        <span class="text-11-regular text-text-weak">· {edge.note}</span>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Show>

          <Show when={props.incoming(node).length > 0}>
            <div class="mt-6">
              <div class="text-11-medium uppercase tracking-wide text-text-weak">Incoming edges</div>
              <ul class="mt-2 flex flex-col gap-1">
                <For each={props.incoming(node)}>
                  {(edge) => (
                    <li class="flex items-center gap-2 rounded-lg bg-surface-raised-base px-3 py-2 text-12-regular text-text-strong">
                      <button
                        type="button"
                        class="text-text-interactive-base hover:underline"
                        onClick={() => props.select(edge.sourceID)}
                      >
                        {edge.sourceID}
                      </button>
                      <span>→</span>
                      <span class="text-10-medium uppercase tracking-wide text-text-weak">{edge.kind}</span>
                      <Show when={edge.note}>
                        <span class="text-11-regular text-text-weak">· {edge.note}</span>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Show>

          <div class="mt-6 text-11-regular text-text-weak">
            Created {new Date(node.time.created).toLocaleString()} · Updated {new Date(node.time.updated).toLocaleString()}
          </div>
        </>
      )}
    />
  )
}
