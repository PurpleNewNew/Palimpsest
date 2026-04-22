import { pluginWebHostFetchJson, usePluginWebHost } from "@palimpsest/plugin-sdk/host-web"

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

/**
 * Plugin-owned security audit client. Receives every host dependency it
 * needs through the plugin web host bridge and does not reach into the
 * host app directly. The optional `getDirectory` argument remains for
 * route-driven overrides (e.g. share pages), but defaults to the host's
 * current directory.
 */
export function useSecurityAudit(getDirectory?: () => string | undefined) {
  const host = usePluginWebHost()

  function currentActor(): SecurityActor {
    return host.actor()
  }

  function resolvedHost() {
    if (!getDirectory) return host
    return {
      ...host,
      directory: () => getDirectory() ?? host.directory(),
    }
  }

  async function json<T>(path: string, init?: RequestInit): Promise<T> {
    return pluginWebHostFetchJson<T>(resolvedHost(), path, init)
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
