/**
 * Atom-graph-prompt internal type vocabulary.
 *
 * Atoms (nodes) and relations (edges) live on the canonical
 * Domain Node/Edge tables — see `host.domain.listNodes/listEdges`.
 * The algorithm modules (traversal, community, builder, hybrid, ...)
 * operate on a plugin-local row shape that mirrors the old AtomTable
 * row layout, so prompts and ranking heuristics can stay focused on
 * atom-specific fields like `atom_evidence_status` and
 * `atom_claim_path`.
 *
 * `AtomRow` and `AtomRelationRow` are reconstructed from
 * `DomainNode` / `DomainEdge` in `traversal.ts` via the
 * `nodeToAtomRow` / `edgeToAtomRelationRow` helpers; consumers do not
 * need to know about Domain shapes.
 */

import type { AtomKind, EvidenceStatus, LinkKind } from "../../research-schema"

export type AtomType = AtomKind
export type RelationType = LinkKind

/**
 * Plugin-local row shape used by the atom-graph-prompt algorithms.
 * The shape is stable across the schema collapse: `traversal.ts`
 * adapts canonical `DomainNode` data into this row at the boundary.
 */
export type AtomRow = {
  atom_id: string
  research_project_id: string
  atom_name: string
  atom_type: AtomType
  atom_claim_path: string | null
  atom_evidence_status: EvidenceStatus
  atom_evidence_path: string | null
  atom_evidence_assessment_path: string | null
  source_id: string | null
  session_id: string | null
  time_created: number
  time_updated: number
}

export type AtomRelationRow = {
  atom_id_source: string
  atom_id_target: string
  relation_type: RelationType
  note: string | null
  time_created: number
  time_updated: number
}

export interface TraversalOptions {
  seedAtomIds: string[]
  maxDepth: number
  maxAtoms?: number
  relationTypes?: RelationType[]
  atomTypes?: AtomType[]
}

export interface TraversedAtom {
  atom: AtomRow
  claim: string
  evidence: string
  distance: number
  path: string[]
  relationChain: RelationType[]
  claimEmbedding?: number[]
}

export interface PromptBuilderOptions {
  template: "graphrag" | "compact"
  includeEvidence: boolean
  includeMetadata: boolean
}

export interface AtomContent {
  claim: string
  evidence: string
}

export interface Community {
  id: string
  atomIds: string[]
  summary: string
  keywords: string[]
  dominantType: AtomType
  size: number
  density: number
  timestamp: number
}

export interface CommunityFilterOptions {
  communityIds?: string[]
  minCommunitySize?: number
  maxCommunitySize?: number
  dominantTypes?: AtomType[]
}
