import { createMemo } from "solid-js"
import { useAuth } from "@/context/auth"

/**
 * Workspace-level write permission. Mirrors the server's domain write
 * gate (permissions-v1-model): owner and editor may mutate, viewer may
 * only read. The server is the source of truth; this helper only hides
 * write actions in the UI so viewers see a coherent read-only shell.
 */
export function useCanWrite() {
  const auth = useAuth()
  return createMemo(() => {
    const role = auth.role()
    return role === "owner" || role === "editor"
  })
}

/**
 * Workspace-level ownership check. Used to gate workspace admin
 * actions (member management, imports, share revocation).
 */
export function useIsOwner() {
  const auth = useAuth()
  return createMemo(() => auth.role() === "owner")
}
