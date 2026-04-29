/**
 * Re-export shim. Actual handoff store lives at
 * `packages/plugin-sdk/src/web/chat/handoff.ts` (moved in Phase 2.2
 * of host context promotion). This file preserves the existing
 * `@/pages/session/handoff` import path for the rest of apps/web.
 */
export {
  setSessionHandoff,
  getSessionHandoff,
  setTerminalHandoff,
  getTerminalHandoff,
} from "@palimpsest/plugin-sdk/web/chat/handoff"
