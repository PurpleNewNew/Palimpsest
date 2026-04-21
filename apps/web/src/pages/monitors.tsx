import { createSignal, For, onCleanup, onMount, Show, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { Button } from "@palimpsest/ui/button"
import { Icon } from "@palimpsest/ui/icon"

import { useSDK } from "@/context/sdk"

const MAX_LOG_SIZE = 50

const TRACKED_EVENTS = [
  "domain.proposal.created",
  "domain.proposal.reviewed",
  "domain.proposal.committed",
  "domain.proposal.revised",
  "domain.proposal.withdrawn",
] as const

type LogEntry = {
  id: string
  type: (typeof TRACKED_EVENTS)[number]
  time: number
  label: string
  meta?: string
}

function labelFor(event: { type: string; properties: unknown }): { label: string; meta?: string } {
  const props = event.properties as Record<string, unknown> | undefined
  const actor = props?.actor as { type: string; id: string } | undefined
  const proposalID = (props?.id as string) || (props?.proposalID as string) || undefined
  const title = (props?.title as string) || undefined
  const actorLabel = actor ? `${actor.type}:${actor.id}` : undefined
  switch (event.type) {
    case "domain.proposal.created":
      return {
        label: title ? `Proposed: ${title}` : "Proposal created",
        meta: [proposalID, actorLabel].filter(Boolean).join(" · "),
      }
    case "domain.proposal.revised":
      return {
        label: "Proposal revised",
        meta: [proposalID, actorLabel].filter(Boolean).join(" · "),
      }
    case "domain.proposal.reviewed": {
      const verdict = (props?.review as { verdict?: string })?.verdict
      return {
        label: verdict ? `Review ${verdict.replace("_", " ")}` : "Reviewed",
        meta: [proposalID, actorLabel].filter(Boolean).join(" · "),
      }
    }
    case "domain.proposal.committed":
      return {
        label: "Commit applied",
        meta: [proposalID, actorLabel].filter(Boolean).join(" · "),
      }
    case "domain.proposal.withdrawn":
      return {
        label: "Proposal withdrawn",
        meta: [proposalID, actorLabel].filter(Boolean).join(" · "),
      }
    default:
      return { label: event.type }
  }
}

function tone(type: (typeof TRACKED_EVENTS)[number]) {
  if (type === "domain.proposal.committed") return "text-icon-success-base"
  if (type === "domain.proposal.withdrawn") return "text-text-weak"
  if (type === "domain.proposal.reviewed") return "text-text-interactive-base"
  return "text-text-strong"
}

export default function Monitors(): JSX.Element {
  const sdk = useSDK()
  const navigate = useNavigate()
  const params = useParams()
  const [log, setLog] = createSignal<LogEntry[]>([])
  const [paused, setPaused] = createSignal(false)

  onMount(() => {
    const unsubs = TRACKED_EVENTS.map((type) =>
      sdk.event.on(type as never, (event: { type: string; properties: unknown }) => {
        if (paused()) return
        const { label, meta } = labelFor(event)
        const entry: LogEntry = {
          id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: type as LogEntry["type"],
          time: Date.now(),
          label,
          meta,
        }
        setLog((prev) => [entry, ...prev].slice(0, MAX_LOG_SIZE))
      }),
    )
    onCleanup(() => {
      for (const unsub of unsubs) unsub()
    })
  })

  function clearLog() {
    setLog([])
  }

  return (
    <div class="flex h-full flex-col bg-background-base" data-component="entity-tab" data-entity="monitor">
      <div class="flex items-center justify-between border-b border-border-weak-base px-6 py-4">
        <div>
          <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Core tab</div>
          <div class="mt-1 text-20-medium text-text-strong">Monitors</div>
          <div class="mt-1 text-12-regular text-text-weak">
            Live event log for domain.proposal.* activity. Plugin-contributed monitors will slot in here when Sprint 4.5
            lands.
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="secondary"
            size="small"
            data-action={paused() ? "resume" : "pause"}
            onClick={() => setPaused((v) => !v)}
          >
            {paused() ? "Resume" : "Pause"}
          </Button>
          <Button variant="secondary" size="small" data-action="clear" onClick={clearLog}>
            Clear
          </Button>
          <Button variant="secondary" size="small" onClick={() => navigate(`/${params.dir}/reviews`)}>
            View reviews
          </Button>
        </div>
      </div>

      <div class="mx-auto mt-4 w-full max-w-3xl px-6 pb-8">
        <div class="flex items-center justify-between">
          <div class="text-11-medium uppercase tracking-wide text-text-weak" data-component="monitor-status">
            {paused() ? "Paused" : `Live · ${log().length} event${log().length === 1 ? "" : "s"}`}
          </div>
          <div class="text-11-regular text-text-weak">Showing up to {MAX_LOG_SIZE} most recent.</div>
        </div>

        <Show
          when={log().length > 0}
          fallback={
            <div
              class="mt-4 rounded-lg border border-border-weak-base px-4 py-8 text-center text-12-regular text-text-weak"
              data-component="monitor-empty"
            >
              No domain events yet. Propose something in Reviews to see activity stream in live.
            </div>
          }
        >
          <ol class="mt-4 flex flex-col gap-2" data-component="monitor-log">
            <For each={log()}>
              {(entry) => (
                <li
                  class="rounded-lg bg-surface-raised-base px-3 py-2 text-12-regular text-text-strong"
                  data-component="monitor-log-entry"
                  data-event-type={entry.type}
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class={`text-12-medium ${tone(entry.type)}`}>{entry.label}</span>
                    <span class="text-11-regular text-text-weak">{new Date(entry.time).toLocaleTimeString()}</span>
                  </div>
                  <div class="mt-0.5 flex items-center gap-2 text-11-regular text-text-weak">
                    <Icon name="dash" size="small" class="text-icon-weak" />
                    <span>{entry.type}</span>
                    <Show when={entry.meta}>
                      <span>· {entry.meta}</span>
                    </Show>
                  </div>
                </li>
              )}
            </For>
          </ol>
        </Show>
      </div>
    </div>
  )
}
