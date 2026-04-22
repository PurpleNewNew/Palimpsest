import { randomUUID } from "crypto"
import { Slug } from "@palimpsest/shared/slug"
import z from "zod"
import { Identifier } from "@/id/id"
import { Project } from "@/project/project"
import { ProjectTable } from "@/project/project.sql"
import { Session } from "@/session"
import { SessionTable } from "@/session/session.sql"
import { Database, and, asc, desc, eq, inArray, isNull, or } from "@/storage/db"
import { Context as Scope } from "@/util/context"

import {
  AccountSessionTable,
  AccountUserTable,
  AccountWorkspaceTable,
  AuditEventTable,
  WorkspaceInviteTable,
  WorkspaceMembershipTable,
  WorkspaceShareTable,
} from "./control-plane.sql"

const ADMIN_ID = "usr_admin"
const ADMIN_NAME = "admin"
const ADMIN_PASS = "123456"
const DEFAULT_WORKSPACE_ID = "wrk_default"
const DEFAULT_WORKSPACE_SLUG = "palimpsest"
const DEFAULT_WORKSPACE_NAME = "Palimpsest"
const COOKIE = "palimpsest_session"
const WORKSPACE_COOKIE = "palimpsest_workspace"
const TTL = 1000 * 60 * 60 * 24 * 30

export namespace ControlPlane {
  export const Role = z.enum(["owner", "editor", "viewer"]).meta({ ref: "WorkspaceRole" })
  export type Role = z.infer<typeof Role>

  export const User = z
    .object({
      id: Identifier.schema("user"),
      username: z.string(),
      displayName: z.string().optional(),
      isAdmin: z.boolean(),
    })
    .meta({ ref: "AccountUser" })
  export type User = z.infer<typeof User>

  export const Workspace = z
    .object({
      id: Identifier.schema("workspace"),
      slug: z.string(),
      name: z.string(),
      role: Role,
      memberCount: z.number(),
      inviteCount: z.number(),
      shareCount: z.number(),
    })
    .meta({ ref: "AccountWorkspace" })
  export type Workspace = z.infer<typeof Workspace>

  export const Member = z
    .object({
      user: User,
      role: Role,
    })
    .meta({ ref: "WorkspaceMember" })
  export type Member = z.infer<typeof Member>

