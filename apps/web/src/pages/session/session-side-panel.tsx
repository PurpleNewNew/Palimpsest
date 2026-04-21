import type { DomainCommit, DomainContext, DomainProposal, FileDiff } from "@palimpsest/sdk/v2"
import type { ProjectShell, SessionAttachment as ProductSessionAttachment } from "@palimpsest/plugin-sdk/product"
import { Button } from "@palimpsest/ui/button"
import { useDialog } from "@palimpsest/ui/context/dialog"
import { ResizeHandle } from "@palimpsest/ui/resize-handle"
import { Spinner } from "@palimpsest/ui/spinner"
import { Tabs } from "@palimpsest/ui/tabs"
import { createMediaQuery } from "@solid-primitives/media"
import { For, Match, Show, Switch, createMemo, createResource, type JSX } from "solid-js"
import { useParams } from "@solidjs/router"

import FileTree from "@/components/file-tree"
import { DialogSelectFile } from "@/components/dialog-select-file"
import { SessionContextTab } from "@/components/session"
import { SessionContextUsage } from "@/components/session-context-usage"
import { useFile } from "@/context/file"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useProduct } from "@/context/product"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { FileTabContent } from "@/pages/session/file-tabs"
import { type Sizing } from "@/pages/session/helpers"

type PanelID = "overview" | "reviews" | "context" | "files"

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

