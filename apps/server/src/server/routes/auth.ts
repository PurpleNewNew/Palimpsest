import { describeRoute, resolver, validator } from "hono-openapi"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { Hono } from "hono"
import z from "zod"
import { ControlPlane } from "@/control-plane/control-plane"
import { errors } from "../error"
import { lazy } from "@/util/lazy"

const Login = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  workspaceID: z.string().optional(),
})

export const AuthRoutes = lazy(() =>
  new Hono()
    .get(
      "/session",
      describeRoute({
        summary: "Get current auth session",
        operationId: "auth.session",
        responses: {
          200: {
            description: "Current session",
            content: {
              "application/json": {
                schema: resolver(ControlPlane.State),
              },
            },
          },
          ...errors(401),
        },
      }),
      async (c) => {
        const auth = await ControlPlane.state({
          sessionID: getCookie(c, ControlPlane.cookie()),
          workspaceID: c.req.header("x-palimpsest-workspace") ?? getCookie(c, ControlPlane.workspaceCookie()),
        })
        if (!auth) return c.json({ message: "Unauthorized" }, 401)
        return c.json(auth)
      },
    )
    .post(
      "/login",
      describeRoute({
        summary: "Login with local account",
        operationId: "auth.login",
        responses: {
          200: {
            description: "Authenticated session",
            content: {
              "application/json": {
                schema: resolver(ControlPlane.State),
              },
            },
          },
          ...errors(400, 401),
        },
      }),
      validator("json", Login),
      async (c) => {
        const body = c.req.valid("json")
        const result = await ControlPlane.login(body)
        if (!result) return c.json({ message: "Unauthorized" }, 401)
        const secure = new URL(c.req.url).protocol === "https:"
        setCookie(c, ControlPlane.cookie(), result.id, {
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
          secure,
          maxAge: ControlPlane.ttl() / 1000,
        })
        if (result.auth.workspaceID) {
          setCookie(c, ControlPlane.workspaceCookie(), result.auth.workspaceID, {
            path: "/",
            sameSite: "Lax",
            secure,
            maxAge: ControlPlane.ttl() / 1000,
          })
        }
        return c.json(result.auth)
      },
    )
    .post(
      "/logout",
      describeRoute({
        summary: "Logout current user",
        operationId: "auth.logout",
        responses: {
          200: {
            description: "Logged out",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => {
        await ControlPlane.logout(getCookie(c, ControlPlane.cookie()))
        deleteCookie(c, ControlPlane.cookie(), { path: "/" })
        deleteCookie(c, ControlPlane.workspaceCookie(), { path: "/" })
        return c.json(true)
      },
    )
    .post(
      "/invite/accept",
      describeRoute({
        summary: "Accept workspace invite",
        operationId: "auth.invite.accept",
        responses: {
          200: {
            description: "Accepted invite",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    user: ControlPlane.User,
                    workspaceID: z.string(),
                    role: ControlPlane.Role,
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "json",
        z.object({
          code: z.string().min(1),
          username: z.string().optional(),
          password: z.string().optional(),
          displayName: z.string().optional(),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json")
        const auth = ControlPlane.current()
        const result = await ControlPlane.acceptInvite({
          code: body.code,
          username: body.username,
          password: body.password,
          displayName: body.displayName,
          userID: auth?.user.id,
        })
        if (!result) return c.json({ message: "Invite not found" }, 404)
        return c.json(result)
      },
    ),
)
