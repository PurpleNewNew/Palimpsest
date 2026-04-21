import { test, expect } from "../fixtures"
import {
  entityDetailSelector,
  entityItemSelector,
  entityListEmptySelector,
  entityTabSelector,
} from "../selectors"

async function seedTaxonomy(sdk: any) {
  await sdk.domain.taxonomy2.update({ artifactKinds: ["report", "note"] })
}

test("artifacts tab renders empty state when no artifacts exist", async ({ page, sdk, gotoTab }) => {
  await seedTaxonomy(sdk)
  const existing = await sdk.domain.artifact.list().then((r: any) => r.data ?? [])
  for (const a of existing) {
    await sdk.domain.accepted.artifact.delete({ artifactID: a.id }).catch(() => undefined)
  }
  await gotoTab("artifacts")
  await expect(page.locator(entityTabSelector("artifact"))).toBeVisible()
  await expect(page.locator(entityListEmptySelector("artifact"))).toBeVisible()
})

test("artifacts tab shows accepted artifact with MIME preview panel", async ({ page, sdk, gotoTab }) => {
  await seedTaxonomy(sdk)

  const actor = { type: "user" as const, id: "usr_admin" }
  const title = `note-${Date.now()}`
  const proposal = await sdk.domain.proposal
    .create({
      actor,
      autoApprove: true,
      changes: [
        {
          op: "create_artifact",
          kind: "note",
          title,
          mimeType: "application/json",
        },
      ],
    })
    .then((r: any) => r.data!)

  const artifactID = proposal.changes[0].id as string

  await gotoTab("artifacts")
  await page.locator(entityItemSelector("artifact", artifactID)).click()
  await expect(page.locator(entityDetailSelector("artifact"))).toContainText(title)
  // Preview panel is rendered even when storage URI is absent — it renders a hint.
  await expect(page.locator('[data-component="artifact-preview"]')).toBeVisible()
})
