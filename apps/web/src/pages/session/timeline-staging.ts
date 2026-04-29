/**
 * Re-export shim. Actual timeline-staging logic lives at
 * `packages/plugin-sdk/src/web/chat/timeline-staging.ts` (moved in
 * Phase 2.3 of host context promotion).
 */
export {
  createTimelineStaging,
  type StageConfig,
  type TimelineStageInput,
} from "@palimpsest/plugin-sdk/web/chat/timeline-staging"
