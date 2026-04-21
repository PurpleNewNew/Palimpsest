import { existsSync } from "fs"
import path from "path"

const PRIMARY_METADATA_DIR = ".palimpsest"
const LEGACY_METADATA_DIR = ".openresearch"

export namespace ProjectPaths {
  export function metadataDir(worktree: string) {
    const primary = path.join(worktree, PRIMARY_METADATA_DIR)
    const legacy = path.join(worktree, LEGACY_METADATA_DIR)
    if (!existsSync(primary) && existsSync(legacy)) return legacy
    return primary
  }

  export function plansDir(worktree: string) {
    return path.join(metadataDir(worktree), "plans")
  }

  export function worktreesDir(root: string) {
    const primary = path.join(root, ".palimpsest_worktrees")
    const legacy = path.join(root, ".openresearch_worktrees")
    if (!existsSync(primary) && existsSync(legacy)) return legacy
    return primary
  }
}
