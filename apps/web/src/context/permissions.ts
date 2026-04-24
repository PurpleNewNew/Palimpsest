import { createMemo } from "solid-js"
import type { PluginCapabilities } from "@palimpsest/plugin-sdk/host-web"
import { useAuth } from "@/context/auth"

export type WorkspaceRole = "owner" | "editor" | "viewer" | undefined

/**
 * App-level capability snapshot. Superset of the plugin-sdk's
 * {@link PluginCapabilities}: keeps `role` and `roleLabel` for host UI
 * convenience (badges, access labels in object workspaces) while the
 * boolean flags match the SDK contract exactly.
 *
 * Plugin code should consume {@link PluginCapabilities} through
 * `PluginWebHost.capabilities()`, not this type.
 */
export type WorkspaceCapabilities = PluginCapabilities & {
  role: WorkspaceRole
  roleLabel: string
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
    canRun: canWrite,
  }
}

/**
 * Project the app-level snapshot down to the plugin-sdk's
 * {@link PluginCapabilities} shape. Used by `PluginWebHostProvider` to
 * implement `PluginWebHost.capabilities()`.
 */
export function pluginCapabilities(caps: WorkspaceCapabilities): PluginCapabilities {
  return {
    canWrite: caps.canWrite,
    canReview: caps.canReview,
    canShare: caps.canShare,
    canExportImport: caps.canExportImport,
    canManageMembers: caps.canManageMembers,
    canRun: caps.canRun,
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
 * gate (see `specs/domain.md` Permissions): owner and editor may mutate,
 * viewer may only read. The server is the source of truth; this helper
 * only hides write actions in the UI so viewers see a coherent read-only
 * shell.
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
 * Whether the current actor may start a run (plugin workflow, AI session,
 * long-running task). Initial policy mirrors {@link useCanWrite}; a
 * future policy may decouple them.
 */
export function useCanRun() {
  const caps = useWorkspaceCapabilities()
  return createMemo(() => caps().canRun)
}

/**
 * Workspace-level ownership check. Used to gate workspace admin
 * actions (member management, imports, share revocation).
 */
export function useIsOwner() {
  const caps = useWorkspaceCapabilities()
  return createMemo(() => caps().canManageMembers)
}
