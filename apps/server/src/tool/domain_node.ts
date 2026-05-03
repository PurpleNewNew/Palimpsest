import z from "zod"

import { Bus } from "../bus"
import { Domain } from "../domain/domain"
import { Instance } from "../project/instance"
import { Tool } from "./tool"

/**
 * Generic node update tool.
 *
 * Emits a `{ op: "update_node" }` change as a proposal (agent writes
 * are always proposal-gated per `specs/domain.md` Decision 1), so the
 * mutation is reviewed by a human before it lands. Works across every
 * plugin taxonomy — `Domain.applyChanges` validates that the new
 * `kind` (if any) is allowed by the current project's taxonomy.
 *
 * Use when an earlier agent decision turns out to be wrong:
 * - finding severity was misread and needs to go from medium → critical
 * - a target's title was imprecise ("JWT auth" → "OAuth 2.0 flow")
 * - a surface was mis-classified and its `data.kind` should change
 */
const NODE_UPDATE_DESCRIPTION = `Propose updates to a domain node's fields (kind / title / body / data). The agent generates a review-gated proposal; the change lands only after a human approves. Use this to correct earlier mistakes, refine details, or re-classify a node without deleting it.

Parameters
- nodeID (required): the node to update, e.g. "nod_..."
- title, body (optional): new title/body. Omit to leave unchanged.
- kind (optional): new taxonomy kind. Must match the project's taxonomy.
- data (optional): a JSON patch that REPLACES the whole \`data\` field (merge it yourself on the caller side if you want partial updates).
- rationale (optional): one-line reason for the update; surfaces to reviewers.`

const NodeUpdateParams = z.object({
  nodeID: z.string().describe("ID of the node to update, e.g. nod_..."),
  kind: z.string().optional().describe("New node kind (must match project taxonomy)"),
  title: z.string().optional().describe("New node title"),
  body: z.string().optional().describe("New node body (markdown)"),
  data: z.record(z.string(), z.unknown()).optional().describe("New data field (replaces existing)"),
  rationale: z.string().optional().describe("One-line reason for the update, surfaces to reviewers"),
})

export const DomainNodeUpdateTool = Tool.define("node_update", async () => {
  return {
    description: NODE_UPDATE_DESCRIPTION,
    parameters: NodeUpdateParams,
    async execute(args, _ctx) {
      const proposal = await Domain.propose({
        projectID: Instance.project.id,
        title: args.title ? `Update node: ${args.title}` : `Update node ${args.nodeID}`,
        actor: { type: "agent", id: "node_update" },
        rationale: args.rationale ?? "Correct, refine, or re-classify an existing node.",
        changes: [
          {
            op: "update_node",
            id: args.nodeID,
            kind: args.kind,
            title: args.title,
            body: args.body,
            data: args.data,
          },
        ],
      })
      await Bus.publish(Domain.Event.ProposalCreated, proposal)
      return {
        title: "node_update",
        output: `Created node_update proposal ${proposal.id} for ${args.nodeID}.`,
        metadata: { proposalID: proposal.id, nodeID: args.nodeID },
      }
    },
  }
})

const NODE_DELETE_DESCRIPTION = `Propose deletion of a domain node. The agent generates a review-gated proposal; the node is removed only after a human approves. Cascading edges are handled by the domain layer.

Use when a node turns out to be duplicate, wrong, or no longer needed:
- a surface you added is the same endpoint as an existing surface
- a finding was hallucinated and should be dropped
- an assumption was invalidated and cannot be repaired

Parameters
- nodeID (required): the node to delete, e.g. "nod_..."
- rationale (optional): one-line reason for deletion; surfaces to reviewers.`

const NodeDeleteParams = z.object({
  nodeID: z.string().describe("ID of the node to delete, e.g. nod_..."),
  rationale: z.string().optional().describe("One-line reason for deletion"),
})

export const DomainNodeDeleteTool = Tool.define("node_delete", async () => {
  return {
    description: NODE_DELETE_DESCRIPTION,
    parameters: NodeDeleteParams,
    async execute(args, _ctx) {
      const proposal = await Domain.propose({
        projectID: Instance.project.id,
        title: `Delete node ${args.nodeID}`,
        actor: { type: "agent", id: "node_delete" },
        rationale: args.rationale ?? "Remove a node that is duplicate, incorrect, or no longer relevant.",
        changes: [{ op: "delete_node", id: args.nodeID }],
      })
      await Bus.publish(Domain.Event.ProposalCreated, proposal)
      return {
        title: "node_delete",
        output: `Created node_delete proposal ${proposal.id} for ${args.nodeID}.`,
        metadata: { proposalID: proposal.id, nodeID: args.nodeID },
      }
    },
  }
})
