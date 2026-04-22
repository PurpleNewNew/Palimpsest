import { describe, expect, test } from "bun:test"
import { mkdtemp } from "fs/promises"
import os from "os"
import path from "path"

import { Domain } from "../../src/domain/domain"
import { Server } from "../../src/server/server"
import { Log } from "../../src/util/log"
import { serverTest } from "../fixture/server"

Log.init({ print: false })

async function login(app: ReturnType<typeof Server.App>) {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "123456" }),
  })
  expect(res.status).toBe(200)
  const cookie = res.headers.get("set-cookie")
  return cookie!.split(";")[0]
}

async function bootstrap(app: ReturnType<typeof Server.App>, cookie: string, dir: string) {
  const res = await app.request("/api/projects", {
    method: "POST",
    headers: { Cookie: cookie, "content-type": "application/json" },
    body: JSON.stringify({
      directory: dir,
      name: "Share entity",
      presetID: "research.inquiry",
      input: { question: "Share entity", background: "Object-share tests." },
    }),
  })
  expect(res.status).toBeLessThan(400)
  return res.json()
}

describe("object-centric workspace shares", () => {
  test("publish + unpublish a node as a domain share", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-entity-share-node-"))
      dirs.push(dir)
      const app = Server.App()
      const cookie = await login(app)
      await bootstrap(app, cookie, dir)

      const project = (await (
        await app.request("/api/projects", { headers: { Cookie: cookie } })
      ).json()).find((p: { worktree: string }) => p.worktree === dir)
      expect(project?.id).toBeTruthy()

      const proposal = await Domain.propose({
        projectID: project.id,
        title: "Seed node for share",
        actor: { type: "system", id: "share:test" },
        changes: [
          {
            op: "create_node",
            id: "nod_share_seed",
            kind: "claim",
            title: "Claim visible in share page",
            body: "Claim body",
          },
        ],
      })
      await Domain.reviewProposal({
        proposalID: proposal.id,
        actor: { type: "system", id: "share:test" },
        verdict: "approve",
      })

      const publish = await app.request("/api/workspaces/shares/node/nod_share_seed", {
        method: "POST",
        headers: { Cookie: cookie, "content-type": "application/json" },
      })
      expect(publish.status).toBe(200)
      const share = await publish.json()
      expect(share.entityKind).toBe("node")
      expect(share.entityID).toBe("nod_share_seed")
      expect(share.kind).toBe("node")
      expect(share.title).toBe("Claim visible in share page")
      expect(share.url).toContain(`/share/${share.slug}`)

      const data = await app.request(`/api/shares/${share.slug}/data`)
      expect(data.status).toBe(200)
      const dataBody = await data.json()
      expect(dataBody.type).toBe("node_share")
      expect(dataBody.data.node.id).toBe("nod_share_seed")

      const page = await app.request(`/share/${share.slug}`)
      expect(page.status).toBe(200)
      const html = await page.text()
      expect(html).toContain("Shared node")
      expect(html).toContain("Claim visible in share page")

      const twice = await app.request("/api/workspaces/shares/node/nod_share_seed", {
        method: "POST",
        headers: { Cookie: cookie, "content-type": "application/json" },
      })
      expect(twice.status).toBe(200)
      const again = await twice.json()
      expect(again.id).toBe(share.id)

      const unpublish = await app.request("/api/workspaces/shares/node/nod_share_seed", {
        method: "DELETE",
        headers: { Cookie: cookie },
      })
      expect(unpublish.status).toBe(200)

      const relist = await app.request("/api/workspaces/shares/node/nod_share_seed", {
        method: "DELETE",
        headers: { Cookie: cookie },
      })
      expect(relist.status).toBe(404)
    }))

  test("publish a proposal and a decision", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-entity-share-multi-"))
      dirs.push(dir)
      const app = Server.App()
      const cookie = await login(app)
      await bootstrap(app, cookie, dir)

      const project = (await (
        await app.request("/api/projects", { headers: { Cookie: cookie } })
      ).json()).find((p: { worktree: string }) => p.worktree === dir)

      const proposal = await Domain.propose({
        projectID: project.id,
        title: "Proposal worth sharing",
        actor: { type: "system", id: "share:test" },
        changes: [
          {
            op: "create_node",
            id: "nod_share_claim",
            kind: "claim",
            title: "Claim under decision",
          },
          {
            op: "create_decision",
            id: "dec_share_target",
            nodeID: "nod_share_claim",
            kind: "advance_claim",
            state: "accepted",
            rationale: "Approve shared decision.",
          },
        ],
      })
      await Domain.reviewProposal({
        proposalID: proposal.id,
        actor: { type: "system", id: "share:test" },
        verdict: "approve",
      })

      const proposalShare = await app.request(
        `/api/workspaces/shares/proposal/${proposal.id}`,
        {
          method: "POST",
          headers: { Cookie: cookie, "content-type": "application/json" },
        },
      )
      expect(proposalShare.status).toBe(200)
      const ps = await proposalShare.json()
      expect(ps.entityKind).toBe("proposal")
      expect(ps.entityID).toBe(proposal.id)

      const decisionShare = await app.request(
        `/api/workspaces/shares/decision/dec_share_target`,
        {
          method: "POST",
          headers: { Cookie: cookie, "content-type": "application/json" },
        },
      )
      expect(decisionShare.status).toBe(200)
      const ds = await decisionShare.json()
      expect(ds.entityKind).toBe("decision")
      expect(ds.entityID).toBe("dec_share_target")
      expect(ds.kind).toBe("decision")

      const proposalData = await app.request(`/api/shares/${ps.slug}/data`)
      expect(proposalData.status).toBe(200)
      const proposalBody = await proposalData.json()
      expect(proposalBody.type).toBe("proposal_share")
      expect(proposalBody.data.proposal.id).toBe(proposal.id)
      expect(proposalBody.data.affected.decisions.some((decision: { id: string }) => decision.id === "dec_share_target")).toBe(
        true,
      )

      const decisionPage = await app.request(`/share/${ds.slug}`)
      expect(decisionPage.status).toBe(200)
      const decisionHtml = await decisionPage.text()
      expect(decisionHtml).toContain("Shared decision")
      expect(decisionHtml).toContain("dec_share_target")
    }))
})
