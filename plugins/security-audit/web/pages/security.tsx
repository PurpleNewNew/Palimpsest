import { createResource, createSignal, For, Show, type JSX } from "solid-js"
import { useParams } from "@solidjs/router"
import { Button } from "@palimpsest/ui/button"

import {
  type SecurityProposalSummary,
  useSecurityAudit,
} from "../context/security-audit"

export default function Security(): JSX.Element {
  const params = useParams()
  const audit = useSecurityAudit(() => params.dir)

  const [refreshKey, setRefreshKey] = createSignal(0)
  const [status] = createResource(refreshKey, () => audit.status().catch(() => undefined))
  const [overview, { refetch: refetchOverview }] = createResource(refreshKey, () =>
    audit.overview().catch(() => undefined),
  )
  const [bootstrapping, setBootstrapping] = createSignal(false)
  const [error, setError] = createSignal<string | undefined>()
  const [reviewingID, setReviewingID] = createSignal<string | undefined>()

  async function bootstrap() {
    setBootstrapping(true)
    setError(undefined)
    try {
      await audit.bootstrap()
      await refetchOverview()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBootstrapping(false)
    }
  }

  async function review(proposal: SecurityProposalSummary, verdict: "approve" | "reject") {
    setReviewingID(proposal.id)
    setError(undefined)
    try {
      await audit.review({
        proposalID: proposal.id,
        verdict,
        comments: verdict === "approve" ? "Approved from security overview." : "Rejected from security overview.",
      })
      await refetchOverview()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setReviewingID(undefined)
    }
  }

  return (
    <div class="flex h-full flex-col gap-4 overflow-y-auto p-6" data-component="security-page">
      <header class="flex items-center justify-between">
        <div>
          <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Security Audit</div>
          <h1 class="mt-1 text-20-medium text-text-strong">Audit Overview</h1>
          <div class="mt-1 text-12-regular text-text-weak">
            Scope, hypotheses, evidence, and risk decisions routed through the security-audit plugin.
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="secondary" size="small" onClick={() => setRefreshKey((v) => v + 1)}>
            Refresh
          </Button>
          <Button variant="primary" size="small" onClick={bootstrap} disabled={bootstrapping()}>
            {bootstrapping() ? "Bootstrapping..." : "Bootstrap graph"}
          </Button>
        </div>
      </header>

      <Show when={error()}>
        <div
          class="rounded-2xl border border-border-critical-base bg-surface-critical-base px-4 py-3 text-12-regular text-text-critical-base"
          data-component="security-error"
        >
          {error()}
        </div>
      </Show>

      <Show when={overview()?.scope}>
        {(scope) => (
          <section class="rounded-2xl bg-surface-raised-base px-4 py-4" data-component="security-scope">
            <div class="text-11-medium uppercase tracking-wide text-text-weak">Scope</div>
            <dl class="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <dt class="text-10-medium uppercase tracking-wide text-text-weak">Target</dt>
                <dd class="mt-1 text-13-regular text-text-strong">{scope().target}</dd>
              </div>
              <div>
                <dt class="text-10-medium uppercase tracking-wide text-text-weak">Objective</dt>
                <dd class="mt-1 text-13-regular text-text-strong">{scope().objective}</dd>
              </div>
              <div>
                <dt class="text-10-medium uppercase tracking-wide text-text-weak">Constraints</dt>
                <dd class="mt-1 text-13-regular text-text-strong">{scope().constraints}</dd>
              </div>
            </dl>
          </section>
        )}
      </Show>

      <div class="grid gap-4 md:grid-cols-4">
        <div class="rounded-2xl bg-surface-raised-base px-4 py-4">
          <div class="text-11-medium uppercase tracking-wide text-text-weak">Plugin</div>
          <div class="mt-2 text-16-medium text-text-strong">
            <Show when={status()} fallback="—">
              {(value) => value().pluginID}
            </Show>
          </div>
          <Show when={status()}>
            {(value) => (
              <div class="mt-2 text-11-regular text-text-weak">
                {value().prompts.length} prompts · {value().workflows.length} workflows
              </div>
            )}
          </Show>
        </div>
        <div class="rounded-2xl bg-surface-raised-base px-4 py-4">
          <div class="text-11-medium uppercase tracking-wide text-text-weak">Pending Proposals</div>
          <div class="mt-2 text-16-medium text-text-strong">{overview()?.pendingProposals.length ?? 0}</div>
        </div>
        <div class="rounded-2xl bg-surface-raised-base px-4 py-4">
          <div class="text-11-medium uppercase tracking-wide text-text-weak">Recent Commits</div>
          <div class="mt-2 text-16-medium text-text-strong">{overview()?.recentCommits.length ?? 0}</div>
        </div>
        <div class="rounded-2xl bg-surface-raised-base px-4 py-4">
          <div class="text-11-medium uppercase tracking-wide text-text-weak">Findings</div>
          <div class="mt-2 text-16-medium text-text-strong">
            {overview()?.nodeCounts?.finding ?? 0}
          </div>
          <div class="mt-1 text-11-regular text-text-weak">
            Risks: {overview()?.nodeCounts?.risk ?? 0} · Surfaces: {overview()?.nodeCounts?.surface ?? 0}
          </div>
        </div>
      </div>

      <section class="rounded-2xl bg-surface-raised-base px-4 py-4" data-component="security-pending">
        <div class="flex items-center justify-between">
          <div class="text-11-medium uppercase tracking-wide text-text-weak">Pending Proposals</div>
          <div class="text-11-regular text-text-weak">{overview()?.pendingProposals.length ?? 0}</div>
        </div>
        <div class="mt-3 flex flex-col gap-2">
          <For each={overview()?.pendingProposals ?? []}>
            {(item) => (
              <div
                class="rounded-xl bg-background-base px-3 py-3"
                data-component="security-pending-item"
                data-proposal-id={item.id}
              >
                <div class="flex items-center justify-between">
                  <div class="text-13-medium text-text-strong">{item.title ?? item.id}</div>
                  <span class="text-10-medium uppercase tracking-wide text-text-weak">
                    rev {item.revision ?? 1}
                  </span>
                </div>
                <Show when={item.rationale}>
                  <div class="mt-1 text-11-regular text-text-weak">{item.rationale}</div>
                </Show>
                <div class="mt-2 flex items-center justify-between gap-2">
                  <div class="text-10-regular text-text-weak">
                    {item.id}
                    <Show when={item.actor}>
                      {(actor) => (
                        <>
                          {" · "}
                          {actor().type}:{actor().id}
                        </>
                      )}
                    </Show>
                  </div>
                  <div class="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      size="small"
                      data-action="reject-proposal"
                      disabled={reviewingID() === item.id}
                      onClick={() => review(item, "reject")}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="small"
                      data-action="approve-proposal"
                      disabled={reviewingID() === item.id}
                      onClick={() => review(item, "approve")}
                    >
                      {reviewingID() === item.id ? "..." : "Approve"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </For>
          <Show when={(overview()?.pendingProposals ?? []).length === 0}>
            <div class="rounded-xl bg-background-base px-3 py-3 text-12-regular text-text-weak">
              No security proposals pending review.
            </div>
          </Show>
        </div>
      </section>

      <section class="rounded-2xl bg-surface-raised-base px-4 py-4" data-component="security-recent-commits">
        <div class="flex items-center justify-between">
          <div class="text-11-medium uppercase tracking-wide text-text-weak">Recent Commits</div>
          <div class="text-11-regular text-text-weak">{overview()?.recentCommits.length ?? 0}</div>
        </div>
        <div class="mt-3 flex flex-col gap-2">
          <For each={overview()?.recentCommits ?? []}>
            {(commit) => (
              <div class="rounded-xl bg-background-base px-3 py-3" data-commit-id={commit.id}>
                <div class="text-13-medium text-text-strong">{commit.id}</div>
                <div class="mt-1 text-11-regular text-text-weak">
                  <Show when={commit.proposalID}>from {commit.proposalID} · </Show>
                  {commit.changeCount ?? 0} changes · {new Date(commit.time.created).toLocaleString()}
                </div>
              </div>
            )}
          </For>
          <Show when={(overview()?.recentCommits ?? []).length === 0}>
            <div class="rounded-xl bg-background-base px-3 py-3 text-12-regular text-text-weak">
              No security commits yet.
            </div>
          </Show>
        </div>
      </section>
    </div>
  )
}
