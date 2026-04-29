/**
 * Cross-navigation handoff stores. Two flavours coexist here:
 *
 * - `session`: a session-key-keyed store of pending prompt drafts and
 *   file selections. Used by the chat composer to keep a partially-
 *   typed prompt visible across navigation between sessions.
 * - `terminal`: a terminal-key-keyed store of pending command lines.
 *   Used by the host terminal panel.
 *
 * Migrated from `apps/web/src/pages/session/handoff.ts` in Phase 2.2
 * of the host context promotion. The session-related half is the
 * chat surface's concern; the terminal half rides along here as a
 * hitchhiker because both flavours share the small `touch()` helper
 * and the LRU bound. Splitting them is a separate refactor with no
 * current trigger.
 *
 * The previously imported `SelectedLineRange` type from
 * `@/context/file` is inlined below as a structural type — handoff
 * stores opaque file-selection state per session, and does not care
 * about its full host-side shape.
 */

export type HandoffSelectedLineRange = {
  start: number
  end: number
  side?: "additions" | "deletions"
}

type HandoffSession = {
  prompt: string
  files: Record<string, HandoffSelectedLineRange | null>
}

const MAX = 40

const store = {
  session: new Map<string, HandoffSession>(),
  terminal: new Map<string, string[]>(),
}

const touch = <K, V>(map: Map<K, V>, key: K, value: V) => {
  map.delete(key)
  map.set(key, value)
  while (map.size > MAX) {
    const first = map.keys().next().value
    if (first === undefined) return
    map.delete(first)
  }
}

export const setSessionHandoff = (key: string, patch: Partial<HandoffSession>) => {
  const prev = store.session.get(key) ?? { prompt: "", files: {} }
  touch(store.session, key, { ...prev, ...patch })
}

export const getSessionHandoff = (key: string) => store.session.get(key)

export const setTerminalHandoff = (key: string, value: string[]) => {
  touch(store.terminal, key, value)
}

export const getTerminalHandoff = (key: string) => store.terminal.get(key)
