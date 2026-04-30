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

  // Chat-subsystem accessors. Globally-mounted contexts (sdk / sync /
  // globalSync / settings / language / permission / command) are hooked
  // once at provider init — they are always available at DirectoryLayout
  // scope.
  //
  // Session-scoped contexts (prompt / local / layout / product / file /
  // comments) are only mounted inside SessionProviders. Since the
  // PluginWebHostProvider itself sits OUTSIDE SessionProviders, we must
  // resolve these lazily in each getter. Solid's `useContext` walks the
  // owner chain at call time, so lazy evaluation picks up the concrete
  // provider once a plugin component actually requests the slice from
  // inside a session route. On non-session routes the hook throws, we
  // return undefined — non-session routes never touch these slices.
  function lazyUse<T>(use: () => T): () => T | undefined {
    return () => {
      try {
        return use()
      } catch {
        return undefined
      }
    }
  }

  const sdk = useSDK()
  const sync = useSync()
  const globalSync = useGlobalSync()
  const settings = useSettings()
  const language = useLanguage()
  const permission = usePermission()
  const command = useCommand()

  const promptLazy = lazyUse(usePrompt)
  const localLazy = lazyUse(useLocal)
  const layoutLazy = lazyUse(useLayout)
  const productLazy = lazyUse(useProduct)
  const fileLazy = lazyUse(useFile)
  const commentsLazy = lazyUse(useComments)

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
      return promptLazy() as unknown as PluginWebHostPrompt
    },
    local(): PluginWebHostLocal {
      return localLazy() as unknown as PluginWebHostLocal
    },
    layout(): PluginWebHostLayout {
      return layoutLazy() as unknown as PluginWebHostLayout
    },
    product(): PluginWebHostProduct {
      return productLazy() as unknown as PluginWebHostProduct
    },
    platform(): PluginWebHostPlatformSlice {
      return platform as unknown as PluginWebHostPlatformSlice
    },
    file(): PluginWebHostFile {
      return fileLazy() as unknown as PluginWebHostFile
    },
    comments(): PluginWebHostComments {
      return commentsLazy() as unknown as PluginWebHostComments
    },
    command(): PluginWebHostCommandRegistry {
      return command as unknown as PluginWebHostCommandRegistry
    },
  }

  return <PluginWebHostContext.Provider value={host}>{props.children}</PluginWebHostContext.Provider>
}
