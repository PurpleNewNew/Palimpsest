import { createMemo } from "solid-js"

import { usePluginWebHost } from "../../../host-web"

export const popularProviders = ["anthropic", "github-copilot", "openai", "google", "openrouter", "vercel"]
const popularProviderSet = new Set(popularProviders)

export function useProviders() {
  const host = usePluginWebHost()
  const globalSync = host.globalSync()
  const providers = createMemo(() => {
    const dir = host.directory()
    if (dir) {
      const [store] = globalSync.child(dir)
      return store.provider
    }
    return globalSync.data.provider
  })
  const connectedIDs = createMemo(() => new Set(providers().connected))
  const connected = createMemo(() => providers().all.filter((provider) => connectedIDs().has(provider.id)))
  const paid = connected
  const popular = createMemo(() => providers().all.filter((provider) => popularProviderSet.has(provider.id)))
  return {
    all: createMemo(() => providers().all),
    default: createMemo(() => providers().default),
    popular,
    connected,
    paid,
  }
}
