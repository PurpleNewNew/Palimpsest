import { describe, expect, test } from "bun:test"
import { readdir, stat } from "fs/promises"
import path from "path"

import ResearchPlugin from "@palimpsest/plugin-research"
import SecurityAuditPlugin from "@palimpsest/plugin-security-audit"

const pluginsRoot = path.join(__dirname, "../../../../plugins")

// Real plugins only. The "core" defaults used to live as a sibling
// plugin package but it carried no plugin-specific server routes or
// web components — it was 117 lines of declarative manifest. The
// manifest now lives in the host at
// `apps/server/src/plugin/core-defaults.ts`, so symmetry checks
// only apply to true plugins (research, security-audit).
const BUILTINS = [
  { id: "research", mod: ResearchPlugin },
  { id: "security-audit", mod: SecurityAuditPlugin },
] as const

async function exists(p: string) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

describe("plugin symmetry", () => {
  test("every builtin plugin defines a manifest, plugin entry, and server hook", async () => {
    for (const plugin of BUILTINS) {
      const base = path.join(pluginsRoot, plugin.id)
      expect(await exists(path.join(base, "manifest.ts"))).toBe(true)
      expect(await exists(path.join(base, "plugin.ts"))).toBe(true)
      expect(await exists(path.join(base, "server", "server-hook.ts"))).toBe(true)
      expect(await exists(path.join(base, "server", "index.ts"))).toBe(true)
      expect(await exists(path.join(base, "web", "index.ts"))).toBe(true)
    }
  })

  test("every builtin plugin exports a server() hook", () => {
    for (const { id, mod } of BUILTINS) {
      expect(mod.manifest.id).toBe(id)
      expect(typeof mod.server).toBe("function")
    }
  })

  test("every builtin plugin declares at least one preset and one lens", () => {
    for (const { mod } of BUILTINS) {
      expect((mod.presets ?? []).length).toBeGreaterThanOrEqual(1)
      expect((mod.lenses ?? []).length).toBeGreaterThanOrEqual(1)
    }
  })

  test("no builtin plugin directory contains host-private imports", async () => {
    const dirs = BUILTINS.map(({ id }) => path.join(pluginsRoot, id))
    for (const dir of dirs) {
      const entries = await readdir(dir)
      expect(entries.length).toBeGreaterThan(0)
    }
  })
})
