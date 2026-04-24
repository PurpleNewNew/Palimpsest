import { type ParentProps } from "solid-js"
import { useParams } from "@solidjs/router"
import { PluginWebHostContext, type PluginWebHost } from "@palimpsest/plugin-sdk/host-web"

import { useAuth } from "@/context/auth"
import { pluginCapabilities, useWorkspaceCapabilities } from "@/context/permissions"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { decode64 } from "@/utils/base64"
import { serverFetch } from "@/utils/server"

export function PluginWebHostProvider(props: ParentProps) {
  const auth = useAuth()
  const caps = useWorkspaceCapabilities()
  const platform = usePlatform()
  const server = useServer()
  const params = useParams()

  const host: PluginWebHost = {
    directory() {
      return decode64(params.dir) ?? undefined
    },
    workspaceID() {
      return auth.workspaceID() ?? undefined
    },
    actor() {
      const user = auth.user()
      if (user) return { type: "user", id: user.id }
      return { type: "system", id: "web" }
    },
    capabilities() {
      return pluginCapabilities(caps())
    },
    baseURL() {
      return server.current?.http.url
    },
    fetch(url, init) {
      const http = server.current?.http
      if (!http) {
        return Promise.reject(new Error("No server available"))
      }
      const run = serverFetch(http, platform.fetch ?? globalThis.fetch)
      return run(url, init)
    },
  }

  return <PluginWebHostContext.Provider value={host}>{props.children}</PluginWebHostContext.Provider>
}
