import { Hono } from "hono"
import { ControlPlane } from "@/control-plane/control-plane"
import { lazy } from "@/util/lazy"

function escape(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function renderJson(value: unknown) {
  return `<code>${escape(JSON.stringify(value, null, 2))}</code>`
}

function objectPage(input: {
  title: string
  eyebrow: string
  description: string
  metaRows: Array<[string, string]>
  sections: Array<{ title: string; body: string }>
  rawPath: string
}) {
  const rows = input.metaRows
    .map(
      ([label, value]) =>
        `<p><strong>${escape(label)}:</strong> ${escape(value)}</p>`,
    )
    .join("")
  const sections = input.sections
    .map(
      (section) => `
        <section class="card">
          <div class="section-title">${escape(section.title)}</div>
          ${section.body}
        </section>
      `,
    )
    .join("")
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(input.title)}</title>
    <style>
      :root { color-scheme: light; font-family: "IBM Plex Sans", "Segoe UI", sans-serif; }
      body { margin: 0; background: linear-gradient(180deg, #f4f1ea 0%, #fcfbf7 100%); color: #1f1a14; }
      main { max-width: 920px; margin: 0 auto; padding: 56px 24px 96px; }
      .eyebrow { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #e8dbc7; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
      h1 { margin: 18px 0 12px; font-size: clamp(32px, 8vw, 56px); line-height: 1; }
      p { margin: 0; font-size: 16px; line-height: 1.6; color: #5a4f42; }
      .card { margin-top: 24px; padding: 20px 22px; border-radius: 20px; background: rgba(255,255,255,.7); box-shadow: 0 18px 48px rgba(63,42,18,.08); backdrop-filter: blur(12px); }
      .meta { display: grid; gap: 10px; margin-top: 20px; }
      .section-title { font-size: 11px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: #6d6357; }
      .list { margin-top: 12px; display: grid; gap: 10px; }
      .item { border-radius: 16px; background: rgba(244,241,234,.9); padding: 12px 14px; }
      .item strong { color: #1f1a14; }
      code { display: block; white-space: pre-wrap; word-break: break-word; margin-top: 16px; padding: 14px 16px; border-radius: 16px; background: #1f1a14; color: #f4f1ea; font-family: "IBM Plex Mono", monospace; font-size: 13px; }
      a { color: #9b4d1d; }
    </style>
  </head>
  <body>
    <main>
      <span class="eyebrow">${escape(input.eyebrow)}</span>
      <h1>${escape(input.title)}</h1>
      <p>${escape(input.description)}</p>
      <div class="card">
        <div class="meta">${rows}<p><strong>Raw data:</strong> <a href="${escape(input.rawPath)}">${escape(input.rawPath)}</a></p></div>
      </div>
      ${sections}
    </main>
  </body>
</html>`
}

function listSection(items: string[]) {
  if (items.length === 0) return `<div class="item">Nothing linked yet.</div>`
  return `<div class="list">${items.map((item) => `<div class="item">${item}</div>`).join("")}</div>`
}

export const SharePageRoutes = lazy(() =>
  new Hono()
    .get("/:slug", async (c) => {
      const slug = c.req.param("slug")
      const meta = await ControlPlane.shareMeta(slug)
      const data = await ControlPlane.shareData(slug)
      if (!meta || !data) return c.text("Share not found", 404)
      const rawPath = `/api/shares/${escape(slug)}/data`
      if (!Array.isArray(data)) {
        switch (data.type) {
          case "node_share": {
            const { context, node, incomingEdges, outgoingEdges, proposals, runs, artifacts, decisions } = data.data
            return c.html(
              objectPage({
                title: node.title,
                eyebrow: "Shared node",
                description: `A domain node shared from ${context.project.name ?? context.project.id}.`,
                rawPath,
                metaRows: [
                  ["Kind", node.kind],
                  ["Node ID", node.id],
                  ["Project", context.project.name ?? context.project.id],
                ],
                sections: [
                  ...(node.body ? [{ title: "Body", body: renderJson({ body: node.body }) }] : []),
                  {
                    title: "Graph context",
                    body: listSection([
                      ...incomingEdges.map(
                        (edge: { kind: string; sourceID: string }) =>
                          `<strong>${escape(edge.kind)}</strong> ← ${escape(edge.sourceID)}`,
                      ),
                      ...outgoingEdges.map(
                        (edge: { kind: string; targetID: string }) =>
                          `<strong>${escape(edge.kind)}</strong> → ${escape(edge.targetID)}`,
                      ),
                    ]),
                  },
                  {
                    title: "Linked work",
                    body: listSection([
                      ...proposals.map(
                        (proposal: { id: string; title?: string }) =>
                          `<strong>proposal</strong> ${escape(proposal.title ?? proposal.id)}`,
                      ),
                      ...runs.map(
                        (run: { id: string; title?: string; status: string }) =>
                          `<strong>run</strong> ${escape(run.title ?? run.id)} · ${escape(run.status)}`,
                      ),
                      ...artifacts.map(
                        (artifact: { id: string; title?: string }) =>
                          `<strong>artifact</strong> ${escape(artifact.title ?? artifact.id)}`,
                      ),
                      ...decisions.map(
                        (decision: { kind: string; state?: string }) =>
                          `<strong>decision</strong> ${escape(decision.kind)} · ${escape(decision.state ?? "—")}`,
                      ),
                    ]),
                  },
                ],
              }),
            )
          }
          case "run_share": {
            const { context, run, node, proposals, artifacts, decisions } = data.data
            return c.html(
              objectPage({
                title: run.title ?? run.id,
                eyebrow: "Shared run",
                description: `A run shared from ${context.project.name ?? context.project.id}.`,
                rawPath,
                metaRows: [
                  ["Kind", run.kind],
                  ["Run ID", run.id],
                  ["Status", run.status],
                ],
                sections: [
                  {
                    title: "Linked objects",
                    body: listSection([
                      ...(node ? [`<strong>node</strong> ${escape(node.title)}`] : []),
                      ...artifacts.map(
                        (artifact: { id: string; title?: string }) =>
                          `<strong>artifact</strong> ${escape(artifact.title ?? artifact.id)}`,
                      ),
                      ...decisions.map(
                        (decision: { kind: string; state?: string }) =>
                          `<strong>decision</strong> ${escape(decision.kind)} · ${escape(decision.state ?? "—")}`,
                      ),
                      ...proposals.map(
                        (proposal: { id: string; title?: string }) =>
                          `<strong>proposal</strong> ${escape(proposal.title ?? proposal.id)}`,
                      ),
                    ]),
                  },
                  ...(run.manifest ? [{ title: "Manifest", body: renderJson(run.manifest) }] : []),
                ],
              }),
            )
          }
          case "proposal_share": {
            const { context, proposal, reviews, commit, affected } = data.data
            return c.html(
              objectPage({
                title: proposal.title ?? proposal.id,
                eyebrow: "Shared proposal",
                description: `A proposal review workspace shared from ${context.project.name ?? context.project.id}.`,
                rawPath,
                metaRows: [
                  ["Proposal ID", proposal.id],
                  ["Status", proposal.status],
                  ["Revision", String(proposal.revision)],
                ],
                sections: [
                  ...(proposal.rationale ? [{ title: "Rationale", body: renderJson({ rationale: proposal.rationale }) }] : []),
                  { title: "Changes", body: renderJson(proposal.changes) },
                  {
                    title: "Affected objects",
                    body: listSection([
                      ...affected.nodes.map((node) => `<strong>node</strong> ${escape(node.title)} · ${escape(node.kind)}`),
                      ...affected.runs.map((run) => `<strong>run</strong> ${escape(run.title ?? run.id)} · ${escape(run.kind)}`),
                      ...affected.artifacts.map((artifact) => `<strong>artifact</strong> ${escape(artifact.title ?? artifact.id)}`),
                      ...affected.decisions.map((decision) => `<strong>decision</strong> ${escape(decision.kind)} · ${escape(decision.state ?? "—")}`),
                    ]),
                  },
                  {
                    title: "Review history",
                    body: listSection([
                      ...reviews.map(
                        (review: { verdict: string; actor: { type: string; id: string }; comments?: string }) =>
                          `<strong>${escape(review.verdict)}</strong> · ${escape(review.actor.type)}:${escape(review.actor.id)}${review.comments ? ` · ${escape(review.comments)}` : ""}`,
                      ),
                      ...(commit
                        ? [`<strong>commit</strong> ${escape(commit.id)} · ${escape(commit.actor.type)}:${escape(commit.actor.id)}`]
                        : []),
                    ]),
                  },
                ],
              }),
            )
          }
          case "decision_share": {
            const { context, decision, createdBy, supersedes, supersededBy, node, run, artifact, updateCommits } = data.data
            return c.html(
              objectPage({
                title: decision.kind,
                eyebrow: "Shared decision",
                description: `A decision provenance workspace shared from ${context.project.name ?? context.project.id}.`,
                rawPath,
                metaRows: [
                  ["Decision ID", decision.id],
                  ["State", decision.state ?? "—"],
                  ["Project", context.project.name ?? context.project.id],
                ],
                sections: [
                  ...(decision.rationale ? [{ title: "Rationale", body: renderJson({ rationale: decision.rationale }) }] : []),
                  {
                    title: "Provenance",
                    body: listSection([
                      ...(createdBy?.proposal
                        ? [`<strong>proposal</strong> ${escape(createdBy.proposal.title ?? createdBy.proposal.id)}`]
                        : []),
                      ...(createdBy?.commit
                        ? [`<strong>commit</strong> ${escape(createdBy.commit.id)} · ${escape(createdBy.commit.actor.type)}:${escape(createdBy.commit.actor.id)}`]
                        : []),
                      ...(createdBy?.reviews ?? []).map(
                        (review: { verdict: string; actor: { type: string; id: string } }) =>
                          `<strong>${escape(review.verdict)}</strong> review · ${escape(review.actor.type)}:${escape(review.actor.id)}`,
                      ),
                      ...updateCommits.map(
                        (commit: { id: string; time: { created: number } }) =>
                          `<strong>later commit</strong> ${escape(commit.id)} · ${new Date(commit.time.created).toLocaleString()}`,
                      ),
                    ]),
                  },
                  {
                    title: "Linked objects",
                    body: listSection([
                      ...(node ? [`<strong>node</strong> ${escape(node.title)}`] : []),
                      ...(run ? [`<strong>run</strong> ${escape(run.title ?? run.id)} · ${escape(run.status)}`] : []),
                      ...(artifact ? [`<strong>artifact</strong> ${escape(artifact.title ?? artifact.id)}`] : []),
                      ...supersedes.map(
                        (item: { kind: string; state?: string }) =>
                          `<strong>supersedes</strong> ${escape(item.kind)} · ${escape(item.state ?? "—")}`,
                      ),
                      ...(supersededBy ? [`<strong>superseded by</strong> ${escape(supersededBy.kind)} · ${escape(supersededBy.state ?? "—")}`] : []),
                    ]),
                  },
                ],
              }),
            )
          }
        }
      }
      const session = data.find((item) => item.type === "session")
      const title = session?.type === "session" ? session.data.title : meta.title || "Shared session"
      const text = data.filter((item) => item.type === "message").length
      const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(title)}</title>
    <style>
      :root { color-scheme: light; font-family: "IBM Plex Sans", "Segoe UI", sans-serif; }
      body { margin: 0; background: linear-gradient(180deg, #f4f1ea 0%, #fcfbf7 100%); color: #1f1a14; }
      main { max-width: 760px; margin: 0 auto; padding: 64px 24px 96px; }
      .eyebrow { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #e8dbc7; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
      h1 { margin: 18px 0 12px; font-size: clamp(32px, 8vw, 56px); line-height: 1; }
      p { margin: 0; font-size: 16px; line-height: 1.6; color: #5a4f42; }
      .card { margin-top: 28px; padding: 20px 22px; border-radius: 20px; background: rgba(255,255,255,.7); box-shadow: 0 18px 48px rgba(63,42,18,.08); backdrop-filter: blur(12px); }
      .meta { display: grid; gap: 10px; margin-top: 20px; }
      code { display: block; white-space: pre-wrap; word-break: break-all; margin-top: 16px; padding: 14px 16px; border-radius: 16px; background: #1f1a14; color: #f4f1ea; font-family: "IBM Plex Mono", monospace; font-size: 13px; }
      a { color: #9b4d1d; }
    </style>
  </head>
  <body>
    <main>
      <span class="eyebrow">Palimpsest Share</span>
      <h1>${escape(title)}</h1>
      <p>This session is shared from workspace <strong>${escape(meta.workspaceID)}</strong>.</p>
      <div class="card">
        <div class="meta">
          <p>Messages: <strong>${text}</strong></p>
          <p>Session ID: <strong>${escape(meta.sessionID ?? "")}</strong></p>
          <p>Raw data: <a href="${rawPath}">${rawPath}</a></p>
        </div>
        <code>${escape(JSON.stringify(session?.type === "session" ? session.data : meta, null, 2))}</code>
      </div>
    </main>
  </body>
</html>`
      return c.html(body)
    }),
)

export const ShareApiRoutes = lazy(() =>
  new Hono().get("/:slug/data", async (c) => {
      const data = await ControlPlane.shareData(c.req.param("slug"))
      if (!data) return c.json({ message: "Share not found" }, 404)
      return c.json(data)
    }),
)
