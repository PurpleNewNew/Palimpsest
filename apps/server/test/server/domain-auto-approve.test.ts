import { describe, expect, test } from "bun:test"
import { mkdtemp } from "fs/promises"
import os from "os"
import path from "path"

import { Server } from "../../src/server/server"
import { Log } from "../../src/util/log"
import { serverTest } from "../fixture/server"

Log.init({ print: false })

/**
 * Exercise the actor-based autoApprove policy locked by
 * `specs/domain.md` Decision 1:
 *
 * - `user`   → default `autoApprove: true`
 * - `system` → default `autoApprove: true`
 * - `agent`  → always `false` (safety invariant; even explicit `true`
 *                              from the caller is overridden)
 * - explicit `autoApprove: false` opts any actor out
 */

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

async function setupProject() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-auto-approve-"))
  const app = Server.App()
  const cookie = await login(app)
  const headers = { "x-palimpsest-directory": dir, Cookie: cookie }
  const json = { ...headers, "content-type": "application/json" }

  const tax = await app.request("/domain/taxonomy", {
    method: "PUT",
    headers: json,
    body: JSON.stringify({
      nodeKinds: ["claim"],
      edgeKinds: ["supports"],
      runKinds: ["scan"],
      artifactKinds: ["report"],
      decisionKinds: ["accept_claim"],
      decisionStates: ["accepted"],
    }),
  })
  expect(tax.status).toBe(200)

  return { dir, app, json }
}

async function postNode(
  app: ReturnType<typeof Server.App>,
  json: Record<string, string>,
  body: Record<string, unknown>,
) {
  const res = await app.request("/domain/node", {
    method: "POST",
    headers: json,
    body: JSON.stringify(body),
  })
  expect(res.status).toBe(200)
  return res.json() as Promise<{ id: string; status: string }>
}

describe("domain routes autoApprove policy (Decision 1)", () => {
  test("user actor auto-commits by default", () =>
    serverTest(async ({ dirs }) => {
      const { dir, app, json } = await setupProject()
      dirs.push(dir)

      const proposal = await postNode(app, json, {
        id: "nod_user_default",
        kind: "claim",
        title: "User-authored claim",
        author: { type: "user", id: "usr_author" },
      })
      expect(proposal.status).toBe("approved")
    }))

  test("system actor auto-commits by default", () =>
    serverTest(async ({ dirs }) => {
      const { dir, app, json } = await setupProject()
      dirs.push(dir)

      const proposal = await postNode(app, json, {
        id: "nod_system_default",
        kind: "claim",
        title: "System-authored claim",
        author: { type: "system", id: "sys_bootstrap" },
      })
      expect(proposal.status).toBe("approved")
    }))

  test("agent actor stays pending by default", () =>
    serverTest(async ({ dirs }) => {
      const { dir, app, json } = await setupProject()
      dirs.push(dir)

      const proposal = await postNode(app, json, {
        id: "nod_agent_default",
        kind: "claim",
        title: "Agent-authored claim",
        author: { type: "agent", id: "agt_author", version: "0.1.0" },
      })
      expect(proposal.status).toBe("pending")
    }))

  test("agent actor cannot opt into auto-approve (safety invariant)", () =>
    serverTest(async ({ dirs }) => {
      const { dir, app, json } = await setupProject()
      dirs.push(dir)

      const proposal = await postNode(app, json, {
        id: "nod_agent_override",
        kind: "claim",
        title: "Agent-authored claim asking for ship mode",
        author: { type: "agent", id: "agt_author", version: "0.1.0" },
        autoApprove: true,
      })
      expect(proposal.status).toBe("pending")
    }))

  test("user actor may opt out with explicit autoApprove=false", () =>
    serverTest(async ({ dirs }) => {
      const { dir, app, json } = await setupProject()
      dirs.push(dir)

      const proposal = await postNode(app, json, {
        id: "nod_user_optout",
        kind: "claim",
        title: "User draft",
        author: { type: "user", id: "usr_author" },
        autoApprove: false,
      })
      expect(proposal.status).toBe("pending")
    }))

  test("system actor may opt out with explicit autoApprove=false", () =>
    serverTest(async ({ dirs }) => {
      const { dir, app, json } = await setupProject()
      dirs.push(dir)

      const proposal = await postNode(app, json, {
        id: "nod_system_optout",
        kind: "claim",
        title: "System draft",
        author: { type: "system", id: "sys_bootstrap" },
        autoApprove: false,
      })
      expect(proposal.status).toBe("pending")
    }))

  test("POST /domain/proposal honors the same policy", () =>
    serverTest(async ({ dirs }) => {
      const { dir, app, json } = await setupProject()
      dirs.push(dir)

      const userRes = await app.request("/domain/proposal", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          title: "User proposal",
          actor: { type: "user", id: "usr_author" },
          changes: [{ op: "create_node", id: "nod_bulk_user", kind: "claim", title: "Bulk user" }],
        }),
      })
      expect(userRes.status).toBe(200)
      expect((await userRes.json()).status).toBe("approved")

      const agentRes = await app.request("/domain/proposal", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          title: "Agent proposal",
          actor: { type: "agent", id: "agt_author", version: "0.1.0" },
          autoApprove: true,
          changes: [{ op: "create_node", id: "nod_bulk_agent", kind: "claim", title: "Bulk agent" }],
        }),
      })
      expect(agentRes.status).toBe(200)
      expect((await agentRes.json()).status).toBe("pending")
    }))
})
