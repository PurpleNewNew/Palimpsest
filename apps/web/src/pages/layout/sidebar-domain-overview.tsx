import { Spinner } from "@palimpsest/ui/spinner"
import type { DomainCommit, DomainContext, DomainProposal } from "@palimpsest/sdk/v2"
import type { ProjectShell } from "@palimpsest/plugin-sdk/product"
import { createMemo, createResource, For, Match, Show, Switch, type Accessor, type JSX } from "solid-js"
import { useGlobalSDK } from "@/context/global-sdk"
import { useProduct } from "@/context/product"

type Data = {
  context: DomainContext
  proposals: DomainProposal[]
  commits: DomainCommit[]
  shell?: ProjectShell
}

function proposalLabel(item: DomainProposal) {
  if (item.title?.trim()) return item.title
  const count = item.changes.length
  return `${count} pending change${count === 1 ? "" : "s"}`
}

function commitLabel(item: DomainCommit) {
  const count = item.changes.length
  return `${item.actor.id} committed ${count} change${count === 1 ? "" : "s"}`
}

export function DomainSidebarOverview(props: {
  directory: string
  version: Accessor<number>
}): JSX.Element {
  const sdk = useGlobalSDK()
  const product = useProduct()
  const client = createMemo(() => sdk.createClient({ directory: props.directory, throwOnError: false }))

  const [data] = createResource(
    () => [props.directory, props.version()] as const,
    async () => {
      const [context, proposals, commits] = await Promise.all([
        client().domain.context(),
        client().domain.proposal.list(),
        client().domain.commit.list(),
      ])
      if (!context.data) throw new Error("Domain context is not available")

      const project = await client().project.current().then((value) => value.data).catch(() => undefined)
      const shell = project?.id ? await product.shell(project.id).catch(() => undefined) : undefined

      return {
        context: context.data,
        proposals: proposals.data ?? [],
        commits: commits.data ?? [],
        shell,
      } satisfies Data
    },
  )

  const pending = createMemo(() => (data()?.proposals ?? []).filter((item) => item.status === "pending").slice(0, 3))
  const recent = createMemo(() => (data()?.commits ?? []).slice(-3).reverse())
  const cards = createMemo(() => {
    const summary = data()?.context.summary
    if (!summary) return []
    return [
      { label: "nodes", value: summary.nodes },
      { label: "runs", value: summary.runs },
      { label: "artifacts", value: summary.artifacts },
      { label: "decisions", value: summary.decisions },
      { label: "pending", value: pending().length },
      { label: "commits", value: summary.commits },
    ]
  })

  return (
    <div class="px-3 pb-2">
      <div class="rounded-xl border border-border-weak-base bg-surface-raised-base px-3 py-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="text-11-regular uppercase tracking-wider text-text-weak">Domain</div>
            <div class="text-13-medium text-text-strong">Proposal-first project state</div>
          </div>
          <Show when={data.loading}>
            <Spinner class="size-4" />
          </Show>
        </div>

        <Switch>
          <Match when={data.error}>
            <div class="pt-3 text-12-regular text-text-weak">Domain data is not available yet.</div>
          </Match>
          <Match when={data()}>
            {(value) => (
              <>
                <Show when={value().shell}>
                  {(shell) => (
                    <div class="mt-3 rounded-lg bg-background-base px-2 py-2">
                      <div class="flex items-center justify-between gap-2">
                        <div class="min-w-0">
                          <div class="truncate text-12-medium text-text-strong">{shell().preset?.title ?? "Project Shell"}</div>
                          <div class="text-11-regular text-text-weak">{shell().lenses.length} lenses · {shell().actions.length} actions</div>
                        </div>
                        <Show when={shell().taxonomyID}>
                          <div class="rounded-full bg-surface-raised-base px-2 py-1 text-10-medium uppercase tracking-wide text-text-weak">
                            {shell().taxonomyID}
                          </div>
                        </Show>
                      </div>
                      <div class="mt-2 flex flex-wrap gap-1.5">
                        <For each={shell().workspaceTabs.slice(0, 6)}>
                          {(item) => (
                            <div class="rounded-full bg-surface-raised-base px-2 py-1 text-10-medium text-text-weak">
                              {item.title}
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </Show>

                <div class="mt-3 grid grid-cols-3 gap-2">
                  <For each={cards()}>
                    {(item) => (
                      <div class="rounded-lg bg-background-base px-2 py-2">
                        <div class="text-15-medium text-text-strong">{item.value}</div>
                        <div class="text-11-regular uppercase tracking-wide text-text-weak">{item.label}</div>
                      </div>
                    )}
                  </For>
                </div>

                <div class="mt-3 flex items-center justify-between text-11-regular uppercase tracking-wider text-text-weak">
                  <span>{value().context.project.name ?? "Project graph"}</span>
                  <span>{value().context.workspaces.length} workspaces</span>
                </div>

                <Show when={pending().length > 0}>
                  <div class="mt-3">
                    <div class="text-11-regular uppercase tracking-wider text-text-weak">Pending proposals</div>
                    <div class="mt-2 flex flex-col gap-1.5">
                      <For each={pending()}>
                        {(item) => (
                          <div class="rounded-lg bg-background-base px-2 py-2">
                            <div class="truncate text-12-medium text-text-strong">{proposalLabel(item)}</div>
                            <div class="text-11-regular text-text-weak">{item.actor.id}</div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                <Show when={recent().length > 0}>
                  <div class="mt-3">
                    <div class="text-11-regular uppercase tracking-wider text-text-weak">Recent commits</div>
                    <div class="mt-2 flex flex-col gap-1.5">
                      <For each={recent()}>
                        {(item) => (
                          <div class="rounded-lg bg-background-base px-2 py-2">
                            <div class="truncate text-12-medium text-text-strong">{commitLabel(item)}</div>
                            <div class="text-11-regular text-text-weak">{item.id}</div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                <Show when={pending().length === 0 && recent().length === 0}>
                  <div class="mt-3 text-12-regular text-text-weak">No proposals or commits yet.</div>
                </Show>
              </>
            )}
          </Match>
        </Switch>
      </div>
    </div>
  )
}
