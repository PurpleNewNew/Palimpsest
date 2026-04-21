import { Button } from "@palimpsest/ui/button"
import { useDialog } from "@palimpsest/ui/context/dialog"
import { Dialog } from "@palimpsest/ui/dialog"
import { FileIcon } from "@palimpsest/ui/file-icon"
import { Icon } from "@palimpsest/ui/icon"
import { IconButton } from "@palimpsest/ui/icon-button"
import { List } from "@palimpsest/ui/list"
import { TextField } from "@palimpsest/ui/text-field"
import { getFilename } from "@palimpsest/shared/path"
import { Show, createEffect, createMemo, createSignal } from "solid-js"

import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"

function clean(value: string) {
  const line = (value ?? "").split(/\r?\n/)[0] ?? ""
  return line.replace(/[\u0000-\u001F\u007F]/g, "").trim()
}

function trim(input: string) {
  const value = input.replace(/\\/g, "/")
  if (!value) return value
  if (value === "/") return value
  return value.replace(/\/+$/, "")
}

function join(base: string, rel: string) {
  const root = trim(base)
  if (!root) return rel
  if (!rel) return root
  if (rel.startsWith("/")) return rel
  if (root.endsWith("/")) return root + rel
  return `${root}/${rel}`
}

type Mode = "files" | "directories"

export type PathPickerProps = {
  title: string
  mode: Mode
  multiple?: boolean
  acceptExt?: string[]
  allowDirs?: boolean
  startDir?: () => string | undefined
  onSelect: (value: string | string[]) => void
  onClose: () => void
  validateSelection?: (paths: string[]) => Promise<{ valid: boolean; error?: string }>
}

