import { Button } from "@palimpsest/ui/button"
import { useDialog } from "@palimpsest/ui/context/dialog"
import { Dialog } from "@palimpsest/ui/dialog"
import { List, type ListRef } from "@palimpsest/ui/list"
import { ProviderIcon } from "@palimpsest/ui/provider-icon"
import { Tag } from "@palimpsest/ui/tag"
import { Tooltip } from "@palimpsest/ui/tooltip"
import { type Component, Show } from "solid-js"

import { usePluginWebHost } from "../../host-web"
import { popularProviders, useProviders } from "./utils/use-providers"
import type { ModelSelectorModelTooltipProps } from "./dialog-select-model"

export type DialogSelectModelUnpaidSlots = {
  connectProvider: Component<{ provider: string }>
  selectProvider: Component
  modelTooltip: Component<ModelSelectorModelTooltipProps>
}

export type DialogSelectModelUnpaidProps = {
  slots: DialogSelectModelUnpaidSlots
}

export const DialogSelectModelUnpaid: Component<DialogSelectModelUnpaidProps> = (props) => {
  const host = usePluginWebHost()
  const local = host.local()
  const language = host.language()
  const dialog = useDialog()
  const providers = useProviders()
  const ConnectProvider = props.slots.connectProvider
  const SelectProvider = props.slots.selectProvider
  const ModelTooltip = props.slots.modelTooltip

  let listRef: ListRef | undefined
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") return
    listRef?.onKeyDown(event)
  }

  return (
    <Dialog
      title={language.t("dialog.model.select.title")}
      class="overflow-y-auto [&_[data-slot=dialog-body]]:overflow-visible [&_[data-slot=dialog-body]]:flex-none"
    >
      <div class="flex flex-col gap-3 px-2.5" onKeyDown={handleKeyDown}>
        <div class="text-14-medium text-text-base px-2.5">{language.t("dialog.model.unpaid.freeModels.title")}</div>
        <List
          class="[&_[data-slot=list-scroll]]:overflow-visible"
          ref={(ref) => (listRef = ref)}
          items={local.model.list}
          current={local.model.current()}
          key={(model) => `${model.provider.id}:${model.id}`}
          itemWrapper={(item, node) => (
            <Tooltip
              class="w-full"
              placement="right-start"
              gutter={12}
              value={<ModelTooltip model={item} latest={item.latest} free={!item.cost || item.cost.input === 0} />}
            >
              {node}
            </Tooltip>
          )}
          onSelect={(model) => {
            local.model.set(model ? { modelID: model.id, providerID: model.provider.id } : undefined, {
              recent: true,
            })
            dialog.close()
          }}
        >
          {(model) => (
            <div class="w-full flex items-center gap-x-2.5">
              <span>{model.name}</span>
              <Tag>{language.t("model.tag.free")}</Tag>
              <Show when={model.latest}>
                <Tag>{language.t("model.tag.latest")}</Tag>
              </Show>
            </div>
          )}
        </List>
      </div>
      <div class="px-1.5 pb-1.5">
        <div class="w-full rounded-sm border border-border-weak-base bg-surface-raised-base">
          <div class="w-full flex flex-col items-start gap-4 px-1.5 pt-4 pb-4">
            <div class="px-2 text-14-medium text-text-base">{language.t("dialog.model.unpaid.addMore.title")}</div>
            <div class="w-full">
              <List
                class="w-full px-0"
                key={(provider) => provider?.id}
                items={providers.popular}
                activeIcon="plus-small"
                sortBy={(a, b) => {
                  if (popularProviders.includes(a.id) && popularProviders.includes(b.id))
                    return popularProviders.indexOf(a.id) - popularProviders.indexOf(b.id)
                  return a.name.localeCompare(b.name)
                }}
                onSelect={(provider) => {
                  if (!provider) return
                  dialog.show(() => <ConnectProvider provider={provider.id} />)
                }}
              >
                {(provider) => (
                  <div class="w-full flex items-center gap-x-3">
                    <ProviderIcon data-slot="list-item-extra-icon" id={provider.id} />
                    <span>{provider.name}</span>
                    <Show when={provider.id === "anthropic"}>
                      <div class="text-14-regular text-text-weak">{language.t("dialog.provider.anthropic.note")}</div>
                    </Show>
                  </div>
                )}
              </List>
              <Button
                variant="ghost"
                class="w-full justify-start px-[11px] py-3.5 gap-4.5 text-14-medium"
                icon="dot-grid"
                onClick={() => dialog.show(() => <SelectProvider />)}
              >
                {language.t("dialog.provider.viewAll")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
