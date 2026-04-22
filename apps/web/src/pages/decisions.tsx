import { createSignal, Show, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import type { DomainDecision } from "@palimpsest/sdk/v2"
import { Button } from "@palimpsest/ui/button"

import { useSDK } from "@/context/sdk"
import { EntityTab, groupByTime } from "./tab/entity-tab"

function stateTone(state?: string) {
  if (!state) return "text-text-weak"
  if (state === "accepted") return "text-icon-success-base"
  if (state === "rejected") return "text-icon-critical-base"
  if (state === "pending") return "text-text-interactive-base"
  return "text-text-weak"
}

export default function Decisions(): JSX.Element {
  const sdk = useSDK()
  const navigate = useNavigate()
  const params = useParams()

  const [version, setVersion] = createSignal(0)
  const [stateFilter, setStateFilter] = createSignal<string>("")

  async function fetch() {
    const [res, taxRes] = await Promise.all([
      sdk.client.domain.decision.list(stateFilter() ? { state: stateFilter() } : {}),
      sdk.client.domain.taxonomy(),
    ])
    const items = (res.data ?? []).slice().sort((a, b) => b.time.created - a.time.created)
    return { items, kinds: taxRes.data?.decisionStates ?? [] }
  }

  function select(id: string) {
    navigate(`/${params.dir}/decisions/${id}`)
  }

  return (
    <EntityTab<DomainDecision>
      title="Decisions"
      subtitle="Accepted conclusions and judgments"
      emptyMessage="No decisions recorded yet."
      onSelect={select}
      version={version}
      entityKind="decision"
      groupItems={(items) => groupByTime(items, (item) => item.time.created)}
      filter={{
        label: "State",
        value: stateFilter(),
        onChange: (value) => {
          setStateFilter(value)
          setVersion((v) => v + 1)
        },
        options: [
          { label: "All", value: "" },
          { label: "Accepted", value: "accepted" },
          { label: "Rejected", value: "rejected" },
          { label: "Pending", value: "pending" },
          { label: "Superseded", value: "superseded" },
        ],
      }}
      headerActions={
        <Button variant="primary" size="small" onClick={() => navigate(`/${params.dir}/reviews`)}>
          Propose decision
        </Button>
      }
      fetch={fetch}
      itemID={(item) => item.id}
      itemTitle={(item) => item.kind}
      itemBadge={(item) => item.state}
      itemSubtitle={(item) => (
        <span class="flex items-center gap-2">
          <span class={`text-10-medium uppercase tracking-wide ${stateTone(item.state)}`}>{item.state ?? "—"}</span>
          <Show when={item.actor}>
            <span>{item.actor!.id}</span>
          </Show>
          <span class="text-text-weak">{new Date(item.time.created).toLocaleString()}</span>
        </span>
      )}
    />
  )
}
