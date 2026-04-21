import { createMemo, createSignal, For, Show, type JSX } from "solid-js"
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

  function chain(decision: DomainDecision): DomainDecision[] {
    // Walk the supersede chain upward (older -> newer) starting from the
    // oldest ancestor this decision descends from.
    const byId = new Map(decisions().map((item) => [item.id, item]))
    const seen = new Set<string>()
    let current: DomainDecision | undefined = decision
    const ancestors: DomainDecision[] = []
    while (current && !seen.has(current.id)) {
      seen.add(current.id)
      const prev = decisions().find((item) => item.supersededBy === current!.id)
      if (!prev) break
      ancestors.unshift(prev)
      current = prev
    }
    const descendants: DomainDecision[] = []
    let tail: DomainDecision | undefined = byId.get(decision.supersededBy ?? "")
    while (tail && !seen.has(tail.id)) {
      seen.add(tail.id)
      descendants.push(tail)
      tail = byId.get(tail.supersededBy ?? "")
    }
    return [...ancestors, decision, ...descendants]
  }

  return (
    <EntityTab<DomainDecision>
      title="Decisions"
      subtitle="Accepted conclusions and judgments"
      emptyMessage="No decisions recorded yet."
      selectedID={params.decisionID}
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
          <Show when={item.actor}>
            <span>{item.actor!.id}</span>
          </Show>
          <span class="text-text-weak">{new Date(item.time.created).toLocaleString()}</span>
        </span>
      )}
      detail={(decision) => {
        const timeline = createMemo(() => chain(decision))
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
                <div class="rounded-lg bg-surface-raised-base px-3 py-2" data-component="decision-link-node">
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
                <div class="rounded-lg bg-surface-raised-base px-3 py-2" data-component="decision-link-run">
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
                <div class="rounded-lg bg-surface-raised-base px-3 py-2" data-component="decision-link-artifact">
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
            </div>

            <Show when={timeline().length > 1}>
              <div class="mt-6" data-component="decision-timeline">
                <div class="text-11-medium uppercase tracking-wide text-text-weak">Supersede chain</div>
                <ol class="mt-3 relative ml-3 border-l-2 border-border-weak-base">
                  <For each={timeline()}>
                    {(item) => {
                      const current = () => item.id === decision.id
                      return (
                        <li class="relative pl-4 pb-4 last:pb-0">
                          <span
                            class={`absolute -left-[7px] top-1.5 size-3 rounded-full border-2 ${
                              current()
                                ? "border-icon-interactive-base bg-background-base"
                                : "border-border-weak-base bg-surface-raised-base"
                            }`}
                            data-current={current()}
                          />
                          <button
                            type="button"
                            class={`block w-full rounded-lg px-3 py-2 text-left ${
                              current()
                                ? "bg-surface-raised-base ring-1 ring-border-base"
                                : "bg-surface-raised-base hover:bg-surface-raised-base-hover"
                            }`}
                            onClick={() => select(item.id)}
                            data-component="decision-chain-item"
                            data-decision-id={item.id}
                          >
                            <div class="flex items-center justify-between gap-2">
                              <span class="text-12-medium text-text-strong">{item.kind}</span>
                              <span class={`text-10-medium uppercase tracking-wide ${stateTone(item.state)}`}>
                                {item.state ?? "—"}
                              </span>
                            </div>
                            <div class="mt-0.5 text-11-regular text-text-weak">
                              <span>{item.id}</span>
                              <Show when={item.actor}>
                                <span class="ml-2">· {item.actor!.id}</span>
                              </Show>
                              <span class="ml-2">· {new Date(item.time.created).toLocaleString()}</span>
                            </div>
                          </button>
                        </li>
                      )
                    }}
                  </For>
                </ol>
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
