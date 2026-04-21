/**
 * Host-side re-export shim for the research plugin's schema.
 *
 * The actual table definitions moved to
 * plugins/research/server/research-schema.ts in Stage B2a. This shim
 * keeps every current `@/research/research.sql` import inside the host
 * compiling unchanged while we migrate the rest of the research
 * business logic (experiment-*.ts, routes/research.ts, tool/*) in
 * Stage B2b-e. Once those land the shim (and the apps/server/src/research
 * directory) gets deleted.
 *
 * drizzle-kit picks the real `sqliteTable(...)` definitions up via the
 * updated schema glob in drizzle.config.ts — since the table shapes
 * and indexes are identical, no new migration is produced.
 */
export {
  AtomRelationTable,
  AtomTable,
  ArticleTable,
  CodeTable,
  ExperimentExecutionWatchTable,
  ExperimentTable,
  ExperimentWatchTable,
  RemoteServerTable,
  RemoteTaskTable,
  ResearchProjectTable,
  linkKinds,
} from "@palimpsest/plugin-research/server/research-schema"
