import { describe, expect, test } from "bun:test"
import { mkdtemp } from "fs/promises"
import os from "os"
import path from "path"

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

describe("plugin host API (Stage B)", () => {
  test("research plugin exposes /api/plugin/research/ping via host.routes.register", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-plugin-route-test-"))
      dirs.push(dir)
      const app = Server.App()
      const cookie = await login(app)

      await app.request("/api/projects", {
        method: "POST",
        headers: { Cookie: cookie, "content-type": "application/json" },
        body: JSON.stringify({
          directory: dir,
          name: "Route Smoke",
          presetID: "research.inquiry",
          input: { question: "Does host.routes.register work?", background: "B1 smoke." },
        }),
      })

      const ping = await app.request(`/api/plugin/research/ping?directory=${encodeURIComponent(dir)}`, {
        headers: { Cookie: cookie },
      })
      expect(ping.status).toBe(200)
      const body = await ping.json()
      expect(body.ok).toBe(true)
      expect(body.pluginID).toBe("research")
      expect(typeof body.heartbeats).toBe("number")

      const status = await app.request(`/api/plugin/research/status?directory=${encodeURIComponent(dir)}`, {
        headers: { Cookie: cookie },
      })
      expect(status.status).toBe(200)
      const statusBody = await status.json()
      expect(statusBody.pluginID).toBe("research")
      expect(statusBody.project?.worktree).toBe(dir)
      expect(statusBody.metadataDir).toBe(path.join(dir, ".palimpsest"))

      const unknown = await app.request(`/api/plugin/research/does-not-exist?directory=${encodeURIComponent(dir)}`, {
        headers: { Cookie: cookie },
      })
      expect(unknown.status).toBe(404)

      const unmountedPlugin = await app.request(`/api/plugin/nobody-home/hello?directory=${encodeURIComponent(dir)}`, {
        headers: { Cookie: cookie },
      })
      expect(unmountedPlugin.status).toBe(404)
    }))

  test("research plugin registers `research_hello` via host.tools.register", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-plugin-tool-test-"))
      dirs.push(dir)

      // Boot a fresh instance in `dir` that runs the full InstanceBootstrap
      // (including Product.init() → research server-hook) so the plugin gets
      // to register its tools into this instance's ToolRegistry state.
      const { Instance } = await import("../../src/project/instance")
      const { InstanceBootstrap } = await import("../../src/project/bootstrap")
      const { ToolRegistry } = await import("../../src/tool/registry")
      const ids = await Instance.provide({
        directory: dir,
        init: InstanceBootstrap,
        fn: async () => ToolRegistry.ids(),
      })
      expect(ids).toContain("research_hello")
    }))
})
