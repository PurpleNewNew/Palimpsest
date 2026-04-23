import { Button } from "@palimpsest/ui/button"
import { useDialog } from "@palimpsest/ui/context/dialog"
import { Dialog } from "@palimpsest/ui/dialog"
import { Tabs } from "@palimpsest/ui/tabs"
import { Match, Switch, createSignal } from "solid-js"

import { ProjectCreatePane } from "@/components/dialog-new-project"
import { ProjectOpenPane } from "@/components/dialog-select-directory"
import { useLanguage } from "@/context/language"

export function DialogProjectEntry(props: {
  initial?: "create" | "open"
  onCreated: (directory: string) => void
  onOpen: (result: string | string[] | null) => void
}) {
  const dialog = useDialog()
  const language = useLanguage()
  const [mode, setMode] = createSignal(props.initial ?? "create")

  return (
    <Dialog title="项目" class="mx-auto flex w-full max-w-[820px] flex-col">
      <Tabs value={mode()} onChange={(value) => setMode((value as "create" | "open") ?? "create")} class="flex flex-col">
        <div class="px-6 pt-0">
          <Tabs.List class="inline-flex h-10 items-center gap-1 rounded-[16px] border border-border-weak-base bg-surface-raised-base p-1">
            <Tabs.Trigger value="create" class="rounded-[12px] px-3 py-1.5 text-13-medium">
              新建项目
            </Tabs.Trigger>
            <Tabs.Trigger value="open" class="rounded-[12px] px-3 py-1.5 text-13-medium">
              {language.t("command.project.open")}
            </Tabs.Trigger>
          </Tabs.List>
        </div>

        <Tabs.Content value="create" class="mt-4">
          <ProjectCreatePane onCreated={props.onCreated} />
        </Tabs.Content>

        <Tabs.Content value="open" class="mt-4">
          <div class="flex flex-col gap-4 p-6 pt-0">
            <div class="text-12-regular text-text-weak">选择最近项目，或者直接搜索并打开一个本地目录。</div>
            <div class="min-h-0 overflow-hidden rounded-[20px] border border-border-weak-base bg-background-base">
              <ProjectOpenPane onSelect={props.onOpen} />
            </div>
            <div class="flex justify-end">
              <Button variant="ghost" onClick={() => dialog.close()}>
                Cancel
              </Button>
            </div>
          </div>
        </Tabs.Content>
      </Tabs>
    </Dialog>
  )
}
