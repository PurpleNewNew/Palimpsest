import { describe, expect, test } from "bun:test"
import { mkdtemp } from "fs/promises"
import os from "os"
import path from "path"

import { ControlPlane } from "../../src/control-plane/control-plane"
import { Server } from "../../src/server/server"
import { Log } from "../../src/util/log"
import { serverTest } from "../fixture/server"

Log.init({ print: false })

async function login(app: ReturnType<typeof Server.App>, username: string, password: string) {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
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
      name: "Domain permissions",
      presetID: "research.inquiry",
      input: { question: "Domain permissions", background: "Gate tests." },
    }),
  })
  expect(res.status).toBeLessThan(400)
  return res.json()
}

describe("domain route permissions", () => {
  test("viewer may read but not write domain endpoints", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-perm-"))
      dirs.push(dir)
      const app = Server.App()

      const adminCookie = await login(app, "admin", "123456")
      await bootstrap(app, adminCookie, dir)

      const invite = await ControlPlane.createInvite({
        workspaceID: "wrk_default",
        actorUserID: "usr_admin",
        role: "viewer",
      })
      const accepted = await ControlPlane.acceptInvite({
        code: invite.code,
        username: "viewer-user",
        password: "viewer-pass",
      })
      expect(accepted?.role).toBe("viewer")

      const viewerCookie = await login(app, "viewer-user", "viewer-pass")

      const read = await app.request(`/domain/proposal?directory=${encodeURIComponent(dir)}`, {
        headers: { Cookie: viewerCookie },
      })
      expect(read.status).toBe(200)

      const write = await app.request(`/domain/proposal?directory=${encodeURIComponent(dir)}`, {
        method: "POST",
        headers: { Cookie: viewerCookie, "content-type": "application/json" },
        body: JSON.stringify({
          title: "Viewer attempt",
          actor: { type: "user", id: "viewer-user" },
          changes: [
            { op: "create_node", id: "nod_forbidden", kind: "claim", title: "Should not stick" },
          ],
        }),
      })
      expect(write.status).toBe(403)
    }))

  test("viewer cannot review or withdraw proposals", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-perm-review-"))
      dirs.push(dir)
      const app = Server.App()

      const adminCookie = await login(app, "admin", "123456")
      await bootstrap(app, adminCookie, dir)

      const adminProposal = await app.request(`/domain/proposal?directory=${encodeURIComponent(dir)}`, {
        method: "POST",
        headers: { Cookie: adminCookie, "content-type": "application/json" },
        body: JSON.stringify({
          title: "Admin proposal",
          actor: { type: "user", id: "usr_admin" },
          // Opt out of Decision 1's user-auto-approve default so the
          // proposal stays pending for the viewer-review-blocked assertions.
          autoApprove: false,
          changes: [
            { op: "create_node", id: "nod_perm_seed", kind: "claim", title: "Seed claim" },
          ],
        }),
      })
      expect(adminProposal.status).toBe(200)
      const proposal = await adminProposal.json()

      const invite = await ControlPlane.createInvite({
        workspaceID: "wrk_default",
        actorUserID: "usr_admin",
        role: "viewer",
      })
      await ControlPlane.acceptInvite({
        code: invite.code,
        username: "viewer-reviewer",
        password: "viewer-pass",
      })
      const viewerCookie = await login(app, "viewer-reviewer", "viewer-pass")

      const review = await app.request(
        `/domain/proposal/${proposal.id}/review?directory=${encodeURIComponent(dir)}`,
        {
          method: "POST",
          headers: { Cookie: viewerCookie, "content-type": "application/json" },
          body: JSON.stringify({ verdict: "approve" }),
        },
      )
      expect(review.status).toBe(403)

      const withdraw = await app.request(
        `/domain/proposal/${proposal.id}?directory=${encodeURIComponent(dir)}`,
        {
          method: "DELETE",
          headers: { Cookie: viewerCookie },
        },
      )
      expect(withdraw.status).toBe(403)
    }))
})
