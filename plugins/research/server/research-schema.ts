import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/**
 * Research plugin schema.
 *
 * As of the domain-first migration the research plugin no longer
 * maintains its own atom / relation / source tables. All graph data —
 * atoms (questions/hypotheses/claims/findings/sources) and their
 * relations — lives in the canonical Domain Node/Edge tables, accessed
 * through `host.domain.*` so every write goes through the proposal
 * pipeline (see `specs/domain.md` Decision 1).
 *
 * The only surviving research-owned table is `research_project`, which
 * holds per-project plugin configuration (background / goal / macro
 * document file paths) that does not belong on the Node graph.
 */

const Timestamps = {
  time_created: integer()
    .notNull()
    .$default(() => Date.now()),
  time_updated: integer()
    .notNull()
    .$onUpdate(() => Date.now()),
}

/**
 * Atom kinds correspond directly to `Node.kind` in the canonical
 * domain. The taxonomy is registered for every research-lens project
 * during `serverHook` so that `Domain.createNode({ kind })` accepts
 * them.
 */
export const atomKinds = ["question", "hypothesis", "claim", "finding", "source"] as const
export type AtomKind = (typeof atomKinds)[number]

/**
 * Evidence statuses live in `Node.data.evidence_status`. Atom-shaped
 * nodes always carry one of these values; non-atom nodes simply leave
 * the field undefined.
 */
export const evidenceStatuses = ["pending", "in_progress", "supported", "refuted"] as const
export type EvidenceStatus = (typeof evidenceStatuses)[number]

/**
 * Atom relation kinds correspond directly to `Edge.kind`. The
 * `evidence_from` kind is added so an atom can point at its source
 * node without needing a foreign-key column on the atom row itself
 * (the old `atom.source_id` column went away with the schema collapse).
 */
export const linkKinds = [
  "motivates",
  "formalizes",
  "derives",
  "analyzes",
  "validates",
  "contradicts",
  "evidence_from",
  "other",
] as const
export type LinkKind = (typeof linkKinds)[number]

/**
 * Source parse statuses live in `Node.data.parse_status` for nodes of
 * kind `"source"`. They are independent from atom evidence status.
 */
export const sourceStatuses = ["pending", "parsed", "failed"] as const
export type SourceStatus = (typeof sourceStatuses)[number]

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
