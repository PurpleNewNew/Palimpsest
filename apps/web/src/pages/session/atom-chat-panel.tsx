import { SessionChatPanel } from "@palimpsest/plugin-sdk/web/chat/session-chat-panel"

import { PromptInput } from "@/components/prompt-input"

export function AtomChatPanel(props: { atomSessionId: string; onClose: () => void; title?: string }) {
  return (
    <SessionChatPanel
      sessionID={props.atomSessionId}
      onClose={props.onClose}
      title={props.title ?? "Atom Chat"}
      input={PromptInput}
    />
  )
}
