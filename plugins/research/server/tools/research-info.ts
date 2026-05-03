import z from "zod"

import { atomKinds } from "../research-schema"
import { Research } from "../research"
import { Domain, Instance, tool } from "./helpers"

export const ResearchInfoTool = tool("research_info", {
  description:
    "View the current research project information, including background path, goal path, macro table path, source count, and atom count.",
  parameters: z.object({}),
  async execute(_params, ctx) {
    const researchProjectId = await Research.getResearchProjectId(ctx.sessionID)
    if (!researchProjectId) {
      return {
        title: "No project",
        output: "Current session is not associated with any research project.",
        metadata: { found: false },
      }
    }

    const project = Research.getResearchProject(researchProjectId)
    if (!project) {
      return {
        title: "Not found",
        output: "Research project not found.",
        metadata: { found: false },
      }
    }

    const projectId = Instance.project.id
    const sources = await Domain.listNodes({ projectID: projectId, kind: "source" })
    const atoms: typeof sources = []
    for (const kind of atomKinds) {
      if (kind === "source") continue
      atoms.push(...(await Domain.listNodes({ projectID: projectId, kind })))
    }

    const lines = [
      `research_project_id: ${project.research_project_id}`,
      `project_id: ${project.project_id}`,
      `background_path: ${project.background_path ?? "(not set)"}`,
      `goal_path: ${project.goal_path ?? "(not set)"}`,
      `macro_table_path: ${project.macro_table_path ?? "(not set)"}`,
      `time_created: ${project.time_created}`,
      `time_updated: ${project.time_updated}`,
      "",
      `--- Sources (${sources.length}) ---`,
      ...sources.map((node) => {
        const data = (node.data ?? {}) as { parse_status?: string; path?: string }
        return `  [${node.id}] ${node.title ?? "(untitled)"} | status: ${data.parse_status ?? "pending"} | path: ${data.path ?? "(no path)"}`
      }),
      "",
      `--- Atoms (${atoms.length}) ---`,
      ...atoms.map((node) => {
        const data = (node.data ?? {}) as { evidence_status?: string }
        return `  [${node.id}] ${node.title} | type: ${node.kind} | evidence: ${data.evidence_status ?? "pending"}`
      }),
    ]

    return {
      title: `Research: ${researchProjectId}`,
      output: lines.join("\n"),
      metadata: { found: true },
    }
  },
})
