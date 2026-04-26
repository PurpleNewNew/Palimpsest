import { describeRoute, resolver, validator } from "hono-openapi"
import { Hono } from "hono"
import z from "zod"
import path from "path"
import os from "os"
import { and, desc, eq } from "drizzle-orm"
import fs from "fs"
import { rm } from "fs/promises"
import { ZipWriter, BlobReader, BlobWriter } from "@zip.js/zip.js"
import {
  normalizeRemoteServerConfig,
  type RemoteServerConfig,
  RemoteServerConfigSchema,
} from "@palimpsest/runner/remote-server"

import { bridge } from "./host-bridge"
import {
  ResearchProjectTable,
  ArticleTable,
  CodeTable,
  AtomTable,
  AtomRelationTable,
  ExperimentTable,
  RemoteServerTable,
  ExperimentExecutionWatchTable,
  ExperimentWatchTable,
  RemoteTaskTable,
  linkKinds,
} from "./research-schema"
import { Research } from "./research"
import { GIT_ENV, ensureRepoInitialized } from "./experiment-guard"
import { ExperimentExecutionWatch } from "./experiment-execution-watch"

const NotFoundSchema = z
  .object({
    name: z.literal("NotFoundError"),
    data: z.object({ message: z.string() }),
  })
  .meta({ ref: "NotFoundError" })

const BadRequestSchema = z
  .object({
    data: z.any(),
    errors: z.array(z.record(z.string(), z.any())),
    success: z.literal(false),
  })
  .meta({ ref: "BadRequestError" })

const errors = (...codes: number[]) =>
  Object.fromEntries(
    codes.map((code) => [
      code,
      code === 400
        ? {
            description: "Bad request",
            content: { "application/json": { schema: resolver(BadRequestSchema) } },
          }
        : {
            description: "Not found",
            content: { "application/json": { schema: resolver(NotFoundSchema) } },
          },
    ]),
  )

const Filesystem = {
  exists: (p: string) => bridge().filesystem.exists(p),
  readText: (p: string) => bridge().filesystem.readText(p),
  readJson: <T = unknown>(p: string) => bridge().filesystem.readJson<T>(p),
  write: (p: string, c: string | Uint8Array) => bridge().filesystem.write(p, c),
  writeJson: (p: string, data: unknown) => bridge().filesystem.writeJson(p, data),
  mkdirp: (p: string) => bridge().filesystem.mkdirp(p),
  resolve: (p: string) => bridge().filesystem.resolve(p),
  isDir: (p: string) => bridge().filesystem.isDir(p),
  stat: (p: string) => bridge().filesystem.stat(p),
}

const Database = {
  use: <T,>(cb: (db: any) => T): T => bridge().db.use(cb),
  transaction: <T,>(cb: () => T): T => bridge().db.transaction(cb),
}

const git = (args: string[], opts: { cwd: string; env?: Record<string, string> }) => bridge().git.run(args, opts)

const Bus = {
  publish: async <T,>(def: T, properties: unknown) => {
    await bridge().bus.publish(def as any, properties)
  },
}

const Project = {
  get: (id: string) => bridge().project.get(id),
  fromDirectory: (dir: string) => bridge().project.fromDirectory(dir),
}

const Session = {
  get: (id: string) => bridge().session.get(id),
  create: (input?: { parentID?: string; title?: string }) => bridge().session.create(input),
  remove: (id: string) => bridge().session.remove(id),
}

const Instance = {
  get directory() {
    return bridge().instance.directory()
  },
  get worktree() {
    return bridge().instance.worktree()
  },
  get project() {
    return bridge().instance.project()
  },
  reload: (input: { directory: string; worktree?: string; project?: { id: string; worktree: string; name?: string } }) =>
    bridge().instance.reload(input),
}

const ProjectPaths = {
  metadataDir: (worktree: string) => bridge().project.metadataDir(worktree),
  plansDir: (worktree: string) => bridge().project.plansDir(worktree),
  worktreesDir: (root: string) => bridge().project.worktreesDir(root),
}

async function copyFile(src: string, dest: string) {
  if (!(await Filesystem.exists(src))) throw new Error(`file not found: ${src}`)
  await fs.promises.cp(src, dest, { force: false, recursive: await Filesystem.isDir(src) })
}

/**
 * Check whether a directory looks like a single article source (e.g. LaTeX project)
 * rather than a container that holds multiple articles.
 *
 * A directory is considered an article if it contains at least one `.tex` file at
 * the top level.  A directory that only contains `.pdf` files or sub-directories
 * (but no `.tex` files) is treated as a container folder — not a single article.
 */
async function isArticleDirectory(dir: string): Promise<boolean> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  return entries.some((e) => !e.isDirectory() && e.name.endsWith(".tex"))
}

const uniqueID = () => crypto.randomUUID()

const atomSchema = z.object({
  atom_id: z.string(),
  research_project_id: z.string(),
  atom_name: z.string(),
  atom_type: z.string(),
  atom_claim_path: z.string().nullable(),
  atom_evidence_type: z.string(),
  atom_evidence_status: z.string(),
  atom_evidence_path: z.string().nullable(),
  atom_evidence_assessment_path: z.string().nullable(),
  article_id: z.string().nullable(),
  session_id: z.string().nullable(),
  time_created: z.number(),
  time_updated: z.number(),
})

const experimentSchema = z.object({
  exp_id: z.string(),
  research_project_id: z.string(),
  exp_name: z.string(),
  exp_session_id: z.string().nullable(),
  baseline_branch_name: z.string().nullable(),
  exp_branch_name: z.string().nullable(),
  exp_result_path: z.string().nullable(),
  atom_id: z.string().nullable(),
  exp_result_summary_path: z.string().nullable(),
  exp_plan_path: z.string().nullable(),
  remote_server_id: z.string().nullable(),
  remote_server_config: RemoteServerConfigSchema.nullable(),
  code_path: z.string(),
  status: z.enum(["pending", "running", "done", "idle", "failed"]),
  started_at: z.number().nullable(),
  finished_at: z.number().nullable(),
  time_created: z.number(),
  time_updated: z.number(),
})

function resolveRemoteServerConfig(remoteServerId: string | null): RemoteServerConfig | null {
  if (!remoteServerId) return null
  const server = Database.use((db) =>
    db.select().from(RemoteServerTable).where(eq(RemoteServerTable.id, remoteServerId)).get(),
  )
  if (!server) return null
  try {
    return normalizeRemoteServerConfig(JSON.parse(server.config))
  } catch {
    return null
  }
}

function withRemoteServerConfig<T extends { remote_server_id: string | null }>(
  exp: T,
): T & { remote_server_config: RemoteServerConfig | null } {
  return { ...exp, remote_server_config: resolveRemoteServerConfig(exp.remote_server_id) }
}

