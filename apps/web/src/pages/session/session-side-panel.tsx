import type { DomainCommit, DomainContext, DomainProposal } from "@palimpsest/sdk/v2"
import type { ProjectShell, SessionAttachment as ProductSessionAttachment } from "@palimpsest/plugin-sdk/product"
import { ResizeHandle } from "@palimpsest/ui/resize-handle"
import { Spinner } from "@palimpsest/ui/spinner"
import { Tabs } from "@palimpsest/ui/tabs"
import { createMediaQuery } from "@solid-primitives/media"
import { For, Match, Show, Switch, createMemo, createResource, type JSX } from "solid-js"
import { A, useParams } from "@solidjs/router"

import { SessionContextTab } from "@/components/session"
import { SessionContextUsage } from "@/components/session-context-usage"
import { useLayout } from "@/context/layout"
import { useProduct } from "@/context/product"
import { useSDK } from "@/context/sdk"
import { type Sizing } from "@/pages/session/helpers"

type PanelID = "overview" | "context"

type OverviewData = {
  shell?: ProjectShell
  context?: DomainContext
  proposals: DomainProposal[]
  commits: DomainCommit[]
  attachments: ProductSessionAttachment[]
}

function refCount(value: unknown) {
  if (!value) return 0
  if (Array.isArray(value)) return value.length
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length
  return 0
}

