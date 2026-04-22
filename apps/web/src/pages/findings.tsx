import { createResource, createSignal, For, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useParams } from "@solidjs/router"
import { Button } from "@palimpsest/ui/button"

import {
  type SecurityConfidence,
  type SecurityFindingCard,
  type SecurityProposalSummary,
  type SecurityRiskKind,
  type SecuritySeverity,
  type SecurityValidationOutcome,
  useSecurityAudit,
} from "@/context/security-audit"

const SEVERITIES: SecuritySeverity[] = ["low", "medium", "high", "critical"]
const CONFIDENCES: SecurityConfidence[] = ["low", "medium", "high"]
const OUTCOMES: SecurityValidationOutcome[] = ["supports", "contradicts", "needs_validation"]
const RISK_KINDS: SecurityRiskKind[] = [
  "accept_risk",
  "mitigate_risk",
  "false_positive",
  "needs_validation",
  "defer_risk",
]

function severityTone(severity?: string) {
  if (severity === "critical") return "text-icon-critical-base"
  if (severity === "high") return "text-icon-warning-base"
  if (severity === "medium") return "text-text-strong"
  return "text-text-weak"
}

function dataField(data: Record<string, unknown> | undefined, field: string): string | undefined {
  if (!data) return undefined
  const value = data[field]
  return typeof value === "string" ? value : undefined
}

type HypothesisForm = {
  open: boolean
  title: string
  description: string
  evidence: string
  severity: SecuritySeverity
  confidence: SecurityConfidence
  submitting: boolean
}

type ValidateForm = {
  open: boolean
  findingID?: string
  findingTitle?: string
  summary: string
  evidence: string
  outcome: SecurityValidationOutcome
  submitting: boolean
}

type RiskForm = {
  open: boolean
  nodeID?: string
  nodeTitle?: string
  kind: SecurityRiskKind
  rationale: string
  evidence: string
  submitting: boolean
}

function emptyHypothesis(): HypothesisForm {
  return {
    open: false,
    title: "",
    description: "",
    evidence: "",
    severity: "medium",
    confidence: "medium",
    submitting: false,
  }
}

function emptyValidate(): ValidateForm {
  return {
    open: false,
    findingID: undefined,
    findingTitle: undefined,
    summary: "",
    evidence: "",
    outcome: "needs_validation",
    submitting: false,
  }
}

function emptyRisk(): RiskForm {
  return {
    open: false,
    nodeID: undefined,
    nodeTitle: undefined,
    kind: "needs_validation",
    rationale: "",
    evidence: "",
    submitting: false,
  }
}