const atomRelationSchema = z.object({
  atom_id_source: z.string(),
  atom_id_target: z.string(),
  relation_type: z.string(),
  note: z.string().nullable(),
  time_created: z.number(),
  time_updated: z.number(),
})

const atomRelationCreateSchema = z.object({
  source_atom_id: z.string().min(1, "source atom required"),
  target_atom_id: z.string().min(1, "target atom required"),
  relation_type: z.enum(linkKinds),
  note: z.string().optional(),
})

const atomCreateSchema = z.object({
  name: z.string().min(1, "name required"),
  type: z.enum(["fact", "method", "theorem", "verification"]),
})

const atomRelationDeleteSchema = z.object({
  source_atom_id: z.string().min(1, "source atom required"),
  target_atom_id: z.string().min(1, "target atom required"),
  relation_type: z.enum(linkKinds),
})

const atomRelationUpdateSchema = atomRelationDeleteSchema.extend({
  next_relation_type: z.enum(linkKinds),
})

const atomRelationDeleteResponseSchema = z.object({
  source_atom_id: z.string(),
  target_atom_id: z.string(),
  relation_type: z.enum(linkKinds),
  deleted: z.literal(true),
})

const atomDeleteResponseSchema = z.object({
  atom_id: z.string(),
  deleted: z.literal(true),
})

const researchProjectSchema = z.object({
  research_project_id: z.string(),
  project_id: z.string(),
  background_path: z.string().nullable(),
  goal_path: z.string().nullable(),
  macro_table_path: z.string().nullable(),
  time_created: z.number(),
  time_updated: z.number(),
})

