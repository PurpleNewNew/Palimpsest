import { Timestamps } from "./schema.sql"
import { index, sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

type Json = Record<string, unknown>
type Change = Json[]

export type TaxonomyData = {
  nodeKinds: string[]
  edgeKinds: string[]
  runKinds: string[]
  artifactKinds: string[]
  decisionKinds: string[]
  decisionStates: string[]
}

export const ProjectTaxonomyTable = sqliteTable("project_taxonomy", {
  project_id: text().primaryKey(),
  ...Timestamps,
  data: text({ mode: "json" }).notNull().$type<TaxonomyData>(),
})

export const NodeTable = sqliteTable(
  "node",
  {
    id: text().primaryKey(),
    project_id: text().notNull(),
    kind: text().notNull(),
    title: text().notNull(),
    body: text(),
    data: text({ mode: "json" }).$type<Json>(),
    ...Timestamps,
  },
  (table) => [index("node_project_idx").on(table.project_id), index("node_kind_idx").on(table.kind)],
)

export const EdgeTable = sqliteTable(
  "edge",
  {
    id: text().primaryKey(),
    project_id: text().notNull(),
    kind: text().notNull(),
    source_id: text()
      .notNull()
      .references(() => NodeTable.id, { onDelete: "cascade" }),
    target_id: text()
      .notNull()
      .references(() => NodeTable.id, { onDelete: "cascade" }),
    note: text(),
    data: text({ mode: "json" }).$type<Json>(),
    ...Timestamps,
  },
  (table) => [
    index("edge_project_idx").on(table.project_id),
    index("edge_source_idx").on(table.source_id),
    index("edge_target_idx").on(table.target_id),
    index("edge_kind_idx").on(table.kind),
  ],
)

export const RunTable = sqliteTable(
  "run",
  {
    id: text().primaryKey(),
    project_id: text().notNull(),
    node_id: text().references(() => NodeTable.id, { onDelete: "set null" }),
    session_id: text(),
    kind: text().notNull(),
    status: text().notNull(),
    title: text(),
    triggered_by_actor_type: text(),
    triggered_by_actor_id: text(),
    triggered_by_actor_version: text(),
    manifest: text({ mode: "json" }).$type<Json>(),
    ...Timestamps,
    started_at: integer(),
    finished_at: integer(),
  },
  (table) => [
    index("run_project_idx").on(table.project_id),
    index("run_node_idx").on(table.node_id),
    index("run_session_idx").on(table.session_id),
    index("run_kind_idx").on(table.kind),
    index("run_status_idx").on(table.status),
  ],
)

export const ArtifactTable = sqliteTable(
  "artifact",
  {
    id: text().primaryKey(),
    project_id: text().notNull(),
    run_id: text().references(() => RunTable.id, { onDelete: "set null" }),
    node_id: text().references(() => NodeTable.id, { onDelete: "set null" }),
    kind: text().notNull(),
    title: text(),
    storage_uri: text(),
    mime_type: text(),
    data: text({ mode: "json" }).$type<Json>(),
    provenance: text({ mode: "json" }).$type<Json>(),
    ...Timestamps,
  },
  (table) => [
    index("artifact_project_idx").on(table.project_id),
    index("artifact_run_idx").on(table.run_id),
    index("artifact_node_idx").on(table.node_id),
    index("artifact_kind_idx").on(table.kind),
  ],
)

export const DecisionTable = sqliteTable(
  "decision",
  {
    id: text().primaryKey(),
    project_id: text().notNull(),
    node_id: text().references(() => NodeTable.id, { onDelete: "set null" }),
    run_id: text().references(() => RunTable.id, { onDelete: "set null" }),
    artifact_id: text().references(() => ArtifactTable.id, { onDelete: "set null" }),
    kind: text().notNull(),
    state: text(),
    rationale: text(),
    decided_by_actor_type: text(),
    decided_by_actor_id: text(),
    decided_by_actor_version: text(),
    superseded_by: text(),
    data: text({ mode: "json" }).$type<Json>(),
    refs: text({ mode: "json" }).$type<Json>(),
    ...Timestamps,
  },
  (table) => [
    index("decision_project_idx").on(table.project_id),
    index("decision_node_idx").on(table.node_id),
    index("decision_run_idx").on(table.run_id),
    index("decision_artifact_idx").on(table.artifact_id),
    index("decision_kind_idx").on(table.kind),
    index("decision_state_idx").on(table.state),
  ],
)

export const ProposalTable = sqliteTable(
  "proposal",
  {
    id: text().primaryKey(),
    project_id: text().notNull(),
    title: text(),
    status: text().notNull(),
    proposed_by_actor_type: text().notNull(),
    proposed_by_actor_id: text().notNull(),
    proposed_by_actor_version: text(),
    changes: text({ mode: "json" }).notNull().$type<Change>(),
    rationale: text(),
    refs: text({ mode: "json" }).$type<Json>(),
    ...Timestamps,
  },
  (table) => [
    index("proposal_project_idx").on(table.project_id),
    index("proposal_status_idx").on(table.status),
  ],
)

export const ReviewTable = sqliteTable(
  "review",
  {
    id: text().primaryKey(),
    project_id: text().notNull(),
    proposal_id: text()
      .notNull()
      .references(() => ProposalTable.id, { onDelete: "cascade" }),
    reviewer_actor_type: text().notNull(),
    reviewer_actor_id: text().notNull(),
    reviewer_actor_version: text(),
    verdict: text().notNull(),
    comments: text(),
    refs: text({ mode: "json" }).$type<Json>(),
    ...Timestamps,
  },
  (table) => [
    index("review_project_idx").on(table.project_id),
    index("review_proposal_idx").on(table.proposal_id),
    index("review_verdict_idx").on(table.verdict),
  ],
)

export const CommitTable = sqliteTable(
  "domain_commit",
  {
    id: text().primaryKey(),
    project_id: text().notNull(),
    proposal_id: text().references(() => ProposalTable.id, { onDelete: "set null" }),
    review_id: text().references(() => ReviewTable.id, { onDelete: "set null" }),
    committed_by_actor_type: text().notNull(),
    committed_by_actor_id: text().notNull(),
    committed_by_actor_version: text(),
    applied_changes: text({ mode: "json" }).notNull().$type<Change>(),
    refs: text({ mode: "json" }).$type<Json>(),
    ...Timestamps,
  },
  (table) => [
    index("domain_commit_project_idx").on(table.project_id),
    index("domain_commit_proposal_idx").on(table.proposal_id),
    index("domain_commit_review_idx").on(table.review_id),
  ],
)
