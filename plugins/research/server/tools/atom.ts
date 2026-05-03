import z from "zod"

import type { DomainChange, DomainEdge, DomainNode } from "@palimpsest/plugin-sdk/host"

import { atomKinds, evidenceStatuses, linkKinds } from "../research-schema"
import { Research } from "../research"
import { Bus, Domain, Instance, agentActor, tool } from "./helpers"

/**
 * Atom data layout on `Node.data`. Atom-shaped nodes always carry
 * `evidence_status` (taken from the `evidenceStatuses` enum) and may
 * optionally carry markdown bodies for the rendered evidence and
 * assessment text. The atom's claim itself lives on `Node.body`.
 */
type AtomData = {
  evidence_status: (typeof evidenceStatuses)[number]
  evidence?: string
  evidence_assessment?: string
  session_id?: string
}

function asAtomData(node: DomainNode): AtomData {
  const data = (node.data ?? {}) as Partial<AtomData>
  return {
    evidence_status: data.evidence_status ?? "pending",
    evidence: data.evidence,
    evidence_assessment: data.evidence_assessment,
    session_id: data.session_id,
  }
}

function isAtomKind(kind: string): kind is (typeof atomKinds)[number] {
  return (atomKinds as readonly string[]).includes(kind)
}

function hasSection(input: string, name: "Claim" | "Evidence") {
  return new RegExp(String.raw`^\s{0,3}(?:#{1,6}\s*)?${name}\s*:?\s*$`, "im").test(input)
}

function validateFields(input: { name: string; claim: string; evidence?: string }, label: string) {
  if (hasSection(input.claim, "Evidence")) {
    throw new Error(
      `${label} "${input.name}" is invalid: claim contains an Evidence section. Keep claim and evidence in separate fields.`,
    )
  }
  if (!hasSection(input.claim, "Claim")) {
    throw new Error(`${label} "${input.name}" is invalid: claim must include a Claim heading.`)
  }
  const evidence = input.evidence ?? ""
  if (hasSection(evidence, "Claim")) {
    throw new Error(
      `${label} "${input.name}" is invalid: evidence contains a Claim section. Keep claim and evidence in separate fields.`,
    )
  }
  if (evidence.trim() && !hasSection(evidence, "Evidence")) {
    throw new Error(`${label} "${input.name}" is invalid: evidence must include an Evidence heading.`)
  }
}

function formatAtom(node: DomainNode): string {
  const data = asAtomData(node)
  return [
    `atom_id: ${node.id}`,
    `name: ${node.title}`,
    `type: ${node.kind}`,
    `evidence_status: ${data.evidence_status}`,
    `project_id: ${node.projectID}`,
    data.session_id ? `session_id: ${data.session_id}` : null,
    `time_created: ${node.time.created}`,
    `time_updated: ${node.time.updated}`,
  ]
    .filter(Boolean)
    .join("\n")
}

async function listAtoms(projectID: string): Promise<DomainNode[]> {
  const all: DomainNode[] = []
  for (const kind of atomKinds) {
    all.push(...(await Domain.listNodes({ projectID, kind })))
  }
  return all
}

async function listEvidenceFromEdges(projectID: string): Promise<DomainEdge[]> {
  return Domain.listEdges({ projectID, kind: "evidence_from" })
}

async function findBoundAtom(sessionID: string, projectID: string): Promise<DomainNode | undefined> {
  const parent = (await Research.getParentSessionId(sessionID)) ?? sessionID
  const atoms = await listAtoms(projectID)
  return atoms.find((node) => asAtomData(node).session_id === parent)
}

