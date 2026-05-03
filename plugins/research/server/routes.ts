import path from "path"
import { describeRoute, resolver, validator } from "hono-openapi"
import { Hono } from "hono"
import z from "zod"
import { eq } from "drizzle-orm"
import type { SQLiteBunDatabase } from "drizzle-orm/bun-sqlite"
import fs from "fs"
import { rm } from "fs/promises"
import { ZipWriter, BlobReader, BlobWriter } from "@zip.js/zip.js"

import type {
  DomainChange,
  DomainEdge,
  DomainNode,
  PluginActor,
} from "@palimpsest/plugin-sdk/host"

import { bridge } from "./host-bridge"
import { ResearchProjectTable, atomKinds, evidenceStatuses, linkKinds, sourceStatuses } from "./research-schema"
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
  use: <T,>(cb: (db: SQLiteBunDatabase) => T): T => bridge().db.use(cb),
  transaction: <T,>(cb: () => T): T => bridge().db.transaction(cb),
}

const Domain = {
  listNodes: (input: { projectID: string; kind?: string }) => bridge().domain.listNodes(input),
  getNode: (id: string) => bridge().domain.getNode(id),
  listEdges: (input: { projectID: string; kind?: string }) => bridge().domain.listEdges(input),
  getEdge: (id: string) => bridge().domain.getEdge(id),
  ship: (input: {
    projectID: string
    actor: PluginActor
    changes: DomainChange[]
    title?: string
    rationale?: string
    refs?: Record<string, unknown>
    autoApprove?: boolean
    reviewComments?: string
  }) => bridge().domain.ship(input),
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

/**
 * UI routes are user-driven. We synthesize a `user` actor identifier
 * for the domain `ship()` call; the host's plugin shim does not yet
 * expose the request-scoped user, so for now every UI mutation is
 * tagged with a generic `user` id. When `host.actor.current()` is
 * extended to carry the auth-tier user id, this can be swapped out.
 */
function uiActor(): PluginActor {
  return { type: "user", id: "research-ui" }
}

type AtomData = {
  evidence_status: (typeof evidenceStatuses)[number]
  evidence?: string
  evidence_assessment?: string
  session_id?: string
}

function asAtomData(node: DomainNode): AtomData {
  const data = (node.data ?? {}) as Partial<AtomData>
  return {
    evidence_status: data.evidence_status ?? "pending",
    evidence: data.evidence,
    evidence_assessment: data.evidence_assessment,
    session_id: data.session_id,
  }
}

type SourceData = {
  parse_status: (typeof sourceStatuses)[number]
  source_url?: string
  path?: string
}

function asSourceData(node: DomainNode): SourceData {
  const data = (node.data ?? {}) as Partial<SourceData>
  return {
    parse_status: data.parse_status ?? "pending",
    source_url: data.source_url,
    path: data.path,
  }
}

function nodeToWireAtom(node: DomainNode) {
  const data = asAtomData(node)
  return {
    atom_id: node.id,
    research_project_id: node.projectID,
    atom_name: node.title,
    atom_type: node.kind,
    atom_claim_path: null as string | null,
    atom_evidence_status: data.evidence_status,
    atom_evidence_path: null as string | null,
    atom_evidence_assessment_path: null as string | null,
    source_id: null as string | null,
    session_id: data.session_id ?? null,
    time_created: node.time.created,
    time_updated: node.time.updated,
    claim: node.body ?? "",
    evidence: data.evidence ?? "",
    evidence_assessment: data.evidence_assessment ?? "",
  }
}

function edgeToWireRelation(edge: DomainEdge) {
  return {
    edge_id: edge.id,
    atom_id_source: edge.sourceID,
    atom_id_target: edge.targetID,
    relation_type: edge.kind,
    note: edge.note ?? null,
    time_created: edge.time.created,
    time_updated: edge.time.updated,
  }
}

async function copyFile(src: string, dest: string) {
  if (!(await Filesystem.exists(src))) throw new Error(`file not found: ${src}`)
  await fs.promises.cp(src, dest, { force: false, recursive: await Filesystem.isDir(src) })
}

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
  claim: z.string(),
  evidence: z.string(),
  evidence_assessment: z.string(),
})

