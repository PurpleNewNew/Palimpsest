import z from "zod"

import { atomKinds, linkKinds } from "../research-schema"
import { Research } from "../research"
import { traverseAtomGraph } from "./atom-graph-prompt/traversal"
import { buildPrompt } from "./atom-graph-prompt/builder"
import type { AtomType, RelationType } from "./atom-graph-prompt/types"
import { Domain, Instance, tool } from "./helpers"

export const AtomGraphPromptTool = tool("atom_graph_prompt", {
  description:
    "将 Atom Graph 转换为结构化 Prompt，支持多跳遍历和智能上下文选择。" +
    "借鉴 GraphRAG 的设计，生成适合 LLM 理解的研究上下文。",
  parameters: z.object({
    atomIds: z.array(z.string()).optional().describe("起始 Atom IDs，如果不提供则使用当前 session 绑定的 atom"),
    maxDepth: z.number().default(2).describe("最大遍历深度（跳数），默认 2"),
    maxAtoms: z.number().default(10).describe("最多返回的 Atom 数量，默认 10"),
    relationTypes: z
      .array(z.enum(linkKinds))
      .optional()
      .describe("只遍历指定类型的关系"),
    atomTypes: z
      .array(z.enum(atomKinds))
      .optional()
      .describe("只包含指定类型的 Atom"),
    template: z
      .enum(["graphrag", "compact"])
      .default("graphrag")
      .describe("Prompt 模板风格：graphrag（详细结构化）或 compact（简洁高效）"),
    includeEvidence: z.boolean().default(true).describe("是否包含 evidence 内容"),
    includeMetadata: z.boolean().default(true).describe("是否包含元数据（类型、距离、时间等）"),
  }),
  async execute(params, ctx) {
    let seedAtomIds = params.atomIds

    if (!seedAtomIds || seedAtomIds.length === 0) {
      const parent = (await Research.getParentSessionId(ctx.sessionID)) ?? ctx.sessionID
      const projectID = Instance.project.id
      const allAtoms: Awaited<ReturnType<typeof Domain.listNodes>> = []
      for (const kind of atomKinds) {
        allAtoms.push(...(await Domain.listNodes({ projectID, kind })))
      }
      const bound = allAtoms.find((node) => {
        const data = (node.data ?? {}) as { session_id?: string }
        return data.session_id === parent
      })
      if (bound) seedAtomIds = [bound.id]

      if (!seedAtomIds || seedAtomIds.length === 0) {
        return {
          title: "No atoms found",
          output: "No atom IDs provided and current session is not bound to any atom.",
          metadata: { atomCount: 0 } as Record<string, unknown>,
        }
      }
    }

    const traversedAtoms = await traverseAtomGraph({
      seedAtomIds,
      maxDepth: params.maxDepth,
      maxAtoms: params.maxAtoms,
      relationTypes: params.relationTypes as RelationType[] | undefined,
      atomTypes: params.atomTypes as AtomType[] | undefined,
    })

    if (traversedAtoms.length === 0) {
      return {
        title: "No atoms found",
        output: "No atoms found matching the criteria.",
        metadata: { atomCount: 0 } as Record<string, unknown>,
      }
    }

    const prompt = await buildPrompt(traversedAtoms, {
      template: params.template,
      includeEvidence: params.includeEvidence,
      includeMetadata: params.includeMetadata,
    })

    return {
      title: `Generated prompt from ${traversedAtoms.length} atom(s)`,
      output: prompt,
      metadata: {
        atomCount: traversedAtoms.length,
        seedAtomIds: seedAtomIds as string[],
        maxDepth: params.maxDepth,
        template: params.template,
      } as Record<string, unknown>,
    }
  },
})
