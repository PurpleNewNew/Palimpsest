import { Component, createMemo, JSX, Show, ValidComponent } from "solid-js"
import { createStore } from "solid-js/store"

import { Button } from "@palimpsest/ui/button"
import { useDialog } from "@palimpsest/ui/context/dialog"
import { Dialog } from "@palimpsest/ui/dialog"
import { IconButton } from "@palimpsest/ui/icon-button"
import { List } from "@palimpsest/ui/list"
import { Popover } from "@palimpsest/ui/popover"
import { Tag } from "@palimpsest/ui/tag"
import { Tooltip } from "@palimpsest/ui/tooltip"

import { usePluginWebHost, type PluginWebHostModel } from "../../host-web"
import { popularProviders } from "./utils/use-providers"

const isFree = (_provider: string, cost: { input: number } | undefined) => !cost || cost.input === 0

type ModelSelectorTriggerProps = Record<string, unknown>

export type ModelSelectorModelTooltipProps = {
  model: PluginWebHostModel
  latest?: boolean
  free?: boolean
}

export type ModelSelectorSlots = {
  selectProvider: Component
  manageModels: Component
  modelTooltip: Component<ModelSelectorModelTooltipProps>
}

export type ModelSelectorPopoverProps = {
  provider?: string
  children?: JSX.Element
  triggerAs?: ValidComponent
  triggerProps?: ModelSelectorTriggerProps
  slots: ModelSelectorSlots
}

export type DialogSelectModelProps = {
  provider?: string
  slots: ModelSelectorSlots
}

const ModelList: Component<{
  provider?: string
  class?: string
  onSelect: () => void
  action?: JSX.Element
  slots: ModelSelectorSlots
}> = (props) => {
  const host = usePluginWebHost()
  const local = host.local()
  const language = host.language()
  const ModelTooltip = props.slots.modelTooltip

  const models = createMemo(() =>
    local.model
      .list()
      .filter((model) => local.model.visible({ modelID: model.id, providerID: model.provider.id }))
      .filter((model) => (props.provider ? model.provider.id === props.provider : true)),
  )

  return (
    <List
      class={`flex-1 min-h-0 [&_[data-slot=list-scroll]]:flex-1 [&_[data-slot=list-scroll]]:min-h-0 ${props.class ?? ""}`}
      search={{ placeholder: language.t("dialog.model.search.placeholder"), autofocus: true, action: props.action }}
      emptyMessage={language.t("dialog.model.empty")}
      key={(model) => `${model.provider.id}:${model.id}`}
      items={models}
      current={local.model.current()}
      filterKeys={["provider.name", "name", "id"]}
      sortBy={(a, b) => a.name.localeCompare(b.name)}
      groupBy={(model) => model.provider.name}
      sortGroupsBy={(a, b) => {
        const aProvider = a.items[0].provider.id
        const bProvider = b.items[0].provider.id
        if (popularProviders.includes(aProvider) && !popularProviders.includes(bProvider)) return -1
        if (!popularProviders.includes(aProvider) && popularProviders.includes(bProvider)) return 1
        return popularProviders.indexOf(aProvider) - popularProviders.indexOf(bProvider)
      }}
      itemWrapper={(item, node) => (
        <Tooltip
          class="w-full"
          placement="right-start"
          gutter={12}
          value={<ModelTooltip model={item} latest={item.latest} free={isFree(item.provider.id, item.cost)} />}
        >
          {node}
        </Tooltip>
      )}
      onSelect={(model) => {
        local.model.set(model ? { modelID: model.id, providerID: model.provider.id } : undefined, {
          recent: true,
        })
        props.onSelect()
      }}
    >
      {(model) => (
        <div class="w-full flex items-center gap-x-2 text-13-regular">
          <span class="truncate">{model.name}</span>
          <Show when={isFree(model.provider.id, model.cost)}>
            <Tag>{language.t("model.tag.free")}</Tag>
          </Show>
          <Show when={model.latest}>
            <Tag>{language.t("model.tag.latest")}</Tag>
          </Show>
        </div>
      )}
    </List>
  )
}

export function ModelSelectorPopover(props: ModelSelectorPopoverProps) {
  const [store, setStore] = createStore<{
    open: boolean
  }>({
    open: false,
  })
  const dialog = useDialog()
  const language = usePluginWebHost().language()
  const SelectProvider = props.slots.selectProvider
  const ManageModels = props.slots.manageModels

  const handleManage = () => {
    setStore("open", false)
    dialog.show(() => <ManageModels />)
  }

  const handleConnectProvider = () => {
    setStore("open", false)
    dialog.show(() => <SelectProvider />)
  }

  return (
    <Popover
      open={store.open}
      onOpenChange={(next) => setStore("open", next)}
      modal={false}
      placement="top-start"
      gutter={4}
      trigger={props.children}
      triggerAs={props.triggerAs ?? "div"}
      triggerProps={props.triggerProps}
      class="w-72 h-80 flex flex-col p-2 rounded-md border border-border-base bg-surface-raised-stronger-non-alpha shadow-md z-50 outline-none overflow-hidden [&_[data-slot=popover-body]]:flex [&_[data-slot=popover-body]]:flex-col [&_[data-slot=popover-body]]:min-h-0 [&_[data-slot=popover-body]]:flex-1"
    >
      <span class="sr-only">{language.t("dialog.model.select.title")}</span>
      <ModelList
        provider={props.provider}
        onSelect={() => setStore("open", false)}
        class="p-1"
        slots={props.slots}
        action={
          <div class="flex items-center gap-1">
            <Tooltip placement="top" value={language.t("command.provider.connect")}>
              <IconButton
                icon="plus-small"
                variant="ghost"
                iconSize="normal"
                class="size-6"
                aria-label={language.t("command.provider.connect")}
                onClick={handleConnectProvider}
              />
            </Tooltip>
            <Tooltip placement="top" value={language.t("dialog.model.manage")}>
              <IconButton
                icon="sliders"
                variant="ghost"
                iconSize="normal"
                class="size-6"
                aria-label={language.t("dialog.model.manage")}
                onClick={handleManage}
              />
            </Tooltip>
          </div>
        }
      />
    </Popover>
  )
}

export const DialogSelectModel: Component<DialogSelectModelProps> = (props) => {
  const dialog = useDialog()
  const language = usePluginWebHost().language()
  const SelectProvider = props.slots.selectProvider
  const ManageModels = props.slots.manageModels

  return (
    <Dialog
      title={language.t("dialog.model.select.title")}
      action={
        <Button
          class="h-7 -my-1 text-14-medium"
          icon="plus-small"
          tabIndex={-1}
          onClick={() => dialog.show(() => <SelectProvider />)}
        >
          {language.t("command.provider.connect")}
        </Button>
      }
    >
      <ModelList provider={props.provider} onSelect={() => dialog.close()} slots={props.slots} />
      <Button
        variant="ghost"
        class="ml-3 mt-5 mb-6 text-text-base self-start"
        onClick={() => dialog.show(() => <ManageModels />)}
      >
        {language.t("dialog.model.manage")}
      </Button>
    </Dialog>
  )
}
