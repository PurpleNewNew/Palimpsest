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
import { Spinner } from "@palimpsest/ui/spinner"
import { showToast } from "@palimpsest/ui/toast"

import { useAuth } from "@/context/auth"
import { type Member, type ReviewQueueItem, type ReviewQueuePriority, usePhase7 } from "@/context/phase7"
import { useCanReview, useCanWrite } from "@/context/permissions"
import { useSDK } from "@/context/sdk"

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

type ProposalQueueView = {
  proposal: DomainProposal
  queue?: ReviewQueueItem
  assignee?: Member["user"]
  dueAt?: number
  stale: boolean
  dueSoon: boolean
  breached: boolean
}

const QUEUE_PRIORITIES: ReviewQueuePriority[] = ["urgent", "high", "normal", "low"]
const PRIORITY_RANK: Record<ReviewQueuePriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
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

function priorityTone(priority: ReviewQueuePriority) {
  if (priority === "urgent") return "text-icon-critical-base"
  if (priority === "high") return "text-icon-warning-base"
  if (priority === "normal") return "text-text-strong"
  return "text-text-weak"
}

function formatTime(ms: number) {
  const diff = Date.now() - ms
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ms).toLocaleDateString()
}

function formatDue(ms?: number) {
  if (!ms) return "No due date"
  return new Date(ms).toLocaleString()
}

