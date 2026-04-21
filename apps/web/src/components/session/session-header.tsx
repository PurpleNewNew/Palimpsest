import { Button } from "@palimpsest/ui/button"
import { DropdownMenu } from "@palimpsest/ui/dropdown-menu"
import { Icon } from "@palimpsest/ui/icon"
import { IconButton } from "@palimpsest/ui/icon-button"
import { Keybind } from "@palimpsest/ui/keybind"
import { Popover } from "@palimpsest/ui/popover"
import { TextField } from "@palimpsest/ui/text-field"
import { showToast } from "@palimpsest/ui/toast"
import { Tooltip, TooltipKeybind } from "@palimpsest/ui/tooltip"
import { getFilename } from "@palimpsest/shared/path"
import { useParams } from "@solidjs/router"
import { createEffect, createMemo, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Portal } from "solid-js/web"
import { useCommand } from "@/context/command"
import { useGlobalSDK } from "@/context/global-sdk"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useSync } from "@/context/sync"
import { decode64 } from "@/utils/base64"
import { StatusPopover } from "../status-popover"

const showRequestError = (language: ReturnType<typeof useLanguage>, err: unknown) => {
  showToast({
    variant: "error",
    title: language.t("common.requestFailed"),
    description: err instanceof Error ? err.message : String(err),
  })
}

function useSessionShare(args: {
  globalSDK: {
    client: {
      session: {
        share: (input: { sessionID: string; directory: string }) => Promise<unknown>
        unshare: (input: { sessionID: string; directory: string }) => Promise<unknown>
      }
    }
  }
  currentSession: () =>
    | {
        share?: {
          url?: string
        }
      }
    | undefined
  sessionID: () => string | undefined
  projectDirectory: () => string
  platform: ReturnType<typeof usePlatform>
}) {
  const [state, setState] = createStore({
    share: false,
    unshare: false,
    copied: false,
    timer: undefined as number | undefined,
  })
  const shareUrl = createMemo(() => args.currentSession()?.share?.url)

  createEffect(() => {
    const url = shareUrl()
    if (url) return
    if (state.timer) window.clearTimeout(state.timer)
    setState({ copied: false, timer: undefined })
  })

  onCleanup(() => {
    if (state.timer) window.clearTimeout(state.timer)
  })

  const shareSession = () => {
    const sessionID = args.sessionID()
    if (!sessionID || state.share) return
    setState("share", true)
    args.globalSDK.client.session
      .share({ sessionID, directory: args.projectDirectory() })
      .catch((error) => {
        console.error("Failed to share session", error)
      })
      .finally(() => {
        setState("share", false)
      })
  }

  const unshareSession = () => {
    const sessionID = args.sessionID()
    if (!sessionID || state.unshare) return
    setState("unshare", true)
    args.globalSDK.client.session
      .unshare({ sessionID, directory: args.projectDirectory() })
      .catch((error) => {
        console.error("Failed to unshare session", error)
      })
      .finally(() => {
        setState("unshare", false)
      })
  }

  const copyLink = (onError: (error: unknown) => void) => {
    const url = shareUrl()
    if (!url) return
    navigator.clipboard
      .writeText(url)
      .then(() => {
        if (state.timer) window.clearTimeout(state.timer)
        setState("copied", true)
        const timer = window.setTimeout(() => {
          setState("copied", false)
          setState("timer", undefined)
        }, 3000)
        setState("timer", timer)
      })
      .catch(onError)
  }

  const viewShare = () => {
    const url = shareUrl()
    if (!url) return
    args.platform.openLink(url)
  }

  return { state, shareUrl, shareSession, unshareSession, copyLink, viewShare }
}

