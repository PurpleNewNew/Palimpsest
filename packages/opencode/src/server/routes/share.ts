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

export const SharePageRoutes = lazy(() =>
  new Hono()
    .get("/:slug", async (c) => {
      const slug = c.req.param("slug")
      const meta = await ControlPlane.shareMeta(slug)
      const data = await ControlPlane.shareData(slug)
      if (!meta || !data) return c.text("Share not found", 404)
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
          <p>Raw data: <a href="/api/shares/${escape(slug)}/data">/api/shares/${escape(slug)}/data</a></p>
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
