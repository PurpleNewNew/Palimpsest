import { describe, expect, test } from "bun:test"
import { mkdtemp } from "fs/promises"
import os from "os"
import path from "path"
import { Server } from "../../src/server/server"
import { Log } from "../../src/util/log"
import { serverTest } from "../fixture/server"

Log.init({ print: false })

async function login(app: ReturnType<typeof Server.App>) {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "123456",
    }),
  })
  expect(res.status).toBe(200)
  const cookie = res.headers.get("set-cookie")
  expect(cookie).toBeTruthy()
  return cookie!.split(";")[0]
}

describe("domain routes", () => {
  test("ordinary writes create proposals before accepted state changes", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "opencode-test-"))
      dirs.push(dir)
      const app = Server.App()
      const cookie = await login(app)
      const headers = {
        "x-palimpsest-directory": dir,
        Cookie: cookie,
      }
      const json = {
        ...headers,
        "content-type": "application/json",
      }

      const tax = await app.request("/domain/taxonomy", {
        method: "PUT",
        headers: json,
        body: JSON.stringify({
          nodeKinds: ["claim", "finding"],
          edgeKinds: ["supports"],
          runKinds: ["scan"],
          artifactKinds: ["report"],
          decisionKinds: ["accept_claim"],
          decisionStates: ["accepted"],
        }),
      })
      expect(tax.status).toBe(200)

      const approve = async (proposalID: string) => {
        const response = await app.request(`/domain/proposal/${proposalID}/review`, {
          method: "POST",
          headers: json,
          body: JSON.stringify({
            actor: {
              type: "user",
              id: "usr_reviewer",
            },
            verdict: "approve",
            comments: "Approved",
          }),
        })
        expect(response.status).toBe(200)
        return response.json()
      }

      const createNode = async (id: string, kind: string, title: string) => {
        const response = await app.request("/domain/node", {
          method: "POST",
          headers: json,
          body: JSON.stringify({
            id,
            kind,
            title,
            author: {
              type: "user",
              id: "usr_author",
            },
          }),
        })
        expect(response.status).toBe(200)
        return response.json()
      }

      const first = await createNode("nod_alpha", "claim", "A")
      expect(first.status).toBe("pending")

      const pending = await app.request("/domain/graph", {
        headers,
      })
      expect((await pending.json()).nodes).toHaveLength(0)

      const firstReview = await approve(first.id)
      expect(firstReview.commit).toBeTruthy()

      const review = await app.request(`/domain/review/${firstReview.review.id}`, {
        headers,
      })
      expect(review.status).toBe(200)
      expect((await review.json()).id).toBe(firstReview.review.id)

      const commit = await app.request(`/domain/commit/${firstReview.commit.id}`, {
        headers,
      })
      expect(commit.status).toBe(200)
      expect((await commit.json()).id).toBe(firstReview.commit.id)

      const second = await createNode("nod_beta", "finding", "B")
      expect(second.status).toBe("pending")
      await approve(second.id)

      const edge = await app.request("/domain/edge", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          kind: "supports",
          sourceID: "nod_alpha",
          targetID: "nod_beta",
          author: {
            type: "user",
            id: "usr_author",
          },
        }),
      })
      expect(edge.status).toBe(200)
      const link = await edge.json()
      expect(link.status).toBe("pending")

      const run = await app.request("/domain/run", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          id: "run_scan",
          kind: "scan",
          title: "Run",
          nodeID: "nod_beta",
          status: "completed",
          actor: {
            type: "agent",
            id: "agt_scan",
            version: "0.1.0",
          },
          author: {
            type: "user",
            id: "usr_author",
          },
        }),
      })
      expect(run.status).toBe(200)
      const task = await run.json()
      expect(task.status).toBe("pending")

      const art = await app.request("/domain/artifact", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          id: "art_report",
          kind: "report",
          title: "Artifact",
          runID: "run_scan",
          nodeID: "nod_beta",
          author: {
            type: "user",
            id: "usr_author",
          },
        }),
      })
      expect(art.status).toBe(200)
      const asset = await art.json()
      expect(asset.status).toBe("pending")

      const decision = await app.request("/domain/decision", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          id: "dec_claim",
          kind: "accept_claim",
          state: "accepted",
          nodeID: "nod_beta",
          runID: "run_scan",
          artifactID: "art_report",
          actor: {
            type: "agent",
            id: "agt_judge",
            version: "0.2.0",
          },
          author: {
            type: "user",
            id: "usr_author",
          },
        }),
      })
      expect(decision.status).toBe(200)
      const verdict = await decision.json()
      expect(verdict.status).toBe("pending")

      const before = await app.request("/domain/graph", {
        headers,
      })
      const draft = await before.json()
      expect(draft.nodes).toHaveLength(2)
      expect(draft.edges).toHaveLength(0)
      expect(draft.runs).toHaveLength(0)
      expect(draft.artifacts).toHaveLength(0)
      expect(draft.decisions).toHaveLength(0)

      await approve(link.id)
      await approve(task.id)
      await approve(asset.id)
      await approve(verdict.id)

      const graph = await app.request("/domain/graph", {
        headers,
      })
      expect(graph.status).toBe(200)
      const body = await graph.json()
      expect(body.nodes).toHaveLength(2)
      expect(body.edges).toHaveLength(1)
      expect(body.runs).toHaveLength(1)
      expect(body.artifacts).toHaveLength(1)
      expect(body.decisions).toHaveLength(1)
      expect(body.runs[0].actor).toEqual({
        type: "agent",
        id: "agt_scan",
        version: "0.1.0",
      })
      expect(body.decisions[0].actor).toEqual({
        type: "agent",
        id: "agt_judge",
        version: "0.2.0",
      })

      const context = await app.request("/domain/context", {
        headers,
      })
      expect(context.status).toBe(200)
      const ctx = await context.json()
      expect(ctx.project.id).toBeTruthy()
      expect(ctx.workspaces.length).toBe(ctx.summary.workspaces)

      const sum = await app.request("/domain/summary", {
        headers,
      })
      expect(sum.status).toBe(200)
      expect(await sum.json()).toEqual({
        workspaces: ctx.workspaces.length,
        nodes: 2,
        edges: 1,
        runs: 1,
        artifacts: 1,
        decisions: 1,
        proposals: 6,
        reviews: 6,
        commits: 6,
      })

      const dispose = await app.request("/instance/dispose", {
        method: "POST",
        headers,
      })
      expect(dispose.status).toBe(200)
    }))

  test("accepted bridge mutates accepted state directly", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "opencode-test-"))
      dirs.push(dir)
      const app = Server.App()
      const cookie = await login(app)
      const headers = {
        "x-palimpsest-directory": dir,
        Cookie: cookie,
      }
      const json = {
        ...headers,
        "content-type": "application/json",
      }

      const tax = await app.request("/domain/taxonomy", {
        method: "PUT",
        headers: json,
        body: JSON.stringify({
          nodeKinds: ["claim"],
          runKinds: ["scan"],
          artifactKinds: ["report"],
          decisionKinds: ["accept_claim"],
          decisionStates: ["accepted"],
        }),
      })
      expect(tax.status).toBe(200)

      const node = await app.request("/domain/accepted/node", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          id: "nod_gamma",
          kind: "claim",
          title: "Gamma",
        }),
      })
      expect(node.status).toBe(200)

      const run = await app.request("/domain/accepted/run", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          actor: {
            type: "system",
            id: "sys_runner",
          },
          id: "run_direct",
          kind: "scan",
          status: "completed",
          nodeID: "nod_gamma",
        }),
      })
      expect(run.status).toBe(200)

      const art = await app.request("/domain/accepted/artifact", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          id: "art_direct",
          kind: "report",
          nodeID: "nod_gamma",
          runID: "run_direct",
          title: "Raw report",
        }),
      })
      expect(art.status).toBe(200)

      const decision = await app.request("/domain/accepted/decision", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          id: "dec_direct",
          kind: "accept_claim",
          state: "accepted",
          nodeID: "nod_gamma",
          runID: "run_direct",
          artifactID: "art_direct",
          actor: {
            type: "user",
            id: "usr_reviewer",
          },
        }),
      })
      expect(decision.status).toBe(200)

      const patch = await app.request("/domain/accepted/decision/dec_direct", {
        method: "PATCH",
        headers: json,
        body: JSON.stringify({
          rationale: "Directly accepted",
          actor: {
            type: "agent",
            id: "agt_judge",
            version: "0.2.0",
          },
        }),
      })
      expect(patch.status).toBe(200)
      expect((await patch.json()).actor).toEqual({
        type: "agent",
        id: "agt_judge",
        version: "0.2.0",
      })

      const context = await app.request("/domain/context", {
        headers,
      })
      expect(context.status).toBe(200)
      const ctx = await context.json()
      expect(ctx.summary.nodes).toBe(1)
      expect(ctx.summary.runs).toBe(1)
      expect(ctx.summary.artifacts).toBe(1)
      expect(ctx.summary.decisions).toBe(1)
      expect(ctx.summary.proposals).toBe(0)
      expect(ctx.summary.reviews).toBe(0)
      expect(ctx.summary.commits).toBe(0)

      const dropDecision = await app.request("/domain/accepted/decision/dec_direct", {
        method: "DELETE",
        headers,
      })
      expect(dropDecision.status).toBe(200)

      const dropArtifact = await app.request("/domain/accepted/artifact/art_direct", {
        method: "DELETE",
        headers,
      })
      expect(dropArtifact.status).toBe(200)

      const dropRun = await app.request("/domain/accepted/run/run_direct", {
        method: "DELETE",
        headers,
      })
      expect(dropRun.status).toBe(200)

      const summary = await app.request("/domain/summary", {
        headers,
      })
      expect(summary.status).toBe(200)
      const body = await summary.json()
      expect(body.nodes).toBe(1)
      expect(body.runs).toBe(0)
      expect(body.artifacts).toBe(0)
      expect(body.decisions).toBe(0)

      const dispose = await app.request("/instance/dispose", {
        method: "POST",
        headers,
      })
      expect(dispose.status).toBe(200)
    }))
})
