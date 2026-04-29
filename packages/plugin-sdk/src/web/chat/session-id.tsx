import { createContext, useContext, type JSX } from "solid-js"
import { useParams } from "@solidjs/router"
import { base64Encode } from "@palimpsest/shared/encode"

/**
 * Session-id context. Plugin chat surfaces use this to resolve the
 * current session id and the base64-encoded directory slug for
 * routing children. Lives here (not in plugin-sdk/host-web) because
 * it is content-only — no host bridge needed, just a Solid context
 * shared between chat container and SessionTurn / nested chat
 * children.
 *
 * Migrated from `apps/web/src/context/session-id.tsx` in Phase 2.1
 * of the host context promotion (specs/graph-workbench-pattern.md
 * P0.e follow-up). The host re-exports from this module so existing
 * `@/context/session-id` imports keep working unchanged.
 */
interface SessionIDContextValue {
  id?: string
  dir: string
}

const SessionIDContext = createContext<SessionIDContextValue>()

export function SessionIDProvider(props: { sessionID: string; directory: string; children: JSX.Element }) {
  const value = {
    get id() {
      return props.sessionID
    },
    get dir() {
      return base64Encode(props.directory)
    },
  }
  return <SessionIDContext.Provider value={value}>{props.children}</SessionIDContext.Provider>
}

export function useSessionID(): SessionIDContextValue {
  const ctx = useContext(SessionIDContext)
  if (ctx) return ctx
  const params = useParams()
  return params as unknown as SessionIDContextValue
}
