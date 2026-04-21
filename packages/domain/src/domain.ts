import { NamedError } from "@palimpsest/shared/error"
import { fn } from "@palimpsest/shared/fn"
import { and, asc, eq } from "drizzle-orm"
import z from "zod"
import { Identifier } from "./identifier"
import {
  ArtifactTable,
  CommitTable,
  DecisionTable,
  EdgeTable,
  NodeTable,
  ProjectTaxonomyTable,
  ProposalTable,
  ReviewTable,
  RunTable,
  type TaxonomyData,
} from "./domain.sql"

type Json = Record<string, unknown>
type QueryDriver = {
  use<T>(callback: (db: any) => T): T
  transaction<T>(callback: () => T): T
}

export type DomainRuntimeConfig = {
  db: QueryDriver
  ensureProject: (projectID: string) => void
  countWorkspaces?: (projectID: string) => number
}

let runtime: DomainRuntimeConfig | undefined

function configured() {
  if (!runtime) throw new Error("Domain runtime is not configured")
  return runtime
}

function db() {
  return configured().db
}

function ensureProject(projectID: string) {
  configured().ensureProject(projectID)
}

function workspaceCount(projectID: string) {
  return configured().countWorkspaces?.(projectID) ?? 0
}

export namespace Domain {
  export const ProjectNotFoundError = NamedError.create(
    "DomainProjectNotFoundError",
    z.object({
      projectID: z.string(),
    }),
  )

  export const EntityNotFoundError = NamedError.create(
    "DomainEntityNotFoundError",
    z.object({
      entity: z.string(),
      id: z.string(),
    }),
  )

  export const CrossProjectError = NamedError.create(
    "DomainCrossProjectError",
    z.object({
      entity: z.string(),
      id: z.string(),
      projectID: z.string(),
    }),
  )

  export const InvalidTaxonomyError = NamedError.create(
    "DomainInvalidTaxonomyError",
    z.object({
      entity: z.string(),
      value: z.string(),
      allowed: z.array(z.string()),
    }),
  )

  export const AuthorizationError = NamedError.create(
    "DomainAuthorizationError",
    z.object({
      operation: z.string(),
      actorType: z.string(),
    }),
  )

  export const ProposerMismatchError = NamedError.create(
    "DomainProposerMismatchError",
    z.object({
      proposalID: z.string(),
    }),
  )

  const Json = z.record(z.string(), z.unknown())

  export const Taxonomy = z
    .object({
      nodeKinds: z.array(z.string()),
      edgeKinds: z.array(z.string()),
      runKinds: z.array(z.string()),
      artifactKinds: z.array(z.string()),
      decisionKinds: z.array(z.string()),
      decisionStates: z.array(z.string()),
    })
    .meta({
      ref: "DomainTaxonomy",
    })
  export type Taxonomy = z.infer<typeof Taxonomy>

