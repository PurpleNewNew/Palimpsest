/**
 * Re-export shim. The actual SessionIDProvider / useSessionID lives at
 * `packages/plugin-sdk/src/web/chat/session-id.tsx` (moved in Phase 2.1
 * of host context promotion). This file preserves the existing
 * `@/context/session-id` import path for the rest of apps/web; new
 * code should import from `@palimpsest/plugin-sdk/web/chat/session-id`
 * directly.
 */
export { SessionIDProvider, useSessionID } from "@palimpsest/plugin-sdk/web/chat/session-id"
