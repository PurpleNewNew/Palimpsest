import { createMemo, createResource, createSignal, Match, Show, Switch, type JSX } from "solid-js"
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

  const graphMode = createMemo(() => searchParams.view === "graph")

  async function fetch() {
    const [nodeRes, taxRes] = await Promise.all([
      sdk.client.domain.node.list(kindFilter() ? { kind: kindFilter() } : {}),
      sdk.client.domain.taxonomy(),
    ])
    const items = (nodeRes.data ?? []).slice().sort((a, b) => b.time.updated - a.time.updated)
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
      } as { nodes: DomainNode[]; edges: DomainEdge[] }
    },
  )

  function select(id: string) {
    navigate(`/${params.dir}/nodes/${id}`)
  }

  function setView(view: "list" | "graph") {
    setSearchParams({ ...searchParams, view: view === "graph" ? "graph" : undefined })
  }

  const filterProps = createMemo(() => ({
    label: "Kind",
    value: kindFilter(),
    onChange: (value: string) => {
      setKindFilter(value)
      setVersion((v) => v + 1)
    },
    options: [{ label: "All", value: "" }].concat(
      ["claim", "finding", "question", "source", "hypothesis", "risk"].map((kind) => ({ label: kind, value: kind })),
    ),
  }))

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
                Durable reasoning units with their edges. Click any node to open its workspace.
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
                <NodeGraph nodes={value().nodes} edges={value().edges} selectedID={undefined} onSelect={select} />
              )}
            </Show>
          </div>
        </div>
      </Match>
      <Match when={true}>
        <EntityTab<DomainNode>
          title="Nodes"
          subtitle="Durable reasoning units"
          emptyMessage="No nodes yet. Propose one from the Reviews tab."
          onSelect={select}
          version={version}
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
          filter={filterProps()}
          headerActions={headerActions()}
          fetch={fetch}
          itemID={(item) => item.id}
          itemTitle={(item) => item.title}
          itemBadge={(item) => item.kind}
          itemSubtitle={(item) => <span>{item.id}</span>}
        />
      </Match>
    </Switch>
  )
}
