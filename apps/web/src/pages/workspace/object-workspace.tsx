import { For, Show, type JSX } from "solid-js"
import { A } from "@solidjs/router"

export type Crumb = {
  label: string
  href?: string
}

export type ObjectWorkspaceProps = {
  kind: string
  id: string
  breadcrumb?: Crumb[]
  title: string | JSX.Element
  subtitle?: string | JSX.Element
  status?: JSX.Element
  meta?: JSX.Element
  actions?: JSX.Element
  main: JSX.Element
  rail?: JSX.Element
  readonly?: boolean
  publishSlot?: JSX.Element
  backHref?: string
  backLabel?: string
}

export function ObjectWorkspace(props: ObjectWorkspaceProps): JSX.Element {
  return (
    <div
      class="flex h-full flex-col bg-background-base"
      data-component="object-workspace"
      data-entity={props.kind}
      data-entity-id={props.id}
      data-readonly={props.readonly ? "true" : "false"}
    >
      <header
        class="shrink-0 border-b border-border-weak-base px-6 py-4"
        data-component="object-workspace-header"
      >
        <Show when={props.backHref || (props.breadcrumb && props.breadcrumb.length > 0)}>
          <div class="flex items-center gap-2 text-11-regular text-text-weak">
            <Show when={props.backHref}>
              {(href) => (
                <A href={href()} class="hover:text-text-strong" data-component="object-workspace-back">
                  <span aria-hidden>←</span>
                  <span class="ml-1">{props.backLabel ?? "Back"}</span>
                </A>
              )}
            </Show>
            <Show when={props.breadcrumb && props.breadcrumb.length > 0}>
              <For each={props.breadcrumb}>
                {(crumb, index) => (
                  <>
                    <Show when={index() > 0 || props.backHref}>
                      <span class="text-text-weak">/</span>
                    </Show>
                    <Show
                      when={crumb.href}
                      fallback={<span>{crumb.label}</span>}
                    >
                      {(href) => (
                        <A href={href()} class="hover:text-text-strong">
                          {crumb.label}
                        </A>
                      )}
                    </Show>
                  </>
                )}
              </For>
            </Show>
          </div>
        </Show>

        <div class="mt-1 flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline gap-3">
              <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">{props.kind}</div>
              <Show when={props.status}>{(status) => status()}</Show>
              <Show when={props.readonly}>
                <span
                  class="text-10-medium uppercase tracking-wide text-text-weak"
                  data-component="readonly-badge"
                >
                  view-only
                </span>
              </Show>
            </div>
            <h1
              class="mt-1 text-20-medium text-text-strong"
              data-component="object-workspace-title"
            >
              {props.title}
            </h1>
            <Show when={props.subtitle}>
              <div class="mt-1 text-12-regular text-text-weak">{props.subtitle}</div>
            </Show>
            <Show when={props.meta}>
              <div class="mt-1 text-11-regular text-text-weak">{props.meta}</div>
            </Show>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <Show when={props.publishSlot}>{(slot) => slot()}</Show>
            <Show when={props.actions}>{(actions) => actions()}</Show>
          </div>
        </div>
      </header>

      <div class="flex min-h-0 flex-1">
        <div
          class="min-w-0 flex-1 overflow-y-auto px-6 py-6"
          data-component="object-workspace-main"
        >
          {props.main}
        </div>

        <Show when={props.rail}>
          {(rail) => (
            <aside
              class="hidden w-80 shrink-0 overflow-y-auto border-l border-border-weak-base bg-surface-raised-base/40 px-4 py-4 lg:block"
              data-component="object-workspace-rail"
            >
              {rail()}
            </aside>
          )}
        </Show>
      </div>
    </div>
  )
}

export type RailSectionProps = {
  title: string
  children: JSX.Element
  empty?: string
  count?: number
  action?: JSX.Element
}

export function RailSection(props: RailSectionProps): JSX.Element {
  return (
    <section class="mb-5" data-component="rail-section" data-title={props.title}>
      <div class="flex items-center justify-between">
        <div class="flex items-baseline gap-2 text-11-medium uppercase tracking-wide text-text-weak">
          <span>{props.title}</span>
          <Show when={typeof props.count === "number"}>
            <span class="text-text-weak">{props.count}</span>
          </Show>
        </div>
        <Show when={props.action}>{(slot) => slot()}</Show>
      </div>
      <div class="mt-2 flex flex-col gap-2 text-12-regular text-text-strong">
        {props.children}
      </div>
    </section>
  )
}

export function RailLink(props: {
  href: string
  label: string | JSX.Element
  hint?: string | JSX.Element
  badge?: string
}): JSX.Element {
  return (
    <A
      href={props.href}
      class="block rounded-lg bg-background-base px-3 py-2 hover:bg-surface-raised-base-hover"
      data-component="rail-link"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="truncate text-12-medium text-text-strong">{props.label}</span>
        <Show when={props.badge}>
          <span class="text-10-medium uppercase tracking-wide text-text-weak">{props.badge}</span>
        </Show>
      </div>
      <Show when={props.hint}>
        <div class="mt-0.5 text-11-regular text-text-weak">{props.hint}</div>
      </Show>
    </A>
  )
}
