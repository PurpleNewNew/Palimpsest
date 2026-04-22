import { createSignal, type JSX } from "solid-js"
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
      onSelect={select}
      version={version}
      entityKind="run"
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
    />
  )
}