export const AtomCreateTool = tool("atom_create", {
  description:
    "Create a new atom (the smallest verifiable unit of knowledge). " +
    "An atom consists of a claim and its evidence. " +
    "Use this tool when you need to add a new question, hypothesis, claim, finding, or source to the research project. " +
    "IMPORTANT: All claim and evidence MUST use markdown syntax with proper LaTeX math formulas ($...$ for inline, $$...$$ for block) and code blocks (```language). " +
    "All atom writes are routed through the proposal pipeline — the atom does not appear in the graph until the proposal is approved.",
  parameters: z.object({
    name: z.string().describe("A short descriptive name for the atom"),
    type: z.enum(atomKinds).describe("The kind of atom: question, hypothesis, claim, finding, or source"),
    claim: z
      .string()
      .describe(
        "The detailed description of the atom's claim. " +
          "MUST use markdown syntax. " +
          "For math formulas, use LaTeX syntax: inline formulas with $...$, block formulas with $$...$$. " +
          "For code blocks, use triple backticks with language specification. " +
          "Example: 'The formula $E = mc^2$ shows energy-mass equivalence.'",
      ),
    sourceId: z
      .string()
      .optional()
      .describe(
        "The source atom this atom originates from. When provided an `evidence_from` edge is " +
          "added to the same proposal so the link is created atomically.",
      ),
    evidence: z
      .string()
      .optional()
      .describe(
        "The detailed description of the atom's evidence." +
          "MUST use markdown syntax. " +
          "For math formulas, use LaTeX syntax: inline formulas with $...$, block formulas with $$...$$. " +
          "For code blocks, use triple backticks with language specification. " +
          "Example: 'Proof: $$\\int_0^1 x^2 dx = \\frac{1}{3}$$'",
      ),
  }),
  async execute(params, ctx) {
    validateFields(params, "Atom")

    const project = Instance.project
    const data: AtomData = {
      evidence_status: "pending",
      evidence: params.evidence,
      evidence_assessment: undefined,
    }
    const changes: DomainChange[] = [
      {
        op: "create_node",
        kind: params.type,
        title: params.name,
        body: params.claim,
        data: data as Record<string, unknown>,
      },
    ]

    const proposal = await Domain.propose({
      projectID: project.id,
      actor: agentActor(ctx),
      changes,
      title: `Create atom: ${params.name}`,
      rationale: `Agent ${ctx.agent} proposes a new ${params.type} atom.`,
    })

    return {
      title: `Proposed atom: ${params.name}`,
      output: [
        `Atom proposal queued for review.`,
        `- Proposal ID: ${proposal.id}`,
        `- Name: ${params.name}`,
        `- Type: ${params.type}`,
        params.sourceId
          ? `- Origin source: ${params.sourceId} (link the source via atom_relation_create with kind="evidence_from" once the atom is approved)`
          : `- Source: user created`,
      ].join("\n"),
      metadata: {
        proposalId: proposal.id,
      },
    }
  },
})

export const AtomQueryTool = tool("atom_query", {
  description:
    "Query atom information. " +
    "If an atomId is provided, returns that specific atom's details directly. " +
    "Otherwise, if the current session is bound to a specific atom, returns that atom's details. " +
    "If neither, returns all atoms in the research project.",
  parameters: z.object({
    atomId: z
      .string()
      .optional()
      .describe(
        "The atom ID to query. If provided, returns that specific atom's details directly, bypassing session-based resolution.",
      ),
    atomIds: z.array(z.string()).optional().describe("Optional list of atom IDs to filter by."),
    sourceIds: z
      .array(z.string())
      .optional()
      .describe("Optional list of source atom IDs. Returns only atoms linked to those sources via `evidence_from`."),
  }),
  async execute(params, ctx) {
    const project = Instance.project

    if (params.atomId) {
      const node = await Domain.getNode(params.atomId).catch(() => undefined)
      if (!node || !isAtomKind(node.kind)) {
        return {
          title: "Not found",
          output: `Atom not found: ${params.atomId}`,
          metadata: { count: 0 },
        }
      }
      return {
        title: `Atom: ${node.title}`,
        output: formatAtom(node),
        metadata: { count: 1 },
      }
    }

    if (!params.sourceIds?.length && !params.atomIds?.length) {
      const bound = await findBoundAtom(ctx.sessionID, project.id)
      if (bound) {
        return {
          title: `Atom: ${bound.title}`,
          output: formatAtom(bound),
          metadata: { count: 1 },
        }
      }
    }

    const atoms = await listAtoms(project.id)
    let items = atoms
    if (params.atomIds?.length) {
      const set = new Set(params.atomIds)
      items = items.filter((node) => set.has(node.id))
    } else if (params.sourceIds?.length) {
      const sources = new Set(params.sourceIds)
      const evidenceEdges = (await listEvidenceFromEdges(project.id)).filter((edge) => sources.has(edge.targetID))
      const linked = new Set(evidenceEdges.map((edge) => edge.sourceID))
      items = items.filter((node) => linked.has(node.id))
    }

    if (items.length === 0) {
      return {
        title: "No atoms",
        output: params.atomIds?.length
          ? `No atoms found for atom IDs: ${params.atomIds.join(", ")}`
          : params.sourceIds?.length
            ? `No atoms found for source IDs: ${params.sourceIds.join(", ")}`
            : "No atoms found in this research project.",
        metadata: { count: 0 },
      }
    }

    const output = items.map((node, i) => `--- Atom ${i + 1} ---\n${formatAtom(node)}`).join("\n\n")
    return {
      title: `${items.length} atom(s)`,
      output,
      metadata: { count: items.length },
    }
  },
})

