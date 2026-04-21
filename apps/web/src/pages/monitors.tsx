import type { JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { Button } from "@palimpsest/ui/button"

export default function Monitors(): JSX.Element {
  const navigate = useNavigate()
  const params = useParams()
  return (
    <div class="flex h-full flex-col bg-background-base">
      <div class="flex items-center justify-between border-b border-border-weak-base px-6 py-4">
        <div>
          <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Core tab</div>
          <div class="mt-1 text-20-medium text-text-strong">Monitors</div>
        </div>
        <Button variant="secondary" size="small" onClick={() => navigate(`/${params.dir}/runs`)}>
          View runs
        </Button>
      </div>
      <div class="mx-auto mt-16 max-w-xl px-6 text-center">
        <div class="text-14-medium text-text-strong">No monitors configured yet.</div>
        <div class="mt-2 text-12-regular text-text-weak">
          Monitors surface long-running observations (scan watchers, experiment health, data freshness). Core keeps this
          tab empty by default. Security-audit and research plugins can contribute monitor adapters once the plugin host
          API is available in Sprint 3.5.
        </div>
        <div class="mt-6 rounded-lg border border-border-weak-base px-4 py-3 text-left text-11-regular text-text-weak">
          <div class="text-text-strong">What a plugin contributes here:</div>
          <ul class="mt-2 list-disc pl-5">
            <li>Source of monitored signals (run logs, SARIF, external service health, file watchers)</li>
            <li>Summarization view per monitor row</li>
            <li>Alert routing into the Reviews inbox when a monitor raises a concern</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
