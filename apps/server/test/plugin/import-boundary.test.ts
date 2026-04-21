import { describe, expect, test } from "bun:test"
import { readdir, readFile } from "fs/promises"
import path from "path"

const pluginsRoot = path.join(__dirname, "../../../../plugins")

const forbiddenMatchers = [
  {
    label: "host alias imports",
    pattern: /from\s+["']@\/.+["']/,
  },
  {
    label: "server package private imports",
    pattern: /from\s+["']@palimpsest\/server(?:\/|["'])/,
  },
  {
    label: "web package private imports",
    pattern: /from\s+["']@palimpsest\/web(?:\/|["'])/,
  },
  {
    label: "relative imports into apps tree",
    pattern: /from\s+["'][^"']*apps\/(?:server|web)\//,
  },
]

async function scan(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const next = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await scan(next)))
      continue
    }
    if (!/\.(ts|tsx|mts|cts)$/.test(entry.name)) continue
    out.push(next)
  }
  return out
}

describe("plugin import boundaries", () => {
  test("plugin bundles do not import host private source trees", async () => {
    const files = await scan(pluginsRoot)
    const violations: string[] = []

    for (const file of files) {
      const text = await readFile(file, "utf8")
      for (const rule of forbiddenMatchers) {
        const match = text.match(rule.pattern)
        if (!match) continue
        violations.push(`${path.relative(pluginsRoot, file)} -> ${rule.label}: ${match[0]}`)
      }
    }

    expect(violations).toEqual([])
  })

  test("plugin bundles reach the host only through plugin-sdk/host", async () => {
    const files = await scan(pluginsRoot)
    const hostApiImport = /from\s+["']@palimpsest\/plugin-sdk\/host["']/
    const hooks = files.filter((file) => /server-hook\.ts$/.test(file))
    expect(hooks.length).toBeGreaterThan(0)
    for (const file of hooks) {
      const text = await readFile(file, "utf8")
      expect(hostApiImport.test(text)).toBe(true)
    }
  })
})