function SessionOverviewPanel(props: { sessionID: string }): JSX.Element {
  const product = useProduct()
  const sdk = useSDK()

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
                        {(attachment) => (
                          <div class="rounded-full bg-surface-raised-base px-3 py-1 text-11-medium text-text-strong">
                            {attachment.entity}: {attachment.title ?? attachment.id}
                          </div>
                        )}
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
                        <div class="rounded-2xl bg-surface-raised-base px-3 py-3">
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
                        </div>
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
                        <div class="rounded-2xl bg-surface-raised-base px-3 py-3">
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
                        </div>
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
  reviewPanel: () => JSX.Element
  activeDiff?: string
  focusReviewDiff: (path: string) => void
  size: Sizing
}) {
  const layout = useLayout()
  const params = useParams()
  const sync = useSync()
  const sdk = useSDK()
  const file = useFile()
  const language = useLanguage()
  const dialog = useDialog()

  const isDesktop = createMediaQuery("(min-width: 768px)")
  const sessionKey = createMemo(() => `${params.dir ?? ""}${params.id ? `/${params.id}` : ""}`)
  const tabs = createMemo(() => layout.tabs(sessionKey))
  const view = createMemo(() => layout.view(sessionKey))
  const show = createMemo(() => isDesktop() && !!params.id)
  const panelWidth = createMemo(() => `calc(100% - ${layout.session.width()}px)`)

  const info = createMemo(() => (params.id ? sync.session.get(params.id) : undefined))
  const diffs = createMemo(() => (params.id ? (sync.data.session_diff[params.id] ?? []) : []))
  const reviewCount = createMemo(() => Math.max(info()?.summary?.files ?? 0, diffs().length))
  const hasReview = createMemo(() => reviewCount() > 0)
  const diffsReady = createMemo(() => {
    const id = params.id
    if (!id) return true
    if (!hasReview()) return true
    return sync.data.session_diff[id] !== undefined
  })

  const state = createMemo<PanelID>(() => {
    if (view().reviewPanel.opened()) return "reviews"
    if (layout.fileTree.opened()) return "files"
    const active = tabs().active()
    if (active === "context" || tabs().all().includes("context")) return "context"
    return "overview"
  })

  const setActivePanel = (next: PanelID) => {
    if (next === "reviews") {
      view().reviewPanel.open()
      layout.fileTree.close()
      return
    }
    if (next === "files") {
      layout.fileTree.open()
      view().reviewPanel.close()
      return
    }
    if (next === "context") {
      tabs().open("context")
      view().reviewPanel.close()
      layout.fileTree.close()
      return
    }
    view().reviewPanel.close()
    layout.fileTree.close()
    if (tabs().all().includes("context")) tabs().close("context")
  }

  const fileTreeTab = createMemo(() => layout.fileTree.tab())
  const diffFiles = createMemo(() => diffs().map((item) => item.file))
  const nofiles = createMemo(() => {
    const tree = file.tree.state("")
    if (!tree?.loaded) return false
    return file.tree.children("").length === 0
  })
  const kinds = createMemo(() => {
    const merge = (a: "add" | "del" | "mix" | undefined, b: "add" | "del" | "mix") => {
      if (!a) return b
      if (a === b) return a
      return "mix" as const
    }
    const normalize = (value: string) => value.replaceAll("\\\\", "/").replace(/\/+$/, "")
    const out = new Map<string, "add" | "del" | "mix">()
    for (const diff of diffs() as FileDiff[]) {
      const filePath = normalize(diff.file)
      const kind = diff.status === "added" ? "add" : diff.status === "deleted" ? "del" : "mix"
      out.set(filePath, kind)
      const parts = filePath.split("/")
      for (const [idx] of parts.slice(0, -1).entries()) {
        const dir = parts.slice(0, idx + 1).join("/")
        if (!dir) continue
        out.set(dir, merge(out.get(dir), kind))
      }
    }
    return out
  })

  const openedFileTabs = createMemo(() => tabs().all().filter((tab) => !!file.pathFromTab(tab)))
  const activeFileTab = createMemo(() => {
    const active = tabs().active()
    if (active && file.pathFromTab(active)) return active
    return openedFileTabs()[0]
  })
  const showFilesPanel = createMemo(() => layout.fileTree.opened() || openedFileTabs().length > 0)

  const openFileTab = (path: string) => {
    const tab = file.tab(path)
    tabs().open(tab)
    tabs().setActive(tab)
    file.load(path)
    layout.fileTree.open()
  }

  return (
    <Show when={show()}>
      <aside
        id="workbench-panel"
        class="relative min-w-0 h-full flex shrink-0 overflow-hidden bg-background-base border-l border-border-weaker-base"
        style={{ width: panelWidth() }}
      >
        <div class="size-full flex">
          <div class="size-full min-w-0 h-full bg-background-base">
            <Tabs value={state()} onChange={(value) => setActivePanel(value as PanelID)} class="h-full">
              <div class="sticky top-0 shrink-0 flex">
                <Tabs.List>
                  <Tabs.Trigger value="overview">Workbench</Tabs.Trigger>
                  <Tabs.Trigger value="reviews">
                    <div class="flex items-center gap-1.5">
                      <span>Reviews</span>
                      <Show when={hasReview()}>
                        <span>{reviewCount()}</span>
                      </Show>
                    </div>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="context">
                    <div class="flex items-center gap-2">
                      <SessionContextUsage variant="indicator" />
                      <span>Context</span>
                    </div>
                  </Tabs.Trigger>
                  <Show when={showFilesPanel()}>
                    <Tabs.Trigger value="files">Project Files</Tabs.Trigger>
                  </Show>
                </Tabs.List>
              </div>

              <Tabs.Content value="overview" class="flex flex-col h-full overflow-hidden contain-strict">
                <Show when={params.id}>{(sessionID) => <SessionOverviewPanel sessionID={sessionID()} />}</Show>
              </Tabs.Content>

              <Tabs.Content value="reviews" class="flex flex-col h-full overflow-hidden contain-strict">
                <Show when={state() === "reviews"}>{props.reviewPanel()}</Show>
              </Tabs.Content>

              <Tabs.Content value="context" class="flex flex-col h-full overflow-hidden contain-strict">
                <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                  <SessionContextTab />
                </div>
              </Tabs.Content>

              <Tabs.Content value="files" class="flex flex-col h-full overflow-hidden contain-strict">
                <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-weaker-base bg-background-stronger">
                  <Tabs variant="pill" value={fileTreeTab()} onChange={(value) => layout.fileTree.setTab(value as "changes" | "all")} class="!h-auto">
                    <Tabs.List>
                      <Tabs.Trigger value="changes">
                        {reviewCount()} {language.t(reviewCount() === 1 ? "session.review.change.one" : "session.review.change.other")}
                      </Tabs.Trigger>
                      <Tabs.Trigger value="all">{language.t("session.files.all")}</Tabs.Trigger>
                    </Tabs.List>
                  </Tabs>
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => dialog.show(() => <DialogSelectFile mode="files" onOpenFile={() => layout.fileTree.setTab("all")} />)}
                  >
                    Add File
                  </Button>
                </div>

                <div class="grid min-h-0 flex-1 grid-rows-[minmax(180px,240px)_1fr]">
                  <div class="overflow-y-auto bg-background-stronger px-3 py-0">
                    <Switch>
                      <Match when={fileTreeTab() === "changes" && hasReview()}>
                        <Show
                          when={diffsReady()}
                          fallback={<div class="px-2 py-2 text-12-regular text-text-weak">{language.t("common.loading")}{language.t("common.loading.ellipsis")}</div>}
                        >
                          <FileTree
                            path=""
                            class="pt-3"
                            allowed={diffFiles()}
                            kinds={kinds()}
                            draggable={false}
                            active={props.activeDiff}
                            onFileClick={(node) => props.focusReviewDiff(node.path)}
                          />
                        </Show>
                      </Match>
                      <Match when={fileTreeTab() === "changes"}>
                        {empty(language.t("session.review.noChanges"))}
                      </Match>
                      <Match when={nofiles()}>
                        {empty(language.t("session.files.empty"))}
                      </Match>
                      <Match when={true}>
                        <FileTree
                          path=""
                          class="pt-3"
                          modified={diffFiles()}
                          kinds={kinds()}
                          onFileClick={(node) => openFileTab(node.path)}
                        />
                      </Match>
                    </Switch>
                  </div>

                  <div class="min-h-0 overflow-hidden border-t border-border-weaker-base bg-background-base">
                    <Show
                      when={openedFileTabs().length > 0}
                      fallback={
                        <div class="h-full flex items-center justify-center px-6 text-center text-12-regular text-text-weak">
                          Open a file from the tree to inspect it here without leaving the domain workbench.
                        </div>
                      }
                    >
                      <div class="flex h-full flex-col">
                        <div class="flex flex-wrap gap-2 border-b border-border-weaker-base px-3 py-2">
                          <For each={openedFileTabs()}>
                            {(tab) => {
                              const path = createMemo(() => file.pathFromTab(tab) ?? tab)
                              const active = createMemo(() => activeFileTab() === tab)
                              return (
                                <button
                                  type="button"
                                  class="rounded-full px-3 py-1 text-11-medium"
                                  classList={{
                                    "bg-surface-raised-base text-text-strong": active(),
                                    "bg-background-stronger text-text-weak": !active(),
                                  }}
                                  onClick={() => tabs().setActive(tab)}
                                >
                                  {path().split("/").at(-1)}
                                </button>
                              )
                            }}
                          </For>
                        </div>
                        <div class="min-h-0 flex-1 overflow-hidden">
                          <Show when={activeFileTab()} keyed>
                            {(tab) => <FileTabContent tab={tab} />}
                          </Show>
                        </div>
                      </div>
                    </Show>
                  </div>
                </div>
              </Tabs.Content>
            </Tabs>
          </div>

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
        </div>
      </aside>
    </Show>
  )
}