  export const Invite = z
    .object({
      id: z.string(),
      workspaceID: Identifier.schema("workspace"),
      code: z.string(),
      role: Role,
      invitedByUserID: Identifier.schema("user"),
      acceptedByUserID: Identifier.schema("user").optional(),
      acceptedAt: z.number().optional(),
      expiresAt: z.number().optional(),
      revokedAt: z.number().optional(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .meta({ ref: "WorkspaceInvite" })
  export type Invite = z.infer<typeof Invite>

  export const Share = z
    .object({
      id: z.string(),
      workspaceID: Identifier.schema("workspace"),
      projectID: z.string().optional(),
      sessionID: Identifier.schema("session").optional(),
      slug: z.string(),
      kind: z.enum(["project", "session"]),
      title: z.string().optional(),
      url: z.string(),
      revokedAt: z.number().optional(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .meta({ ref: "WorkspaceShare" })
  export type Share = z.infer<typeof Share>

  export const State = z
    .object({
      user: User,
      workspaces: Workspace.array(),
      workspaceID: Identifier.schema("workspace").optional(),
      role: Role.optional(),
    })
    .meta({ ref: "AuthState" })
  export type State = z.infer<typeof State>

  type SessionRow = typeof AccountSessionTable.$inferSelect
  type UserRow = typeof AccountUserTable.$inferSelect
  type WorkspaceRow = typeof AccountWorkspaceTable.$inferSelect
  type InviteRow = typeof WorkspaceInviteTable.$inferSelect
  type ShareRow = typeof WorkspaceShareTable.$inferSelect

  const rank: Record<Role, number> = {
    owner: 3,
    editor: 2,
    viewer: 1,
  }

  const ctx = Scope.create<{
    sessionID: string
    user: User
    workspaceID?: string
    role?: Role
  }>("control-plane")

  const init = {
    task: undefined as Promise<void> | undefined,
  }

  function now() {
    return Date.now()
  }

  function user(row: UserRow): User {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name ?? undefined,
      isAdmin: row.is_admin,
    }
  }

  async function url(slug: string) {
    const { Server } = await import("@/server/server")
    return new URL(`/share/${slug}`, Server.url()).toString()
  }

  function invite(row: InviteRow): Invite {
    return {
      id: row.id,
      workspaceID: row.workspace_id,
      code: row.code,
      role: Role.parse(row.role),
      invitedByUserID: row.invited_by_user_id,
      acceptedByUserID: row.accepted_by_user_id ?? undefined,
      acceptedAt: row.accepted_at ?? undefined,
      expiresAt: row.expires_at ?? undefined,
      revokedAt: row.revoked_at ?? undefined,
      time: {
        created: row.time_created,
        updated: row.time_updated,
      },
    }
  }

  async function share(row: ShareRow): Promise<Share> {
    return {
      id: row.id,
      workspaceID: row.workspace_id,
      projectID: row.project_id ?? undefined,
      sessionID: row.session_id ?? undefined,
      slug: row.slug,
      kind: row.kind === "project" ? "project" : "session",
      title: row.title ?? undefined,
      url: await url(row.slug),
      revokedAt: row.revoked_at ?? undefined,
      time: {
        created: row.time_created,
        updated: row.time_updated,
      },
    }
  }

  function activeInvite(row: InviteRow) {
    if (row.revoked_at) return false
    if (row.accepted_at) return false
    if (row.expires_at && row.expires_at < now()) return false
    return true
  }

  function allow(role: Role | undefined, need: Role) {
    if (!role) return false
    return rank[role] >= rank[need]
  }

  async function audit(input: {
    action: string
    actorUserID?: string
    workspaceID?: string
    projectID?: string
    targetType: string
    targetID: string
    data?: Record<string, unknown>
  }) {
    // Audit IDs must be unique across the lifetime of a database. `Slug.create()`
    // only produces ~840 combinations (28 adjectives x 30 nouns), which birthday-
    // paradoxes into collisions well before 100 events. Use a UUID: audit IDs
    // are internal append-only keys never surfaced to users.
    Database.use((db) =>
      db.insert(AuditEventTable).values({
        id: `aud_${randomUUID()}`,
        workspace_id: input.workspaceID ?? null,
        project_id: input.projectID ?? null,
        actor_user_id: input.actorUserID ?? null,
        action: input.action,
        target_type: input.targetType,
        target_id: input.targetID,
        data: input.data,
      }).run(),
    )
  }

  async function membership(userID: string, workspaceID: string) {
    const row = Database.use((db) =>
      db
        .select()
        .from(WorkspaceMembershipTable)
        .where(and(eq(WorkspaceMembershipTable.user_id, userID), eq(WorkspaceMembershipTable.workspace_id, workspaceID)))
        .get(),
    )
    if (!row) return
    return Role.parse(row.role)
  }

  async function pickWorkspace(userID: string, workspaceID?: string) {
    const spaces = await listWorkspaces(userID)
    if (spaces.length === 0) return

    if (workspaceID) {
      const match = spaces.find((item) => item.id === workspaceID)
      if (match) return match
    }

    return spaces[0]
  }

  async function session(id: string | undefined) {
    if (!id) return
    const row = Database.use((db) => db.select().from(AccountSessionTable).where(eq(AccountSessionTable.id, id)).get())
    if (!row) return
    if (row.expires_at > now()) return row
    Database.use((db) => db.delete(AccountSessionTable).where(eq(AccountSessionTable.id, id)).run())
  }

  export function cookie() {
    return COOKIE
  }

  export function workspaceCookie() {
    return WORKSPACE_COOKIE
  }

  export function ttl() {
    return TTL
  }

  export async function ensure() {
    if (init.task) return init.task
    init.task = (async () => {
      const existing = Database.use((db) =>
        db.select().from(AccountUserTable).where(eq(AccountUserTable.username, ADMIN_NAME)).get(),
      )

      const hash = existing?.password_hash ?? (await Bun.password.hash(ADMIN_PASS))
      Database.use((db) => {
        if (!existing) {
          db.insert(AccountUserTable)
            .values({
              id: ADMIN_ID,
              username: ADMIN_NAME,
              password_hash: hash,
              display_name: "Administrator",
              is_admin: true,
            })
            .run()
        }

        const space = db
          .select()
          .from(AccountWorkspaceTable)
          .where(eq(AccountWorkspaceTable.id, DEFAULT_WORKSPACE_ID))
          .get()
        if (!space) {
          db.insert(AccountWorkspaceTable)
            .values({
              id: DEFAULT_WORKSPACE_ID,
              slug: DEFAULT_WORKSPACE_SLUG,
              name: DEFAULT_WORKSPACE_NAME,
              owner_user_id: ADMIN_ID,
            })
            .run()
        }

        const member = db
          .select()
          .from(WorkspaceMembershipTable)
          .where(
            and(
              eq(WorkspaceMembershipTable.workspace_id, DEFAULT_WORKSPACE_ID),
              eq(WorkspaceMembershipTable.user_id, ADMIN_ID),
            ),
          )
          .get()
        if (!member) {
          db.insert(WorkspaceMembershipTable)
            .values({
              workspace_id: DEFAULT_WORKSPACE_ID,
              user_id: ADMIN_ID,
              role: "owner",
            })
          .run()
        }
      })
    })().finally(() => {
      init.task = undefined
    })
    return init.task
  }

  export async function listWorkspaces(userID: string) {
    await ensure()
    const rows = Database.use((db) =>
      db
        .select()
        .from(WorkspaceMembershipTable)
        .where(eq(WorkspaceMembershipTable.user_id, userID))
        .all(),
    )
    const ids = rows.map((row) => row.workspace_id)
    if (ids.length === 0) return [] as Workspace[]
    const spaces = Database.use((db) =>
      db.select().from(AccountWorkspaceTable).where(inArray(AccountWorkspaceTable.id, ids)).all(),
    )
    const invites = Database.use((db) =>
      db
        .select()
        .from(WorkspaceInviteTable)
        .where(and(inArray(WorkspaceInviteTable.workspace_id, ids), isNull(WorkspaceInviteTable.revoked_at)))
        .all(),
    )
    const shares = Database.use((db) =>
      db
        .select()
        .from(WorkspaceShareTable)
        .where(and(inArray(WorkspaceShareTable.workspace_id, ids), isNull(WorkspaceShareTable.revoked_at)))
        .all(),
    )
    const members = Database.use((db) =>
      db.select().from(WorkspaceMembershipTable).where(inArray(WorkspaceMembershipTable.workspace_id, ids)).all(),
    )

    return spaces
      .map((row) => {
        const role = rows.find((item) => item.workspace_id === row.id)?.role
        if (!role) return
        return Workspace.parse({
          id: row.id,
          slug: row.slug,
          name: row.name,
          role,
          memberCount: members.filter((item) => item.workspace_id === row.id).length,
          inviteCount: invites.filter((item) => item.workspace_id === row.id && activeInvite(item)).length,
          shareCount: shares.filter((item) => item.workspace_id === row.id).length,
        })
      })
      .filter(Boolean) as Workspace[]
  }

  export async function state(input: { sessionID?: string; workspaceID?: string }) {
    const auth = await session(input.sessionID)
    if (!auth) return
    const row = Database.use((db) => db.select().from(AccountUserTable).where(eq(AccountUserTable.id, auth.user_id)).get())
    if (!row) return
    const spaces = await listWorkspaces(row.id)
    const current = await pickWorkspace(row.id, input.workspaceID)
    return State.parse({
      user: user(row),
      workspaces: spaces,
      workspaceID: current?.id,
      role: current?.role,
    })
  }

  export async function login(input: { username: string; password: string; workspaceID?: string }) {
    await ensure()
    const row = Database.use((db) =>
      db.select().from(AccountUserTable).where(eq(AccountUserTable.username, input.username)).get(),
    )
    if (!row) return
    const ok = await Bun.password.verify(input.password, row.password_hash)
    if (!ok) return
    const id = randomUUID()
    Database.use((db) =>
      db
        .insert(AccountSessionTable)
        .values({
          id,
          user_id: row.id,
          expires_at: now() + TTL,
          time_updated: now(),
        })
        .run(),
    )
    Database.use((db) =>
      db.update(AccountUserTable).set({ last_login_at: now(), time_updated: now() }).where(eq(AccountUserTable.id, row.id)).run(),
    )
    await audit({
      action: "auth.login",
      actorUserID: row.id,
      workspaceID: input.workspaceID,
      targetType: "user",
      targetID: row.id,
    })
    const auth = await state({ sessionID: id, workspaceID: input.workspaceID })
    if (!auth) return
    return { id, auth }
  }

  export async function logout(sessionID?: string) {
    const row = await session(sessionID)
    if (!row) return
    Database.use((db) => db.delete(AccountSessionTable).where(eq(AccountSessionTable.id, row.id)).run())
    await audit({
      action: "auth.logout",
      actorUserID: row.user_id,
      targetType: "session",
      targetID: row.id,
    })
  }

  export async function provide<R>(input: {
    sessionID: string
    workspaceID?: string
    fn: () => Promise<R> | R
  }) {
    const auth = await state(input)
    if (!auth) return
    return ctx.provide(
      {
        sessionID: input.sessionID,
        user: auth.user,
        workspaceID: auth.workspaceID,
        role: auth.role,
      },
      input.fn,
    )
  }

  export function current() {
    try {
      return ctx.use()
    } catch {
      return
    }
  }

  export function actor() {
    const auth = current()
    if (!auth) return
    return {
      type: "user" as const,
      id: auth.user.id,
    }
  }

  export function role() {
    return current()?.role
  }

  export function userID() {
    return current()?.user.id
  }

  export async function assignProject(input: { projectID: string; workspaceID?: string }) {
    await ensure()
    const row = Database.use((db) => db.select().from(ProjectTable).where(eq(ProjectTable.id, input.projectID)).get())
    if (!row) return
    if (row.workspace_id) return row.workspace_id
    const workspaceID = input.workspaceID ?? DEFAULT_WORKSPACE_ID
    Database.use((db) =>
      db.update(ProjectTable).set({ workspace_id: workspaceID, time_updated: now() }).where(eq(ProjectTable.id, input.projectID)).run(),
    )
    await audit({
      action: "project.assign_workspace",
      actorUserID: userID(),
      workspaceID,
      projectID: input.projectID,
      targetType: "project",
      targetID: input.projectID,
      data: { workspaceID },
    })
    return workspaceID
  }

  export async function projectWorkspace(projectID: string) {
    const row = Database.use((db) => db.select().from(ProjectTable).where(eq(ProjectTable.id, projectID)).get())
    if (!row) return
    if (row.workspace_id) return row.workspace_id
    return assignProject({ projectID, workspaceID: current()?.workspaceID })
  }

  export async function projectRole(userID: string, projectID: string) {
    const workspaceID = await projectWorkspace(projectID)
    if (!workspaceID) return
    return membership(userID, workspaceID)
  }

  export async function workspaceRole(userID: string, workspaceID: string) {
    return membership(userID, workspaceID)
  }

  export async function allowProject(input: { userID: string; projectID: string; need?: Role }) {
    const role = await projectRole(input.userID, input.projectID)
    if (!role) return
    if (!input.need) return role
    if (!allow(role, input.need)) return
    return role
  }

  export async function allowWorkspace(input: { userID: string; workspaceID: string; need?: Role }) {
    const role = await workspaceRole(input.userID, input.workspaceID)
    if (!role) return
    if (!input.need) return role
    if (!allow(role, input.need)) return
    return role
  }

  export async function projects(userID: string) {
    await ensure()
    const spaces = await listWorkspaces(userID)
    const ids = spaces.map((item) => item.id)
    if (ids.length === 0) return [] as Project.Info[]
    const rows = Database.use((db) =>
      db.select().from(ProjectTable).where(inArray(ProjectTable.workspace_id, ids)).all(),
    )
    return rows.map((row) => Project.fromRow(row)).sort((a, b) => b.time.updated - a.time.updated)
  }

  export async function members(workspaceID: string) {
    const links = Database.use((db) =>
      db
        .select()
        .from(WorkspaceMembershipTable)
        .where(eq(WorkspaceMembershipTable.workspace_id, workspaceID))
        .orderBy(asc(WorkspaceMembershipTable.time_created))
        .all(),
    )
    const ids = links.map((row) => row.user_id)
    if (ids.length === 0) return [] as Member[]
    const rows = Database.use((db) => db.select().from(AccountUserTable).where(inArray(AccountUserTable.id, ids)).all())
    return links.flatMap((link) => {
      const row = rows.find((item) => item.id === link.user_id)
      if (!row) return []
      return [
        Member.parse({
          user: user(row),
          role: link.role,
        }),
      ]
    })
  }

  export async function invites(workspaceID: string) {
    const rows = Database.use((db) =>
      db
        .select()
        .from(WorkspaceInviteTable)
        .where(eq(WorkspaceInviteTable.workspace_id, workspaceID))
        .orderBy(desc(WorkspaceInviteTable.time_created))
        .all(),
    )
    return rows.filter(activeInvite).map(invite)
  }

  export async function getInvite(inviteID: string) {
    const row = Database.use((db) =>
      db.select().from(WorkspaceInviteTable).where(eq(WorkspaceInviteTable.id, inviteID)).get(),
    )
    if (!row) return
    return invite(row)
  }

  export async function createInvite(input: { workspaceID: string; actorUserID: string; role: Role; expiresAt?: number }) {
    const id = `inv_${Slug.create()}`
    const code = Slug.create()
    Database.use((db) =>
      db.insert(WorkspaceInviteTable).values({
        id,
        workspace_id: input.workspaceID,
        code,
        role: input.role,
        invited_by_user_id: input.actorUserID,
        expires_at: input.expiresAt ?? null,
      }).run(),
    )
    await audit({
      action: "workspace.invite.create",
      actorUserID: input.actorUserID,
      workspaceID: input.workspaceID,
      targetType: "invite",
      targetID: id,
      data: { role: input.role },
    })
    const row = Database.use((db) => db.select().from(WorkspaceInviteTable).where(eq(WorkspaceInviteTable.id, id)).get())
    if (!row) throw new Error("invite not found")
    return invite(row)
  }

  export async function revokeInvite(input: { inviteID: string; actorUserID?: string }) {
    const row = Database.use((db) =>
      db
        .update(WorkspaceInviteTable)
        .set({ revoked_at: now(), time_updated: now() })
        .where(eq(WorkspaceInviteTable.id, input.inviteID))
        .returning()
        .get(),
    )
    if (!row) return
    await audit({
      action: "workspace.invite.revoke",
      actorUserID: input.actorUserID,
      workspaceID: row.workspace_id,
      targetType: "invite",
      targetID: row.id,
    })
    return invite(row)
  }

  export async function acceptInvite(input: {
    code: string
    userID?: string
    username?: string
    password?: string
    displayName?: string
  }) {
    await ensure()
    const row = Database.use((db) =>
      db.select().from(WorkspaceInviteTable).where(eq(WorkspaceInviteTable.code, input.code)).get(),
    )
    if (!row || !activeInvite(row)) return

    let userRow: UserRow | undefined
    if (input.userID) {
      userRow = Database.use((db) => db.select().from(AccountUserTable).where(eq(AccountUserTable.id, input.userID!)).get())
    }

    if (!userRow) {
      const username = input.username
      const password = input.password
      if (!username || !password) return
      const existing = Database.use((db) =>
        db.select().from(AccountUserTable).where(eq(AccountUserTable.username, username)).get(),
      )
      if (existing) return
      const id = Identifier.ascending("user")
      const hash = await Bun.password.hash(password)
      Database.use((db) => {
        db.insert(AccountUserTable)
          .values({
            id,
            username,
            password_hash: hash,
            display_name: input.displayName ?? username,
            is_admin: false,
          })
          .run()
      })
      userRow = Database.use((db) => db.select().from(AccountUserTable).where(eq(AccountUserTable.id, id)).get())
    }

    if (!userRow) return

    const link = Database.use((db) =>
      db
        .select()
        .from(WorkspaceMembershipTable)
        .where(
          and(
            eq(WorkspaceMembershipTable.workspace_id, row.workspace_id),
            eq(WorkspaceMembershipTable.user_id, userRow.id),
          ),
        )
        .get(),
    )
    if (!link) {
      Database.use((db) =>
        db.insert(WorkspaceMembershipTable).values({
          workspace_id: row.workspace_id,
          user_id: userRow.id,
          role: row.role,
        }).run(),
      )
    }

    Database.use((db) =>
      db
        .update(WorkspaceInviteTable)
        .set({
          accepted_by_user_id: userRow.id,
          accepted_at: now(),
          time_updated: now(),
        })
        .where(eq(WorkspaceInviteTable.id, row.id))
        .run(),
    )

    await audit({
      action: "workspace.invite.accept",
      actorUserID: userRow.id,
      workspaceID: row.workspace_id,
      targetType: "invite",
      targetID: row.id,
    })

    return {
      user: user(userRow),
      workspaceID: row.workspace_id,
      role: Role.parse(row.role),
    }
  }

  export async function shares(workspaceID: string) {
    const rows = Database.use((db) =>
      db
        .select()
        .from(WorkspaceShareTable)
        .where(and(eq(WorkspaceShareTable.workspace_id, workspaceID), isNull(WorkspaceShareTable.revoked_at)))
        .orderBy(desc(WorkspaceShareTable.time_created))
        .all(),
    )
    const out = [] as Share[]
    for (const row of rows) out.push(await share(row))
    return out
  }

  export async function getShare(shareID: string) {
    const row = Database.use((db) =>
      db.select().from(WorkspaceShareTable).where(eq(WorkspaceShareTable.id, shareID)).get(),
    )
    if (!row) return
    return share(row)
  }

  export async function publishSession(input: { sessionID: string; actorUserID: string }) {
    const sessionRow = Database.use((db) => db.select().from(SessionTable).where(eq(SessionTable.id, input.sessionID)).get())
    if (!sessionRow) return
    const workspaceID = await projectWorkspace(sessionRow.project_id)
    if (!workspaceID) return
    const role = await membership(input.actorUserID, workspaceID)
    if (!allow(role, "editor")) return

    const existing = Database.use((db) =>
      db
        .select()
        .from(WorkspaceShareTable)
        .where(and(eq(WorkspaceShareTable.session_id, input.sessionID), isNull(WorkspaceShareTable.revoked_at)))
        .get(),
    )
    if (existing) return share(existing)

    const id = `shr_${Slug.create()}`
    const slug = Slug.create()
    Database.use((db) =>
      db.insert(WorkspaceShareTable).values({
        id,
        workspace_id: workspaceID,
        project_id: sessionRow.project_id,
        session_id: sessionRow.id,
        slug,
        kind: "session",
        title: sessionRow.title,
        created_by_user_id: input.actorUserID,
      }).run(),
    )
    await audit({
      action: "workspace.share.publish",
      actorUserID: input.actorUserID,
      workspaceID,
      projectID: sessionRow.project_id,
      targetType: "share",
      targetID: id,
      data: { sessionID: input.sessionID },
    })
    const row = Database.use((db) => db.select().from(WorkspaceShareTable).where(eq(WorkspaceShareTable.id, id)).get())
    if (!row) return
    return share(row)
  }

  export async function unpublishSession(input: { sessionID: string; actorUserID?: string }) {
    const existing = Database.use((db) =>
      db
        .select()
        .from(WorkspaceShareTable)
        .where(and(eq(WorkspaceShareTable.session_id, input.sessionID), isNull(WorkspaceShareTable.revoked_at)))
        .get(),
    )
    if (!existing) return
    if (input.actorUserID) {
      const role = await membership(input.actorUserID, existing.workspace_id)
      if (!allow(role, "editor")) return
    }
    const row = Database.use((db) =>
      db
        .update(WorkspaceShareTable)
        .set({ revoked_at: now(), time_updated: now() })
        .where(eq(WorkspaceShareTable.id, existing.id))
        .returning()
        .get(),
    )
    if (!row) return
    await audit({
      action: "workspace.share.unpublish",
      actorUserID: input.actorUserID,
      workspaceID: row.workspace_id,
      projectID: row.project_id ?? undefined,
      targetType: "share",
      targetID: row.id,
      data: { sessionID: input.sessionID },
    })
    return share(row)
  }

  export async function revokeShare(input: { shareID: string; actorUserID?: string }) {
    const row = Database.use((db) =>
      db
        .update(WorkspaceShareTable)
        .set({ revoked_at: now(), time_updated: now() })
        .where(and(eq(WorkspaceShareTable.id, input.shareID), isNull(WorkspaceShareTable.revoked_at)))
        .returning()
        .get(),
    )
    if (!row) return
    await audit({
      action: "workspace.share.revoke",
      actorUserID: input.actorUserID,
      workspaceID: row.workspace_id,
      projectID: row.project_id ?? undefined,
      targetType: "share",
      targetID: row.id,
    })
    return share(row)
  }

  export async function shareMeta(slug: string) {
    const row = Database.use((db) =>
      db
        .select()
        .from(WorkspaceShareTable)
        .where(and(eq(WorkspaceShareTable.slug, slug), isNull(WorkspaceShareTable.revoked_at)))
        .get(),
    )
    if (!row) return
    return share(row)
  }

  export async function shareData(slug: string) {
    const row = Database.use((db) =>
      db
        .select()
        .from(WorkspaceShareTable)
        .where(and(eq(WorkspaceShareTable.slug, slug), isNull(WorkspaceShareTable.revoked_at)))
        .get(),
    )
    if (!row?.session_id) return
    const info = await Session.get(row.session_id)
    const msgs = await Session.messages({ sessionID: row.session_id })
    const diff = await Session.diff(row.session_id)
    return [
      {
        type: "session" as const,
        data: info,
      },
      ...msgs.map((item) => ({
        type: "message" as const,
        data: item.info,
      })),
      ...msgs.flatMap((item) =>
        item.parts.map((part) => ({
          type: "part" as const,
          data: part,
        })),
      ),
      {
        type: "session_diff" as const,
        data: diff,
      },
    ]
  }
}
