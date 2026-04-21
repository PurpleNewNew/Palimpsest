#!/usr/bin/env bun

import { $ } from "bun"

const checks = [
  {
    name: "server",
    cmd: $`bun drizzle-kit check`,
  },
  {
    name: "domain",
    cmd: $`bun --cwd ../../packages/domain drizzle-kit check`,
  },
]

for (const check of checks) {
  const result = await check.cmd.quiet().nothrow()
  if (result.exitCode !== 0) {
    console.error(`${check.name} schema has changes not captured in migrations!`)
    console.error("Run: bun drizzle-kit generate")
    console.error("")
    console.error(result.stderr.toString())
    process.exit(1)
  }
}

console.log("Migrations are up to date")
