import {
  useSessionCommands as useBaseSessionCommands,
  type SessionCommandContext,
} from "@palimpsest/plugin-sdk/web/chat/use-session-commands"

import { DialogSelectFile } from "@/components/dialog-select-file"
import { DialogSelectModel } from "@/components/dialog-select-model"
import { useTerminal } from "@/context/terminal"

const slots = {
  selectFile: DialogSelectFile,
  selectModel: DialogSelectModel,
}

export type { SessionCommandContext }

export const useSessionCommands = (actions: SessionCommandContext) => {
  const terminal = useTerminal()
  return useBaseSessionCommands({
    ...actions,
    slots,
    terminal,
  })
}
