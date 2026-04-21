import { test, expect } from "../fixtures"
import {
  entityDetailSelector,
  entityItemSelector,
  entityListEmptySelector,
  entityTabSelector,
} from "../selectors"

async function seedTaxonomy(sdk: any) {
  await sdk.domain.taxonomy2.update({ runKinds: ["scan", "analysis"] })
}

test("runs tab renders empty state when no runs exist", async ({ page, sdk, gotoTab }) => {
  await seedTaxonomy(sdk)
  const existing = await sdk.domain.run.list().then((r: any) => r.data ?? [])
  for (const run of existing) {
    await sdk.domain.accepted.run.delete({ runID: run.id }).catch(() => undefined)
  }
  await gotoTab("runs")
  await expect(page.locator(entityTabSelector("run"))).toBeVisible()
  await expect(page.locator(entityListEmptySelector("run"))).toBeVisible()
})

test("runs tab shows proposed runs with status and links to detail", async ({ page, sdk, gotoTab }) => {
  await seedTaxonomy(sdk)

  const actor = { type: "user" as const, id: "usr_admin" }
  const title = `run-${Date.now()}`
  const proposal = await sdk.domain.proposal
    .create({
      actor,
      autoApprove: true,
      changes: [{ op: "create_run", kind: "scan", status: "completed", title, actor }],
    })
    .then((r: any) => r.data!)

  const runID = proposal.changes[0].id as string

  await gotoTab("runs")
  await expect(page.locator(entityTabSelector("run"))).toBeVisible()
  await page.locator(entityItemSelector("run", runID)).click()
  await expect(page.locator(entityDetailSelector("run"))).toContainText(title)
  await expect(page.locator(entityDetailSelector("run"))).toContainText(/completed/i)
})