export default function Findings(): JSX.Element {
  const params = useParams()
  const audit = useSecurityAudit(() => params.dir)

  const [refreshKey, setRefreshKey] = createSignal(0)
  const [findings, { refetch }] = createResource(refreshKey, () => audit.findings().catch(() => undefined))
  const [error, setError] = createSignal<string | undefined>()
  const [reviewingID, setReviewingID] = createSignal<string | undefined>()

  const [hypothesis, setHypothesis] = createStore<HypothesisForm>(emptyHypothesis())
  const [validate, setValidate] = createStore<ValidateForm>(emptyValidate())
  const [risk, setRisk] = createStore<RiskForm>(emptyRisk())

  function openHypothesis() {
    setHypothesis(emptyHypothesis())
    setHypothesis("open", true)
  }

  function openValidate(finding: SecurityFindingCard) {
    setValidate(emptyValidate())
    setValidate({ open: true, findingID: finding.id, findingTitle: finding.title })
  }

  function openRisk(finding: SecurityFindingCard) {
    setRisk(emptyRisk())
    setRisk({ open: true, nodeID: finding.id, nodeTitle: finding.title })
  }

  async function submitHypothesis(event: Event) {
    event.preventDefault()
    if (hypothesis.submitting) return
    if (!hypothesis.title.trim() || !hypothesis.description.trim()) {
      setError("Hypothesis needs a title (3+ chars) and a description (10+ chars).")
      return
    }
    setHypothesis("submitting", true)
    setError(undefined)
    try {
      await audit.hypothesize({
        title: hypothesis.title.trim(),
        description: hypothesis.description.trim(),
        evidence: hypothesis.evidence.trim() || undefined,
        severity: hypothesis.severity,
        confidence: hypothesis.confidence,
      })
      setHypothesis(emptyHypothesis())
      await refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setHypothesis("submitting", false)
    }
  }

  async function submitValidate(event: Event) {
    event.preventDefault()
    if (validate.submitting) return
    if (!validate.findingID || !validate.summary.trim()) {
      setError("Validation needs a target finding and a summary (10+ chars).")
      return
    }
    setValidate("submitting", true)
    setError(undefined)
    try {
      await audit.validate({
        findingID: validate.findingID,
        summary: validate.summary.trim(),
        evidence: validate.evidence.trim() || undefined,
        outcome: validate.outcome,
      })
      setValidate(emptyValidate())
      await refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setValidate("submitting", false)
    }
  }

  async function submitRisk(event: Event) {
    event.preventDefault()
    if (risk.submitting) return
    if (!risk.nodeID || !risk.rationale.trim()) {
      setError("Risk decision needs a node and a rationale (10+ chars).")
      return
    }
    setRisk("submitting", true)
    setError(undefined)
    try {
      await audit.riskDecision({
        nodeID: risk.nodeID,
        kind: risk.kind,
        rationale: risk.rationale.trim(),
        evidence: risk.evidence.trim() || undefined,
      })
      setRisk(emptyRisk())
      await refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRisk("submitting", false)
    }
  }

  async function review(proposal: SecurityProposalSummary, verdict: "approve" | "reject") {
    setReviewingID(proposal.id)
    setError(undefined)
    try {
      await audit.review({
        proposalID: proposal.id,
        verdict,
        comments: verdict === "approve" ? "Approved from findings." : "Rejected from findings.",
      })
      await refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setReviewingID(undefined)
    }
  }

  return (
    <div class="flex h-full flex-col gap-4 overflow-y-auto p-6" data-component="findings-page">
      <header class="flex items-center justify-between">
        <div>
          <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Security Audit</div>
          <h1 class="mt-1 text-20-medium text-text-strong">Findings</h1>
          <div class="mt-1 text-12-regular text-text-weak">
            Pending finding hypotheses and committed findings, with severity and validation state.
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="secondary" size="small" onClick={() => setRefreshKey((v) => v + 1)}>
            Refresh
          </Button>
          <Button variant="primary" size="small" data-action="open-hypothesis" onClick={openHypothesis}>
            New hypothesis
          </Button>
        </div>
      </header>

      <Show when={error()}>
        <div
          class="rounded-2xl border border-border-critical-base bg-surface-critical-base px-4 py-3 text-12-regular text-text-critical-base"
          data-component="findings-error"
        >
          {error()}
        </div>
      </Show>

      <Show when={hypothesis.open}>
        <form
          class="rounded-2xl border border-border-weak-base bg-surface-raised-base px-4 py-4"
          data-component="hypothesis-form"
          onSubmit={submitHypothesis}
        >
          <div class="flex items-center justify-between">
            <div class="text-13-medium text-text-strong">New finding hypothesis</div>
            <button
              type="button"
              data-action="hypothesis-cancel"
              class="text-12-regular text-text-weak hover:text-text-strong"
              onClick={() => setHypothesis("open", false)}
            >
              Cancel
            </button>
          </div>
          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <label class="flex flex-col gap-1 text-11-regular text-text-weak">
              Title
              <input
                type="text"
                data-field="hypothesis-title"
                class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
                value={hypothesis.title}
                placeholder="e.g. Session fixation candidate"
                onInput={(e) => setHypothesis("title", e.currentTarget.value)}
              />
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 text-11-regular text-text-weak">
                Severity
                <select
                  data-field="hypothesis-severity"
                  class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
                  value={hypothesis.severity}
                  onChange={(e) => setHypothesis("severity", e.currentTarget.value as SecuritySeverity)}
                >
                  <For each={SEVERITIES}>{(s) => <option value={s}>{s}</option>}</For>
                </select>
              </label>
              <label class="flex flex-col gap-1 text-11-regular text-text-weak">
                Confidence
                <select
                  data-field="hypothesis-confidence"
                  class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
                  value={hypothesis.confidence}
                  onChange={(e) => setHypothesis("confidence", e.currentTarget.value as SecurityConfidence)}
                >
                  <For each={CONFIDENCES}>{(c) => <option value={c}>{c}</option>}</For>
                </select>
              </label>
            </div>
          </div>
          <label class="mt-3 flex flex-col gap-1 text-11-regular text-text-weak">
            Description
            <textarea
              data-field="hypothesis-description"
              rows={3}
              class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
              value={hypothesis.description}
              placeholder="What is the suspected weakness, and what behaviour hints at it?"
              onInput={(e) => setHypothesis("description", e.currentTarget.value)}
            />
          </label>
          <label class="mt-3 flex flex-col gap-1 text-11-regular text-text-weak">
            Evidence (optional)
            <textarea
              data-field="hypothesis-evidence"
              rows={3}
              class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
              value={hypothesis.evidence}
              placeholder="Pointers to code, traces, or earlier audit notes."
              onInput={(e) => setHypothesis("evidence", e.currentTarget.value)}
            />
          </label>
          <div class="mt-3 flex items-center justify-end">
            <Button
              variant="primary"
              size="small"
              type="submit"
              data-action="hypothesis-submit"
              disabled={hypothesis.submitting}
            >
              {hypothesis.submitting ? "Submitting..." : "Create proposal"}
            </Button>
          </div>
        </form>
      </Show>

      <Show when={validate.open}>
        <form
          class="rounded-2xl border border-border-weak-base bg-surface-raised-base px-4 py-4"
          data-component="validate-form"
          onSubmit={submitValidate}
        >
          <div class="flex items-center justify-between">
            <div class="text-13-medium text-text-strong">
              Validate: {validate.findingTitle ?? validate.findingID}
            </div>
            <button
              type="button"
              data-action="validate-cancel"
              class="text-12-regular text-text-weak hover:text-text-strong"
              onClick={() => setValidate("open", false)}
            >
              Cancel
            </button>
          </div>
          <label class="mt-3 flex flex-col gap-1 text-11-regular text-text-weak">
            Outcome
            <select
              data-field="validate-outcome"
              class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
              value={validate.outcome}
              onChange={(e) => setValidate("outcome", e.currentTarget.value as SecurityValidationOutcome)}
            >
              <For each={OUTCOMES}>{(o) => <option value={o}>{o}</option>}</For>
            </select>
          </label>
          <label class="mt-3 flex flex-col gap-1 text-11-regular text-text-weak">
            Summary
            <textarea
              data-field="validate-summary"
              rows={3}
              class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
              value={validate.summary}
              placeholder="What did the validation show, and why does it support/contradict the hypothesis?"
              onInput={(e) => setValidate("summary", e.currentTarget.value)}
            />
          </label>
          <label class="mt-3 flex flex-col gap-1 text-11-regular text-text-weak">
            Evidence (optional)
            <textarea
              data-field="validate-evidence"
              rows={3}
              class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
              value={validate.evidence}
              placeholder="Trace links, repro steps, or pointers to data."
              onInput={(e) => setValidate("evidence", e.currentTarget.value)}
            />
          </label>
          <div class="mt-3 flex items-center justify-end">
            <Button
              variant="primary"
              size="small"
              type="submit"
              data-action="validate-submit"
              disabled={validate.submitting}
            >
              {validate.submitting ? "Submitting..." : "Record validation"}
            </Button>
          </div>
        </form>
      </Show>

      <Show when={risk.open}>
        <form
          class="rounded-2xl border border-border-weak-base bg-surface-raised-base px-4 py-4"
          data-component="risk-form"
          onSubmit={submitRisk}
        >
          <div class="flex items-center justify-between">
            <div class="text-13-medium text-text-strong">
              Risk decision: {risk.nodeTitle ?? risk.nodeID}
            </div>
            <button
              type="button"
              data-action="risk-cancel"
              class="text-12-regular text-text-weak hover:text-text-strong"
              onClick={() => setRisk("open", false)}
            >
              Cancel
            </button>
          </div>
          <label class="mt-3 flex flex-col gap-1 text-11-regular text-text-weak">
            Decision
            <select
              data-field="risk-kind"
              class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
              value={risk.kind}
              onChange={(e) => setRisk("kind", e.currentTarget.value as SecurityRiskKind)}
            >
              <For each={RISK_KINDS}>{(k) => <option value={k}>{k.replaceAll("_", " ")}</option>}</For>
            </select>
          </label>
          <label class="mt-3 flex flex-col gap-1 text-11-regular text-text-weak">
            Rationale
            <textarea
              data-field="risk-rationale"
              rows={3}
              class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
              value={risk.rationale}
              placeholder="Why this posture? What mitigates or compounds it?"
              onInput={(e) => setRisk("rationale", e.currentTarget.value)}
            />
          </label>
          <label class="mt-3 flex flex-col gap-1 text-11-regular text-text-weak">
            Evidence (optional)
            <textarea
              data-field="risk-evidence"
              rows={3}
              class="rounded-md border border-border-weak-base bg-background-base px-2 py-1.5 text-12-regular text-text-strong"
              value={risk.evidence}
              placeholder="References that back the decision."
              onInput={(e) => setRisk("evidence", e.currentTarget.value)}
            />
          </label>
          <div class="mt-3 flex items-center justify-end">
            <Button
              variant="primary"
              size="small"
              type="submit"
              data-action="risk-submit"
              disabled={risk.submitting}
            >
              {risk.submitting ? "Submitting..." : "Record decision"}
            </Button>
          </div>
        </form>
      </Show>

      <section class="rounded-2xl bg-surface-raised-base px-4 py-4" data-component="findings-pending">
        <div class="flex items-center justify-between">
          <div class="text-11-medium uppercase tracking-wide text-text-weak">Pending Hypotheses</div>
          <div class="text-11-regular text-text-weak">{findings()?.pendingProposals.length ?? 0}</div>
        </div>
        <div class="mt-3 flex flex-col gap-2">
          <For each={findings()?.pendingProposals ?? []}>
            {(item) => (
              <div class="rounded-xl bg-background-base px-3 py-3" data-proposal-id={item.id}>
                <div class="flex items-center justify-between gap-2">
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
          <div class="text-11-regular text-text-weak">{findings()?.findings.length ?? 0}</div>
        </div>
        <div class="mt-3 flex flex-col gap-2">
          <For each={findings()?.findings ?? []}>
            {(finding) => {
              const severity = () => dataField(finding.data, "severity")
              const confidence = () => dataField(finding.data, "confidence")
              const status = () => dataField(finding.data, "status")
              const validation = () => dataField(finding.data, "validationStatus")
              return (
                <div class="rounded-xl bg-background-base px-3 py-3" data-finding-id={finding.id}>
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-13-medium text-text-strong">{finding.title ?? finding.id}</div>
                    <span class={`text-10-medium uppercase tracking-wide ${severityTone(severity())}`}>
                      {severity() ?? "—"}
                    </span>
                  </div>
                  <Show when={finding.body}>
                    <div class="mt-1 text-11-regular text-text-weak line-clamp-2">{finding.body}</div>
                  </Show>
                  <div class="mt-2 flex flex-wrap gap-3 text-10-medium uppercase tracking-wide text-text-weak">
                    <Show when={status()}>
                      <span>{status()}</span>
                    </Show>
                    <Show when={confidence()}>
                      <span>confidence: {confidence()}</span>
                    </Show>
                    <Show when={validation()}>
                      <span>validation: {validation()}</span>
                    </Show>
                    <Show when={(finding.evidenceCount ?? 0) > 0}>
                      <span>evidence: {finding.evidenceCount}</span>
                    </Show>
                  </div>
                  <div class="mt-2 flex items-center justify-between gap-2">
                    <div class="text-10-regular text-text-weak">
                      {finding.id} · {new Date(finding.time.updated).toLocaleString()}
                    </div>
                    <div class="flex items-center gap-1">
                      <Button
                        variant="secondary"
                        size="small"
                        data-action="open-validate"
                        onClick={() => openValidate(finding)}
                      >
                        Validate
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        data-action="open-risk"
                        onClick={() => openRisk(finding)}
                      >
                        Decide risk
                      </Button>
                    </div>
                  </div>
                </div>
              )
            }}
          </For>
          <Show when={(findings()?.findings ?? []).length === 0}>
            <div class="rounded-xl bg-background-base px-3 py-3 text-12-regular text-text-weak">
              No committed findings yet.
            </div>
          </Show>
        </div>
      </section>
    </div>
  )
}
