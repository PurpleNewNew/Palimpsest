import { For, Match, Show, Switch, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import type { DomainChange } from "@palimpsest/sdk/v2"

type LabelPair = {
  label: string
  value: string
  href?: string
}

function entityRef(op: string): { entity: string; action: "create" | "update" | "delete" } | undefined {
  const [action, ...rest] = op.split("_")
  const entity = rest.join("_")
  if (action !== "create" && action !== "update" && action !== "delete") return undefined
  return { entity, action }
}

function tone(action: "create" | "update" | "delete") {
  if (action === "create") return "text-icon-success-base"
  if (action === "delete") return "text-icon-critical-base"
  return "text-text-interactive-base"
}

function actionLabel(action: "create" | "update" | "delete") {
  if (action === "create") return "Create"
  if (action === "update") return "Update"
  return "Delete"
}

function tabFor(entity: string): string | undefined {
  if (entity === "node") return "nodes"
  if (entity === "edge") return "nodes"
  if (entity === "run") return "runs"
  if (entity === "artifact") return "artifacts"
  if (entity === "decision") return "decisions"
  return undefined
}

function refLink(params: { dir: string }, entity: string, id: string): string | undefined {
  const tab = tabFor(entity)
  if (!tab) return undefined
  if (entity === "edge") return undefined
  return `/${params.dir}/${tab}/${id}`
}

function rowsFor(change: DomainChange, params: { dir: string }): LabelPair[] {
  const rows: LabelPair[] = []
  const c = change as Record<string, unknown>

  if (typeof c.id === "string") rows.push({ label: "ID", value: c.id })
  if (typeof c.kind === "string") rows.push({ label: "Kind", value: c.kind })
  if (typeof c.title === "string") rows.push({ label: "Title", value: c.title })
  if (typeof c.state === "string") rows.push({ label: "State", value: c.state })
  if (typeof c.status === "string") rows.push({ label: "Status", value: c.status })

  if (typeof c.sourceID === "string") {
    rows.push({ label: "Source", value: c.sourceID, href: refLink(params, "node", c.sourceID) })
  }
  if (typeof c.targetID === "string") {
    rows.push({ label: "Target", value: c.targetID, href: refLink(params, "node", c.targetID) })
  }
  if (typeof c.nodeID === "string") {
    rows.push({ label: "Node", value: c.nodeID, href: refLink(params, "node", c.nodeID) })
  }
  if (typeof c.runID === "string") {
    rows.push({ label: "Run", value: c.runID, href: refLink(params, "run", c.runID) })
  }
  if (typeof c.artifactID === "string") {
    rows.push({ label: "Artifact", value: c.artifactID, href: refLink(params, "artifact", c.artifactID) })
  }
  if (typeof c.supersededBy === "string") {
    rows.push({
      label: "Supersedes",
      value: c.supersededBy,
      href: refLink(params, "decision", c.supersededBy),
    })
  }
  if (typeof c.sessionID === "string") rows.push({ label: "Session", value: c.sessionID })
  if (typeof c.mimeType === "string") rows.push({ label: "MIME", value: c.mimeType })
  if (typeof c.storageURI === "string") rows.push({ label: "Storage", value: c.storageURI })
  if (typeof c.note === "string") rows.push({ label: "Note", value: c.note })

  return rows
}

function blocksFor(change: DomainChange): Array<{ label: string; value: unknown }> {
  const c = change as Record<string, unknown>
  const out: Array<{ label: string; value: unknown }> = []
  if (typeof c.body === "string") out.push({ label: "Body", value: c.body })
  if (typeof c.rationale === "string") out.push({ label: "Rationale", value: c.rationale })
  if (c.data !== undefined && c.data !== null) out.push({ label: "Data", value: c.data })
  if (c.manifest !== undefined && c.manifest !== null) out.push({ label: "Manifest", value: c.manifest })
  if (c.provenance !== undefined && c.provenance !== null) out.push({ label: "Provenance", value: c.provenance })
  if (c.refs !== undefined && c.refs !== null) out.push({ label: "Refs", value: c.refs })
  if (c.actor !== undefined && c.actor !== null) out.push({ label: "Actor", value: c.actor })
  return out
}

export function ChangeView(props: { change: DomainChange }): JSX.Element {
  const navigate = useNavigate()
  const params = useParams()

  const ref = () => entityRef(props.change.op)
  const rows = () => rowsFor(props.change, { dir: params.dir ?? "" })
  const blocks = () => blocksFor(props.change)

  return (
    <div
      class="rounded-lg bg-surface-raised-base px-3 py-2 text-12-regular text-text-strong"
      data-component="change-view"
      data-op={props.change.op}
    >
      <div class="flex items-center gap-2">
        <Show when={ref()}>
          {(r) => (
            <>
              <span class={`text-11-medium uppercase tracking-wide ${tone(r().action)}`}>
                {actionLabel(r().action)}
              </span>
              <span class="text-12-medium text-text-strong">{r().entity}</span>
            </>
          )}
        </Show>
        <Show when={!ref()}>
          <span class="text-12-medium text-text-weak">{props.change.op}</span>
        </Show>
      </div>

      <Show when={rows().length > 0}>
        <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <For each={rows()}>
            {(row) => (
              <>
                <dt class="text-11-regular uppercase tracking-wide text-text-weak">{row.label}</dt>
                <dd class="truncate text-12-regular text-text-strong">
                  <Switch>
                    <Match when={row.href}>
                      <button
                        type="button"
                        class="text-text-interactive-base hover:underline"
                        data-action="open-ref"
                        onClick={() => navigate(row.href!)}
                      >
                        {row.value}
                      </button>
                    </Match>
                    <Match when={true}>{row.value}</Match>
                  </Switch>
                </dd>
              </>
            )}
          </For>
        </dl>
      </Show>

      <Show when={blocks().length > 0}>
        <div class="mt-2 flex flex-col gap-2">
          <For each={blocks()}>
            {(block) => (
              <div>
                <div class="text-11-regular uppercase tracking-wide text-text-weak">{block.label}</div>
                <Switch>
                  <Match when={typeof block.value === "string"}>
                    <div class="whitespace-pre-wrap text-12-regular text-text-strong">{block.value as string}</div>
                  </Match>
                  <Match when={true}>
                    <pre class="overflow-x-auto text-11-regular text-text-weak">
                      {JSON.stringify(block.value, null, 2)}
                    </pre>
                  </Match>
                </Switch>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
