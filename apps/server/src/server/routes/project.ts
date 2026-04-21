import { mkdir } from "fs/promises"
import { Hono } from "hono"
import { describeRoute, validator } from "hono-openapi"
import { resolver } from "hono-openapi"
import { LensInfo, ProjectShell } from "@opencode-ai/plugin/product"
import { Instance } from "../../project/instance"
import { Project } from "../../project/project"
import z from "zod"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { InstanceBootstrap } from "../../project/bootstrap"
import { ControlPlane } from "@/control-plane/control-plane"
import { Product } from "@/plugin/product"

export const ProjectRoutes = lazy(() =>
  new Hono()
    .post(
      "/",
      describeRoute({
        summary: "Create project",
        description: "Create or adopt a project directory through a plugin-owned preset flow.",
        operationId: "project.create",
        responses: {
          200: {
            description: "Created project shell",
            content: {
              "application/json": {
                schema: resolver(ProjectShell),
              },
            },
          },
          ...errors(400, 401),
        },
      }),
      validator(
        "json",
        z.object({
          directory: z.string(),
          name: z.string().optional(),
          presetID: z.string(),
          input: z.record(z.string(), z.string()).optional(),
        }),
      ),
      async (c) => {
        const auth = ControlPlane.current()
        if (!auth) return c.json({ message: "Unauthorized" }, 401)
        const body = c.req.valid("json")
        await mkdir(body.directory, { recursive: true })
        const created = await Project.fromDirectory(body.directory)
        if (body.name?.trim()) {
          await Project.update({
            projectID: created.project.id,
            name: body.name.trim(),
          })
        }
        await Product.configure({
          projectID: created.project.id,
          worktree: created.project.worktree,
          presetID: body.presetID,
          values: body.input,
        })
        return c.json(await Product.resolve(created.project.id))
      },
    )
    .get(
      "/",
      describeRoute({
        summary: "List all projects",
        description: "Get a list of projects that have been opened with OpenCode.",
        operationId: "project.list",
        responses: {
          200: {
            description: "List of projects",
            content: {
              "application/json": {
                schema: resolver(Project.Info.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const auth = ControlPlane.current()
        if (!auth) return c.json({ message: "Unauthorized" }, 401)
        const projects = await ControlPlane.projects(auth.user.id)
        return c.json(projects)
      },
    )
    .get(
      "/current",
      describeRoute({
        summary: "Get current project",
        description: "Retrieve the currently active project that OpenCode is working with.",
        operationId: "project.current",
        responses: {
          200: {
            description: "Current project information",
            content: {
              "application/json": {
                schema: resolver(Project.Info),
              },
            },
          },
        },
      }),
      async (c) => {
        const auth = ControlPlane.current()
        if (!auth) return c.json({ message: "Unauthorized" }, 401)
        const role = await ControlPlane.allowProject({
          userID: auth.user.id,
          projectID: Instance.project.id,
        })
        if (!role) return c.json({ message: "Forbidden" }, 403)
        return c.json(Instance.project)
      },
    )
    .post(
      "/git/init",
      describeRoute({
        summary: "Initialize git repository",
        description: "Create a git repository for the current project and return the refreshed project info.",
        operationId: "project.initGit",
        responses: {
          200: {
            description: "Project information after git initialization",
            content: {
              "application/json": {
                schema: resolver(Project.Info),
              },
            },
          },
        },
      }),
      async (c) => {
        const auth = ControlPlane.current()
        if (!auth) return c.json({ message: "Unauthorized" }, 401)
        const role = await ControlPlane.allowProject({
          userID: auth.user.id,
          projectID: Instance.project.id,
          need: "editor",
        })
        if (!role) return c.json({ message: "Forbidden" }, 403)
        const dir = Instance.directory
        const prev = Instance.project
        const next = await Project.initGit({
          directory: dir,
          project: prev,
        })
        if (next.id === prev.id && next.vcs === prev.vcs && next.worktree === prev.worktree) return c.json(next)
        await Instance.reload({
          directory: dir,
          worktree: dir,
          project: next,
          init: InstanceBootstrap,
        })
        return c.json(next)
      },
    )
    .patch(
      "/:projectID",
      describeRoute({
        summary: "Update project",
        description: "Update project properties such as name, icon, and commands.",
        operationId: "project.update",
        responses: {
          200: {
            description: "Updated project information",
            content: {
              "application/json": {
                schema: resolver(Project.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ projectID: z.string() })),
      validator("json", Project.update.schema.omit({ projectID: true })),
      async (c) => {
        const projectID = c.req.valid("param").projectID
        const body = c.req.valid("json")
        const auth = ControlPlane.current()
        if (!auth) return c.json({ message: "Unauthorized" }, 401)
        const role = await ControlPlane.allowProject({
          userID: auth.user.id,
          projectID,
          need: "editor",
        })
        if (!role) return c.json({ message: "Forbidden" }, 403)
        const project = await Project.update({ ...body, projectID })
        return c.json(project)
      },
    )
    .get(
      "/:projectID/shell",
      describeRoute({
        summary: "Get product shell",
        description: "Resolve tabs, actions, preset, and installed lenses for a project.",
        operationId: "project.shell",
        responses: {
          200: {
            description: "Project shell",
            content: {
              "application/json": {
                schema: resolver(ProjectShell),
              },
            },
          },
          ...errors(401, 403, 404),
        },
      }),
      validator("param", z.object({ projectID: z.string() })),
      async (c) => {
        const auth = ControlPlane.current()
        const projectID = c.req.valid("param").projectID
        if (!auth) return c.json({ message: "Unauthorized" }, 401)
        const role = await ControlPlane.allowProject({
          userID: auth.user.id,
          projectID,
        })
        if (!role) return c.json({ message: "Forbidden" }, 403)
        return c.json(await Product.resolve(projectID))
      },
    )
    .get(
      "/:projectID/lenses",
      describeRoute({
        summary: "List installed lenses",
        operationId: "project.lenses",
        responses: {
          200: {
            description: "Installed lenses",
            content: {
              "application/json": {
                schema: resolver(LensInfo.array()),
              },
            },
          },
          ...errors(401, 403, 404),
        },
      }),
      validator("param", z.object({ projectID: z.string() })),
      async (c) => {
        const auth = ControlPlane.current()
        const projectID = c.req.valid("param").projectID
        if (!auth) return c.json({ message: "Unauthorized" }, 401)
        const role = await ControlPlane.allowProject({
          userID: auth.user.id,
          projectID,
        })
        if (!role) return c.json({ message: "Forbidden" }, 403)
        return c.json((await Product.resolve(projectID)).lenses)
      },
    )
    .post(
      "/:projectID/lenses",
      describeRoute({
        summary: "Install lens",
        operationId: "project.lenses.install",
        responses: {
          200: {
            description: "Project shell",
            content: {
              "application/json": {
                schema: resolver(ProjectShell),
              },
            },
          },
          ...errors(401, 403, 404),
        },
      }),
      validator("param", z.object({ projectID: z.string() })),
      validator(
        "json",
        z.object({
          lensID: z.string(),
        }),
      ),
      async (c) => {
        const auth = ControlPlane.current()
        const projectID = c.req.valid("param").projectID
        const body = c.req.valid("json")
        if (!auth) return c.json({ message: "Unauthorized" }, 401)
        const role = await ControlPlane.allowProject({
          userID: auth.user.id,
          projectID,
          need: "editor",
        })
        if (!role) return c.json({ message: "Forbidden" }, 403)
        const project = Project.get(projectID)
        if (!project) return c.json({ message: "Project not found" }, 404)
        await Product.installLens({
          projectID,
          worktree: project.worktree,
          lensID: body.lensID,
        })
        return c.json(await Product.resolve(projectID))
      },
    )
    .delete(
      "/:projectID/lenses/:lensID",
      describeRoute({
        summary: "Remove lens",
        operationId: "project.lenses.remove",
        responses: {
          200: {
            description: "Project shell",
            content: {
              "application/json": {
                schema: resolver(ProjectShell),
              },
            },
          },
          ...errors(401, 403, 404),
        },
      }),
      validator("param", z.object({ projectID: z.string(), lensID: z.string() })),
      async (c) => {
        const auth = ControlPlane.current()
        const { projectID, lensID } = c.req.valid("param")
        if (!auth) return c.json({ message: "Unauthorized" }, 401)
        const role = await ControlPlane.allowProject({
          userID: auth.user.id,
          projectID,
          need: "editor",
        })
        if (!role) return c.json({ message: "Forbidden" }, 403)
        const project = Project.get(projectID)
        if (!project) return c.json({ message: "Project not found" }, 404)
        return c.json(
          await Product.removeLens({
            projectID,
            worktree: project.worktree,
            lensID,
          }),
        )
      },
    )
    .delete(
      "/:projectID",
      describeRoute({
        summary: "Delete project",
        description: "Delete a project and permanently remove all associated local session data.",
        operationId: "project.delete",
        responses: {
          200: {
            description: "Deleted project",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ projectID: z.string() })),
      validator(
        "query",
        z.object({
          directory: z.string().optional(),
          removeLocal: z
            .enum(["true", "false"])
            .optional()
            .transform((value) => value === "true"),
        }),
      ),
      async (c) => {
        const projectID = c.req.valid("param").projectID
        const query = c.req.valid("query")
        const auth = ControlPlane.current()
        if (!auth) return c.json({ message: "Unauthorized" }, 401)
        const role = await ControlPlane.allowProject({
          userID: auth.user.id,
          projectID,
          need: "editor",
        })
        if (!role) return c.json({ message: "Forbidden" }, 403)
        await Project.remove({ projectID, directory: query.directory, removeLocal: query.removeLocal })
        return c.json(true)
      },
    ),
)
