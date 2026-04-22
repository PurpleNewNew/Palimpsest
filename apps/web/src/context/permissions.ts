import { createMemo } from "solid-js"
import { useAuth } from "@/context/auth"

export type WorkspaceRole = "owner" | "editor" | "viewer" | undefined

export type WorkspaceCapabilities = {
  role: WorkspaceRole
  roleLabel: string
  canWrite: boolean
  canReview: boolean
  canShare: boolean
  canExportImport: boolean
  canManageMembers: boolean
}

export function workspaceRoleLabel(role: WorkspaceRole) {
  if (role === "owner") return "owner"
  if (role === "editor") return "editor"
  if (role === "viewer") return "viewer"
  return "guest"
}

export function workspaceCapabilities(role: WorkspaceRole): WorkspaceCapabilities {
  const canWrite = role === "owner" || role === "editor"
  return {
    role,
    roleLabel: workspaceRoleLabel(role),
    canWrite,
    canReview: canWrite,
    canShare: canWrite,
    canExportImport: canWrite,
    canManageMembers: role === "owner",
  }
}

export function useWorkspaceCapabilities() {
  const auth = useAuth()
  return createMemo(() => workspaceCapabilities(auth.role()))
}

export function useWorkspaceRole() {
  const auth = useAuth()
  return createMemo(() => auth.role())
}

/**
 * Workspace-level write permission. Mirrors the server's domain write
 * gate (permissions-v1-model): owner and editor may mutate, viewer may
 * only read. The server is the source of truth; this helper only hides
 * write actions in the UI so viewers see a coherent read-only shell.
 */
export function useCanWrite() {
  const caps = useWorkspaceCapabilities()
  return createMemo(() => caps().canWrite)
}

export function useCanReview() {
  const caps = useWorkspaceCapabilities()
  return createMemo(() => caps().canReview)
}

export function useCanShare() {
  const caps = useWorkspaceCapabilities()
  return createMemo(() => caps().canShare)
}

export function useCanExportImport() {
  const caps = useWorkspaceCapabilities()
  return createMemo(() => caps().canExportImport)
}

/**
 * Workspace-level ownership check. Used to gate workspace admin
 * actions (member management, imports, share revocation).
 */
export function useIsOwner() {
  const caps = useWorkspaceCapabilities()
  return createMemo(() => caps().canManageMembers)
}
