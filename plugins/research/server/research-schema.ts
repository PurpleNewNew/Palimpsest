import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/**
 * Research plugin schema.
 *
 * Migrated from apps/server/src/research/research.sql.ts in Stage B2a.
 * The table shapes are unchanged so the migration history in
 * apps/server/migration/ stays valid.
 *
 * Cross-boundary foreign keys to host-owned tables (Project, Session)
 * are stored as plain string columns. Cascading deletes across those
 * boundaries happen in business logic (the plugin subscribes to the
 * domain bus and cleans up its own rows) rather than through drizzle
 * .references(). See specs Section 20 for the trade-off and a pointer
 * to the Stage B.5 idea of a @palimpsest/schema package.
 */

const Timestamps = {
  time_created: integer()
    .notNull()
    .$default(() => Date.now()),
  time_updated: integer()
    .notNull()
    .$onUpdate(() => Date.now()),
}

const atomKinds = ["question", "hypothesis", "claim", "finding", "source"] as const
const statusStates = ["pending", "in_progress", "supported", "refuted"] as const
export const linkKinds = [
  "motivates",
  "formalizes",
  "derives",
  "analyzes",
  "validates",
  "contradicts",
  "other",
] as const

export const ResearchProjectTable = sqliteTable(
  "research_project",
  {
    research_project_id: text().primaryKey(),
    project_id: text().notNull(),
    background_path: text(),
    goal_path: text(),
    macro_table_path: text(),
    ...Timestamps,
  },
  (table) => [uniqueIndex("research_project_project_idx").on(table.project_id)],
)

export const AtomTable = sqliteTable(
  "atom",
  {
    atom_id: text().primaryKey(),
    research_project_id: text()
      .notNull()
      .references(() => ResearchProjectTable.research_project_id, { onDelete: "cascade" }),
    atom_name: text().notNull(),
    atom_type: text().$type<(typeof atomKinds)[number]>().notNull(),
    atom_claim_path: text(),
    atom_evidence_status: text().$type<(typeof statusStates)[number]>().notNull().default("pending"),
    atom_evidence_path: text(),
    atom_evidence_assessment_path: text(),
    source_id: text().references(() => SourceTable.source_id, { onDelete: "set null" }),
    session_id: text(),
    ...Timestamps,
  },
  (table) => [
    index("atom_research_project_idx").on(table.research_project_id),
    index("atom_session_idx").on(table.session_id),
  ],
)

export const AtomRelationTable = sqliteTable(
  "atom_relation",
  {
    atom_id_source: text()
      .notNull()
      .references(() => AtomTable.atom_id, { onDelete: "cascade" }),
    atom_id_target: text()
      .notNull()
      .references(() => AtomTable.atom_id, { onDelete: "cascade" }),
    relation_type: text().$type<(typeof linkKinds)[number]>().notNull(),
    note: text(),
    ...Timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.atom_id_source, table.atom_id_target, table.relation_type] }),
    index("atom_relation_target_idx").on(table.atom_id_target),
  ],
)

export const SourceTable = sqliteTable(
  "source",
  {
    source_id: text().primaryKey(),
    research_project_id: text()
      .notNull()
      .references(() => ResearchProjectTable.research_project_id, { onDelete: "cascade" }),
    path: text().notNull(),
    title: text(),
    source_url: text(),
    status: text().$type<"pending" | "parsed" | "failed">().notNull().default("pending"),
    ...Timestamps,
  },
  (table) => [index("source_research_project_idx").on(table.research_project_id)],
)

