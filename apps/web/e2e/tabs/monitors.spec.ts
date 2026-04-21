import { test, expect } from "../fixtures"
import { monitorEmptySelector, monitorLogSelector, monitorLogEntrySelector } from "../selectors"

test("monitors tab shows the empty state until a domain event fires", async ({ page, sdk, gotoTab }) => {
  await sdk.domain.taxonomy2.update({ nodeKinds: ["claim"] })
  await gotoTab("monitors")
  await expect(page.locator(monitorEmptySelector)).toBeVisible()
})

test("monitors tab captures proposal lifecycle events in the live log", async ({ page, sdk, gotoTab }) => {
  await sdk.domain.taxonomy2.update({ nodeKinds: ["claim"] })
  await gotoTab("monitors")
  await expect(page.locator(monitorEmptySelector)).toBeVisible()

  // Fire a proposal in ship mode — that produces created + reviewed + committed events.
  const actor = { type: "user" as const, id: "usr_admin" }
  await sdk.domain.proposal.create({
    actor,
    autoApprove: true,
    changes: [{ op: "create_node", kind: "claim", title: `monitor-${Date.now()}` }],
  })

  await expect(page.locator(monitorLogSelector)).toBeVisible({ timeout: 15_000 })
  await expect(page.locator(monitorLogEntrySelector).first()).toBeVisible()
  await expect(
    page.locator(`${monitorLogEntrySelector}[data-event-type="domain.proposal.created"]`).first(),
  ).toBeVisible({ timeout: 15_000 })
  await expect(
    page.locator(`${monitorLogEntrySelector}[data-event-type="domain.proposal.committed"]`).first(),
  ).toBeVisible({ timeout: 15_000 })
})
