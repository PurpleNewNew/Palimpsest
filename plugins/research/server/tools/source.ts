import z from "zod"
import { eq } from "drizzle-orm"

import { tool, Database, Filesystem } from "./helpers"
import { SourceTable } from "../research-schema"
import { Research } from "../research"

type SourceRow = typeof SourceTable.$inferSelect
const statuses = ["pending", "parsed", "failed"] as const

function formatSource(row: SourceRow): string {
  const kind = Filesystem.stat(row.path)?.isDirectory() ? "latex_directory" : "pdf"
  return [
    `source_id: ${row.source_id}`,
    row.title ? `title: ${row.title}` : null,
    `status: ${row.status}`,
    `kind: ${kind}`,
    `path: ${row.path}`,
    row.source_url ? `source_url: ${row.source_url}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

export const SourceQueryTool = tool("source_query", {
  description:
    "Query research sources (PDFs, LaTeX source folders, or other knowledge sources) in the current research project. " +
    "IMPORTANT: Always use this tool — not glob, ls, read, or other generic tools — when listing or querying sources in a research project. " +
    "It is the ONLY tool that can query the research project source database. " +
    "When called without a sourceId, lists all sources with their metadata (id, title, path, status, etc.). " +
    "When called with a sourceId, returns the source metadata including its file path. " +
    "To read the actual source content, use the returned path with the read tool.",
  parameters: z.object({
    sourceId: z
      .string()
      .optional()
      .describe("The source ID to query. If omitted, lists all sources in the project."),
    sourceIds: z
      .array(z.string())
      .optional()
      .describe("Optional list of source IDs to filter by. Use this when you need a specific subset."),
    status: z
      .enum(statuses)
      .optional()
      .describe("Optional source status filter: pending, parsed, or failed."),
  }),
  async execute(params, ctx) {
    const researchProjectId = await Research.getResearchProjectId(ctx.sessionID)
    if (!researchProjectId) {
      return {
        title: "Failed",
        output: "Current session is not associated with any research project.",
        metadata: { count: 0 },
      }
    }

    // List mode
    if (!params.sourceId) {
      let sources = Database.use((db) =>
        db.select().from(SourceTable).where(eq(SourceTable.research_project_id, researchProjectId)).all(),
      )
      if (params.sourceIds?.length) {
        const set = new Set(params.sourceIds)
        sources = sources.filter((source: any) => set.has(source.source_id))
      }
      if (params.status) {
        sources = sources.filter((source: any) => source.status === params.status)
      }
      if (sources.length === 0) {
        return {
          title: "No sources",
          output: "No sources found in this research project.",
          metadata: { count: 0 },
        }
      }
      const output = sources.map((s: any, i: number) => `--- Source ${i + 1} ---\n${formatSource(s)}`).join("\n\n")
      return {
        title: `${sources.length} source(s)`,
        output,
        metadata: { count: sources.length },
      }
    }

    // Query mode
    const source = Database.use((db) =>
      db.select().from(SourceTable).where(eq(SourceTable.source_id, params.sourceId!)).get(),
    )
    if (!source) {
      return {
        title: "Not found",
        output: `Source not found: ${params.sourceId}`,
        metadata: { count: 0 },
      }
    }

    return {
      title: source.title ?? source.source_id,
      output: formatSource(source),
      metadata: { count: 1 },
    }
  },
})

export const SourceStatusUpdateTool = tool("source_status_update", {
  description:
    "Update the parse status of one or more sources in the current research project. " +
    "Use this after source-local parsing succeeds or fails.",
  parameters: z.object({
    sourceIds: z.array(z.string()).min(1).describe("The source IDs to update."),
    status: z.enum(statuses).describe("The new source status."),
  }),
  async execute(params, ctx) {
    const researchProjectId = await Research.getResearchProjectId(ctx.sessionID)
    if (!researchProjectId) {
      return {
        title: "Failed",
        output: "Current session is not associated with any research project.",
        metadata: { updated: false, count: 0 },
      }
    }

    const items = Database.use((db) =>
      db.select().from(SourceTable).where(eq(SourceTable.research_project_id, researchProjectId)).all(),
    ).filter((source: any) => params.sourceIds.includes(source.source_id))

    if (!items.length) {
      return {
        title: "Failed",
        output: "No matching sources found in the current research project.",
        metadata: { updated: false, count: 0 },
      }
    }

    const now = Date.now()
    Database.use((db) => {
      for (const source of items) {
        db
          .update(SourceTable)
          .set({ status: params.status, time_updated: now })
          .where(eq(SourceTable.source_id, source.source_id))
          .run()
      }
    })

    return {
      title: `Updated ${items.length} source(s)`,
      output: items.map((source: any) => `[${source.source_id}] ${source.title ?? "(untitled)"} -> ${params.status}`).join("\n"),
      metadata: { updated: true, count: items.length },
    }
  },
})
