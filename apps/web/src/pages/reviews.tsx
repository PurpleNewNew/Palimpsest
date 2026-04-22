import { createEffect, createMemo, createResource, createSignal, For, Match, Show, Switch, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useNavigate, useParams, useSearchParams } from "@solidjs/router"
import type {
  DomainChange,
  DomainCommit,
  DomainContext,
  DomainProposal,
  DomainReview,
  DomainTaxonomy,
} from "@palimpsest/sdk/v2"
import { Button } from "@palimpsest/ui/button"
import { Icon } from "@palimpsest/ui/icon"
import { Spinner } from "@palimpsest/ui/spinner"
import { showToast } from "@palimpsest/ui/toast"

import { useSDK } from "@/context/sdk"
import { useAuth } from "@/context/auth"
import { ChangeView } from "./reviews/change-view"

type ReviewData = {
  proposals: DomainProposal[]
  reviews: DomainReview[]
  commits: DomainCommit[]
  taxonomy: DomainTaxonomy
  context: DomainContext
}

type ComposerStore = {
  open: boolean
  title: string
  rationale: string
  nodeKind: string
  nodeTitle: string
  nodeBody: string
  nodeData: string
  includeEdge: boolean
  edgeKind: string
  edgeTargetID: string
  autoApprove: boolean
  submitting: boolean
}

function emptyComposer(taxonomy?: DomainTaxonomy): ComposerStore {
  return {
    open: false,
    title: "",
    rationale: "",
    nodeKind: taxonomy?.nodeKinds[0] ?? "",
    nodeTitle: "",
    nodeBody: "",
    nodeData: "",
    includeEdge: false,
    edgeKind: taxonomy?.edgeKinds[0] ?? "",
    edgeTargetID: "",
    autoApprove: false,
    submitting: false,
  }
}

function parseNodeData(raw: string): Record<string, unknown> | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    return undefined
  } catch {
    return undefined
  }
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



