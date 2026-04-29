import { describeRoute, resolver, validator } from "hono-openapi"
import { Hono } from "hono"
import z from "zod"
import path from "path"
import { and, eq } from "drizzle-orm"
import fs from "fs"
import { rm } from "fs/promises"
import { ZipWriter, BlobReader, BlobWriter } from "@zip.js/zip.js"
import { bridge } from "./host-bridge"
import {
  ResearchProjectTable,
  SourceTable,
  AtomTable,
  AtomRelationTable,
  linkKinds,
} from "./research-schema"
import { Research } from "./research"

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
 * Check whether a directory looks like a single source (e.g. LaTeX project)
 * rather than a container that holds multiple sources.
 *
 * A directory is considered a source if it contains at least one `.tex` file at
 * the top level.  A directory that only contains `.pdf` files or sub-directories
 * (but no `.tex` files) is treated as a container folder — not a single source.
 */
async function isSourceDirectory(dir: string): Promise<boolean> {
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
  atom_evidence_status: z.string(),
  atom_evidence_path: z.string().nullable(),
  atom_evidence_assessment_path: z.string().nullable(),
  source_id: z.string().nullable(),
  session_id: z.string().nullable(),
  time_created: z.number(),
  time_updated: z.number(),
})

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
  type: z.enum(["question", "hypothesis", "claim", "finding", "source"]),
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
            atom_evidence_status: "pending",
            atom_evidence_path: evidencePath,
            atom_evidence_assessment_path: evidenceAssessmentPath,
            source_id: null,
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
        evidence_status: z.enum(["pending", "in_progress", "supported", "refuted"]).optional(),
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

      Database.use((db) => db.update(AtomTable).set(updates).where(eq(AtomTable.atom_id, atomId)).run())

      await Bus.publish(Research.Event.AtomsUpdated, { researchProjectId })

      const updated = Database.use((db) => db.select().from(AtomTable).where(eq(AtomTable.atom_id, atomId)).get())!
      return c.json(updated)
    },
  )
  .get(
    "/project/:researchProjectId/sources",
    describeRoute({
      summary: "List sources for a research project",
      description: "Return source IDs and file names for a research project, useful for dropdown selectors.",
      operationId: "research.source.list",
      responses: {
        200: {
          description: "List of sources",
          content: {
            "application/json": {
              schema: resolver(
                z.array(
                  z.object({
                    source_id: z.string(),
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
      const sources = Database.use((db) =>
        db.select().from(SourceTable).where(eq(SourceTable.research_project_id, researchProjectId)).all(),
      )
      return c.json(
        sources.map((s: any) => ({
          source_id: s.source_id,
          filename: s.path.split("/").pop() ?? s.path,
          title: s.title,
        })),
      )
    },
  )
  .post(
    "/project/:researchProjectId/source",
    describeRoute({
      summary: "Add source to research project",
      description: "Add a single knowledge source (paper/PDF/LaTeX directory) to an existing research project.",
      operationId: "research.source.create",
      responses: {
        200: {
          description: "Created source",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  source_id: z.string(),
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
        if (!(await isSourceDirectory(sourcePath))) {
          return c.json(
            {
              success: false,
              message:
                `"${path.basename(sourcePath)}" looks like a folder containing sources, not a single source. ` +
                `Please select individual PDF files or LaTeX source folders instead.`,
            },
            400,
          )
        }
      } else if (path.extname(sourcePath).toLowerCase() !== ".pdf") {
        return c.json({ success: false, message: `unsupported source: ${body.sourcePath}` }, 400)
      }

      const projectInfo = Project.get(project.project_id)
      if (!projectInfo) {
        return c.json({ success: false, message: "project not found" }, 404)
      }
      const sourcesDir = path.join(projectInfo.worktree, "sources")
      await Filesystem.write(path.join(sourcesDir, ".keep"), "")

      const destPath = path.join(sourcesDir, path.basename(sourcePath))
      if (await Filesystem.exists(destPath)) {
        return c.json({ success: false, message: `source already exists: ${path.basename(sourcePath)}` }, 400)
      }

      await copyFile(sourcePath, destPath)

      const now = Date.now()
      const sourceId = uniqueID()

      Database.use((db) =>
        db
          .insert(SourceTable)
          .values({
            source_id: sourceId,
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
        source_id: sourceId,
        path: destPath,
        title: body.title ?? null,
        source_url: body.sourceUrl ?? null,
      })
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
    "/project/:researchProjectId/session-tree",
    describeRoute({
      summary: "Get session tree for research project",
      description:
        "Returns atoms with their linked sessions, plus the list of atom session IDs for filtering from the normal session list.",
      operationId: "research.project.sessionTree",
      responses: {
        200: {
          description: "Session tree",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  atomSessionIds: z.array(z.string()),
                  atoms: z.array(
                    z.object({
                      atom_id: z.string(),
                      atom_name: z.string(),
                      atom_type: z.string(),
                      atom_evidence_status: z.string(),
                      session_id: z.string().nullable(),
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

      const atomSessionIds: string[] = []
      for (const atom of atoms) {
        if (atom.session_id) atomSessionIds.push(atom.session_id)
      }

      const atomTree = atoms.map((atom: any) => ({
        atom_id: atom.atom_id,
        atom_name: atom.atom_name,
        atom_type: atom.atom_type,
        atom_evidence_status: atom.atom_evidence_status,
        session_id: atom.session_id,
      }))

      return c.json({
        atomSessionIds,
        atoms: atomTree,
      })
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

        const sources = Database.use((db) =>
          db.select().from(SourceTable).where(eq(SourceTable.research_project_id, researchProjectId)).all(),
        )

        // Create metadata
        const metadata = {
          version: "1.0",
          exported_at: Date.now(),
          source_worktree: project.worktree,
          research_project: researchProject,
          atoms,
          atom_relations: relations,
          sources,
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

        // Add source files
        for (const source of sources) {
          if (await Filesystem.exists(source.path)) {
            if (await Filesystem.isDir(source.path)) {
              // Source is a directory (e.g. LaTeX source folder), add recursively
              const addSourceDir = async (dir: string, prefix: string) => {
                const entries = await fs.promises.readdir(dir, { withFileTypes: true })
                for (const entry of entries) {
                  const fullPath = path.join(dir, entry.name)
                  const entryZipPath = `${prefix}/${entry.name}`
                  if (entry.isDirectory()) {
                    await addSourceDir(fullPath, entryZipPath)
                  } else {
                    const content = await fs.promises.readFile(fullPath)
                    await zipWriter.add(entryZipPath, new BlobReader(new Blob([new Uint8Array(content)])))
                  }
                }
              }
              await addSourceDir(source.path, `sources/${path.basename(source.path)}`)
            } else {
              const content = await fs.promises.readFile(source.path)
              const filename = path.basename(source.path)
              await zipWriter.add(`sources/${filename}`, new BlobReader(new Blob([new Uint8Array(content)])))
            }
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
