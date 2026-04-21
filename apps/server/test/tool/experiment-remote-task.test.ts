import { describe, expect, test } from "bun:test"
import { assertRawRemoteCommand } from "@palimpsest/plugin-research/server/tools/experiment-remote-task"

describe("tool.experiment-remote-task", () => {
  test("accepts raw business command", () => {
    const cmd = assertRawRemoteCommand(
      "/root/miniconda3/bin/conda run -n palimpsest_hubdl --no-capture-output modelscope download --dataset OpenDataLab/CUB-200-2011 --local_dir /mnt/zhouzih/CUB-200-2011",
    )
    expect(cmd).toContain("modelscope download")
  })

  test("rejects wrapped command", () => {
    expect(() =>
      assertRawRemoteCommand(
        "mkdir -p /mnt/zhouzih && screen -dmS cub_download bash -lc 'echo START $(date) >> /mnt/zhouzih/cub_download.log'",
      ),
    ).toThrow("raw remote business command only")
  })
})
