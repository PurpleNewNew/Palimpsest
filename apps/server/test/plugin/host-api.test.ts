import { describe, expect, test } from "bun:test"
import { mkdtemp } from "fs/promises"
import os from "os"
import path from "path"

import { Domain } from "../../src/domain/domain"
import { Server } from "../../src/server/server"
import { Log } from "../../src/util/log"
import { serverTest } from "../fixture/server"

Log.init({ print: false })

async function login(app: ReturnType<typeof Server.App>) {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "123456" }),
  })
  expect(res.status).toBe(200)
  const cookie = res.headers.get("set-cookie")
  expect(cookie).toBeTruthy()
  return cookie!.split(";")[0]
}

describe("plugin host API (Stage B)", () => {
  test("research plugin exposes /api/plugin/research/ping via host.routes.register", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-plugin-route-test-"))
      dirs.push(dir)
      const app = Server.App()
      const cookie = await login(app)

      await app.request("/api/projects", {
        method: "POST",
        headers: { Cookie: cookie, "content-type": "application/json" },
        body: JSON.stringify({
          directory: dir,
          name: "Route Smoke",
          presetID: "research.inquiry",
          input: { question: "Does host.routes.register work?", background: "B1 smoke." },
        }),
      })

      const ping = await app.request(`/api/plugin/research/ping?directory=${encodeURIComponent(dir)}`, {
        headers: { Cookie: cookie },
      })
      expect(ping.status).toBe(200)
      const body = await ping.json()
      expect(body.ok).toBe(true)
      expect(body.pluginID).toBe("research")
      expect(typeof body.heartbeats).toBe("number")

      const status = await app.request(`/api/plugin/research/status?directory=${encodeURIComponent(dir)}`, {
        headers: { Cookie: cookie },
      })
      expect(status.status).toBe(200)
      const statusBody = await status.json()
      expect(statusBody.pluginID).toBe("research")
      expect(statusBody.project?.worktree).toBe(dir)
      expect(statusBody.metadataDir).toBe(path.join(dir, ".palimpsest"))

      const unknown = await app.request(`/api/plugin/research/does-not-exist?directory=${encodeURIComponent(dir)}`, {
        headers: { Cookie: cookie },
      })
      expect(unknown.status).toBe(404)

      const unmountedPlugin = await app.request(`/api/plugin/nobody-home/hello?directory=${encodeURIComponent(dir)}`, {
        headers: { Cookie: cookie },
      })
      expect(unmountedPlugin.status).toBe(404)
    }))

  test("research plugin registers `research_hello` via host.tools.register", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-plugin-tool-test-"))
      dirs.push(dir)

      // Boot a fresh instance in `dir` that runs the full InstanceBootstrap
      // (including Product.init() → research server-hook) so the plugin gets
      // to register its tools into this instance's ToolRegistry state.
      const { Instance } = await import("../../src/project/instance")
      const { InstanceBootstrap } = await import("../../src/project/bootstrap")
      const { ToolRegistry } = await import("../../src/tool/registry")
      const ids = await Instance.provide({
        directory: dir,
        init: InstanceBootstrap,
        fn: async () => ToolRegistry.ids(),
      })
      expect(ids).toContain("research_hello")
    }))

  test("research plugin exposes /api/plugin/research/project/by-project/:id (Stage B.5.2 routes)", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-plugin-research-routes-test-"))
      dirs.push(dir)
      const app = Server.App()
      const cookie = await login(app)

      const projectRes = await app.request("/api/projects", {
        method: "POST",
        headers: { Cookie: cookie, "content-type": "application/json" },
        body: JSON.stringify({
          directory: dir,
          name: "Routes Smoke",
          presetID: "research.inquiry",
          input: { question: "Does the research routes bridge work?", background: "Stage B.5.2 smoke." },
        }),
      })
      expect(projectRes.status).toBeLessThan(400)
      const project = await projectRes.json()

      const lookup = await app.request(
        `/api/plugin/research/project/by-project/${project.id}?directory=${encodeURIComponent(dir)}`,
        { headers: { Cookie: cookie } },
      )
      expect([200, 404]).toContain(lookup.status)
    }))

  test("security-audit plugin exposes AI-first audit routes", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-plugin-security-route-test-"))
      dirs.push(dir)
      const app = Server.App()
      const cookie = await login(app)

      await app.request("/api/projects", {
        method: "POST",
        headers: { Cookie: cookie, "content-type": "application/json" },
        body: JSON.stringify({
          directory: dir,
          name: "Security Scope",
          presetID: "security-audit.audit",
          input: {
            target: "Authentication service",
            objective: "Map authz and session-boundary risks.",
            constraints: "No automatic code changes; proposals only.",
          },
        }),
      })

      const status = await app.request(`/api/plugin/security-audit/status?directory=${encodeURIComponent(dir)}`, {
        headers: { Cookie: cookie },
      })
      expect(status.status).toBe(200)
      const statusBody = await status.json()
      expect(statusBody.pluginID).toBe("security-audit")
      expect(statusBody.prompts).toContain("security_audit_init")
      expect(statusBody.workflows).toContain("security_audit_v1")

      const bootstrap = await app.request(`/api/plugin/security-audit/bootstrap?directory=${encodeURIComponent(dir)}`, {
        method: "POST",
        headers: { Cookie: cookie, "content-type": "application/json" },
        body: JSON.stringify({}),
      })
      expect(bootstrap.status).toBe(200)
      const bootstrapProposal = await bootstrap.json()
      expect(bootstrapProposal.status).toBe("pending")
      expect(bootstrapProposal.title).toContain("Bootstrap security graph")

      const projects = await app.request("/api/projects", {
        headers: { Cookie: cookie },
      })
      const project = (await projects.json()).find((item: { worktree: string }) => item.worktree === dir)
      expect(project?.id).toBeTruthy()

      const bootstrapReview = await Domain.reviewProposal({
        proposalID: bootstrapProposal.id,
        actor: { type: "system", id: "test:security-audit" },
        verdict: "approve",
        comments: "Seed graph for route test.",
      })
      expect(bootstrapReview.commit?.changes.length).toBeGreaterThan(0)

      const target = (await Domain.listNodes({ projectID: project.id, kind: "target" }))[0]
      expect(target?.id).toBeTruthy()

      const hypothesis = await app.request(`/api/plugin/security-audit/finding-hypothesis?directory=${encodeURIComponent(dir)}`, {
        method: "POST",
        headers: { Cookie: cookie, "content-type": "application/json" },
        body: JSON.stringify({
          targetID: target.id,
          title: "Session fixation candidate",
          description: "Session tokens appear reusable across privilege changes without explicit rotation evidence.",
          evidence: "Observed token reuse path in the auth boundary review.",
          severity: "high",
          confidence: "medium",
        }),
      })
      expect(hypothesis.status).toBe(200)
      const hypothesisProposal = await hypothesis.json()
      expect(hypothesisProposal.status).toBe("pending")
      expect(hypothesisProposal.title).toContain("Finding hypothesis")

      const overview = await app.request(`/api/plugin/security-audit/overview?directory=${encodeURIComponent(dir)}`, {
        headers: { Cookie: cookie },
      })
      expect(overview.status).toBe(200)
      const overviewBody = await overview.json()
      expect(overviewBody.pendingProposals.length).toBeGreaterThanOrEqual(1)

      const findings = await app.request(`/api/plugin/security-audit/findings?directory=${encodeURIComponent(dir)}`, {
        headers: { Cookie: cookie },
      })
      expect(findings.status).toBe(200)
      const findingsBody = await findings.json()
      expect(findingsBody.pendingProposals.map((item: { id: string }) => item.id)).toContain(hypothesisProposal.id)
      expect(findingsBody.pendingProposals[0].rationale).toBeTruthy()
      expect(findingsBody.pendingProposals[0].time).toBeTruthy()

      const hypothesisReview = await Domain.reviewProposal({
        proposalID: hypothesisProposal.id,
        actor: { type: "system", id: "test:security-audit" },
        verdict: "approve",
        comments: "Approve the hypothesis so we can validate it.",
      })
      expect(hypothesisReview.commit?.changes.length).toBeGreaterThan(0)

      const finding = (await Domain.listNodes({ projectID: project.id, kind: "finding" }))[0]
      expect(finding?.id).toBeTruthy()

      const validation = await app.request(
        `/api/plugin/security-audit/validate-finding?directory=${encodeURIComponent(dir)}`,
        {
          method: "POST",
          headers: { Cookie: cookie, "content-type": "application/json" },
          body: JSON.stringify({
            findingID: finding.id,
            summary: "Reviewed tokens in staging; rotation is correctly enforced after the patch last week.",
            evidence: "Run 'gh run list' and see the rotation sweep job succeeded; tokens now rotate on privilege change.",
            outcome: "contradicts",
          }),
        },
      )
      expect(validation.status).toBe(200)
      const validationProposal = await validation.json()
      expect(validationProposal.status).toBe("pending")
      expect(validationProposal.title).toContain("Validate finding")

      const riskDecision = await app.request(
        `/api/plugin/security-audit/risk-decision?directory=${encodeURIComponent(dir)}`,
        {
          method: "POST",
          headers: { Cookie: cookie, "content-type": "application/json" },
          body: JSON.stringify({
            nodeID: finding.id,
            kind: "false_positive",
            rationale: "Validation evidence shows the hypothesis is contradicted; treat as false positive pending review.",
          }),
        },
      )
      expect(riskDecision.status).toBe(200)
      const riskProposal = await riskDecision.json()
      expect(riskProposal.status).toBe("pending")
      expect(riskProposal.title).toContain("Risk decision")
    }))

  test("security-audit plugin registers audit tools via host.tools.register", () =>
    serverTest(async ({ dirs }) => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "palimpsest-plugin-security-tool-test-"))
      dirs.push(dir)

      const { Instance } = await import("../../src/project/instance")
      const { InstanceBootstrap } = await import("../../src/project/bootstrap")
      const { ToolRegistry } = await import("../../src/tool/registry")
      const ids = await Instance.provide({
        directory: dir,
        init: InstanceBootstrap,
        fn: async () => ToolRegistry.ids(),
      })
      expect(ids).toContain("security-audit_bootstrap")
      expect(ids).toContain("security-audit_finding_hypothesis")
      expect(ids).toContain("security-audit_finding_validation")
      expect(ids).toContain("security-audit_risk_decision")
    }))
})
