import { afterEach, describe, expect, test } from "bun:test"
import { Domain } from "../../src/domain/domain"
import { WorkspaceTable } from "../../src/control-plane/workspace.sql"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { ProjectTable } from "../../src/project/project.sql"
import { Database } from "../../src/storage/db"
import { Bus } from "../../src/bus"
import { Log } from "../../src/util/log"
import { resetDatabase } from "../fixture/db"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

const SYSTEM = { type: "system" as const, id: "test_system" }
const USER = { type: "user" as const, id: "usr_author" }
const REVIEWER = { type: "user" as const, id: "usr_reviewer" }

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
      actor: SYSTEM,
    })
    const b = await Domain.createNode({
      projectID,
      kind: "finding",
      title: "Observed result",
      actor: SYSTEM,
    })
    const e = await Domain.createEdge({
      projectID,
      kind: "supports",
      sourceID: a.id,
      targetID: b.id,
      actor: SYSTEM,
    })
    const edge = await Domain.updateEdge({
      id: e.id,
      note: "Evidence chain",
      actor: SYSTEM,
    })
    const r = await Domain.createRun({
      projectID,
      kind: "scan",
      title: "Baseline scan",
      status: "completed",
      nodeID: b.id,
      actor: SYSTEM,
      triggeredBy: {
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
      actor: SYSTEM,
    })
    const asset = await Domain.updateArtifact({
      id: art.id,
      title: "Published report",
      storageURI: "file:///tmp/report.json",
      actor: SYSTEM,
    })
    const d = await Domain.createDecision({
      projectID,
      kind: "accept_claim",
      state: "accepted",
      nodeID: b.id,
      runID: r.id,
      artifactID: art.id,
      rationale: "Evidence is sufficient",
      actor: SYSTEM,
      decidedBy: {
        type: "user",
        id: "usr_reviewer",
      },
    })
    const decision = await Domain.updateDecision({
      id: d.id,
      rationale: "Evidence is sufficient and repeatable",
      actor: SYSTEM,
      decidedBy: {
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

    expect(graph.nodes.map((item: (typeof graph.nodes)[number]) => item.kind)).toEqual(["claim", "finding"])
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
      actor: SYSTEM,
    }).catch((err: unknown) => err)

    expect(err).toBeInstanceOf(Error)
    expect((err as Error).name).toBe("DomainInvalidTaxonomyError")
  })

  test("refuses direct write methods from non-system actors", async () => {
    const projectID = seed("project-gating")
    await Domain.setTaxonomy({ projectID, nodeKinds: ["claim"] })

    const err = await Domain.createNode({
      projectID,
      kind: "claim",
      title: "Should fail",
      actor: USER,
    }).catch((err: unknown) => err)

    expect(err).toBeInstanceOf(Error)
    expect((err as Error).name).toBe("DomainAuthorizationError")
  })

  test("rejects cross-project links", async () => {
    const left = seed("project-left")
    const right = seed("project-right")

    const a = await Domain.createNode({
      projectID: left,
      kind: "claim",
      title: "Left node",
      actor: SYSTEM,
    })
    const b = await Domain.createNode({
      projectID: right,
      kind: "claim",
      title: "Right node",
      actor: SYSTEM,
    })

    const err = await Domain.createEdge({
      projectID: left,
      kind: "related_to",
      sourceID: a.id,
      targetID: b.id,
      actor: SYSTEM,
    }).catch((err: unknown) => err)

    expect(err).toBeInstanceOf(Error)
    expect((err as Error).name).toBe("DomainCrossProjectError")
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
      actor: SYSTEM,
    })
    const r = await Domain.createRun({
      projectID,
      kind: "scan",
      nodeID: n.id,
      status: "completed",
      actor: SYSTEM,
    })
    const art = await Domain.createArtifact({
      projectID,
      kind: "report",
      runID: r.id,
      nodeID: n.id,
      actor: SYSTEM,
    })
    const d = await Domain.createDecision({
      projectID,
      kind: "accept_claim",
      state: "accepted",
      nodeID: n.id,
      runID: r.id,
      artifactID: art.id,
      actor: SYSTEM,
    })

    expect((await Domain.removeDecision({ id: d.id, actor: SYSTEM })).id).toBe(d.id)
    expect((await Domain.removeArtifact({ id: art.id, actor: SYSTEM })).id).toBe(art.id)
    expect((await Domain.removeRun({ id: r.id, actor: SYSTEM })).id).toBe(r.id)

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
      actor: USER,
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

    expect(proposal.revision).toBe(1)
    expect((await Domain.graph(projectID)).nodes).toHaveLength(0)

    const result = await Domain.reviewProposal({
      proposalID: proposal.id,
      actor: REVIEWER,
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

    const edgeChange = result.commit!.changes.find((change) => change.op === "create_edge")
    expect(edgeChange).toBeDefined()
    expect((edgeChange as { id: string }).id).toBe(graph.edges[0].id)

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

  test("request_changes keeps the proposal pending and reviseProposal bumps revision", async () => {
    const projectID = seed("project-revision")
    await Domain.setTaxonomy({ projectID, nodeKinds: ["claim"] })

    const proposal = await Domain.propose({
      projectID,
      title: "Draft claim",
      actor: USER,
      changes: [{ op: "create_node", kind: "claim", title: "Claim v1" }],
    })

    const first = await Domain.reviewProposal({
      proposalID: proposal.id,
      actor: REVIEWER,
      verdict: "request_changes",
      comments: "Title too vague",
    })
    expect(first.proposal.status).toBe("pending")
    expect(first.proposal.revision).toBe(1)
    expect((await Domain.graph(projectID)).nodes).toHaveLength(0)

    const revised = await Domain.reviseProposal({
      id: proposal.id,
      actor: USER,
      changes: [{ op: "create_node", kind: "claim", title: "Claim v2 (clarified)" }],
      rationale: "Addressed review comments",
    })
    expect(revised.status).toBe("pending")
    expect(revised.revision).toBe(2)

    const second = await Domain.reviewProposal({
      proposalID: proposal.id,
      actor: REVIEWER,
      verdict: "approve",
    })
    expect(second.proposal.status).toBe("approved")
    expect(second.proposal.revision).toBe(2)
    const graph = await Domain.graph(projectID)
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes[0].title).toBe("Claim v2 (clarified)")
  })

  test("reviseProposal refuses a caller that is not the original proposer", async () => {
    const projectID = seed("project-proposer-check")
    await Domain.setTaxonomy({ projectID, nodeKinds: ["claim"] })

    const proposal = await Domain.propose({
      projectID,
      actor: USER,
      changes: [{ op: "create_node", kind: "claim", title: "Claim" }],
    })

    const err = await Domain.reviseProposal({
      id: proposal.id,
      actor: { type: "user", id: "usr_intruder" },
      rationale: "I should not be able to do this",
    }).catch((err: unknown) => err)

    expect(err).toBeInstanceOf(Error)
    expect((err as Error).name).toBe("DomainProposerMismatchError")
  })

  test("withdrawProposal moves a pending proposal to withdrawn", async () => {
    const projectID = seed("project-withdraw")
    await Domain.setTaxonomy({ projectID, nodeKinds: ["claim"] })

    const proposal = await Domain.propose({
      projectID,
      actor: USER,
      changes: [{ op: "create_node", kind: "claim", title: "Claim" }],
    })

    const withdrawn = await Domain.withdrawProposal({ id: proposal.id, actor: USER })
    expect(withdrawn.status).toBe("withdrawn")

    const err = await Domain.reviewProposal({
      proposalID: proposal.id,
      actor: REVIEWER,
      verdict: "approve",
    }).catch((err: unknown) => err)

    expect(err).toBeInstanceOf(Error)
    expect((err as Error).name).toBe("DomainProposalStateError")
  })

  test("publishes domain.proposal.* bus events on the propose/review lifecycle", async () => {
    await using tmp = await tmpdir()
    const projectID = seed("project-bus")
    await Domain.setTaxonomy({ projectID, nodeKinds: ["claim"] })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const events: string[] = []
        const unsubs = [
          Bus.subscribe(Domain.Event.ProposalCreated, () => {
            events.push("created")
          }),
          Bus.subscribe(Domain.Event.ProposalReviewed, () => {
            events.push("reviewed")
          }),
          Bus.subscribe(Domain.Event.ProposalCommitted, () => {
            events.push("committed")
          }),
          Bus.subscribe(Domain.Event.ProposalWithdrawn, () => {
            events.push("withdrawn")
          }),
        ]

        try {
          const proposal = await Domain.propose({
            projectID,
            actor: USER,
            changes: [{ op: "create_node", kind: "claim", title: "Claim" }],
          })
          await Bus.publish(Domain.Event.ProposalCreated, proposal)

          const result = await Domain.reviewProposal({
            proposalID: proposal.id,
            actor: REVIEWER,
            verdict: "approve",
          })
          await Bus.publish(Domain.Event.ProposalReviewed, result)
          if (result.commit) await Bus.publish(Domain.Event.ProposalCommitted, result.commit)

          expect(events).toEqual(["created", "reviewed", "committed"])
        } finally {
          for (const unsub of unsubs) unsub()
        }
      },
    })
  })
})
