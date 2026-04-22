import { describeRoute, resolver, validator } from "hono-openapi"
import { setCookie } from "hono/cookie"
import { Hono } from "hono"
import z from "zod"
import { ControlPlane } from "@/control-plane/control-plane"
import { errors } from "../error"
import { lazy } from "@/util/lazy"

function current() {
  return ControlPlane.current()
}

function unauthorized() {
  return new Response(JSON.stringify({ message: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  })
}

function forbidden() {
  return new Response(JSON.stringify({ message: "Forbidden" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  })
}

export const WorkspacesRoutes = lazy(() =>
  new Hono()
    .use(async (_, next) => {
      if (!current()) return unauthorized()
      return next()
    })
    .get(
      "/",
      describeRoute({
        summary: "List current user workspaces",
        operationId: "workspaces.list",
        responses: {
          200: {
            description: "Workspaces",
            content: {
              "application/json": {
                schema: resolver(ControlPlane.Workspace.array()),
              },
            },
          },
          ...errors(401),
        },
      }),
      async (c) => {
        const auth = current()
        if (!auth) return unauthorized()
        return c.json(await ControlPlane.listWorkspaces(auth.user.id))
      },
    )
    .get(
      "/current",
      describeRoute({
        summary: "Get current workspace",
        operationId: "workspaces.current",
        responses: {
          200: {
            description: "Current workspace",
            content: {
              "application/json": {
                schema: resolver(ControlPlane.Workspace),
              },
            },
          },
          ...errors(401, 404),
        },
      }),
      async (c) => {
        const auth = current()
        if (!auth?.workspaceID) return c.json({ message: "Workspace not found" }, 404)
        const rows = await ControlPlane.listWorkspaces(auth.user.id)
        const row = rows.find((item) => item.id === auth.workspaceID)
        if (!row) return c.json({ message: "Workspace not found" }, 404)
        return c.json(row)
      },
    )
    .post(
      "/current",
      describeRoute({
        summary: "Select current workspace",
        operationId: "workspaces.current.set",
        responses: {
          200: {
            description: "Selected workspace",
            content: {
              "application/json": {
                schema: resolver(ControlPlane.Workspace),
              },
            },
          },
          ...errors(401, 403, 404),
        },
      }),
      validator(
        "json",
        z.object({
          workspaceID: z.string(),
        }),
      ),
      async (c) => {
        const auth = current()
        if (!auth) return unauthorized()
        const body = c.req.valid("json")
        const role = await ControlPlane.allowWorkspace({
          userID: auth.user.id,
          workspaceID: body.workspaceID,
        })
        if (!role) return forbidden()
        const rows = await ControlPlane.listWorkspaces(auth.user.id)
        const row = rows.find((item) => item.id === body.workspaceID)
        if (!row) return c.json({ message: "Workspace not found" }, 404)
        const secure = new URL(c.req.url).protocol === "https:"
        setCookie(c, ControlPlane.workspaceCookie(), body.workspaceID, {
          path: "/",
          sameSite: "Lax",
          secure,
          maxAge: ControlPlane.ttl() / 1000,
        })
        return c.json(row)
      },
    )
    .get(
      "/:workspaceID/members",
      describeRoute({
        summary: "List workspace members",
        operationId: "workspaces.members",
        responses: {
          200: {
            description: "Members",
            content: {
              "application/json": {
                schema: resolver(ControlPlane.Member.array()),
              },
            },
          },
          ...errors(401, 403),
        },
      }),
      validator("param", z.object({ workspaceID: z.string() })),
      async (c) => {
        const auth = current()
        const workspaceID = c.req.valid("param").workspaceID
        if (!auth) return unauthorized()
        const role = await ControlPlane.allowWorkspace({
          userID: auth.user.id,
          workspaceID,
        })
        if (!role) return forbidden()
        return c.json(await ControlPlane.members(workspaceID))
      },
    )
    .get(
      "/:workspaceID/invites",
      describeRoute({
        summary: "List workspace invites",
        operationId: "workspaces.invites",
        responses: {
          200: {
            description: "Invites",
            content: {
              "application/json": {
                schema: resolver(ControlPlane.Invite.array()),
              },
            },
          },
          ...errors(401, 403),
        },
      }),
      validator("param", z.object({ workspaceID: z.string() })),
      async (c) => {
        const auth = current()
        const workspaceID = c.req.valid("param").workspaceID
        if (!auth) return unauthorized()
        const role = await ControlPlane.allowWorkspace({
          userID: auth.user.id,
          workspaceID,
          need: "owner",
        })
        if (!role) return forbidden()
        return c.json(await ControlPlane.invites(workspaceID))
      },
    )
    .post(
      "/:workspaceID/invites",
      describeRoute({
        summary: "Create workspace invite",
        operationId: "workspaces.invites.create",
        responses: {
          200: {
            description: "Invite",
            content: {
              "application/json": {
                schema: resolver(ControlPlane.Invite),
              },
            },
          },
          ...errors(401, 403),
        },
      }),
      validator("param", z.object({ workspaceID: z.string() })),
      validator(
        "json",
        z.object({
          role: ControlPlane.Role.default("viewer"),
          expiresAt: z.number().optional(),
        }),
      ),
      async (c) => {
        const auth = current()
        const workspaceID = c.req.valid("param").workspaceID
        const body = c.req.valid("json")
        if (!auth) return unauthorized()
        const role = await ControlPlane.allowWorkspace({
          userID: auth.user.id,
          workspaceID,
          need: "owner",
        })
        if (!role) return forbidden()
        return c.json(
          await ControlPlane.createInvite({
            workspaceID,
            actorUserID: auth.user.id,
            role: body.role,
            expiresAt: body.expiresAt,
          }),
        )
      },
    )
    .delete(
      "/invites/:inviteID",
      describeRoute({
        summary: "Revoke workspace invite",
        operationId: "workspaces.invites.revoke",
        responses: {
          200: {
            description: "Invite",
            content: {
              "application/json": {
                schema: resolver(ControlPlane.Invite),
              },
            },
          },
          ...errors(401, 403, 404),
        },
      }),
      validator("param", z.object({ inviteID: z.string() })),
      async (c) => {
        const auth = current()
        if (!auth) return unauthorized()
        const invite = await ControlPlane.getInvite(c.req.valid("param").inviteID)
        if (!invite) return c.json({ message: "Invite not found" }, 404)
        const role = await ControlPlane.allowWorkspace({
          userID: auth.user.id,
          workspaceID: invite.workspaceID,
          need: "owner",
        })
        if (!role) return forbidden()
        return c.json(
          await ControlPlane.revokeInvite({
            inviteID: invite.id,
            actorUserID: auth.user.id,
          }),
        )
      },
    )
    .get(
      "/:workspaceID/shares",
      describeRoute({
        summary: "List workspace shares",
        operationId: "workspaces.shares",
        responses: {
          200: {
            description: "Shares",
            content: {
              "application/json": {
                schema: resolver(ControlPlane.Share.array()),
              },
            },
          },
          ...errors(401, 403),
        },
      }),
      validator("param", z.object({ workspaceID: z.string() })),
      async (c) => {
        const auth = current()
        const workspaceID = c.req.valid("param").workspaceID
        if (!auth) return unauthorized()
        const role = await ControlPlane.allowWorkspace({
          userID: auth.user.id,
          workspaceID,
        })
        if (!role) return forbidden()
        return c.json(await ControlPlane.shares(workspaceID))
      },
    )
    .delete(
      "/shares/:shareID",
      describeRoute({
        summary: "Revoke workspace share",
        operationId: "workspaces.shares.revoke",
        responses: {
          200: {
            description: "Share",
            content: {
              "application/json": {
                schema: resolver(ControlPlane.Share),
              },
            },
          },
          ...errors(401, 403, 404),
        },
      }),
      validator("param", z.object({ shareID: z.string() })),
      async (c) => {
        const auth = current()
        if (!auth) return unauthorized()
        const result = await ControlPlane.getShare(c.req.valid("param").shareID)
        if (!result) return c.json({ message: "Share not found" }, 404)
        const role = await ControlPlane.allowWorkspace({
          userID: auth.user.id,
          workspaceID: result.workspaceID,
          need: "editor",
        })
        if (!role) return forbidden()
        return c.json(
          await ControlPlane.revokeShare({
            shareID: result.id,
            actorUserID: auth.user.id,
          }),
        )
      },
    )
    .post(
      "/shares/session/:sessionID",
      describeRoute({
        summary: "Publish a session as a workspace share",
        operationId: "workspaces.shares.session.publish",
        responses: {
          200: {
            description: "Share",
            content: {
              "application/json": {
                schema: resolver(ControlPlane.Share),
              },
            },
          },
          ...errors(401, 403, 404),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      async (c) => {
        const auth = current()
        if (!auth) return unauthorized()
        const share = await ControlPlane.publishSession({
          sessionID: c.req.valid("param").sessionID,
          actorUserID: auth.user.id,
        })
        if (!share) return c.json({ message: "Session not found or forbidden" }, 404)
        return c.json(share)
      },
    )
    .delete(
      "/shares/session/:sessionID",
      describeRoute({
        summary: "Unpublish a session share",
        operationId: "workspaces.shares.session.unpublish",
        responses: {
          200: {
            description: "Share",
            content: {
              "application/json": {
                schema: resolver(ControlPlane.Share),
              },
            },
          },
          ...errors(401, 403, 404),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      async (c) => {
        const auth = current()
        if (!auth) return unauthorized()
        const share = await ControlPlane.unpublishSession({
          sessionID: c.req.valid("param").sessionID,
          actorUserID: auth.user.id,
        })
        if (!share) return c.json({ message: "Share not found" }, 404)
        return c.json(share)
      },
    )
    .post(
      "/shares/:entityKind/:entityID",
      describeRoute({
        summary: "Publish a domain object as a workspace share",
        description:
          "Publishes a domain object (node, run, proposal, or decision) as a read-only share page with visible provenance.",
        operationId: "workspaces.shares.entity.publish",
        responses: {
          200: {
            description: "Share",
            content: {
              "application/json": {
                schema: resolver(ControlPlane.Share),
              },
            },
          },
          ...errors(401, 403, 404),
        },
      }),
      validator(
        "param",
        z.object({
          entityKind: ControlPlane.ShareEntityKind,
          entityID: z.string(),
        }),
      ),
      async (c) => {
        const auth = current()
        if (!auth) return unauthorized()
        const { entityKind, entityID } = c.req.valid("param")
        const share = await ControlPlane.publishEntity({
          entityKind,
          entityID,
          actorUserID: auth.user.id,
        })
        if (!share) return c.json({ message: "Entity not found or forbidden" }, 404)
        return c.json(share)
      },
    )
    .delete(
      "/shares/:entityKind/:entityID",
      describeRoute({
        summary: "Unpublish a domain object share",
        operationId: "workspaces.shares.entity.unpublish",
        responses: {
          200: {
            description: "Share",
            content: {
              "application/json": {
                schema: resolver(ControlPlane.Share),
              },
            },
          },
          ...errors(401, 403, 404),
        },
      }),
      validator(
        "param",
        z.object({
          entityKind: ControlPlane.ShareEntityKind,
          entityID: z.string(),
        }),
      ),
      async (c) => {
        const auth = current()
        if (!auth) return unauthorized()
        const { entityKind, entityID } = c.req.valid("param")
        const share = await ControlPlane.unpublishEntity({
          entityKind,
          entityID,
          actorUserID: auth.user.id,
        })
        if (!share) return c.json({ message: "Share not found" }, 404)
        return c.json(share)
      },
    ),
)
