import { createResource, createSignal, Match, Show, Switch, type JSX } from "solid-js"
import { Button } from "@palimpsest/ui/button"
import { Spinner } from "@palimpsest/ui/spinner"
import { showToast } from "@palimpsest/ui/toast"

import { useAuth } from "@/context/auth"
import { useCanWrite } from "@/context/permissions"
import { usePhase7, type ShareEntityKind } from "@/context/phase7"

export function PublishButton(props: {
  entityKind: ShareEntityKind
  entityID: string
  directory?: string
}): JSX.Element {
  const auth = useAuth()
  const canWrite = useCanWrite()
  const phase7 = usePhase7(() => props.directory)

  const [version, setVersion] = createSignal(0)

  const [share] = createResource(
    () => [version(), props.entityKind, props.entityID, auth.workspaceID()] as const,
    async ([, kind, id, workspaceID]) => {
      if (!workspaceID) return null
      const list = await phase7.shares(workspaceID).catch(() => [])
      return list.find((item) => item.entityKind === kind && item.entityID === id) ?? null
    },
  )

  const [busy, setBusy] = createSignal(false)

  async function publish() {
    if (busy()) return
    setBusy(true)
    try {
      const result = await phase7.publishEntity(props.entityKind, props.entityID)
      setVersion((v) => v + 1)
      showToast({ variant: "success", title: "Published", description: result.url })
    } catch (err) {
      showToast({
        variant: "error",
        title: "Publish failed",
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusy(false)
    }
  }

  async function unpublish() {
    if (busy()) return
    setBusy(true)
    try {
      await phase7.unpublishEntity(props.entityKind, props.entityID)
      setVersion((v) => v + 1)
      showToast({ variant: "default", title: "Unpublished" })
    } catch (err) {
      showToast({
        variant: "error",
        title: "Unpublish failed",
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusy(false)
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      showToast({ variant: "default", title: "Link copied" })
    } catch {
      showToast({ variant: "error", title: "Copy failed", description: "Clipboard unavailable." })
    }
  }

  return (
    <Switch>
      <Match when={share.loading && share() === undefined}>
        <span data-component="publish-button-loading">
          <Spinner class="size-4" />
        </span>
      </Match>
      <Match when={share()}>
        {(current) => (
          <div class="flex items-center gap-1" data-component="publish-button" data-published="true">
            <button
              type="button"
              class="rounded-md bg-surface-raised-base px-3 py-1 text-11-regular text-text-strong hover:bg-surface-raised-base-hover"
              data-action="copy-share-link"
              onClick={() => copyLink(current().url)}
            >
              Copy link
            </button>
            <Show when={canWrite()}>
              <Button
                variant="secondary"
                size="small"
                data-action="unpublish"
                disabled={busy()}
                onClick={unpublish}
              >
                Unpublish
              </Button>
            </Show>
          </div>
        )}
      </Match>
      <Match when={canWrite()}>
        <Button
          variant="secondary"
          size="small"
          data-action="publish"
          data-component="publish-button"
          data-published="false"
          disabled={busy()}
          onClick={publish}
        >
          Publish
        </Button>
      </Match>
    </Switch>
  )
}
