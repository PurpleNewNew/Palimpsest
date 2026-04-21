import { afterEach, describe, expect, test } from "bun:test"
import { Domain } from "../../src/domain/domain"
import { WorkspaceTable } from "../../src/control-plane/workspace.sql"
import { Identifier } from "../../src/id/id"
import { ProjectTable } from "../../src/project/project.sql"
import { Database } from "../../src/storage/db"
import { Log } from "../../src/util/log"
import { resetDatabase } from "../fixture/db"

Log.init({ print: false })

afterEach(async () => {
  await resetDatabase()
})

function seed(projectID: string) {
  const now = Date.now()
  Database.use((db) =>
    db
      .insert(ProjectTable)
      .values({
        id: projectID,
        worktree: `/tmp/${projectID}`,
        vcs: "git",
        time_created: now,
        time_updated: now,
        sandboxes: [],
      })
      .run(),
  )
  Database.use((db) =>
    db
      .insert(WorkspaceTable)
      .values({
        id: Identifier.ascending("workspace"),
        project_id: projectID,
        type: "git",
        branch: "dev",
        name: `${projectID}-main`,
        directory: `/tmp/${projectID}`,
      })
      .run(),
  )
  return projectID
}

describe("Domain", () => {
  test("builds graph state under taxonomy rules", async () => {
    const projectID = seed("project-domain")

    await Domain.setTaxonomy({
      projectID,
      nodeKinds: ["claim", "finding"],
      edgeKinds: ["supports"],
      runKinds: ["scan"],
      artifactKinds: ["report"],
      decisionKinds: ["accept_claim"],
      decisionStates: ["accepted"],
    })

    const a = await Domain.createNode({
      projectID,
      kind: "claim",
      title: "Base claim",
    })
    const b = await Domain.createNode({
      projectID,
      kind: "finding",
      title: "Observed result",
    })
    const e = await Domain.createEdge({
      projectID,
      kind: "supports",
      sourceID: a.id,
      targetID: b.id,
    })
    const edge = await Domain.updateEdge({
      id: e.id,
      note: "Evidence chain",
    })
    const r = await Domain.createRun({
      projectID,
      kind: "scan",
      title: "Baseline scan",
      status: "completed",
      nodeID: b.id,
      actor: {
        type: "agent",
        id: "agt_scan",
        version: "0.1.0",
      },
    })
    const art = await Domain.createArtifact({
      projectID,
      kind: "report",
      title: "Scan report",
      runID: r.id,
      nodeID: b.id,
    })
    const asset = await Domain.updateArtifact({
      id: art.id,
      title: "Published report",
      storageURI: "file:///tmp/report.json",
    })
    const d = await Domain.createDecision({
      projectID,
      kind: "accept_claim",
      state: "accepted",
      nodeID: b.id,
      runID: r.id,
      artifactID: art.id,
      rationale: "Evidence is sufficient",
      actor: {
        type: "user",
        id: "usr_reviewer",
      },
    })
    const decision = await Domain.updateDecision({
      id: d.id,
      rationale: "Evidence is sufficient and repeatable",
      actor: {
        type: "agent",
        id: "agt_judge",
        version: "0.2.0",
      },
    })

    expect(edge.note).toBe("Evidence chain")
    expect(asset.storageURI).toBe("file:///tmp/report.json")
    expect(decision.actor).toEqual({
      type: "agent",
      id: "agt_judge",
      version: "0.2.0",
    })

    const graph = await Domain.graph(projectID)
    const sum = await Domain.summary(projectID)
    const ctx = await Domain.context(projectID)

    expect(graph.nodes.map((item) => item.kind)).toEqual(["claim", "finding"])
    expect(graph.edges).toHaveLength(1)
    expect(graph.runs).toHaveLength(1)
    expect(graph.artifacts).toHaveLength(1)
    expect(graph.decisions).toHaveLength(1)
    expect(graph.runs[0].actor).toEqual({
      type: "agent",
      id: "agt_scan",
      version: "0.1.0",
    })
    expect(sum).toEqual({
      workspaces: 1,
      nodes: 2,
      edges: 1,
      runs: 1,
      artifacts: 1,
      decisions: 1,
      proposals: 0,
      reviews: 0,
      commits: 0,
    })
    expect(ctx.project.id).toBe(projectID)
    expect(ctx.workspaces).toHaveLength(1)
    expect(ctx.summary).toEqual(sum)
  })

  test("rejects kinds outside the active taxonomy", async () => {
    const projectID = seed("project-taxonomy")

    await Domain.setTaxonomy({
      projectID,
      nodeKinds: ["claim"],
    })

    const err = await Domain.createNode({
      projectID,
      kind: "risk",
      title: "Should fail",
    }).catch((err) => err)

    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("DomainInvalidTaxonomyError")
  })

  test("rejects cross-project links", async () => {
    const left = seed("project-left")
    const right = seed("project-right")

    const a = await Domain.createNode({
      projectID: left,
      kind: "claim",
      title: "Left node",
    })
    const b = await Domain.createNode({
      projectID: right,
      kind: "claim",
      title: "Right node",
    })

    const err = await Domain.createEdge({
      projectID: left,
      kind: "related_to",
      sourceID: a.id,
      targetID: b.id,
    }).catch((err) => err)

    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("DomainCrossProjectError")
  })

  test("removes accepted entities across the core domain", async () => {
    const projectID = seed("project-removal")

    await Domain.setTaxonomy({
      projectID,
      nodeKinds: ["claim"],
      runKinds: ["scan"],
      artifactKinds: ["report"],
      decisionKinds: ["accept_claim"],
      decisionStates: ["accepted"],
    })

    const n = await Domain.createNode({
      projectID,
      kind: "claim",
      title: "Claim",
    })
    const r = await Domain.createRun({
      projectID,
      kind: "scan",
      nodeID: n.id,
      status: "completed",
    })
    const art = await Domain.createArtifact({
      projectID,
      kind: "report",
      runID: r.id,
      nodeID: n.id,
    })
    const d = await Domain.createDecision({
      projectID,
      kind: "accept_claim",
      state: "accepted",
      nodeID: n.id,
      runID: r.id,
      artifactID: art.id,
    })

    expect((await Domain.removeDecision(d.id)).id).toBe(d.id)
    expect((await Domain.removeArtifact(art.id)).id).toBe(art.id)
    expect((await Domain.removeRun(r.id)).id).toBe(r.id)

    expect(await Domain.summary(projectID)).toEqual({
      workspaces: 1,
      nodes: 1,
      edges: 0,
      runs: 0,
      artifacts: 0,
      decisions: 0,
      proposals: 0,
      reviews: 0,
      commits: 0,
    })
  })

  test("approving a proposal applies accepted state and records history", async () => {
    const projectID = seed("project-proposal")
    const a = Identifier.ascending("node")
    const b = Identifier.ascending("node")

    await Domain.setTaxonomy({
      projectID,
      nodeKinds: ["claim", "finding"],
      edgeKinds: ["supports"],
    })

    const proposal = await Domain.propose({
      projectID,
      title: "Capture first graph slice",
      actor: {
        type: "user",
        id: "usr_author",
      },
      changes: [
        {
          op: "create_node",
          id: a,
          kind: "claim",
          title: "Claim",
        },
        {
          op: "create_node",
          id: b,
          kind: "finding",
          title: "Finding",
        },
        {
          op: "create_edge",
          kind: "supports",
          sourceID: a,
          targetID: b,
        },
      ],
      rationale: "Move accepted writes behind review",
    })

    expect((await Domain.graph(projectID)).nodes).toHaveLength(0)

    const result = await Domain.reviewProposal({
      proposalID: proposal.id,
      actor: {
        type: "user",
        id: "usr_reviewer",
      },
      verdict: "approve",
      comments: "Looks good",
    })

    const graph = await Domain.graph(projectID)
    const reviews = await Domain.listReviews({
      projectID,
      proposalID: proposal.id,
    })
    const commits = await Domain.listCommits({
      projectID,
      proposalID: proposal.id,
    })

    expect(result.proposal.status).toBe("approved")
    expect(result.review.verdict).toBe("approve")
    expect(result.commit?.proposalID).toBe(proposal.id)
    expect(graph.nodes).toHaveLength(2)
    expect(graph.edges).toHaveLength(1)
    expect(reviews).toHaveLength(1)
    expect(commits).toHaveLength(1)
    expect(await Domain.summary(projectID)).toEqual({
      workspaces: 1,
      nodes: 2,
      edges: 1,
      runs: 0,
      artifacts: 0,
      decisions: 0,
      proposals: 1,
      reviews: 1,
      commits: 1,
    })
  })
})
