import { mkdir, rm } from "fs/promises"
import os from "os"
import path from "path"

import { resetDatabase } from "./db"

const LOCK = path.join(os.tmpdir(), "palimpsest-opencode-server-test.lock")

async function acquire() {
  while (true) {
    try {
      await mkdir(LOCK)
      return
    } catch (err) {
      if (!(err instanceof Error) || !("code" in err) || err.code !== "EEXIST") throw err
      await Bun.sleep(25)
    }
  }
}

async function release() {
  await rm(LOCK, { recursive: true, force: true }).catch(() => undefined)
}

export async function serverTest(fn: (ctx: { dirs: string[] }) => Promise<void>) {
  const dirs: string[] = []
  await acquire()
  try {
    await fn({ dirs })
  } finally {
    await resetDatabase()
    await Bun.sleep(100)
    while (dirs.length) {
      const dir = dirs.pop()
      if (!dir) continue
      await rm(dir, { recursive: true, force: true }).catch(() => undefined)
    }
    await release()
  }
}
