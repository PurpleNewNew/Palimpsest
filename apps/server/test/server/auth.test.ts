import { describe, expect, test } from "bun:test"
import { mkdtemp } from "fs/promises"
import os from "os"
import path from "path"
import { Server } from "../../src/server/server"
import { serverTest } from "../fixture/server"

async function login(app: ReturnType<typeof Server.App>) {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "123456",
    }),
  })
  expect(res.status).toBe(200)
  const body = await res.json()
  const cookie = res.headers.get("set-cookie")
  expect(cookie).toBeTruthy()
  return {
    body,
    cookie: cookie!.split(";")[0],
  }
}

describe("auth routes", () => {
  test("requires account login before listing projects", () =>
    serverTest(async () => {
      const app = Server.App()
      const res = await app.request("/project")
      expect(res.status).toBe(401)
    }))

  test("returns authenticated workspace state after login", () =>
    serverTest(async () => {
      const app = Server.App()
      const { body, cookie } = await login(app)
      expect(body.user.username).toBe("admin")
      expect(body.workspaceID).toBe("wrk_default")

      const session = await app.request("/api/auth/session", {
        headers: {
          Cookie: cookie,
        },
      })
      expect(session.status).toBe(200)
      const auth = await session.json()
      expect(auth.user.username).toBe("admin")
      expect(auth.workspaces).toHaveLength(1)
      expect(auth.workspaces[0].role).toBe("owner")
    }))

  test("publishes local share data behind authenticated session actions", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "opencode-auth-"))
      dirs.push(dir)
      const app = Server.App()
      const { cookie } = await login(app)
      const headers = {
        Cookie: cookie,
        "x-palimpsest-directory": dir,
      }

      const create = await app.request("/session", {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Shared session",
        }),
      })
      expect(create.status).toBe(200)
      const session = await create.json()

      const shared = await app.request(`/session/${session.id}/share`, {
        method: "POST",
        headers,
      })
      expect(shared.status).toBe(200)
      const info = await shared.json()
      const slug = new URL(info.share.url).pathname.split("/").pop()
      expect(slug).toBeTruthy()

      const data = await app.request(`/api/shares/${slug}/data`)
      expect(data.status).toBe(200)
      const body = await data.json()
      expect(body.some((item: { type: string }) => item.type === "session")).toBe(true)
    }))
})
