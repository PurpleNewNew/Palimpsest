import path from "path"

const PRIMARY_METADATA_DIR = ".palimpsest"

export namespace ProjectPaths {
  export function metadataDir(worktree: string) {
    return path.join(worktree, PRIMARY_METADATA_DIR)
  }

  export function plansDir(worktree: string) {
    return path.join(metadataDir(worktree), "plans")
  }

  export function worktreesDir(root: string) {
    return path.join(root, ".palimpsest_worktrees")
  }
}
