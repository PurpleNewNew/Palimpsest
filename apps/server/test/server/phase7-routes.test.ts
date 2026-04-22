import { describe, expect, test } from "bun:test"
import { mkdtemp } from "fs/promises"
import os from "os"
import path from "path"

import { ControlPlane } from "../../src/control-plane/control-plane"
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
  expect(cookie).toBeTruthy()
  return cookie!.split(";")[0]
}

async function bootstrap(app: ReturnType<typeof Server.App>, cookie: string, dir: string) {
  const res = await app.request("/api/projects", {
    method: "POST",
    headers: { Cookie: cookie, "content-type": "application/json" },
    body: JSON.stringify({
      directory: dir,
      name: "Phase 7",
      presetID: "research.inquiry",
      input: { question: "Phase 7 smoke", background: "Phase 7 tests." },
    }),
  })
  expect(res.status).toBeLessThan(400)
  return res.json()
}

describe("Phase 7 HTTP routes", () => {
  test("domain export + import round-trips nodes and edges", () =>
    serverTest(async ({ dirs }) => {
      const source = await mkdtemp(path.join(os.tmpdir(), "palimpsest-phase7-src-"))
      const target = await mkdtemp(path.join(os.tmpdir(), "palimpsest-phase7-dst-"))
      dirs.push(source, target)
      const app = Server.App()
      const cookie = await login(app)

      await bootstrap(app, cookie, source)
      await bootstrap(app, cookie, target)

      const sourceProject = (await (
        await app.request("/api/projects", { headers: { Cookie: cookie } })
      ).json()).find((p: { worktree: string }) => p.worktree === source)
      expect(sourceProject?.id).toBeTruthy()

      const targetProject = (await (
        await app.request("/api/projects", { headers: { Cookie: cookie } })
      ).json()).find((p: { worktree: string }) => p.worktree === target)
      expect(targetProject?.id).toBeTruthy()

      const seed = await Domain.propose({
        projectID: sourceProject.id,
        title: "Seed node for export",
        actor: { type: "system", id: "phase7:test" },
        changes: [
          {
            op: "create_node",
            id: "nod_phase7_seed",
            kind: "claim",
            title: "Phase 7 seed claim",
            body: "Claim body that must survive export.",
          },
        ],
      })
      await Domain.reviewProposal({
        proposalID: seed.id,
        actor: { type: "system", id: "phase7:test" },
        verdict: "approve",
        comments: "Approve seed.",
      })

      const exportRes = await app.request(`/domain/export?directory=${encodeURIComponent(source)}`, {
        headers: { Cookie: cookie },
      })
      expect(exportRes.status).toBe(200)
      const envelope = await exportRes.json()
      expect(envelope.version).toBe(1)
      expect(envelope.nodes.map((n: { id: string }) => n.id)).toContain("nod_phase7_seed")

      const customNodes = envelope.nodes.filter((n: { id: string; kind: string }) => n.id === "nod_phase7_seed")
      const importRes = await app.request(`/domain/import?directory=${encodeURIComponent(target)}`, {
        method: "POST",
        headers: { Cookie: cookie, "content-type": "application/json" },
        body: JSON.stringify({
          envelope: {
            version: envelope.version,
            nodes: customNodes,
          },
          autoApprove: true,
        }),
      })
      expect(importRes.status).toBe(200)
      const imported = await importRes.json()
      expect(imported.status).toBe("approved")

      const targetNodes = await Domain.listNodes({ projectID: targetProject.id, kind: "claim" })
      expect(targetNodes.some((node: { title: string }) => node.title === "Phase 7 seed claim")).toBe(true)
    }))

  test("domain import on empty envelope returns 400", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-phase7-empty-"))
      dirs.push(dir)
      const app = Server.App()
      const cookie = await login(app)
      await bootstrap(app, cookie, dir)

      const res = await app.request(`/domain/import?directory=${encodeURIComponent(dir)}`, {
        method: "POST",
        headers: { Cookie: cookie, "content-type": "application/json" },
        body: JSON.stringify({ envelope: {} }),
      })
      expect(res.status).toBe(400)
    }))

  test("decision provenance returns commit + proposal", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-phase7-prov-"))
      dirs.push(dir)
      const app = Server.App()
      const cookie = await login(app)

      await bootstrap(app, cookie, dir)
      const project = (await (
        await app.request("/api/projects", { headers: { Cookie: cookie } })
      ).json()).find((p: { worktree: string }) => p.worktree === dir)

      const proposal = await Domain.propose({
        projectID: project.id,
        title: "Decide something",
        actor: { type: "system", id: "phase7:test" },
        changes: [
          {
            op: "create_node",
            id: "nod_prov_claim",
            kind: "claim",
            title: "Claim under decision",
          },
          {
            op: "create_decision",
            id: "dec_prov_target",
            nodeID: "nod_prov_claim",
            kind: "advance_claim",
            state: "accepted",
            rationale: "Enough evidence to advance.",
          },
        ],
      })
      const result = await Domain.reviewProposal({
        proposalID: proposal.id,
        actor: { type: "system", id: "phase7:test" },
        verdict: "approve",
        comments: "Approve decision.",
      })
      expect(result.commit).toBeTruthy()

      const res = await app.request(
        `/domain/decision/dec_prov_target/provenance?directory=${encodeURIComponent(dir)}`,
        { headers: { Cookie: cookie } },
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.decision.id).toBe("dec_prov_target")
      expect(body.createdBy?.commit?.id).toBe(result.commit!.id)
      expect(body.createdBy?.proposal?.id).toBe(proposal.id)
      expect(body.node?.id).toBe("nod_prov_claim")
    }))

  test("workspace review queue stores assignee, priority, due date, and SLA metadata", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-phase7-queue-"))
      dirs.push(dir)
      const app = Server.App()
      const cookie = await login(app)

      await bootstrap(app, cookie, dir)
      const project = (await (
        await app.request("/api/projects", { headers: { Cookie: cookie } })
      ).json()).find((p: { worktree: string }) => p.worktree === dir)

      const invite = await ControlPlane.createInvite({
        workspaceID: "wrk_default",
        actorUserID: "usr_admin",
        role: "editor",
      })
      const accepted = await ControlPlane.acceptInvite({
        code: invite.code,
        username: "queue-editor",
        password: "queue-pass",
      })
      expect(accepted?.role).toBe("editor")
      const assigneeUserID = accepted?.user.id
      expect(assigneeUserID).toBeTruthy()

      const proposal = await Domain.propose({
        projectID: project.id,
        title: "Queue me",
        actor: { type: "system", id: "phase7:test" },
        changes: [
          {
            op: "create_node",
            id: "nod_queue_seed",
            kind: "claim",
            title: "Queue seed claim",
          },
        ],
      })

      const dueAt = Date.now() + 1000 * 60 * 60 * 24
      const update = await app.request(`/api/workspaces/review-queue/${proposal.id}`, {
        method: "PUT",
        headers: { Cookie: cookie, "content-type": "application/json" },
        body: JSON.stringify({
          assigneeUserID,
          priority: "urgent",
          dueAt,
          slaHours: 72,
        }),
      })
      expect(update.status).toBe(200)
      const item = await update.json()
      expect(item.proposalID).toBe(proposal.id)
      expect(item.assigneeUserID).toBe(assigneeUserID)
      expect(item.priority).toBe("urgent")
      expect(item.dueAt).toBe(dueAt)
      expect(item.slaHours).toBe(72)

      const list = await app.request(`/api/workspaces/wrk_default/review-queue?projectID=${encodeURIComponent(project.id)}`, {
        headers: { Cookie: cookie },
      })
      expect(list.status).toBe(200)
      const queue = await list.json()
      const stored = queue.find((entry: { proposalID: string }) => entry.proposalID === proposal.id)
      expect(stored).toBeTruthy()
      expect(stored.priority).toBe("urgent")
      expect(stored.assigneeUserID).toBe(assigneeUserID)
    }))

  test("workspace shares.session publish + unpublish + revoke", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-phase7-share-"))
      dirs.push(dir)
      const app = Server.App()
      const cookie = await login(app)

      const project = await bootstrap(app, cookie, dir)

      const sessionRes = await app.request(`/session?directory=${encodeURIComponent(dir)}`, {
        method: "POST",
        headers: { Cookie: cookie, "content-type": "application/json" },
        body: JSON.stringify({ projectID: project.id, title: "share test" }),
      })
      expect(sessionRes.status).toBeLessThan(400)
      const session = await sessionRes.json()
      expect(session.id).toBeTruthy()

      const publish = await app.request(`/api/workspaces/shares/session/${session.id}`, {
        method: "POST",
        headers: { Cookie: cookie, "content-type": "application/json" },
      })
      expect(publish.status).toBe(200)
      const share = await publish.json()
      expect(share.id).toBeTruthy()
      expect(share.slug).toBeTruthy()
      expect(share.url).toContain(`/share/${share.slug}`)

      const twice = await app.request(`/api/workspaces/shares/session/${session.id}`, {
        method: "POST",
        headers: { Cookie: cookie, "content-type": "application/json" },
      })
      expect(twice.status).toBe(200)
      const secondShare = await twice.json()
      expect(secondShare.id).toBe(share.id)

      const page = await app.request(`/share/${share.slug}`)
      expect(page.status).toBe(200)
      expect(page.headers.get("content-type") ?? "").toContain("text/html")

      const unpublish = await app.request(`/api/workspaces/shares/session/${session.id}`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      })
      expect(unpublish.status).toBe(200)

      const missing = await app.request(`/share/${share.slug}`)
      expect(missing.status).toBe(404)
    }))
})
