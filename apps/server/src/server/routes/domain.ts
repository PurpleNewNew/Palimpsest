import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Domain } from "../../domain/domain"
import { Bus } from "../../bus"
import { Identifier } from "../../id/id"
import { Instance } from "../../project/instance"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { ControlPlane } from "@/control-plane/control-plane"

const Json = z.record(z.string(), z.unknown())

const SYSTEM: z.infer<typeof Domain.Actor> = {
  type: "system",
  id: "accepted_bridge",
}

const Meta = z.object({
  author: Domain.Actor.optional(),
  proposalTitle: z.string().optional(),
  rationale: z.string().optional(),
  refs: Json.optional(),
  autoApprove: z.boolean().optional(),
})

function author(input: z.infer<typeof Domain.Actor> | undefined) {
  return input ?? ControlPlane.actor() ?? {
    type: "system" as const,
    id: "domain_api",
  }
}

function title(input: string | undefined, fallback: string) {
  return input ?? fallback
}

/**
 * Actor-based autoApprove policy (see `specs/domain.md` Decision 1):
 *
 * - `actor.type === "agent"` → always `false`. Safety invariant: AI /
 *   workflow output must go through human review, even if the caller
 *   explicitly requests auto-approve.
 * - `actor.type === "user" | "system"` → defaults to `true` (user and
 *   host-bootstrap writes auto-commit with an audit trail). Callers may
 *   still explicitly pass `autoApprove: false` to stage the write as a
 *   pending proposal.
 */
function shouldAutoApprove(
  actor: z.infer<typeof Domain.Actor>,
  requested: boolean | undefined,
): boolean {
  if (actor.type === "agent") return false
  return requested ?? true
}

/**
 * Review + commit a proposal and publish the corresponding bus events.
 * Caller must already have published `ProposalCreated`. Returns the
 * committed proposal (status `"approved"`).
 */
async function autoCommit(
  proposal: z.infer<typeof Domain.Proposal>,
  actor: z.infer<typeof Domain.Actor>,
  note: string,
) {
  const result = await Domain.reviewProposal({
    proposalID: proposal.id,
    actor,
    verdict: "approve",
    comments: note,
  })
  await Bus.publish(Domain.Event.ProposalReviewed, result)
  if (result.commit) await Bus.publish(Domain.Event.ProposalCommitted, result.commit)
  return result.proposal
}

