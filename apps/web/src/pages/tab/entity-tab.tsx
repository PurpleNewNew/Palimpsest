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
  /**
   * Optional grouping. Items get bucketed into ordered groups by label;
   * each group gets a sticky header above its items. Group order is
   * controlled by the returned array order.
   */
  groupItems?: (items: T[]) => Array<{ label: string; items: T[] }>
  entityKind?: string
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

  const groups = createMemo(() => {
    const list = items()
    if (!props.groupItems) return [{ label: "", items: list }]
    return props.groupItems(list)
  })

  const entityKind = () => props.entityKind ?? "entity"

  return (
    <div class="flex h-full flex-col bg-background-base" data-component="entity-tab" data-entity={entityKind()}>
      <div class="flex items-center justify-between border-b border-border-weak-base px-6 py-4">
        <div>
          <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">{props.subtitle ?? "Core tab"}</div>
          <div class="mt-1 text-20-medium text-text-strong" data-component="entity-title">
            {props.title}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Show when={props.filter}>
            {(f) => (
              <label class="flex items-center gap-2 text-11-regular text-text-weak">
                {f().label}
                <select
                  data-field={`filter-${entityKind()}`}
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
        <div
          class="w-80 shrink-0 overflow-y-auto border-r border-border-weak-base"
          data-component="entity-list"
        >
          <Switch>
            <Match when={data.loading}>
              <div class="flex items-center justify-center py-8" data-component="entity-list-loading">
                <Spinner class="size-4" />
              </div>
            </Match>
            <Match when={data.error}>
              <div
                class="px-4 py-8 text-center text-12-regular text-text-weak"
                data-component="entity-list-error"
              >
                Failed to load. {String((data.error as Error).message ?? data.error)}
              </div>
            </Match>
            <Match when={items().length === 0}>
              <div
                class="px-4 py-8 text-center text-12-regular text-text-weak"
                data-component="entity-list-empty"
              >
                {props.emptyMessage ?? "Nothing here yet."}
              </div>
            </Match>
            <Match when={true}>
              <For each={groups()}>
                {(group) => (
                  <Show
                    when={group.items.length > 0}
                    fallback={null}
                  >
                    <div data-component="entity-group" data-group-label={group.label}>
                      <Show when={group.label}>
                        <div class="sticky top-0 z-10 bg-background-base px-4 py-1 text-10-medium uppercase tracking-wider text-text-weak">
                          {group.label}
                        </div>
                      </Show>
                      <ul>
                        <For each={group.items}>
                          {(item) => {
                            const id = props.itemID(item)
                            const isActive = () => (selected() ? props.itemID(selected() as T) === id : false)
                            return (
                              <li>
                                <button
                                  type="button"
                                  data-component="entity-item"
                                  data-entity-id={id}
                                  class={`flex w-full flex-col gap-1 border-b border-border-weak-base px-4 py-3 text-left hover:bg-surface-raised-base ${isActive() ? "bg-surface-raised-base" : ""}`}
                                  onClick={() => props.onSelect?.(id)}
                                >
                                  <div class="flex items-center justify-between gap-2">
                                    <span class="truncate text-12-medium text-text-strong">{props.itemTitle(item)}</span>
                                    <Show when={props.itemBadge?.(item)}>
                                      {(badge) => (
                                        <span class="text-10-medium uppercase tracking-wide text-text-weak">
                                          {badge()}
                                        </span>
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
                    </div>
                  </Show>
                )}
              </For>
            </Match>
          </Switch>
        </div>

        <div class="flex-1 overflow-y-auto" data-component="entity-detail">
          <Show
            when={selected()}
            fallback={
              <div class="p-8 text-12-regular text-text-weak" data-component="entity-detail-empty">
                Select an item to inspect it.
              </div>
            }
          >
            {(current) => (
              <div
                class="mx-auto max-w-3xl px-6 py-6"
                data-entity-id={props.itemID(current() as T)}
              >
                {props.detail(current() as T)}
              </div>
            )}
          </Show>
        </div>
      </div>
    </div>
  )
}

/**
 * Group items by a time-bucket relative to now: Today / Yesterday /
 * This week / Earlier. Callers supply the `timeOf` accessor and the
 * function returns a stable ordered group list.
 */
export function groupByTime<T>(
  list: T[],
  timeOf: (item: T) => number,
): Array<{ label: string; items: T[] }> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfDay - 24 * 60 * 60 * 1000
  const startOfWeek = startOfDay - 7 * 24 * 60 * 60 * 1000

  const buckets = new Map<string, T[]>([
    ["Today", []],
    ["Yesterday", []],
    ["This week", []],
    ["Earlier", []],
  ])

  for (const item of list) {
    const t = timeOf(item)
    if (t >= startOfDay) buckets.get("Today")!.push(item)
    else if (t >= startOfYesterday) buckets.get("Yesterday")!.push(item)
    else if (t >= startOfWeek) buckets.get("This week")!.push(item)
    else buckets.get("Earlier")!.push(item)
  }

  return Array.from(buckets.entries()).map(([label, items]) => ({ label, items }))
}
