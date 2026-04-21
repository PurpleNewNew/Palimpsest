import { createResource, Match, Show, Switch, type JSX } from "solid-js"
import type { DomainArtifact } from "@palimpsest/sdk/v2"
import { Spinner } from "@palimpsest/ui/spinner"

import { useSDK } from "@/context/sdk"

function localPath(uri: string | undefined): string | undefined {
  if (!uri) return undefined
  if (uri.startsWith("file://")) return uri.slice("file://".length)
  if (uri.startsWith("/")) return uri
  return undefined
}

function classify(mime: string | undefined): "text" | "json" | "image" | "binary" | "unknown" {
  if (!mime) return "unknown"
  if (mime === "application/json") return "json"
  if (mime.startsWith("text/")) return "text"
  if (mime.startsWith("image/")) return "image"
  return "binary"
}

function formatJSON(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

export function ArtifactPreview(props: { artifact: DomainArtifact }): JSX.Element {
  const sdk = useSDK()
  const kind = () => classify(props.artifact.mimeType)
  const path = () => localPath(props.artifact.storageURI)
  const canFetch = () => (kind() === "text" || kind() === "json" || kind() === "image") && path() !== undefined

  const [content] = createResource(
    () => (canFetch() ? { path: path()!, kind: kind() } : null),
    async (target) => {
      if (!target) return undefined
      const res = await sdk.client.file.read({ path: target.path })
      const data = res.data as unknown
      // file.read returns an object with a string payload — keep it flexible
      if (typeof data === "string") return data
      if (data && typeof data === "object" && "content" in data) return String((data as { content: unknown }).content)
      return undefined
    },
  )

  return (
    <div class="mt-4 rounded-lg bg-surface-raised-base px-4 py-3" data-component="artifact-preview" data-preview-kind={kind()}>
      <div class="flex items-center justify-between text-11-regular uppercase tracking-wide text-text-weak">
        <span>Preview</span>
        <span>{props.artifact.mimeType ?? "unknown mime"}</span>
      </div>

      <Switch
        fallback={
          <div class="mt-2 text-12-regular text-text-weak">
            No preview available for this MIME type. Storage URI: {props.artifact.storageURI ?? "—"}
          </div>
        }
      >
        <Match when={!props.artifact.storageURI}>
          <div class="mt-2 text-12-regular text-text-weak" data-component="artifact-preview-empty">
            This artifact has no storage URI. Attach one in a follow-up proposal to preview its content.
          </div>
        </Match>
        <Match when={kind() === "binary"}>
          <div class="mt-2 text-12-regular text-text-weak">
            Binary artifact. Download from {props.artifact.storageURI}.
          </div>
        </Match>
        <Match when={kind() === "image"}>
          <div class="mt-2 flex items-center justify-center rounded-md bg-background-base p-3">
            <Show
              when={path()}
              fallback={
                <div class="text-12-regular text-text-weak">
                  Remote image preview not available. URI: {props.artifact.storageURI}
                </div>
              }
            >
              {(p) => <img class="max-h-96 max-w-full rounded-md" src={`file://${p()}`} alt={props.artifact.title ?? ""} />}
            </Show>
          </div>
        </Match>
        <Match when={content.loading}>
          <div class="mt-2 flex items-center gap-2 text-12-regular text-text-weak">
            <Spinner class="size-4" /> Loading content...
          </div>
        </Match>
        <Match when={content.error}>
          <div class="mt-2 text-12-regular text-text-weak">
            Failed to read content from {path()}. {String((content.error as Error).message ?? content.error)}
          </div>
        </Match>
        <Match when={content() !== undefined && kind() === "text"}>
          <pre
            class="mt-2 max-h-96 overflow-auto rounded-md bg-background-base px-3 py-2 text-11-regular text-text-strong"
            data-component="artifact-preview-text"
          >
            {content()}
          </pre>
        </Match>
        <Match when={content() !== undefined && kind() === "json"}>
          <pre
            class="mt-2 max-h-96 overflow-auto rounded-md bg-background-base px-3 py-2 text-11-regular text-text-strong"
            data-component="artifact-preview-json"
          >
            {formatJSON(content()!)}
          </pre>
        </Match>
      </Switch>
    </div>
  )
}
