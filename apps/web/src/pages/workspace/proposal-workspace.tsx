import { createMemo, createResource, For, Show, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import type { DomainChange, DomainCommit, DomainProposal, DomainReview } from "@palimpsest/sdk/v2"
import { Button } from "@palimpsest/ui/button"
import { Icon } from "@palimpsest/ui/icon"
import { Spinner } from "@palimpsest/ui/spinner"
import { showToast } from "@palimpsest/ui/toast"

import { useAuth } from "@/context/auth"
import { useCanWrite } from "@/context/permissions"
import { useSDK } from "@/context/sdk"
import { ChangeView } from "../reviews/change-view"
import { ObjectWorkspace, RailLink, RailSection } from "./object-workspace"
import { PublishButton } from "./publish-button"

type ProposalData = {
  proposal: DomainProposal
  reviews: DomainReview[]
  commit?: DomainCommit
}

type Affected = {
  nodes: { id: string; op: string; title?: string; kind?: string }[]
  edges: { id?: string; op: string; source?: string; target?: string; kind?: string }[]
  runs: { id?: string; op: string; kind?: string; title?: string }[]
  artifacts: { id?: string; op: string; kind?: string; title?: string }[]
  decisions: { id?: string; op: string; kind?: string }[]
}

function statusTone(status: DomainProposal["status"]) {
  if (status === "pending") return "text-text-strong"
  if (status === "approved") return "text-icon-success-base"
  if (status === "rejected") return "text-icon-critical-base"
  return "text-text-weak"
}

function formatTime(ms: number) {
  const diff = Date.now() - ms
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ms).toLocaleDateString()
}

function extractAffected(changes: DomainChange[]): Affected {
  const out: Affected = { nodes: [], edges: [], runs: [], artifacts: [], decisions: [] }
  for (const change of changes) {
    if (change.op === "create_node" || change.op === "update_node" || change.op === "delete_node") {
      out.nodes.push({
        id: "id" in change && change.id ? change.id : "",
        op: change.op,
        title: "title" in change ? change.title : undefined,
        kind: "kind" in change ? change.kind : undefined,
      })
    } else if (change.op === "create_edge" || change.op === "update_edge" || change.op === "delete_edge") {
      out.edges.push({
        id: "id" in change ? change.id : undefined,
        op: change.op,
        source: "sourceID" in change ? change.sourceID : undefined,
        target: "targetID" in change ? change.targetID : undefined,
        kind: "kind" in change ? change.kind : undefined,
      })
    } else if (change.op === "create_run" || change.op === "update_run" || change.op === "delete_run") {
      out.runs.push({
        id: "id" in change ? change.id : undefined,
        op: change.op,
        kind: "kind" in change ? change.kind : undefined,
        title: "title" in change ? change.title : undefined,
      })
    } else if (
      change.op === "create_artifact" ||
      change.op === "update_artifact" ||
      change.op === "delete_artifact"
    ) {
      out.artifacts.push({
        id: "id" in change ? change.id : undefined,
        op: change.op,
        kind: "kind" in change ? change.kind : undefined,
        title: "title" in change ? change.title : undefined,
      })
    } else if (
      change.op === "create_decision" ||
      change.op === "update_decision" ||
      change.op === "delete_decision"
    ) {
      out.decisions.push({
        id: "id" in change ? change.id : undefined,
        op: change.op,
        kind: "kind" in change ? change.kind : undefined,
      })
    }
  }
  return out
}