export function SessionHeader() {
  const globalSDK = useGlobalSDK()
  const layout = useLayout()
  const params = useParams()
  const command = useCommand()
  const sync = useSync()
  const platform = usePlatform()
  const language = useLanguage()

  const projectDirectory = createMemo(() => decode64(params.dir) ?? "")
  const project = createMemo(() => {
    const directory = projectDirectory()
    if (!directory) return
    return layout.projects.list().find((p) => p.worktree === directory || p.sandboxes?.includes(directory))
  })
  const name = createMemo(() => {
    const current = project()
    if (current) return current.name || getFilename(current.worktree)
    return getFilename(projectDirectory())
  })
  const hotkey = createMemo(() => command.keybind("file.open"))

  const currentSession = createMemo(() => (params.id ? sync.session.get(params.id) : undefined))
  const shareEnabled = createMemo(() => sync.data.config.share !== "disabled")
  const showShare = createMemo(() => shareEnabled() && !!params.id)
  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const view = createMemo(() => layout.view(sessionKey))

  const copyPath = () => {
    const directory = projectDirectory()
    if (!directory) return
    navigator.clipboard
      .writeText(directory)
      .then(() => {
        showToast({
          variant: "success",
          icon: "circle-check",
          title: language.t("session.share.copy.copied"),
          description: directory,
        })
      })
      .catch((err: unknown) => showRequestError(language, err))
  }

  const share = useSessionShare({
    globalSDK,
    currentSession,
    sessionID: () => params.id,
    projectDirectory,
    platform,
  })

  const centerMount = createMemo(() => document.getElementById("palimpsest-titlebar-center"))
  const rightMount = createMemo(() => document.getElementById("palimpsest-titlebar-right"))

  return (
    <>
      <Show when={centerMount()}>
        {(mount) => (
          <Portal mount={mount()}>
            <Button
              type="button"
              variant="ghost"
              size="small"
              class="hidden md:flex w-[240px] max-w-full min-w-0 pl-0.5 pr-2 items-center gap-2 justify-between rounded-md border border-border-weak-base bg-surface-panel shadow-none cursor-default"
              onClick={() => command.trigger("file.open")}
              aria-label={language.t("session.header.searchFiles")}
            >
              <div class="flex min-w-0 flex-1 items-center gap-1.5 overflow-visible">
                <Icon name="magnifying-glass" size="small" class="icon-base shrink-0 size-4" />
                <span class="flex-1 min-w-0 text-12-regular text-text-weak truncate text-left">
                  {language.t("session.header.search.placeholder", {
                    project: name(),
                  })}
                </span>
              </div>

              <Show when={hotkey()}>
                {(keybind) => (
                  <Keybind class="shrink-0 !border-0 !bg-transparent !shadow-none px-0">{keybind()}</Keybind>
                )}
              </Show>
            </Button>
          </Portal>
        )}
      </Show>
      <Show when={rightMount()}>
        {(mount) => (
          <Portal mount={mount()}>
            <div class="flex items-center gap-2">
              <StatusPopover />
              <Show when={projectDirectory()}>
                <DropdownMenu gutter={4} placement="bottom-end">
                  <DropdownMenu.Trigger
                    as={Button}
                    variant="ghost"
                    class="hidden xl:flex h-[24px] items-center gap-1.5 rounded-md border border-border-weak-base bg-surface-panel px-2 shadow-none"
                    aria-label="Session tools"
                  >
                    <Icon name="dot-grid" size="small" class="text-icon-base" />
                    <span class="text-12-regular text-text-strong">Session Tools</span>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content>
                      <DropdownMenu.Item onSelect={copyPath}>
                        <div class="flex size-5 shrink-0 items-center justify-center">
                          <Icon name="copy" size="small" class="text-icon-weak" />
                        </div>
                        <DropdownMenu.ItemLabel>Copy project path</DropdownMenu.ItemLabel>
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item onSelect={() => view().reviewPanel.toggle()}>
                        <div class="flex size-5 shrink-0 items-center justify-center">
                          <Icon
                            name={view().reviewPanel.opened() ? "layout-right-partial" : "layout-right"}
                            size="small"
                            class="text-icon-weak"
                          />
                        </div>
                        <DropdownMenu.ItemLabel>
                          {view().reviewPanel.opened() ? "Hide Reviews Panel" : "Show Reviews Panel"}
                        </DropdownMenu.ItemLabel>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item onSelect={() => layout.fileTree.toggle()}>
                        <div class="flex size-5 shrink-0 items-center justify-center">
                          <Icon
                            name={layout.fileTree.opened() ? "file-tree-active" : "file-tree"}
                            size="small"
                            class="text-icon-weak"
                          />
                        </div>
                        <DropdownMenu.ItemLabel>
                          {layout.fileTree.opened() ? "Hide Files Panel" : "Show Files Panel"}
                        </DropdownMenu.ItemLabel>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item onSelect={() => view().terminal.toggle()}>
                        <div class="flex size-5 shrink-0 items-center justify-center">
                          <Icon
                            name={view().terminal.opened() ? "layout-bottom-partial" : "layout-bottom"}
                            size="small"
                            class="text-icon-weak"
                          />
                        </div>
                        <DropdownMenu.ItemLabel>
                          {view().terminal.opened() ? "Hide Terminal" : "Show Terminal"}
                        </DropdownMenu.ItemLabel>
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu>
              </Show>
              <Show when={showShare()}>
                <div class="flex items-center">
                  <Popover
                    title={language.t("session.share.popover.title")}
                    description={
                      share.shareUrl()
                        ? language.t("session.share.popover.description.shared")
                        : language.t("session.share.popover.description.unshared")
                    }
                    gutter={4}
                    placement="bottom-end"
                    shift={-64}
                    class="rounded-xl [&_[data-slot=popover-close-button]]:hidden"
                    triggerAs={Button}
                    triggerProps={{
                      variant: "ghost",
                      class:
                        "rounded-md h-[24px] px-3 border border-border-weak-base bg-surface-panel shadow-none data-[expanded]:bg-surface-base-active",
                      classList: {
                        "rounded-r-none": share.shareUrl() !== undefined,
                        "border-r-0": share.shareUrl() !== undefined,
                      },
                      style: { scale: 1 },
                    }}
                    trigger={<span class="text-12-regular">{language.t("session.share.action.share")}</span>}
                  >
                    <div class="flex flex-col gap-2">
                      <Show
                        when={share.shareUrl()}
                        fallback={
                          <div class="flex">
                            <Button
                              size="large"
                              variant="primary"
                              class="w-1/2"
                              onClick={share.shareSession}
                              disabled={share.state.share}
                            >
                              {share.state.share
                                ? language.t("session.share.action.publishing")
                                : language.t("session.share.action.publish")}
                            </Button>
                          </div>
                        }
                      >
                        <div class="flex flex-col gap-2">
                          <TextField
                            value={share.shareUrl() ?? ""}
                            readOnly
                            copyable
                            copyKind="link"
                            tabIndex={-1}
                            class="w-full"
                          />
                          <div class="grid grid-cols-2 gap-2">
                            <Button
                              size="large"
                              variant="secondary"
                              class="w-full shadow-none border border-border-weak-base"
                              onClick={share.unshareSession}
                              disabled={share.state.unshare}
                            >
                              {share.state.unshare
                                ? language.t("session.share.action.unpublishing")
                                : language.t("session.share.action.unpublish")}
                            </Button>
                            <Button
                              size="large"
                              variant="primary"
                              class="w-full"
                              onClick={share.viewShare}
                              disabled={share.state.unshare}
                            >
                              {language.t("session.share.action.view")}
                            </Button>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </Popover>
                  <Show when={share.shareUrl()} fallback={<div aria-hidden="true" />}>
                    <Tooltip
                      value={
                        share.state.copied
                          ? language.t("session.share.copy.copied")
                          : language.t("session.share.copy.copyLink")
                      }
                      placement="top"
                      gutter={8}
                    >
                      <IconButton
                        icon={share.state.copied ? "check" : "link"}
                        variant="ghost"
                        class="rounded-l-none h-[24px] border border-border-weak-base bg-surface-panel shadow-none"
                        onClick={() => share.copyLink((error) => showRequestError(language, error))}
                        disabled={share.state.unshare}
                        aria-label={
                          share.state.copied
                            ? language.t("session.share.copy.copied")
                            : language.t("session.share.copy.copyLink")
                        }
                      />
                    </Tooltip>
                  </Show>
                </div>
              </Show>
              <div class="flex items-center gap-1" />
            </div>
          </Portal>
        )}
      </Show>
    </>
  )
}
