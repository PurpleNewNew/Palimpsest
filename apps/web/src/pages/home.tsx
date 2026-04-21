import { createMemo, For, Match, Switch } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Logo } from "@opencode-ai/ui/logo"
import { useLayout } from "@/context/layout"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/util/encode"
import { Icon } from "@opencode-ai/ui/icon"
import { usePlatform } from "@/context/platform"
import { DateTime } from "luxon"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogSelectDirectory } from "@/components/dialog-select-directory"
import { DialogNewProject } from "@/components/dialog-new-project"
import { DialogSelectServer } from "@/components/dialog-select-server"
import { useServer } from "@/context/server"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { useAuth } from "@/context/auth"

export default function Home() {
  const sync = useGlobalSync()
  const layout = useLayout()
  const platform = usePlatform()
  const dialog = useDialog()
  const navigate = useNavigate()
  const server = useServer()
  const language = useLanguage()
  const auth = useAuth()
  const homedir = createMemo(() => sync.data.path.home)
  const workspace = createMemo(() => auth.workspace())
  const recent = createMemo(() => {
    return sync.data.project
      .slice()
      .sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
      .slice(0, 5)
  })

  const serverDotClass = createMemo(() => {
    const healthy = server.healthy()
    if (healthy === true) return "bg-icon-success-base"
    if (healthy === false) return "bg-icon-critical-base"
    return "bg-border-weak-base"
  })

  function openProject(directory: string) {
    layout.projects.open(directory)
    server.projects.touch(directory)
    navigate(`/${base64Encode(directory)}`)
  }

  function createProject() {
    dialog.show(() => <DialogNewProject onCreated={(directory) => openProject(directory)} />)
  }

  async function chooseProject() {
    function resolve(result: string | string[] | null) {
      if (Array.isArray(result)) {
        for (const directory of result) {
          openProject(directory)
        }
      } else if (result) {
        openProject(result)
      }
    }

    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      const result = await platform.openDirectoryPickerDialog?.({
        title: language.t("command.project.open"),
        multiple: true,
      })
      resolve(result)
    } else {
      dialog.show(
        () => <DialogSelectDirectory multiple={true} onSelect={resolve} />,
        () => resolve(null),
      )
    }
  }

  return (
    <div class="mx-auto mt-55 w-full md:w-auto px-4">
      <Logo class="md:w-xl opacity-12" />
      <div class="mt-8 rounded-[24px] border border-border-weak-base bg-background-base/80 p-4 shadow-[0_18px_60px_rgba(32,21,13,.08)] backdrop-blur">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div class="flex flex-col gap-1">
            <div class="text-12-medium uppercase tracking-[0.24em] text-text-weak">Workspace</div>
            <div class="text-20-semibold text-text-strong">{workspace()?.name ?? "Palimpsest"}</div>
            <div class="text-13-regular text-text-weak">
              {auth.user()?.displayName || auth.user()?.username}
              {auth.role() ? ` · ${auth.role()}` : ""}
              {workspace() ? ` · ${workspace()?.memberCount} members` : ""}
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <Button size="small" variant="primary" onClick={createProject}>
              新建项目
            </Button>
            <Button size="small" variant="secondary" onClick={chooseProject}>
              {language.t("command.project.open")}
            </Button>
            <For each={auth.workspaces()}>
              {(item) => (
                <Button
                  size="small"
                  variant={auth.workspaceID() === item.id ? "primary" : "secondary"}
                  onClick={() => auth.selectWorkspace(item.id)}
                >
                  {item.name}
                </Button>
              )}
            </For>
            <Button size="small" variant="ghost" onClick={() => auth.logout()}>
              退出登录
            </Button>
          </div>
        </div>
      </div>
      <Button
        size="large"
        variant="ghost"
        class="mt-4 mx-auto text-14-regular text-text-weak"
        onClick={() => dialog.show(() => <DialogSelectServer />)}
      >
        <div
          classList={{
            "size-2 rounded-full": true,
            [serverDotClass()]: true,
          }}
        />
        {server.name}
      </Button>
      <Switch>
        <Match when={sync.data.project.length > 0}>
          <div class="mt-20 w-full flex flex-col gap-4">
            <div class="flex gap-2 items-center justify-between pl-3">
              <div class="text-14-medium text-text-strong">{language.t("home.recentProjects")}</div>
              <div class="flex items-center gap-2">
                <Button size="normal" variant="secondary" onClick={createProject}>
                  新建项目
                </Button>
                <Button icon="folder-add-left" size="normal" class="pl-2 pr-3" onClick={chooseProject}>
                  {language.t("command.project.open")}
                </Button>
              </div>
            </div>
            <ul class="flex flex-col gap-2">
              <For each={recent()}>
                {(project) => (
                  <Button
                    size="large"
                    variant="ghost"
                    class="text-14-mono text-left justify-between px-3"
                    onClick={() => openProject(project.worktree)}
                  >
                    {project.worktree.replace(homedir(), "~")}
                    <div class="text-14-regular text-text-weak">
                      {DateTime.fromMillis(project.time.updated ?? project.time.created).toRelative()}
                    </div>
                  </Button>
                )}
              </For>
            </ul>
          </div>
        </Match>
        <Match when={true}>
          <div class="mt-30 mx-auto flex flex-col items-center gap-3">
            <Icon name="folder-add-left" size="large" />
            <div class="flex flex-col gap-1 items-center justify-center">
              <div class="text-14-medium text-text-strong">创建你的第一个 Palimpsest 项目</div>
              <div class="text-12-regular text-text-weak">先选择 preset，再创建核心项目、默认 lens 和稳定动作面。</div>
            </div>
            <div class="mt-1 flex items-center gap-2">
              <Button class="px-3" onClick={createProject}>
                新建项目
              </Button>
              <Button class="px-3" variant="secondary" onClick={chooseProject}>
                {language.t("command.project.open")}
              </Button>
            </div>
          </div>
        </Match>
      </Switch>
    </div>
  )
}