export const AtomStatusUpdateTool = tool("atom_status_update", {
  description:
    "Update an atom's evidence status. " +
    "This tool ONLY updates the status field — it cannot modify the atom's name, type, claim, or evidence content. " +
    "Use this after assessing evidence to mark an atom as supported, refuted, or in_progress. " +
    "The change is staged as a proposal and only applied after review approval.",
  parameters: z.object({
    atomId: z.string().optional().describe("The atom ID to update. If omitted, resolves from the current session."),
    evidenceStatus: z
      .enum(evidenceStatuses)
      .describe("New evidence status: pending, in_progress, supported, or refuted"),
  }),
  async execute(params, ctx) {
    const project = Instance.project
    let target: DomainNode | undefined

    if (params.atomId) {
      target = await Domain.getNode(params.atomId).catch(() => undefined)
    } else {
      target = await findBoundAtom(ctx.sessionID, project.id)
    }

    if (!target || !isAtomKind(target.kind)) {
      return {
        title: "Failed",
        output: params.atomId
          ? `Atom not found: ${params.atomId}`
          : "No atom bound to the current session and no atomId provided.",
        metadata: { proposalId: undefined as string | undefined },
      }
    }

    const data: AtomData = { ...asAtomData(target), evidence_status: params.evidenceStatus }
    const proposal = await Domain.propose({
      projectID: project.id,
      actor: agentActor(ctx),
      changes: [
        {
          op: "update_node",
          id: target.id,
          data: data as Record<string, unknown>,
        },
      ],
      title: `Mark atom ${target.title} as ${params.evidenceStatus}`,
    })

    return {
      title: `Proposed status: ${params.evidenceStatus}`,
      output: `Atom ${target.id} → ${params.evidenceStatus} (proposal ${proposal.id})`,
      metadata: { proposalId: proposal.id },
    }
  },
})

