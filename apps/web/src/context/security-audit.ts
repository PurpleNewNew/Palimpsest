import { createMemo } from "solid-js"

import { useAuth } from "@/context/auth"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { serverFetch } from "@/utils/server"

export type SecurityActor = { type: "user" | "agent" | "system"; id: string; version?: string }

export type SecurityProposalSummary = {
  id: string
  title?: string
  rationale?: string
  status?: string
  revision?: number
  actor?: SecurityActor
  refs?: Record<string, unknown>
  time?: { created: number; updated: number }
}

export type SecurityNode = {
  id: string
  kind: string
  title: string
  body?: string
  data?: Record<string, unknown>
  time: { created: number; updated: number }
}

export type SecurityEdge = {
  id?: string
  kind: string
  sourceID: string
  targetID: string
  note?: string
}

export type SecurityFindingCard = SecurityNode & {
  evidenceCount?: number
  relatedDecisionKinds?: string[]
  links?: SecurityEdge[]
}

export type SecurityOverview = {
  pluginID: string
  projectID?: string
  scope?: {
    target: string
    objective: string
    constraints: string
  }
  summary?: Record<string, number>
  nodeCounts?: Record<string, number>
  runCounts?: Record<string, number>
  decisionCounts?: Record<string, number>
  pendingProposals: SecurityProposalSummary[]
  recentCommits: Array<{ id: string; proposalID?: string; changeCount?: number; time: { created: number } }>
}

export type SecurityFindings = {
  findings: SecurityFindingCard[]
  risks: SecurityNode[]
  surfaces: SecurityNode[]
  controls: SecurityNode[]
  pendingProposals: SecurityProposalSummary[]
}

export type SecuritySeverity = "low" | "medium" | "high" | "critical"
export type SecurityConfidence = "low" | "medium" | "high"
export type SecurityValidationOutcome = "supports" | "contradicts" | "needs_validation"
export type SecurityRiskKind = "accept_risk" | "mitigate_risk" | "false_positive" | "needs_validation" | "defer_risk"
export type SecurityRiskState = "accepted" | "rejected" | "pending"

export function useSecurityAudit(getDirectory: () => string | undefined) {
  const auth = useAuth()
  const platform = usePlatform()
  const server = useServer()

  const send = createMemo(() => {
    const http = server.current?.http
    if (!http) return
    return serverFetch(http, platform.fetch ?? globalThis.fetch)
  })

  const base = createMemo(() => server.current?.http.url)

  async function json<T>(path: string, init?: RequestInit): Promise<T> {
    const run = send()
    const root = base()
    if (!run || !root) throw new Error("No server available")
    const dir = getDirectory()
    const url = new URL(path, root)
    if (dir) url.searchParams.set("directory", dir)
    const headers = new Headers(init?.headers)
    if (auth.workspaceID()) headers.set("x-palimpsest-workspace", auth.workspaceID()!)
    if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json")
    const res = await run(url, { ...init, headers })
    if (!res.ok) {
      const body = await res.json().catch(() => undefined)
      const message =
        body && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? (body.message as string)
          : `Request failed: ${res.status}`
      throw new Error(message)
    }
    return (await res.json()) as T
  }

  function currentActor(): SecurityActor {
    const user = auth.user()
    if (user) return { type: "user", id: user.id }
    return { type: "system", id: "web" }
  }

  return {
    actor: currentActor,
    status() {
      return json<{ pluginID: string; prompts: string[]; workflows: string[] }>(
        `/api/plugin/security-audit/status`,
      )
    },
    overview() {
      return json<SecurityOverview>(`/api/plugin/security-audit/overview`)
    },
    findings() {
      return json<SecurityFindings>(`/api/plugin/security-audit/findings`)
    },
    bootstrap(input?: { target?: string; objective?: string; constraints?: string; sessionID?: string }) {
      return json<SecurityProposalSummary>(`/api/plugin/security-audit/bootstrap`, {
        method: "POST",
        body: JSON.stringify(input ?? {}),
      })
    },
    hypothesize(input: {
      title: string
      description: string
      evidence?: string
      severity?: SecuritySeverity
      confidence?: SecurityConfidence
      targetID?: string
      surfaceID?: string
      riskTitle?: string
      sessionID?: string
    }) {
      return json<SecurityProposalSummary>(`/api/plugin/security-audit/finding-hypothesis`, {
        method: "POST",
        body: JSON.stringify(input),
      })
    },
    validate(input: {
      findingID: string
      summary: string
      evidence?: string
      outcome?: SecurityValidationOutcome
      sessionID?: string
    }) {
      return json<SecurityProposalSummary>(`/api/plugin/security-audit/validate-finding`, {
        method: "POST",
        body: JSON.stringify(input),
      })
    },
    riskDecision(input: {
      nodeID: string
      kind: SecurityRiskKind
      state?: SecurityRiskState
      rationale: string
      evidence?: string
      sessionID?: string
    }) {
      return json<SecurityProposalSummary>(`/api/plugin/security-audit/risk-decision`, {
        method: "POST",
        body: JSON.stringify(input),
      })
    },
    review(input: {
      proposalID: string
      verdict: "approve" | "reject" | "request_changes"
      comments?: string
      actor?: SecurityActor
    }) {
      const payload = {
        verdict: input.verdict,
        comments: input.comments,
        actor: input.actor ?? currentActor(),
      }
      return json<{ proposal: SecurityProposalSummary; commit?: { id: string } }>(
        `/domain/proposal/${encodeURIComponent(input.proposalID)}/review`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      )
    },
  }
}