const atomRelationSchema = z.object({
  edge_id: z.string(),
  atom_id_source: z.string(),
  atom_id_target: z.string(),
  relation_type: z.string(),
  note: z.string().nullable(),
  time_created: z.number(),
  time_updated: z.number(),
})

const atomCreateSchema = z.object({
  name: z.string().min(1, "name required"),
  type: z.enum(atomKinds),
})

const atomRelationCreateSchema = z.object({
  source_atom_id: z.string().min(1, "source atom required"),
  target_atom_id: z.string().min(1, "target atom required"),
  relation_type: z.enum(linkKinds),
  note: z.string().optional(),
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

async function listAtoms(projectID: string) {
  const out: DomainNode[] = []
  for (const kind of atomKinds) out.push(...(await Domain.listNodes({ projectID, kind })))
  return out
}

async function listAtomRelations(projectID: string) {
  const allowed = new Set<string>(linkKinds)
  return (await Domain.listEdges({ projectID })).filter((edge) => allowed.has(edge.kind))
}

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
          content: { "application/json": { schema: resolver(researchProjectSchema) } },
        },
        ...errors(404),
      },
    }),
    async (c) => {
      const projectId = c.req.param("projectId")
      let row = Database.use((db) =>
        db.select().from(ResearchProjectTable).where(eq(ResearchProjectTable.project_id, projectId)).get(),
      )

      if (!row) {
        try {
          let project: ReturnType<typeof Project.get>
          try {
            project = Project.get(projectId)
          } catch {
            project = undefined
          }
          if (project) {
            const memoPath = path.join(project.worktree, ".palimpsest-research.json")
            if (await Filesystem.exists(memoPath)) {
              const memo = await Filesystem.readJson<{ research_project_id: string; project_id: string }>(memoPath)
              const existingResearch = Database.use((db) =>
                db
                  .select()
                  .from(ResearchProjectTable)
                  .where(eq(ResearchProjectTable.research_project_id, memo.research_project_id))
                  .get(),
              )
              if (existingResearch) {
                Database.use((db) =>
                  db
                    .update(ResearchProjectTable)
                    .set({ project_id: projectId, time_updated: Date.now() })
                    .where(eq(ResearchProjectTable.research_project_id, memo.research_project_id))
                    .run(),
                )
                row = Database.use((db) =>
                  db.select().from(ResearchProjectTable).where(eq(ResearchProjectTable.project_id, projectId)).get(),
                )
              }
            }
          }
        } catch {
          /* recovery is best-effort */
        }
      }

      if (!row) return c.json({ success: false, message: "no research project for this project" }, 404)
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
                z.object({ atoms: z.array(atomSchema), relations: z.array(atomRelationSchema) }),
              ),
            },
          },
        },
        ...errors(400),
      },
    }),
    async (c) => {
      const researchProjectId = c.req.param("researchProjectId")
      const research = Database.use((db) =>
        db
          .select()
          .from(ResearchProjectTable)
          .where(eq(ResearchProjectTable.research_project_id, researchProjectId))
          .get(),
      )
      if (!research) return c.json({ atoms: [], relations: [] })

      const projectID = research.project_id
      const atoms = (await listAtoms(projectID)).map(nodeToWireAtom)
      const atomIds = new Set(atoms.map((a) => a.atom_id))
      const relations = (await listAtomRelations(projectID))
        .filter((edge) => atomIds.has(edge.sourceID) && atomIds.has(edge.targetID))
        .map(edgeToWireRelation)
      return c.json({ atoms, relations })
    },
  )
  .post(
    "/project/:researchProjectId/atom",
    describeRoute({
      summary: "Create atom",
      description: "Create a lightweight atom with an empty claim and evidence body.",
      operationId: "research.atom.create",
      responses: {
        200: {
          description: "Created atom",
          content: { "application/json": { schema: resolver(atomSchema) } },
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

      const data: AtomData = { evidence_status: "pending", evidence: "" }
      const result = await Domain.ship({
        projectID: project.project_id,
        actor: uiActor(),
        title: `UI created atom: ${body.name.trim()}`,
        changes: [
          {
            op: "create_node",
            kind: body.type,
            title: body.name.trim(),
            body: "# Claim\n",
            data: data as Record<string, unknown>,
          },
        ],
      })
      const atomId = result.commit?.changes
        .map((change) => (change.op === "create_node" && "id" in change ? change.id : undefined))
        .find((id): id is string => Boolean(id))
      if (!atomId) {
        return c.json({ success: false, message: `atom commit did not assign an id` }, 500)
      }
      const node = await Domain.getNode(atomId)
      return c.json(nodeToWireAtom(node))
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
          content: { "application/json": { schema: resolver(atomRelationSchema) } },
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

      const source = await Domain.getNode(body.source_atom_id).catch(() => undefined)
      if (!source || source.projectID !== project.project_id) {
        return c.json({ success: false, message: `source atom not found: ${body.source_atom_id}` }, 404)
      }
      const target = await Domain.getNode(body.target_atom_id).catch(() => undefined)
      if (!target || target.projectID !== project.project_id) {
        return c.json({ success: false, message: `target atom not found: ${body.target_atom_id}` }, 404)
      }

      const existing = (await listAtomRelations(project.project_id)).find(
        (edge) =>
          edge.sourceID === body.source_atom_id &&
          edge.targetID === body.target_atom_id &&
          edge.kind === body.relation_type,
      )
      if (existing) {
        return c.json({ success: false, message: "relation already exists" }, 400)
      }

      const result = await Domain.ship({
        projectID: project.project_id,
        actor: uiActor(),
        title: `UI link ${source.title} → ${target.title} (${body.relation_type})`,
        changes: [
          {
            op: "create_edge",
            kind: body.relation_type,
            sourceID: body.source_atom_id,
            targetID: body.target_atom_id,
            note: body.note,
          },
        ],
      })

      const edgeId = result.commit?.changes
        .map((change) => (change.op === "create_edge" && "id" in change ? change.id : undefined))
        .find((id): id is string => Boolean(id))
      if (!edgeId) return c.json({ success: false, message: "edge commit did not assign an id" }, 500)
      return c.json(edgeToWireRelation(await Domain.getEdge(edgeId)))
    },
  )
  .patch(
    "/project/:researchProjectId/relation",
    describeRoute({
      summary: "Update atom relation",
      description: "Change the kind of an existing directed relation between two atoms.",
      operationId: "research.relation.update",
      responses: {
        200: {
          description: "Updated relation",
          content: { "application/json": { schema: resolver(atomRelationSchema) } },
        },
        ...errors(400, 404),
      },
    }),
    validator("json", atomRelationUpdateSchema),
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
      if (!project) return c.json({ success: false, message: "research project not found" }, 404)

      const relations = await listAtomRelations(project.project_id)
      const existing = relations.find(
        (edge) =>
          edge.sourceID === body.source_atom_id &&
          edge.targetID === body.target_atom_id &&
          edge.kind === body.relation_type,
      )
      if (!existing) return c.json({ success: false, message: "relation not found" }, 404)

      if (body.next_relation_type === body.relation_type) {
        return c.json(edgeToWireRelation(existing))
      }

      const conflict = relations.find(
        (edge) =>
          edge.sourceID === body.source_atom_id &&
          edge.targetID === body.target_atom_id &&
          edge.kind === body.next_relation_type,
      )
      if (conflict) return c.json({ success: false, message: "relation already exists" }, 400)

      const result = await Domain.ship({
        projectID: project.project_id,
        actor: uiActor(),
        title: `UI retag relation`,
        changes: [{ op: "update_edge", id: existing.id, kind: body.next_relation_type }],
      })
      void result
      const updated = await Domain.getEdge(existing.id)
      return c.json(edgeToWireRelation(updated))
    },
  )
  .delete(
    "/project/:researchProjectId/relation",
    describeRoute({
      summary: "Delete atom relation",
      description: "Delete a directed relation between two atoms.",
      operationId: "research.relation.delete",
      responses: {
        200: {
          description: "Deleted relation",
          content: { "application/json": { schema: resolver(atomRelationDeleteResponseSchema) } },
        },
        ...errors(404),
      },
    }),
    validator("json", atomRelationDeleteSchema),
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
      if (!project) return c.json({ success: false, message: "research project not found" }, 404)

      const relations = await listAtomRelations(project.project_id)
      const existing = relations.find(
        (edge) =>
          edge.sourceID === body.source_atom_id &&
          edge.targetID === body.target_atom_id &&
          edge.kind === body.relation_type,
      )
      if (!existing) return c.json({ success: false, message: "relation not found" }, 404)

      await Domain.ship({
        projectID: project.project_id,
        actor: uiActor(),
        title: `UI delete relation`,
        changes: [{ op: "delete_edge", id: existing.id }],
      })

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
      description: "Delete one atom and all relations referencing it (cascaded by Edge.source_id/target_id).",
      operationId: "research.atom.delete",
      responses: {
        200: {
          description: "Deleted atom",
          content: { "application/json": { schema: resolver(atomDeleteResponseSchema) } },
        },
        ...errors(404),
      },
    }),
    async (c) => {
      const researchProjectId = c.req.param("researchProjectId")
      const atomId = c.req.param("atomId")
      const project = Database.use((db) =>
        db
          .select()
          .from(ResearchProjectTable)
          .where(eq(ResearchProjectTable.research_project_id, researchProjectId))
          .get(),
      )
      if (!project) return c.json({ success: false, message: "research project not found" }, 404)

      const node = await Domain.getNode(atomId).catch(() => undefined)
      if (!node || node.projectID !== project.project_id || !(atomKinds as readonly string[]).includes(node.kind)) {
        return c.json({ success: false, message: `atom not found: ${atomId}` }, 404)
      }
      const sessionId = asAtomData(node).session_id
      if (sessionId) await Session.remove(sessionId)

      await Domain.ship({
        projectID: project.project_id,
        actor: uiActor(),
        title: `UI delete atom: ${node.title}`,
        changes: [{ op: "delete_node", id: atomId }],
      })

      return c.json({ atom_id: atomId, deleted: true as const })
    },
  )
  .patch(
    "/research/:researchProjectId/atom/:atomId",
    describeRoute({
      summary: "Update an atom's mutable fields",
      operationId: "research.atom.update",
      responses: {
        200: {
          description: "Updated atom",
          content: { "application/json": { schema: resolver(atomSchema) } },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "json",
      z.object({
        evidence_status: z.enum(evidenceStatuses).optional(),
      }),
    ),
    async (c) => {
      const researchProjectId = c.req.param("researchProjectId")
      const atomId = c.req.param("atomId")
      const body = c.req.valid("json")
      const project = Database.use((db) =>
        db
          .select()
          .from(ResearchProjectTable)
          .where(eq(ResearchProjectTable.research_project_id, researchProjectId))
          .get(),
      )
      if (!project) return c.json({ success: false, message: "research project not found" }, 404)

      const node = await Domain.getNode(atomId).catch(() => undefined)
      if (!node || node.projectID !== project.project_id || !(atomKinds as readonly string[]).includes(node.kind)) {
        return c.json({ success: false, message: `atom not found: ${atomId}` }, 404)
      }

      if (!body.evidence_status) return c.json(nodeToWireAtom(node))

      const next: AtomData = { ...asAtomData(node), evidence_status: body.evidence_status }
      await Domain.ship({
        projectID: project.project_id,
        actor: uiActor(),
        title: `UI mark atom as ${body.evidence_status}`,
        changes: [
          {
            op: "update_node",
            id: atomId,
            data: next as Record<string, unknown>,
          },
        ],
      })
      const refreshed = await Domain.getNode(atomId)
      return c.json(nodeToWireAtom(refreshed))
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
      if (!project) return c.json({ success: false, message: "research project not found" }, 404)

      const sources = await Domain.listNodes({ projectID: project.project_id, kind: "source" })
      return c.json(
        sources.map((node) => {
          const data = asSourceData(node)
          const filename = data.path ? data.path.split("/").pop() ?? data.path : node.title
          return { source_id: node.id, filename, title: node.title }
        }),
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
      if (!project) return c.json({ success: false, message: "research project not found" }, 404)

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
      if (!projectInfo) return c.json({ success: false, message: "project not found" }, 404)
      const sourcesDir = path.join(projectInfo.worktree, "sources")
      await Filesystem.write(path.join(sourcesDir, ".keep"), "")

      const destPath = path.join(sourcesDir, path.basename(sourcePath))
      if (await Filesystem.exists(destPath)) {
        return c.json({ success: false, message: `source already exists: ${path.basename(sourcePath)}` }, 400)
      }
      await copyFile(sourcePath, destPath)

      const data: SourceData = { parse_status: "pending", source_url: body.sourceUrl, path: destPath }
      const result = await Domain.ship({
        projectID: project.project_id,
        actor: uiActor(),
        title: `UI added source: ${body.title ?? path.basename(destPath)}`,
        changes: [
          {
            op: "create_node",
            kind: "source",
            title: body.title ?? path.basename(destPath),
            body: "",
            data: data as Record<string, unknown>,
          },
        ],
      })
      const sourceId = result.commit?.changes
        .map((change) => (change.op === "create_node" && "id" in change ? change.id : undefined))
        .find((id): id is string => Boolean(id))
      if (!sourceId) return c.json({ success: false, message: "source commit did not assign an id" }, 500)

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
      const node = await Domain.getNode(atomId).catch(() => undefined)
      if (!node || !(atomKinds as readonly string[]).includes(node.kind)) {
        return c.json({ success: false, message: `atom not found: ${atomId}` }, 404)
      }
      const data = asAtomData(node)
      if (data.session_id) {
        const existing = await Session.get(data.session_id).catch(() => undefined)
        if (existing && !existing.time.archived) {
          return c.json({ session_id: data.session_id, created: false })
        }
      }

      const session = await Session.create({ title: `Atom: ${node.title}` })
      const next: AtomData = { ...data, session_id: session.id }
      await Domain.ship({
        projectID: node.projectID,
        actor: uiActor(),
        title: `UI bound session to atom: ${node.title}`,
        changes: [{ op: "update_node", id: node.id, data: next as Record<string, unknown> }],
      })
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
      if (!project) return c.json({ success: false, message: "research project not found" }, 404)

      const atoms = await listAtoms(project.project_id)
      const atomSessionIds: string[] = []
      const tree = atoms.map((node) => {
        const data = asAtomData(node)
        if (data.session_id) atomSessionIds.push(data.session_id)
        return {
          atom_id: node.id,
          atom_name: node.title,
          atom_type: node.kind,
          atom_evidence_status: data.evidence_status,
          session_id: data.session_id ?? null,
        }
      })
      return c.json({ atomSessionIds, atoms: tree })
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
      if (!researchProject) return c.json({ success: false, message: "research project not found" }, 404)
      const project = Project.get(researchProject.project_id)
      if (!project) return c.json({ success: false, message: "project not found" }, 404)

      try {
        const atomNodes = await listAtoms(project.id)
        const atomIds = new Set(atomNodes.map((n) => n.id))
        const relationEdges = (await listAtomRelations(project.id)).filter(
          (edge) => atomIds.has(edge.sourceID) && atomIds.has(edge.targetID),
        )

        const sources = atomNodes.filter((node) => node.kind === "source")
        const atomsForExport = atomNodes.map(nodeToWireAtom)
        const relationsForExport = relationEdges.map(edgeToWireRelation)

        const metadata = {
          version: "2.0",
          exported_at: Date.now(),
          source_worktree: project.worktree,
          research_project: researchProject,
          atoms: atomsForExport,
          atom_relations: relationsForExport,
          sources: sources.map((node) => ({
            source_id: node.id,
            title: node.title,
            ...asSourceData(node),
          })),
        }

        const timestamp = Date.now()
        const projectName = path.basename(project.worktree).replace(/[^a-zA-Z0-9_-]/g, "_")
        const zipName = `${projectName}_export_${timestamp}.zip`
        const zipPath = path.join(path.dirname(project.worktree), zipName)
        const zipWriter = new ZipWriter(new BlobWriter())

        const metadataContent = new TextEncoder().encode(JSON.stringify(metadata, null, 2))
        await zipWriter.add("metadata.json", new BlobReader(new Blob([metadataContent])))

        for (const node of sources) {
          const data = asSourceData(node)
          if (!data.path || !(await Filesystem.exists(data.path))) continue
          if (await Filesystem.isDir(data.path)) {
            const addDir = async (dir: string, prefix: string) => {
              const entries = await fs.promises.readdir(dir, { withFileTypes: true })
              for (const entry of entries) {
                const full = path.join(dir, entry.name)
                const zipPathEntry = `${prefix}/${entry.name}`
                if (entry.isDirectory()) await addDir(full, zipPathEntry)
                else {
                  const content = await fs.promises.readFile(full)
                  await zipWriter.add(zipPathEntry, new BlobReader(new Blob([new Uint8Array(content)])))
                }
              }
            }
            await addDir(data.path, `sources/${path.basename(data.path)}`)
          } else {
            const content = await fs.promises.readFile(data.path)
            const filename = path.basename(data.path)
            await zipWriter.add(`sources/${filename}`, new BlobReader(new Blob([new Uint8Array(content)])))
          }
        }

        const addPathToZip = async (fsPath: string, zipPrefix: string) => {
          if (await Filesystem.isDir(fsPath)) {
            const entries = await fs.promises.readdir(fsPath, { withFileTypes: true })
            for (const entry of entries) {
              const full = path.join(fsPath, entry.name)
              const zipPathEntry = `${zipPrefix}/${entry.name}`
              if (entry.isDirectory()) await addPathToZip(full, zipPathEntry)
              else {
                const content = await fs.promises.readFile(full)
                await zipWriter.add(zipPathEntry, new BlobReader(new Blob([new Uint8Array(content)])))
              }
            }
          } else {
            const content = await fs.promises.readFile(fsPath)
            await zipWriter.add(zipPrefix, new BlobReader(new Blob([new Uint8Array(content)])))
          }
        }

        if (researchProject.background_path && (await Filesystem.exists(researchProject.background_path))) {
          await addPathToZip(researchProject.background_path, path.basename(researchProject.background_path))
        }
        if (researchProject.goal_path && (await Filesystem.exists(researchProject.goal_path))) {
          await addPathToZip(researchProject.goal_path, path.basename(researchProject.goal_path))
        }

        const memoPath = path.join(project.worktree, ".palimpsest-research.json")
        if (await Filesystem.exists(memoPath)) {
          const content = await fs.promises.readFile(memoPath)
          await zipWriter.add(".palimpsest-research.json", new BlobReader(new Blob([new Uint8Array(content)])))
        }

        const blob = await zipWriter.close()
        const buffer = await blob.arrayBuffer()
        await fs.promises.writeFile(zipPath, Buffer.from(buffer))

        return c.json({ zip_path: zipPath, zip_name: zipName, size: buffer.byteLength })
      } catch (err) {
        return c.json({ success: false, message: "export failed", error: `${err}` }, 500)
      }
    },
  )

// Re-export `Research` and helpers so other modules — notably the
// import-boundary smoke test — can confirm routes do not reach into
// AtomTable/AtomRelationTable any more.
void Research
void uniqueID
void Instance
void rm