async function queued(
  input: z.infer<typeof Meta>,
  change: z.infer<typeof Domain.Change>,
  fallback: string,
) {
  const actor = author(input.author)
  const proposal = await Domain.propose({
    projectID: Instance.project.id,
    title: title(input.proposalTitle, fallback),
    actor,
    rationale: input.rationale,
    refs: input.refs,
    changes: [change],
  })
  await Bus.publish(Domain.Event.ProposalCreated, proposal)
  if (!shouldAutoApprove(actor, input.autoApprove)) return proposal
  return autoCommit(proposal, actor, "Auto-approved in ship mode.")
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

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

async function guardDomainWrite(): Promise<Response | undefined> {
  const auth = ControlPlane.current()
  if (!auth) return unauthorized()
  const role = await ControlPlane.allowProject({
    userID: auth.user.id,
    projectID: Instance.project.id,
    need: "editor",
  })
  if (!role) return forbidden()
  return undefined
}

export const DomainRoutes = lazy(() => {
  const app = new Hono()
  const accepted = new Hono()

  app.use("*", async (c, next) => {
    if (READ_ONLY_METHODS.has(c.req.method)) return next()
    const guard = await guardDomainWrite()
    if (guard) return guard
    return next()
  })

  accepted.use("*", async (c, next) => {
    if (READ_ONLY_METHODS.has(c.req.method)) return next()
    const guard = await guardDomainWrite()
    if (guard) return guard
    return next()
  })

  app.get(
    "/project",
    describeRoute({
      summary: "Get project context",
      description: "Return the current project's domain-facing project record.",
      operationId: "domain.project.get",
      responses: {
        200: {
          description: "Project",
          content: {
            "application/json": {
              schema: resolver(Domain.Project),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    async (c) => {
      return c.json(await Domain.getProject(Instance.project.id))
    },
  )

  app.get(
    "/workspace",
    describeRoute({
      summary: "List workspaces",
      description: "Return workspaces attached to the current project.",
      operationId: "domain.workspace.list",
      responses: {
        200: {
          description: "Workspaces",
          content: {
            "application/json": {
              schema: resolver(Domain.Workspace.array()),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    async (c) => {
      return c.json(await Domain.listWorkspaces(Instance.project.id))
    },
  )

  app.get(
    "/context",
    describeRoute({
      summary: "Get domain context",
      description: "Return project, workspace, taxonomy, and summary data for the current project.",
      operationId: "domain.context",
      responses: {
        200: {
          description: "Domain context",
          content: {
            "application/json": {
              schema: resolver(Domain.Context),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    async (c) => {
      return c.json(await Domain.context(Instance.project.id))
    },
  )

  app.get(
    "/taxonomy",
    describeRoute({
      summary: "Get project taxonomy",
      description: "Return the active taxonomy rules for the current project.",
      operationId: "domain.taxonomy",
      responses: {
        200: {
          description: "Project taxonomy",
          content: {
            "application/json": {
              schema: resolver(Domain.Taxonomy),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    async (c) => {
      return c.json(await Domain.taxonomy(Instance.project.id))
    },
  )

  app.put(
    "/taxonomy",
    describeRoute({
      summary: "Update project taxonomy",
      description: "Patch the active taxonomy rules for the current project.",
      operationId: "domain.taxonomy.update",
      responses: {
        200: {
          description: "Updated taxonomy",
          content: {
            "application/json": {
              schema: resolver(Domain.Taxonomy),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator("json", Domain.setTaxonomy.schema.omit({ projectID: true })),
    async (c) => {
      const body = c.req.valid("json")
      return c.json(
        await Domain.setTaxonomy({
          projectID: Instance.project.id,
          ...body,
        }),
      )
    },
  )

  app.get(
    "/summary",
    describeRoute({
      summary: "Get domain summary",
      description: "Return aggregate counts for the current project's core domain entities and collaboration history.",
      operationId: "domain.summary",
      responses: {
        200: {
          description: "Domain summary",
          content: {
            "application/json": {
              schema: resolver(Domain.Summary),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    async (c) => {
      return c.json(await Domain.summary(Instance.project.id))
    },
  )

  app.get(
    "/graph",
    describeRoute({
      summary: "Get project graph",
      description: "Return the current project's accepted nodes, edges, runs, artifacts, and decisions.",
      operationId: "domain.graph",
      responses: {
        200: {
          description: "Project graph",
          content: {
            "application/json": {
              schema: resolver(Domain.Graph),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    async (c) => {
      return c.json(await Domain.graph(Instance.project.id))
    },
  )

  app.get(
    "/node",
    describeRoute({
      summary: "List nodes",
      description: "List accepted nodes in the current project.",
      operationId: "domain.node.list",
      responses: {
        200: {
          description: "Nodes",
          content: {
            "application/json": {
              schema: resolver(Domain.Node.array()),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "query",
      z.object({
        kind: z.string().optional(),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query")
      return c.json(
        await Domain.listNodes({
          projectID: Instance.project.id,
          kind: query.kind,
        }),
      )
    },
  )

  app.post(
    "/node",
    describeRoute({
      summary: "Propose node creation",
      description: "Create a proposal to add a node to accepted state.",
      operationId: "domain.node.proposeCreate",
      responses: {
        200: {
          description: "Queued proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator("json", Domain.createNode.schema.omit({ projectID: true, actor: true }).extend(Meta.shape)),
    async (c) => {
      const body = c.req.valid("json")
      const { author, proposalTitle, rationale, refs, autoApprove, ...change } = body
      return c.json(
        await queued(
          { author, proposalTitle, rationale, refs, autoApprove },
          {
            op: "create_node",
            ...change,
          },
          `Create node ${change.title}`,
        ),
      )
    },
  )

  app.patch(
    "/node/:nodeID",
    describeRoute({
      summary: "Propose node update",
      description: "Create a proposal to update a node in accepted state.",
      operationId: "domain.node.proposeUpdate",
      responses: {
        200: {
          description: "Queued proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        nodeID: Identifier.schema("node"),
      }),
    ),
    validator("json", Domain.updateNode.schema.omit({ id: true, actor: true }).extend(Meta.shape)),
    async (c) => {
      const nodeID = c.req.valid("param").nodeID
      const body = c.req.valid("json")
      const { author, proposalTitle, rationale, refs, autoApprove, ...change } = body
      return c.json(
        await queued(
          { author, proposalTitle, rationale, refs, autoApprove },
          {
            op: "update_node",
            id: nodeID,
            ...change,
          },
          `Update node ${nodeID}`,
        ),
      )
    },
  )

  app.delete(
    "/node/:nodeID",
    describeRoute({
      summary: "Propose node deletion",
      description: "Create a proposal to delete a node from accepted state.",
      operationId: "domain.node.proposeDelete",
      responses: {
        200: {
          description: "Queued proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        nodeID: Identifier.schema("node"),
      }),
    ),
    validator("json", Meta),
    async (c) => {
      const nodeID = c.req.valid("param").nodeID
      const body = c.req.valid("json")
      return c.json(
        await queued(
          body,
          {
            op: "delete_node",
            id: nodeID,
          },
          `Delete node ${nodeID}`,
        ),
      )
    },
  )

  app.get(
    "/edge",
    describeRoute({
      summary: "List edges",
      description: "List accepted edges in the current project.",
      operationId: "domain.edge.list",
      responses: {
        200: {
          description: "Edges",
          content: {
            "application/json": {
              schema: resolver(Domain.Edge.array()),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "query",
      z.object({
        kind: z.string().optional(),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query")
      return c.json(
        await Domain.listEdges({
          projectID: Instance.project.id,
          kind: query.kind,
        }),
      )
    },
  )

  app.post(
    "/edge",
    describeRoute({
      summary: "Propose edge creation",
      description: "Create a proposal to add an edge to accepted state.",
      operationId: "domain.edge.proposeCreate",
      responses: {
        200: {
          description: "Queued proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator("json", Domain.createEdge.schema.omit({ projectID: true, actor: true }).extend(Meta.shape)),
    async (c) => {
      const body = c.req.valid("json")
      const { author, proposalTitle, rationale, refs, autoApprove, ...change } = body
      return c.json(
        await queued(
          { author, proposalTitle, rationale, refs, autoApprove },
          {
            op: "create_edge",
            ...change,
          },
          `Create edge ${change.kind}`,
        ),
      )
    },
  )

  app.patch(
    "/edge/:edgeID",
    describeRoute({
      summary: "Propose edge update",
      description: "Create a proposal to update an edge in accepted state.",
      operationId: "domain.edge.proposeUpdate",
      responses: {
        200: {
          description: "Queued proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        edgeID: Identifier.schema("edge"),
      }),
    ),
    validator("json", Domain.updateEdge.schema.omit({ id: true, actor: true }).extend(Meta.shape)),
    async (c) => {
      const edgeID = c.req.valid("param").edgeID
      const body = c.req.valid("json")
      const { author, proposalTitle, rationale, refs, autoApprove, ...change } = body
      return c.json(
        await queued(
          { author, proposalTitle, rationale, refs, autoApprove },
          {
            op: "update_edge",
            id: edgeID,
            ...change,
          },
          `Update edge ${edgeID}`,
        ),
      )
    },
  )

  app.delete(
    "/edge/:edgeID",
    describeRoute({
      summary: "Propose edge deletion",
      description: "Create a proposal to delete an edge from accepted state.",
      operationId: "domain.edge.proposeDelete",
      responses: {
        200: {
          description: "Queued proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        edgeID: Identifier.schema("edge"),
      }),
    ),
    validator("json", Meta),
    async (c) => {
      const edgeID = c.req.valid("param").edgeID
      const body = c.req.valid("json")
      return c.json(
        await queued(
          body,
          {
            op: "delete_edge",
            id: edgeID,
          },
          `Delete edge ${edgeID}`,
        ),
      )
    },
  )

  app.get(
    "/run",
    describeRoute({
      summary: "List runs",
      description: "List accepted runs in the current project.",
      operationId: "domain.run.list",
      responses: {
        200: {
          description: "Runs",
          content: {
            "application/json": {
              schema: resolver(Domain.Run.array()),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "query",
      z.object({
        kind: z.string().optional(),
        status: z.string().optional(),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query")
      return c.json(
        await Domain.listRuns({
          projectID: Instance.project.id,
          kind: query.kind,
          status: query.status,
        }),
      )
    },
  )

  app.post(
    "/run",
    describeRoute({
      summary: "Propose run creation",
      description: "Create a proposal to add a run to accepted state.",
      operationId: "domain.run.proposeCreate",
      responses: {
        200: {
          description: "Queued proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "json",
      Domain.createRun.schema
        .omit({ projectID: true, actor: true, triggeredBy: true })
        .extend(Meta.shape)
        .extend({
          actor: Domain.Actor.optional(),
        }),
    ),
    async (c) => {
      const body = c.req.valid("json")
      const { author, proposalTitle, rationale, refs, autoApprove, actor, ...change } = body
      return c.json(
        await queued(
          { author, proposalTitle, rationale, refs, autoApprove },
          {
            op: "create_run",
            actor,
            ...change,
          },
          `Create run ${change.kind}`,
        ),
      )
    },
  )

  app.patch(
    "/run/:runID",
    describeRoute({
      summary: "Propose run update",
      description: "Create a proposal to update a run in accepted state.",
      operationId: "domain.run.proposeUpdate",
      responses: {
        200: {
          description: "Queued proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        runID: Identifier.schema("run"),
      }),
    ),
    validator(
      "json",
      Domain.updateRun.schema
        .omit({ id: true, actor: true, triggeredBy: true })
        .extend(Meta.shape)
        .extend({
          actor: Domain.Actor.optional(),
        }),
    ),
    async (c) => {
      const runID = c.req.valid("param").runID
      const body = c.req.valid("json")
      const { author, proposalTitle, rationale, refs, autoApprove, actor, ...change } = body
      return c.json(
        await queued(
          { author, proposalTitle, rationale, refs, autoApprove },
          {
            op: "update_run",
            id: runID,
            actor,
            ...change,
          },
          `Update run ${runID}`,
        ),
      )
    },
  )

  app.delete(
    "/run/:runID",
    describeRoute({
      summary: "Propose run deletion",
      description: "Create a proposal to delete a run from accepted state.",
      operationId: "domain.run.proposeDelete",
      responses: {
        200: {
          description: "Queued proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        runID: Identifier.schema("run"),
      }),
    ),
    validator("json", Meta),
    async (c) => {
      const runID = c.req.valid("param").runID
      const body = c.req.valid("json")
      return c.json(
        await queued(
          body,
          {
            op: "delete_run",
            id: runID,
          },
          `Delete run ${runID}`,
        ),
      )
    },
  )

  app.get(
    "/artifact",
    describeRoute({
      summary: "List artifacts",
      description: "List accepted artifacts in the current project.",
      operationId: "domain.artifact.list",
      responses: {
        200: {
          description: "Artifacts",
          content: {
            "application/json": {
              schema: resolver(Domain.Artifact.array()),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "query",
      z.object({
        kind: z.string().optional(),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query")
      return c.json(
        await Domain.listArtifacts({
          projectID: Instance.project.id,
          kind: query.kind,
        }),
      )
    },
  )

  app.post(
    "/artifact",
    describeRoute({
      summary: "Propose artifact creation",
      description: "Create a proposal to add an artifact to accepted state.",
      operationId: "domain.artifact.proposeCreate",
      responses: {
        200: {
          description: "Queued proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator("json", Domain.createArtifact.schema.omit({ projectID: true, actor: true }).extend(Meta.shape)),
    async (c) => {
      const body = c.req.valid("json")
      const { author, proposalTitle, rationale, refs, autoApprove, ...change } = body
      return c.json(
        await queued(
          { author, proposalTitle, rationale, refs, autoApprove },
          {
            op: "create_artifact",
            ...change,
          },
          `Create artifact ${change.kind}`,
        ),
      )
    },
  )

  app.patch(
    "/artifact/:artifactID",
    describeRoute({
      summary: "Propose artifact update",
      description: "Create a proposal to update an artifact in accepted state.",
      operationId: "domain.artifact.proposeUpdate",
      responses: {
        200: {
          description: "Queued proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        artifactID: Identifier.schema("artifact"),
      }),
    ),
    validator("json", Domain.updateArtifact.schema.omit({ id: true, actor: true }).extend(Meta.shape)),
    async (c) => {
      const artifactID = c.req.valid("param").artifactID
      const body = c.req.valid("json")
      const { author, proposalTitle, rationale, refs, autoApprove, ...change } = body
      return c.json(
        await queued(
          { author, proposalTitle, rationale, refs, autoApprove },
          {
            op: "update_artifact",
            id: artifactID,
            ...change,
          },
          `Update artifact ${artifactID}`,
        ),
      )
    },
  )

  app.delete(
    "/artifact/:artifactID",
    describeRoute({
      summary: "Propose artifact deletion",
      description: "Create a proposal to delete an artifact from accepted state.",
      operationId: "domain.artifact.proposeDelete",
      responses: {
        200: {
          description: "Queued proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        artifactID: Identifier.schema("artifact"),
      }),
    ),
    validator("json", Meta),
    async (c) => {
      const artifactID = c.req.valid("param").artifactID
      const body = c.req.valid("json")
      return c.json(
        await queued(
          body,
          {
            op: "delete_artifact",
            id: artifactID,
          },
          `Delete artifact ${artifactID}`,
        ),
      )
    },
  )

  app.get(
    "/decision",
    describeRoute({
      summary: "List decisions",
      description: "List accepted decisions in the current project.",
      operationId: "domain.decision.list",
      responses: {
        200: {
          description: "Decisions",
          content: {
            "application/json": {
              schema: resolver(Domain.Decision.array()),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "query",
      z.object({
        kind: z.string().optional(),
        state: z.string().optional(),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query")
      return c.json(
        await Domain.listDecisions({
          projectID: Instance.project.id,
          kind: query.kind,
          state: query.state,
        }),
      )
    },
  )

  app.post(
    "/decision",
    describeRoute({
      summary: "Propose decision creation",
      description: "Create a proposal to add a decision to accepted state.",
      operationId: "domain.decision.proposeCreate",
      responses: {
        200: {
          description: "Queued proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "json",
      Domain.createDecision.schema
        .omit({ projectID: true, actor: true, decidedBy: true })
        .extend(Meta.shape)
        .extend({
          actor: Domain.Actor.optional(),
        }),
    ),
    async (c) => {
      const body = c.req.valid("json")
      const { author, proposalTitle, rationale, refs, autoApprove, actor, ...change } = body
      return c.json(
        await queued(
          { author, proposalTitle, rationale, refs, autoApprove },
          {
            op: "create_decision",
            actor,
            ...change,
          },
          `Create decision ${change.kind}`,
        ),
      )
    },
  )

  app.patch(
    "/decision/:decisionID",
    describeRoute({
      summary: "Propose decision update",
      description: "Create a proposal to update a decision in accepted state.",
      operationId: "domain.decision.proposeUpdate",
      responses: {
        200: {
          description: "Queued proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        decisionID: Identifier.schema("decision"),
      }),
    ),
    validator(
      "json",
      Domain.updateDecision.schema
        .omit({ id: true, actor: true, decidedBy: true })
        .extend(Meta.shape)
        .extend({
          actor: Domain.Actor.optional(),
        }),
    ),
    async (c) => {
      const decisionID = c.req.valid("param").decisionID
      const body = c.req.valid("json")
      const { author, proposalTitle, rationale, refs, autoApprove, actor, ...change } = body
      return c.json(
        await queued(
          { author, proposalTitle, rationale, refs, autoApprove },
          {
            op: "update_decision",
            id: decisionID,
            actor,
            ...change,
          },
          `Update decision ${decisionID}`,
        ),
      )
    },
  )

  app.delete(
    "/decision/:decisionID",
    describeRoute({
      summary: "Propose decision deletion",
      description: "Create a proposal to delete a decision from accepted state.",
      operationId: "domain.decision.proposeDelete",
      responses: {
        200: {
          description: "Queued proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        decisionID: Identifier.schema("decision"),
      }),
    ),
    validator("json", Meta),
    async (c) => {
      const decisionID = c.req.valid("param").decisionID
      const body = c.req.valid("json")
      return c.json(
        await queued(
          body,
          {
            op: "delete_decision",
            id: decisionID,
          },
          `Delete decision ${decisionID}`,
        ),
      )
    },
  )

  app.get(
    "/proposal",
    describeRoute({
      summary: "List proposals",
      description: "List proposals in the current project.",
      operationId: "domain.proposal.list",
      responses: {
        200: {
          description: "Proposals",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal.array()),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "query",
      z.object({
        status: Domain.ProposalStatus.optional(),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query")
      return c.json(
        await Domain.listProposals({
          projectID: Instance.project.id,
          status: query.status,
        }),
      )
    },
  )

  app.get(
    "/proposal/:proposalID",
    describeRoute({
      summary: "Get proposal",
      description: "Fetch a proposal by id.",
      operationId: "domain.proposal.get",
      responses: {
        200: {
          description: "Proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        proposalID: Identifier.schema("proposal"),
      }),
    ),
    async (c) => {
      return c.json(await Domain.getProposal(c.req.valid("param").proposalID))
    },
  )

  app.post(
    "/proposal",
    describeRoute({
      summary: "Create proposal",
      description: "Create a proposal for future accepted-state changes.",
      operationId: "domain.proposal.create",
      responses: {
        200: {
          description: "Created proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "json",
      Domain.propose.schema.omit({ projectID: true }).extend({
        actor: Domain.Actor.optional(),
        autoApprove: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const body = c.req.valid("json")
      const { autoApprove, ...rest } = body
      const actor = author(rest.actor)
      const proposal = await Domain.propose({
        ...rest,
        projectID: Instance.project.id,
        actor,
      })
      await Bus.publish(Domain.Event.ProposalCreated, proposal)
      if (!shouldAutoApprove(actor, autoApprove)) return c.json(proposal)
      return c.json(await autoCommit(proposal, actor, "Auto-approved in ship mode."))
    },
  )

  app.post(
    "/proposal/:proposalID/withdraw",
    describeRoute({
      summary: "Withdraw proposal",
      description: "Withdraw a pending proposal.",
      operationId: "domain.proposal.withdraw",
      responses: {
        200: {
          description: "Withdrawn proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        proposalID: Identifier.schema("proposal"),
      }),
    ),
    validator("json", z.object({ actor: Domain.Actor.optional() }).optional()),
    async (c) => {
      const proposalID = c.req.valid("param").proposalID
      const body = c.req.valid("json") ?? {}
      const proposal = await Domain.withdrawProposal({ id: proposalID, actor: author(body.actor) })
      await Bus.publish(Domain.Event.ProposalWithdrawn, proposal)
      return c.json(proposal)
    },
  )

  app.post(
    "/proposal/:proposalID/revise",
    describeRoute({
      summary: "Revise proposal",
      description: "Submit a revised version of a pending proposal.",
      operationId: "domain.proposal.revise",
      responses: {
        200: {
          description: "Revised proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        proposalID: Identifier.schema("proposal"),
      }),
    ),
    validator("json", Domain.reviseProposal.schema.omit({ id: true }).extend({ actor: Domain.Actor.optional() })),
    async (c) => {
      const proposalID = c.req.valid("param").proposalID
      const body = c.req.valid("json")
      const proposal = await Domain.reviseProposal({
        id: proposalID,
        ...body,
        actor: author(body.actor),
      })
      await Bus.publish(Domain.Event.ProposalRevised, proposal)
      return c.json(proposal)
    },
  )

  app.post(
    "/proposal/:proposalID/review",
    describeRoute({
      summary: "Review proposal",
      description: "Review a proposal and, on approval, apply it atomically into accepted state.",
      operationId: "domain.proposal.review",
      responses: {
        200: {
          description: "Review result",
          content: {
            "application/json": {
              schema: resolver(Domain.ReviewResult),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        proposalID: Identifier.schema("proposal"),
      }),
    ),
    validator(
      "json",
      Domain.reviewProposal.schema.omit({ proposalID: true }).extend({ actor: Domain.Actor.optional() }),
    ),
    async (c) => {
      const proposalID = c.req.valid("param").proposalID
      const body = c.req.valid("json")
      const result = await Domain.reviewProposal({ proposalID, ...body, actor: author(body.actor) })
      await Bus.publish(Domain.Event.ProposalReviewed, result)
      if (result.commit) await Bus.publish(Domain.Event.ProposalCommitted, result.commit)
      return c.json(result)
    },
  )

  app.get(
    "/review",
    describeRoute({
      summary: "List reviews",
      description: "List reviews in the current project.",
      operationId: "domain.review.list",
      responses: {
        200: {
          description: "Reviews",
          content: {
            "application/json": {
              schema: resolver(Domain.Review.array()),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "query",
      z.object({
        proposalID: Identifier.schema("proposal").optional(),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query")
      return c.json(
        await Domain.listReviews({
          projectID: Instance.project.id,
          proposalID: query.proposalID,
        }),
      )
    },
  )

  app.get(
    "/review/:reviewID",
    describeRoute({
      summary: "Get review",
      description: "Fetch a review by id.",
      operationId: "domain.review.get",
      responses: {
        200: {
          description: "Review",
          content: {
            "application/json": {
              schema: resolver(Domain.Review),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        reviewID: Identifier.schema("review"),
      }),
    ),
    async (c) => {
      return c.json(await Domain.getReview(c.req.valid("param").reviewID))
    },
  )

  app.get(
    "/commit",
    describeRoute({
      summary: "List commits",
      description: "List accepted change commits in the current project.",
      operationId: "domain.commit.list",
      responses: {
        200: {
          description: "Commits",
          content: {
            "application/json": {
              schema: resolver(Domain.Commit.array()),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "query",
      z.object({
        proposalID: Identifier.schema("proposal").optional(),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query")
      return c.json(
        await Domain.listCommits({
          projectID: Instance.project.id,
          proposalID: query.proposalID,
        }),
      )
    },
  )

  app.get(
    "/commit/:commitID",
    describeRoute({
      summary: "Get commit",
      description: "Fetch a commit by id.",
      operationId: "domain.commit.get",
      responses: {
        200: {
          description: "Commit",
          content: {
            "application/json": {
              schema: resolver(Domain.Commit),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        commitID: Identifier.schema("commit"),
      }),
    ),
    async (c) => {
      return c.json(await Domain.getCommit(c.req.valid("param").commitID))
    },
  )

  accepted.post(
    "/node",
    describeRoute({
      summary: "Create accepted node",
      description: "System-only bridge for direct accepted-state node creation.",
      operationId: "domain.accepted.node.create",
      responses: {
        200: {
          description: "Created node",
          content: {
            "application/json": {
              schema: resolver(Domain.Node),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator("json", Domain.createNode.schema.omit({ projectID: true, actor: true })),
    async (c) => {
      const body = c.req.valid("json")
      return c.json(
        await Domain.createNode({
          projectID: Instance.project.id,
          actor: SYSTEM,
          ...body,
        }),
      )
    },
  )

  accepted.patch(
    "/node/:nodeID",
    describeRoute({
      summary: "Update accepted node",
      description: "System-only bridge for direct accepted-state node updates.",
      operationId: "domain.accepted.node.update",
      responses: {
        200: {
          description: "Updated node",
          content: {
            "application/json": {
              schema: resolver(Domain.Node),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        nodeID: Identifier.schema("node"),
      }),
    ),
    validator("json", Domain.updateNode.schema.omit({ id: true, actor: true })),
    async (c) => {
      const nodeID = c.req.valid("param").nodeID
      const body = c.req.valid("json")
      return c.json(await Domain.updateNode({ id: nodeID, actor: SYSTEM, ...body }))
    },
  )

  accepted.delete(
    "/node/:nodeID",
    describeRoute({
      summary: "Delete accepted node",
      description: "System-only bridge for direct accepted-state node deletion.",
      operationId: "domain.accepted.node.delete",
      responses: {
        200: {
          description: "Deleted node",
          content: {
            "application/json": {
              schema: resolver(Domain.Node),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        nodeID: Identifier.schema("node"),
      }),
    ),
    async (c) => {
      return c.json(await Domain.removeNode({ id: c.req.valid("param").nodeID, actor: SYSTEM }))
    },
  )

  accepted.post(
    "/edge",
    describeRoute({
      summary: "Create accepted edge",
      description: "System-only bridge for direct accepted-state edge creation.",
      operationId: "domain.accepted.edge.create",
      responses: {
        200: {
          description: "Created edge",
          content: {
            "application/json": {
              schema: resolver(Domain.Edge),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator("json", Domain.createEdge.schema.omit({ projectID: true, actor: true })),
    async (c) => {
      const body = c.req.valid("json")
      return c.json(
        await Domain.createEdge({
          projectID: Instance.project.id,
          actor: SYSTEM,
          ...body,
        }),
      )
    },
  )

  accepted.patch(
    "/edge/:edgeID",
    describeRoute({
      summary: "Update accepted edge",
      description: "System-only bridge for direct accepted-state edge updates.",
      operationId: "domain.accepted.edge.update",
      responses: {
        200: {
          description: "Updated edge",
          content: {
            "application/json": {
              schema: resolver(Domain.Edge),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        edgeID: Identifier.schema("edge"),
      }),
    ),
    validator("json", Domain.updateEdge.schema.omit({ id: true, actor: true })),
    async (c) => {
      const edgeID = c.req.valid("param").edgeID
      const body = c.req.valid("json")
      return c.json(await Domain.updateEdge({ id: edgeID, actor: SYSTEM, ...body }))
    },
  )

  accepted.delete(
    "/edge/:edgeID",
    describeRoute({
      summary: "Delete accepted edge",
      description: "System-only bridge for direct accepted-state edge deletion.",
      operationId: "domain.accepted.edge.delete",
      responses: {
        200: {
          description: "Deleted edge",
          content: {
            "application/json": {
              schema: resolver(Domain.Edge),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        edgeID: Identifier.schema("edge"),
      }),
    ),
    async (c) => {
      return c.json(await Domain.removeEdge({ id: c.req.valid("param").edgeID, actor: SYSTEM }))
    },
  )

  accepted.post(
    "/run",
    describeRoute({
      summary: "Create accepted run",
      description: "System-only bridge for direct accepted-state run creation.",
      operationId: "domain.accepted.run.create",
      responses: {
        200: {
          description: "Created run",
          content: {
            "application/json": {
              schema: resolver(Domain.Run),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "json",
      Domain.createRun.schema.omit({ projectID: true, actor: true, triggeredBy: true }).extend({
        actor: Domain.Actor.optional(),
      }),
    ),
    async (c) => {
      const body = c.req.valid("json")
      const { actor: triggeredBy, ...rest } = body
      return c.json(
        await Domain.createRun({
          projectID: Instance.project.id,
          actor: SYSTEM,
          triggeredBy,
          ...rest,
        }),
      )
    },
  )

  accepted.patch(
    "/run/:runID",
    describeRoute({
      summary: "Update accepted run",
      description: "System-only bridge for direct accepted-state run updates.",
      operationId: "domain.accepted.run.update",
      responses: {
        200: {
          description: "Updated run",
          content: {
            "application/json": {
              schema: resolver(Domain.Run),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        runID: Identifier.schema("run"),
      }),
    ),
    validator(
      "json",
      Domain.updateRun.schema.omit({ id: true, actor: true, triggeredBy: true }).extend({
        actor: Domain.Actor.optional(),
      }),
    ),
    async (c) => {
      const runID = c.req.valid("param").runID
      const body = c.req.valid("json")
      const { actor: triggeredBy, ...rest } = body
      return c.json(await Domain.updateRun({ id: runID, actor: SYSTEM, triggeredBy, ...rest }))
    },
  )

  accepted.delete(
    "/run/:runID",
    describeRoute({
      summary: "Delete accepted run",
      description: "System-only bridge for direct accepted-state run deletion.",
      operationId: "domain.accepted.run.delete",
      responses: {
        200: {
          description: "Deleted run",
          content: {
            "application/json": {
              schema: resolver(Domain.Run),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        runID: Identifier.schema("run"),
      }),
    ),
    async (c) => {
      return c.json(await Domain.removeRun({ id: c.req.valid("param").runID, actor: SYSTEM }))
    },
  )

  accepted.post(
    "/artifact",
    describeRoute({
      summary: "Create accepted artifact",
      description: "System-only bridge for direct accepted-state artifact creation.",
      operationId: "domain.accepted.artifact.create",
      responses: {
        200: {
          description: "Created artifact",
          content: {
            "application/json": {
              schema: resolver(Domain.Artifact),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator("json", Domain.createArtifact.schema.omit({ projectID: true, actor: true })),
    async (c) => {
      const body = c.req.valid("json")
      return c.json(
        await Domain.createArtifact({
          projectID: Instance.project.id,
          actor: SYSTEM,
          ...body,
        }),
      )
    },
  )

  accepted.patch(
    "/artifact/:artifactID",
    describeRoute({
      summary: "Update accepted artifact",
      description: "System-only bridge for direct accepted-state artifact updates.",
      operationId: "domain.accepted.artifact.update",
      responses: {
        200: {
          description: "Updated artifact",
          content: {
            "application/json": {
              schema: resolver(Domain.Artifact),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        artifactID: Identifier.schema("artifact"),
      }),
    ),
    validator("json", Domain.updateArtifact.schema.omit({ id: true, actor: true })),
    async (c) => {
      const artifactID = c.req.valid("param").artifactID
      const body = c.req.valid("json")
      return c.json(await Domain.updateArtifact({ id: artifactID, actor: SYSTEM, ...body }))
    },
  )

  accepted.delete(
    "/artifact/:artifactID",
    describeRoute({
      summary: "Delete accepted artifact",
      description: "System-only bridge for direct accepted-state artifact deletion.",
      operationId: "domain.accepted.artifact.delete",
      responses: {
        200: {
          description: "Deleted artifact",
          content: {
            "application/json": {
              schema: resolver(Domain.Artifact),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        artifactID: Identifier.schema("artifact"),
      }),
    ),
    async (c) => {
      return c.json(await Domain.removeArtifact({ id: c.req.valid("param").artifactID, actor: SYSTEM }))
    },
  )

  accepted.post(
    "/decision",
    describeRoute({
      summary: "Create accepted decision",
      description: "System-only bridge for direct accepted-state decision creation.",
      operationId: "domain.accepted.decision.create",
      responses: {
        200: {
          description: "Created decision",
          content: {
            "application/json": {
              schema: resolver(Domain.Decision),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "json",
      Domain.createDecision.schema.omit({ projectID: true, actor: true, decidedBy: true }).extend({
        actor: Domain.Actor.optional(),
      }),
    ),
    async (c) => {
      const body = c.req.valid("json")
      const { actor: decidedBy, ...rest } = body
      return c.json(
        await Domain.createDecision({
          projectID: Instance.project.id,
          actor: SYSTEM,
          decidedBy,
          ...rest,
        }),
      )
    },
  )

  accepted.patch(
    "/decision/:decisionID",
    describeRoute({
      summary: "Update accepted decision",
      description: "System-only bridge for direct accepted-state decision updates.",
      operationId: "domain.accepted.decision.update",
      responses: {
        200: {
          description: "Updated decision",
          content: {
            "application/json": {
              schema: resolver(Domain.Decision),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        decisionID: Identifier.schema("decision"),
      }),
    ),
    validator(
      "json",
      Domain.updateDecision.schema.omit({ id: true, actor: true, decidedBy: true }).extend({
        actor: Domain.Actor.optional(),
      }),
    ),
    async (c) => {
      const decisionID = c.req.valid("param").decisionID
      const body = c.req.valid("json")
      const { actor: decidedBy, ...rest } = body
      return c.json(await Domain.updateDecision({ id: decisionID, actor: SYSTEM, decidedBy, ...rest }))
    },
  )

  accepted.delete(
    "/decision/:decisionID",
    describeRoute({
      summary: "Delete accepted decision",
      description: "System-only bridge for direct accepted-state decision deletion.",
      operationId: "domain.accepted.decision.delete",
      responses: {
        200: {
          description: "Deleted decision",
          content: {
            "application/json": {
              schema: resolver(Domain.Decision),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        decisionID: Identifier.schema("decision"),
      }),
    ),
    async (c) => {
      return c.json(await Domain.removeDecision({ id: c.req.valid("param").decisionID, actor: SYSTEM }))
    },
  )

  app.get(
    "/decision/:decisionID/provenance",
    describeRoute({
      summary: "Decision provenance",
      description:
        "Return a decision joined with its originating commit, proposal, reviews, linked node/run/artifact, and the supersede chain.",
      operationId: "domain.decision.provenance",
      responses: {
        200: {
          description: "Provenance",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  decision: Domain.Decision,
                  createdBy: z
                    .object({
                      commit: Domain.Commit.optional(),
                      proposal: Domain.Proposal.optional(),
                      reviews: Domain.Review.array(),
                    })
                    .optional(),
                  supersedes: Domain.Decision.array(),
                  supersededBy: Domain.Decision.optional(),
                  node: Domain.Node.optional(),
                  run: Domain.Run.optional(),
                  artifact: Domain.Artifact.optional(),
                }),
              ),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator("param", z.object({ decisionID: Identifier.schema("decision") })),
    async (c) => {
      const id = c.req.valid("param").decisionID
      const decision = await Domain.getDecision(id)
      type Commit = z.infer<typeof Domain.Commit>
      type Change = z.infer<typeof Domain.Change>
      type Proposal = z.infer<typeof Domain.Proposal>
      type Review = z.infer<typeof Domain.Review>
      type Decision = z.infer<typeof Domain.Decision>
      const commits: Commit[] = await Domain.listCommits({ projectID: Instance.project.id })
      const matches = (change: Change) =>
        (change.op === "create_decision" || change.op === "update_decision") &&
        "id" in change &&
        change.id === id
      const createdByCommit = commits.find((commit) =>
        commit.changes.some((change) => change.op === "create_decision" && "id" in change && change.id === id),
      )
      let proposal: Proposal | undefined
      let reviews: Review[] = []
      if (createdByCommit?.proposalID) {
        proposal = await Domain.getProposal(createdByCommit.proposalID).catch(() => undefined)
        const all: Review[] = await Domain.listReviews({ projectID: Instance.project.id })
        reviews = all.filter((review) => review.proposalID === createdByCommit.proposalID)
      }
      const updateCommits = commits.filter(
        (commit) => commit.id !== createdByCommit?.id && commit.changes.some(matches),
      )
      const decisions: Decision[] = await Domain.listDecisions({ projectID: Instance.project.id })
      const supersedes = decisions.filter((item) => item.supersededBy === decision.id)
      const supersededBy = decision.supersededBy
        ? decisions.find((item) => item.id === decision.supersededBy)
        : undefined
      const node = decision.nodeID ? await Domain.getNode(decision.nodeID).catch(() => undefined) : undefined
      const run = decision.runID ? await Domain.getRun(decision.runID).catch(() => undefined) : undefined
      const artifact = decision.artifactID
        ? await Domain.getArtifact(decision.artifactID).catch(() => undefined)
        : undefined
      return c.json({
        decision,
        createdBy: createdByCommit
          ? {
              commit: createdByCommit,
              proposal,
              reviews,
            }
          : undefined,
        updateCommits,
        supersedes,
        supersededBy,
        node,
        run,
        artifact,
      })
    },
  )

  app.get(
    "/export",
    describeRoute({
      summary: "Export project domain",
      description:
        "Download the entire accepted + proposal state of the project as a single JSON envelope suitable for import into another project.",
      operationId: "domain.export",
      responses: {
        200: {
          description: "Export envelope",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  version: z.number(),
                  exportedAt: z.number(),
                  project: Domain.Project,
                  taxonomy: Domain.Taxonomy,
                  nodes: Domain.Node.array(),
                  edges: Domain.Edge.array(),
                  runs: Domain.Run.array(),
                  artifacts: Domain.Artifact.array(),
                  decisions: Domain.Decision.array(),
                  proposals: Domain.Proposal.array(),
                  reviews: Domain.Review.array(),
                  commits: Domain.Commit.array(),
                }),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const pid = Instance.project.id
      const [project, taxonomy, nodes, edges, runs, artifacts, decisions, proposals, reviews, commits] =
        await Promise.all([
          Domain.getProject(pid),
          Domain.taxonomy(pid),
          Domain.listNodes({ projectID: pid }),
          Domain.listEdges({ projectID: pid }),
          Domain.listRuns({ projectID: pid }),
          Domain.listArtifacts({ projectID: pid }),
          Domain.listDecisions({ projectID: pid }),
          Domain.listProposals({ projectID: pid }),
          Domain.listReviews({ projectID: pid }),
          Domain.listCommits({ projectID: pid }),
        ])
      return c.json({
        version: 1,
        exportedAt: Date.now(),
        project,
        taxonomy,
        nodes,
        edges,
        runs,
        artifacts,
        decisions,
        proposals,
        reviews,
        commits,
      })
    },
  )

  const ImportEnvelope = z.object({
    version: z.number().optional(),
    nodes: Domain.Node.array().optional(),
    edges: Domain.Edge.array().optional(),
    runs: Domain.Run.array().optional(),
    artifacts: Domain.Artifact.array().optional(),
    decisions: Domain.Decision.array().optional(),
  })

  app.post(
    "/import",
    describeRoute({
      summary: "Import project domain",
      description:
        "Apply an export envelope onto the current project by emitting a single bulk proposal for review. Ship-mode auto-approves.",
      operationId: "domain.import",
      responses: {
        200: {
          description: "Import proposal",
          content: {
            "application/json": {
              schema: resolver(Domain.Proposal),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "json",
      z.object({
        envelope: ImportEnvelope,
        actor: Domain.Actor.optional(),
        autoApprove: z.boolean().optional(),
        preserveIds: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const body = c.req.valid("json")
      const actor = author(body.actor)
      const envelope = body.envelope
      const preserve = body.preserveIds === true

      type Kind = "node" | "edge" | "run" | "artifact" | "decision"
      const remaps: Record<Kind, Map<string, string>> = {
        node: new Map(),
        edge: new Map(),
        run: new Map(),
        artifact: new Map(),
        decision: new Map(),
      }

      function remap(kind: Kind, original: string | undefined) {
        if (!original) return undefined
        if (preserve) return original
        const map = remaps[kind]
        const existing = map.get(original)
        if (existing) return existing
        const next = Identifier.ascending(kind)
        map.set(original, next)
        return next
      }

      const changes: z.infer<typeof Domain.Change>[] = []
      for (const node of envelope.nodes ?? []) {
        changes.push({
          op: "create_node",
          id: remap("node", node.id),
          kind: node.kind,
          title: node.title,
          body: node.body,
          data: node.data,
        })
      }
      for (const edge of envelope.edges ?? []) {
        const sourceID = remap("node", edge.sourceID)
        const targetID = remap("node", edge.targetID)
        if (!sourceID || !targetID) continue
        changes.push({
          op: "create_edge",
          id: remap("edge", edge.id),
          kind: edge.kind,
          sourceID,
          targetID,
          note: edge.note,
          data: edge.data,
        })
      }
      for (const run of envelope.runs ?? []) {
        changes.push({
          op: "create_run",
          id: remap("run", run.id),
          nodeID: remap("node", run.nodeID),
          sessionID: run.sessionID,
          kind: run.kind,
          status: run.status,
          title: run.title,
          actor: run.actor,
          manifest: run.manifest,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
        })
      }
      for (const artifact of envelope.artifacts ?? []) {
        changes.push({
          op: "create_artifact",
          id: remap("artifact", artifact.id),
          runID: remap("run", artifact.runID),
          nodeID: remap("node", artifact.nodeID),
          kind: artifact.kind,
          title: artifact.title,
          mimeType: artifact.mimeType,
          storageURI: artifact.storageURI,
          data: artifact.data,
          provenance: artifact.provenance,
        })
      }
      for (const decision of envelope.decisions ?? []) {
        changes.push({
          op: "create_decision",
          id: remap("decision", decision.id),
          nodeID: remap("node", decision.nodeID),
          runID: remap("run", decision.runID),
          artifactID: remap("artifact", decision.artifactID),
          kind: decision.kind,
          state: decision.state,
          rationale: decision.rationale,
          supersededBy: remap("decision", decision.supersededBy),
          data: decision.data,
          refs: decision.refs,
        })
      }
      if (changes.length === 0) {
        return c.json({ message: "Envelope is empty; nothing to import." }, 400)
      }
      const proposal = await Domain.propose({
        projectID: Instance.project.id,
        title: `Import ${changes.length} domain change${changes.length === 1 ? "" : "s"}`,
        actor,
        rationale: "Bulk import from an export envelope. Review individual changes before approving.",
        refs: { source: "domain.import", version: envelope.version ?? 1, preserveIds: preserve },
        changes,
      })
      await Bus.publish(Domain.Event.ProposalCreated, proposal)
      if (!shouldAutoApprove(actor, body.autoApprove)) return c.json(proposal)
      return c.json(await autoCommit(proposal, actor, "Auto-approved during import."))
    },
  )

  app.route("/accepted", accepted)

  return app
})