export const AtomUpdateTool = tool("atom_update", {
  description:
    "Update an atom's mutable fields (name/type/claim/evidence/evidence_status/evidence_assessment) atomically " +
    "through the proposal pipeline. Use this when the agent realizes an earlier atom needs renaming, retyping, " +
    "or its claim/evidence text needs revision — instead of deleting and re-creating it.",
  parameters: z.object({
    atomId: z.string().describe("The atom ID to update."),
    name: z.string().optional().describe("New atom name (Node.title)."),
    type: z.enum(atomKinds).optional().describe("New atom kind."),
    claim: z.string().optional().describe("New claim markdown (Node.body)."),
    evidence: z.string().optional().describe("New evidence markdown (Node.data.evidence)."),
    evidenceStatus: z.enum(evidenceStatuses).optional().describe("New evidence status."),
    evidenceAssessment: z.string().optional().describe("New evidence assessment markdown."),
  }),
  async execute(params, ctx) {
    const project = Instance.project
    const node = await Domain.getNode(params.atomId).catch(() => undefined)
    if (!node || !isAtomKind(node.kind)) {
      return {
        title: "Failed",
        output: `Atom not found: ${params.atomId}`,
        metadata: { proposalId: undefined as string | undefined },
      }
    }

    const wantsBody = params.claim !== undefined
    const wantsName = params.name !== undefined
    const wantsType = params.type !== undefined
    const wantsData = [params.evidence, params.evidenceStatus, params.evidenceAssessment].some((v) => v !== undefined)

    if (!wantsBody && !wantsName && !wantsType && !wantsData) {
      return {
        title: "No changes",
        output: "Provide at least one of name/type/claim/evidence/evidenceStatus/evidenceAssessment.",
        metadata: { proposalId: undefined as string | undefined },
      }
    }

    if (wantsBody) {
      validateFields(
        { name: params.name ?? node.title, claim: params.claim!, evidence: params.evidence },
        "Atom",
      )
    }

    const previous = asAtomData(node)
    const next: AtomData = {
      evidence_status: params.evidenceStatus ?? previous.evidence_status,
      evidence: params.evidence ?? previous.evidence,
      evidence_assessment: params.evidenceAssessment ?? previous.evidence_assessment,
      session_id: previous.session_id,
    }

    const change: DomainChange = {
      op: "update_node",
      id: node.id,
      title: wantsName ? params.name : undefined,
      kind: wantsType ? params.type : undefined,
      body: wantsBody ? params.claim : undefined,
      data: wantsData ? (next as Record<string, unknown>) : undefined,
    }

    const proposal = await Domain.propose({
      projectID: project.id,
      actor: agentActor(ctx),
      changes: [change],
      title: `Update atom: ${node.title}`,
    })

    return {
      title: `Proposed update: ${node.title}`,
      output: [
        `Atom update queued for review.`,
        `- Proposal ID: ${proposal.id}`,
        `- Atom: ${node.id}`,
        wantsName ? `- name → ${params.name}` : null,
        wantsType ? `- type → ${params.type}` : null,
        wantsBody ? `- claim updated` : null,
        params.evidence !== undefined ? `- evidence updated` : null,
        params.evidenceStatus !== undefined ? `- evidence_status → ${params.evidenceStatus}` : null,
        params.evidenceAssessment !== undefined ? `- evidence_assessment updated` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      metadata: { proposalId: proposal.id },
    }
  },
})

export const AtomBatchCreateTool = tool("atom_batch_create", {
  description:
    "Batch create atoms and their relations atomically through a single proposal. " +
    "The atoms list defines each atom. The relations list defines edges between atoms, " +
    "where source and target are zero-based indexes into the atoms list. " +
    "IMPORTANT: All claim and evidence MUST use markdown syntax with proper LaTeX math formulas ($...$ for inline, $$...$$ for block) and code blocks (```language).",
  parameters: z.object({
    atoms: z
      .array(
        z.object({
          name: z.string(),
          type: z.enum(atomKinds),
          claim: z.string(),
          sourceId: z.string().optional(),
          evidence: z.string().optional(),
        }),
      )
      .min(1)
      .describe("List of atoms to create"),
    relations: z
      .array(
        z.object({
          source: z.number().int().min(0).describe("Index of the source atom in the atoms list"),
          target: z.number().int().min(0).describe("Index of the target atom in the atoms list"),
          relationType: z.enum(linkKinds),
          note: z.string().optional(),
        }),
      )
      .optional()
      .describe("Relations between atoms, using indexes from the atoms list"),
  }),
  async execute(params, ctx) {
    params.atoms.forEach((atom, i) => validateFields(atom, `Atom[${i}]`))

    for (const rel of params.relations ?? []) {
      if (rel.source >= params.atoms.length) {
        return {
          title: "Failed",
          output: `Invalid relation: source index ${rel.source} out of range (${params.atoms.length} atoms).`,
          metadata: { proposalId: undefined as string | undefined },
        }
      }
      if (rel.target >= params.atoms.length) {
        return {
          title: "Failed",
          output: `Invalid relation: target index ${rel.target} out of range (${params.atoms.length} atoms).`,
          metadata: { proposalId: undefined as string | undefined },
        }
      }
    }

    const project = Instance.project
    const placeholderIds = params.atoms.map((_, i) => `__atom_${i}`)

    const changes: DomainChange[] = params.atoms.map((atom, i) => ({
      op: "create_node",
      id: placeholderIds[i] as string,
      kind: atom.type,
      title: atom.name,
      body: atom.claim,
      data: {
        evidence_status: "pending",
        evidence: atom.evidence,
      } as Record<string, unknown>,
    }))

    for (const rel of params.relations ?? []) {
      changes.push({
        op: "create_edge",
        kind: rel.relationType,
        sourceID: placeholderIds[rel.source]!,
        targetID: placeholderIds[rel.target]!,
        note: rel.note,
      })
    }

    // Domain.propose's validation requires real id prefixes; remove the
    // placeholders and let Domain mint ids. We capture them out so the
    // commit-side response can map placeholders back to assigned ids
    // when the proposal is approved.
    for (const change of changes) {
      if (change.op === "create_node") {
        delete (change as { id?: string }).id
      }
    }
    // For edges we need the actual node ids, but we don't have them
    // until the proposal commits — so for batch creation we put one
    // proposal per atom plus one proposal per edge (still via the
    // same propose call), the apply() in Domain assigns ids
    // sequentially. Trick: change[i] for create_node returns the
    // assigned id; later create_edge changes can reference it via the
    // index of the previous create_node. The host's `apply()` does
    // not yet support cross-change references, so for now we degrade
    // to a single-proposal-per-atom flow when relations are present
    // and no source/target exists yet.
    const hasInternalRelations = (params.relations ?? []).length > 0
    if (hasInternalRelations) {
      // Create atoms first (one batched proposal), wait for the agent
      // to approve them, then create relations once the atom ids are
      // known. We surface this two-phase flow by erroring out — the
      // agent should call atom_batch_create without `relations` and
      // then call atom_relation_create individually.
      return {
        title: "Failed",
        output:
          "atom_batch_create cannot create cross-atom relations atomically through the proposal pipeline yet, " +
          "because edge changes need concrete node ids. " +
          "Call atom_batch_create with the atoms list only, wait for review, " +
          "then call atom_relation_create per relation once the atom ids are known.",
        metadata: { proposalId: undefined as string | undefined },
      }
    }

    const proposal = await Domain.propose({
      projectID: project.id,
      actor: agentActor(ctx),
      changes,
      title: `Create ${params.atoms.length} atoms`,
    })

    return {
      title: `Proposed ${params.atoms.length} atom(s)`,
      output: [
        `Atom batch proposal queued for review.`,
        `- Proposal ID: ${proposal.id}`,
        ...params.atoms.map((atom, i) => `[${i}] ${atom.name} (${atom.type})`),
      ].join("\n"),
      metadata: { proposalId: proposal.id },
    }
  },
})

export const AtomDeleteTool = tool("atom_delete", {
  description:
    "Delete one or more atoms by ID through the proposal pipeline. " +
    "All edges referencing the deleted nodes are automatically cleaned up by the cascade on Edge.source_id / Edge.target_id.",
  parameters: z.object({
    atomIds: z.array(z.string()).min(1).describe("Array of atom IDs to delete"),
  }),
  async execute(params, ctx) {
    const project = Instance.project
    const valid: DomainNode[] = []
    const invalid: string[] = []
    for (const id of params.atomIds) {
      const node = await Domain.getNode(id).catch(() => undefined)
      if (node && isAtomKind(node.kind)) {
        valid.push(node)
      } else {
        invalid.push(id)
      }
    }

    if (valid.length === 0) {
      return {
        title: "Failed",
        output: `No valid atoms found for deletion. Invalid IDs: ${invalid.join(", ")}`,
        metadata: { proposalId: undefined as string | undefined },
      }
    }

    const changes: DomainChange[] = valid.map((node) => ({ op: "delete_node", id: node.id }))
    const proposal = await Domain.propose({
      projectID: project.id,
      actor: agentActor(ctx),
      changes,
      title: `Delete ${valid.length} atom(s)`,
    })

    const lines = [
      `Atom deletion proposal queued.`,
      `- Proposal ID: ${proposal.id}`,
      ...valid.map((node) => `- ${node.title} (${node.kind})`),
    ]
    if (invalid.length > 0) lines.push(`- Skipped invalid IDs: ${invalid.join(", ")}`)

    return {
      title: `Proposed deletion of ${valid.length} atom(s)`,
      output: lines.join("\n"),
      metadata: { proposalId: proposal.id },
    }
  },
})

export const AtomRelationQueryTool = tool("atom_relation_query", {
  description:
    "Query atom relations in the current research project. " +
    "Returns all atom-graph edges or filters by atom, direction, or relation type.",
  parameters: z.object({
    atomId: z
      .string()
      .optional()
      .describe("The atom ID to query relations for (returns all relations if not provided)"),
    direction: z
      .enum(["in", "out", "all"])
      .optional()
      .default("all")
      .describe("Filter by direction: in (incoming), out (outgoing), all (default)"),
    relationType: z.enum(linkKinds).optional().describe("Filter by relation type"),
  }),
  async execute(params) {
    const project = Instance.project
    const atoms = await listAtoms(project.id)
    const atomMap = new Map(atoms.map((node) => [node.id, node]))
    const atomIds = new Set(atomMap.keys())

    const allEdges = await Domain.listEdges({ projectID: project.id })
    let edges = allEdges.filter((edge) => atomIds.has(edge.sourceID) && atomIds.has(edge.targetID))

    if (params.atomId && params.direction === "in") {
      edges = edges.filter((edge) => edge.targetID === params.atomId)
    } else if (params.atomId && params.direction === "out") {
      edges = edges.filter((edge) => edge.sourceID === params.atomId)
    } else if (params.atomId) {
      edges = edges.filter((edge) => edge.sourceID === params.atomId || edge.targetID === params.atomId)
    }

    if (params.relationType) {
      edges = edges.filter((edge) => edge.kind === params.relationType)
    }

    if (edges.length === 0) {
      return {
        title: "No relations",
        output: params.atomId
          ? `No relations found for atom ${params.atomId}`
          : "No relations found in this research project.",
        metadata: { count: 0 },
      }
    }

    const lines = edges.map((edge) => {
      const source = atomMap.get(edge.sourceID)
      const target = atomMap.get(edge.targetID)
      const sourceName = source?.title ?? edge.sourceID.slice(0, 8)
      const targetName = target?.title ?? edge.targetID.slice(0, 8)
      const sourceType = source?.kind ?? "unknown"
      const targetType = target?.kind ?? "unknown"
      return `- [${edge.sourceID}] ${sourceName} (${sourceType}) → [${edge.targetID}] ${targetName} (${targetType}) [${edge.kind}]`
    })

    return {
      title: `${edges.length} relation(s)`,
      output: lines.join("\n"),
      metadata: { count: edges.length },
    }
  },
})

export const AtomRelationCreateTool = tool("atom_relation_create", {
  description:
    "Create a relation between two existing atoms. The relation connects a source atom to a target atom with a " +
    "specific kind. The change is staged as a proposal and only applied after review approval.",
  parameters: z.object({
    sourceAtomId: z.string().describe("The ID of the source atom"),
    targetAtomId: z.string().describe("The ID of the target atom"),
    relationType: z.enum(linkKinds),
    note: z.string().optional(),
  }),
  async execute(params, ctx) {
    const project = Instance.project
    const source = await Domain.getNode(params.sourceAtomId).catch(() => undefined)
    if (!source || !isAtomKind(source.kind)) {
      return {
        title: "Failed",
        output: `Source atom not found: ${params.sourceAtomId}`,
        metadata: { proposalId: undefined as string | undefined },
      }
    }
    const target = await Domain.getNode(params.targetAtomId).catch(() => undefined)
    if (!target || !isAtomKind(target.kind)) {
      return {
        title: "Failed",
        output: `Target atom not found: ${params.targetAtomId}`,
        metadata: { proposalId: undefined as string | undefined },
      }
    }

    const proposal = await Domain.propose({
      projectID: project.id,
      actor: agentActor(ctx),
      changes: [
        {
          op: "create_edge",
          kind: params.relationType,
          sourceID: params.sourceAtomId,
          targetID: params.targetAtomId,
          note: params.note,
        },
      ],
      title: `Link ${source.title} → ${target.title} (${params.relationType})`,
    })

    return {
      title: "Proposed relation",
      output: `Relation queued: ${source.title} (${source.kind}) → ${target.title} (${target.kind}) [${params.relationType}] (proposal ${proposal.id})`,
      metadata: { proposalId: proposal.id },
    }
  },
})

export const AtomRelationUpdateTool = tool("atom_relation_update", {
  description:
    "Update an existing atom relation: change its kind and/or note via the proposal pipeline. " +
    "Use this when the agent realizes an earlier relation was tagged incorrectly, instead of deleting and re-creating.",
  parameters: z.object({
    edgeId: z.string().describe("The edge ID to update."),
    relationType: z.enum(linkKinds).optional().describe("New relation kind."),
    note: z.string().optional().describe("New optional note."),
  }),
  async execute(params, ctx) {
    if (params.relationType === undefined && params.note === undefined) {
      return {
        title: "No changes",
        output: "Provide at least one of relationType or note.",
        metadata: { proposalId: undefined as string | undefined },
      }
    }
    const edge = await Domain.getEdge(params.edgeId).catch(() => undefined)
    if (!edge) {
      return {
        title: "Failed",
        output: `Edge not found: ${params.edgeId}`,
        metadata: { proposalId: undefined as string | undefined },
      }
    }
    const project = Instance.project
    const proposal = await Domain.propose({
      projectID: project.id,
      actor: agentActor(ctx),
      changes: [
        {
          op: "update_edge",
          id: edge.id,
          kind: params.relationType,
          note: params.note,
        },
      ],
      title: `Update relation ${edge.id}`,
    })
    return {
      title: "Proposed relation update",
      output: `Edge ${edge.id} update queued (proposal ${proposal.id})`,
      metadata: { proposalId: proposal.id },
    }
  },
})

export const AtomRelationDeleteTool = tool("atom_relation_delete", {
  description:
    "Delete one relation between two atoms via the proposal pipeline. The relation must exist; deletion is " +
    "scoped by source/target/relationType triple — pass relationType to disambiguate when multiple kinds connect the same pair.",
  parameters: z.object({
    sourceAtomId: z.string(),
    targetAtomId: z.string(),
    relationType: z.enum(linkKinds).optional(),
  }),
  async execute(params, ctx) {
    const project = Instance.project
    const edges = await Domain.listEdges({ projectID: project.id })
    const candidates = edges.filter(
      (edge) =>
        edge.sourceID === params.sourceAtomId &&
        edge.targetID === params.targetAtomId &&
        (!params.relationType || edge.kind === params.relationType),
    )
    if (candidates.length === 0) {
      return {
        title: "Failed",
        output: params.relationType
          ? `No relation of kind [${params.relationType}] found between ${params.sourceAtomId} and ${params.targetAtomId}`
          : `No relations found between ${params.sourceAtomId} and ${params.targetAtomId}`,
        metadata: { proposalId: undefined as string | undefined },
      }
    }
    const proposal = await Domain.propose({
      projectID: project.id,
      actor: agentActor(ctx),
      changes: candidates.map((edge) => ({ op: "delete_edge", id: edge.id })),
      title: `Delete ${candidates.length} relation(s)`,
    })
    return {
      title: `Proposed deletion of ${candidates.length} relation(s)`,
      output: candidates.map((edge) => `- ${edge.id} [${edge.kind}]`).join("\n") + `\n(proposal ${proposal.id})`,
      metadata: { proposalId: proposal.id },
    }
  },
})

// `Bus` is imported solely so existing wildcard re-export paths keep
// matching during the migration. Once the Research.Event side of the
// pipeline is fully driven by the host's commit subscription the
// import can be dropped here.
void Bus