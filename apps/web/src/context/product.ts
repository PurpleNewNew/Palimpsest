import { createMemo } from "solid-js"
import { PresetInfo, ProjectShell, RegistryInfo, SessionAttachment } from "@palimpsest/plugin-sdk/product"
import z from "zod"

import { useAuth } from "@/context/auth"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { serverFetch } from "@/utils/server"

const Presets = z.array(PresetInfo)
const Attachments = z.array(SessionAttachment)

async function fail(res: Response) {
  const body = await res.json().catch(() => undefined)
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
    throw new Error(body.message)
  }
  throw new Error(`Request failed: ${res.status}`)
}

export function useProduct() {
  const auth = useAuth()
  const platform = usePlatform()
  const server = useServer()

  const send = createMemo(() => {
    const http = server.current?.http
    if (!http) return
    return serverFetch(http, platform.fetch ?? globalThis.fetch)
  })

  const base = createMemo(() => server.current?.http.url)

  async function json<T>(path: string, init: RequestInit | undefined, parse: (value: unknown) => T) {
    const run = send()
    const root = base()
    if (!run || !root) throw new Error("No server available")
    const headers = new Headers(init?.headers)
    if (auth.workspaceID()) headers.set("x-palimpsest-workspace", auth.workspaceID()!)
    if (init?.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json")
    }
    const res = await run(new URL(path, root), {
      ...init,
      headers,
    })
    if (!res.ok) await fail(res)
    return parse(await res.json())
  }

  return {
    registry() {
      return json("/api/plugins/registry", undefined, (value) => RegistryInfo.parse(value))
    },
    presets() {
      return json("/api/plugins/presets", undefined, (value) => Presets.parse(value))
    },
    shell(projectID: string) {
      return json(`/api/projects/${projectID}/shell`, undefined, (value) => ProjectShell.parse(value))
    },
    sessionAttachments(sessionID: string) {
      return json(`/api/session/${sessionID}/attachments`, undefined, (value) => Attachments.parse(value))
    },
    replaceSessionAttachments(sessionID: string, attachments: z.input<typeof SessionAttachment>[]) {
      return json(
        `/api/session/${sessionID}/attachments`,
        {
          method: "PUT",
          body: JSON.stringify({ attachments }),
        },
        (value) => Attachments.parse(value),
      )
    },
    create(input: {
      directory: string
      name?: string
      presetID: string
      input?: Record<string, string>
    }) {
      return json(
        "/api/projects",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        (value) => ProjectShell.parse(value),
      )
    },
  }
}
