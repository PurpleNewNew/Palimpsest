import type { BusEventDefinition } from "@palimpsest/plugin-sdk/host"
import { eq } from "drizzle-orm"
import type { SQLiteBunDatabase } from "drizzle-orm/bun-sqlite"
import z from "zod"

import { bridge } from "./host-bridge"
import { ResearchProjectTable, atomKinds, linkKinds } from "./research-schema"

type GraphUpdatedPayload = { researchProjectId: string }

const events: {
  GraphUpdated?: BusEventDefinition<GraphUpdatedPayload>
} = {}

/**
 * Initialize bus event definitions. Safe to call more than once;
 * `host.bus.define` returns the same stable handle for the same event
 * type, so calling this in both server-hook.ts (real runtime) and
 * research-plugin-bind.ts (test fallback) is idempotent.
 *
 * The single event we publish, `research.graph.updated`, is the
 * plugin-side equivalent of subscribing to every domain proposal
 * commit that touches an atom or atom relation. UI consumers (atom
 * graph viewers, session tree) listen for it to refresh.
 */
export function initResearchEvents(): void {
  if (events.GraphUpdated) return
  events.GraphUpdated = bridge().bus.define(
    "research.graph.updated",
    z.object({ researchProjectId: z.string() }),
  )
}

export namespace Research {
  export const Event = {
    get GraphUpdated(): BusEventDefinition<GraphUpdatedPayload> {
      if (!events.GraphUpdated) initResearchEvents()
      return events.GraphUpdated!
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

  export async function getProjectId(researchProjectId: string): Promise<string | undefined> {
    return getResearchProject(researchProjectId)?.project_id
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

  /**
   * Re-export taxonomy enums so other modules don't have to import
   * directly from `research-schema`. The values are tiny but they
   * appear in many tool / route schemas, and keeping a single source
   * of truth here avoids accidental drift.
   */
  export const AtomKinds = atomKinds
  export const LinkKinds = linkKinds
}
