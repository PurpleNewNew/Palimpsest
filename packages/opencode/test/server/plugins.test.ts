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
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "123456",
    }),
  })
  expect(res.status).toBe(200)
  const cookie = res.headers.get("set-cookie")
  expect(cookie).toBeTruthy()
  return cookie!.split(";")[0]
}

describe("plugin routes", () => {
  test("create project through preset and resolve shell", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-plugin-test-"))
      dirs.push(dir)
      const app = Server.App()
      const cookie = await login(app)

      const registry = await app.request("/api/plugins/registry", {
        headers: {
          Cookie: cookie,
        },
      })
      expect(registry.status).toBe(200)
      const info = await registry.json()
      expect(info.presets.map((item: { id: string }) => item.id)).toEqual(
        expect.arrayContaining(["core.blank", "research.inquiry", "security-audit.audit"]),
      )

      const created = await app.request("/api/projects", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          directory: dir,
          name: "Research Scope",
          presetID: "research.inquiry",
          input: {
            question: "What is changing?",
            background: "Track it as durable assets.",
          },
        }),
      })
      expect(created.status).toBe(200)
      const shell = await created.json()
      expect(shell.preset.id).toBe("research.inquiry")
      expect(shell.lenses.map((item: { id: string }) => item.id)).toEqual(["core.shell", "research.workbench"])
      expect(shell.workspaceTabs.map((item: { id: string }) => item.id)).toEqual(
        expect.arrayContaining(["nodes", "runs", "artifacts", "decisions", "reviews", "research", "literature"]),
      )
      expect(shell.actions.map((item: { id: string }) => item.id)).toEqual(["ask", "propose", "review", "run", "inspect"])

      const list = await app.request("/api/projects", {
        headers: {
          Cookie: cookie,
        },
      })
      expect(list.status).toBe(200)
      const projects = await list.json()
      const project = projects.find((item: { worktree: string }) => item.worktree === dir)
      expect(project?.id).toBeTruthy()

      const shellGet = await app.request(`/api/projects/${project.id}/shell`, {
        headers: {
          Cookie: cookie,
        },
      })
      expect(shellGet.status).toBe(200)
      expect((await shellGet.json()).preset.id).toBe("research.inquiry")

      const remove = await app.request(`/api/projects/${project.id}/lenses/research.workbench`, {
        method: "DELETE",
        headers: {
          Cookie: cookie,
        },
      })
      expect(remove.status).toBe(200)
      expect((await remove.json()).lenses.map((item: { id: string }) => item.id)).toEqual(["core.shell"])

      const install = await app.request(`/api/projects/${project.id}/lenses`, {
        method: "POST",
        headers: {
          Cookie: cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          lensID: "research.workbench",
        }),
      })
      expect(install.status).toBe(200)
      expect((await install.json()).lenses.map((item: { id: string }) => item.id)).toEqual(["core.shell", "research.workbench"])

      const meta = await Bun.file(path.join(dir, ".palimpsest", "project.json")).json()
      expect(meta).toEqual({
        presetID: "research.inquiry",
        taxonomyID: "research.core",
        lensIDs: ["core.shell", "research.workbench"],
      })
      const brief = await Bun.file(path.join(dir, ".palimpsest", "research", "brief.md")).text()
      expect(brief).toContain("# Research Brief")
      expect(brief).toContain("What is changing?")
    }))
})
