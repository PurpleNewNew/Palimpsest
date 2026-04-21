import { test, expect } from "../fixtures"
import fs from "node:fs/promises"
import path from "node:path"
import { entityGroupSelector, entityItemSelector, entityTabSelector } from "../selectors"

async function seedTaxonomy(sdk: any) {
  await sdk.domain.taxonomy2.update({ nodeKinds: ["source"] })
}

test("sources tab renders both accepted source nodes and unclaimed filesystem files", async ({
  page,
  sdk,
  gotoTab,
  directory,
}) => {
  await seedTaxonomy(sdk)

  // Seed one accepted source node.
  const actor = { type: "user" as const, id: "usr_admin" }
  const nodeTitle = `ref-${Date.now()}`
  const proposal = await sdk.domain.proposal
    .create({
      actor,
      autoApprove: true,
      changes: [{ op: "create_node", kind: "source", title: nodeTitle, body: "seeded body" }],
    })
    .then((r: any) => r.data!)
  const nodeID = proposal.changes[0].id as string

  // Seed one unclaimed source file.
  const sourcesDir = path.join(directory, ".palimpsest", "sources")
  await fs.mkdir(sourcesDir, { recursive: true })
  const filename = `note-${Date.now()}.md`
  const filePath = path.join(sourcesDir, filename)
  await fs.writeFile(filePath, "# e2e note\n\nSeed body.\n", "utf8")

  try {
    await gotoTab("sources")
    await expect(page.locator(entityTabSelector("source"))).toBeVisible()
    await expect(page.locator(entityGroupSelector("source", "Accepted sources"))).toBeVisible()
    await expect(
      page.locator(entityGroupSelector("source", ".palimpsest/sources")).first(),
    ).toBeVisible()
    await expect(page.locator(entityItemSelector("source", `node:${nodeID}`))).toBeVisible()
    await expect(
      page.locator(entityItemSelector("source", `file:.palimpsest/sources/${filename}`)),
    ).toBeVisible()
  } finally {
    await fs.rm(filePath, { force: true }).catch(() => undefined)
  }
})
