/**
 * Re-export shim. Actual session-request-tree helpers live at
 * `packages/plugin-sdk/src/web/chat/composer/session-request-tree.ts`
 * (moved in Phase 2.5 of host context promotion).
 */
export {
  sessionPermissionRequest,
  sessionQuestionRequest,
} from "@palimpsest/plugin-sdk/web/chat/composer/session-request-tree"