export function DialogPathPicker(props: PathPickerProps) {
  const sdk = useGlobalSDK()
  const sync = useGlobalSync()
  const dialog = useDialog()
  const language = useLanguage()
  const [filter, setFilter] = createSignal("")
  const [selected, setSelected] = createSignal(new Set<string>())
  const [error, setError] = createSignal<string>()
  const [validating, setValidating] = createSignal(false)

  const home = createMemo(() => props.startDir?.() || sync.data.path.home || sync.data.path.directory || "/")
  const [cwd, setCwd] = createSignal(trim(home()))
  const [items, setItems] = createSignal<Array<{ path: string; type: "file" | "directory" }>>([])

  const up = () => {
    const path = cwd()
    if (!path || path === "/") return
    setCwd(path.replace(/\/[^/]+\/?$/, "") || "/")
    setFilter("")
  }

  const enter = (path: string) => {
    setCwd(path)
    setFilter("")
  }

  createEffect(() => {
    const base = cwd()
    const query = clean(filter())
    if (!base) {
      setItems([])
      return
    }

    const load = async () => {
      if (!query) {
        const list = await sdk.client.file
          .list({ directory: base, path: "" })
          .then((res) => res.data ?? [])
          .catch(() => [])

        return list
          .filter((item) => props.mode === "files" || item.type === "directory")
          .map((item) => ({ path: trim(item.absolute), type: item.type as "file" | "directory" }))
      }

      if (props.mode === "files" && props.allowDirs) {
        const [files, dirs] = await Promise.all([
          sdk.client.find
            .files({ directory: base, query, type: "file", limit: 50 })
            .then((res) => res.data ?? [])
            .catch(() => []),
          sdk.client.find
            .files({ directory: base, query, type: "directory", limit: 50 })
            .then((res) => res.data ?? [])
            .catch(() => []),
        ])

        return [
          ...files.map((rel) => ({ path: trim(join(base, rel)), type: "file" as const })),
          ...dirs.map((rel) => ({ path: trim(join(base, rel)), type: "directory" as const })),
        ]
      }

      const found = await sdk.client.find
        .files({ directory: base, query, type: props.mode === "files" ? "file" : "directory", limit: 50 })
        .then((res) => res.data ?? [])
        .catch(() => [])

      return found.map((rel) => ({
        path: trim(join(base, rel)),
        type: (props.mode === "files" ? "file" : "directory") as "file" | "directory",
      }))
    }

    load().then(setItems).catch(() => setItems([]))
  })

  const list = createMemo(() => {
    const query = clean(filter()).toLowerCase()
    let value = items().filter((item) => {
      const name = item.path.split("/").pop() || item.path
      return !name.startsWith(".")
    })

    if (query) {
      value = value.filter((item) => {
        const name = item.path.split("/").pop() || item.path
        return name.toLowerCase().includes(query)
      })
    }

    if (props.acceptExt && props.mode === "files") {
      const allow = props.acceptExt.map((item) => item.toLowerCase())
      value = value.filter(
        (item) => item.type === "directory" || allow.some((ext) => item.path.toLowerCase().endsWith(ext)),
      )
    }

    return value
  })

  const pickable = (item: { type: "file" | "directory" }) => {
    if (props.mode === "directories") return item.type === "directory"
    return item.type === "file" || (props.allowDirs && item.type === "directory")
  }

  let timer: ReturnType<typeof setTimeout> | null = null

  const click = (item: { path: string; type: "file" | "directory" }) => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }

    timer = setTimeout(() => {
      timer = null

      if (!pickable(item)) {
        if (item.type === "directory") enter(item.path)
        return
      }

      if (!props.multiple) {
        setSelected((prev) => {
          const next = new Set<string>()
          if (!prev.has(item.path)) next.add(item.path)
          return next
        })
        setError(undefined)
        return
      }

      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(item.path)) next.delete(item.path)
        else next.add(item.path)
        return next
      })
      setError(undefined)
    }, 200)
  }

  const dblclick = (item: { path: string; type: "file" | "directory" }) => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (item.type === "directory") enter(item.path)
  }

  const confirm = async () => {
    const value = Array.from(selected())
    if (value.length === 0) return

    if (props.validateSelection) {
      setValidating(true)
      const result = await props.validateSelection(value).catch(() => ({ valid: false, error: "Validation failed" }))
      setValidating(false)
      if (!result.valid) {
        setError(result.error || "Invalid selection")
        return
      }
    }

    props.onSelect(props.multiple ? value : value[0])
    props.onClose()
  }

  const cancel = () => {
    setSelected(new Set<string>())
    setError(undefined)
    props.onClose()
  }

  return (
    <Dialog
      title={props.title}
      action={<IconButton icon="close" variant="ghost" onClick={() => dialog.close()} />}
      class="w-full max-w-[560px] max-h-[60vh] mx-auto flex flex-col"
    >
      <div class="flex flex-col gap-3 p-4 min-h-0 flex-1">
        <div class="flex items-center gap-2 shrink-0">
          <Button variant="ghost" onClick={up} disabled={cwd() === "/"} class="shrink-0 px-2">
            <Icon name="arrow-up" size="small" />
          </Button>
          <div class="text-12-regular text-text-weak truncate flex-1">{cwd()}</div>
        </div>

        <div class="shrink-0">
          <TextField
            label={language.t("pathPicker.search")}
            placeholder={language.t("pathPicker.search.placeholder")}
            value={filter()}
            onChange={setFilter}
            autoFocus
          />
        </div>

        <List
          class="flex-1 min-h-0 [&_[data-slot=list-scroll]]:flex-1 [&_[data-slot=list-scroll]]:min-h-0"
          items={list}
          key={(item) => item.path}
          emptyMessage={language.t("pathPicker.empty")}
          loadingMessage={language.t("pathPicker.loading")}
          onSelect={(item) => item && click(item)}
        >
          {(item) => (
            <div
              class={`w-full flex items-center gap-3 cursor-pointer rounded-md px-2 py-1 transition-colors ${
                selected().has(item.path) ? "bg-surface-weak" : ""
              }`}
              onDblClick={() => dblclick(item)}
            >
              <FileIcon node={{ path: item.path, type: item.type }} class="shrink-0 size-4" />
              <div class="flex items-center text-14-regular min-w-0 gap-1">
                <span class="text-text-weak truncate">
                  {(() => {
                    const query = clean(filter())
                    if (!query) return getFilename(item.path)
                    const base = cwd()
                    const prefix = base.endsWith("/") ? base : base + "/"
                    return item.path.startsWith(prefix) ? item.path.slice(prefix.length) : getFilename(item.path)
                  })()}
                </span>
                <Show when={item.type === "directory"}>
                  <span class="text-text-weak text-11-regular">/</span>
                </Show>
              </div>
            </div>
          )}
        </List>

        <Show when={error()}>
          <div class="text-12-regular text-icon-critical-base px-2">{error()}</div>
        </Show>
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={cancel}>
            {language.t("pathPicker.cancel")}
          </Button>
          <Button onClick={confirm} disabled={selected().size === 0 || validating() || !!error()}>
            {validating()
              ? language.t("pathPicker.validating")
              : language.t("pathPicker.confirm", { count: String(selected().size) })}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
