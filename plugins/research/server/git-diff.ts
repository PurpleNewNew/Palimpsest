import path from "path"
import fs from "fs/promises"
import z from "zod"

import { bridge } from "./host-bridge"

export const FileDiffSchema = z
  .object({
    file: z.string(),
    before: z.string(),
    after: z.string(),
    additions: z.number(),
    deletions: z.number(),
    status: z.enum(["added", "deleted", "modified"]).optional(),
  })
  .meta({ ref: "FileDiff" })

export type FileDiff = z.infer<typeof FileDiffSchema>

/**
 * Compute FileDiff[] between two git refs, or between a ref and the working tree.
 * When `to` is omitted, diffs against the current working tree (including untracked files).
 *
 * Mirrors the host's `@/util/git-diff` helper, but routes every git invocation
 * through `host.git.run` so plugin code doesn't touch `@/util/git` directly.
 */
export async function computeExperimentDiff(codePath: string, from: string, to?: string): Promise<FileDiff[]> {
  const git = bridge().git.run
  const result: FileDiff[] = []
  const toWorkingTree = !to

  if (toWorkingTree) {
    const branchResult = await git(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: codePath })
    if (branchResult.exitCode !== 0 || branchResult.text().trim() !== from) {
      return result
    }
  }

  const diffArgs = ["diff", "--no-ext-diff", "--name-status", "--no-renames", from]
  if (to) diffArgs.push(to)
  diffArgs.push("--", ".")

  const statusMap = new Map<string, "added" | "deleted" | "modified">()
  const statusResult = await git(diffArgs, { cwd: codePath })
  if (statusResult.exitCode === 0) {
    for (const line of statusResult.text().trim().split("\n")) {
      if (!line) continue
      const [code, file] = line.split("\t")
      if (!code || !file) continue
      statusMap.set(file, code.startsWith("A") ? "added" : code.startsWith("D") ? "deleted" : "modified")
    }
  }

  if (toWorkingTree) {
    const untrackedResult = await git(["ls-files", "--others", "--exclude-standard"], { cwd: codePath })
    if (untrackedResult.exitCode === 0) {
      for (const file of untrackedResult.text().trim().split("\n")) {
        if (file && !statusMap.has(file)) {
          statusMap.set(file, "added")
        }
      }
    }
  }

  const numstatArgs = ["diff", "--no-ext-diff", "--no-renames", "--numstat", from]
  if (to) numstatArgs.push(to)
  numstatArgs.push("--", ".")

  const numstatMap = new Map<string, { additions: number; deletions: number; binary: boolean }>()
  const numstatResult = await git(numstatArgs, { cwd: codePath })
  if (numstatResult.exitCode === 0) {
    for (const line of numstatResult.text().trim().split("\n")) {
      if (!line) continue
      const [additions, deletions, file] = line.split("\t")
      if (!file) continue
      const binary = additions === "-" && deletions === "-"
      numstatMap.set(file, {
        additions: binary ? 0 : parseInt(additions) || 0,
        deletions: binary ? 0 : parseInt(deletions) || 0,
        binary,
      })
    }
  }

  for (const [file, fileStatus] of statusMap) {
    const stats = numstatMap.get(file)
    const isBinary = stats?.binary ?? false

    let before = ""
    let after = ""

    if (!isBinary) {
      if (fileStatus !== "added") {
        const beforeResult = await git(["show", `${from}:${file}`], { cwd: codePath })
        before = beforeResult.exitCode === 0 ? beforeResult.text() : ""
      }

      if (fileStatus !== "deleted") {
        if (toWorkingTree) {
          after = await fs.readFile(path.join(codePath, file), "utf-8").catch(() => "")
        } else {
          const afterResult = await git(["show", `${to}:${file}`], { cwd: codePath })
          after = afterResult.exitCode === 0 ? afterResult.text() : ""
        }
      }
    }

    const additions = stats?.additions ?? (fileStatus === "added" && !isBinary ? after.split("\n").length : 0)
    const deletions = stats?.deletions ?? 0

    result.push({
      file,
      before,
      after,
      additions,
      deletions,
      status: fileStatus,
    })
  }

  return result
}
