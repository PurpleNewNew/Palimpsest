import { createSignal, Show, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import type { DomainArtifact } from "@palimpsest/sdk/v2"
import { Button } from "@palimpsest/ui/button"

import { useSDK } from "@/context/sdk"
import { EntityTab } from "./tab/entity-tab"
import { ArtifactPreview } from "./artifacts/artifact-preview"

export default function Artifacts(): JSX.Element {
  const sdk = useSDK()
  const navigate = useNavigate()
  const params = useParams()

  const [version, setVersion] = createSignal(0)
  const [kindFilter, setKindFilter] = createSignal<string>("")

  async function fetch() {
    const [res, taxRes] = await Promise.all([
      sdk.client.domain.artifact.list(kindFilter() ? { kind: kindFilter() } : {}),
      sdk.client.domain.taxonomy(),
    ])
    const items = (res.data ?? []).slice().sort((a, b) => b.time.updated - a.time.updated)
    return { items, kinds: taxRes.data?.artifactKinds ?? [] }
  }

  function select(id: string) {
    navigate(`/${params.dir}/artifacts/${id}`)
  }

  return (
    <EntityTab<DomainArtifact>
      title="Artifacts"
      subtitle="Durable outputs and evidence"
      emptyMessage="No artifacts yet."
      selectedID={params.artifactID}
      onSelect={select}
      version={version}
      entityKind="artifact"
      filter={{
        label: "Kind",
        value: kindFilter(),
        onChange: (value) => {
          setKindFilter(value)
          setVersion((v) => v + 1)
        },
        options: [
          { label: "All", value: "" },
          { label: "Note", value: "note" },
          { label: "Report", value: "report" },
          { label: "Dataset", value: "dataset" },
          { label: "Snapshot", value: "snapshot" },
          { label: "SARIF", value: "sarif" },
          { label: "Trace", value: "trace" },
        ],
      }}
      headerActions={
        <Button variant="primary" size="small" onClick={() => navigate(`/${params.dir}/reviews`)}>
          Propose artifact
        </Button>
      }
      fetch={fetch}
      itemID={(item) => item.id}
      itemTitle={(item) => item.title ?? item.kind}
      itemBadge={(item) => item.kind}
      itemSubtitle={(item) => (
        <span>
          {item.mimeType ?? "—"} · {item.id}
        </span>
      )}
      detail={(artifact) => (
        <>
          <div>
            <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">{artifact.kind}</div>
            <h1 class="mt-1 text-20-medium text-text-strong">{artifact.title ?? artifact.id}</h1>
            <div class="mt-1 text-11-regular text-text-weak">{artifact.id}</div>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-3 text-12-regular text-text-strong">
            <Show when={artifact.mimeType}>
              <div class="rounded-lg bg-surface-raised-base px-3 py-2">
                <div class="text-11-regular text-text-weak">MIME</div>
                <div>{artifact.mimeType}</div>
              </div>
            </Show>
            <Show when={artifact.storageURI}>
              <div class="rounded-lg bg-surface-raised-base px-3 py-2">
                <div class="text-11-regular text-text-weak">Storage</div>
                <div class="truncate">{artifact.storageURI}</div>
              </div>
            </Show>
            <Show when={artifact.runID}>
              <div class="rounded-lg bg-surface-raised-base px-3 py-2">
                <div class="text-11-regular text-text-weak">Produced by run</div>
                <button
                  type="button"
                  class="text-text-interactive-base hover:underline"
                  onClick={() => navigate(`/${params.dir}/runs/${artifact.runID}`)}
                >
                  {artifact.runID}
                </button>
              </div>
            </Show>
            <Show when={artifact.nodeID}>
              <div class="rounded-lg bg-surface-raised-base px-3 py-2">
                <div class="text-11-regular text-text-weak">Linked node</div>
                <button
                  type="button"
                  class="text-text-interactive-base hover:underline"
                  onClick={() => navigate(`/${params.dir}/nodes/${artifact.nodeID}`)}
                >
                  {artifact.nodeID}
                </button>
              </div>
            </Show>
          </div>

          <ArtifactPreview artifact={artifact} />

          <Show when={artifact.data}>
            <div class="mt-4" data-component="artifact-data">
              <div class="text-11-medium uppercase tracking-wide text-text-weak">Data</div>
              <pre class="mt-2 overflow-x-auto rounded-lg bg-surface-raised-base px-3 py-2 text-11-regular text-text-weak">
                {JSON.stringify(artifact.data, null, 2)}
              </pre>
            </div>
          </Show>

          <Show when={artifact.provenance}>
            <div class="mt-4" data-component="artifact-provenance">
              <div class="text-11-medium uppercase tracking-wide text-text-weak">Provenance</div>
              <pre class="mt-2 overflow-x-auto rounded-lg bg-surface-raised-base px-3 py-2 text-11-regular text-text-weak">
                {JSON.stringify(artifact.provenance, null, 2)}
              </pre>
            </div>
          </Show>

          <div class="mt-6 text-11-regular text-text-weak">
            Created {new Date(artifact.time.created).toLocaleString()} · Updated {new Date(artifact.time.updated).toLocaleString()}
          </div>
        </>
      )}
    />
  )
}
