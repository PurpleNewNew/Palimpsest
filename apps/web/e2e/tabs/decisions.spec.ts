import { test, expect } from "../fixtures"
import {
  entityDetailSelector,
  entityItemSelector,
  entityListEmptySelector,
  entityTabSelector,
} from "../selectors"

async function seedTaxonomy(sdk: any) {
  await sdk.domain.taxonomy2.update({
    decisionKinds: ["accept_claim", "defer_claim"],
    decisionStates: ["accepted", "pending"],
  })
}

test("decisions tab renders empty state when no decisions exist", async ({ page, sdk, gotoTab }) => {
  await seedTaxonomy(sdk)
  const existing = await sdk.domain.decision.list().then((r: any) => r.data ?? [])
  for (const d of existing) {
    await sdk.domain.accepted.decision.delete({ decisionID: d.id }).catch(() => undefined)
  }
  await gotoTab("decisions")
  await expect(page.locator(entityTabSelector("decision"))).toBeVisible()
  await expect(page.locator(entityListEmptySelector("decision"))).toBeVisible()
})

test("decisions timeline renders the supersede chain", async ({ page, sdk, gotoTab }) => {
  await seedTaxonomy(sdk)

  const actor = { type: "user" as const, id: "usr_admin" }

  const first = await sdk.domain.proposal
    .create({
      actor,
      autoApprove: true,
      changes: [
        {
          op: "create_decision",
          kind: "accept_claim",
          state: "accepted",
          rationale: "first pass",
          actor,
        },
      ],
    })
    .then((r: any) => r.data!)
  const firstID = first.changes[0].id as string

  const second = await sdk.domain.proposal
    .create({
      actor,
      autoApprove: true,
      changes: [
        {
          op: "create_decision",
          kind: "accept_claim",
          state: "accepted",
          rationale: "supersede with better reasoning",
          supersededBy: firstID,
          actor,
        },
      ],
    })
    .then((r: any) => r.data!)
  const secondID = second.changes[0].id as string

  await gotoTab("decisions", secondID)
  await page.locator(entityItemSelector("decision", secondID)).click({ trial: true }).catch(() => undefined)
  await expect(page.locator(entityDetailSelector("decision"))).toContainText(/supersede chain/i)
  await expect(page.locator(`[data-component="decision-chain-item"][data-decision-id="${firstID}"]`)).toBeVisible()
  await expect(page.locator(`[data-component="decision-chain-item"][data-decision-id="${secondID}"]`)).toBeVisible()
})
