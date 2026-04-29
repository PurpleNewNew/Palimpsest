/**
 * Re-export shim. Actual session-composer-state lives at
 * `packages/plugin-sdk/src/web/chat/composer/session-composer-state.ts`
 * (moved in Phase 2.8 of host context promotion).
 */
export {
  createSessionComposerBlocked,
  createSessionComposerState,
  type SessionComposerState,
} from "@palimpsest/plugin-sdk/web/chat/composer/session-composer-state"
