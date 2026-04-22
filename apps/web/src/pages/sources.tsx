import { createMemo, createSignal, For, Match, Show, Switch, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import type { DomainNode, FileNode } from "@palimpsest/sdk/v2"
import { Button } from "@palimpsest/ui/button"
import { base64Decode, base64Encode } from "@palimpsest/shared/encode"

import { useSDK } from "@/context/sdk"
import { EntityTab } from "./tab/entity-tab"

type SourceItem =
  | { origin: "node"; id: string; title: string; node: DomainNode }
  | { origin: "file"; id: string; title: string; file: FileNode }

const SOURCES_DIR = ".palimpsest/sources"

function decodeFileParam(raw?: string): string | undefined {
  if (!raw) return undefined
  try {
    return base64Decode(raw)
  } catch {
    return undefined
  }
}

export default function Sources(): JSX.Element {
  const sdk = useSDK()
  const navigate = useNavigate()
  const params = useParams<{ dir: string; sourceID?: string; filePath?: string }>()

  const [version, setVersion] = createSignal(0)
  const selectedFilePath = createMemo(() => decodeFileParam(params.filePath))
  const selectedID = createMemo(() => {
    const file = selectedFilePath()
    if (file) return `file:${file}`
    if (params.sourceID) return `node:${params.sourceID}`
    return undefined
  })

  async function fetch() {
    const [nodeRes, fileRes] = await Promise.all([
      sdk.client.domain.node.list({ kind: "source" }),
      sdk.client.file
        .list({ path: SOURCES_DIR })
        .then((r) => r.data ?? [])
        .catch(() => [] as FileNode[]),
    ])
    const nodes: SourceItem[] = (nodeRes.data ?? []).map((node) => ({
      origin: "node" as const,
      id: `node:${node.id}`,
      title: node.title,
      node,
    }))
    const files: SourceItem[] = fileRes
      .filter((entry) => entry.type === "file")
      .map((file) => ({
        origin: "file" as const,
        id: `file:${file.path}`,
        title: file.name,
        file,
      }))
    const items = [...nodes, ...files].sort((a, b) => a.title.localeCompare(b.title))
    return { items, kinds: [] as string[] }
  }

  function select(id: string) {
    if (id.startsWith("node:")) {
      navigate(`/${params.dir}/sources/${id.slice("node:".length)}`)
      return
    }
    if (id.startsWith("file:")) {
      const path = id.slice("file:".length)
      navigate(`/${params.dir}/sources/file/${base64Encode(path)}`)
    }
  }

  return (
    <EntityTab<SourceItem>
      title="Sources"
      subtitle="Evidence and reference anchors"
      emptyMessage={`No sources yet. Drop markdown into ${SOURCES_DIR} or propose a source node from the Reviews tab.`}
      selectedID={selectedID()}
      onSelect={select}
      version={version}
      entityKind="source"
      groupItems={(items) => {
        const nodes = items.filter((item) => item.origin === "node")
        const files = items.filter((item) => item.origin === "file")
        return [
          { label: "Accepted sources", items: nodes },
          { label: `Unclaimed in ${SOURCES_DIR}`, items: files },
        ]
      }}
      headerActions={
        <Button variant="primary" size="small" onClick={() => navigate(`/${params.dir}/reviews`)}>
          Propose source
        </Button>
      }
      fetch={fetch}
      itemID={(item) => item.id}
      itemTitle={(item) => item.title}
      itemBadge={(item) => (item.origin === "node" ? "node" : "file")}
      itemSubtitle={(item) => (
        <span>
          <Switch>
            <Match when={item.origin === "node"}>{(item as { node: DomainNode }).node?.id ?? ""}</Match>
            <Match when={item.origin === "file"}>{(item as { file: FileNode }).file?.path ?? ""}</Match>
          </Switch>
        </span>
      )}
      detail={(item) => (
        <Switch>
          <Match when={item.origin === "node"}>
            <NodeDetail source={item as Extract<SourceItem, { origin: "node" }>} />
          </Match>
          <Match when={item.origin === "file"}>
            <FileDetail
              source={item as Extract<SourceItem, { origin: "file" }>}
              onPropose={(path) =>
                navigate(`/${params.dir}/reviews?prefill_source=${encodeURIComponent(path)}`)
              }
              onRefresh={() => setVersion((v) => v + 1)}
            />
          </Match>
        </Switch>
      )}
    />
  )
}

function NodeDetail(props: { source: Extract<SourceItem, { origin: "node" }> }): JSX.Element {
  return (
    <>
      <div>
        <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Source</div>
        <h1 class="mt-1 text-20-medium text-text-strong">{props.source.node.title}</h1>
        <div class="mt-1 text-11-regular text-text-weak">{props.source.node.id}</div>
      </div>

      <Show when={props.source.node.body}>
        <div class="mt-4 rounded-lg bg-surface-raised-base px-4 py-3 text-13-regular text-text-strong whitespace-pre-wrap">
          {props.source.node.body}
        </div>
      </Show>

      <Show when={props.source.node.data}>
        <div class="mt-4">
          <div class="text-11-medium uppercase tracking-wide text-text-weak">Metadata</div>
          <pre class="mt-2 overflow-x-auto rounded-lg bg-surface-raised-base px-3 py-2 text-11-regular text-text-weak">
            {JSON.stringify(props.source.node.data, null, 2)}
          </pre>
        </div>
      </Show>

      <div class="mt-6 text-11-regular text-text-weak">
        Created {new Date(props.source.node.time.created).toLocaleString()} · Updated{" "}
        {new Date(props.source.node.time.updated).toLocaleString()}
      </div>
    </>
  )
}

function FileDetail(props: {
  source: Extract<SourceItem, { origin: "file" }>
  onPropose: (path: string) => void
  onRefresh: () => void
}): JSX.Element {
  const sdk = useSDK()
  const [content, setContent] = createSignal<string | undefined>(undefined)
  const [loading, setLoading] = createSignal(false)
  const [err, setErr] = createSignal<string | undefined>(undefined)

  async function loadContent() {
    setLoading(true)
    setErr(undefined)
    try {
      const res = await sdk.client.file.read({ path: props.source.file.path })
      const body = res.data
      const text =
        typeof body === "string"
          ? body
          : body && typeof body === "object" && "content" in body
            ? String((body as { content: unknown }).content)
            : undefined
      setContent(text)
    } catch (error) {
      setErr(String((error as Error).message ?? error))
    } finally {
      setLoading(false)
    }
  }

  loadContent()

  return (
    <>
      <div>
        <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Unclaimed source file</div>
        <h1 class="mt-1 text-20-medium text-text-strong">{props.source.file.name}</h1>
        <div class="mt-1 text-11-regular text-text-weak">{props.source.file.path}</div>
      </div>

      <div class="mt-4 rounded-lg border border-border-weak-base px-4 py-3 text-12-regular text-text-weak" data-component="file-source-hint">
        This file lives in {SOURCES_DIR} but has no corresponding source node in the domain graph yet. Propose it to
        anchor references and citations.
      </div>

      <div class="mt-4 flex items-center gap-2">
        <Button
          variant="primary"
          size="small"
          data-action="propose-source"
          onClick={() => props.onPropose(props.source.file.path)}
        >
          Propose as source
        </Button>
        <Button variant="secondary" size="small" data-action="reload" onClick={() => { loadContent(); props.onRefresh() }}>
          Reload
        </Button>
      </div>

      <Switch
        fallback={
          <div class="mt-4 rounded-lg bg-surface-raised-base px-3 py-2 text-11-regular text-text-weak">
            Read the file to preview it here.
          </div>
        }
      >
        <Match when={loading()}>
          <div class="mt-4 text-12-regular text-text-weak">Loading...</div>
        </Match>
        <Match when={err()}>
          <div class="mt-4 rounded-lg bg-surface-raised-base px-3 py-2 text-12-regular text-text-weak">
            Failed to read: {err()}
          </div>
        </Match>
        <Match when={content() !== undefined}>
          <pre
            class="mt-4 max-h-96 overflow-auto rounded-lg bg-surface-raised-base px-3 py-2 text-11-regular text-text-strong"
            data-component="file-source-preview"
          >
            {content()}
          </pre>
        </Match>
      </Switch>
    </>
  )
}
