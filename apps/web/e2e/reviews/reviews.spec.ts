import { test, expect } from "../fixtures"
import {
  entityItemSelector,
  entityTabSelector,
  proposalActionSelector,
  proposalCommitSelector,
  proposalDetailSelector,
  proposalListEmptySelector,
  proposalStatusSelector,
  proposeComposerSelector,
  proposeOpenButtonSelector,
  proposeSubmitButtonSelector,
  reviewsPageSelector,
} from "../selectors"

async function seedTaxonomy(sdk: any) {
  await sdk.domain.taxonomy2.update({
    nodeKinds: ["claim", "finding"],
    edgeKinds: ["supports"],
    runKinds: ["scan"],
    artifactKinds: ["report"],
    decisionKinds: ["accept_claim"],
    decisionStates: ["accepted"],
  })
}

async function cleanupProposals(sdk: any) {
  const proposals = await sdk.domain.proposal.list().then((r: any) => r.data ?? [])
  for (const p of proposals) {
    if (p.status === "pending") {
      await sdk.domain.proposal
        .withdraw({ proposalID: p.id, actor: { type: "system", id: "test_cleanup" } })
        .catch(() => undefined)
    }
  }
}

test("reviews page shows the empty state when no proposals exist", async ({ page, sdk, gotoReviews }) => {
  await seedTaxonomy(sdk)
  await cleanupProposals(sdk)
  await gotoReviews()
  await expect(page.locator(reviewsPageSelector)).toBeVisible()
  await expect(page.locator(proposalListEmptySelector)).toBeVisible()
})

test("propose → autoApprove commits immediately and the node appears in Nodes", async ({
  page,
  sdk,
  gotoReviews,
  gotoTab,
}) => {
  await seedTaxonomy(sdk)

  await gotoReviews()
  await expect(page.locator(reviewsPageSelector)).toBeVisible()

  await page.locator(proposeOpenButtonSelector).click()
  await expect(page.locator(proposeComposerSelector)).toBeVisible()

  const title = `e2e-auto-${Date.now()}`
  await page.locator('[data-field="proposal-title"]').fill(`Proposal: ${title}`)
  await page.locator('[data-field="rationale"]').fill("automated e2e rationale")
  await page.locator('[data-field="node-kind"]').selectOption("claim")
  await page.locator('[data-field="node-title"]').fill(title)
  await page.locator('[data-field="auto-approve"]').check()
  await page.locator(proposeSubmitButtonSelector).click()

  await expect(page.locator(proposalStatusSelector)).toHaveText(/approved/i, { timeout: 15_000 })
  await expect(page.locator(proposalCommitSelector)).toBeVisible()

  await gotoTab("nodes")
  await expect(page.locator(entityTabSelector("node"))).toBeVisible()

  // poll: approved proposal may take a tick to publish nodes list
  await expect
    .poll(
      async () => {
        const nodes = await sdk.domain.node.list({ kind: "claim" }).then((r: any) => (r.data ?? []) as any[])
        return nodes.some((node) => node.title === title)
      },
      { timeout: 10_000 },
    )
    .toBe(true)

  const created = await sdk.domain.node
    .list({ kind: "claim" })
    .then((r: any) => ((r.data ?? []) as any[]).find((n) => n.title === title))
  expect(created).toBeTruthy()
  await expect(page.locator(entityItemSelector("node", created.id))).toBeVisible()
})

test("propose → approve as a reviewer lands a commit in the proposal detail", async ({ page, sdk, gotoReviews }) => {
  await seedTaxonomy(sdk)

  // Seed a pending proposal via the SDK under a different actor.
  const proposer = { type: "user" as const, id: "usr_proposer" }
  const nodeID = `nod_${Date.now().toString(36)}`
  const created = await sdk.domain.proposal.create({
    title: `Seeded for review ${Date.now()}`,
    actor: proposer,
    changes: [{ op: "create_node", id: nodeID, kind: "claim", title: "Seeded claim" }],
    rationale: "seeded by e2e",
  })
  const proposalID = created.data!.id

  // admin actor (from cookie) is different from proposer, so approve should be allowed.
  await gotoReviews(proposalID)
  await expect(page.locator(proposalDetailSelector)).toBeVisible()
  await expect(page.locator(proposalStatusSelector)).toHaveText(/pending/i)

  await page.locator(proposalActionSelector("approve")).click()
  await expect(page.locator(proposalStatusSelector)).toHaveText(/approved/i, { timeout: 10_000 })
  await expect(page.locator(proposalCommitSelector)).toBeVisible()

  const commit = await sdk.domain.commit.list({ proposalID }).then((r: any) => (r.data ?? [])[0])
  expect(commit).toBeTruthy()
  expect(commit.changes.some((c: any) => c.op === "create_node" && c.id === nodeID)).toBe(true)
})

test("proposer can withdraw a pending proposal", async ({ page, sdk, gotoReviews }) => {
  await seedTaxonomy(sdk)

  // Proposer actor matches the cookie admin user so the UI surfaces withdraw.
  const proposer = { type: "user" as const, id: "usr_admin" }
  const created = await sdk.domain.proposal.create({
    title: `Seeded for withdraw ${Date.now()}`,
    actor: proposer,
    changes: [{ op: "create_node", kind: "claim", title: "Withdraw candidate" }],
  })
  const proposalID = created.data!.id

  await gotoReviews(proposalID)
  await expect(page.locator(proposalDetailSelector)).toBeVisible()
  await page.locator(proposalActionSelector("withdraw")).click()
  await expect(page.locator(proposalStatusSelector)).toHaveText(/withdrawn/i, { timeout: 10_000 })
})
