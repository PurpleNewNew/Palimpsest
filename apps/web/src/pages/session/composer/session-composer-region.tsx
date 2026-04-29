import {
  SessionComposerRegion as BaseSessionComposerRegion,
  type SessionComposerRegionProps,
} from "@palimpsest/plugin-sdk/web/chat/composer/session-composer-region"

import { PromptInput } from "@/components/prompt-input"
import type { SessionComposerState } from "@/pages/session/composer/session-composer-state"

export function SessionComposerRegion(props: Omit<SessionComposerRegionProps, "input" | "state"> & {
  state: SessionComposerState
}) {
  return <BaseSessionComposerRegion {...props} input={PromptInput} />
}
