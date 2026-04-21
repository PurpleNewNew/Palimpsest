import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { mkdtemp } from "fs/promises"
import os from "os"
import path from "path"

import { ControlPlane } from "../../src/control-plane/control-plane"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { SessionRoutes } from "../../src/server/routes/session"
import { Log } from "../../src/util/log"
import { serverTest } from "../fixture/server"

Log.init({ print: false })

describe("session attachment routes", () => {
  // TODO: restore this as a live route test once the recovered server/request harness
  // exits cleanly under AsyncLocalStorage-backed ControlPlane + Instance contexts.
  test.skip("replace, inherit, and fork session attachments", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-session-attachment-test-"))
      dirs.push(dir)
      const login = await ControlPlane.login({
        username: "admin",
        password: "123456",
      })
      expect(login).toBeTruthy()

      const app = new Hono().route("/session", SessionRoutes())

      await ControlPlane.provide({
        sessionID: login!.id,
        workspaceID: login!.auth.workspaceID,
        fn: async () => {
          await Instance.provide({
            directory: dir,
            fn: async () => {
              const json = { "content-type": "application/json" }

              const root = await Session.create({ title: "root-session" })

              const replacement = [
                {
                  entity: "project",
                  id: root.projectID,
                  title: "Recovered Project",
                },
              ]

              const replace = await app.request(`/session/${root.id}/attachments`, {
                method: "PUT",
                headers: json,
                body: JSON.stringify({ attachments: replacement }),
              })
              expect(replace.status).toBe(200)
              expect(await replace.json()).toEqual(replacement)

              const listed = await app.request(`/session/${root.id}/attachments`)
              expect(listed.status).toBe(200)
              expect(await listed.json()).toEqual(replacement)

              const child = await Session.create({ title: "child-session", parentID: root.id })

              const childAttachments = await app.request(`/session/${child.id}/attachments`)
              expect(childAttachments.status).toBe(200)
              expect(await childAttachments.json()).toEqual(replacement)

              const fork = await Session.fork({ sessionID: root.id })

              const forkAttachments = await app.request(`/session/${fork.id}/attachments`)
              expect(forkAttachments.status).toBe(200)
              expect(await forkAttachments.json()).toEqual(replacement)
            },
          })
        },
      })
    }))
})