export default function Reviews(): JSX.Element {
  const sdk = useSDK()
  const auth = useAuth()
  const navigate = useNavigate()
  const params = useParams()
  const selectedID = createMemo(() => params.proposalID as string | undefined)

  const [version, setVersion] = createSignal(0)
  const [filter, setFilter] = createSignal<"pending" | "all">("pending")
  const [search, setSearch] = createSignal("")
  const [actorFilter, setActorFilter] = createSignal("")

  const [data] = createResource(
    () => version(),
    async () => {
      const [proposals, reviews, commits, taxonomy, context] = await Promise.all([
        sdk.client.domain.proposal.list().then((value) => value.data ?? []),
        sdk.client.domain.review.list().then((value) => value.data ?? []),
        sdk.client.domain.commit.list().then((value) => value.data ?? []),
        sdk.client.domain.taxonomy().then((value) => value.data!),
        sdk.client.domain.context().then((value) => value.data!),
      ])
      return {
        proposals,
        reviews,
        commits,
        taxonomy,
        context,
      } satisfies ReviewData
    },
  )

  const proposals = createMemo(() => {
    const list = data()?.proposals ?? []
    const byStatus = filter() === "pending" ? list.filter((item) => item.status === "pending") : list
    const q = search().trim().toLowerCase()
    const byText = q
      ? byStatus.filter(
          (item) =>
            (item.title ?? "").toLowerCase().includes(q) ||
            (item.rationale ?? "").toLowerCase().includes(q) ||
            item.id.toLowerCase().includes(q),
        )
      : byStatus
    const a = actorFilter()
    const byActor = a ? byText.filter((item) => item.actor.id === a) : byText
    return byActor.slice().sort((a, b) => b.time.updated - a.time.updated)
  })

  const actorOptions = createMemo(() => {
    const list = data()?.proposals ?? []
    const map = new Map<string, { id: string; label: string }>()
    for (const proposal of list) {
      if (!map.has(proposal.actor.id)) {
        map.set(proposal.actor.id, {
          id: proposal.actor.id,
          label: `${proposal.actor.type}:${proposal.actor.id}`,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  })

  const selected = createMemo(() => {
    const id = selectedID()
    const list = proposals()
    if (!id) return list[0]
    return list.find((item) => item.id === id) ?? list[0]
  })

  const selectedReviews = createMemo(() => {
    const pid = selected()?.id
    if (!pid) return []
    return (data()?.reviews ?? []).filter((item) => item.proposalID === pid).sort((a, b) => a.time.created - b.time.created)
  })

  const selectedCommit = createMemo(() => {
    const pid = selected()?.id
    if (!pid) return undefined
    return (data()?.commits ?? []).find((item) => item.proposalID === pid)
  })

  const [composer, setComposer] = createStore<ComposerStore>(emptyComposer())
  const [searchParams, setSearchParams] = useSearchParams<{ prefill_source?: string }>()
  const [prefillApplied, setPrefillApplied] = createSignal(false)

  function openComposer() {
    const tax = data()?.taxonomy
    setComposer(emptyComposer(tax))
    setComposer("open", true)
  }

  createEffect(() => {
    const path = searchParams.prefill_source
    if (!path || prefillApplied() || data.loading) return
    setPrefillApplied(true)
    void prefillFromSourceFile(path)
  })

  async function prefillFromSourceFile(path: string) {
    const tax = data()?.taxonomy
    const res = await sdk.client.file.read({ path }).catch(() => undefined)
    const body = res?.data
    const text =
      typeof body === "string"
        ? body
        : body && typeof body === "object" && "content" in body
          ? String((body as { content: unknown }).content ?? "")
          : ""
    const name = path.split("/").pop() ?? path
    const stem = name.replace(/\.[^./]+$/, "")
    setComposer({
      ...emptyComposer(tax),
      open: true,
      title: `Propose source: ${stem}`,
      rationale: `Anchor ${path} as a source node so it can be cited from claims and findings.`,
      nodeKind: tax?.nodeKinds.includes("source") ? "source" : (tax?.nodeKinds[0] ?? "source"),
      nodeTitle: stem,
      nodeBody: text,
      nodeData: JSON.stringify({ path, origin: "unclaimed_source_file" }, null, 2),
    })
    setSearchParams({ ...searchParams, prefill_source: undefined })
  }

  function select(proposalID: string) {
    navigate(`/${params.dir}/reviews/${proposalID}`)
  }

  async function submitProposal(event: Event) {
    event.preventDefault()
    if (composer.submitting) return
    if (!composer.nodeKind || !composer.nodeTitle.trim()) {
      showToast({ variant: "error", title: "Cannot propose", description: "Pick a node kind and a title." })
      return
    }
    if (composer.includeEdge && (!composer.edgeKind || !composer.edgeTargetID)) {
      showToast({ variant: "error", title: "Edge incomplete", description: "Pick an edge kind and a target node." })
      return
    }
    setComposer("submitting", true)
    try {
      const changes: DomainChange[] = []
      const newNodeID = `nod_${Math.random().toString(36).slice(2, 10)}`
      const body = composer.nodeBody.trim()
      const parsedData = parseNodeData(composer.nodeData)
      changes.push({
        op: "create_node",
        id: newNodeID,
        kind: composer.nodeKind,
        title: composer.nodeTitle.trim(),
        ...(body ? { body } : {}),
        ...(parsedData ? { data: parsedData } : {}),
      })
      if (composer.includeEdge) {
        changes.push({
          op: "create_edge",
          kind: composer.edgeKind,
          sourceID: newNodeID,
          targetID: composer.edgeTargetID,
        })
      }
      const user = auth.user()
      const response = await sdk.client.domain.proposal.create({
        title: composer.title.trim() || `Add ${composer.nodeKind}: ${composer.nodeTitle.trim()}`,
        actor: user ? { type: "user", id: user.id } : { type: "system", id: "web" },
        changes,
        rationale: composer.rationale.trim() || undefined,
        autoApprove: composer.autoApprove,
      })
      const proposalID = response.data?.id
      setComposer("open", false)
      setComposer("submitting", false)
      setVersion((value) => value + 1)
      showToast({
        variant: "success",
        title: composer.autoApprove ? "Shipped" : "Proposed",
        description: composer.autoApprove ? "Changes applied directly." : "Proposal queued for review.",
      })
      if (proposalID && !composer.autoApprove) navigate(`/${params.dir}/reviews/${proposalID}`)
    } catch (err) {
      setComposer("submitting", false)
      showToast({ variant: "error", title: "Failed to propose", description: String((err as Error).message ?? err) })
    }
  }

  async function review(verdict: "approve" | "reject" | "request_changes") {
    const current = selected()
    if (!current) return
    const user = auth.user()
    try {
      await sdk.client.domain.proposal.review({
        proposalID: current.id,
        actor: user ? { type: "user", id: user.id } : undefined,
        verdict,
      })
      setVersion((value) => value + 1)
      showToast({
        variant: verdict === "approve" ? "success" : "default",
        title: `Review submitted (${verdict.replace("_", " ")})`,
      })
    } catch (err) {
      showToast({ variant: "error", title: "Review failed", description: String((err as Error).message ?? err) })
    }
  }

  async function withdraw() {
    const current = selected()
    if (!current) return
    try {
      const user = auth.user()
      await sdk.client.domain.proposal.withdraw({
        proposalID: current.id,
        actor: user ? { type: "user", id: user.id } : undefined,
      })
      setVersion((value) => value + 1)
      showToast({ variant: "default", title: "Proposal withdrawn" })
    } catch (err) {
      showToast({ variant: "error", title: "Withdraw failed", description: String((err as Error).message ?? err) })
    }
  }

  const canReview = createMemo(() => {
    const current = selected()
    const user = auth.user()
    if (!current || !user) return false
    if (current.status !== "pending") return false
    return current.actor.id !== user.id
  })

  const canWithdraw = createMemo(() => {
    const current = selected()
    const user = auth.user()
    if (!current || !user) return false
    if (current.status !== "pending") return false
    return current.actor.id === user.id
  })

  return (
    <div class="flex h-full flex-col bg-background-base" data-component="reviews-page">
      <div class="flex flex-col gap-3 border-b border-border-weak-base px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Reviews</div>
            <div class="mt-1 text-20-medium text-text-strong">Proposal inbox</div>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1 rounded-lg bg-surface-raised-base p-1" data-component="filter-toggle">
              <button
                type="button"
                data-action="filter-pending"
                data-active={filter() === "pending"}
                class={`rounded-md px-3 py-1 text-12-medium ${filter() === "pending" ? "bg-background-base text-text-strong" : "text-text-weak"}`}
                onClick={() => setFilter("pending")}
              >
                Pending
              </button>
              <button
                type="button"
                data-action="filter-all"
                data-active={filter() === "all"}
                class={`rounded-md px-3 py-1 text-12-medium ${filter() === "all" ? "bg-background-base text-text-strong" : "text-text-weak"}`}
                onClick={() => setFilter("all")}
              >
                All
              </button>
            </div>
            <Button variant="primary" size="small" data-action="open-composer" onClick={openComposer}>
              Propose
            </Button>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <input
            type="search"
            data-component="reviews-search"
            placeholder="Search title / rationale / id"
            class="w-64 rounded-md border border-border-weak-base bg-background-base px-3 py-1.5 text-12-regular text-text-strong"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
          <select
            data-component="reviews-actor-filter"
            class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
            value={actorFilter()}
            onChange={(e) => setActorFilter(e.currentTarget.value)}
          >
            <option value="">All actors</option>
            <For each={actorOptions()}>
              {(actor) => <option value={actor.id}>{actor.label}</option>}
            </For>
          </select>
          <div class="text-11-regular text-text-weak">
            Showing {proposals().length} of {data()?.proposals.length ?? 0}
          </div>
        </div>
      </div>

      <Show when={composer.open}>
        <form
          onSubmit={submitProposal}
          class="border-b border-border-weak-base bg-surface-raised-base px-6 py-4"
          data-component="propose-composer"
        >
          <div class="flex items-center justify-between">
            <div class="text-13-medium text-text-strong">New proposal</div>
            <button
              type="button"
              data-action="composer-cancel"
              class="text-12-regular text-text-weak hover:text-text-strong"
              onClick={() => setComposer("open", false)}
            >
              Cancel
            </button>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-3">
            <label class="flex flex-col gap-1 text-11-regular text-text-weak">
              Proposal title (optional)
              <input
                type="text"
                data-field="proposal-title"
                class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
                value={composer.title}
                placeholder="e.g. Capture initial hypothesis"
                onInput={(event) => setComposer("title", event.currentTarget.value)}
              />
            </label>
            <label class="flex flex-col gap-1 text-11-regular text-text-weak">
              Rationale
              <input
                type="text"
                data-field="rationale"
                class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
                value={composer.rationale}
                placeholder="Why does this matter?"
                onInput={(event) => setComposer("rationale", event.currentTarget.value)}
              />
            </label>
            <label class="flex flex-col gap-1 text-11-regular text-text-weak">
              Node kind
              <select
                data-field="node-kind"
                class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
                value={composer.nodeKind}
                onChange={(event) => setComposer("nodeKind", event.currentTarget.value)}
              >
                <For each={data()?.taxonomy.nodeKinds ?? []}>
                  {(kind) => <option value={kind}>{kind}</option>}
                </For>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-11-regular text-text-weak">
              Node title
              <input
                type="text"
                data-field="node-title"
                class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
                value={composer.nodeTitle}
                placeholder="Short descriptive title"
                onInput={(event) => setComposer("nodeTitle", event.currentTarget.value)}
              />
            </label>
          </div>
          <label class="mt-3 flex flex-col gap-1 text-11-regular text-text-weak">
            Node body (optional)
            <textarea
              data-field="node-body"
              rows={composer.nodeBody ? 6 : 3}
              class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong font-mono"
              value={composer.nodeBody}
              placeholder="Markdown or plaintext body. Pre-filled when coming from Sources."
              onInput={(event) => setComposer("nodeBody", event.currentTarget.value)}
            />
          </label>
          <label class="mt-3 flex flex-col gap-1 text-11-regular text-text-weak">
            Node data JSON (optional)
            <textarea
              data-field="node-data"
              rows={composer.nodeData ? 4 : 2}
              class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-11-regular text-text-strong font-mono"
              value={composer.nodeData}
              placeholder={`{ "path": "…", "origin": "unclaimed_source_file" }`}
              onInput={(event) => setComposer("nodeData", event.currentTarget.value)}
            />
          </label>
          <div class="mt-3 flex items-center gap-2">
            <input
              id="edge-toggle"
              type="checkbox"
              data-field="include-edge"
              checked={composer.includeEdge}
              onChange={(event) => setComposer("includeEdge", event.currentTarget.checked)}
            />
            <label for="edge-toggle" class="text-12-regular text-text-weak">
              Also add an edge to connect this node
            </label>
          </div>
          <Show when={composer.includeEdge}>
            <div class="mt-3 grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 text-11-regular text-text-weak">
                Edge kind
                <select
                  data-field="edge-kind"
                  class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
                  value={composer.edgeKind}
                  onChange={(event) => setComposer("edgeKind", event.currentTarget.value)}
                >
                  <For each={data()?.taxonomy.edgeKinds ?? []}>
                    {(kind) => <option value={kind}>{kind}</option>}
                  </For>
                </select>
              </label>
              <label class="flex flex-col gap-1 text-11-regular text-text-weak">
                Target node
                <select
                  data-field="edge-target"
                  class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
                  value={composer.edgeTargetID}
                  onChange={(event) => setComposer("edgeTargetID", event.currentTarget.value)}
                >
                  <option value="">— pick a target —</option>
                  <NodeOptions />
                </select>
              </label>
            </div>
          </Show>
          <div class="mt-3 flex items-center justify-between">
            <label class="flex items-center gap-2 text-12-regular text-text-weak">
              <input
                type="checkbox"
                data-field="auto-approve"
                checked={composer.autoApprove}
                onChange={(event) => setComposer("autoApprove", event.currentTarget.checked)}
              />
              Ship mode (auto-approve this proposal)
            </label>
            <Button
              variant="primary"
              size="small"
              type="submit"
              disabled={composer.submitting}
              data-action="composer-submit"
            >
              {composer.submitting ? <Spinner class="size-4" /> : "Submit proposal"}
            </Button>
          </div>
        </form>
      </Show>

      <div class="flex min-h-0 flex-1">
        <div
          class="w-72 shrink-0 overflow-y-auto border-r border-border-weak-base"
          data-component="proposal-list"
        >
          <Switch>
            <Match when={data.loading}>
              <div class="flex items-center justify-center py-8" data-component="proposal-list-loading">
                <Spinner class="size-4" />
              </div>
            </Match>
            <Match when={proposals().length === 0}>
              <div
                class="px-4 py-8 text-center text-12-regular text-text-weak"
                data-component="proposal-list-empty"
              >
                No {filter() === "pending" ? "pending " : ""}proposals yet.
              </div>
            </Match>
            <Match when={true}>
              <ul>
                <For each={proposals()}>
                  {(item) => (
                    <li>
                      <button
                        type="button"
                        data-component="proposal-item"
                        data-proposal-id={item.id}
                        data-status={item.status}
                        class={`flex w-full flex-col gap-1 border-b border-border-weak-base px-4 py-3 text-left hover:bg-surface-raised-base ${selected()?.id === item.id ? "bg-surface-raised-base" : ""}`}
                        onClick={() => select(item.id)}
                      >
                        <div class="flex items-center justify-between gap-2">
                          <span class="truncate text-12-medium text-text-strong">
                            {item.title?.trim() || `${item.changes.length} change${item.changes.length === 1 ? "" : "s"}`}
                          </span>
                          <span class={`text-10-medium uppercase tracking-wide ${statusTone(item.status)}`}>
                            {item.status}
                          </span>
                        </div>
                        <div class="flex items-center justify-between gap-2 text-11-regular text-text-weak">
                          <span class="truncate">{item.actor.type}:{item.actor.id}</span>
                          <span>{formatTime(item.time.updated)}</span>
                        </div>
                        <Show when={item.revision > 1}>
                          <span class="text-10-medium text-text-weak">rev {item.revision}</span>
                        </Show>
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Match>
          </Switch>
        </div>

        <div class="flex-1 overflow-y-auto" data-component="proposal-detail">
          <Show
            when={selected()}
            fallback={
              <div class="p-8 text-12-regular text-text-weak" data-component="proposal-detail-empty">
                Select a proposal to inspect it.
              </div>
            }
          >
            {(current) => (
              <div class="mx-auto max-w-3xl px-6 py-6" data-proposal-id={current().id}>
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">
                      {current().actor.type} · {formatTime(current().time.created)}
                      <Show when={current().revision > 1}> · rev {current().revision}</Show>
                    </div>
                    <h1 class="mt-1 text-20-medium text-text-strong" data-component="proposal-title">
                      {current().title?.trim() || `Proposal ${current().id}`}
                    </h1>
                  </div>
                  <div
                    class={`text-12-medium uppercase tracking-wide ${statusTone(current().status)}`}
                    data-component="proposal-status"
                  >
                    {current().status}
                  </div>
                </div>

                <Show when={current().rationale}>
                  <div
                    class="mt-4 rounded-lg bg-surface-raised-base px-4 py-3 text-13-regular text-text-strong whitespace-pre-wrap"
                    data-component="proposal-rationale"
                  >
                    {current().rationale}
                  </div>
                </Show>

                <div class="mt-6" data-component="proposal-changes">
                  <div class="text-11-medium uppercase tracking-wide text-text-weak">
                    Changes ({current().changes.length})
                  </div>
                  <div class="mt-2 flex flex-col gap-2">
                    <For each={current().changes}>
                      {(change) => <ChangeView change={change} />}
                    </For>
                  </div>
                </div>

                <Show when={selectedCommit()}>
                  {(commit) => (
                    <div
                      class="mt-6 rounded-lg border border-border-weak-base px-4 py-3"
                      data-component="proposal-commit"
                      data-commit-id={commit().id}
                    >
                      <div class="flex items-center gap-2">
                        <Icon name="circle-check" class="text-icon-success-base" size="small" />
                        <div class="text-12-medium text-text-strong">Committed</div>
                        <div class="text-11-regular text-text-weak">{commit().id}</div>
                      </div>
                      <div class="mt-1 text-11-regular text-text-weak">
                        {commit().actor.type}:{commit().actor.id} applied {commit().changes.length} change{commit().changes.length === 1 ? "" : "s"} · {formatTime(commit().time.created)}
                      </div>
                    </div>
                  )}
                </Show>

                <Show when={selectedReviews().length > 0}>
                  <div class="mt-6" data-component="proposal-reviews">
                    <div class="text-11-medium uppercase tracking-wide text-text-weak">Reviews</div>
                    <div class="mt-2 flex flex-col gap-2">
                      <For each={selectedReviews()}>
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
                  </div>
                </Show>

                <Show when={canReview() || canWithdraw()}>
                  <div
                    class="mt-8 flex flex-wrap items-center gap-2 border-t border-border-weak-base pt-4"
                    data-component="proposal-actions"
                  >
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
                  </div>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </div>
    </div>
  )

  function NodeOptions() {
    const nodes = createResource(
      () => version(),
      async () => {
        const res = await sdk.client.domain.node.list()
        return res.data ?? []
      },
    )[0]
    return (
      <Show when={nodes()}>
        {(list) => (
          <For each={list()}>
            {(item) => (
              <option value={item.id}>
                {item.kind}: {item.title}
              </option>
            )}
          </For>
        )}
      </Show>
    )
  }
}
