export * from "./client.js"
export * from "./server.js"

import { createPalimpsestClient } from "./client.js"
import { createPalimpsestServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export async function createPalimpsest(options?: ServerOptions) {
  const server = await createPalimpsestServer({
    ...options,
  })

  const client = createPalimpsestClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}

export const createOpencode = createPalimpsest
