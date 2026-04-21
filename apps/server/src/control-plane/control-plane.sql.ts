import { ProjectTable } from "@/project/project.sql"
import { SessionTable } from "@/session/session.sql"
import { Timestamps } from "@/storage/schema.sql"
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const AccountUserTable = sqliteTable(
  "account_user",
  {
    id: text().primaryKey(),
    username: text().notNull(),
    password_hash: text().notNull(),
    display_name: text(),
    is_admin: integer({ mode: "boolean" }).notNull().default(false),
    last_login_at: integer(),
    ...Timestamps,
  },
  (table) => [uniqueIndex("account_user_username_idx").on(table.username)],
)

export const AccountSessionTable = sqliteTable(
  "account_session",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => AccountUserTable.id, { onDelete: "cascade" }),
    expires_at: integer().notNull(),
    ...Timestamps,
  },
  () => [],
)

export const AccountWorkspaceTable = sqliteTable(
  "account_workspace",
  {
    id: text().primaryKey(),
    slug: text().notNull(),
    name: text().notNull(),
    owner_user_id: text()
      .notNull()
      .references(() => AccountUserTable.id, { onDelete: "cascade" }),
    ...Timestamps,
  },
  (table) => [uniqueIndex("account_workspace_slug_idx").on(table.slug)],
)

export const WorkspaceMembershipTable = sqliteTable(
  "workspace_membership",
  {
    workspace_id: text()
      .notNull()
      .references(() => AccountWorkspaceTable.id, { onDelete: "cascade" }),
    user_id: text()
      .notNull()
      .references(() => AccountUserTable.id, { onDelete: "cascade" }),
    role: text().notNull(),
    ...Timestamps,
  },
  (table) => [primaryKey({ columns: [table.workspace_id, table.user_id] })],
)

export const WorkspaceInviteTable = sqliteTable(
  "workspace_invite",
  {
    id: text().primaryKey(),
    workspace_id: text()
      .notNull()
      .references(() => AccountWorkspaceTable.id, { onDelete: "cascade" }),
    code: text().notNull(),
    role: text().notNull(),
    invited_by_user_id: text()
      .notNull()
      .references(() => AccountUserTable.id, { onDelete: "cascade" }),
    accepted_by_user_id: text().references(() => AccountUserTable.id, { onDelete: "set null" }),
    accepted_at: integer(),
    expires_at: integer(),
    revoked_at: integer(),
    ...Timestamps,
  },
  (table) => [uniqueIndex("workspace_invite_code_idx").on(table.code)],
)

export const WorkspaceShareTable = sqliteTable(
  "workspace_share",
  {
    id: text().primaryKey(),
    workspace_id: text()
      .notNull()
      .references(() => AccountWorkspaceTable.id, { onDelete: "cascade" }),
    project_id: text().references(() => ProjectTable.id, { onDelete: "cascade" }),
    session_id: text().references(() => SessionTable.id, { onDelete: "cascade" }),
    slug: text().notNull(),
    kind: text().notNull(),
    title: text(),
    created_by_user_id: text()
      .notNull()
      .references(() => AccountUserTable.id, { onDelete: "cascade" }),
    revoked_at: integer(),
    ...Timestamps,
  },
  (table) => [uniqueIndex("workspace_share_slug_idx").on(table.slug)],
)

export const AuditEventTable = sqliteTable("audit_event", {
  id: text().primaryKey(),
  workspace_id: text().references(() => AccountWorkspaceTable.id, { onDelete: "set null" }),
  project_id: text().references(() => ProjectTable.id, { onDelete: "set null" }),
  actor_user_id: text().references(() => AccountUserTable.id, { onDelete: "set null" }),
  action: text().notNull(),
  target_type: text().notNull(),
  target_id: text().notNull(),
  data: text({ mode: "json" }).$type<Record<string, unknown>>(),
  ...Timestamps,
})
