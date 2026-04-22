import { Button } from "@palimpsest/ui/button"
import { DropdownMenu } from "@palimpsest/ui/dropdown-menu"
import { Icon } from "@palimpsest/ui/icon"
import { Keybind } from "@palimpsest/ui/keybind"
import { showToast } from "@palimpsest/ui/toast"
import { TooltipKeybind } from "@palimpsest/ui/tooltip"
import { getFilename } from "@palimpsest/shared/path"
import { useParams } from "@solidjs/router"
import { createMemo, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { decode64 } from "@/utils/base64"
import { StatusPopover } from "../status-popover"

const showRequestError = (language: ReturnType<typeof useLanguage>, err: unknown) => {
  showToast({
    variant: "error",
    title: language.t("common.requestFailed"),
    description: err instanceof Error ? err.message : String(err),
  })
}

export function SessionHeader() {
  const layout = useLayout()
  const params = useParams()
  const command = useCommand()
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
                    aria-label="Tools"
                  >
                    <Icon name="dot-grid" size="small" class="text-icon-base" />
                    <span class="text-12-regular text-text-strong">Tools</span>
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
              <div class="flex items-center gap-1" />
            </div>
          </Portal>
        )}
      </Show>
    </>
  )
}