  export const Node = z
    .object({
      id: Identifier.schema("node"),
      projectID: z.string(),
      kind: z.string(),
      title: z.string(),
      body: z.string().optional(),
      data: Json.optional(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .meta({
      ref: "DomainNode",
    })
  export type Node = z.infer<typeof Node>

  export const Edge = z
    .object({
      id: Identifier.schema("edge"),
      projectID: z.string(),
      kind: z.string(),
      sourceID: Identifier.schema("node"),
      targetID: Identifier.schema("node"),
      note: z.string().optional(),
      data: Json.optional(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .meta({
      ref: "DomainEdge",
    })
  export type Edge = z.infer<typeof Edge>

  export const Run = z
    .object({
      id: Identifier.schema("run"),
      projectID: z.string(),
      nodeID: Identifier.schema("node").optional(),
      sessionID: z.string().optional(),
      kind: z.string(),
      status: z.string(),
      title: z.string().optional(),
      actor: z.lazy(() => Actor).optional(),
      manifest: Json.optional(),
      startedAt: z.number().optional(),
      finishedAt: z.number().optional(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .meta({
      ref: "DomainRun",
    })
  export type Run = z.infer<typeof Run>

  export const Artifact = z
    .object({
      id: Identifier.schema("artifact"),
      projectID: z.string(),
      runID: Identifier.schema("run").optional(),
      nodeID: Identifier.schema("node").optional(),
      kind: z.string(),
      title: z.string().optional(),
      storageURI: z.string().optional(),
      mimeType: z.string().optional(),
      data: Json.optional(),
      provenance: Json.optional(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .meta({
      ref: "DomainArtifact",
    })
  export type Artifact = z.infer<typeof Artifact>

  export const Decision = z
    .object({
      id: Identifier.schema("decision"),
      projectID: z.string(),
      nodeID: Identifier.schema("node").optional(),
      runID: Identifier.schema("run").optional(),
      artifactID: Identifier.schema("artifact").optional(),
      kind: z.string(),
      state: z.string().optional(),
      rationale: z.string().optional(),
      actor: z.lazy(() => Actor).optional(),
      supersededBy: Identifier.schema("decision").optional(),
      data: Json.optional(),
      refs: Json.optional(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .meta({
      ref: "DomainDecision",
    })
  export type Decision = z.infer<typeof Decision>

  export const Graph = z
    .object({
      nodes: Node.array(),
      edges: Edge.array(),
      runs: Run.array(),
      artifacts: Artifact.array(),
      decisions: Decision.array(),
    })
    .meta({
      ref: "DomainGraph",
    })
  export type Graph = z.infer<typeof Graph>

  export const Summary = z
    .object({
      workspaces: z.number(),
      nodes: z.number(),
      edges: z.number(),
      runs: z.number(),
      artifacts: z.number(),
      decisions: z.number(),
      proposals: z.number(),
      reviews: z.number(),
      commits: z.number(),
    })
    .meta({
      ref: "DomainSummary",
    })
  export type Summary = z.infer<typeof Summary>

  export const Project = z
    .object({
      id: z.string(),
      worktree: z.string(),
      vcs: z.string().optional(),
      name: z.string().optional(),
      sandboxes: z.array(z.string()),
      time: z.object({
        created: z.number(),
        updated: z.number(),
        initialized: z.number().optional(),
      }),
    })
    .meta({
      ref: "DomainProject",
    })
  export type Project = z.infer<typeof Project>

  export const Workspace = z
    .object({
      id: Identifier.schema("workspace"),
      projectID: z.string(),
      type: z.string(),
      branch: z.string().nullable(),
      name: z.string().nullable(),
      directory: z.string().nullable(),
      extra: z.unknown().nullable(),
    })
    .meta({
      ref: "DomainWorkspace",
    })
  export type Workspace = z.infer<typeof Workspace>

  export const Context = z
    .object({
      project: Project,
      workspaces: Workspace.array(),
      taxonomy: Taxonomy,
      summary: Summary,
    })
    .meta({
      ref: "DomainContext",
    })
  export type Context = z.infer<typeof Context>

  function blank(): Taxonomy {
    return {
      nodeKinds: [],
      edgeKinds: [],
      runKinds: [],
      artifactKinds: [],
      decisionKinds: [],
      decisionStates: [],
    }
  }

  function stamp(created: number, updated: number) {
    return {
      created,
      updated,
    }
  }

  function maybeActor(type: string | null | undefined, id: string | null | undefined, version?: string | null) {
    if (!id) return
    return Actor.parse({
      type: type ?? "system",
      id,
      version: version ?? undefined,
    })
  }

  function fromTaxonomy(row: typeof ProjectTaxonomyTable.$inferSelect | undefined) {
    return Taxonomy.parse(row?.data ?? blank())
  }

  function fromNode(row: typeof NodeTable.$inferSelect): Node {
    return {
      id: row.id,
      projectID: row.project_id,
      kind: row.kind,
      title: row.title,
      body: row.body ?? undefined,
      data: row.data ?? undefined,
      time: stamp(row.time_created, row.time_updated),
    }
  }

  function fromEdge(row: typeof EdgeTable.$inferSelect): Edge {
    return {
      id: row.id,
      projectID: row.project_id,
      kind: row.kind,
      sourceID: row.source_id,
      targetID: row.target_id,
      note: row.note ?? undefined,
      data: row.data ?? undefined,
      time: stamp(row.time_created, row.time_updated),
    }
  }

  function fromRun(row: typeof RunTable.$inferSelect): Run {
    return {
      id: row.id,
      projectID: row.project_id,
      nodeID: row.node_id ?? undefined,
      sessionID: row.session_id ?? undefined,
      kind: row.kind,
      status: row.status,
      title: row.title ?? undefined,
      actor: maybeActor(row.triggered_by_actor_type, row.triggered_by_actor_id, row.triggered_by_actor_version),
      manifest: row.manifest ?? undefined,
      startedAt: row.started_at ?? undefined,
      finishedAt: row.finished_at ?? undefined,
      time: stamp(row.time_created, row.time_updated),
    }
  }

  function fromArtifact(row: typeof ArtifactTable.$inferSelect): Artifact {
    return {
      id: row.id,
      projectID: row.project_id,
      runID: row.run_id ?? undefined,
      nodeID: row.node_id ?? undefined,
      kind: row.kind,
      title: row.title ?? undefined,
      storageURI: row.storage_uri ?? undefined,
      mimeType: row.mime_type ?? undefined,
      data: row.data ?? undefined,
      provenance: row.provenance ?? undefined,
      time: stamp(row.time_created, row.time_updated),
    }
  }

  function fromDecision(row: typeof DecisionTable.$inferSelect): Decision {
    return {
      id: row.id,
      projectID: row.project_id,
      nodeID: row.node_id ?? undefined,
      runID: row.run_id ?? undefined,
      artifactID: row.artifact_id ?? undefined,
      kind: row.kind,
      state: row.state ?? undefined,
      rationale: row.rationale ?? undefined,
      actor: maybeActor(row.decided_by_actor_type, row.decided_by_actor_id, row.decided_by_actor_version),
      supersededBy: row.superseded_by ?? undefined,
      data: row.data ?? undefined,
      refs: row.refs ?? undefined,
      time: stamp(row.time_created, row.time_updated),
    }
  }

  function node(id: string) {
    const row = db().use((db) => db.select().from(NodeTable).where(eq(NodeTable.id, id)).get())
    if (!row) throw new EntityNotFoundError({ entity: "node", id })
    return row
  }

  function run(id: string) {
    const row = db().use((db) => db.select().from(RunTable).where(eq(RunTable.id, id)).get())
    if (!row) throw new EntityNotFoundError({ entity: "run", id })
    return row
  }

  function artifact(id: string) {
    const row = db().use((db) => db.select().from(ArtifactTable).where(eq(ArtifactTable.id, id)).get())
    if (!row) throw new EntityNotFoundError({ entity: "artifact", id })
    return row
  }

  function decision(id: string) {
    const row = db().use((db) => db.select().from(DecisionTable).where(eq(DecisionTable.id, id)).get())
    if (!row) throw new EntityNotFoundError({ entity: "decision", id })
    return row
  }

  function check(row: { project_id: string }, entity: string, id: string, projectID: string) {
    if (row.project_id !== projectID) {
      throw new CrossProjectError({
        entity,
        id,
        projectID,
      })
    }
  }

  function rule(list: string[], entity: string, value: string) {
    if (list.length === 0) return
    if (list.includes(value)) return
    throw new InvalidTaxonomyError({
      entity,
      value,
      allowed: list,
    })
  }

  function guard(actor: { type: string }, operation: string) {
    if (actor.type === "system") return
    throw new AuthorizationError({ operation, actorType: actor.type })
  }

  function kinds(projectID: string) {
    ensureProject(projectID)
    const row = db().use((db) => db.select().from(ProjectTaxonomyTable).where(eq(ProjectTaxonomyTable.project_id, projectID)).get())
    return fromTaxonomy(row)
  }

  export const taxonomy = fn(z.string(), async (projectID) => {
    return kinds(projectID)
  })

  export const setTaxonomy = fn(
    z.object({
      projectID: z.string(),
      nodeKinds: z.array(z.string()).optional(),
      edgeKinds: z.array(z.string()).optional(),
      runKinds: z.array(z.string()).optional(),
      artifactKinds: z.array(z.string()).optional(),
      decisionKinds: z.array(z.string()).optional(),
      decisionStates: z.array(z.string()).optional(),
    }),
    async (input) => {
      await ensureProject(input.projectID)
      const prev = await kinds(input.projectID)
      const next: TaxonomyData = {
        nodeKinds: input.nodeKinds ?? prev.nodeKinds,
        edgeKinds: input.edgeKinds ?? prev.edgeKinds,
        runKinds: input.runKinds ?? prev.runKinds,
        artifactKinds: input.artifactKinds ?? prev.artifactKinds,
        decisionKinds: input.decisionKinds ?? prev.decisionKinds,
        decisionStates: input.decisionStates ?? prev.decisionStates,
      }
      const now = Date.now()
      db().use((db) =>
        db
          .insert(ProjectTaxonomyTable)
          .values({
            project_id: input.projectID,
            time_created: now,
            time_updated: now,
            data: next,
          })
          .onConflictDoUpdate({
            target: ProjectTaxonomyTable.project_id,
            set: {
              data: next,
              time_updated: now,
            },
          })
          .run(),
      )
      return Taxonomy.parse(next)
    },
  )

  export const createNode = fn(
    z.object({
      id: Identifier.schema("node").optional(),
      projectID: z.string(),
      kind: z.string(),
      title: z.string(),
      body: z.string().optional(),
      data: Json.optional(),
      actor: z.lazy(() => Actor),
    }),
    async (input) => {
      guard(input.actor, "createNode")
      const info = await kinds(input.projectID)
      rule(info.nodeKinds, "node", input.kind)
      const id = Identifier.ascending("node", input.id)
      const now = Date.now()
      db().use((db) =>
        db
          .insert(NodeTable)
          .values({
            id,
            project_id: input.projectID,
            kind: input.kind,
            title: input.title,
            body: input.body,
            data: input.data,
            time_created: now,
            time_updated: now,
          })
          .run(),
      )
      return getNode.force(id)
    },
  )

  export const updateNode = fn(
    z.object({
      id: Identifier.schema("node"),
      kind: z.string().optional(),
      title: z.string().optional(),
      body: z.string().optional(),
      data: Json.optional(),
      actor: z.lazy(() => Actor),
    }),
    async (input) => {
      guard(input.actor, "updateNode")
      const row = node(input.id)
      const info = await kinds(row.project_id)
      if (input.kind) rule(info.nodeKinds, "node", input.kind)
      db().use((db) =>
        db
          .update(NodeTable)
          .set({
            kind: input.kind ?? row.kind,
            title: input.title ?? row.title,
            body: input.body ?? row.body,
            data: input.data ?? row.data,
            time_updated: Date.now(),
          })
          .where(eq(NodeTable.id, input.id))
          .run(),
      )
      return getNode.force(input.id)
    },
  )

  export const getNode = fn(Identifier.schema("node"), async (id) => {
    return fromNode(node(id))
  })

  export const listNodes = fn(
    z.object({
      projectID: z.string(),
      kind: z.string().optional(),
    }),
    async (input) => {
      await ensureProject(input.projectID)
      const rows = db().use((db) =>
        db
          .select()
          .from(NodeTable)
          .where(
            input.kind
              ? and(eq(NodeTable.project_id, input.projectID), eq(NodeTable.kind, input.kind))
              : eq(NodeTable.project_id, input.projectID),
          )
          .orderBy(asc(NodeTable.time_created))
          .all(),
      )
      return rows.map(fromNode)
    },
  )

  export const removeNode = fn(
    z.object({
      id: Identifier.schema("node"),
      actor: z.lazy(() => Actor),
    }),
    async (input) => {
      guard(input.actor, "removeNode")
      const info = fromNode(node(input.id))
      db().use((db) => db.delete(NodeTable).where(eq(NodeTable.id, input.id)).run())
      return info
    },
  )

  export const createEdge = fn(
    z.object({
      id: Identifier.schema("edge").optional(),
      projectID: z.string(),
      kind: z.string(),
      sourceID: Identifier.schema("node"),
      targetID: Identifier.schema("node"),
      note: z.string().optional(),
      data: Json.optional(),
      actor: z.lazy(() => Actor),
    }),
    async (input) => {
      guard(input.actor, "createEdge")
      const info = await kinds(input.projectID)
      rule(info.edgeKinds, "edge", input.kind)
      const source = node(input.sourceID)
      const target = node(input.targetID)
      check(source, "node", input.sourceID, input.projectID)
      check(target, "node", input.targetID, input.projectID)
      const id = Identifier.ascending("edge", input.id)
      const now = Date.now()
      db().use((db) =>
        db
          .insert(EdgeTable)
          .values({
            id,
            project_id: input.projectID,
            kind: input.kind,
            source_id: input.sourceID,
            target_id: input.targetID,
            note: input.note,
            data: input.data,
            time_created: now,
            time_updated: now,
          })
          .run(),
      )
      return getEdge.force(id)
    },
  )

  export const getEdge = fn(Identifier.schema("edge"), async (id) => {
    const row = db().use((db) => db.select().from(EdgeTable).where(eq(EdgeTable.id, id)).get())
    if (!row) throw new EntityNotFoundError({ entity: "edge", id })
    return fromEdge(row)
  })

  export const listEdges = fn(
    z.object({
      projectID: z.string(),
      kind: z.string().optional(),
    }),
    async (input) => {
      await ensureProject(input.projectID)
      const rows = db().use((db) =>
        db
          .select()
          .from(EdgeTable)
          .where(
            input.kind
              ? and(eq(EdgeTable.project_id, input.projectID), eq(EdgeTable.kind, input.kind))
              : eq(EdgeTable.project_id, input.projectID),
          )
          .orderBy(asc(EdgeTable.time_created))
          .all(),
      )
      return rows.map(fromEdge)
    },
  )

  export const updateEdge = fn(
    z.object({
      id: Identifier.schema("edge"),
      kind: z.string().optional(),
      sourceID: Identifier.schema("node").optional(),
      targetID: Identifier.schema("node").optional(),
      note: z.string().optional(),
      data: Json.optional(),
      actor: z.lazy(() => Actor),
    }),
    async (input) => {
      guard(input.actor, "updateEdge")
      const row = db().use((db) => db.select().from(EdgeTable).where(eq(EdgeTable.id, input.id)).get())
      if (!row) throw new EntityNotFoundError({ entity: "edge", id: input.id })
      const info = await kinds(row.project_id)
      const sourceID = input.sourceID ?? row.source_id
      const targetID = input.targetID ?? row.target_id
      if (input.kind) rule(info.edgeKinds, "edge", input.kind)
      check(node(sourceID), "node", sourceID, row.project_id)
      check(node(targetID), "node", targetID, row.project_id)
      db().use((db) =>
        db
          .update(EdgeTable)
          .set({
            kind: input.kind ?? row.kind,
            source_id: sourceID,
            target_id: targetID,
            note: input.note ?? row.note,
            data: input.data ?? row.data,
            time_updated: Date.now(),
          })
          .where(eq(EdgeTable.id, input.id))
          .run(),
      )
      return getEdge.force(input.id)
    },
  )

  export const removeEdge = fn(
    z.object({
      id: Identifier.schema("edge"),
      actor: z.lazy(() => Actor),
    }),
    async (input) => {
      guard(input.actor, "removeEdge")
      const info = await getEdge(input.id)
      db().use((db) => db.delete(EdgeTable).where(eq(EdgeTable.id, input.id)).run())
      return info
    },
  )

  export const createRun = fn(
    z.object({
      id: Identifier.schema("run").optional(),
      projectID: z.string(),
      nodeID: Identifier.schema("node").optional(),
      sessionID: z.string().optional(),
      kind: z.string(),
      status: z.string().default("pending"),
      title: z.string().optional(),
      actor: z.lazy(() => Actor),
      triggeredBy: z.lazy(() => Actor).optional(),
      manifest: Json.optional(),
      startedAt: z.number().optional(),
      finishedAt: z.number().optional(),
    }),
    async (input) => {
      guard(input.actor, "createRun")
      const info = await kinds(input.projectID)
      rule(info.runKinds, "run", input.kind)
      if (input.nodeID) check(node(input.nodeID), "node", input.nodeID, input.projectID)
      const actor = input.triggeredBy ?? input.actor
      const id = Identifier.ascending("run", input.id)
      const now = Date.now()
      db().use((db) =>
        db
          .insert(RunTable)
          .values({
            id,
            project_id: input.projectID,
            node_id: input.nodeID,
            session_id: input.sessionID,
            kind: input.kind,
            status: input.status,
            title: input.title,
            triggered_by_actor_type: actor?.type,
            triggered_by_actor_id: actor?.id,
            triggered_by_actor_version: actor?.version,
            manifest: input.manifest,
            started_at: input.startedAt,
            finished_at: input.finishedAt,
            time_created: now,
            time_updated: now,
          })
          .run(),
      )
      return getRun.force(id)
    },
  )

  export const updateRun = fn(
    z.object({
      id: Identifier.schema("run"),
      status: z.string().optional(),
      title: z.string().optional(),
      actor: z.lazy(() => Actor),
      triggeredBy: z.lazy(() => Actor).optional(),
      manifest: Json.optional(),
      startedAt: z.number().optional(),
      finishedAt: z.number().optional(),
    }),
    async (input) => {
      guard(input.actor, "updateRun")
      const row = run(input.id)
      const actor = input.triggeredBy ?? maybeActor(row.triggered_by_actor_type, row.triggered_by_actor_id, row.triggered_by_actor_version)
      db().use((db) =>
        db
          .update(RunTable)
          .set({
            status: input.status ?? row.status,
            title: input.title ?? row.title,
            triggered_by_actor_type: actor?.type ?? row.triggered_by_actor_type,
            triggered_by_actor_id: actor?.id ?? row.triggered_by_actor_id,
            triggered_by_actor_version: actor?.version ?? row.triggered_by_actor_version,
            manifest: input.manifest ?? row.manifest,
            started_at: input.startedAt ?? row.started_at,
            finished_at: input.finishedAt ?? row.finished_at,
            time_updated: Date.now(),
          })
          .where(eq(RunTable.id, input.id))
          .run(),
      )
      return getRun.force(input.id)
    },
  )

  export const getRun = fn(Identifier.schema("run"), async (id) => {
    return fromRun(run(id))
  })

  export const listRuns = fn(
    z.object({
      projectID: z.string(),
      kind: z.string().optional(),
      status: z.string().optional(),
    }),
    async (input) => {
      await ensureProject(input.projectID)
      const rows = db().use((db) =>
        db
          .select()
          .from(RunTable)
          .where(
            input.kind
              ? and(eq(RunTable.project_id, input.projectID), eq(RunTable.kind, input.kind))
              : input.status
                ? and(eq(RunTable.project_id, input.projectID), eq(RunTable.status, input.status))
                : eq(RunTable.project_id, input.projectID),
          )
          .orderBy(asc(RunTable.time_created))
          .all(),
      )
      return rows.map(fromRun)
    },
  )

  export const removeRun = fn(
    z.object({
      id: Identifier.schema("run"),
      actor: z.lazy(() => Actor),
    }),
    async (input) => {
      guard(input.actor, "removeRun")
      const info = await getRun(input.id)
      db().use((db) => db.delete(RunTable).where(eq(RunTable.id, input.id)).run())
      return info
    },
  )

  export const createArtifact = fn(
    z.object({
      id: Identifier.schema("artifact").optional(),
      projectID: z.string(),
      runID: Identifier.schema("run").optional(),
      nodeID: Identifier.schema("node").optional(),
      kind: z.string(),
      title: z.string().optional(),
      storageURI: z.string().optional(),
      mimeType: z.string().optional(),
      data: Json.optional(),
      provenance: Json.optional(),
      actor: z.lazy(() => Actor),
    }),
    async (input) => {
      guard(input.actor, "createArtifact")
      const info = await kinds(input.projectID)
      rule(info.artifactKinds, "artifact", input.kind)
      if (input.runID) check(run(input.runID), "run", input.runID, input.projectID)
      if (input.nodeID) check(node(input.nodeID), "node", input.nodeID, input.projectID)
      const id = Identifier.ascending("artifact", input.id)
      const now = Date.now()
      db().use((db) =>
        db
          .insert(ArtifactTable)
          .values({
            id,
            project_id: input.projectID,
            run_id: input.runID,
            node_id: input.nodeID,
            kind: input.kind,
            title: input.title,
            storage_uri: input.storageURI,
            mime_type: input.mimeType,
            data: input.data,
            provenance: input.provenance,
            time_created: now,
            time_updated: now,
          })
          .run(),
      )
      return getArtifact.force(id)
    },
  )

  export const getArtifact = fn(Identifier.schema("artifact"), async (id) => {
    return fromArtifact(artifact(id))
  })

  export const listArtifacts = fn(
    z.object({
      projectID: z.string(),
      kind: z.string().optional(),
    }),
    async (input) => {
      await ensureProject(input.projectID)
      const rows = db().use((db) =>
        db
          .select()
          .from(ArtifactTable)
          .where(
            input.kind
              ? and(eq(ArtifactTable.project_id, input.projectID), eq(ArtifactTable.kind, input.kind))
              : eq(ArtifactTable.project_id, input.projectID),
          )
          .orderBy(asc(ArtifactTable.time_created))
          .all(),
      )
      return rows.map(fromArtifact)
    },
  )

  export const updateArtifact = fn(
    z.object({
      id: Identifier.schema("artifact"),
      runID: Identifier.schema("run").optional(),
      nodeID: Identifier.schema("node").optional(),
      kind: z.string().optional(),
      title: z.string().optional(),
      storageURI: z.string().optional(),
      mimeType: z.string().optional(),
      data: Json.optional(),
      provenance: Json.optional(),
      actor: z.lazy(() => Actor),
    }),
    async (input) => {
      guard(input.actor, "updateArtifact")
      const row = artifact(input.id)
      const info = await kinds(row.project_id)
      const runID = input.runID ?? row.run_id ?? undefined
      const nodeID = input.nodeID ?? row.node_id ?? undefined
      if (input.kind) rule(info.artifactKinds, "artifact", input.kind)
      if (runID) check(run(runID), "run", runID, row.project_id)
      if (nodeID) check(node(nodeID), "node", nodeID, row.project_id)
      db().use((db) =>
        db
          .update(ArtifactTable)
          .set({
            run_id: runID,
            node_id: nodeID,
            kind: input.kind ?? row.kind,
            title: input.title ?? row.title,
            storage_uri: input.storageURI ?? row.storage_uri,
            mime_type: input.mimeType ?? row.mime_type,
            data: input.data ?? row.data,
            provenance: input.provenance ?? row.provenance,
            time_updated: Date.now(),
          })
          .where(eq(ArtifactTable.id, input.id))
          .run(),
      )
      return getArtifact.force(input.id)
    },
  )

  export const removeArtifact = fn(
    z.object({
      id: Identifier.schema("artifact"),
      actor: z.lazy(() => Actor),
    }),
    async (input) => {
      guard(input.actor, "removeArtifact")
      const info = await getArtifact(input.id)
      db().use((db) => db.delete(ArtifactTable).where(eq(ArtifactTable.id, input.id)).run())
      return info
    },
  )

  export const createDecision = fn(
    z.object({
      id: Identifier.schema("decision").optional(),
      projectID: z.string(),
      nodeID: Identifier.schema("node").optional(),
      runID: Identifier.schema("run").optional(),
      artifactID: Identifier.schema("artifact").optional(),
      kind: z.string(),
      state: z.string().optional(),
      rationale: z.string().optional(),
      actor: z.lazy(() => Actor),
      decidedBy: z.lazy(() => Actor).optional(),
      supersededBy: Identifier.schema("decision").optional(),
      data: Json.optional(),
      refs: Json.optional(),
    }),
    async (input) => {
      guard(input.actor, "createDecision")
      const info = await kinds(input.projectID)
      rule(info.decisionKinds, "decision", input.kind)
      if (input.state) rule(info.decisionStates, "decision_state", input.state)
      if (input.nodeID) check(node(input.nodeID), "node", input.nodeID, input.projectID)
      if (input.runID) check(run(input.runID), "run", input.runID, input.projectID)
      if (input.artifactID) check(artifact(input.artifactID), "artifact", input.artifactID, input.projectID)
      if (input.supersededBy) check(decision(input.supersededBy), "decision", input.supersededBy, input.projectID)
      const actor = input.decidedBy ?? input.actor
      const id = Identifier.ascending("decision", input.id)
      const now = Date.now()
      db().use((db) =>
        db
          .insert(DecisionTable)
          .values({
            id,
            project_id: input.projectID,
            node_id: input.nodeID,
            run_id: input.runID,
            artifact_id: input.artifactID,
            kind: input.kind,
            state: input.state,
            rationale: input.rationale,
            decided_by_actor_type: actor?.type,
            decided_by_actor_id: actor?.id,
            decided_by_actor_version: actor?.version,
            superseded_by: input.supersededBy,
            data: input.data,
            refs: input.refs,
            time_created: now,
            time_updated: now,
          })
          .run(),
      )
      return getDecision.force(id)
    },
  )

  export const updateDecision = fn(
    z.object({
      id: Identifier.schema("decision"),
      state: z.string().optional(),
      rationale: z.string().optional(),
      actor: z.lazy(() => Actor),
      decidedBy: z.lazy(() => Actor).optional(),
      supersededBy: Identifier.schema("decision").optional(),
      data: Json.optional(),
      refs: Json.optional(),
    }),
    async (input) => {
      guard(input.actor, "updateDecision")
      const row = decision(input.id)
      const info = await kinds(row.project_id)
      if (input.state) rule(info.decisionStates, "decision_state", input.state)
      if (input.supersededBy) check(decision(input.supersededBy), "decision", input.supersededBy, row.project_id)
      const actor = input.decidedBy ?? maybeActor(row.decided_by_actor_type, row.decided_by_actor_id, row.decided_by_actor_version)
      db().use((db) =>
        db
          .update(DecisionTable)
          .set({
            state: input.state ?? row.state,
            rationale: input.rationale ?? row.rationale,
            decided_by_actor_type: actor?.type ?? row.decided_by_actor_type,
            decided_by_actor_id: actor?.id ?? row.decided_by_actor_id,
            decided_by_actor_version: actor?.version ?? row.decided_by_actor_version,
            superseded_by: input.supersededBy ?? row.superseded_by,
            data: input.data ?? row.data,
            refs: input.refs ?? row.refs,
            time_updated: Date.now(),
          })
          .where(eq(DecisionTable.id, input.id))
          .run(),
      )
      return getDecision.force(input.id)
    },
  )

  export const getDecision = fn(Identifier.schema("decision"), async (id) => {
    return fromDecision(decision(id))
  })

  export const listDecisions = fn(
    z.object({
      projectID: z.string(),
      kind: z.string().optional(),
      state: z.string().optional(),
    }),
    async (input) => {
      await ensureProject(input.projectID)
      const rows = db().use((db) =>
        db
          .select()
          .from(DecisionTable)
          .where(
            input.kind
              ? and(eq(DecisionTable.project_id, input.projectID), eq(DecisionTable.kind, input.kind))
              : input.state
                ? and(eq(DecisionTable.project_id, input.projectID), eq(DecisionTable.state, input.state))
                : eq(DecisionTable.project_id, input.projectID),
          )
          .orderBy(asc(DecisionTable.time_created))
          .all(),
      )
      return rows.map(fromDecision)
    },
  )

  export const removeDecision = fn(
    z.object({
      id: Identifier.schema("decision"),
      actor: z.lazy(() => Actor),
    }),
    async (input) => {
      guard(input.actor, "removeDecision")
      const info = await getDecision(input.id)
      db().use((db) => db.delete(DecisionTable).where(eq(DecisionTable.id, input.id)).run())
      return info
    },
  )

  export const graph = fn(z.string(), async (projectID) => {
    return Graph.parse({
      nodes: await listNodes.force({ projectID }),
      edges: await listEdges.force({ projectID }),
      runs: await listRuns.force({ projectID }),
      artifacts: await listArtifacts.force({ projectID }),
      decisions: await listDecisions.force({ projectID }),
    })
  })

  export const summary = fn(z.string(), async (projectID) => {
    const data = await graph.force(projectID)
    const workspaces = await workspaceCount(projectID)
    const proposals = await listProposals.force({ projectID })
    const reviews = await listReviews.force({ projectID })
    const commits = await listCommits.force({ projectID })
    return Summary.parse({
      workspaces,
      nodes: data.nodes.length,
      edges: data.edges.length,
      runs: data.runs.length,
      artifacts: data.artifacts.length,
      decisions: data.decisions.length,
      proposals: proposals.length,
      reviews: reviews.length,
      commits: commits.length,
    })
  })

  export const Actor = z
    .object({
      type: z.enum(["user", "agent", "system"]),
      id: z.string(),
      version: z.string().optional(),
    })
    .meta({
      ref: "DomainActor",
    })
  export type Actor = z.infer<typeof Actor>

  export const ProposalStatus = z.enum(["pending", "approved", "rejected", "withdrawn"])
  export type ProposalStatus = z.infer<typeof ProposalStatus>

  export const ReviewVerdict = z.enum(["approve", "reject", "request_changes"])
  export type ReviewVerdict = z.infer<typeof ReviewVerdict>

  export const Change = z
    .discriminatedUnion("op", [
      z.object({
        op: z.literal("create_node"),
        id: Identifier.schema("node").optional(),
        kind: z.string(),
        title: z.string(),
        body: z.string().optional(),
        data: Json.optional(),
      }),
      z.object({
        op: z.literal("update_node"),
        id: Identifier.schema("node"),
        kind: z.string().optional(),
        title: z.string().optional(),
        body: z.string().optional(),
        data: Json.optional(),
      }),
      z.object({
        op: z.literal("delete_node"),
        id: Identifier.schema("node"),
      }),
      z.object({
        op: z.literal("create_edge"),
        id: Identifier.schema("edge").optional(),
        kind: z.string(),
        sourceID: Identifier.schema("node"),
        targetID: Identifier.schema("node"),
        note: z.string().optional(),
        data: Json.optional(),
      }),
      z.object({
        op: z.literal("update_edge"),
        id: Identifier.schema("edge"),
        kind: z.string().optional(),
        sourceID: Identifier.schema("node").optional(),
        targetID: Identifier.schema("node").optional(),
        note: z.string().optional(),
        data: Json.optional(),
      }),
      z.object({
        op: z.literal("delete_edge"),
        id: Identifier.schema("edge"),
      }),
      z.object({
        op: z.literal("create_run"),
        id: Identifier.schema("run").optional(),
        nodeID: Identifier.schema("node").optional(),
        sessionID: z.string().optional(),
        kind: z.string(),
        status: z.string().default("pending"),
        title: z.string().optional(),
        actor: z.lazy(() => Actor).optional(),
        actorID: z.string().optional(),
        manifest: Json.optional(),
        startedAt: z.number().optional(),
        finishedAt: z.number().optional(),
      }),
      z.object({
        op: z.literal("update_run"),
        id: Identifier.schema("run"),
        status: z.string().optional(),
        title: z.string().optional(),
        actor: z.lazy(() => Actor).optional(),
        actorID: z.string().optional(),
        manifest: Json.optional(),
        startedAt: z.number().optional(),
        finishedAt: z.number().optional(),
      }),
      z.object({
        op: z.literal("delete_run"),
        id: Identifier.schema("run"),
      }),
      z.object({
        op: z.literal("create_artifact"),
        id: Identifier.schema("artifact").optional(),
        runID: Identifier.schema("run").optional(),
        nodeID: Identifier.schema("node").optional(),
        kind: z.string(),
        title: z.string().optional(),
        storageURI: z.string().optional(),
        mimeType: z.string().optional(),
        data: Json.optional(),
        provenance: Json.optional(),
      }),
      z.object({
        op: z.literal("update_artifact"),
        id: Identifier.schema("artifact"),
        runID: Identifier.schema("run").optional(),
        nodeID: Identifier.schema("node").optional(),
        kind: z.string().optional(),
        title: z.string().optional(),
        storageURI: z.string().optional(),
        mimeType: z.string().optional(),
        data: Json.optional(),
        provenance: Json.optional(),
      }),
      z.object({
        op: z.literal("delete_artifact"),
        id: Identifier.schema("artifact"),
      }),
      z.object({
        op: z.literal("create_decision"),
        id: Identifier.schema("decision").optional(),
        nodeID: Identifier.schema("node").optional(),
        runID: Identifier.schema("run").optional(),
        artifactID: Identifier.schema("artifact").optional(),
        kind: z.string(),
        state: z.string().optional(),
        rationale: z.string().optional(),
        actor: z.lazy(() => Actor).optional(),
        actorID: z.string().optional(),
        supersededBy: Identifier.schema("decision").optional(),
        data: Json.optional(),
        refs: Json.optional(),
      }),
      z.object({
        op: z.literal("update_decision"),
        id: Identifier.schema("decision"),
        state: z.string().optional(),
        rationale: z.string().optional(),
        actor: z.lazy(() => Actor).optional(),
        actorID: z.string().optional(),
        supersededBy: Identifier.schema("decision").optional(),
        data: Json.optional(),
        refs: Json.optional(),
      }),
      z.object({
        op: z.literal("delete_decision"),
        id: Identifier.schema("decision"),
      }),
    ])
    .meta({
      ref: "DomainChange",
    })
  export type Change = z.infer<typeof Change>

  export const Proposal = z
    .object({
      id: Identifier.schema("proposal"),
      projectID: z.string(),
      title: z.string().optional(),
      status: ProposalStatus,
      revision: z.number().int().min(1),
      actor: Actor,
      changes: Change.array(),
      rationale: z.string().optional(),
      refs: Json.optional(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .meta({
      ref: "DomainProposal",
    })
  export type Proposal = z.infer<typeof Proposal>

  export const Review = z
    .object({
      id: Identifier.schema("review"),
      projectID: z.string(),
      proposalID: Identifier.schema("proposal"),
      actor: Actor,
      verdict: ReviewVerdict,
      comments: z.string().optional(),
      refs: Json.optional(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .meta({
      ref: "DomainReview",
    })
  export type Review = z.infer<typeof Review>

  export const Commit = z
    .object({
      id: Identifier.schema("commit"),
      projectID: z.string(),
      proposalID: Identifier.schema("proposal").optional(),
      reviewID: Identifier.schema("review").optional(),
      actor: Actor,
      changes: Change.array(),
      refs: Json.optional(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .meta({
      ref: "DomainCommit",
    })
  export type Commit = z.infer<typeof Commit>

  export const ReviewResult = z
    .object({
      proposal: Proposal,
      review: Review,
      commit: Commit.optional(),
    })
    .meta({
      ref: "DomainReviewResult",
    })
  export type ReviewResult = z.infer<typeof ReviewResult>

  export const ProposalStateError = NamedError.create(
    "DomainProposalStateError",
    z.object({
      proposalID: z.string(),
      status: ProposalStatus,
    }),
  )

  function actor(type: string, id: string, version?: string) {
    return Actor.parse({
      type,
      id,
      version: version ?? undefined,
    })
  }

  function fromProposal(row: typeof ProposalTable.$inferSelect): Proposal {
    return {
      id: row.id,
      projectID: row.project_id,
      title: row.title ?? undefined,
      status: ProposalStatus.parse(row.status),
      revision: row.revision,
      actor: actor(row.proposed_by_actor_type, row.proposed_by_actor_id, row.proposed_by_actor_version ?? undefined),
      changes: z.array(Change).parse(row.changes),
      rationale: row.rationale ?? undefined,
      refs: row.refs ?? undefined,
      time: stamp(row.time_created, row.time_updated),
    }
  }

  function fromReview(row: typeof ReviewTable.$inferSelect): Review {
    return {
      id: row.id,
      projectID: row.project_id,
      proposalID: row.proposal_id,
      actor: actor(row.reviewer_actor_type, row.reviewer_actor_id, row.reviewer_actor_version ?? undefined),
      verdict: ReviewVerdict.parse(row.verdict),
      comments: row.comments ?? undefined,
      refs: row.refs ?? undefined,
      time: stamp(row.time_created, row.time_updated),
    }
  }

  function fromCommit(row: typeof CommitTable.$inferSelect): Commit {
    return {
      id: row.id,
      projectID: row.project_id,
      proposalID: row.proposal_id ?? undefined,
      reviewID: row.review_id ?? undefined,
      actor: actor(row.committed_by_actor_type, row.committed_by_actor_id, row.committed_by_actor_version ?? undefined),
      changes: z.array(Change).parse(row.applied_changes),
      refs: row.refs ?? undefined,
      time: stamp(row.time_created, row.time_updated),
    }
  }

  function proposal(id: string) {
    const row = db().use((db) => db.select().from(ProposalTable).where(eq(ProposalTable.id, id)).get())
    if (!row) throw new EntityNotFoundError({ entity: "proposal", id })
    return row
  }

  function review(id: string) {
    const row = db().use((db) => db.select().from(ReviewTable).where(eq(ReviewTable.id, id)).get())
    if (!row) throw new EntityNotFoundError({ entity: "review", id })
    return row
  }

  function commit(id: string) {
    const row = db().use((db) => db.select().from(CommitTable).where(eq(CommitTable.id, id)).get())
    if (!row) throw new EntityNotFoundError({ entity: "commit", id })
    return row
  }

  function apply(projectID: string, raw: Change): Change {
    const now = Date.now()
    const info = kinds(projectID)

    switch (raw.op) {
      case "create_node": {
        rule(info.nodeKinds, "node", raw.kind)
        const id = Identifier.ascending("node", raw.id)
        db().use((db) =>
          db
            .insert(NodeTable)
            .values({
              id,
              project_id: projectID,
              kind: raw.kind,
              title: raw.title,
              body: raw.body,
              data: raw.data,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        return { ...raw, id }
      }
      case "update_node": {
        const row = node(raw.id)
        check(row, "node", raw.id, projectID)
        if (raw.kind) rule(info.nodeKinds, "node", raw.kind)
        db().use((db) =>
          db
            .update(NodeTable)
            .set({
              kind: raw.kind ?? row.kind,
              title: raw.title ?? row.title,
              body: raw.body ?? row.body,
              data: raw.data ?? row.data,
              time_updated: now,
            })
            .where(eq(NodeTable.id, raw.id))
            .run(),
        )
        return raw
      }
      case "delete_node": {
        check(node(raw.id), "node", raw.id, projectID)
        db().use((db) => db.delete(NodeTable).where(eq(NodeTable.id, raw.id)).run())
        return raw
      }
      case "create_edge": {
        rule(info.edgeKinds, "edge", raw.kind)
        check(node(raw.sourceID), "node", raw.sourceID, projectID)
        check(node(raw.targetID), "node", raw.targetID, projectID)
        const id = Identifier.ascending("edge", raw.id)
        db().use((db) =>
          db
            .insert(EdgeTable)
            .values({
              id,
              project_id: projectID,
              kind: raw.kind,
              source_id: raw.sourceID,
              target_id: raw.targetID,
              note: raw.note,
              data: raw.data,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        return { ...raw, id }
      }
      case "update_edge": {
        const row = db().use((db) => db.select().from(EdgeTable).where(eq(EdgeTable.id, raw.id)).get())
        if (!row) throw new EntityNotFoundError({ entity: "edge", id: raw.id })
        check(row, "edge", raw.id, projectID)
        const sourceID = raw.sourceID ?? row.source_id
        const targetID = raw.targetID ?? row.target_id
        if (raw.kind) rule(info.edgeKinds, "edge", raw.kind)
        check(node(sourceID), "node", sourceID, projectID)
        check(node(targetID), "node", targetID, projectID)
        db().use((db) =>
          db
            .update(EdgeTable)
            .set({
              kind: raw.kind ?? row.kind,
              source_id: sourceID,
              target_id: targetID,
              note: raw.note ?? row.note,
              data: raw.data ?? row.data,
              time_updated: now,
            })
            .where(eq(EdgeTable.id, raw.id))
            .run(),
        )
        return raw
      }
      case "delete_edge": {
        const row = db().use((db) => db.select().from(EdgeTable).where(eq(EdgeTable.id, raw.id)).get())
        if (!row) throw new EntityNotFoundError({ entity: "edge", id: raw.id })
        check(row, "edge", raw.id, projectID)
        db().use((db) => db.delete(EdgeTable).where(eq(EdgeTable.id, raw.id)).run())
        return raw
      }
      case "create_run": {
        rule(info.runKinds, "run", raw.kind)
        if (raw.nodeID) check(node(raw.nodeID), "node", raw.nodeID, projectID)
        const actor = raw.actor ?? maybeActor("system", raw.actorID)
        const id = Identifier.ascending("run", raw.id)
        db().use((db) =>
          db
            .insert(RunTable)
            .values({
              id,
              project_id: projectID,
              node_id: raw.nodeID,
              session_id: raw.sessionID,
              kind: raw.kind,
              status: raw.status,
              title: raw.title,
              triggered_by_actor_type: actor?.type,
              triggered_by_actor_id: actor?.id,
              triggered_by_actor_version: actor?.version,
              manifest: raw.manifest,
              started_at: raw.startedAt,
              finished_at: raw.finishedAt,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        return { ...raw, id }
      }
      case "update_run": {
        const row = run(raw.id)
        check(row, "run", raw.id, projectID)
        const actor = raw.actor ?? maybeActor(row.triggered_by_actor_type, raw.actorID, row.triggered_by_actor_version)
        db().use((db) =>
          db
            .update(RunTable)
            .set({
              status: raw.status ?? row.status,
              title: raw.title ?? row.title,
              triggered_by_actor_type: actor?.type ?? row.triggered_by_actor_type,
              triggered_by_actor_id: actor?.id ?? row.triggered_by_actor_id,
              triggered_by_actor_version: actor?.version ?? row.triggered_by_actor_version,
              manifest: raw.manifest ?? row.manifest,
              started_at: raw.startedAt ?? row.started_at,
              finished_at: raw.finishedAt ?? row.finished_at,
              time_updated: now,
            })
            .where(eq(RunTable.id, raw.id))
            .run(),
        )
        return raw
      }
      case "delete_run": {
        check(run(raw.id), "run", raw.id, projectID)
        db().use((db) => db.delete(RunTable).where(eq(RunTable.id, raw.id)).run())
        return raw
      }
      case "create_artifact": {
        rule(info.artifactKinds, "artifact", raw.kind)
        if (raw.runID) check(run(raw.runID), "run", raw.runID, projectID)
        if (raw.nodeID) check(node(raw.nodeID), "node", raw.nodeID, projectID)
        const id = Identifier.ascending("artifact", raw.id)
        db().use((db) =>
          db
            .insert(ArtifactTable)
            .values({
              id,
              project_id: projectID,
              run_id: raw.runID,
              node_id: raw.nodeID,
              kind: raw.kind,
              title: raw.title,
              storage_uri: raw.storageURI,
              mime_type: raw.mimeType,
              data: raw.data,
              provenance: raw.provenance,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        return { ...raw, id }
      }
      case "update_artifact": {
        const row = artifact(raw.id)
        check(row, "artifact", raw.id, projectID)
        const runID = raw.runID ?? row.run_id ?? undefined
        const nodeID = raw.nodeID ?? row.node_id ?? undefined
        if (raw.kind) rule(info.artifactKinds, "artifact", raw.kind)
        if (runID) check(run(runID), "run", runID, projectID)
        if (nodeID) check(node(nodeID), "node", nodeID, projectID)
        db().use((db) =>
          db
            .update(ArtifactTable)
            .set({
              run_id: runID,
              node_id: nodeID,
              kind: raw.kind ?? row.kind,
              title: raw.title ?? row.title,
              storage_uri: raw.storageURI ?? row.storage_uri,
              mime_type: raw.mimeType ?? row.mime_type,
              data: raw.data ?? row.data,
              provenance: raw.provenance ?? row.provenance,
              time_updated: now,
            })
            .where(eq(ArtifactTable.id, raw.id))
            .run(),
        )
        return raw
      }
      case "delete_artifact": {
        check(artifact(raw.id), "artifact", raw.id, projectID)
        db().use((db) => db.delete(ArtifactTable).where(eq(ArtifactTable.id, raw.id)).run())
        return raw
      }
      case "create_decision": {
        rule(info.decisionKinds, "decision", raw.kind)
        if (raw.state) rule(info.decisionStates, "decision_state", raw.state)
        if (raw.nodeID) check(node(raw.nodeID), "node", raw.nodeID, projectID)
        if (raw.runID) check(run(raw.runID), "run", raw.runID, projectID)
        if (raw.artifactID) check(artifact(raw.artifactID), "artifact", raw.artifactID, projectID)
        if (raw.supersededBy) check(decision(raw.supersededBy), "decision", raw.supersededBy, projectID)
        const actor = raw.actor ?? maybeActor("system", raw.actorID)
        const id = Identifier.ascending("decision", raw.id)
        db().use((db) =>
          db
            .insert(DecisionTable)
            .values({
              id,
              project_id: projectID,
              node_id: raw.nodeID,
              run_id: raw.runID,
              artifact_id: raw.artifactID,
              kind: raw.kind,
              state: raw.state,
              rationale: raw.rationale,
              decided_by_actor_type: actor?.type,
              decided_by_actor_id: actor?.id,
              decided_by_actor_version: actor?.version,
              superseded_by: raw.supersededBy,
              data: raw.data,
              refs: raw.refs,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        return { ...raw, id }
      }
      case "update_decision": {
        const row = decision(raw.id)
        check(row, "decision", raw.id, projectID)
        if (raw.state) rule(info.decisionStates, "decision_state", raw.state)
        if (raw.supersededBy) check(decision(raw.supersededBy), "decision", raw.supersededBy, projectID)
        const actor = raw.actor ?? maybeActor(row.decided_by_actor_type, raw.actorID, row.decided_by_actor_version)
        db().use((db) =>
          db
            .update(DecisionTable)
            .set({
              state: raw.state ?? row.state,
              rationale: raw.rationale ?? row.rationale,
              decided_by_actor_type: actor?.type ?? row.decided_by_actor_type,
              decided_by_actor_id: actor?.id ?? row.decided_by_actor_id,
              decided_by_actor_version: actor?.version ?? row.decided_by_actor_version,
              superseded_by: raw.supersededBy ?? row.superseded_by,
              data: raw.data ?? row.data,
              refs: raw.refs ?? row.refs,
              time_updated: now,
            })
            .where(eq(DecisionTable.id, raw.id))
            .run(),
        )
        return raw
      }
      case "delete_decision": {
        check(decision(raw.id), "decision", raw.id, projectID)
        db().use((db) => db.delete(DecisionTable).where(eq(DecisionTable.id, raw.id)).run())
        return raw
      }
    }
  }

  export const propose = fn(
    z.object({
      id: Identifier.schema("proposal").optional(),
      projectID: z.string(),
      title: z.string().optional(),
      actor: Actor,
      changes: Change.array().min(1),
      rationale: z.string().optional(),
      refs: Json.optional(),
    }),
    async (input) => {
      await ensureProject(input.projectID)
      const id = Identifier.ascending("proposal", input.id)
      const now = Date.now()
      db().use((db) =>
        db
          .insert(ProposalTable)
          .values({
            id,
            project_id: input.projectID,
            title: input.title,
            status: "pending",
            proposed_by_actor_type: input.actor.type,
            proposed_by_actor_id: input.actor.id,
            proposed_by_actor_version: input.actor.version,
            changes: input.changes as Record<string, unknown>[],
            rationale: input.rationale,
            refs: input.refs,
            time_created: now,
            time_updated: now,
          })
          .run(),
      )
      return getProposal.force(id)
    },
  )

  export const getProposal = fn(Identifier.schema("proposal"), async (id) => {
    return fromProposal(proposal(id))
  })

  export const listProposals = fn(
    z.object({
      projectID: z.string(),
      status: ProposalStatus.optional(),
    }),
    async (input) => {
      await ensureProject(input.projectID)
      const rows = db().use((db) =>
        db
          .select()
          .from(ProposalTable)
          .where(
            input.status
              ? and(eq(ProposalTable.project_id, input.projectID), eq(ProposalTable.status, input.status))
              : eq(ProposalTable.project_id, input.projectID),
          )
          .orderBy(asc(ProposalTable.time_created))
          .all(),
      )
      return rows.map(fromProposal)
    },
  )

  export const withdrawProposal = fn(
    z.object({
      id: Identifier.schema("proposal"),
      actor: Actor,
    }),
    async (input) => {
      const row = proposal(input.id)
      const status = ProposalStatus.parse(row.status)
      if (status !== "pending") throw new ProposalStateError({ proposalID: input.id, status })
      if (input.actor.type !== "system" && input.actor.id !== row.proposed_by_actor_id) {
        throw new ProposerMismatchError({ proposalID: input.id })
      }
      db().use((db) =>
        db
          .update(ProposalTable)
          .set({
            status: "withdrawn",
            time_updated: Date.now(),
          })
          .where(eq(ProposalTable.id, input.id))
          .run(),
      )
      return getProposal.force(input.id)
    },
  )

  export const reviseProposal = fn(
    z.object({
      id: Identifier.schema("proposal"),
      actor: Actor,
      changes: Change.array().min(1).optional(),
      title: z.string().optional(),
      rationale: z.string().optional(),
      refs: Json.optional(),
    }),
    async (input) => {
      const row = proposal(input.id)
      const status = ProposalStatus.parse(row.status)
      if (status !== "pending") throw new ProposalStateError({ proposalID: input.id, status })
      if (input.actor.type !== "system" && input.actor.id !== row.proposed_by_actor_id) {
        throw new ProposerMismatchError({ proposalID: input.id })
      }
      const now = Date.now()
      db().use((db) =>
        db
          .update(ProposalTable)
          .set({
            title: input.title ?? row.title,
            changes: (input.changes ?? z.array(Change).parse(row.changes)) as Record<string, unknown>[],
            rationale: input.rationale ?? row.rationale,
            refs: input.refs ?? row.refs,
            revision: row.revision + 1,
            time_updated: now,
          })
          .where(eq(ProposalTable.id, input.id))
          .run(),
      )
      return getProposal.force(input.id)
    },
  )

  export const reviewProposal = fn(
    z.object({
      id: Identifier.schema("review").optional(),
      proposalID: Identifier.schema("proposal"),
      actor: Actor,
      verdict: ReviewVerdict,
      comments: z.string().optional(),
      refs: Json.optional(),
    }),
    async (input) => {
      const item = proposal(input.proposalID)
      const status = ProposalStatus.parse(item.status)
      if (status !== "pending") throw new ProposalStateError({ proposalID: input.proposalID, status })

      return db().transaction(() => {
        const now = Date.now()
        const reviewID = Identifier.ascending("review", input.id)

        db().use((db) =>
          db
            .insert(ReviewTable)
            .values({
              id: reviewID,
              project_id: item.project_id,
              proposal_id: input.proposalID,
              reviewer_actor_type: input.actor.type,
              reviewer_actor_id: input.actor.id,
              reviewer_actor_version: input.actor.version,
              verdict: input.verdict,
              comments: input.comments,
              refs: input.refs,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )

        let next = item.status
        let commitID: string | undefined

        if (input.verdict === "approve") {
          const changes = z.array(Change).parse(item.changes)
          const applied = changes.map((change) => apply(item.project_id, change))
          commitID = Identifier.ascending("commit")
          const row: typeof CommitTable.$inferInsert = {
            id: commitID,
            project_id: item.project_id,
            proposal_id: item.id,
            review_id: reviewID,
            committed_by_actor_type: input.actor.type,
            committed_by_actor_id: input.actor.id,
            committed_by_actor_version: input.actor.version,
            applied_changes: applied as Record<string, unknown>[],
            refs: item.refs,
            time_created: now,
            time_updated: now,
          }
          db().use((db) =>
            db
              .insert(CommitTable)
              .values(row)
              .run(),
          )
          next = "approved"
        }

        if (input.verdict === "reject") next = "rejected"
        if (input.verdict === "request_changes") next = "pending"

        db().use((db) =>
          db
            .update(ProposalTable)
            .set({
              status: next,
              time_updated: now,
            })
            .where(eq(ProposalTable.id, input.proposalID))
            .run(),
        )

        return ReviewResult.parse({
          proposal: fromProposal(proposal(input.proposalID)),
          review: fromReview(review(reviewID)),
          commit: commitID ? fromCommit(commit(commitID)) : undefined,
        })
      })
    },
  )

  export const getReview = fn(Identifier.schema("review"), async (id) => {
    return fromReview(review(id))
  })

  export const listReviews = fn(
    z.object({
      projectID: z.string(),
      proposalID: Identifier.schema("proposal").optional(),
    }),
    async (input) => {
      await ensureProject(input.projectID)
      const rows = db().use((db) =>
        db
          .select()
          .from(ReviewTable)
          .where(
            input.proposalID
              ? and(eq(ReviewTable.project_id, input.projectID), eq(ReviewTable.proposal_id, input.proposalID))
              : eq(ReviewTable.project_id, input.projectID),
          )
          .orderBy(asc(ReviewTable.time_created))
          .all(),
      )
      return rows.map(fromReview)
    },
  )

  export const getCommit = fn(Identifier.schema("commit"), async (id) => {
    return fromCommit(commit(id))
  })

  export const listCommits = fn(
    z.object({
      projectID: z.string(),
      proposalID: Identifier.schema("proposal").optional(),
    }),
    async (input) => {
      await ensureProject(input.projectID)
      const rows = db().use((db) =>
        db
          .select()
          .from(CommitTable)
          .where(
            input.proposalID
              ? and(eq(CommitTable.project_id, input.projectID), eq(CommitTable.proposal_id, input.proposalID))
              : eq(CommitTable.project_id, input.projectID),
          )
          .orderBy(asc(CommitTable.time_created))
          .all(),
      )
      return rows.map(fromCommit)
    },
  )
}

export function configureDomain(input: DomainRuntimeConfig) {
  runtime = input
  return Domain
}
