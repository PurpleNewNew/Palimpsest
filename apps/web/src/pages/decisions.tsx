import { createMemo, createSignal, For, Show, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import type { DomainDecision } from "@palimpsest/sdk/v2"
import { Button } from "@palimpsest/ui/button"

import { useSDK } from "@/context/sdk"
import { EntityTab } from "./tab/entity-tab"

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
  const [decisions, setDecisions] = createSignal<DomainDecision[]>([])

  async function fetch() {
    const [res, taxRes] = await Promise.all([
      sdk.client.domain.decision.list(stateFilter() ? { state: stateFilter() } : {}),
      sdk.client.domain.taxonomy(),
    ])
    const items = (res.data ?? []).slice().sort((a, b) => b.time.created - a.time.created)
    setDecisions(items)
    return { items, kinds: taxRes.data?.decisionStates ?? [] }
  }

  function select(id: string) {
    navigate(`/${params.dir}/decisions/${id}`)
  }

  function superseders(decision: DomainDecision) {
    return decisions().filter((item) => item.supersededBy === decision.id)
  }

  return (
    <EntityTab<DomainDecision>
      title="Decisions"
      subtitle="Accepted conclusions and judgments"
      emptyMessage="No decisions recorded yet."
      selectedID={params.decisionID}
      onSelect={select}
      version={version}
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
          <Show when={item.actor}>
            <span>{item.actor!.id}</span>
          </Show>
          <span>{item.id}</span>
        </span>
      )}
      detail={(decision) => {
        const prev = createMemo(() => superseders(decision))
        return (
          <>
            <div>
              <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">{decision.kind}</div>
              <h1 class="mt-1 text-20-medium text-text-strong">
                <span class={stateTone(decision.state)}>{decision.state ?? "—"}</span>
              </h1>
              <div class="mt-1 flex items-center gap-3 text-11-regular text-text-weak">
                <span>{decision.id}</span>
                <Show when={decision.actor}>
                  {(actor) => (
                    <span>
                      {actor().type}:{actor().id}
                      <Show when={actor().version}>
                        <span class="ml-1">v{actor().version}</span>
                      </Show>
                    </span>
                  )}
                </Show>
              </div>
            </div>

            <Show when={decision.rationale}>
              <div class="mt-4 rounded-lg bg-surface-raised-base px-4 py-3 text-13-regular text-text-strong whitespace-pre-wrap">
                {decision.rationale}
              </div>
            </Show>

            <div class="mt-4 grid grid-cols-2 gap-3 text-12-regular text-text-strong">
              <Show when={decision.nodeID}>
                <div class="rounded-lg bg-surface-raised-base px-3 py-2">
                  <div class="text-11-regular text-text-weak">Linked node</div>
                  <button
                    type="button"
                    class="text-text-interactive-base hover:underline"
                    onClick={() => navigate(`/${params.dir}/nodes/${decision.nodeID}`)}
                  >
                    {decision.nodeID}
                  </button>
                </div>
              </Show>
              <Show when={decision.runID}>
                <div class="rounded-lg bg-surface-raised-base px-3 py-2">
                  <div class="text-11-regular text-text-weak">Linked run</div>
                  <button
                    type="button"
                    class="text-text-interactive-base hover:underline"
                    onClick={() => navigate(`/${params.dir}/runs/${decision.runID}`)}
                  >
                    {decision.runID}
                  </button>
                </div>
              </Show>
              <Show when={decision.artifactID}>
                <div class="rounded-lg bg-surface-raised-base px-3 py-2">
                  <div class="text-11-regular text-text-weak">Linked artifact</div>
                  <button
                    type="button"
                    class="text-text-interactive-base hover:underline"
                    onClick={() => navigate(`/${params.dir}/artifacts/${decision.artifactID}`)}
                  >
                    {decision.artifactID}
                  </button>
                </div>
              </Show>
              <Show when={decision.supersededBy}>
                <div class="rounded-lg bg-surface-raised-base px-3 py-2">
                  <div class="text-11-regular text-text-weak">Superseded by</div>
                  <button
                    type="button"
                    class="text-text-interactive-base hover:underline"
                    onClick={() => navigate(`/${params.dir}/decisions/${decision.supersededBy}`)}
                  >
                    {decision.supersededBy}
                  </button>
                </div>
              </Show>
            </div>

            <Show when={prev().length > 0}>
              <div class="mt-4">
                <div class="text-11-medium uppercase tracking-wide text-text-weak">Supersedes</div>
                <ul class="mt-2 flex flex-col gap-1">
                  <For each={prev()}>
                    {(item) => (
                      <li class="rounded-lg bg-surface-raised-base px-3 py-2 text-12-regular">
                        <button
                          type="button"
                          class="text-text-interactive-base hover:underline"
                          onClick={() => select(item.id)}
                        >
                          {item.id}
                        </button>
                        <span class="ml-2 text-text-weak">{item.kind}</span>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            </Show>

            <Show when={decision.refs}>
              <div class="mt-4">
                <div class="text-11-medium uppercase tracking-wide text-text-weak">Refs</div>
                <pre class="mt-2 overflow-x-auto rounded-lg bg-surface-raised-base px-3 py-2 text-11-regular text-text-weak">
                  {JSON.stringify(decision.refs, null, 2)}
                </pre>
              </div>
            </Show>

            <div class="mt-6 text-11-regular text-text-weak">
              Created {new Date(decision.time.created).toLocaleString()} · Updated {new Date(decision.time.updated).toLocaleString()}
            </div>
          </>
        )
      }}
    />
  )
}
