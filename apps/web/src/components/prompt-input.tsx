import { createSignal } from "solid-js"
import { Button } from "@palimpsest/ui/button"
import { useDialog } from "@palimpsest/ui/context/dialog"
import { Dialog } from "@palimpsest/ui/dialog"
import { ImagePreview } from "@palimpsest/ui/image-preview"
import {
  PromptInput as BasePromptInput,
  type PromptInputIdeaDialogProps,
  type PromptInputProps,
} from "@palimpsest/plugin-sdk/web/chat/prompt-input/prompt-input"
import {
  buildResearchIdeaPrompt,
  RESEARCH_AGENT_MENTIONS,
  RESEARCH_IDEA_ACTION,
} from "@palimpsest/plugin-research/web"

import { DialogConnectProvider } from "./dialog-connect-provider"
import { DialogManageModels } from "./dialog-manage-models"
import { DialogSelectProvider } from "./dialog-select-provider"
import { ModelTooltip } from "./model-tooltip"

function DialogNewIdea(props: PromptInputIdeaDialogProps) {
  const dialog = useDialog()
  const [idea, setIdea] = createSignal("")

  const submit = () => {
    const value = idea().trim()
    if (!value) return
    dialog.close()
    props.onSubmit(value)
  }

  return (
    <Dialog title="Add New Idea" fit class="w-full max-w-[560px] mx-auto">
      <div class="px-6 py-5 flex flex-col gap-4">
        <p class="text-13-regular text-text-weak">
          Describe the idea you want to turn into a validation-oriented atom tree.
        </p>
        <textarea
          class="min-h-32 rounded-md border border-border-base bg-background-base px-3 py-2 text-14-regular text-text-base outline-none focus:shadow-xs-border resize-y"
          value={idea()}
          onInput={(event) => setIdea(event.currentTarget.value)}
          autofocus
        />
        <div class="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              dialog.close()
              props.onCancel()
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!idea().trim()}>
            Start Workflow
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

const slots = {
  modelSelector: {
    selectProvider: DialogSelectProvider,
    manageModels: DialogManageModels,
    modelTooltip: ModelTooltip,
  },
  unpaidModelSelector: {
    connectProvider: DialogConnectProvider,
    selectProvider: DialogSelectProvider,
    modelTooltip: ModelTooltip,
  },
  imagePreview: ImagePreview,
  idea: {
    id: RESEARCH_IDEA_ACTION.id,
    display: RESEARCH_IDEA_ACTION.display,
    agent: RESEARCH_IDEA_ACTION.agent,
    mentions: RESEARCH_AGENT_MENTIONS,
    buildPrompt: buildResearchIdeaPrompt,
    dialog: DialogNewIdea,
  },
}

export function PromptInput(props: Omit<PromptInputProps, "slots">) {
  return <BasePromptInput {...props} slots={slots} />
}
