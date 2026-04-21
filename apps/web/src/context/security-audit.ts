import { createMemo } from "solid-js"

import { useAuth } from "@/context/auth"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { serverFetch } from "@/utils/server"

export type SecurityProposalSummary = {
  id: string
  title: string
  rationale?: string
  status: string
  time: { created: number; updated: number }
}

export type SecurityOverview = {
  pluginID: string
  pendingProposals: SecurityProposalSummary[]
  recentCommits: Array<{ id: string; proposalID?: string; changes: unknown[]; time: { created: number } }>
}

export type SecurityFindings = {
  pluginID: string
  pendingProposals: SecurityProposalSummary[]
  committedFindings: Array<{
    id: string
    kind: string
    title?: string
    commitID?: string
    time: { created: number; updated: number }
    props?: Record<string, unknown>
  }>
}

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
        body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : `Request failed: ${res.status}`
      throw new Error(message)
    }
    return (await res.json()) as T
  }

  return {
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
    bootstrap() {
      return json<SecurityProposalSummary>(`/api/plugin/security-audit/bootstrap`, {
        method: "POST",
        body: "{}",
      })
    },
    hypothesize(input: {
      targetID: string
      title: string
      description: string
      evidence: string
      severity?: "critical" | "high" | "medium" | "low" | "info"
      confidence?: "high" | "medium" | "low"
    }) {
      return json<SecurityProposalSummary>(`/api/plugin/security-audit/finding-hypothesis`, {
        method: "POST",
        body: JSON.stringify(input),
      })
    },
  }
}
