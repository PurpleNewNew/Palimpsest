import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { Timestamps } from "@/storage/schema.sql"

export const ProjectTable = sqliteTable(
  "project",
  {
    id: text().primaryKey(),
    workspace_id: text(),
    worktree: text().notNull(),
    vcs: text(),
    name: text(),
    icon_url: text(),
    icon_color: text(),
    ...Timestamps,
    time_initialized: integer(),
    sandboxes: text({ mode: "json" }).notNull().$type<string[]>(),
    commands: text({ mode: "json" }).$type<{ start?: string }>(),
  },
  (table) => [index("project_workspace_idx").on(table.workspace_id)],
)
