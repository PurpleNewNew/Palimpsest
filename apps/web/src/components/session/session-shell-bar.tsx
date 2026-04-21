import type { DomainCommit, DomainContext, DomainProposal } from "@palimpsest/sdk/v2"
import type { ProjectShell, SessionAttachment as ProductSessionAttachment } from "@palimpsest/plugin-sdk/product"
import { Button } from "@palimpsest/ui/button"
import { Icon } from "@palimpsest/ui/icon"
import { Spinner } from "@palimpsest/ui/spinner"
import { createMemo, createResource, For, Match, Show, Switch, type JSX } from "solid-js"

import { useProduct } from "@/context/product"
import { useSDK } from "@/context/sdk"

type ShellData = {
  shell?: ProjectShell
  context?: DomainContext
  proposals: DomainProposal[]
  commits: DomainCommit[]
  attachments: ProductSessionAttachment[]
}

type SessionShellBarProps = {
  projectID?: string
  projectName?: string
  projectDirectory: string
  sessionID?: string
  onAction: (prompt: string) => void
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

export function SessionShellBar(props: SessionShellBarProps): JSX.Element {
  const sdk = useSDK()
  const product = useProduct()

  const [data] = createResource(
    () => [props.projectID, props.sessionID, props.projectDirectory] as const,
    async ([projectID, sessionID]) => {
      const shell = projectID ? await product.shell(projectID).catch(() => undefined) : undefined
      const [context, proposals, commits, attachments] = await Promise.all([
        sdk.client.domain.context().then((value) => value.data).catch(() => undefined),
        sdk.client.domain.proposal.list().then((value) => value.data ?? []).catch(() => []),
        sdk.client.domain.commit.list().then((value) => value.data ?? []).catch(() => []),
        sessionID ? product.sessionAttachments(sessionID).catch(() => []) : Promise.resolve([]),
      ])

      return {
        shell,
        context,
        proposals,
        commits,
        attachments,
      } satisfies ShellData
    },
  )

  const pendingProposals = createMemo(() => (data()?.proposals ?? []).filter((item) => item.status === "pending"))
  const recentCommits = createMemo(() => (data()?.commits ?? []).slice(-3).reverse())
  const effectiveAttachments = createMemo(() => {
    const current = data()?.attachments ?? []
    if (current.length > 0) return current
    if (!props.projectID) return current
    return [
      {
        entity: "project" as const,
        id: props.projectID,
        title: props.projectName,
      },
    ]
  })
  const coreTabs = createMemo(() => (data()?.shell?.workspaceTabs ?? []).filter((tab) => tab.kind === "core"))
  const lensTabs = createMemo(() =>
    [...(data()?.shell?.workspaceTabs ?? []), ...(data()?.shell?.sessionTabs ?? [])].filter((tab) => tab.kind === "lens"),
  )
  const cards = createMemo(() => {
    const summary = data()?.context?.summary
    if (!summary) return []
    return [
      { label: "Nodes", value: summary.nodes },
      { label: "Runs", value: summary.runs },
      { label: "Artifacts", value: summary.artifacts },
      { label: "Decisions", value: summary.decisions },
      { label: "Pending Reviews", value: pendingProposals().length },
      { label: "Commits", value: summary.commits },
    ]
  })

  return (
    <div class="border-b border-border-weak-base bg-background-base px-4 py-4">
      <div class="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Project Shell</div>
            <div class="mt-1 text-20-medium text-text-strong">
              {data()?.shell?.preset?.title ?? props.projectName ?? "Palimpsest Session"}
            </div>
            <div class="mt-1 text-12-regular text-text-weak">
              {data()?.shell?.preset?.description ?? "Domain-first session with proposal, review, and commit context."}
            </div>
          </div>
          <Show when={data.loading}>
            <Spinner class="size-4 shrink-0" />
          </Show>
        </div>

        <Switch>
          <Match when={data.error}>
            <div class="rounded-2xl border border-border-weak-base bg-surface-raised-base px-4 py-3 text-12-regular text-text-weak">
              This session is available, but its project shell metadata is still loading.
            </div>
          </Match>
          <Match when={data()}>
            {(value) => (
              <>
                <div class="flex flex-wrap gap-2">
                  <Show when={value().shell?.taxonomyID}>
                    <div class="rounded-full bg-surface-raised-base px-3 py-1 text-11-medium uppercase tracking-wide text-text-weak">
                      {value().shell?.taxonomyID}
                    </div>
                  </Show>
                  <For each={value().shell?.lenses ?? []}>
                    {(lens) => (
                      <div class="rounded-full bg-surface-raised-base px-3 py-1 text-11-medium text-text-weak">
                        {lens.title}
                      </div>
                    )}
                  </For>
                  <For each={effectiveAttachments()}>
                    {(attachment) => (
                      <div class="rounded-full bg-background-stronger px-3 py-1 text-11-medium text-text-strong">
                        {attachment.entity}: {attachment.title ?? attachment.id}
                      </div>
                    )}
                  </For>
                </div>

                <Show when={cards().length > 0}>
                  <div class="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                    <For each={cards()}>
                      {(card) => (
                        <div class="rounded-2xl bg-surface-raised-base px-3 py-3">
                          <div class="text-16-medium text-text-strong">{card.value}</div>
                          <div class="text-11-regular uppercase tracking-wide text-text-weak">{card.label}</div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>

                <div class="grid gap-3 xl:grid-cols-[1.25fr_1fr_1fr]">
                  <div class="rounded-2xl bg-surface-raised-base px-4 py-4">
                    <div class="text-11-medium uppercase tracking-[0.2em] text-text-weak">Canonical Core Tabs</div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <For each={coreTabs()}>
                        {(tab) => (
                          <div class="rounded-full bg-background-base px-3 py-1 text-12-medium text-text-strong">
                            {tab.title}
                          </div>
                        )}
                      </For>
                    </div>
                    <Show when={lensTabs().length > 0}>
                      <div class="mt-4 text-11-medium uppercase tracking-[0.2em] text-text-weak">Lens Tabs</div>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <For each={lensTabs()}>
                          {(tab) => (
                            <div class="rounded-full bg-background-base px-3 py-1 text-12-medium text-text-weak">
                              {tab.title}
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>

                  <div class="rounded-2xl bg-surface-raised-base px-4 py-4">
                    <div class="text-11-medium uppercase tracking-[0.2em] text-text-weak">Pending Reviews</div>
                    <div class="mt-3 flex flex-col gap-2">
                      <For each={pendingProposals().slice(0, 3)}>
                        {(item) => (
                          <div class="rounded-2xl bg-background-base px-3 py-3">
                            <div class="truncate text-12-medium text-text-strong">{proposalLabel(item)}</div>
                            <div class="text-11-regular text-text-weak">{item.actor.id}</div>
                          </div>
                        )}
                      </For>
                      <Show when={pendingProposals().length === 0}>
                        <div class="rounded-2xl bg-background-base px-3 py-3 text-12-regular text-text-weak">
                          No pending proposals for this project.
                        </div>
                      </Show>
                    </div>
                  </div>

                  <div class="rounded-2xl bg-surface-raised-base px-4 py-4">
                    <div class="text-11-medium uppercase tracking-[0.2em] text-text-weak">Recent Commits</div>
                    <div class="mt-3 flex flex-col gap-2">
                      <For each={recentCommits()}>
                        {(item) => (
                          <div class="rounded-2xl bg-background-base px-3 py-3">
                            <div class="truncate text-12-medium text-text-strong">{commitLabel(item)}</div>
                            <div class="text-11-regular text-text-weak">{item.id}</div>
                          </div>
                        )}
                      </For>
                      <Show when={recentCommits().length === 0}>
                        <div class="rounded-2xl bg-background-base px-3 py-3 text-12-regular text-text-weak">
                          No commits have landed yet.
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>

                <Show when={(value().shell?.actions ?? []).length > 0}>
                  <div class="rounded-2xl bg-surface-raised-base px-4 py-4">
                    <div class="flex items-center gap-2">
                      <Icon name="brain" size="small" />
                      <div class="text-11-medium uppercase tracking-[0.2em] text-text-weak">Start With an Action</div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <For each={value().shell?.actions ?? []}>
                        {(action) => (
                          <Button variant="secondary" size="small" onClick={() => props.onAction(action.prompt)}>
                            {action.title}
                          </Button>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </>
            )}
          </Match>
        </Switch>
      </div>
    </div>
  )
}
