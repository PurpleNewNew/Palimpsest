import { createSignal, For, Show, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import type { DomainRun } from "@palimpsest/sdk/v2"
import { Button } from "@palimpsest/ui/button"

import { useSDK } from "@/context/sdk"
import { EntityTab } from "./tab/entity-tab"

function statusTone(status: string) {
  if (status === "completed") return "text-icon-success-base"
  if (status === "failed" || status === "error") return "text-icon-critical-base"
  if (status === "running" || status === "pending") return "text-text-interactive-base"
  return "text-text-weak"
}

export default function Runs(): JSX.Element {
  const sdk = useSDK()
  const navigate = useNavigate()
  const params = useParams()

  const [version, setVersion] = createSignal(0)
  const [statusFilter, setStatusFilter] = createSignal<string>("")

  async function fetch() {
    const [res, taxRes] = await Promise.all([
      sdk.client.domain.run.list(statusFilter() ? { status: statusFilter() } : {}),
      sdk.client.domain.taxonomy(),
    ])
    const items = (res.data ?? []).slice().sort((a, b) => b.time.updated - a.time.updated)
    return { items, kinds: taxRes.data?.runKinds ?? [] }
  }

  function select(id: string) {
    navigate(`/${params.dir}/runs/${id}`)
  }

  return (
    <EntityTab<DomainRun>
      title="Runs"
      subtitle="Executed units of work"
      emptyMessage="No runs recorded yet."
      selectedID={params.runID}
      onSelect={select}
      version={version}
      filter={{
        label: "Status",
        value: statusFilter(),
        onChange: (value) => {
          setStatusFilter(value)
          setVersion((v) => v + 1)
        },
        options: [
          { label: "All", value: "" },
          { label: "Pending", value: "pending" },
          { label: "Running", value: "running" },
          { label: "Completed", value: "completed" },
          { label: "Failed", value: "failed" },
        ],
      }}
      headerActions={
        <Button variant="primary" size="small" onClick={() => navigate(`/${params.dir}/reviews`)}>
          Propose run
        </Button>
      }
      fetch={fetch}
      itemID={(item) => item.id}
      itemTitle={(item) => item.title ?? item.kind}
      itemBadge={(item) => item.kind}
      itemSubtitle={(item) => (
        <span class="flex items-center gap-2">
          <span class={`text-10-medium uppercase tracking-wide ${statusTone(item.status)}`}>{item.status}</span>
          <span>{item.id}</span>
        </span>
      )}
      detail={(run) => (
        <>
          <div>
            <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">{run.kind}</div>
            <h1 class="mt-1 text-20-medium text-text-strong">{run.title ?? run.id}</h1>
            <div class="mt-1 flex items-center gap-3 text-11-regular text-text-weak">
              <span class={statusTone(run.status)}>{run.status}</span>
              <span>{run.id}</span>
              <Show when={run.nodeID}>
                <button
                  type="button"
                  class="text-text-interactive-base hover:underline"
                  onClick={() => navigate(`/${params.dir}/nodes/${run.nodeID}`)}
                >
                  → {run.nodeID}
                </button>
              </Show>
            </div>
          </div>

          <Show when={run.actor}>
            {(actor) => (
              <div class="mt-4 rounded-lg bg-surface-raised-base px-4 py-3 text-12-regular text-text-strong">
                Triggered by {actor().type}:{actor().id}
                <Show when={actor().version}>
                  <span class="ml-1 text-11-regular text-text-weak">v{actor().version}</span>
                </Show>
              </div>
            )}
          </Show>

          <div class="mt-4 grid grid-cols-2 gap-3 text-12-regular text-text-strong">
            <Show when={run.startedAt}>
              <div class="rounded-lg bg-surface-raised-base px-3 py-2">
                <div class="text-11-regular text-text-weak">Started</div>
                <div>{new Date(run.startedAt!).toLocaleString()}</div>
              </div>
            </Show>
            <Show when={run.finishedAt}>
              <div class="rounded-lg bg-surface-raised-base px-3 py-2">
                <div class="text-11-regular text-text-weak">Finished</div>
                <div>{new Date(run.finishedAt!).toLocaleString()}</div>
              </div>
            </Show>
          </div>

          <Show when={run.manifest}>
            <div class="mt-4">
              <div class="text-11-medium uppercase tracking-wide text-text-weak">Manifest</div>
              <pre class="mt-2 overflow-x-auto rounded-lg bg-surface-raised-base px-3 py-2 text-11-regular text-text-weak">
                {JSON.stringify(run.manifest, null, 2)}
              </pre>
            </div>
          </Show>

          <div class="mt-6 text-11-regular text-text-weak">
            Created {new Date(run.time.created).toLocaleString()} · Updated {new Date(run.time.updated).toLocaleString()}
          </div>
        </>
      )}
    />
  )
}
