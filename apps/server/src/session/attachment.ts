import { SessionAttachment as SessionAttachmentSchema } from "@palimpsest/plugin-sdk/product"
import z from "zod"

import { Domain } from "@/domain/domain"
import { Project } from "@/project/project"
import { Database, eq } from "@/storage/db"
import { fn } from "@/util/fn"

import { Session } from "./index"
import { SessionAttachmentTable } from "./session.sql"

export namespace SessionAttachment {
  export const Info = SessionAttachmentSchema
  export type Info = z.infer<typeof Info>

  function fromRow(row: typeof SessionAttachmentTable.$inferSelect, fallbackTitle?: string): Info {
    return Info.parse({
      entity: row.entity,
      id: row.entity_id,
      title: row.title ?? fallbackTitle,
      lensID: row.lens_id ?? undefined,
    })
  }

  async function ensureAttachedEntityBelongsToSessionProject(session: Session.Info, input: Info) {
    switch (input.entity) {
      case "project":
        if (input.id !== session.projectID) {
          throw new Error(`Project attachment ${input.id} does not match session project ${session.projectID}`)
        }
        return
      case "node": {
        const item = await Domain.getNode(input.id)
        if (item.projectID !== session.projectID) throw new Error(`Node ${input.id} is outside the session project`)
        return
      }
      case "run": {
        const item = await Domain.getRun(input.id)
        if (item.projectID !== session.projectID) throw new Error(`Run ${input.id} is outside the session project`)
        return
      }
      case "proposal": {
        const item = await Domain.getProposal(input.id)
        if (item.projectID !== session.projectID) throw new Error(`Proposal ${input.id} is outside the session project`)
        return
      }
      case "decision": {
        const item = await Domain.getDecision(input.id)
        if (item.projectID !== session.projectID) throw new Error(`Decision ${input.id} is outside the session project`)
      }
    }
  }

  export const list = fn(z.object({ sessionID: Session.Info.shape.id }), async (input) => {
    const session = await Session.get(input.sessionID)
    if (!session) throw new Error(`Session not found: ${input.sessionID}`)
    const project = Project.get(session.projectID)
    const rows = Database.use((db) =>
      db.select().from(SessionAttachmentTable).where(eq(SessionAttachmentTable.session_id, input.sessionID)).all(),
    )
    return rows.map((row) => fromRow(row, row.entity === "project" ? project?.name : undefined))
  })

  export const replace = fn(
    z.object({
      sessionID: Session.Info.shape.id,
      attachments: Info.array(),
    }),
    async (input) => {
      const session = await Session.get(input.sessionID)
      if (!session) throw new Error(`Session not found: ${input.sessionID}`)
      for (const item of input.attachments) {
        await ensureAttachedEntityBelongsToSessionProject(session, item)
      }
      Database.use((db) => {
        db.delete(SessionAttachmentTable).where(eq(SessionAttachmentTable.session_id, input.sessionID)).run()
        for (const item of input.attachments) {
          db.insert(SessionAttachmentTable)
            .values({
              session_id: input.sessionID,
              entity: item.entity,
              entity_id: item.id,
              title: item.title,
              lens_id: item.lensID,
              time_created: Date.now(),
              time_updated: Date.now(),
            })
            .run()
        }
      })
      return list.force({ sessionID: input.sessionID })
    },
  )
}
