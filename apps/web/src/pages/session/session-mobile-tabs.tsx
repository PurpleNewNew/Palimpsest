import { Show } from "solid-js"
import { Tabs } from "@palimpsest/ui/tabs"

export function SessionMobileTabs(props: {
  open: boolean
  mobileTab: "workbench" | "reviews"
  hasReview: boolean
  reviewCount: number
  onWorkbench: () => void
  onReviews: () => void
}) {
  return (
    <Show when={props.open}>
      <Tabs value={props.mobileTab} class="h-auto">
        <Tabs.List>
          <Tabs.Trigger
            value="workbench"
            class="!w-1/2 !max-w-none"
            classes={{ button: "w-full" }}
            onClick={props.onWorkbench}
          >
            Workbench
          </Tabs.Trigger>
          <Tabs.Trigger
            value="reviews"
            class="!w-1/2 !max-w-none !border-r-0"
            classes={{ button: "w-full" }}
            onClick={props.onReviews}
          >
            {props.hasReview ? `Reviews (${props.reviewCount})` : "Reviews"}
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs>
    </Show>
  )
}
