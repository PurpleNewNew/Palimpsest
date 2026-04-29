import { For, Show } from "solid-js"
import type { PermissionRequest } from "@palimpsest/sdk/v2/client"
import { Button } from "@palimpsest/ui/button"
import { DockPrompt } from "@palimpsest/ui/dock-prompt"
import { Icon } from "@palimpsest/ui/icon"

import { usePluginWebHost } from "../../../host-web"

/**
 * Permission dock for the session composer. Renders the inline UI
 * for an incoming `PermissionRequest`, offering Allow once / Allow
 * always / Deny actions through `onDecide`.
 *
 * Migrated from `apps/web/src/pages/session/composer/session-permission-dock.tsx`
 * in Phase 2.6 of host context promotion. The single host
 * dependency (`useLanguage` for i18n strings) is now reached through
 * `usePluginWebHost().language()` so the dock can ship with chat to
 * any lens that mounts a PluginWebHostProvider.
 */
export function SessionPermissionDock(props: {
  request: PermissionRequest
  responding: boolean
  onDecide: (response: "once" | "always" | "reject") => void
}) {
  const language = usePluginWebHost().language()

  const toolDescription = () => {
    const key = `settings.permissions.tool.${props.request.permission}.description`
    const value = language.t(key)
    if (value === key) return ""
    return value
  }

  return (
    <DockPrompt
      kind="permission"
      header={
        <div data-slot="permission-row" data-variant="header">
          <span data-slot="permission-icon">
            <Icon name="warning" size="normal" />
          </span>
          <div data-slot="permission-header-title">{language.t("notification.permission.title")}</div>
        </div>
      }
      footer={
        <>
          <div />
          <div data-slot="permission-footer-actions">
            <Button variant="ghost" size="normal" onClick={() => props.onDecide("reject")} disabled={props.responding}>
              {language.t("ui.permission.deny")}
            </Button>
            <Button
              variant="secondary"
              size="normal"
              onClick={() => props.onDecide("always")}
              disabled={props.responding}
            >
              {language.t("ui.permission.allowAlways")}
            </Button>
            <Button variant="primary" size="normal" onClick={() => props.onDecide("once")} disabled={props.responding}>
              {language.t("ui.permission.allowOnce")}
            </Button>
          </div>
        </>
      }
    >
      <Show when={toolDescription()}>
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-hint">{toolDescription()}</div>
        </div>
      </Show>

      <Show when={props.request.patterns.length > 0}>
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-patterns">
            <For each={props.request.patterns}>
              {(pattern) => <code class="text-12-regular text-text-base break-all">{pattern}</code>}
            </For>
          </div>
        </div>
      </Show>
    </DockPrompt>
  )
}
