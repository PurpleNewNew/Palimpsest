import { createMemo, createResource, For, Match, Show, Switch, type Accessor, type JSX } from "solid-js"
import { Spinner } from "@palimpsest/ui/spinner"

export type EntityTabProps<T> = {
  title: string
  subtitle?: string
  headerActions?: JSX.Element
  emptyMessage?: string
  selectedID?: string
  onSelect?: (id: string) => void
  fetch: () => Promise<{ items: T[]; kinds: string[] }>
  version?: Accessor<number>
  filter?: { label: string; value: string; onChange: (value: string) => void; options: { label: string; value: string }[] }
  itemID: (item: T) => string
  itemTitle: (item: T) => string
  itemSubtitle?: (item: T) => JSX.Element
  itemBadge?: (item: T) => string | undefined
  detail: (item: T) => JSX.Element
}

export function EntityTab<T>(props: EntityTabProps<T>) {
  const [data] = createResource(
    () => props.version?.() ?? 0,
    async () => {
      return props.fetch()
    },
  )

  const items = createMemo(() => data()?.items ?? [])

  const selected = createMemo(() => {
    const id = props.selectedID
    const list = items()
    if (!id) return list[0]
    return list.find((item) => props.itemID(item) === id) ?? list[0]
  })

  return (
    <div class="flex h-full flex-col bg-background-base">
      <div class="flex items-center justify-between border-b border-border-weak-base px-6 py-4">
        <div>
          <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">{props.subtitle ?? "Core tab"}</div>
          <div class="mt-1 text-20-medium text-text-strong">{props.title}</div>
        </div>
        <div class="flex items-center gap-2">
          <Show when={props.filter}>
            {(f) => (
              <label class="flex items-center gap-2 text-11-regular text-text-weak">
                {f().label}
                <select
                  class="rounded-md border border-border-weak-base bg-background-base px-2 py-1 text-12-regular text-text-strong"
                  value={f().value}
                  onChange={(event) => f().onChange(event.currentTarget.value)}
                >
                  <For each={f().options}>{(opt) => <option value={opt.value}>{opt.label}</option>}</For>
                </select>
              </label>
            )}
          </Show>
          {props.headerActions}
        </div>
      </div>

      <div class="flex min-h-0 flex-1">
        <div class="w-80 shrink-0 overflow-y-auto border-r border-border-weak-base">
          <Switch>
            <Match when={data.loading}>
              <div class="flex items-center justify-center py-8">
                <Spinner class="size-4" />
              </div>
            </Match>
            <Match when={data.error}>
              <div class="px-4 py-8 text-center text-12-regular text-text-weak">
                Failed to load. {String((data.error as Error).message ?? data.error)}
              </div>
            </Match>
            <Match when={items().length === 0}>
              <div class="px-4 py-8 text-center text-12-regular text-text-weak">
                {props.emptyMessage ?? "Nothing here yet."}
              </div>
            </Match>
            <Match when={true}>
              <ul>
                <For each={items()}>
                  {(item) => {
                    const id = props.itemID(item)
                    const isActive = () => (selected() ? props.itemID(selected() as T) === id : false)
                    return (
                      <li>
                        <button
                          type="button"
                          class={`flex w-full flex-col gap-1 border-b border-border-weak-base px-4 py-3 text-left hover:bg-surface-raised-base ${isActive() ? "bg-surface-raised-base" : ""}`}
                          onClick={() => props.onSelect?.(id)}
                        >
                          <div class="flex items-center justify-between gap-2">
                            <span class="truncate text-12-medium text-text-strong">{props.itemTitle(item)}</span>
                            <Show when={props.itemBadge?.(item)}>
                              {(badge) => (
                                <span class="text-10-medium uppercase tracking-wide text-text-weak">{badge()}</span>
                              )}
                            </Show>
                          </div>
                          <Show when={props.itemSubtitle}>
                            <div class="text-11-regular text-text-weak">{props.itemSubtitle!(item)}</div>
                          </Show>
                        </button>
                      </li>
                    )
                  }}
                </For>
              </ul>
            </Match>
          </Switch>
        </div>

        <div class="flex-1 overflow-y-auto">
          <Show
            when={selected()}
            fallback={<div class="p-8 text-12-regular text-text-weak">Select an item to inspect it.</div>}
          >
            {(current) => <div class="mx-auto max-w-3xl px-6 py-6">{props.detail(current() as T)}</div>}
          </Show>
        </div>
      </div>
    </div>
  )
}