export const routes = new Hono()
  .get(
    "/project/by-project/:projectId",
    describeRoute({
      summary: "Get research project by project ID",
      description: "Look up the research project associated with a given project ID.",
      operationId: "research.project.get",
      responses: {
        200: {
          description: "Research project found",
          content: {
            "application/json": {
              schema: resolver(researchProjectSchema),
            },
          },
        },
        ...errors(404),
      },
    }),
    async (c) => {
      const projectId = c.req.param("projectId")
      let row = Database.use((db) =>
        db.select().from(ResearchProjectTable).where(eq(ResearchProjectTable.project_id, projectId)).get(),
      )

      // If not found in database, try to recover from memo file
      if (!row) {
        try {
          let project
          try {
            project = await Project.get(projectId)
          } catch (err) {
            project = undefined
          }

          if (project) {
            const memoPath = path.join(project.worktree, ".palimpsest-research.json")
            if (await Filesystem.exists(memoPath)) {
              const memo = await Filesystem.readJson<{ research_project_id: string; project_id: string }>(memoPath)

              // Check if this research project exists in database
              const existingResearch = Database.use((db) =>
                db
                  .select()
                  .from(ResearchProjectTable)
                  .where(eq(ResearchProjectTable.research_project_id, memo.research_project_id))
                  .get(),
              )

              if (existingResearch) {
                // Update the project_id to current one
                Database.use((db) =>
                  db
                    .update(ResearchProjectTable)
                    .set({ project_id: projectId, time_updated: Date.now() })
                    .where(eq(ResearchProjectTable.research_project_id, memo.research_project_id))
                    .run(),
                )

                // Fetch the updated row
                row = Database.use((db) =>
                  db.select().from(ResearchProjectTable).where(eq(ResearchProjectTable.project_id, projectId)).get(),
                )
              }
            }
          }
        } catch (err) {
          // Silently fail recovery attempt
        }
      }

      if (!row) {
        return c.json({ success: false, message: "no research project for this project" }, 404)
      }
      return c.json(row)
    },
  )
  .get(
    "/project/:researchProjectId/atoms",
    describeRoute({
      summary: "List atoms and relations",
      description: "Query all atoms and atom relations for a research project.",
      operationId: "research.atoms.list",
      responses: {
        200: {
          description: "Atoms and relations",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  atoms: z.array(atomSchema),
                  relations: z.array(atomRelationSchema),
                }),
              ),
            },
          },
        },
        ...errors(400),
      },
    }),
    async (c) => {
      const researchProjectId = c.req.param("researchProjectId")

      const atoms = Database.use((db) =>
        db.select().from(AtomTable).where(eq(AtomTable.research_project_id, researchProjectId)).all(),
      )

      const atomIds = atoms.map((a: any) => a.atom_id)

      let relations: (typeof AtomRelationTable.$inferSelect)[] = []
      if (atomIds.length > 0) {
        const allRelations = Database.use((db) => db.select().from(AtomRelationTable).all())
        relations = allRelations.filter((r: any) => atomIds.includes(r.atom_id_source) || atomIds.includes(r.atom_id_target))
      }

      return c.json({ atoms, relations })
    },
  )
  .post(
    "/project/:researchProjectId/atom",
    describeRoute({
      summary: "Create atom",
      description: "Create a lightweight atom with starter claim and evidence files.",
      operationId: "research.atom.create",
      responses: {
        200: {
          description: "Created atom",
          content: {
            "application/json": {
              schema: resolver(atomSchema),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator("json", atomCreateSchema),
    async (c) => {
      const researchProjectId = c.req.param("researchProjectId")
      const body = c.req.valid("json")

      const project = Database.use((db) =>
        db
          .select()
          .from(ResearchProjectTable)
          .where(eq(ResearchProjectTable.research_project_id, researchProjectId))
          .get(),
      )
      if (!project) {
        return c.json({ success: false, message: `research project not found: ${researchProjectId}` }, 404)
      }

      const atomId = uniqueID()
      const atomDir = path.join(Instance.directory, "atom_list", atomId)
      const claimPath = path.join(atomDir, "claim.md")
      const evidencePath = path.join(atomDir, "evidence.md")
      const evidenceAssessmentPath = path.join(atomDir, "evidence_assessment.md")

      await Filesystem.write(claimPath, "# Claim\n")
      await Filesystem.write(evidencePath, "# Evidence\n")
      await Filesystem.write(evidenceAssessmentPath, "")

      const now = Date.now()
      Database.use((db) =>
        db
          .insert(AtomTable)
          .values({
            atom_id: atomId,
            research_project_id: researchProjectId,
            atom_name: body.name.trim(),
            atom_type: body.type,
            atom_claim_path: claimPath,
            atom_evidence_type: "math",
            atom_evidence_status: "pending",
            atom_evidence_path: evidencePath,
            atom_evidence_assessment_path: evidenceAssessmentPath,
            article_id: null,
            session_id: null,
            time_created: now,
            time_updated: now,
          })
          .run(),
      )

      await Bus.publish(Research.Event.AtomsUpdated, { researchProjectId })

      const atom = Database.use((db) => db.select().from(AtomTable).where(eq(AtomTable.atom_id, atomId)).get())
      if (!atom) {
        return c.json({ success: false, message: `atom not found after create: ${atomId}` }, 404)
      }

      return c.json(atom)
    },
  )
  .post(
    "/project/:researchProjectId/relation",
    describeRoute({
      summary: "Create atom relation",
      description: "Create a directed relation between two atoms in the same research project.",
      operationId: "research.relation.create",
      responses: {
        200: {
          description: "Created relation",
          content: {
            "application/json": {
              schema: resolver(atomRelationSchema),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator("json", atomRelationCreateSchema),
    async (c) => {
      const researchProjectId = c.req.param("researchProjectId")
      const body = c.req.valid("json")

      if (body.source_atom_id === body.target_atom_id) {
        return c.json({ success: false, message: "source and target atoms must be different" }, 400)
      }

      const source = Database.use((db) =>
        db.select().from(AtomTable).where(eq(AtomTable.atom_id, body.source_atom_id)).get(),
      )
      if (!source || source.research_project_id !== researchProjectId) {
        return c.json({ success: false, message: `source atom not found: ${body.source_atom_id}` }, 404)
      }

      const target = Database.use((db) =>
        db.select().from(AtomTable).where(eq(AtomTable.atom_id, body.target_atom_id)).get(),
      )
      if (!target || target.research_project_id !== researchProjectId) {
        return c.json({ success: false, message: `target atom not found: ${body.target_atom_id}` }, 404)
      }

      const now = Date.now()

      try {
        Database.use((db) =>
          db
            .insert(AtomRelationTable)
            .values({
              atom_id_source: body.source_atom_id,
              atom_id_target: body.target_atom_id,
              relation_type: body.relation_type,
              note: body.note ?? null,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
      } catch (error: any) {
        if (error?.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
          return c.json({ success: false, message: "relation already exists" }, 400)
        }
        throw error
      }

      await Bus.publish(Research.Event.AtomsUpdated, { researchProjectId })

      return c.json({
        atom_id_source: body.source_atom_id,
        atom_id_target: body.target_atom_id,
        relation_type: body.relation_type,
        note: body.note ?? null,
        time_created: now,
        time_updated: now,
      })
    },
  )
  .patch(
    "/project/:researchProjectId/relation",
    describeRoute({
      summary: "Update atom relation",
      description: "Update the type of an existing directed relation between two atoms in the same research project.",
      operationId: "research.relation.update",
      responses: {
        200: {
          description: "Updated relation",
          content: {
            "application/json": {
              schema: resolver(atomRelationSchema),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator("json", atomRelationUpdateSchema),
    async (c) => {
      const researchProjectId = c.req.param("researchProjectId")
      const body = c.req.valid("json")

      const source = Database.use((db) =>
        db.select().from(AtomTable).where(eq(AtomTable.atom_id, body.source_atom_id)).get(),
      )
      if (!source || source.research_project_id !== researchProjectId) {
        return c.json({ success: false, message: `source atom not found: ${body.source_atom_id}` }, 404)
      }

      const target = Database.use((db) =>
        db.select().from(AtomTable).where(eq(AtomTable.atom_id, body.target_atom_id)).get(),
      )
      if (!target || target.research_project_id !== researchProjectId) {
        return c.json({ success: false, message: `target atom not found: ${body.target_atom_id}` }, 404)
      }

      const existing = Database.use((db) =>
        db
          .select()
          .from(AtomRelationTable)
          .where(
            and(
              eq(AtomRelationTable.atom_id_source, body.source_atom_id),
              eq(AtomRelationTable.atom_id_target, body.target_atom_id),
              eq(AtomRelationTable.relation_type, body.relation_type),
            ),
          )
          .get(),
      )
      if (!existing) {
        return c.json({ success: false, message: "relation not found" }, 404)
      }

      if (body.next_relation_type === body.relation_type) {
        return c.json(existing)
      }

      const conflict = Database.use((db) =>
        db
          .select()
          .from(AtomRelationTable)
          .where(
            and(
              eq(AtomRelationTable.atom_id_source, body.source_atom_id),
              eq(AtomRelationTable.atom_id_target, body.target_atom_id),
              eq(AtomRelationTable.relation_type, body.next_relation_type),
            ),
          )
          .get(),
      )
      if (conflict) {
        return c.json({ success: false, message: "relation already exists" }, 400)
      }

      const now = Date.now()
      Database.transaction(() => {
        Database.use((db) =>
          db
            .delete(AtomRelationTable)
            .where(
              and(
                eq(AtomRelationTable.atom_id_source, body.source_atom_id),
                eq(AtomRelationTable.atom_id_target, body.target_atom_id),
                eq(AtomRelationTable.relation_type, body.relation_type),
              ),
            )
            .run(),
        )
        Database.use((db) =>
          db
            .insert(AtomRelationTable)
            .values({
              atom_id_source: body.source_atom_id,
              atom_id_target: body.target_atom_id,
              relation_type: body.next_relation_type,
              note: existing.note,
              time_created: existing.time_created,
              time_updated: now,
            })
            .run(),
        )
      })

      await Bus.publish(Research.Event.AtomsUpdated, { researchProjectId })

      return c.json({
        atom_id_source: body.source_atom_id,
        atom_id_target: body.target_atom_id,
        relation_type: body.next_relation_type,
        note: existing.note,
        time_created: existing.time_created,
        time_updated: now,
      })
    },
  )
  .delete(
    "/project/:researchProjectId/relation",
    describeRoute({
      summary: "Delete atom relation",
      description: "Delete a directed relation between two atoms in the same research project.",
      operationId: "research.relation.delete",
      responses: {
        200: {
          description: "Deleted relation",
          content: {
            "application/json": {
              schema: resolver(atomRelationDeleteResponseSchema),
            },
          },
        },
        ...errors(404),
      },
    }),
    validator("json", atomRelationDeleteSchema),
    async (c) => {
      const researchProjectId = c.req.param("researchProjectId")
      const body = c.req.valid("json")

      const source = Database.use((db) =>
        db.select().from(AtomTable).where(eq(AtomTable.atom_id, body.source_atom_id)).get(),
      )
      if (!source || source.research_project_id !== researchProjectId) {
        return c.json({ success: false, message: `source atom not found: ${body.source_atom_id}` }, 404)
      }

      const target = Database.use((db) =>
        db.select().from(AtomTable).where(eq(AtomTable.atom_id, body.target_atom_id)).get(),
      )
      if (!target || target.research_project_id !== researchProjectId) {
        return c.json({ success: false, message: `target atom not found: ${body.target_atom_id}` }, 404)
      }

      const existing = Database.use((db) =>
        db
          .select()
          .from(AtomRelationTable)
          .where(
            and(
              eq(AtomRelationTable.atom_id_source, body.source_atom_id),
              eq(AtomRelationTable.atom_id_target, body.target_atom_id),
              eq(AtomRelationTable.relation_type, body.relation_type),
            ),
          )
          .get(),
      )
      if (!existing) {
        return c.json({ success: false, message: "relation not found" }, 404)
      }

      Database.use((db) =>
        db
          .delete(AtomRelationTable)
          .where(
            and(
              eq(AtomRelationTable.atom_id_source, body.source_atom_id),
              eq(AtomRelationTable.atom_id_target, body.target_atom_id),
              eq(AtomRelationTable.relation_type, body.relation_type),
            ),
          )
          .run(),
      )

      await Bus.publish(Research.Event.AtomsUpdated, { researchProjectId })

      return c.json({
        source_atom_id: body.source_atom_id,
        target_atom_id: body.target_atom_id,
        relation_type: body.relation_type,
        deleted: true as const,
      })
    },
  )
  .delete(
    "/project/:researchProjectId/atom/:atomId",
    describeRoute({
      summary: "Delete atom",
      description: "Delete one atom and all relations pointing to or from it.",
      operationId: "research.atom.delete",
      responses: {
        200: {
          description: "Deleted atom",
          content: {
            "application/json": {
              schema: resolver(atomDeleteResponseSchema),
            },
          },
        },
        ...errors(404),
      },
    }),
    async (c) => {
      const researchProjectId = c.req.param("researchProjectId")
      const atomId = c.req.param("atomId")

      const atom = Database.use((db) => db.select().from(AtomTable).where(eq(AtomTable.atom_id, atomId)).get())
      if (!atom || atom.research_project_id !== researchProjectId) {
        return c.json({ success: false, message: `atom not found: ${atomId}` }, 404)
      }

      const dir = path.join(Instance.directory, "atom_list", atomId)
      try {
        await rm(dir, { recursive: true, force: true })
      } catch (error) {
        console.warn(`Failed to remove atom directory ${dir}:`, error)
      }

      if (atom.session_id) {
        await Session.remove(atom.session_id)
      }

      // Delete associated experiments
      const experiments = Database.use((db) =>
        db.select().from(ExperimentTable).where(eq(ExperimentTable.atom_id, atomId)).all(),
      )
      for (const exp of experiments) {
        // Delete experiment watchers
        Database.use((db) => db.delete(ExperimentWatchTable).where(eq(ExperimentWatchTable.exp_id, exp.exp_id)).run())
        // Delete experiment record
        Database.use((db) => db.delete(ExperimentTable).where(eq(ExperimentTable.exp_id, exp.exp_id)).run())
        // Clean up experiment session
        if (exp.exp_session_id) {
          await Session.remove(exp.exp_session_id).catch(() => {})
        }
        // Delete experiment results directory
        const expDir = path.join(Instance.directory, "exp_results", exp.exp_id)
        await rm(expDir, { recursive: true, force: true }).catch(() => {})
        // Remove experiment worktree and branch
        if (exp.exp_branch_name) {
          const baseRepo = path.resolve(exp.code_path, "../..")
          await git(["worktree", "remove", exp.code_path, "--force"], { cwd: baseRepo }).catch(() => {})
          await git(["branch", "-D", exp.exp_branch_name], { cwd: baseRepo }).catch(() => {})
        }
      }

      Database.transaction(() => {
        Database.use((db) => db.delete(AtomRelationTable).where(eq(AtomRelationTable.atom_id_source, atomId)).run())
        Database.use((db) => db.delete(AtomRelationTable).where(eq(AtomRelationTable.atom_id_target, atomId)).run())
        Database.use((db) => db.delete(AtomTable).where(eq(AtomTable.atom_id, atomId)).run())
      })

      await Bus.publish(Research.Event.AtomsUpdated, { researchProjectId })

      return c.json({
        atom_id: atomId,
        deleted: true as const,
      })
    },
  )
  // ── Atom update ──
  .patch(
    "/research/:researchProjectId/atom/:atomId",
    describeRoute({
      summary: "Update an atom's mutable fields",
      operationId: "research.atom.update",
      responses: {
        200: {
          description: "Updated atom",
          content: {
            "application/json": {
              schema: resolver(atomSchema),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "json",
      z.object({
        evidence_status: z.enum(["pending", "in_progress", "proven", "disproven"]).optional(),
        evidence_type: z.enum(["math", "experiment"]).optional(),
      }),
    ),
    async (c) => {
      const researchProjectId = c.req.param("researchProjectId")
      const atomId = c.req.param("atomId")
      const body = c.req.valid("json")

      const atom = Database.use((db) => db.select().from(AtomTable).where(eq(AtomTable.atom_id, atomId)).get())
      if (!atom || atom.research_project_id !== researchProjectId) {
        return c.json({ success: false, message: `atom not found: ${atomId}` }, 404)
      }

      const updates: Record<string, unknown> = { time_updated: Date.now() }
      if (body.evidence_status) updates.atom_evidence_status = body.evidence_status
      if (body.evidence_type) updates.atom_evidence_type = body.evidence_type

      Database.use((db) => db.update(AtomTable).set(updates).where(eq(AtomTable.atom_id, atomId)).run())

      await Bus.publish(Research.Event.AtomsUpdated, { researchProjectId })

      const updated = Database.use((db) => db.select().from(AtomTable).where(eq(AtomTable.atom_id, atomId)).get())!
      return c.json(updated)
    },
  )
  .get(
    "/project/:researchProjectId/articles",
    describeRoute({
      summary: "List articles for a research project",
      description: "Return article IDs and file names for a research project, useful for dropdown selectors.",
      operationId: "research.article.list",
      responses: {
        200: {
          description: "List of articles",
          content: {
            "application/json": {
              schema: resolver(
                z.array(
                  z.object({
                    article_id: z.string(),
                    filename: z.string(),
                    title: z.string().nullable(),
                  }),
                ),
              ),
            },
          },
        },
        ...errors(404),
      },
    }),
    async (c) => {
      const researchProjectId = c.req.param("researchProjectId")
      const project = Database.use((db) =>
        db
          .select()
          .from(ResearchProjectTable)
          .where(eq(ResearchProjectTable.research_project_id, researchProjectId))
          .get(),
      )
      if (!project) {
        return c.json({ success: false, message: "research project not found" }, 404)
      }
      const articles = Database.use((db) =>
        db.select().from(ArticleTable).where(eq(ArticleTable.research_project_id, researchProjectId)).all(),
      )
      return c.json(
        articles.map((a: any) => ({
          article_id: a.article_id,
          filename: a.path.split("/").pop() ?? a.path,
          title: a.title,
        })),
      )
    },
  )
  .post(
    "/project/:researchProjectId/article",
    describeRoute({
      summary: "Add article to research project",
      description: "Add a single article (paper/PDF) to an existing research project.",
      operationId: "research.article.create",
      responses: {
        200: {
          description: "Created article",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  article_id: z.string(),
                  path: z.string(),
                  title: z.string().nullable(),
                  source_url: z.string().nullable(),
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
        sourcePath: z.string().min(1, "sourcePath required"),
        title: z.string().optional(),
        sourceUrl: z.string().optional(),
      }),
    ),
    async (c) => {
      const researchProjectId = c.req.param("researchProjectId")
      const body = c.req.valid("json")

      const project = Database.use((db) =>
        db
          .select()
          .from(ResearchProjectTable)
          .where(eq(ResearchProjectTable.research_project_id, researchProjectId))
          .get(),
      )
      if (!project) {
        return c.json({ success: false, message: "research project not found" }, 404)
      }

      const sourcePath = Filesystem.resolve(body.sourcePath)
      if (!(await Filesystem.exists(sourcePath))) {
        return c.json({ success: false, message: `source file not found: ${body.sourcePath}` }, 400)
      }
      if (await Filesystem.isDir(sourcePath)) {
        if (!(await isArticleDirectory(sourcePath))) {
          return c.json(
            {
              success: false,
              message:
                `"${path.basename(sourcePath)}" looks like a folder containing articles, not a single article. ` +
                `Please select individual PDF files or LaTeX source folders instead.`,
            },
            400,
          )
        }
      } else if (path.extname(sourcePath).toLowerCase() !== ".pdf") {
        return c.json({ success: false, message: `unsupported article source: ${body.sourcePath}` }, 400)
      }

      const projectInfo = Project.get(project.project_id)
      if (!projectInfo) {
        return c.json({ success: false, message: "project not found" }, 404)
      }
      const articlesDir = path.join(projectInfo.worktree, "articles")
      await Filesystem.write(path.join(articlesDir, ".keep"), "")

      const destPath = path.join(articlesDir, path.basename(sourcePath))
      if (await Filesystem.exists(destPath)) {
        return c.json({ success: false, message: `article already exists: ${path.basename(sourcePath)}` }, 400)
      }

      await copyFile(sourcePath, destPath)

      const now = Date.now()
      const articleId = uniqueID()

      Database.use((db) =>
        db
          .insert(ArticleTable)
          .values({
            article_id: articleId,
            research_project_id: researchProjectId,
            path: destPath,
            title: body.title ?? null,
            source_url: body.sourceUrl ?? null,
            status: "pending",
            time_created: now,
            time_updated: now,
          })
          .run(),
      )

      return c.json({
        article_id: articleId,
        path: destPath,
        title: body.title ?? null,
        source_url: body.sourceUrl ?? null,
      })
    },
  )
  .get(
    "/atom/:atomId/experiments",
    describeRoute({
      summary: "List experiments for an atom (read-only)",
      description:
        "Return all experiments linked to the given atom. Read-only; does not create or modify any session. Use this for inspect-only flows (e.g., the atom detail panel) instead of the legacy session-create + session.atom.get pattern.",
      operationId: "research.atom.experiments.list",
      responses: {
        200: {
          description: "Experiments linked to the atom",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  experiments: z.array(experimentSchema),
                }),
              ),
            },
          },
        },
        ...errors(404),
      },
    }),
    async (c) => {
      const atomId = c.req.param("atomId")

      const atom = Database.use((db) => db.select().from(AtomTable).where(eq(AtomTable.atom_id, atomId)).get())
      if (!atom) {
        return c.json({ success: false, message: `atom not found: ${atomId}` }, 404)
      }

      const experiments = Database.use((db) =>
        db.select().from(ExperimentTable).where(eq(ExperimentTable.atom_id, atomId)).all(),
      )

      return c.json({ experiments: experiments.map(withRemoteServerConfig) })
    },
  )
  .post(
    "/atom/:atomId/session",
    describeRoute({
      summary: "Create or get session for an atom",
      description:
        "If the atom already has a session, returns its session ID. Otherwise creates a new session and binds it to the atom.",
      operationId: "research.atom.session.create",
      responses: {
        200: {
          description: "Session ID for the atom",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  session_id: z.string(),
                  created: z.boolean(),
                }),
              ),
            },
          },
        },
        ...errors(404),
      },
    }),
    async (c) => {
      const atomId = c.req.param("atomId")

      const atom = Database.use((db) => db.select().from(AtomTable).where(eq(AtomTable.atom_id, atomId)).get())
      if (!atom) {
        return c.json({ success: false, message: `atom not found: ${atomId}` }, 404)
      }

      if (atom.session_id) {
        const existing = await Session.get(atom.session_id).catch(() => undefined)
        if (existing && !existing.time.archived) {
          return c.json({ session_id: atom.session_id, created: false })
        }
      }

      const session = await Session.create({ title: `Atom: ${atom.atom_name}` })

      Database.use((db) =>
        db
          .update(AtomTable)
          .set({ session_id: session.id, time_updated: Date.now() })
          .where(eq(AtomTable.atom_id, atomId))
          .run(),
      )

      return c.json({ session_id: session.id, created: true })
    },
  )
  .get(
    "/code-paths",
    describeRoute({
      summary: "List available code paths",
      description:
        "List subdirectories under the research project's code/ directory that can be used as experiment code paths.",
      operationId: "research.codePaths",
      responses: {
        200: {
          description: "List of code paths",
          content: {
            "application/json": {
              schema: resolver(z.array(z.object({ name: z.string(), path: z.string() }))),
            },
          },
        },
        ...errors(400),
      },
    }),
    async (c) => {
      const codeDir = path.join(Instance.directory, "code")
      if (!fs.existsSync(codeDir)) {
        return c.json([])
      }
      const entries = fs.readdirSync(codeDir, { withFileTypes: true })
      const codePaths = entries
        .filter((e) => e.isDirectory())
        .map((e) => ({
          name: e.name,
          path: path.join(codeDir, e.name),
        }))
      return c.json(codePaths)
    },
  )
  .get(
    "/branches",
    describeRoute({
      summary: "List git branches for a code path",
      description:
        "List local git branches under the given code path. If a branch is associated with an experiment, returns the experiment name as displayName.",
      operationId: "research.branches",
      responses: {
        200: {
          description: "List of branches",
          content: {
            "application/json": {
              schema: resolver(
                z.array(
                  z.object({
                    branch: z.string(),
                    displayName: z.string(),
                    experimentId: z.string().nullable(),
                  }),
                ),
              ),
            },
          },
        },
        ...errors(400),
      },
    }),
    validator(
      "query",
      z.object({
        codePath: z.string().min(1, "codePath required"),
      }),
    ),
    async (c) => {
      const { codePath } = c.req.valid("query")

      if (!fs.existsSync(codePath)) {
        return c.json({ success: false, message: `codePath not found: ${codePath}` }, 400)
      }

      const result = await git(["branch", "--format=%(refname:short)"], { cwd: codePath })
      if (result.exitCode !== 0) {
        return c.json({ success: false, message: `git error: ${result.stderr.toString()}` }, 400)
      }

      const raw = result.text().trim()
      if (!raw) {
        return c.json([])
      }

      const branches: string[] = []
      for (const line of raw.split("\n")) {
        const name = line.trim()
        if (!name) continue
        branches.push(name)
      }

      // find experiments linked to these branches
      const experiments = Database.use((db) => db.select().from(ExperimentTable).all())
      const expByBranch = new Map<string, { expId: string; expName: string }>()
      for (const exp of experiments) {
        if (exp.exp_branch_name) {
          expByBranch.set(exp.exp_branch_name, { expId: exp.exp_id, expName: exp.exp_name })
        }
      }

      const items = branches.map((branch) => {
        const exp = expByBranch.get(branch)
        return {
          branch,
          displayName: exp ? exp.expName : branch,
          experimentId: exp ? exp.expId : null,
        }
      })

      return c.json(items)
    },
  )
  .post(
    "/experiment",
    describeRoute({
      summary: "Create experiment for an atom",
      description:
        "Create a new experiment for a given atom. Creates a dedicated session, sets up result paths, and inserts the experiment record.",
      operationId: "research.experiment.create",
      responses: {
        200: {
          description: "Created experiment",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  exp_id: z.string(),
                  exp_name: z.string(),
                  atom_id: z.string(),
                  atom_name: z.string(),
                  session_id: z.string(),
                  baseline_branch: z.string(),
                  exp_branch: z.string(),
                  exp_result_path: z.string(),
                  exp_result_summary_path: z.string(),
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
        atomId: z.string().min(1, "atomId required"),
        expName: z.string().min(1, "expName required"),
        baselineBranch: z.string().optional().default("master"),
        remoteServerId: z.string().optional(),
        codePath: z.string().min(1, "codePath required"),
      }),
    ),
    async (c) => {
      const body = c.req.valid("json")

      const atom = Database.use((db) => db.select().from(AtomTable).where(eq(AtomTable.atom_id, body.atomId)).get())
      if (!atom) {
        return c.json({ success: false, message: `atom not found: ${body.atomId}` }, 404)
      }
      const expId = uniqueID()
      const session = await Session.create({ title: `Exp: ${body.expName}` })

      const expDir = path.join(Instance.directory, "exp_results", expId)
      const expResultPath = path.join(expDir, "result.wandb")
      const expResultSummaryPath = path.join(expDir, "summary.md")
      const expPlanPath = path.join(expDir, "plan.md")

      await Filesystem.write(path.join(expDir, ".keep"), "")
      await Filesystem.write(expPlanPath, "")

      // Ensure repo is initialised and create worktree for the experiment
      const initResult = await ensureRepoInitialized(body.codePath)
      if (!initResult.ok) {
        return c.json(
          { success: false, message: `Failed to initialise repo at ${body.codePath}: ${initResult.message}` },
          400,
        )
      }

      const baselineExists = await git(["rev-parse", "--verify", body.baselineBranch], { cwd: body.codePath })
      if (baselineExists.exitCode !== 0) {
        return c.json(
          { success: false, message: `baseline branch "${body.baselineBranch}" not found at ${body.codePath}` },
          400,
        )
      }

      const worktreePath = path.join(ProjectPaths.worktreesDir(body.codePath), expId)
      const createWorktree = await git(["worktree", "add", worktreePath, body.baselineBranch, "-b", expId], {
        cwd: body.codePath,
        env: GIT_ENV,
      })
      if (createWorktree.exitCode !== 0) {
        return c.json(
          {
            success: false,
            message: `failed to create worktree for ${expId}: ${createWorktree.stderr?.toString().trim() || "unknown error"}`,
          },
          400,
        )
      }

      const now = Date.now()
      Database.use((db) =>
        db
          .insert(ExperimentTable)
          .values({
            exp_id: expId,
            research_project_id: atom.research_project_id,
            exp_name: body.expName,
            atom_id: body.atomId,
            exp_session_id: session.id,
            baseline_branch_name: body.baselineBranch,
            exp_branch_name: expId,
            exp_result_path: expResultPath,
            exp_result_summary_path: expResultSummaryPath,
            exp_plan_path: expPlanPath,
            code_path: worktreePath,
            remote_server_id: body.remoteServerId ?? null,
            status: "pending",
            time_created: now,
            time_updated: now,
          })
          .run(),
      )

      ExperimentExecutionWatch.createOrGet(expId, `${body.expName} for ${atom.atom_name}`, "pending")

      return c.json({
        exp_id: expId,
        exp_name: body.expName,
        atom_id: body.atomId,
        atom_name: atom.atom_name,
        session_id: session.id,
        baseline_branch: body.baselineBranch,
        exp_branch: expId,
        exp_result_path: expResultPath,
        exp_result_summary_path: expResultSummaryPath,
        remote_server_config: resolveRemoteServerConfig(body.remoteServerId ?? null),
      })
    },
  )
  .post(
    "/experiment/:expId/session",
    describeRoute({
      summary: "Create or get session for an experiment",
      description:
        "If the experiment already has a session that is not archived, returns its session ID. Otherwise creates a new session and binds it to the experiment.",
      operationId: "research.experiment.session.create",
      responses: {
        200: {
          description: "Session ID for the experiment",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  session_id: z.string(),
                  created: z.boolean(),
                }),
              ),
            },
          },
        },
        ...errors(404),
      },
    }),
    async (c) => {
      const expId = c.req.param("expId")

      const experiment = Database.use((db) =>
        db.select().from(ExperimentTable).where(eq(ExperimentTable.exp_id, expId)).get(),
      )
      if (!experiment) {
        return c.json({ success: false, message: `experiment not found: ${expId}` }, 404)
      }

      if (experiment.exp_session_id) {
        const existing = await Session.get(experiment.exp_session_id).catch(() => undefined)
        if (existing && !existing.time.archived) {
          return c.json({ session_id: experiment.exp_session_id, created: false })
        }
      }

      const session = await Session.create({ title: `Exp: ${experiment.exp_name}` })

      Database.use((db) =>
        db
          .update(ExperimentTable)
          .set({ exp_session_id: session.id, time_updated: Date.now() })
          .where(eq(ExperimentTable.exp_id, expId))
          .run(),
      )

      return c.json({ session_id: session.id, created: true })
    },
  )
  .get(
    "/project/:researchProjectId/session-tree",
    describeRoute({
      summary: "Get session tree for research project",
      description:
        "Returns atoms with their linked sessions and experiments, plus lists of atom/experiment session IDs for filtering from the normal session list.",
      operationId: "research.project.sessionTree",
      responses: {
        200: {
          description: "Session tree",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  atomSessionIds: z.array(z.string()),
                  expSessionIds: z.array(z.string()),
                  atoms: z.array(
                    z.object({
                      atom_id: z.string(),
                      atom_name: z.string(),
                      atom_type: z.string(),
                      atom_evidence_status: z.string(),
                      session_id: z.string().nullable(),
                      experiments: z.array(
                        z.object({
                          exp_id: z.string(),
                          exp_name: z.string(),
                          exp_session_id: z.string().nullable(),
                          status: z.enum(["pending", "running", "done", "idle", "failed"]),
                        }),
                      ),
                    }),
                  ),
                }),
              ),
            },
          },
        },
        ...errors(404),
      },
    }),
    async (c) => {
      const researchProjectId = c.req.param("researchProjectId")

      const project = Database.use((db) =>
        db
          .select()
          .from(ResearchProjectTable)
          .where(eq(ResearchProjectTable.research_project_id, researchProjectId))
          .get(),
      )
      if (!project) {
        return c.json({ success: false, message: "research project not found" }, 404)
      }

      const atoms = Database.use((db) =>
        db.select().from(AtomTable).where(eq(AtomTable.research_project_id, researchProjectId)).all(),
      )

      const experiments = Database.use((db) =>
        db.select().from(ExperimentTable).where(eq(ExperimentTable.research_project_id, researchProjectId)).all(),
      )

      const atomSessionIds: string[] = []
      const expSessionIds: string[] = []

      for (const atom of atoms) {
        if (atom.session_id) atomSessionIds.push(atom.session_id)
      }
      for (const exp of experiments) {
        if (exp.exp_session_id) expSessionIds.push(exp.exp_session_id)
      }

      const expsByAtom = new Map<string, typeof experiments>()
      for (const exp of experiments) {
        if (!exp.atom_id) continue
        const list = expsByAtom.get(exp.atom_id)
        if (list) list.push(exp)
        else expsByAtom.set(exp.atom_id, [exp])
      }

      const atomTree = atoms.map((atom: any) => ({
        atom_id: atom.atom_id,
        atom_name: atom.atom_name,
        atom_type: atom.atom_type,
        atom_evidence_status: atom.atom_evidence_status,
        session_id: atom.session_id,
        experiments: (expsByAtom.get(atom.atom_id) ?? []).map((exp: any) => ({
          exp_id: exp.exp_id,
          exp_name: exp.exp_name,
          exp_session_id: exp.exp_session_id,
          status: exp.status,
          remote_server_config: resolveRemoteServerConfig(exp.remote_server_id),
        })),
      }))

      return c.json({
        atomSessionIds,
        expSessionIds,
        atoms: atomTree,
      })
    },
  )
  // ── Experiment delete ──
  .delete(
    "/experiment/:expId",
    describeRoute({
      summary: "Delete an experiment",
      operationId: "research.experiment.delete",
      responses: {
        200: {
          description: "Deleted",
          content: {
            "application/json": {
              schema: resolver(z.object({ success: z.boolean() })),
            },
          },
        },
        ...errors(404),
      },
    }),
    async (c) => {
      const expId = c.req.param("expId")
      const experiment = Database.use((db) =>
        db.select().from(ExperimentTable).where(eq(ExperimentTable.exp_id, expId)).get(),
      )
      if (!experiment) {
        return c.json({ success: false, message: `experiment not found: ${expId}` }, 404)
      }
      // Delete experiment watchers
      Database.use((db) => db.delete(ExperimentWatchTable).where(eq(ExperimentWatchTable.exp_id, expId)).run())
      Database.use((db) => db.delete(RemoteTaskTable).where(eq(RemoteTaskTable.exp_id, expId)).run())
      Database.use((db) =>
        db.delete(ExperimentExecutionWatchTable).where(eq(ExperimentExecutionWatchTable.exp_id, expId)).run(),
      )
      Database.use((db) => db.delete(ExperimentTable).where(eq(ExperimentTable.exp_id, expId)).run())
      if (experiment.exp_session_id) {
        await Session.remove(experiment.exp_session_id).catch(() => {})
      }
      // Delete experiment results directory
      const expDir = path.join(Instance.directory, "exp_results", expId)
      await rm(expDir, { recursive: true, force: true }).catch(() => {})
      // Remove experiment worktree and branch from the code repo
      if (experiment.exp_branch_name) {
        const baseRepo = path.resolve(experiment.code_path, "../..")
        await git(["worktree", "remove", experiment.code_path, "--force"], { cwd: baseRepo }).catch(() => {})
        await git(["branch", "-D", experiment.exp_branch_name], { cwd: baseRepo }).catch(() => {})
      }
      return c.json({ success: true })
    },
  )
  .post(
    "/project/:researchProjectId/export",
    describeRoute({
      summary: "Export research project",
      description: "Export research project to a zip file containing all data and files.",
      operationId: "research.project.export",
      responses: {
        200: {
          description: "Export successful",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  zip_path: z.string(),
                  zip_name: z.string(),
                  size: z.number(),
                }),
              ),
            },
          },
        },
        ...errors(404, 500),
      },
    }),
    async (c) => {
      const researchProjectId = c.req.param("researchProjectId")

      const researchProject = Database.use((db) =>
        db
          .select()
          .from(ResearchProjectTable)
          .where(eq(ResearchProjectTable.research_project_id, researchProjectId))
          .get(),
      )
      if (!researchProject) {
        return c.json({ success: false, message: "research project not found" }, 404)
      }

      const project = Project.get(researchProject.project_id)
      if (!project) {
        return c.json({ success: false, message: "project not found" }, 404)
      }

      try {
        // Collect all database records
        const atoms = Database.use((db) =>
          db.select().from(AtomTable).where(eq(AtomTable.research_project_id, researchProjectId)).all(),
        )
        const atomIds = atoms.map((a: any) => a.atom_id)

        let relations: (typeof AtomRelationTable.$inferSelect)[] = []
        if (atomIds.length > 0) {
          const allRelations = Database.use((db) => db.select().from(AtomRelationTable).all())
          relations = allRelations.filter(
            (r: any) => atomIds.includes(r.atom_id_source) || atomIds.includes(r.atom_id_target),
          )
        }

        const experiments = Database.use((db) =>
          db.select().from(ExperimentTable).where(eq(ExperimentTable.research_project_id, researchProjectId)).all(),
        )
        const articles = Database.use((db) =>
          db.select().from(ArticleTable).where(eq(ArticleTable.research_project_id, researchProjectId)).all(),
        )
        const codes = Database.use((db) =>
          db.select().from(CodeTable).where(eq(CodeTable.research_project_id, researchProjectId)).all(),
        )

        const remoteServerIds = [...new Set(experiments.map((e: any) => e.remote_server_id).filter(Boolean))] as string[]
        const remoteServers: (typeof RemoteServerTable.$inferSelect)[] = []
        for (const serverId of remoteServerIds) {
          const server = Database.use((db) =>
            db.select().from(RemoteServerTable).where(eq(RemoteServerTable.id, serverId)).get(),
          )
          if (server) remoteServers.push(server)
        }

        const expIds = experiments.map((e: any) => e.exp_id)
        const experimentWatches =
          expIds.length > 0
            ? Database.use((db) => db.select().from(ExperimentWatchTable).all()).filter((w: any) =>
                expIds.includes(w.exp_id),
              )
            : []
        const experimentExecutionWatches =
          expIds.length > 0
            ? Database.use((db) => db.select().from(ExperimentExecutionWatchTable).all()).filter((w: any) =>
                expIds.includes(w.exp_id),
              )
            : []
        const remoteTasks =
          expIds.length > 0
            ? Database.use((db) => db.select().from(RemoteTaskTable).all()).filter((w: any) => expIds.includes(w.exp_id))
            : []

        // Create metadata
        const metadata = {
          version: "1.0",
          exported_at: Date.now(),
          source_worktree: project.worktree,
          research_project: researchProject,
          atoms,
          atom_relations: relations,
          experiments,
          articles,
          codes,
          remote_servers: remoteServers,
          watches: {
            experiment_watches: experimentWatches,
            experiment_execution_watches: experimentExecutionWatches,
            remote_tasks: remoteTasks,
          },
        }

        // Create zip file
        const timestamp = Date.now()
        const projectName = path.basename(project.worktree).replace(/[^a-zA-Z0-9_-]/g, "_")
        const zipName = `${projectName}_export_${timestamp}.zip`
        const zipPath = path.join(path.dirname(project.worktree), zipName)

        const zipWriter = new ZipWriter(new BlobWriter())

        // Add metadata.json
        const metadataContent = new TextEncoder().encode(JSON.stringify(metadata, null, 2))
        await zipWriter.add("metadata.json", new BlobReader(new Blob([metadataContent])))

        // Add atom files
        for (const atom of atoms) {
          const atomDir = path.join(project.worktree, "atom_list", atom.atom_id)
          if (await Filesystem.exists(atomDir)) {
            const addAtomDir = async (dir: string, prefix: string) => {
              const entries = await fs.promises.readdir(dir, { withFileTypes: true })
              for (const entry of entries) {
                const fullPath = path.join(dir, entry.name)
                const entryZipPath = `${prefix}/${entry.name}`
                if (entry.isDirectory()) {
                  await addAtomDir(fullPath, entryZipPath)
                } else {
                  const content = await fs.promises.readFile(fullPath)
                  await zipWriter.add(entryZipPath, new BlobReader(new Blob([new Uint8Array(content)])))
                }
              }
            }
            await addAtomDir(atomDir, `atom_list/${atom.atom_id}`)
          }
        }

        // Add article files
        for (const article of articles) {
          if (await Filesystem.exists(article.path)) {
            if (await Filesystem.isDir(article.path)) {
              // Article is a directory (e.g. LaTeX source folder), add recursively
              const addArticleDir = async (dir: string, prefix: string) => {
                const entries = await fs.promises.readdir(dir, { withFileTypes: true })
                for (const entry of entries) {
                  const fullPath = path.join(dir, entry.name)
                  const entryZipPath = `${prefix}/${entry.name}`
                  if (entry.isDirectory()) {
                    await addArticleDir(fullPath, entryZipPath)
                  } else {
                    const content = await fs.promises.readFile(fullPath)
                    await zipWriter.add(entryZipPath, new BlobReader(new Blob([new Uint8Array(content)])))
                  }
                }
              }
              await addArticleDir(article.path, `articles/${path.basename(article.path)}`)
            } else {
              const content = await fs.promises.readFile(article.path)
              const filename = path.basename(article.path)
              await zipWriter.add(`articles/${filename}`, new BlobReader(new Blob([new Uint8Array(content)])))
            }
          }
        }

        // Add entire code directory (including .git, worktrees, etc.)
        const codeRootDir = path.join(project.worktree, "code")
        if (await Filesystem.exists(codeRootDir)) {
          const addDirToZip = async (dir: string, prefix: string) => {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true })
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name)
              const entryZipPath = `${prefix}/${entry.name}`
              if (entry.isDirectory()) {
                await addDirToZip(fullPath, entryZipPath)
              } else {
                const content = await fs.promises.readFile(fullPath)
                await zipWriter.add(entryZipPath, new BlobReader(new Blob([new Uint8Array(content)])))
              }
            }
          }
          await addDirToZip(codeRootDir, "code")
        }

        // Add experiment results
        for (const exp of experiments) {
          const expDir = path.join(project.worktree, "exp_results", exp.exp_id)
          if (await Filesystem.exists(expDir)) {
            const addDirectory = async (dir: string, prefix: string) => {
              const entries = await fs.promises.readdir(dir, { withFileTypes: true })
              for (const entry of entries) {
                const fullPath = path.join(dir, entry.name)
                const zipPath = path.join(prefix, entry.name)
                if (entry.isDirectory()) {
                  await addDirectory(fullPath, zipPath)
                } else {
                  const content = await fs.promises.readFile(fullPath)
                  await zipWriter.add(zipPath, new BlobReader(new Blob([new Uint8Array(content)])))
                }
              }
            }
            await addDirectory(expDir, `exp_results/${exp.exp_id}`)
          }
        }

        // Helper: recursively add a file or directory to zip
        const addPathToZip = async (fsPath: string, zipPrefix: string) => {
          if (await Filesystem.isDir(fsPath)) {
            const entries = await fs.promises.readdir(fsPath, { withFileTypes: true })
            for (const entry of entries) {
              const fullPath = path.join(fsPath, entry.name)
              const entryZipPath = `${zipPrefix}/${entry.name}`
              if (entry.isDirectory()) {
                await addPathToZip(fullPath, entryZipPath)
              } else {
                const content = await fs.promises.readFile(fullPath)
                await zipWriter.add(entryZipPath, new BlobReader(new Blob([new Uint8Array(content)])))
              }
            }
          } else {
            const content = await fs.promises.readFile(fsPath)
            await zipWriter.add(zipPrefix, new BlobReader(new Blob([new Uint8Array(content)])))
          }
        }

        // Add background.md and goal.md if they exist
        if (researchProject.background_path && (await Filesystem.exists(researchProject.background_path))) {
          await addPathToZip(researchProject.background_path, path.basename(researchProject.background_path))
        }
        if (researchProject.goal_path && (await Filesystem.exists(researchProject.goal_path))) {
          await addPathToZip(researchProject.goal_path, path.basename(researchProject.goal_path))
        }

        // Add .palimpsest-research.json
        const memoPath = path.join(project.worktree, ".palimpsest-research.json")
        if (await Filesystem.exists(memoPath)) {
          const content = await fs.promises.readFile(memoPath)
          await zipWriter.add(".palimpsest-research.json", new BlobReader(new Blob([new Uint8Array(content)])))
        }

        // Close and save zip
        const blob = await zipWriter.close()
        const buffer = await blob.arrayBuffer()
        await fs.promises.writeFile(zipPath, Buffer.from(buffer))

        return c.json({
          zip_path: zipPath,
          zip_name: zipName,
          size: buffer.byteLength,
        })
      } catch (err) {
        return c.json({ success: false, message: "export failed", error: `${err}` }, 500)
      }
    },
  )