function toDatetimeLocal(ms?: number) {
  if (!ms) return ""
  const value = new Date(ms)
  const offset = value.getTimezoneOffset()
  const local = new Date(value.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function fromDatetimeLocal(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const ms = new Date(trimmed).getTime()
  return Number.isFinite(ms) ? ms : null
}

function queueDueAt(proposal: DomainProposal, queue?: ReviewQueueItem) {
  if (queue?.dueAt) return queue.dueAt
  if (queue?.slaHours) return proposal.time.created + queue.slaHours * 3_600_000
  return undefined
}

export default function Reviews(): JSX.Element {
  const sdk = useSDK()
  const auth = useAuth()
  const navigate = useNavigate()
  const params = useParams()
  const canWrite = useCanWrite()
  const canReview = useCanReview()
  const phase7 = usePhase7(() => params.dir)

  const [version, setVersion] = createSignal(0)
  const [filter, setFilter] = createSignal<"pending" | "all">("pending")
  const [search, setSearch] = createSignal("")
  const [actorFilter, setActorFilter] = createSignal("")
  const [assigneeFilter, setAssigneeFilter] = createSignal("")
  const [queueFilter, setQueueFilter] = createSignal<"all" | "stale" | "due_soon" | "breached">("all")
  const [busyQueueID, setBusyQueueID] = createSignal<string | undefined>()

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

  const [members] = createResource(
    () => (auth.workspaceID() ? { workspaceID: auth.workspaceID()!, version: version() } : undefined),
    ({ workspaceID }) => phase7.members(workspaceID).catch(() => []),
  )

  const [queue, { refetch: refetchQueue }] = createResource(
    () => {
      const workspaceID = auth.workspaceID()
      const projectID = data()?.context.project.id
      if (!workspaceID || !projectID) return
      return { workspaceID, projectID, version: version() }
    },
    ({ workspaceID, projectID }) => phase7.reviewQueue(workspaceID, projectID).catch(() => []),
  )

  const memberMap = createMemo(() => new Map((members() ?? []).map((member) => [member.user.id, member.user])))
  const queueMap = createMemo(() => new Map((queue() ?? []).map((item) => [item.proposalID, item])))

  const proposals = createMemo(() => {
    const list = data()?.proposals ?? []
    const now = Date.now()
    const withQueue = list.map((proposal) => {
      const queueItem = queueMap().get(proposal.id)
      const dueAt = queueDueAt(proposal, queueItem)
      const stale = proposal.status === "pending" && now - proposal.time.updated > 48 * 3_600_000
      const dueSoon = proposal.status === "pending" && !!dueAt && dueAt > now && dueAt - now <= 24 * 3_600_000
      const breached = proposal.status === "pending" && !!dueAt && dueAt <= now
      return {
        proposal,
        queue: queueItem,
        assignee: queueItem?.assigneeUserID ? memberMap().get(queueItem.assigneeUserID) : undefined,
        dueAt,
        stale,
        dueSoon,
        breached,
      } satisfies ProposalQueueView
    })
    const byStatus = filter() === "pending" ? withQueue.filter((item) => item.proposal.status === "pending") : withQueue
    const q = search().trim().toLowerCase()
    const byText = q
      ? byStatus.filter(
          (item) =>
            (item.proposal.title ?? "").toLowerCase().includes(q) ||
            (item.proposal.rationale ?? "").toLowerCase().includes(q) ||
            item.proposal.id.toLowerCase().includes(q),
        )
      : byStatus
    const actor = actorFilter()
    const byActor = actor ? byText.filter((item) => item.proposal.actor.id === actor) : byText
    const assignee = assigneeFilter()
    const byAssignee =
      assignee === "__mine__"
        ? byActor.filter((item) => item.queue?.assigneeUserID === auth.user()?.id)
        : assignee === "__unassigned__"
          ? byActor.filter((item) => !item.queue?.assigneeUserID)
          : assignee
            ? byActor.filter((item) => item.queue?.assigneeUserID === assignee)
            : byActor
    const queueState = queueFilter()
    const byQueueState =
      queueState === "stale"
        ? byAssignee.filter((item) => item.stale)
        : queueState === "due_soon"
          ? byAssignee.filter((item) => item.dueSoon)
          : queueState === "breached"
            ? byAssignee.filter((item) => item.breached)
            : byAssignee

    return byQueueState.slice().sort((a, b) => {
      if (a.breached !== b.breached) return a.breached ? -1 : 1
      if (a.dueSoon !== b.dueSoon) return a.dueSoon ? -1 : 1
      const priorityDiff = PRIORITY_RANK[b.queue?.priority ?? "normal"] - PRIORITY_RANK[a.queue?.priority ?? "normal"]
      if (priorityDiff !== 0) return priorityDiff
      return b.proposal.time.updated - a.proposal.time.updated
    })
  })

  const queueSummary = createMemo(() => {
    const items = proposals()
    return {
      total: items.length,
      pending: items.filter((item) => item.proposal.status === "pending").length,
      assigned: items.filter((item) => !!item.queue?.assigneeUserID).length,
      unassigned: items.filter((item) => !item.queue?.assigneeUserID).length,
      breached: items.filter((item) => item.breached).length,
      dueSoon: items.filter((item) => item.dueSoon).length,
      stale: items.filter((item) => item.stale).length,
      urgent: items.filter((item) => (item.queue?.priority ?? "normal") === "urgent").length,
    }
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

  async function updateQueue(
    proposalID: string,
    patch: {
      assigneeUserID?: string | null
      priority?: ReviewQueuePriority
      dueAt?: number | null
      slaHours?: number | null
    },
  ) {
    setBusyQueueID(proposalID)
    try {
      await phase7.setReviewQueue(proposalID, patch)
      await refetchQueue()
    } catch (err) {
      showToast({ variant: "error", title: "Failed to update review queue", description: String((err as Error).message ?? err) })
    } finally {
      setBusyQueueID(undefined)
    }
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

  return (
    <div class="flex h-full flex-col bg-background-base" data-component="reviews-inbox">
      <div class="flex flex-col gap-3 border-b border-border-weak-base px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Reviews</div>
            <div class="mt-1 text-20-medium text-text-strong">Proposal inbox</div>
            <div class="mt-1 text-12-regular text-text-weak">
              Pending review queue with assignees, priority, due windows, and resulting commits.
            </div>
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
            <Button
              variant="primary"
              size="small"
              data-action="open-composer"
              onClick={openComposer}
              disabled={!canWrite()}
            >
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
            <For each={actorOptions()}>{(actor) => <option value={actor.id}>{actor.label}</option>}</For>
          </select>
          <select
            data-component="reviews-assignee-filter"
            class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
            value={assigneeFilter()}
            onChange={(e) => setAssigneeFilter(e.currentTarget.value)}
          >
            <option value="">All assignees</option>
            <option value="__mine__">Assigned to me</option>
            <option value="__unassigned__">Unassigned</option>
            <For each={members() ?? []}>
              {(member) => <option value={member.user.id}>{member.user.displayName ?? member.user.username}</option>}
            </For>
          </select>
          <select
            data-component="reviews-queue-filter"
            class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
            value={queueFilter()}
            onChange={(e) => setQueueFilter(e.currentTarget.value as "all" | "stale" | "due_soon" | "breached")}
          >
            <option value="all">All queue states</option>
            <option value="stale">Stale</option>
            <option value="due_soon">Due soon</option>
            <option value="breached">Breached SLA</option>
          </select>
          <div class="text-11-regular text-text-weak">
            Showing {proposals().length} of {data()?.proposals.length ?? 0}
          </div>
        </div>
        <div class="grid gap-2 md:grid-cols-4 xl:grid-cols-8" data-component="review-queue-summary">
          <QueueCard label="Pending" value={queueSummary().pending} tone="base" />
          <QueueCard label="Assigned" value={queueSummary().assigned} tone="base" />
          <QueueCard label="Unassigned" value={queueSummary().unassigned} tone="weak" />
          <QueueCard label="Urgent" value={queueSummary().urgent} tone="warning" />
          <QueueCard label="Due soon" value={queueSummary().dueSoon} tone="warning" />
          <QueueCard label="Breached" value={queueSummary().breached} tone="critical" />
          <QueueCard label="Stale" value={queueSummary().stale} tone="weak" />
          <QueueCard label="Visible" value={queueSummary().total} tone="base" />
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
                <For each={data()?.taxonomy.nodeKinds ?? []}>{(kind) => <option value={kind}>{kind}</option>}</For>
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
                  <For each={data()?.taxonomy.edgeKinds ?? []}>{(kind) => <option value={kind}>{kind}</option>}</For>
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

      <div class="min-h-0 flex-1 overflow-y-auto" data-component="proposal-list">
        <Switch>
          <Match when={data.loading}>
            <div class="flex items-center justify-center py-8" data-component="proposal-list-loading">
              <Spinner class="size-4" />
            </div>
          </Match>
          <Match when={proposals().length === 0}>
            <div class="px-6 py-12 text-center text-12-regular text-text-weak" data-component="proposal-list-empty">
              No {filter() === "pending" ? "pending " : ""}proposals yet.
            </div>
          </Match>
          <Match when={true}>
            <ul class="divide-y divide-border-weak-base">
              <For each={proposals()}>
                {(item) => {
                  const queueItem = () => item.queue
                  const dueAt = () => item.dueAt
                  return (
                    <li class="px-6 py-3" data-component="proposal-item" data-proposal-id={item.proposal.id}>
                      <button
                        type="button"
                        data-action="open-proposal"
                        class="flex w-full flex-col gap-1 rounded-xl px-3 py-3 text-left hover:bg-surface-raised-base"
                        onClick={() => select(item.proposal.id)}
                      >
                        <div class="flex items-center justify-between gap-2">
                          <span class="truncate text-13-medium text-text-strong">
                            {item.proposal.title?.trim() ||
                              `${item.proposal.changes.length} change${item.proposal.changes.length === 1 ? "" : "s"}`}
                          </span>
                          <div class="flex items-center gap-2">
                            <Show when={item.breached}>
                              <span class="text-10-medium uppercase tracking-wide text-icon-critical-base">breached</span>
                            </Show>
                            <Show when={!item.breached && item.dueSoon}>
                              <span class="text-10-medium uppercase tracking-wide text-icon-warning-base">due soon</span>
                            </Show>
                            <span class={`text-10-medium uppercase tracking-wide ${statusTone(item.proposal.status)}`}>
                              {item.proposal.status}
                            </span>
                          </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-11-regular text-text-weak">
                          <span>
                            {item.proposal.actor.type}:{item.proposal.actor.id}
                          </span>
                          <span>{item.proposal.changes.length} change{item.proposal.changes.length === 1 ? "" : "s"}</span>
                          <span class={priorityTone(queueItem()?.priority ?? "normal")}>
                            priority {queueItem()?.priority ?? "normal"}
                          </span>
                          <span>assignee {item.assignee?.displayName ?? item.assignee?.username ?? "unassigned"}</span>
                          <span>due {formatDue(dueAt())}</span>
                          <Show when={queueItem()?.slaHours}>
                            {(slaHours) => <span>SLA {slaHours()}h</span>}
                          </Show>
                          <span>{formatTime(item.proposal.time.updated)}</span>
                        </div>
                        <Show when={item.proposal.rationale}>
                          <div class="truncate text-11-regular text-text-weak">{item.proposal.rationale}</div>
                        </Show>
                      </button>

                      <Show when={canReview()}>
                        <div class="mt-2 grid gap-2 rounded-xl bg-surface-raised-base px-3 py-3 md:grid-cols-5">
                          <label class="flex flex-col gap-1 text-10-medium uppercase tracking-wide text-text-weak">
                            Assignee
                            <select
                              data-action="set-assignee"
                              class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
                              disabled={busyQueueID() === item.proposal.id}
                              value={queueItem()?.assigneeUserID ?? ""}
                              onChange={(event) =>
                                void updateQueue(item.proposal.id, {
                                  assigneeUserID: event.currentTarget.value || null,
                                })
                              }
                            >
                              <option value="">Unassigned</option>
                              <For each={members() ?? []}>
                                {(member) => (
                                  <option value={member.user.id}>
                                    {member.user.displayName ?? member.user.username}
                                  </option>
                                )}
                              </For>
                            </select>
                          </label>
                          <div class="flex flex-col gap-1 text-10-medium uppercase tracking-wide text-text-weak">
                            Quick assign
                            <Button
                              variant="secondary"
                              size="small"
                              data-action="assign-to-me"
                              disabled={
                                busyQueueID() === item.proposal.id ||
                                !auth.user()?.id ||
                                queueItem()?.assigneeUserID === auth.user()?.id
                              }
                              onClick={() =>
                                auth.user()?.id
                                  ? void updateQueue(item.proposal.id, {
                                      assigneeUserID: auth.user()!.id,
                                    })
                                  : undefined
                              }
                            >
                              {queueItem()?.assigneeUserID === auth.user()?.id ? "Assigned to me" : "Assign to me"}
                            </Button>
                          </div>
                          <label class="flex flex-col gap-1 text-10-medium uppercase tracking-wide text-text-weak">
                            Priority
                            <select
                              data-action="set-priority"
                              class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
                              disabled={busyQueueID() === item.proposal.id}
                              value={queueItem()?.priority ?? "normal"}
                              onChange={(event) =>
                                void updateQueue(item.proposal.id, {
                                  priority: event.currentTarget.value as ReviewQueuePriority,
                                })
                              }
                            >
                              <For each={QUEUE_PRIORITIES}>{(priority) => <option value={priority}>{priority}</option>}</For>
                            </select>
                          </label>
                          <label class="flex flex-col gap-1 text-10-medium uppercase tracking-wide text-text-weak">
                            Due
                            <input
                              type="datetime-local"
                              data-action="set-due-at"
                              class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
                              disabled={busyQueueID() === item.proposal.id}
                              value={toDatetimeLocal(queueItem()?.dueAt)}
                              onChange={(event) =>
                                void updateQueue(item.proposal.id, {
                                  dueAt: fromDatetimeLocal(event.currentTarget.value),
                                })
                              }
                            />
                          </label>
                          <label class="flex flex-col gap-1 text-10-medium uppercase tracking-wide text-text-weak">
                            SLA
                            <select
                              data-action="set-sla-hours"
                              class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
                              disabled={busyQueueID() === item.proposal.id}
                              value={String(queueItem()?.slaHours ?? 48)}
                              onChange={(event) =>
                                void updateQueue(item.proposal.id, {
                                  slaHours: Number(event.currentTarget.value),
                                })
                              }
                            >
                              <option value="24">24h</option>
                              <option value="48">48h</option>
                              <option value="72">72h</option>
                              <option value="168">168h</option>
                            </select>
                          </label>
                        </div>
                      </Show>
                    </li>
                  )
                }}
              </For>
            </ul>
          </Match>
        </Switch>
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

function QueueCard(props: { label: string; value: number; tone: "base" | "weak" | "warning" | "critical" }) {
  const toneClass =
    props.tone === "critical"
      ? "text-icon-critical-base"
      : props.tone === "warning"
        ? "text-icon-warning-base"
        : props.tone === "weak"
          ? "text-text-weak"
          : "text-text-strong"
  return (
    <div class="rounded-2xl bg-surface-raised-base px-3 py-3">
      <div class={`text-16-medium ${toneClass}`}>{props.value}</div>
      <div class="text-10-medium uppercase tracking-wide text-text-weak">{props.label}</div>
    </div>
  )
}
