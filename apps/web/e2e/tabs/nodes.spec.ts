import { test, expect } from "../fixtures"
import {
  entityDetailSelector,
  entityGroupSelector,
  entityItemSelector,
  entityListEmptySelector,
  entityTabSelector,
} from "../selectors"

async function seedTaxonomy(sdk: any) {
  await sdk.domain.taxonomy2.update({ nodeKinds: ["claim", "finding"], edgeKinds: ["supports"] })
}

async function proposeAndCommit(sdk: any, change: any) {
  const actor = { type: "user" as const, id: "usr_admin" }
  const proposal = await sdk.domain.proposal
    .create({ actor, changes: [change], autoApprove: true })
    .then((r: any) => r.data!)
  return proposal
}

test("nodes tab renders empty state when no nodes exist", async ({ page, sdk, gotoTab }) => {
  await seedTaxonomy(sdk)
  // Wipe any existing nodes via the accepted bridge (system actor).
  const existing = await sdk.domain.node.list().then((r: any) => r.data ?? [])
  for (const node of existing) {
    await sdk.domain.accepted.node
      .delete({ nodeID: node.id })
      .catch(() => undefined)
  }
  await gotoTab("nodes")
  await expect(page.locator(entityTabSelector("node"))).toBeVisible()
  await expect(page.locator(entityListEmptySelector("node"))).toBeVisible()
})

test("nodes list groups by kind and links to a node detail", async ({ page, sdk, gotoTab }) => {
  await seedTaxonomy(sdk)

  const titleA = `claim-${Date.now()}`
  const titleB = `finding-${Date.now()}`
  const a = await proposeAndCommit(sdk, { op: "create_node", kind: "claim", title: titleA })
  const b = await proposeAndCommit(sdk, { op: "create_node", kind: "finding", title: titleB })

  const aID = a.changes[0].id as string
  const bID = b.changes[0].id as string

  await gotoTab("nodes")
  await expect(page.locator(entityTabSelector("node"))).toBeVisible()
  await expect(page.locator(entityGroupSelector("node", "claim"))).toBeVisible()
  await expect(page.locator(entityGroupSelector("node", "finding"))).toBeVisible()
  await expect(page.locator(entityItemSelector("node", aID))).toBeVisible()

  await page.locator(entityItemSelector("node", bID)).click()
  await expect(page.locator(entityDetailSelector("node"))).toContainText(titleB)
})
