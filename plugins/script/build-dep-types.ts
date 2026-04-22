#!/usr/bin/env bun
import { $ } from "bun"
import path from "path"
import { fileURLToPath } from "url"

const root = fileURLToPath(new URL("../..", import.meta.url))

const dirs = [
  "packages/shared",
  "packages/sdk/js",
  "packages/domain",
  "packages/runner",
  "packages/plugin-sdk",
  "packages/ui",
]

for (const dir of dirs) {
  await $`bun run build:types`.cwd(path.join(root, dir))
}
