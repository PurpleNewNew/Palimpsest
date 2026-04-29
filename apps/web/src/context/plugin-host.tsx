import { type ParentProps } from "solid-js"
import { useParams } from "@solidjs/router"
import {
  PluginWebHostContext,
  type PluginWebHost,
  type PluginWebHostSDK,
  type PluginWebHostSync,
  type PluginWebHostGlobalSync,
  type PluginWebHostSettings,
  type PluginWebHostLanguage,
  type PluginWebHostPermission,
  type PluginWebHostPrompt,
  type PluginWebHostLocal,
  type PluginWebHostLayout,
  type PluginWebHostProduct,
  type PluginWebHostPlatform as PluginWebHostPlatformSlice,
  type PluginWebHostFile,
  type PluginWebHostComments,
  type PluginWebHostCommandRegistry,
} from "@palimpsest/plugin-sdk/host-web"

import { useAuth } from "@/context/auth"
import { pluginCapabilities, useWorkspaceCapabilities } from "@/context/permissions"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { useGlobalSync } from "@/context/global-sync"
import { useSettings } from "@/context/settings"
import { useLanguage } from "@/context/language"
import { usePermission } from "@/context/permission"
import { usePrompt } from "@/context/prompt"
import { useLocal } from "@/context/local"
import { useLayout } from "@/context/layout"
import { useProduct } from "@/context/product"
import { useFile } from "@/context/file"
import { useComments } from "@/context/comments"
import { useCommand } from "@/context/command"
import { decode64 } from "@/utils/base64"
import { serverFetch } from "@/utils/server"

export function PluginWebHostProvider(props: ParentProps) {
  const auth = useAuth()
  const caps = useWorkspaceCapabilities()
  const platform = usePlatform()
  const server = useServer()
  const params = useParams()

  // Chat-subsystem accessors. Each host context is hooked once at the
  // provider level and re-exposed as a getter on the PluginWebHost
  // value. Plugin code calling `host.sync()` etc. gets the host's
  // reactive store directly — Solid's reactivity passes through.
  const sdk = useSDK()
  const sync = useSync()
  const globalSync = useGlobalSync()
  const settings = useSettings()
  const language = useLanguage()
  const permission = usePermission()
  const prompt = usePrompt()
  const local = useLocal()
  const layout = useLayout()
  const product = useProduct()
  const file = useFile()
  const comments = useComments()
  const command = useCommand()

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
    sdk(): PluginWebHostSDK {
      return sdk as unknown as PluginWebHostSDK
    },
    sync(): PluginWebHostSync {
      return sync as unknown as PluginWebHostSync
    },
    globalSync(): PluginWebHostGlobalSync {
      return globalSync as unknown as PluginWebHostGlobalSync
    },
    settings(): PluginWebHostSettings {
      return settings as unknown as PluginWebHostSettings
    },
    language(): PluginWebHostLanguage {
      return language as unknown as PluginWebHostLanguage
    },
    permission(): PluginWebHostPermission {
      return permission as unknown as PluginWebHostPermission
    },
    prompt(): PluginWebHostPrompt {
      return prompt as unknown as PluginWebHostPrompt
    },
    local(): PluginWebHostLocal {
      return local as unknown as PluginWebHostLocal
    },
    layout(): PluginWebHostLayout {
      return layout as unknown as PluginWebHostLayout
    },
    product(): PluginWebHostProduct {
      return product as unknown as PluginWebHostProduct
    },
    platform(): PluginWebHostPlatformSlice {
      return platform as unknown as PluginWebHostPlatformSlice
    },
    file(): PluginWebHostFile {
      return file as unknown as PluginWebHostFile
    },
    comments(): PluginWebHostComments {
      return comments as unknown as PluginWebHostComments
    },
    command(): PluginWebHostCommandRegistry {
      return command as unknown as PluginWebHostCommandRegistry
    },
  }

  return <PluginWebHostContext.Provider value={host}>{props.children}</PluginWebHostContext.Provider>
}