function snippet(value?: string, fallback = "No rationale yet.") {
  const text = value?.trim()
  if (!text) return fallback
  return text.length > 120 ? `${text.slice(0, 117)}...` : text
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

function attachmentHref(directory: string, attachment: ProductSessionAttachment) {
  if (attachment.entity === "project") return `/${directory}/nodes`
  if (attachment.entity === "node") return `/${directory}/nodes/${attachment.id}`
  if (attachment.entity === "run") return `/${directory}/runs/${attachment.id}`
  if (attachment.entity === "proposal") return `/${directory}/reviews/${attachment.id}`
  if (attachment.entity === "decision") return `/${directory}/decisions/${attachment.id}`
  return undefined
}

function proposalHref(directory: string, proposalID: string) {
  return `/${directory}/reviews/${proposalID}`
}

function commitHref(directory: string, commitID: string) {
  return `/${directory}/commits/${commitID}`
}

function SessionOverviewPanel(props: { sessionID: string }): JSX.Element {
  const product = useProduct()
  const sdk = useSDK()
  const params = useParams()
  const directory = createMemo(() => params.dir ?? "")

  const [data] = createResource(
    () => props.sessionID,
    async (sessionID) => {
      const [attachments, context, proposals, commits, project] = await Promise.all([
        product.sessionAttachments(sessionID).catch(() => []),
        sdk.client.domain.context().then((value) => value.data).catch(() => undefined),
        sdk.client.domain.proposal.list().then((value) => value.data ?? []).catch(() => []),
        sdk.client.domain.commit.list().then((value) => value.data ?? []).catch(() => []),
        sdk.client.project.current().then((value) => value.data).catch(() => undefined),
      ])
      const shell = project?.id ? await product.shell(project.id).catch(() => undefined) : undefined
      return {
        shell,
        context,
        proposals,
        commits,
        attachments,
      } satisfies OverviewData
    },
  )

  const cards = createMemo(() => {
    const summary = data()?.context?.summary
    if (!summary) return []
    return [
      { label: "Nodes", value: summary.nodes },
      { label: "Runs", value: summary.runs },
      { label: "Artifacts", value: summary.artifacts },
      { label: "Decisions", value: summary.decisions },
      { label: "Proposals", value: summary.proposals },
      { label: "Commits", value: summary.commits },
    ]
  })
  const pending = createMemo(() => (data()?.proposals ?? []).filter((item) => item.status === "pending").slice(0, 4))
  const recent = createMemo(() => (data()?.commits ?? []).slice(-4).reverse())

  return (
    <div class="flex h-full flex-col overflow-hidden bg-background-stronger">
      <div class="flex items-center justify-between px-4 pt-3">
        <div>
          <div class="text-11-medium uppercase tracking-[0.2em] text-text-weak">Session Workbench</div>
          <div class="text-13-medium text-text-strong">{data()?.shell?.preset?.title ?? "Palimpsest Session"}</div>
        </div>
        <Show when={data.loading}>
          <Spinner class="size-4" />
        </Show>
      </div>

      <div class="flex-1 overflow-y-auto px-4 py-3">
        <Switch>
          <Match when={data.error}>
            <div class="rounded-2xl bg-background-base px-3 py-3 text-12-regular text-text-weak">
              This session is active, but its domain overview is still loading.
            </div>
          </Match>
          <Match when={data()}>
            {(value) => (
              <div class="flex flex-col gap-3">
                <Show when={value().attachments.length > 0}>
                  <div class="rounded-2xl bg-background-base px-3 py-3">
                    <div class="text-11-medium uppercase tracking-[0.2em] text-text-weak">Attachments</div>
                      <div class="mt-2 flex flex-wrap gap-2">
                        <For each={value().attachments}>
                          {(attachment) => {
                            const href = attachmentHref(directory(), attachment)
                            return (
                              <Show
                                when={href}
                                fallback={
                                  <div class="rounded-full bg-surface-raised-base px-3 py-1 text-11-medium text-text-strong">
                                    {attachment.entity}: {attachment.title ?? attachment.id}
                                  </div>
                                }
                              >
                                {(link) => (
                                  <A
                                    href={link()}
                                    class="rounded-full bg-surface-raised-base px-3 py-1 text-11-medium text-text-strong hover:bg-surface-raised-base-hover"
                                  >
                                    {attachment.entity}: {attachment.title ?? attachment.id}
                                  </A>
                                )}
                              </Show>
                            )
                          }}
                      </For>
                    </div>
                  </div>
                </Show>

                <Show when={value().shell}>
                  {(shell) => (
                    <div class="rounded-2xl bg-background-base px-3 py-3">
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

                <Show when={cards().length > 0}>
                  <div class="grid grid-cols-2 gap-2">
                    <For each={cards()}>
                      {(card) => (
                        <div class="rounded-2xl bg-background-base px-3 py-3">
                          <div class="text-15-medium text-text-strong">{card.value}</div>
                          <div class="text-11-regular uppercase tracking-wide text-text-weak">{card.label}</div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>

                <div class="rounded-2xl bg-background-base px-3 py-3">
                  <div class="text-11-medium uppercase tracking-[0.2em] text-text-weak">Pending Reviews</div>
                  <div class="mt-2 flex flex-col gap-2">
                    <For each={pending()}>
                      {(item) => (
                        <A
                          href={proposalHref(directory(), item.id)}
                          class="rounded-2xl bg-surface-raised-base px-3 py-3 hover:bg-surface-raised-base-hover"
                        >
                          <div class="flex items-start justify-between gap-2">
                            <div class="truncate text-12-medium text-text-strong">{proposalLabel(item)}</div>
                            <div class="rounded-full bg-background-base px-2 py-1 text-10-medium uppercase tracking-wide text-text-weak">
                              {item.status}
                            </div>
                          </div>
                          <div class="mt-1 text-11-regular text-text-weak">{snippet(item.rationale)}</div>
                          <div class="mt-2 flex items-center gap-2 text-10-medium uppercase tracking-wide text-text-weak">
                            <span>{item.actor.id}</span>
                            <span>{item.changes.length} changes</span>
                            <Show when={refCount(item.refs) > 0}>
                              <span>{refCount(item.refs)} refs</span>
                            </Show>
                          </div>
                        </A>
                      )}
                    </For>
                    <Show when={pending().length === 0}>
                      <div class="text-12-regular text-text-weak">No pending proposals for this project.</div>
                    </Show>
                  </div>
                </div>

                <div class="rounded-2xl bg-background-base px-3 py-3">
                  <div class="text-11-medium uppercase tracking-[0.2em] text-text-weak">Recent Commits</div>
                  <div class="mt-2 flex flex-col gap-2">
                    <For each={recent()}>
                      {(item) => (
                        <A
                          href={commitHref(directory(), item.id)}
                          class="rounded-2xl bg-surface-raised-base px-3 py-3 hover:bg-surface-raised-base-hover"
                        >
                          <div class="truncate text-12-medium text-text-strong">{commitLabel(item)}</div>
                          <div class="mt-1 text-11-regular text-text-weak">{item.id}</div>
                          <div class="mt-2 flex items-center gap-2 text-10-medium uppercase tracking-wide text-text-weak">
                            <span>{item.changes.length} changes</span>
                            <Show when={item.proposalID}>
                              <span>from {item.proposalID}</span>
                            </Show>
                            <Show when={refCount(item.refs) > 0}>
                              <span>{refCount(item.refs)} refs</span>
                            </Show>
                          </div>
                        </A>
                      )}
                    </For>
                    <Show when={recent().length === 0}>
                      <div class="text-12-regular text-text-weak">No commits have landed yet.</div>
                    </Show>
                  </div>
                </div>
              </div>
            )}
          </Match>
        </Switch>
      </div>
    </div>
  )
}

function empty(msg: string) {
  return (
    <div class="h-full flex flex-col">
      <div class="h-6 shrink-0" aria-hidden />
      <div class="flex-1 pb-32 flex items-center justify-center text-center">
        <div class="text-12-regular text-text-weak">{msg}</div>
      </div>
    </div>
  )
}

export function SessionSidePanel(props: {
  size: Sizing
  mobile?: boolean
}) {
  const layout = useLayout()
  const params = useParams()

  const isDesktop = createMediaQuery("(min-width: 768px)")
  const sessionKey = createMemo(() => `${params.dir ?? ""}${params.id ? `/${params.id}` : ""}`)
  const tabs = createMemo(() => layout.tabs(sessionKey))
  const show = createMemo(() => (props.mobile ? !!params.id : isDesktop() && !!params.id))
  const panelWidth = createMemo(() => (props.mobile ? "100%" : `calc(100% - ${layout.session.width()}px)`))

  const state = createMemo<PanelID>(() => {
    const active = tabs().active()
    if (active === "context" || tabs().all().includes("context")) return "context"
    return "overview"
  })

  const setActivePanel = (next: PanelID) => {
    if (next === "context") {
      tabs().open("context")
      return
    }
    if (tabs().all().includes("context")) tabs().close("context")
  }

  return (
    <Show when={show()}>
      <aside
        id="workbench-panel"
        class="relative min-w-0 h-full flex shrink-0 overflow-hidden bg-background-base"
        classList={{
          "border-l border-border-weaker-base": !props.mobile,
          "border-t border-border-weak-base": !!props.mobile,
        }}
        style={{ width: panelWidth() }}
      >
        <div class="size-full flex">
          <div class="size-full min-w-0 h-full bg-background-base">
            <Tabs value={state()} onChange={(value) => setActivePanel(value as PanelID)} class="h-full">
              <div class="sticky top-0 shrink-0 flex">
                <Tabs.List>
                  <Tabs.Trigger value="overview">Workbench</Tabs.Trigger>
                  <Tabs.Trigger value="context">
                    <div class="flex items-center gap-2">
                      <SessionContextUsage variant="indicator" />
                      <span>Context</span>
                    </div>
                  </Tabs.Trigger>
                </Tabs.List>
              </div>

              <Tabs.Content value="overview" class="flex flex-col h-full overflow-hidden contain-strict">
                <Show when={params.id}>{(sessionID) => <SessionOverviewPanel sessionID={sessionID()} />}</Show>
              </Tabs.Content>

              <Tabs.Content value="context" class="flex flex-col h-full overflow-hidden contain-strict">
                <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                  <SessionContextTab />
                </div>
              </Tabs.Content>
            </Tabs>
          </div>

          <Show when={!props.mobile}>
            <div onPointerDown={() => props.size.start()}>
              <ResizeHandle
                direction="horizontal"
                size={layout.session.width()}
                min={450}
                max={typeof window === "undefined" ? 1000 : window.innerWidth * 0.45}
                onResize={(width) => {
                  props.size.touch()
                  layout.session.resize(width)
                }}
              />
            </div>
          </Show>
        </div>
      </aside>
    </Show>
  )
}