export default function ProposalWorkspace(): JSX.Element {
  const sdk = useSDK()
  const auth = useAuth()
  const navigate = useNavigate()
  const params = useParams()
  const proposalID = () => params.proposalID!

  const [data, { refetch }] = createResource(
    () => proposalID(),
    async (id) => {
      const [proposalsRes, reviewsRes, commitsRes] = await Promise.all([
        sdk.client.domain.proposal.list(),
        sdk.client.domain.review.list(),
        sdk.client.domain.commit.list(),
      ])
      const proposal = (proposalsRes.data ?? []).find((item) => item.id === id)
      if (!proposal) return undefined
      const reviews = (reviewsRes.data ?? [])
        .filter((item) => item.proposalID === id)
        .sort((a, b) => a.time.created - b.time.created)
      const commit = (commitsRes.data ?? []).find((item) => item.proposalID === id)
      return { proposal, reviews, commit } satisfies ProposalData
    },
  )

  async function review(verdict: "approve" | "reject" | "request_changes") {
    const current = data()?.proposal
    if (!current) return
    const user = auth.user()
    try {
      await sdk.client.domain.proposal.review({
        proposalID: current.id,
        actor: user ? { type: "user", id: user.id } : undefined,
        verdict,
      })
      await refetch()
      showToast({
        variant: verdict === "approve" ? "success" : "default",
        title: `Review submitted (${verdict.replace("_", " ")})`,
      })
    } catch (err) {
      showToast({ variant: "error", title: "Review failed", description: String((err as Error).message ?? err) })
    }
  }

  async function withdraw() {
    const current = data()?.proposal
    if (!current) return
    try {
      const user = auth.user()
      await sdk.client.domain.proposal.withdraw({
        proposalID: current.id,
        actor: user ? { type: "user", id: user.id } : undefined,
      })
      await refetch()
      showToast({ variant: "default", title: "Proposal withdrawn" })
    } catch (err) {
      showToast({ variant: "error", title: "Withdraw failed", description: String((err as Error).message ?? err) })
    }
  }

  const canWrite = useCanWrite()

  const canReview = createMemo(() => {
    if (!canWrite()) return false
    const current = data()?.proposal
    const user = auth.user()
    if (!current || !user) return false
    if (current.status !== "pending") return false
    return current.actor.id !== user.id
  })

  const canWithdraw = createMemo(() => {
    if (!canWrite()) return false
    const current = data()?.proposal
    const user = auth.user()
    if (!current || !user) return false
    if (current.status !== "pending") return false
    return current.actor.id === user.id
  })

  const affected = createMemo(() => {
    const proposal = data()?.proposal
    if (!proposal) return undefined
    return extractAffected(proposal.changes)
  })

  return (
    <Show
      when={!data.loading}
      fallback={
        <div class="flex h-full items-center justify-center">
          <Spinner class="size-5" />
        </div>
      }
    >
      <Show
        when={data()}
        fallback={
          <div class="flex h-full items-center justify-center text-12-regular text-text-weak">
            Proposal not found.
          </div>
        }
      >
        {(value) => {
          const proposal = () => value().proposal
          const reviews = () => value().reviews
          const commit = () => value().commit

          return (
            <ObjectWorkspace
              kind="proposal"
              id={proposal().id}
              readonly={!canWrite()}
              backHref={`/${params.dir}/reviews`}
              backLabel="Inbox"
              publishSlot={<PublishButton entityKind="proposal" entityID={proposal().id} directory={params.dir} />}
              title={proposal().title?.trim() || `Proposal ${proposal().id}`}
              status={
                <span
                  class={`text-11-medium uppercase tracking-wide ${statusTone(proposal().status)}`}
                  data-component="proposal-status"
                >
                  {proposal().status}
                </span>
              }
              meta={
                <span>
                  {proposal().actor.type}:{proposal().actor.id} · created {formatTime(proposal().time.created)}
                  <Show when={proposal().revision > 1}> · rev {proposal().revision}</Show>
                </span>
              }
              actions={
                <>
                  <Show when={canReview()}>
                    <Button variant="primary" size="small" data-action="approve" onClick={() => review("approve")}>
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      data-action="request-changes"
                      onClick={() => review("request_changes")}
                    >
                      Request changes
                    </Button>
                    <Button variant="secondary" size="small" data-action="reject" onClick={() => review("reject")}>
                      Reject
                    </Button>
                  </Show>
                  <Show when={canWithdraw()}>
                    <Button variant="secondary" size="small" data-action="withdraw" onClick={withdraw}>
                      Withdraw
                    </Button>
                  </Show>
                </>
              }
              main={
                <div data-component="proposal-body">
                  <Show when={proposal().rationale}>
                    <div
                      class="rounded-lg bg-surface-raised-base px-4 py-3 text-13-regular text-text-strong whitespace-pre-wrap"
                      data-component="proposal-rationale"
                    >
                      {proposal().rationale}
                    </div>
                  </Show>

                  <section class="mt-6" data-component="proposal-changes">
                    <div class="text-11-medium uppercase tracking-wide text-text-weak">
                      Changes ({proposal().changes.length})
                    </div>
                    <div class="mt-2 flex flex-col gap-2">
                      <For each={proposal().changes}>{(change) => <ChangeView change={change} />}</For>
                    </div>
                  </section>

                  <Show when={commit()}>
                    {(entry) => (
                      <div
                        class="mt-6 rounded-lg border border-border-weak-base px-4 py-3"
                        data-component="proposal-commit"
                        data-commit-id={entry().id}
                      >
                        <div class="flex items-center gap-2">
                          <Icon name="circle-check" class="text-icon-success-base" size="small" />
                          <div class="text-12-medium text-text-strong">Committed</div>
                          <button
                            type="button"
                            class="text-11-regular text-text-interactive-base hover:underline"
                            onClick={() => navigate(`/${params.dir}/commits/${entry().id}`)}
                          >
                            {entry().id}
                          </button>
                        </div>
                        <div class="mt-1 text-11-regular text-text-weak">
                          {entry().actor.type}:{entry().actor.id} applied {entry().changes.length} change
                          {entry().changes.length === 1 ? "" : "s"} · {formatTime(entry().time.created)}
                        </div>
                      </div>
                    )}
                  </Show>

                  <Show when={reviews().length > 0}>
                    <section class="mt-6" data-component="proposal-reviews">
                      <div class="text-11-medium uppercase tracking-wide text-text-weak">
                        Reviews ({reviews().length})
                      </div>
                      <div class="mt-2 flex flex-col gap-2">
                        <For each={reviews()}>
                          {(item) => (
                            <div
                              class="rounded-lg bg-surface-raised-base px-3 py-2 text-12-regular text-text-strong"
                              data-component="review-item"
                              data-verdict={item.verdict}
                            >
                              <div class="flex items-center justify-between">
                                <div class="text-12-medium">
                                  {item.actor.type}:{item.actor.id} · {item.verdict.replace("_", " ")}
                                </div>
                                <div class="text-11-regular text-text-weak">{formatTime(item.time.created)}</div>
                              </div>
                              <Show when={item.comments}>
                                <div class="mt-1 whitespace-pre-wrap text-12-regular text-text-weak">
                                  {item.comments}
                                </div>
                              </Show>
                            </div>
                          )}
                        </For>
                      </div>
                    </section>
                  </Show>
                </div>
              }
              rail={
                <Show when={affected()}>
                  {(counts) => (
                    <>
                      <Show when={counts().nodes.length > 0}>
                        <RailSection title="Affected nodes" count={counts().nodes.length}>
                          <For each={counts().nodes}>
                            {(item) => (
                              <Show
                                when={item.id}
                                fallback={
                                  <div class="rounded-lg bg-background-base px-3 py-2 text-11-regular text-text-weak">
                                    <span class="uppercase tracking-wide">{item.op}</span>
                                    <Show when={item.title}>
                                      <span class="ml-1 text-text-strong">{item.title}</span>
                                    </Show>
                                    <Show when={item.kind}>
                                      <span class="ml-1 text-text-weak">({item.kind})</span>
                                    </Show>
                                  </div>
                                }
                              >
                                {(id) => (
                                  <RailLink
                                    href={`/${params.dir}/nodes/${id()}`}
                                    label={item.title || id()}
                                    hint={item.op.replaceAll("_", " ")}
                                    badge={item.kind}
                                  />
                                )}
                              </Show>
                            )}
                          </For>
                        </RailSection>
                      </Show>

                      <Show when={counts().edges.length > 0}>
                        <RailSection title="Edges" count={counts().edges.length}>
                          <For each={counts().edges}>
                            {(item) => (
                              <div class="rounded-lg bg-background-base px-3 py-2 text-11-regular text-text-weak">
                                <span class="uppercase tracking-wide">{item.op.replaceAll("_", " ")}</span>
                                <Show when={item.kind}>
                                  <span class="ml-1 text-text-strong">{item.kind}</span>
                                </Show>
                                <Show when={item.source && item.target}>
                                  <div class="mt-0.5 text-10-regular text-text-weak">
                                    {item.source} → {item.target}
                                  </div>
                                </Show>
                              </div>
                            )}
                          </For>
                        </RailSection>
                      </Show>

                      <Show when={counts().runs.length > 0}>
                        <RailSection title="Runs" count={counts().runs.length}>
                          <For each={counts().runs}>
                            {(item) => (
                              <Show
                                when={item.id}
                                fallback={
                                  <div class="rounded-lg bg-background-base px-3 py-2 text-11-regular text-text-weak">
                                    <span class="uppercase tracking-wide">{item.op.replaceAll("_", " ")}</span>
                                    <Show when={item.kind}>
                                      <span class="ml-1 text-text-strong">{item.kind}</span>
                                    </Show>
                                  </div>
                                }
                              >
                                {(id) => (
                                  <RailLink
                                    href={`/${params.dir}/runs/${id()}`}
                                    label={item.title || id()}
                                    hint={item.op.replaceAll("_", " ")}
                                    badge={item.kind}
                                  />
                                )}
                              </Show>
                            )}
                          </For>
                        </RailSection>
                      </Show>

                      <Show when={counts().artifacts.length > 0}>
                        <RailSection title="Artifacts" count={counts().artifacts.length}>
                          <For each={counts().artifacts}>
                            {(item) => (
                              <Show
                                when={item.id}
                                fallback={
                                  <div class="rounded-lg bg-background-base px-3 py-2 text-11-regular text-text-weak">
                                    <span class="uppercase tracking-wide">{item.op.replaceAll("_", " ")}</span>
                                    <Show when={item.kind}>
                                      <span class="ml-1 text-text-strong">{item.kind}</span>
                                    </Show>
                                  </div>
                                }
                              >
                                {(id) => (
                                  <RailLink
                                    href={`/${params.dir}/artifacts/${id()}`}
                                    label={item.title || id()}
                                    hint={item.op.replaceAll("_", " ")}
                                    badge={item.kind}
                                  />
                                )}
                              </Show>
                            )}
                          </For>
                        </RailSection>
                      </Show>

                      <Show when={counts().decisions.length > 0}>
                        <RailSection title="Decisions" count={counts().decisions.length}>
                          <For each={counts().decisions}>
                            {(item) => (
                              <Show
                                when={item.id}
                                fallback={
                                  <div class="rounded-lg bg-background-base px-3 py-2 text-11-regular text-text-weak">
                                    <span class="uppercase tracking-wide">{item.op.replaceAll("_", " ")}</span>
                                    <Show when={item.kind}>
                                      <span class="ml-1 text-text-strong">{item.kind}</span>
                                    </Show>
                                  </div>
                                }
                              >
                                {(id) => (
                                  <RailLink
                                    href={`/${params.dir}/decisions/${id()}`}
                                    label={id()}
                                    hint={item.op.replaceAll("_", " ")}
                                    badge={item.kind}
                                  />
                                )}
                              </Show>
                            )}
                          </For>
                        </RailSection>
                      </Show>

                      <Show when={proposal().refs}>
                        <RailSection title="Refs">
                          <pre class="overflow-x-auto rounded-lg bg-background-base px-2 py-2 text-10-regular text-text-weak">
                            {JSON.stringify(proposal().refs, null, 2)}
                          </pre>
                        </RailSection>
                      </Show>
                    </>
                  )}
                </Show>
              }
            />
          )
        }}
      </Show>
    </Show>
  )
}
