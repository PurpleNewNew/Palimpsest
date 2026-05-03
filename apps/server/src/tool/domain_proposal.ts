import z from "zod"

import { Bus } from "../bus"
import { Domain } from "../domain/domain"
import { Tool } from "./tool"

const PROPOSAL_REVISE_DESCRIPTION = `Revise an existing pending proposal in place, rather than scrapping it and creating a new one.

Use when, mid-turn, you realize the proposal you just generated is flawed or incomplete:
- the severity you picked should be downgraded after reading more context
- you forgot to include an evidence artifact in the changeset
- the rationale you wrote doesn't match what the changes actually do
- the proposal's title mis-describes the intent

Constraints (enforced server-side):
- The proposal must still be in status "pending" (not approved / rejected / withdrawn).
- You must be the original proposer — \`Domain.reviseProposal\` rejects cross-actor revisions for safety.
- If you pass \`changes\`, it must be a complete replacement (not a patch). If you omit \`changes\`, the existing changeset is kept.

Parameters
- proposalID (required): the pending proposal to revise, e.g. "pro_..."
- title, rationale, refs, changes (all optional): omit to leave unchanged
- reason (optional): one-line human-readable note about WHY you revised, surfaces to reviewers alongside the bumped revision counter.

After success the proposal's revision number is incremented. Reviewers see both the new and old revisions in the review UI.`

const ProposalReviseParams = z.object({
  proposalID: z.string().describe("ID of the pending proposal to revise, e.g. pro_..."),
  title: z.string().optional().describe("New proposal title"),
  rationale: z.string().optional().describe("New rationale string"),
  refs: z.record(z.string(), z.unknown()).optional().describe("New refs bag (replaces existing)"),
  changes: z
    .array(z.record(z.string(), z.unknown()))
    .optional()
    .describe("Complete replacement changeset. Each entry is a Change (op, id, kind, etc.). Omit to keep existing."),
  reason: z.string().optional().describe("Human-readable note about why you revised; surfaces to reviewers"),
})

export const DomainProposalReviseTool = Tool.define("proposal_revise", async (ctx) => {
  return {
    description: PROPOSAL_REVISE_DESCRIPTION,
    parameters: ProposalReviseParams,
    async execute(args: z.infer<typeof ProposalReviseParams>, _toolCtx) {
      // Agent-driven revises carry the tool invocation as the actor id
      // so that `Domain.reviseProposal` can match it against the
      // original proposer (the same agent identity used by that agent's
      // other proposal-emitting tools). Users and system callers go
      // through the HTTP layer, not this tool.
      const actor: Parameters<typeof Domain.reviseProposal>[0]["actor"] = {
        type: "agent",
        id: ctx?.agent?.name ? `agent:${ctx.agent.name}` : "agent:proposal_revise",
      }
      const revised = await Domain.reviseProposal({
        id: args.proposalID,
        actor,
        title: args.title,
        rationale: args.rationale,
        refs: args.refs,
        // The Change array is strongly typed on the server; we trust the
        // agent to supply a shape that matches `Domain.Change`. Invalid
        // shapes will zod-reject inside `Domain.reviseProposal`.
        changes: args.changes as Parameters<typeof Domain.reviseProposal>[0]["changes"],
      })
      await Bus.publish(Domain.Event.ProposalRevised, revised)
      return {
        title: "proposal_revise",
        output: `Revised proposal ${revised.id} to revision ${revised.revision}.${args.reason ? ` Reason: ${args.reason}` : ""}`,
        metadata: {
          proposalID: revised.id,
          revision: revised.revision,
          reason: args.reason,
        },
      }
    },
  }
})
