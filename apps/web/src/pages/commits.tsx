import { createMemo, createResource, createSignal, For, Match, Show, Switch, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import type { DomainCommit, DomainProposal } from "@palimpsest/sdk/v2"
import { Button } from "@palimpsest/ui/button"

import { useSDK } from "@/context/sdk"
import { ChangeView } from "./reviews/change-view"

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
      const [commits, proposals] = await Promise.all([
        sdk.client.domain.commit.list().then((value) => value.data ?? []),
        sdk.client.domain.proposal.list().then((value) => value.data ?? []),
      ])
      return { commits, proposals }
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
