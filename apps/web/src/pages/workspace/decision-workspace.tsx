import { createMemo, createResource, For, Show, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import type { DomainDecision } from "@palimpsest/sdk/v2"
import { Spinner } from "@palimpsest/ui/spinner"

import { useSDK } from "@/context/sdk"
import { usePhase7 } from "@/context/phase7"
import { ObjectWorkspace, RailLink, RailSection } from "./object-workspace"

function stateTone(state?: string) {
  if (!state) return "text-text-weak"
  if (state === "accepted") return "text-icon-success-base"
  if (state === "rejected") return "text-icon-critical-base"
  if (state === "pending") return "text-text-interactive-base"
  return "text-text-weak"
}

export default function DecisionWorkspace(): JSX.Element {
  const sdk = useSDK()
  const navigate = useNavigate()
  const params = useParams()
  const phase7 = usePhase7(() => params.dir)

  const [data] = createResource(
    () => params.decisionID!,
    async (id) => {
      const res = await sdk.client.domain.decision.list()
      const list = res.data ?? []
      const decision = list.find((item) => item.id === id)
      return { decision, all: list }
    },
  )

  const [provenance] = createResource(
    () => params.decisionID!,
    (id) => phase7.decisionProvenance(id).catch(() => undefined),
  )

  const chain = createMemo<DomainDecision[]>(() => {
    const decision = data()?.decision
    if (!decision) return []
    const list = data()?.all ?? []
    const byId = new Map(list.map((item) => [item.id, item]))
    const seen = new Set<string>()
    let current: DomainDecision | undefined = decision
    const ancestors: DomainDecision[] = []
    while (current && !seen.has(current.id)) {
      seen.add(current.id)
      const prev = list.find((item) => item.supersededBy === current!.id)
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
  })

  return (
    <Show
      when={!data.loading}
      fallback={
        <div class="flex h-full items-center justify-center">
          <Spinner class="size-5" />
        </div>
      }
    >
      <Show
        when={data()?.decision}
        fallback={
          <div class="flex h-full items-center justify-center text-12-regular text-text-weak">
            Decision not found.
          </div>
        }
      >
        {(decision) => (
          <ObjectWorkspace
            kind="decision"
            id={decision().id}
            backHref={`/${params.dir}/decisions`}
            backLabel="Decisions"
            title={decision().kind}
            status={
              <span class={`text-11-medium uppercase tracking-wide ${stateTone(decision().state)}`}>
                {decision().state ?? "—"}
              </span>
            }
            meta={
              <span>
                {decision().id}
                <Show when={decision().actor}>
                  {(actor) => (
                    <span class="ml-2">
                      · {actor().type}:{actor().id}
                      <Show when={actor().version}>
                        <span class="ml-1">v{actor().version}</span>
                      </Show>
                    </span>
                  )}
                </Show>
                <span class="ml-2">· created {new Date(decision().time.created).toLocaleString()}</span>
              </span>
            }
            main={
              <div data-component="decision-body">
                <Show when={decision().rationale}>
                  <div
                    class="rounded-lg bg-surface-raised-base px-4 py-3 text-13-regular text-text-strong whitespace-pre-wrap"
                    data-component="decision-rationale"
                  >
                    {decision().rationale}
                  </div>
                </Show>

                <Show when={chain().length > 1}>
                  <section class="mt-6" data-component="decision-timeline">
                    <div class="text-11-medium uppercase tracking-wide text-text-weak">Supersede chain</div>
                    <ol class="relative mt-3 ml-3 border-l-2 border-border-weak-base">
                      <For each={chain()}>
                        {(item) => {
                          const current = () => item.id === decision().id
                          return (
                            <li class="relative pb-4 pl-4 last:pb-0">
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
                                onClick={() => navigate(`/${params.dir}/decisions/${item.id}`)}
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
                  </section>
                </Show>

                <Show when={decision().refs}>
                  <section class="mt-6" data-component="decision-refs">
                    <div class="text-11-medium uppercase tracking-wide text-text-weak">Refs</div>
                    <pre class="mt-2 overflow-x-auto rounded-lg bg-surface-raised-base px-3 py-2 text-11-regular text-text-weak">
                      {JSON.stringify(decision().refs, null, 2)}
                    </pre>
                  </section>
                </Show>
              </div>
            }
            rail={
              <>
                <Show when={decision().nodeID || decision().runID || decision().artifactID}>
                  <RailSection title="Linked">
                    <Show when={decision().nodeID}>
                      {(id) => (
                        <RailLink href={`/${params.dir}/nodes/${id()}`} label={id()} hint="node" />
                      )}
                    </Show>
                    <Show when={decision().runID}>
                      {(id) => <RailLink href={`/${params.dir}/runs/${id()}`} label={id()} hint="run" />}
                    </Show>
                    <Show when={decision().artifactID}>
                      {(id) => (
                        <RailLink href={`/${params.dir}/artifacts/${id()}`} label={id()} hint="artifact" />
                      )}
                    </Show>
                  </RailSection>
                </Show>

                <Show when={provenance()}>
                  {(prov) => (
                    <>
                      <Show when={prov().createdBy?.proposal}>
                        {(proposal) => (
                          <RailSection title="From proposal">
                            <RailLink
                              href={`/${params.dir}/reviews/${proposal().id}`}
                              label={proposal().title ?? proposal().id}
                              hint={proposal().rationale}
                            />
                          </RailSection>
                        )}
                      </Show>

                      <Show when={prov().createdBy?.commit}>
                        {(commit) => (
                          <RailSection title="Created in commit">
                            <RailLink
                              href={`/${params.dir}/commits/${commit().id}`}
                              label={commit().id}
                              hint={`${commit().actor.type}:${commit().actor.id} · ${new Date(commit().time.created).toLocaleString()}`}
                            />
                          </RailSection>
                        )}
                      </Show>

                      <Show when={(prov().createdBy?.reviews ?? []).length > 0}>
                        <RailSection title="Reviews" count={prov().createdBy?.reviews?.length}>
                          <For each={prov().createdBy?.reviews ?? []}>
                            {(item) => (
                              <div class="rounded-lg bg-background-base px-3 py-2 text-11-regular text-text-strong">
                                <span class="uppercase tracking-wide">{item.verdict}</span>
                                <span class="ml-2 text-text-weak">
                                  {item.actor.type}:{item.actor.id} · {new Date(item.time.created).toLocaleString()}
                                </span>
                                <Show when={item.comments}>
                                  <div class="mt-1 whitespace-pre-wrap text-11-regular text-text-weak">
                                    {item.comments}
                                  </div>
                                </Show>
                              </div>
                            )}
                          </For>
                        </RailSection>
                      </Show>

                      <Show when={prov().updateCommits.length > 0}>
                        <RailSection title="Later commits" count={prov().updateCommits.length}>
                          <For each={prov().updateCommits}>
                            {(commit) => (
                              <RailLink
                                href={`/${params.dir}/commits/${commit.id}`}
                                label={commit.id}
                                hint={new Date(commit.time.created).toLocaleString()}
                              />
                            )}
                          </For>
                        </RailSection>
                      </Show>
                    </>
                  )}
                </Show>
              </>
            }
          />
        )}
      </Show>
    </Show>
  )
}
