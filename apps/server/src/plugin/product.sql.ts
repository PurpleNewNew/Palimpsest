import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

import { ProjectTable } from "@/project/project.sql"
import { Timestamps } from "@/storage/schema.sql"

export const ProjectLensTable = sqliteTable(
  "project_lens",
  {
    id: text().primaryKey(),
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    plugin_id: text().notNull(),
    lens_id: text().notNull(),
    plugin_version: text(),
    config_version: integer().notNull().default(1),
    config: text({ mode: "json" }).$type<Record<string, unknown>>(),
    ...Timestamps,
  },
  (table) => [
    index("project_lens_project_idx").on(table.project_id),
    index("project_lens_plugin_idx").on(table.plugin_id),
    index("project_lens_lens_idx").on(table.lens_id),
  ],
)
