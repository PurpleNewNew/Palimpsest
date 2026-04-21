import { createSignal, For, Show, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import type { DomainNode } from "@palimpsest/sdk/v2"
import { Button } from "@palimpsest/ui/button"

import { useSDK } from "@/context/sdk"
import { EntityTab } from "./tab/entity-tab"

export default function Sources(): JSX.Element {
  const sdk = useSDK()
  const navigate = useNavigate()
  const params = useParams()

  const [version, setVersion] = createSignal(0)

  async function fetch() {
    const [nodeRes, taxRes] = await Promise.all([
      sdk.client.domain.node.list({ kind: "source" }),
      sdk.client.domain.taxonomy(),
    ])
    const items = (nodeRes.data ?? []).slice().sort((a, b) => b.time.updated - a.time.updated)
    return { items, kinds: taxRes.data?.nodeKinds ?? [] }
  }

  function select(id: string) {
    navigate(`/${params.dir}/sources/${id}`)
  }

  return (
    <EntityTab<DomainNode>
      title="Sources"
      subtitle="Evidence and reference anchors"
      emptyMessage="No sources yet. Research and security plugins can contribute richer source providers (Sprint 3.5)."
      selectedID={params.sourceID}
      onSelect={select}
      version={version}
      headerActions={
        <Button variant="primary" size="small" onClick={() => navigate(`/${params.dir}/reviews`)}>
          Propose source
        </Button>
      }
      fetch={fetch}
      itemID={(item) => item.id}
      itemTitle={(item) => item.title}
      itemBadge={() => "source"}
      itemSubtitle={(item) => <span>{item.id}</span>}
      detail={(node) => (
        <>
          <div>
            <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Source</div>
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
              <div class="text-11-medium uppercase tracking-wide text-text-weak">Metadata</div>
              <pre class="mt-2 overflow-x-auto rounded-lg bg-surface-raised-base px-3 py-2 text-11-regular text-text-weak">
                {JSON.stringify(node.data, null, 2)}
              </pre>
            </div>
          </Show>

          <div class="mt-6 text-11-regular text-text-weak">
            Created {new Date(node.time.created).toLocaleString()} · Updated {new Date(node.time.updated).toLocaleString()}
          </div>

          <div class="mt-4 rounded-lg border border-border-weak-base px-4 py-3 text-11-regular text-text-weak">
            Core renders sources as plain nodes. A research lens can contribute a richer renderer
            (citation count, related papers, fetch status) once the plugin host API lands.
          </div>
        </>
      )}
    />
  )
}
