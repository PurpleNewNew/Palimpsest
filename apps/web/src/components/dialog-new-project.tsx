import { createEffect, createMemo, createResource, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "@palimpsest/ui/button"
import { useDialog } from "@palimpsest/ui/context/dialog"
import { Dialog } from "@palimpsest/ui/dialog"
import { Icon } from "@palimpsest/ui/icon"
import type { Project } from "@palimpsest/sdk/v2/client"
import { TextField } from "@palimpsest/ui/text-field"
import { getFilename } from "@palimpsest/shared/path"

import { DialogPathPicker } from "@/components/dialog-path-picker"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useProduct } from "@/context/product"
import { useServer } from "@/context/server"

export function DialogNewProject(props: {
  onCreated: (directory: string) => void
}) {
  const dialog = useDialog()
  const globalSDK = useGlobalSDK()
  const globalSync = useGlobalSync()
  const layout = useLayout()
  const platform = usePlatform()
  const product = useProduct()
  const server = useServer()

  const [presets] = createResource(() => product.presets())
  const [store, setStore] = createStore({
    name: "",
    directory: "",
    presetID: "",
    input: {} as Record<string, string>,
    pending: false,
    error: "",
  })

  const preset = createMemo(() => presets()?.find((item) => item.id === store.presetID))
  const icon = (value?: string) => (value ?? "sparkles") as Parameters<typeof Icon>[0]["name"]

  createEffect(() => {
    const first = presets()?.[0]
    if (!first) return
    if (!store.presetID) {
      setStore("presetID", first.id)
      return
    }
    if (presets()?.some((item) => item.id === store.presetID)) return
    setStore("presetID", first.id)
  })

  createEffect(() => {
    const next = preset()
    if (!next) return
    setStore("input", () => {
      const out: Record<string, string> = {}
      for (const field of next.fields) {
        out[field.id] = store.input[field.id] ?? next.defaults[field.id] ?? field.defaultValue ?? ""
      }
      return out
    })
  })

  function upsert(directory: string, item?: Project) {
    if (!item?.id) return
    const list = globalSync.data.project
    const idx = list.findIndex((row) => row.id === item.id)
    if (idx >= 0) {
      globalSync.set(
        "project",
        list.map((row, i) => (i === idx ? { ...row, ...item } : row)),
      )
      return
    }
    const at = list.findIndex((row) => row.id > item.id)
    if (at >= 0) {
      globalSync.set("project", [...list.slice(0, at), item, ...list.slice(at)])
      return
    }
    globalSync.set("project", [...list, item])
    layout.projects.open(directory)
  }

  async function browse() {
    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      const value = await platform.openDirectoryPickerDialog({
        title: "Choose project directory",
        multiple: false,
      })
      if (!value) return
      setStore("directory", Array.isArray(value) ? (value[0] ?? "") : value)
      return
    }

    dialog.show(
      () => (
        <DialogPathPicker
          title="Choose project directory"
          mode="directories"
          onSelect={(value) => setStore("directory", Array.isArray(value) ? (value[0] ?? "") : value)}
          onClose={() => dialog.close()}
        />
      ),
      () => undefined,
    )
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    const dir = store.directory.trim()
    const next = preset()
    if (!dir || !next) return

    setStore("pending", true)
    setStore("error", "")
    try {
      await product.create({
        directory: dir,
        name: store.name.trim() || undefined,
        presetID: next.id,
        input: { ...store.input },
      })

      const client = globalSDK.createClient({
        directory: dir,
        throwOnError: true,
      })
      const current = await client.project.current()
      upsert(dir, current.data)
      server.projects.touch(dir)
      layout.projects.open(dir)
      dialog.close()
      props.onCreated(dir)
    } catch (err) {
      setStore("error", err instanceof Error ? err.message : "Failed to create project")
    } finally {
      setStore("pending", false)
    }
  }

  return (
    <Dialog title="New Project" class="mx-auto flex w-full max-w-[760px] flex-col">
      <form class="flex flex-col gap-6 p-6 pt-0" onSubmit={submit}>
        <div class="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <div class="flex flex-col gap-4">
            <div class="grid gap-3">
              <TextField
                autofocus
                label="Project directory"
                placeholder="/path/to/project"
                value={store.directory}
                onChange={(value) => setStore("directory", value)}
              />
              <div class="flex justify-end">
                <Button type="button" variant="secondary" size="small" onClick={browse}>
                  Browse
                </Button>
              </div>
            </div>

            <TextField
              label="Project name"
              placeholder={store.directory ? getFilename(store.directory) : "Optional"}
              value={store.name}
              onChange={(value) => setStore("name", value)}
            />

            <div class="flex flex-col gap-2">
              <div class="text-12-medium uppercase tracking-[0.18em] text-text-weak">Project type</div>
              <div class="grid gap-3">
                <For each={presets()}>
                  {(item) => (
                    <button
                      type="button"
                      class="rounded-[20px] border px-4 py-4 text-left transition-colors"
                      classList={{
                        "border-border-strong bg-surface-raised-base": store.presetID === item.id,
                        "border-border-weak-base bg-background-base hover:border-border-strong": store.presetID !== item.id,
                      }}
                      onClick={() => setStore("presetID", item.id)}
                    >
                      <div class="flex items-start gap-3">
                          <div class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-raised-base">
                          <Icon name={icon(item.icon)} size="small" />
                          </div>
                        <div class="min-w-0 flex-1">
                          <div class="text-14-medium text-text-strong">{item.title}</div>
                          <div class="mt-1 text-12-regular leading-6 text-text-weak">{item.description}</div>
                          <div class="mt-3 flex flex-wrap gap-2">
                            <Show when={item.defaultTaxonomyID}>
                              <div class="rounded-full bg-background-base px-2 py-1 text-11-medium uppercase tracking-wide text-text-weak">
                                {item.defaultTaxonomyID}
                              </div>
                            </Show>
                            <For each={item.defaultLensIDs}>
                              {(lens) => (
                                <div class="rounded-full bg-background-base px-2 py-1 text-11-medium text-text-weak">
                                  {lens}
                                </div>
                              )}
                            </For>
                          </div>
                        </div>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </div>

          <div class="rounded-[24px] border border-border-weak-base bg-surface-raised-base px-4 py-4">
            <div class="text-12-medium uppercase tracking-[0.18em] text-text-weak">Preset inputs</div>
            <div class="mt-1 text-14-medium text-text-strong">{preset()?.title ?? "Select a project type"}</div>

            <Show
              when={preset()?.fields.length}
              fallback={<div class="mt-5 text-12-regular text-text-weak">This preset uses only the default project shape.</div>}
            >
              <div class="mt-5 flex flex-col gap-4">
                <For each={preset()?.fields}>
                  {(field) => (
                    <TextField
                      multiline={field.type === "textarea"}
                      label={field.label}
                      description={field.description}
                      placeholder={field.placeholder}
                      value={store.input[field.id] ?? ""}
                      onChange={(value) => setStore("input", field.id, value)}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>

        <Show when={store.error}>
          <div class="rounded-2xl border border-surface-critical-base bg-surface-critical-base/10 px-4 py-3 text-13-regular text-text-critical-base">
            {store.error}
          </div>
        </Show>

        <div class="flex items-center justify-between gap-3">
          <div class="text-12-regular text-text-weak">Preset decides taxonomy, default lenses, and initial project shape.</div>
          <div class="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => dialog.close()}>
              Cancel
            </Button>
            <Button type="submit" disabled={store.pending || !store.directory.trim() || !preset()}>
              {store.pending ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
