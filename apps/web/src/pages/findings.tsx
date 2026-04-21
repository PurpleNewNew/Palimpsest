import { createResource, createSignal, For, Show, type JSX } from "solid-js"
import { useParams } from "@solidjs/router"
import { Button } from "@palimpsest/ui/button"

import { useSecurityAudit } from "@/context/security-audit"

function severityTone(severity?: string) {
  if (severity === "critical") return "text-icon-critical-base"
  if (severity === "high") return "text-icon-warning-base"
  if (severity === "medium") return "text-text-strong"
  return "text-text-weak"
}

function propsField(props: Record<string, unknown> | undefined, field: string): string | undefined {
  if (!props) return undefined
  const value = props[field]
  return typeof value === "string" ? value : undefined
}

export default function Findings(): JSX.Element {
  const params = useParams()
  const audit = useSecurityAudit(() => params.dir)

  const [refreshKey, setRefreshKey] = createSignal(0)
  const [findings] = createResource(refreshKey, () => audit.findings().catch(() => undefined))

  return (
    <div class="flex h-full flex-col gap-4 p-6" data-component="findings-page">
      <header class="flex items-center justify-between">
        <div>
          <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Security Audit</div>
          <h1 class="mt-1 text-20-medium text-text-strong">Findings</h1>
          <div class="mt-1 text-12-regular text-text-weak">
            Pending finding hypotheses and committed findings, with severity and validation state.
          </div>
        </div>
        <Button variant="secondary" size="small" onClick={() => setRefreshKey((v) => v + 1)}>
          Refresh
        </Button>
      </header>

      <section class="rounded-2xl bg-surface-raised-base px-4 py-4" data-component="findings-pending">
        <div class="flex items-center justify-between">
          <div class="text-11-medium uppercase tracking-wide text-text-weak">Pending Hypotheses</div>
          <div class="text-11-regular text-text-weak">{findings()?.pendingProposals.length ?? 0}</div>
        </div>
        <div class="mt-3 flex flex-col gap-2">
          <For each={findings()?.pendingProposals ?? []}>
            {(item) => (
              <div class="rounded-xl bg-background-base px-3 py-3" data-proposal-id={item.id}>
                <div class="flex items-center justify-between">
                  <div class="text-13-medium text-text-strong">{item.title}</div>
                  <span class="text-10-medium uppercase tracking-wide text-text-weak">{item.status}</span>
                </div>
                <Show when={item.rationale}>
                  <div class="mt-1 text-11-regular text-text-weak">{item.rationale}</div>
                </Show>
                <div class="mt-2 text-10-regular text-text-weak">
                  {item.id} · {new Date(item.time.updated).toLocaleString()}
                </div>
              </div>
            )}
          </For>
          <Show when={(findings()?.pendingProposals ?? []).length === 0}>
            <div class="rounded-xl bg-background-base px-3 py-3 text-12-regular text-text-weak">
              No pending finding hypotheses.
            </div>
          </Show>
        </div>
      </section>

      <section class="rounded-2xl bg-surface-raised-base px-4 py-4" data-component="findings-committed">
        <div class="flex items-center justify-between">
          <div class="text-11-medium uppercase tracking-wide text-text-weak">Committed Findings</div>
          <div class="text-11-regular text-text-weak">{findings()?.committedFindings.length ?? 0}</div>
        </div>
        <div class="mt-3 flex flex-col gap-2">
          <For each={findings()?.committedFindings ?? []}>
            {(finding) => {
              const severity = () => propsField(finding.props, "severity")
              const confidence = () => propsField(finding.props, "confidence")
              const status = () => propsField(finding.props, "status")
              return (
                <div class="rounded-xl bg-background-base px-3 py-3" data-finding-id={finding.id}>
                  <div class="flex items-center justify-between">
                    <div class="text-13-medium text-text-strong">{finding.title ?? finding.id}</div>
                    <span class={`text-10-medium uppercase tracking-wide ${severityTone(severity())}`}>
                      {severity() ?? "—"}
                    </span>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-3 text-10-medium uppercase tracking-wide text-text-weak">
                    <Show when={status()}>
                      <span>{status()}</span>
                    </Show>
                    <Show when={confidence()}>
                      <span>confidence: {confidence()}</span>
                    </Show>
                    <Show when={finding.commitID}>
                      <span>commit: {finding.commitID}</span>
                    </Show>
                  </div>
                  <div class="mt-2 text-10-regular text-text-weak">
                    {finding.id} · {new Date(finding.time.updated).toLocaleString()}
                  </div>
                </div>
              )
            }}
          </For>
          <Show when={(findings()?.committedFindings ?? []).length === 0}>
            <div class="rounded-xl bg-background-base px-3 py-3 text-12-regular text-text-weak">
              No committed findings yet.
            </div>
          </Show>
        </div>
      </section>
    </div>
  )
}
