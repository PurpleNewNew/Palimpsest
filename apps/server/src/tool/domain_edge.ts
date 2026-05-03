import z from "zod"

import { Bus } from "../bus"
import { Domain } from "../domain/domain"
import { Instance } from "../project/instance"
import { Tool } from "./tool"

const EDGE_UPDATE_DESCRIPTION = `Propose updates to a domain edge's fields (kind / sourceID / targetID / note / data). Review-gated proposal, not a direct commit.

Use when an earlier edge decision turns out wrong:
- an edge was created with the wrong kind ("mitigates" should have been "contradicts")
- source/target was pointed at the wrong node
- a note/data blob needs correction

Parameters
- edgeID (required): the edge to update, e.g. "edg_..."
- kind, sourceID, targetID, note, data (all optional): omit any to leave unchanged
- rationale (optional): surfaces to reviewers`

const EdgeUpdateParams = z.object({
  edgeID: z.string().describe("ID of the edge to update, e.g. edg_..."),
  kind: z.string().optional().describe("New edge kind (must match project taxonomy)"),
  sourceID: z.string().optional().describe("New source node id"),
  targetID: z.string().optional().describe("New target node id"),
  note: z.string().optional().describe("New edge note"),
  data: z.record(z.string(), z.unknown()).optional().describe("New data field (replaces existing)"),
  rationale: z.string().optional().describe("One-line reason for the update"),
})

export const DomainEdgeUpdateTool = Tool.define("edge_update", async () => {
  return {
    description: EDGE_UPDATE_DESCRIPTION,
    parameters: EdgeUpdateParams,
    async execute(args, _ctx) {
      const proposal = await Domain.propose({
        projectID: Instance.project.id,
        title: `Update edge ${args.edgeID}`,
        actor: { type: "agent", id: "edge_update" },
        rationale: args.rationale ?? "Correct an earlier edge decision.",
        changes: [
          {
            op: "update_edge",
            id: args.edgeID,
            kind: args.kind,
            sourceID: args.sourceID,
            targetID: args.targetID,
            note: args.note,
            data: args.data,
          },
        ],
      })
      await Bus.publish(Domain.Event.ProposalCreated, proposal)
      return {
        title: "edge_update",
        output: `Created edge_update proposal ${proposal.id} for ${args.edgeID}.`,
        metadata: { proposalID: proposal.id, edgeID: args.edgeID },
      }
    },
  }
})

const EDGE_DELETE_DESCRIPTION = `Propose deletion of a domain edge. Review-gated proposal; the edge is removed only after approval.

Use when an edge was connected incorrectly:
- the wrong pair of nodes got linked
- the edge duplicates another existing edge
- the relationship was speculative and later evidence invalidated it

Parameters
- edgeID (required): the edge to delete
- rationale (optional): surfaces to reviewers`

const EdgeDeleteParams = z.object({
  edgeID: z.string().describe("ID of the edge to delete"),
  rationale: z.string().optional().describe("One-line reason for deletion"),
})

export const DomainEdgeDeleteTool = Tool.define("edge_delete", async () => {
  return {
    description: EDGE_DELETE_DESCRIPTION,
    parameters: EdgeDeleteParams,
    async execute(args, _ctx) {
      const proposal = await Domain.propose({
        projectID: Instance.project.id,
        title: `Delete edge ${args.edgeID}`,
        actor: { type: "agent", id: "edge_delete" },
        rationale: args.rationale ?? "Remove an incorrect or duplicate edge.",
        changes: [{ op: "delete_edge", id: args.edgeID }],
      })
      await Bus.publish(Domain.Event.ProposalCreated, proposal)
      return {
        title: "edge_delete",
        output: `Created edge_delete proposal ${proposal.id} for ${args.edgeID}.`,
        metadata: { proposalID: proposal.id, edgeID: args.edgeID },
      }
    },
  }
})
