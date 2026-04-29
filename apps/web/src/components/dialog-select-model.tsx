import {
  DialogSelectModel as BaseDialogSelectModel,
  ModelSelectorPopover as BaseModelSelectorPopover,
  type DialogSelectModelProps,
  type ModelSelectorPopoverProps,
} from "@palimpsest/plugin-sdk/web/chat/dialog-select-model"

import { DialogManageModels } from "./dialog-manage-models"
import { DialogSelectProvider } from "./dialog-select-provider"
import { ModelTooltip } from "./model-tooltip"

const slots = {
  selectProvider: DialogSelectProvider,
  manageModels: DialogManageModels,
  modelTooltip: ModelTooltip,
}

export function ModelSelectorPopover(props: Omit<ModelSelectorPopoverProps, "slots">) {
  return <BaseModelSelectorPopover {...props} slots={slots} />
}

export function DialogSelectModel(props: Omit<DialogSelectModelProps, "slots">) {
  return <BaseDialogSelectModel {...props} slots={slots} />
}
