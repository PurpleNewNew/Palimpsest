import type { BusEventDefinition } from "@palimpsest/plugin-sdk/host"
import { eq } from "drizzle-orm"
import type { SQLiteBunDatabase } from "drizzle-orm/bun-sqlite"
import z from "zod"

import { bridge } from "./host-bridge"
import { ResearchProjectTable } from "./research-schema"

type AtomsUpdatedPayload = { researchProjectId: string }

const events: {
  AtomsUpdated?: BusEventDefinition<AtomsUpdatedPayload>
} = {}

/**
 * Initialize bus event definitions. Safe to call more than once;
 * `host.bus.define` returns the same stable handle for the same event
 * type, so calling this in both server-hook.ts (real runtime) and
 * research-plugin-bind.ts (test fallback) is idempotent.
 */
export function initResearchEvents(): void {
  if (events.AtomsUpdated) return
  events.AtomsUpdated = bridge().bus.define(
    "research.atoms.updated",
    z.object({ researchProjectId: z.string() }),
  )
}

export namespace Research {
  export const Event = {
    get AtomsUpdated(): BusEventDefinition<AtomsUpdatedPayload> {
      if (!events.AtomsUpdated) initResearchEvents()
      return events.AtomsUpdated!
    },
  }

  export async function getParentSessionId(sessionID: string): Promise<string | undefined> {
    let current = await bridge().session.get(sessionID)

    while (current.parentID) {
      current = await bridge().session.get(current.parentID)
    }
    return current.id
  }

  export async function getResearchProjectId(sessionID: string): Promise<string | undefined> {
    let current = await bridge().session.get(sessionID)

    while (current.parentID) {
      current = await bridge().session.get(current.parentID)
    }

    const research = bridge().db.use((db: SQLiteBunDatabase) =>
      db
        .select({ research_project_id: ResearchProjectTable.research_project_id })
        .from(ResearchProjectTable)
        .where(eq(ResearchProjectTable.project_id, current.projectID))
        .get(),
    )

    return research?.research_project_id
  }

  export function getResearchProject(researchProjectId: string) {
    return bridge().db.use((db: SQLiteBunDatabase) =>
      db
        .select()
        .from(ResearchProjectTable)
        .where(eq(ResearchProjectTable.research_project_id, researchProjectId))
        .get(),
    )
  }

  export function updateBackgroundPath(researchProjectId: string, backgroundPath: string) {
    bridge().db.use((db: SQLiteBunDatabase) =>
      db
        .update(ResearchProjectTable)
        .set({ background_path: backgroundPath, time_updated: Date.now() })
        .where(eq(ResearchProjectTable.research_project_id, researchProjectId))
        .run(),
    )
  }

  export function updateGoalPath(researchProjectId: string, goalPath: string) {
    bridge().db.use((db: SQLiteBunDatabase) =>
      db
        .update(ResearchProjectTable)
        .set({ goal_path: goalPath, time_updated: Date.now() })
        .where(eq(ResearchProjectTable.research_project_id, researchProjectId))
        .run(),
    )
  }

  export function updateMacroTablePath(researchProjectId: string, macroTablePath: string) {
    bridge().db.use((db: SQLiteBunDatabase) =>
      db
        .update(ResearchProjectTable)
        .set({ macro_table_path: macroTablePath, time_updated: Date.now() })
        .where(eq(ResearchProjectTable.research_project_id, researchProjectId))
        .run(),
    )
  }
}
