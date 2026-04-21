import { For, Show, createMemo, createResource } from "solid-js"
import { DateTime } from "luxon"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { useLanguage } from "@/context/language"
import { Icon } from "@opencode-ai/ui/icon"
import { Button } from "@opencode-ai/ui/button"
import { Mark } from "@opencode-ai/ui/logo"
import { getDirectory, getFilename } from "@opencode-ai/util/path"
import { useProduct } from "@/context/product"

const MAIN_WORKTREE = "main"
const CREATE_WORKTREE = "create"
const ROOT_CLASS = "size-full flex flex-col"

interface NewSessionViewProps {
  worktree: string
  onWorktreeChange: (value: string) => void
  onAction: (prompt: string) => void
}

export function NewSessionView(props: NewSessionViewProps) {
  const product = useProduct()
  const sync = useSync()
  const sdk = useSDK()
  const language = useLanguage()

  const sandboxes = createMemo(() => sync.project?.sandboxes ?? [])
  const options = createMemo(() => [MAIN_WORKTREE, ...sandboxes(), CREATE_WORKTREE])
  const current = createMemo(() => {
    const selection = props.worktree
    if (options().includes(selection)) return selection
    return MAIN_WORKTREE
  })
  const projectRoot = createMemo(() => sync.project?.worktree ?? sdk.directory)
  const isWorktree = createMemo(() => {
    const project = sync.project
    if (!project) return false
    return sdk.directory !== project.worktree
  })
  const [shell] = createResource(
    () => sync.project?.id,
    (projectID) => product.shell(projectID),
  )
  const icon = (value?: string) => (value ?? "sparkles") as Parameters<typeof Icon>[0]["name"]

  const label = (value: string) => {
    if (value === MAIN_WORKTREE) {
      if (isWorktree()) return language.t("session.new.worktree.main")
      const branch = sync.data.vcs?.branch
      if (branch) return language.t("session.new.worktree.mainWithBranch", { branch })
      return language.t("session.new.worktree.main")
    }

    if (value === CREATE_WORKTREE) return language.t("session.new.worktree.create")

    return getFilename(value)
  }

  return (
    <div class={ROOT_CLASS}>
      <div class="h-12 shrink-0" aria-hidden />
      <div class="flex-1 px-6 pb-30 flex items-center justify-center text-center">
        <div class="w-full max-w-200 flex flex-col items-center text-center gap-4">
          <div class="flex flex-col items-center gap-6">
            <Mark class="w-10" />
            <div class="text-20-medium text-text-strong">{language.t("session.new.title")}</div>
          </div>
          <div class="w-full flex flex-col gap-4 items-center">
            <div class="flex items-start justify-center gap-3 min-h-5">
              <div class="text-12-medium text-text-weak select-text leading-5 min-w-0 max-w-160 break-words text-center">
                {getDirectory(projectRoot())}
                <span class="text-text-strong">{getFilename(projectRoot())}</span>
              </div>
            </div>
            <div class="flex items-start justify-center gap-1.5 min-h-5">
              <Icon name="branch" size="small" class="mt-0.5 shrink-0" />
              <div class="text-12-medium text-text-weak select-text leading-5 min-w-0 max-w-160 break-words text-center">
                {label(current())}
              </div>
            </div>
            <Show when={sync.project}>
              {(project) => (
                <div class="flex items-start justify-center gap-3 min-h-5">
                  <div class="text-12-medium text-text-weak leading-5 min-w-0 max-w-160 break-words text-center">
                    {language.t("session.new.lastModified")}&nbsp;
                    <span class="text-text-strong">
                      {DateTime.fromMillis(project().time.updated ?? project().time.created)
                        .setLocale(language.intl())
                        .toRelative()}
                    </span>
                  </div>
                </div>
              )}
            </Show>
          </div>

          <Show when={shell()}>
            {(value) => (
              <div class="mt-3 w-full max-w-[820px] rounded-[28px] border border-border-weak-base bg-background-base px-5 py-5 shadow-[0_20px_60px_rgba(32,21,13,.08)]">
                <div class="flex flex-col gap-2 text-center">
                  <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Project Shell</div>
                  <div class="text-22-medium text-text-strong">{value().preset?.title ?? "Configured Project"}</div>
                  <div class="text-13-regular text-text-weak">{value().preset?.description}</div>
                </div>

                <div class="mt-5 flex flex-wrap justify-center gap-2">
                  <Show when={value().taxonomyID}>
                    <div class="rounded-full bg-surface-raised-base px-3 py-1 text-11-medium uppercase tracking-wide text-text-weak">
                      {value().taxonomyID}
                    </div>
                  </Show>
                  <For each={value().lenses}>
                    {(item) => (
                      <div class="rounded-full bg-surface-raised-base px-3 py-1 text-11-medium text-text-weak">
                        {item.title}
                      </div>
                    )}
                  </For>
                </div>

                <div class="mt-5 grid gap-3 md:grid-cols-2">
                  <div class="rounded-[20px] bg-surface-raised-base px-4 py-4 text-left">
                    <div class="text-11-medium uppercase tracking-[0.2em] text-text-weak">Workspace Tabs</div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <For each={value().workspaceTabs}>
                        {(item) => (
                          <div class="rounded-full bg-background-base px-3 py-1 text-12-medium text-text-strong">
                            {item.title}
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                  <div class="rounded-[20px] bg-surface-raised-base px-4 py-4 text-left">
                    <div class="text-11-medium uppercase tracking-[0.2em] text-text-weak">Session Tabs</div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <For each={value().sessionTabs}>
                        {(item) => (
                          <div class="rounded-full bg-background-base px-3 py-1 text-12-medium text-text-strong">
                            {item.title}
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </div>

                <div class="mt-5">
                  <div class="text-11-medium uppercase tracking-[0.2em] text-text-weak">Start With an Action</div>
                  <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <For each={value().actions}>
                      {(item) => (
                        <button
                          type="button"
                          class="rounded-[22px] border border-border-weak-base bg-surface-raised-base px-4 py-4 text-left transition-colors hover:border-border-strong"
                          onClick={() => props.onAction(item.prompt)}
                        >
                          <div class="flex items-center gap-2">
                            <div class="flex size-9 items-center justify-center rounded-2xl bg-background-base">
                              <Icon name={icon(item.icon)} size="small" />
                            </div>
                            <div class="text-14-medium text-text-strong">{item.title}</div>
                          </div>
                          <div class="mt-3 text-12-regular leading-6 text-text-weak">{item.description}</div>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            )}
          </Show>

          <Show when={shell.loading}>
            <div class="text-12-regular text-text-weak">Loading project shell...</div>
          </Show>

          <Show when={shell.error}>
            <div class="rounded-2xl border border-border-weak-base bg-surface-raised-base px-4 py-3 text-12-regular text-text-weak">
              This project does not have an active Palimpsest shell yet.
            </div>
          </Show>

          <Show when={options().length > 1}>
            <div class="mt-1 flex items-center gap-2">
              <Button variant="secondary" onClick={() => props.onWorktreeChange(MAIN_WORKTREE)}>
                Main Worktree
              </Button>
              <For each={sandboxes()}>
                {(item) => (
                  <Button variant="ghost" onClick={() => props.onWorktreeChange(item)}>
                    {getFilename(item)}
                  </Button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
