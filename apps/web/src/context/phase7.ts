import { createMemo } from "solid-js"

import { useAuth } from "@/context/auth"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { serverFetch } from "@/utils/server"

export type Actor = { type: "user" | "agent" | "system"; id: string; version?: string }

export type ExportEnvelope = {
  version: number
  exportedAt: number
  project: Record<string, unknown>
  taxonomy: Record<string, unknown>
  nodes: Array<{ id: string; kind: string; title: string; body?: string; data?: Record<string, unknown> }>
  edges: Array<{ id: string; kind: string; sourceID: string; targetID: string; note?: string; data?: Record<string, unknown> }>
  runs: Array<Record<string, unknown>>
  artifacts: Array<Record<string, unknown>>
  decisions: Array<Record<string, unknown>>
  proposals: Array<Record<string, unknown>>
  reviews: Array<Record<string, unknown>>
  commits: Array<Record<string, unknown>>
}

export type DecisionProvenance = {
  decision: {
    id: string
    kind: string
    state?: string
    rationale?: string
    nodeID?: string
    runID?: string
    artifactID?: string
    supersededBy?: string
    actor?: Actor
    refs?: Record<string, unknown>
    data?: Record<string, unknown>
    time: { created: number; updated: number }
  }
  createdBy?: {
    commit?: {
      id: string
      proposalID?: string
      actor: Actor
      time: { created: number; updated: number }
      changes: unknown[]
    }
    proposal?: {
      id: string
      title?: string
      rationale?: string
      status: string
      actor: Actor
      time: { created: number; updated: number }
    }
    reviews: Array<{
      id: string
      proposalID: string
      actor: Actor
      verdict: string
      comments?: string
      time: { created: number; updated: number }
    }>
  }
  updateCommits: Array<{
    id: string
    proposalID?: string
    time: { created: number; updated: number }
  }>
  supersedes: Array<{ id: string; kind: string; state?: string }>
  supersededBy?: { id: string; kind: string; state?: string }
  node?: { id: string; kind: string; title: string }
  run?: { id: string; kind: string; status: string; title?: string }
  artifact?: { id: string; kind: string; title?: string }
}

export type Share = {
  id: string
  workspaceID: string
  projectID?: string
  sessionID?: string
  slug: string
  kind: "project" | "session"
  title?: string
  url: string
  revokedAt?: number
  time: { created: number; updated: number }
}

export type Member = {
  user: { id: string; username: string; displayName?: string; isAdmin: boolean }
  role: "owner" | "editor" | "viewer"
}

export type Invite = {
  id: string
  workspaceID: string
  code: string
  role: "owner" | "editor" | "viewer"
  invitedByUserID: string
  acceptedByUserID?: string
  acceptedAt?: number
  expiresAt?: number
  revokedAt?: number
  time: { created: number; updated: number }
}

export function usePhase7(getDirectory: () => string | undefined) {
  const auth = useAuth()
  const platform = usePlatform()
  const server = useServer()

  const send = createMemo(() => {
    const http = server.current?.http
    if (!http) return
    return serverFetch(http, platform.fetch ?? globalThis.fetch)
  })

  const base = createMemo(() => server.current?.http.url)

  async function json<T>(path: string, init?: RequestInit & { directoryScoped?: boolean }): Promise<T> {
    const run = send()
    const root = base()
    if (!run || !root) throw new Error("No server available")
    const url = new URL(path, root)
    if (init?.directoryScoped !== false) {
      const dir = getDirectory()
      if (dir) url.searchParams.set("directory", dir)
    }
    const headers = new Headers(init?.headers)
    if (auth.workspaceID()) headers.set("x-palimpsest-workspace", auth.workspaceID()!)
    if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json")
    const { directoryScoped: _, ...rest } = init ?? {}
    const res = await run(url, { ...rest, headers })
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

  return {
    exportProject() {
      return json<ExportEnvelope>(`/domain/export`)
    },
    importProject(envelope: Partial<ExportEnvelope>, opts?: { autoApprove?: boolean; preserveIds?: boolean }) {
      return json<{ id: string; status: string; title?: string }>(`/domain/import`, {
        method: "POST",
        body: JSON.stringify({ envelope, autoApprove: opts?.autoApprove, preserveIds: opts?.preserveIds }),
      })
    },
    decisionProvenance(decisionID: string) {
      return json<DecisionProvenance>(`/domain/decision/${encodeURIComponent(decisionID)}/provenance`)
    },
    shares(workspaceID: string) {
      return json<Share[]>(`/api/workspaces/${encodeURIComponent(workspaceID)}/shares`, {
        directoryScoped: false,
      })
    },
    publishSession(sessionID: string) {
      return json<Share>(`/api/workspaces/shares/session/${encodeURIComponent(sessionID)}`, {
        method: "POST",
        body: "{}",
        directoryScoped: false,
      })
    },
    unpublishSession(sessionID: string) {
      return json<Share>(`/api/workspaces/shares/session/${encodeURIComponent(sessionID)}`, {
        method: "DELETE",
        directoryScoped: false,
      })
    },
    revokeShare(shareID: string) {
      return json<Share>(`/api/workspaces/shares/${encodeURIComponent(shareID)}`, {
        method: "DELETE",
        directoryScoped: false,
      })
    },
    members(workspaceID: string) {
      return json<Member[]>(`/api/workspaces/${encodeURIComponent(workspaceID)}/members`, {
        directoryScoped: false,
      })
    },
    invites(workspaceID: string) {
      return json<Invite[]>(`/api/workspaces/${encodeURIComponent(workspaceID)}/invites`, {
        directoryScoped: false,
      })
    },
    createInvite(workspaceID: string, input: { role?: "owner" | "editor" | "viewer"; expiresAt?: number }) {
      return json<Invite>(`/api/workspaces/${encodeURIComponent(workspaceID)}/invites`, {
        method: "POST",
        body: JSON.stringify({ role: input.role ?? "viewer", expiresAt: input.expiresAt }),
        directoryScoped: false,
      })
    },
    revokeInvite(inviteID: string) {
      return json<Invite>(`/api/workspaces/invites/${encodeURIComponent(inviteID)}`, {
        method: "DELETE",
        directoryScoped: false,
      })
    },
  }
}
