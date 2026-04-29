/**
 * Re-export shim. Actual history-window logic lives at
 * `packages/plugin-sdk/src/web/chat/history-window.ts` (moved in
 * Phase 2.3 of host context promotion).
 */
export {
  emptyUserMessages,
  historyLoadMode,
  historyRevealTop,
  createSessionHistoryWindow,
  type SessionHistoryWindowInput,
} from "@palimpsest/plugin-sdk/web/chat/history-window"
