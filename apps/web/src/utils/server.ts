import { createPalimpsestClient } from "@palimpsest/sdk/v2/client"
import type { ServerConnection } from "@/context/server"

export function serverAuthHeaders(server: ServerConnection.HttpBase) {
  if (!server.password) return
  return {
    Authorization: `Basic ${btoa(`${server.username ?? "palimpsest"}:${server.password}`)}`,
  }
}

export function serverFetch(
  server: ServerConnection.HttpBase,
  fetcher: typeof fetch = globalThis.fetch,
): typeof fetch {
  return ((input: Request | URL | string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const auth = serverAuthHeaders(server)
    if (auth) {
      for (const [key, value] of Object.entries(auth)) {
        headers.set(key, value)
      }
    }
    if (input instanceof Request) {
      return fetcher(new Request(input, { credentials: "include", headers }))
    }
    return fetcher(input, {
      ...init,
      credentials: "include",
      headers,
    })
  }) as typeof fetch
}

export function createSdkForServer({
  server,
  ...config
}: Omit<NonNullable<Parameters<typeof createPalimpsestClient>[0]>, "baseUrl"> & {
  server: ServerConnection.HttpBase
}) {
  const auth = serverAuthHeaders(server)

  return createPalimpsestClient({
    ...config,
    fetch: serverFetch(server, config.fetch),
    headers: { ...config.headers, ...auth },
    baseUrl: server.url,
  })
}
