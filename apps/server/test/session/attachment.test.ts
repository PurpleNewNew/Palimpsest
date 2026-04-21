import { describe, expect, test } from "bun:test"
import path from "path"

import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { SessionAttachment } from "../../src/session/attachment"
import { Log } from "../../src/util/log"

const projectRoot = path.join(__dirname, "../..")
Log.init({ print: false })

describe("SessionAttachment", () => {
  test("clones attachments for child sessions and forks", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const root = await Session.create({ title: "root session" })
        const expected = [
          {
            entity: "project" as const,
            id: root.projectID,
            title: "Project Root",
          },
        ]

        await SessionAttachment.replace({
          sessionID: root.id,
          attachments: expected,
        })

        const child = await Session.create({ title: "child session", parentID: root.id })
        const fork = await Session.fork({ sessionID: root.id })

        expect(await SessionAttachment.list({ sessionID: child.id })).toEqual(expected)
        expect(await SessionAttachment.list({ sessionID: fork.id })).toEqual(expected)

        await Session.remove(child.id)
        await Session.remove(fork.id)
        await Session.remove(root.id)
      },
    })
  })
})
