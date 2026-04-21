import { createMemo, createSignal, For, Show, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import type { DomainEdge, DomainNode } from "@palimpsest/sdk/v2"
import { Button } from "@palimpsest/ui/button"

import { useSDK } from "@/context/sdk"
import { EntityTab } from "./tab/entity-tab"

export default function Nodes(): JSX.Element {
  const sdk = useSDK()
  const navigate = useNavigate()
  const params = useParams()

  const [version, setVersion] = createSignal(0)
  const [kindFilter, setKindFilter] = createSignal<string>("")
  const [edges, setEdges] = createSignal<DomainEdge[]>([])

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

  function select(id: string) {
    navigate(`/${params.dir}/nodes/${id}`)
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

  return (
    <EntityTab<DomainNode>
      title="Nodes"
      subtitle="Durable reasoning units"
      emptyMessage="No nodes yet. Propose one from the Reviews tab."
      selectedID={params.nodeID}
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
      headerActions={
        <Button variant="primary" size="small" onClick={() => navigate(`/${params.dir}/reviews`)}>
          Propose node
        </Button>
      }
      fetch={fetch}
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

          <Show when={outgoing(node).length > 0}>
            <div class="mt-6">
              <div class="text-11-medium uppercase tracking-wide text-text-weak">Outgoing edges</div>
              <ul class="mt-2 flex flex-col gap-1">
                <For each={outgoing(node)}>
                  {(edge) => (
                    <li class="flex items-center gap-2 rounded-lg bg-surface-raised-base px-3 py-2 text-12-regular text-text-strong">
                      <span class="text-10-medium uppercase tracking-wide text-text-weak">{edge.kind}</span>
                      <span>→</span>
                      <button
                        type="button"
                        class="text-text-interactive-base hover:underline"
                        onClick={() => select(edge.targetID)}
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

          <Show when={incoming(node).length > 0}>
            <div class="mt-6">
              <div class="text-11-medium uppercase tracking-wide text-text-weak">Incoming edges</div>
              <ul class="mt-2 flex flex-col gap-1">
                <For each={incoming(node)}>
                  {(edge) => (
                    <li class="flex items-center gap-2 rounded-lg bg-surface-raised-base px-3 py-2 text-12-regular text-text-strong">
                      <button
                        type="button"
                        class="text-text-interactive-base hover:underline"
                        onClick={() => select(edge.sourceID)}
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
