import { createMemo, createResource, createSignal, For, Match, Show, Switch, type JSX } from "solid-js"
import { A, useNavigate, useParams } from "@solidjs/router"
import type { DomainCommit, DomainProposal, DomainReview } from "@palimpsest/sdk/v2"
import { Button } from "@palimpsest/ui/button"

import { useSDK } from "@/context/sdk"
import { ChangeView } from "./reviews/change-view"
import { collectAffected } from "./workspace/change-links"

function formatTime(ms: number) {
  const diff = Date.now() - ms
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ms).toLocaleDateString()
}

function groupByDay(commits: DomainCommit[]) {
  const groups = new Map<string, DomainCommit[]>()
  for (const commit of commits) {
    const key = new Date(commit.time.created).toDateString()
    const list = groups.get(key) ?? []
    list.push(commit)
    groups.set(key, list)
  }
  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items: items.slice().sort((a, b) => b.time.created - a.time.created),
  }))
}

export default function Commits(): JSX.Element {
  const sdk = useSDK()
  const navigate = useNavigate()
  const params = useParams<{ dir: string; commitID?: string }>()

  const [version, setVersion] = createSignal(0)
  const [proposalFilter, setProposalFilter] = createSignal<string>("")

  const [data] = createResource(
    () => version(),
    async () => {
      const [commits, proposals, reviews] = await Promise.all([
        sdk.client.domain.commit.list().then((value) => value.data ?? []),
        sdk.client.domain.proposal.list().then((value) => value.data ?? []),
        sdk.client.domain.review.list().then((value) => value.data ?? []),
      ])
      return { commits, proposals, reviews }
    },
  )

  const commits = createMemo<DomainCommit[]>(() => {
    const list = data()?.commits ?? []
    const q = proposalFilter().trim().toLowerCase()
    const filtered = q
      ? list.filter(
          (commit) =>
            commit.id.toLowerCase().includes(q) ||
            (commit.proposalID ?? "").toLowerCase().includes(q) ||
            commit.actor.id.toLowerCase().includes(q),
        )
      : list
    return filtered.slice().sort((a, b) => b.time.created - a.time.created)
  })

  const selected = createMemo<DomainCommit | undefined>(() => {
    const id = params.commitID
    const list = commits()
    if (!id) return list[0]
    return list.find((item) => item.id === id) ?? list[0]
  })

  const proposalFor = createMemo<DomainProposal | undefined>(() => {
    const current = selected()
    if (!current?.proposalID) return undefined
    return (data()?.proposals ?? []).find((item) => item.id === current.proposalID)
  })

  const reviewsFor = createMemo<DomainReview[]>(() => {
    const current = selected()
    if (!current?.proposalID) return []
    return (data()?.reviews ?? [])
      .filter((item) => item.proposalID === current.proposalID)
      .slice()
      .sort((a, b) => a.time.created - b.time.created)
  })

  const affected = createMemo(() => {
    const current = selected()
    if (!current) return undefined
    return collectAffected(current.changes)
  })

  const groups = createMemo(() => groupByDay(commits()))

  function select(commitID: string) {
    navigate(`/${params.dir}/commits/${commitID}`)
  }

  return (
    <div class="flex h-full flex-col bg-background-base" data-component="commits-page">
      <div class="flex items-center justify-between border-b border-border-weak-base px-6 py-4">
        <div>
          <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Commits</div>
          <div class="mt-1 text-20-medium text-text-strong">Commit timeline</div>
          <div class="mt-1 text-12-regular text-text-weak">
            Accepted changes, grouped by day. Click a commit to inspect the change set and the originating proposal.
          </div>
        </div>
        <div class="flex items-center gap-2">
          <input
            type="search"
            data-component="commit-filter"
            placeholder="Filter by commit/proposal/actor"
            class="rounded-md border border-border-weak-base bg-background-base px-3 py-1.5 text-12-regular text-text-strong"
            value={proposalFilter()}
            onInput={(e) => setProposalFilter(e.currentTarget.value)}
          />
          <Button variant="secondary" size="small" onClick={() => setVersion((v) => v + 1)}>
            Refresh
          </Button>
        </div>
      </div>

      <div class="flex min-h-0 flex-1">
        <div class="w-80 shrink-0 overflow-y-auto border-r border-border-weak-base" data-component="commits-list">
          <Switch>
            <Match when={data.loading}>
              <div class="p-6 text-12-regular text-text-weak">Loading…</div>
            </Match>
            <Match when={commits().length === 0}>
              <div class="p-6 text-12-regular text-text-weak" data-component="commits-empty">
                {proposalFilter()
                  ? "No commits match your filter."
                  : "No commits yet. Accepted proposals will land here."}
              </div>
            </Match>
            <Match when={true}>
              <For each={groups()}>
                {(group) => (
                  <div class="border-b border-border-weak-base">
                    <div class="sticky top-0 bg-surface-raised-base px-4 py-2 text-10-medium uppercase tracking-wide text-text-weak">
                      {group.label}
                    </div>
                    <ul>
                      <For each={group.items}>
                        {(commit) => (
                          <li>
                            <button
                              type="button"
                              data-component="commit-item"
                              data-commit-id={commit.id}
                              class={`flex w-full flex-col gap-0.5 border-b border-border-weak-base px-4 py-3 text-left hover:bg-surface-raised-base ${selected()?.id === commit.id ? "bg-surface-raised-base" : ""}`}
                              onClick={() => select(commit.id)}
                            >
                              <div class="flex items-center justify-between gap-2">
                                <span class="truncate text-12-medium text-text-strong">{commit.id}</span>
                                <span class="text-10-regular text-text-weak">{formatTime(commit.time.created)}</span>
                              </div>
                              <div class="flex items-center justify-between gap-2 text-11-regular text-text-weak">
                                <span class="truncate">
                                  {commit.actor.type}:{commit.actor.id}
                                </span>
                                <span>{commit.changes.length} change{commit.changes.length === 1 ? "" : "s"}</span>
                              </div>
                              <Show when={commit.proposalID}>
                                <div class="text-10-regular text-text-weak">from {commit.proposalID}</div>
                              </Show>
                            </button>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                )}
              </For>
            </Match>
          </Switch>
        </div>

        <div class="flex-1 overflow-y-auto" data-component="commit-detail">
          <Show
            when={selected()}
            fallback={
              <div class="p-8 text-12-regular text-text-weak" data-component="commit-detail-empty">
                Select a commit to inspect it.
              </div>
            }
          >
            {(commit) => (
              <div class="mx-auto max-w-3xl px-6 py-6" data-commit-id={commit().id}>
                <div>
                  <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Commit</div>
                  <h1 class="mt-1 text-20-medium text-text-strong">{commit().id}</h1>
                  <div class="mt-1 flex flex-wrap gap-3 text-11-regular text-text-weak">
                    <span>
                      {commit().actor.type}:{commit().actor.id}
                    </span>
                    <span>Created {new Date(commit().time.created).toLocaleString()}</span>
                    <Show when={commit().proposalID}>
                      <button
                        type="button"
                        data-action="open-proposal"
                        class="text-text-interactive-base hover:underline"
                        onClick={() => navigate(`/${params.dir}/reviews/${commit().proposalID}`)}
                      >
                        Proposal: {commit().proposalID}
                      </button>
                    </Show>
                  </div>
                </div>

                <Show when={proposalFor()}>
                  {(proposal) => (
                    <div
                      class="mt-4 rounded-2xl bg-surface-raised-base px-4 py-3"
                      data-component="commit-proposal"
                    >
                      <div class="text-11-medium uppercase tracking-wide text-text-weak">Originating proposal</div>
                      <div class="mt-1 text-13-medium text-text-strong">{proposal().title ?? proposal().id}</div>
                      <Show when={proposal().rationale}>
                        <div class="mt-1 text-12-regular text-text-strong whitespace-pre-wrap">
                          {proposal().rationale}
                        </div>
                      </Show>
                      <div class="mt-2 text-10-regular text-text-weak">
                        {proposal().actor.type}:{proposal().actor.id} · status {proposal().status} · rev{" "}
                        {proposal().revision}
                      </div>
                    </div>
                  )}
                </Show>

                <Show when={reviewsFor().length > 0}>
                  <section class="mt-6" data-component="commit-reviews">
                    <div class="text-11-medium uppercase tracking-wide text-text-weak">
                      Review chain ({reviewsFor().length})
                    </div>
                    <div class="mt-2 flex flex-col gap-2">
                      <For each={reviewsFor()}>
                        {(item) => (
                          <div class="rounded-xl bg-surface-raised-base px-4 py-3">
                            <div class="flex items-center justify-between gap-2">
                              <div class="text-12-medium text-text-strong">
                                {item.actor.type}:{item.actor.id} · {item.verdict.replaceAll("_", " ")}
                              </div>
                              <div class="text-10-regular text-text-weak">
                                {new Date(item.time.created).toLocaleString()}
                              </div>
                            </div>
                            <Show when={item.comments}>
                              <div class="mt-1 text-11-regular whitespace-pre-wrap text-text-weak">{item.comments}</div>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </section>
                </Show>

                <Show when={affected()}>
                  {(value) => (
                    <section class="mt-6" data-component="commit-affected">
                      <div class="text-11-medium uppercase tracking-wide text-text-weak">Affected objects</div>
                      <div class="mt-3 grid gap-3 md:grid-cols-2">
                        <Show when={value().nodes.length > 0}>
                          <div class="rounded-2xl bg-surface-raised-base px-4 py-3">
                            <div class="text-11-medium uppercase tracking-wide text-text-weak">
                              Nodes {value().nodes.length}
                            </div>
                            <div class="mt-2 flex flex-col gap-2">
                              <For each={value().nodes}>
                                {(item) => (
                                  <A
                                    href={`/${params.dir}/nodes/${item.id}`}
                                    class="rounded-lg bg-background-base px-3 py-2 hover:bg-surface-raised-base-hover"
                                  >
                                    <div class="text-12-medium text-text-strong">{item.title || item.id}</div>
                                    <div class="text-10-regular text-text-weak">
                                      {item.op.replaceAll("_", " ")}
                                      <Show when={item.kind}> · {item.kind}</Show>
                                    </div>
                                  </A>
                                )}
                              </For>
                            </div>
                          </div>
                        </Show>

                        <Show when={value().runs.length > 0}>
                          <div class="rounded-2xl bg-surface-raised-base px-4 py-3">
                            <div class="text-11-medium uppercase tracking-wide text-text-weak">
                              Runs {value().runs.length}
                            </div>
                            <div class="mt-2 flex flex-col gap-2">
                              <For each={value().runs}>
                                {(item) => (
                                  <Show
                                    when={item.id}
                                    fallback={
                                      <div class="rounded-lg bg-background-base px-3 py-2 text-11-regular text-text-weak">
                                        {item.op.replaceAll("_", " ")}
                                        <Show when={item.kind}> · {item.kind}</Show>
                                      </div>
                                    }
                                  >
                                    {(id) => (
                                      <A
                                        href={`/${params.dir}/runs/${id()}`}
                                        class="rounded-lg bg-background-base px-3 py-2 hover:bg-surface-raised-base-hover"
                                      >
                                        <div class="text-12-medium text-text-strong">{item.title || id()}</div>
                                        <div class="text-10-regular text-text-weak">
                                          {item.op.replaceAll("_", " ")}
                                          <Show when={item.kind}> · {item.kind}</Show>
                                        </div>
                                      </A>
                                    )}
                                  </Show>
                                )}
                              </For>
                            </div>
                          </div>
                        </Show>

                        <Show when={value().artifacts.length > 0}>
                          <div class="rounded-2xl bg-surface-raised-base px-4 py-3">
                            <div class="text-11-medium uppercase tracking-wide text-text-weak">
                              Artifacts {value().artifacts.length}
                            </div>
                            <div class="mt-2 flex flex-col gap-2">
                              <For each={value().artifacts}>
                                {(item) => (
                                  <Show
                                    when={item.id}
                                    fallback={
                                      <div class="rounded-lg bg-background-base px-3 py-2 text-11-regular text-text-weak">
                                        {item.op.replaceAll("_", " ")}
                                        <Show when={item.kind}> · {item.kind}</Show>
                                      </div>
                                    }
                                  >
                                    {(id) => (
                                      <A
                                        href={`/${params.dir}/artifacts/${id()}`}
                                        class="rounded-lg bg-background-base px-3 py-2 hover:bg-surface-raised-base-hover"
                                      >
                                        <div class="text-12-medium text-text-strong">{item.title || id()}</div>
                                        <div class="text-10-regular text-text-weak">
                                          {item.op.replaceAll("_", " ")}
                                          <Show when={item.kind}> · {item.kind}</Show>
                                        </div>
                                      </A>
                                    )}
                                  </Show>
                                )}
                              </For>
                            </div>
                          </div>
                        </Show>

                        <Show when={value().decisions.length > 0}>
                          <div class="rounded-2xl bg-surface-raised-base px-4 py-3">
                            <div class="text-11-medium uppercase tracking-wide text-text-weak">
                              Decisions {value().decisions.length}
                            </div>
                            <div class="mt-2 flex flex-col gap-2">
                              <For each={value().decisions}>
                                {(item) => (
                                  <Show
                                    when={item.id}
                                    fallback={
                                      <div class="rounded-lg bg-background-base px-3 py-2 text-11-regular text-text-weak">
                                        {item.op.replaceAll("_", " ")}
                                        <Show when={item.kind}> · {item.kind}</Show>
                                      </div>
                                    }
                                  >
                                    {(id) => (
                                      <A
                                        href={`/${params.dir}/decisions/${id()}`}
                                        class="rounded-lg bg-background-base px-3 py-2 hover:bg-surface-raised-base-hover"
                                      >
                                        <div class="text-12-medium text-text-strong">{item.kind || id()}</div>
                                        <div class="text-10-regular text-text-weak">
                                          {item.op.replaceAll("_", " ")}
                                        </div>
                                      </A>
                                    )}
                                  </Show>
                                )}
                              </For>
                            </div>
                          </div>
                        </Show>

                        <Show when={value().edges.length > 0}>
                          <div class="rounded-2xl bg-surface-raised-base px-4 py-3">
                            <div class="text-11-medium uppercase tracking-wide text-text-weak">
                              Edges {value().edges.length}
                            </div>
                            <div class="mt-2 flex flex-col gap-2">
                              <For each={value().edges}>
                                {(item) => (
                                  <div class="rounded-lg bg-background-base px-3 py-2 text-11-regular text-text-weak">
                                    <div class="text-12-medium text-text-strong">
                                      {item.kind ?? item.op.replaceAll("_", " ")}
                                    </div>
                                    <Show when={item.source && item.target}>
                                      <div class="mt-0.5">
                                        {item.source} → {item.target}
                                      </div>
                                    </Show>
                                  </div>
                                )}
                              </For>
                            </div>
                          </div>
                        </Show>
                      </div>
                    </section>
                  )}
                </Show>

                <Show when={commit().refs}>
                  <section class="mt-6" data-component="commit-refs">
                    <div class="text-11-medium uppercase tracking-wide text-text-weak">Refs</div>
                    <pre class="mt-2 overflow-x-auto rounded-2xl bg-surface-raised-base px-4 py-3 text-11-regular text-text-weak">
                      {JSON.stringify(commit().refs, null, 2)}
                    </pre>
                  </section>
                </Show>

                <div class="mt-6" data-component="commit-changes">
                  <div class="text-11-medium uppercase tracking-wide text-text-weak">
                    Changes ({commit().changes.length})
                  </div>
                  <div class="mt-2 flex flex-col gap-2">
                    <For each={commit().changes}>
                      {(change) => <ChangeView change={change} />}
                    </For>
                  </div>
                </div>
              </div>
            )}
          </Show>
        </div>
      </div>
    </div>
  )
}
