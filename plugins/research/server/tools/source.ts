import z from "zod"

import type { DomainNode } from "@palimpsest/plugin-sdk/host"

import { sourceStatuses } from "../research-schema"
import { Domain, Filesystem, Instance, agentActor, tool } from "./helpers"

type SourceData = {
  parse_status: (typeof sourceStatuses)[number]
  source_url?: string
  /** filesystem path to the source file or directory */
  path?: string
}

function asSourceData(node: DomainNode): SourceData {
  const data = (node.data ?? {}) as Partial<SourceData>
  return {
    parse_status: data.parse_status ?? "pending",
    source_url: data.source_url,
    path: data.path,
  }
}

function describeKind(path: string | undefined): string {
  if (!path) return "unknown"
  return Filesystem.stat(path)?.isDirectory() ? "latex_directory" : "pdf"
}

function formatSource(node: DomainNode): string {
  const data = asSourceData(node)
  return [
    `source_id: ${node.id}`,
    node.title ? `title: ${node.title}` : null,
    `status: ${data.parse_status}`,
    `kind: ${describeKind(data.path)}`,
    data.path ? `path: ${data.path}` : null,
    data.source_url ? `source_url: ${data.source_url}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

export const SourceQueryTool = tool("source_query", {
  description:
    "Query research sources (PDFs, LaTeX source folders, or other knowledge sources) in the current research project. " +
    "IMPORTANT: Always use this tool — not glob, ls, read, or other generic tools — when listing or querying sources in a research project. " +
    "It is the ONLY tool that can query the research project source database. " +
    "When called without a sourceId, lists all sources with their metadata (id, title, path, status, etc.). " +
    "When called with a sourceId, returns the source metadata including its file path. " +
    "To read the actual source content, use the returned path with the read tool.",
  parameters: z.object({
    sourceId: z
      .string()
      .optional()
      .describe("The source ID to query. If omitted, lists all sources in the project."),
    sourceIds: z
      .array(z.string())
      .optional()
      .describe("Optional list of source IDs to filter by. Use this when you need a specific subset."),
    status: z
      .enum(sourceStatuses)
      .optional()
      .describe("Optional source status filter: pending, parsed, or failed."),
  }),
  async execute(params) {
    const project = Instance.project

    if (params.sourceId) {
      const node = await Domain.getNode(params.sourceId).catch(() => undefined)
      if (!node || node.kind !== "source") {
        return {
          title: "Not found",
          output: `Source not found: ${params.sourceId}`,
          metadata: { count: 0 },
        }
      }
      return {
        title: node.title ?? node.id,
        output: formatSource(node),
        metadata: { count: 1 },
      }
    }

    let sources = await Domain.listNodes({ projectID: project.id, kind: "source" })
    if (params.sourceIds?.length) {
      const set = new Set(params.sourceIds)
      sources = sources.filter((node) => set.has(node.id))
    }
    if (params.status) {
      sources = sources.filter((node) => asSourceData(node).parse_status === params.status)
    }

    if (sources.length === 0) {
      return {
        title: "No sources",
        output: "No sources found in this research project.",
        metadata: { count: 0 },
      }
    }

    const output = sources.map((node, i) => `--- Source ${i + 1} ---\n${formatSource(node)}`).join("\n\n")
    return {
      title: `${sources.length} source(s)`,
      output,
      metadata: { count: sources.length },
    }
  },
})

export const SourceStatusUpdateTool = tool("source_status_update", {
  description:
    "Update the parse status of one or more sources in the current research project. " +
    "Use this after source-local parsing succeeds or fails. " +
    "The change is staged as a proposal and only applied after review approval.",
  parameters: z.object({
    sourceIds: z.array(z.string()).min(1).describe("The source IDs to update."),
    status: z.enum(sourceStatuses).describe("The new source status."),
  }),
  async execute(params, ctx) {
    const project = Instance.project
    const sources = await Domain.listNodes({ projectID: project.id, kind: "source" })
    const items = sources.filter((node) => params.sourceIds.includes(node.id))
    if (!items.length) {
      return {
        title: "Failed",
        output: "No matching sources found in the current research project.",
        metadata: { proposalId: undefined as string | undefined },
      }
    }

    const proposal = await Domain.propose({
      projectID: project.id,
      actor: agentActor(ctx),
      changes: items.map((node) => ({
        op: "update_node",
        id: node.id,
        data: { ...asSourceData(node), parse_status: params.status } as Record<string, unknown>,
      })),
      title: `Mark ${items.length} source(s) as ${params.status}`,
    })

    return {
      title: `Proposed ${items.length} source status update(s)`,
      output:
        items.map((node) => `[${node.id}] ${node.title ?? "(untitled)"} -> ${params.status}`).join("\n") +
        `\n(proposal ${proposal.id})`,
      metadata: { proposalId: proposal.id },
    }
  },
})
