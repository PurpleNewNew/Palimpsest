import {
  DialogSelectModelUnpaid as BaseDialogSelectModelUnpaid,
  type DialogSelectModelUnpaidProps,
} from "@palimpsest/plugin-sdk/web/chat/dialog-select-model-unpaid"

import { DialogConnectProvider } from "./dialog-connect-provider"
import { DialogSelectProvider } from "./dialog-select-provider"
import { ModelTooltip } from "./model-tooltip"

const slots = {
  connectProvider: DialogConnectProvider,
  selectProvider: DialogSelectProvider,
  modelTooltip: ModelTooltip,
}

export function DialogSelectModelUnpaid(props: Omit<DialogSelectModelUnpaidProps, "slots">) {
  return <BaseDialogSelectModelUnpaid {...props} slots={slots} />
}
