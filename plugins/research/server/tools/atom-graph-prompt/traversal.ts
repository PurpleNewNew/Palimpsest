import type { DomainEdge, DomainNode } from "@palimpsest/plugin-sdk/host"

import { atomKinds, linkKinds } from "../../research-schema"
import { Domain, Instance } from "../helpers"
import type { AtomRelationRow, AtomRow, RelationType, TraversalOptions, TraversedAtom } from "./types"

/**
 * Reconstruct the plugin-local `AtomRow` shape from a canonical
 * `DomainNode`. Atoms now live on `node.body` (claim markdown) and
 * `node.data` (evidence/status/assessment), so we surface those onto
 * the AtomRow's content fields directly. The old file-path columns
 * (`atom_claim_path` etc.) are kept for the row's stable shape but
 * left null — algorithms that used to call `Filesystem.readText(...)`
 * now read the materialized markdown directly off the AtomRow's
 * `_claim` / `_evidence` adjuncts.
 */
export function nodeToAtomRow(node: DomainNode): AtomRow & { _claim: string; _evidence: string } {
  const data = (node.data ?? {}) as {
    evidence_status?: AtomRow["atom_evidence_status"]
    evidence?: string
    evidence_assessment?: string
    session_id?: string
    research_project_id?: string
  }
  return {
    atom_id: node.id,
    research_project_id: data.research_project_id ?? node.projectID,
    atom_name: node.title,
    atom_type: node.kind as AtomRow["atom_type"],
    atom_claim_path: null,
    atom_evidence_status: data.evidence_status ?? "pending",
    atom_evidence_path: null,
    atom_evidence_assessment_path: null,
    source_id: null,
    session_id: data.session_id ?? null,
    time_created: node.time.created,
    time_updated: node.time.updated,
    _claim: node.body ?? "",
    _evidence: data.evidence ?? "",
  }
}

export function edgeToAtomRelationRow(edge: DomainEdge): AtomRelationRow {
  return {
    atom_id_source: edge.sourceID,
    atom_id_target: edge.targetID,
    relation_type: edge.kind as AtomRelationRow["relation_type"],
    note: edge.note ?? null,
    time_created: edge.time.created,
    time_updated: edge.time.updated,
  }
}

async function loadAtomNodes(): Promise<DomainNode[]> {
  const projectID = Instance.project.id
  const out: DomainNode[] = []
  for (const kind of atomKinds) {
    out.push(...(await Domain.listNodes({ projectID, kind })))
  }
  return out
}

async function loadAtomEdges(): Promise<DomainEdge[]> {
  const projectID = Instance.project.id
  const all: DomainEdge[] = []
  const allowed = new Set<string>(linkKinds)
  for (const edge of await Domain.listEdges({ projectID })) {
    if (allowed.has(edge.kind)) all.push(edge)
  }
  return all
}

/**
 * BFS traversal of the atom graph starting from `seedAtomIds`. Uses the
 * canonical Domain Node/Edge tables via `host.domain.*`; no plugin-owned
 * SQL tables remain in the read path.
 */
export async function traverseAtomGraph(options: TraversalOptions): Promise<TraversedAtom[]> {
  const { seedAtomIds, maxDepth, maxAtoms, relationTypes, atomTypes } = options

  const nodes = await loadAtomNodes()
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const edges = await loadAtomEdges()
  const outgoing = new Map<string, DomainEdge[]>()
  for (const edge of edges) {
    const list = outgoing.get(edge.sourceID) ?? []
    list.push(edge)
    outgoing.set(edge.sourceID, list)
  }

  type QueueItem = {
    atomId: string
    distance: number
    path: string[]
    relationChain: RelationType[]
  }

  const visited = new Map<string, TraversedAtom>()
  const queue: QueueItem[] = []
  for (const atomId of seedAtomIds) {
    queue.push({ atomId, distance: 0, path: [atomId], relationChain: [] })
  }

  while (queue.length > 0 && visited.size < (maxAtoms || Infinity)) {
    const current = queue.shift()!
    if (visited.has(current.atomId) || current.distance > maxDepth) continue

    const node = nodeMap.get(current.atomId)
    if (!node) continue

    if (atomTypes && !atomTypes.includes(node.kind as AtomRow["atom_type"])) continue

    const row = nodeToAtomRow(node)
    visited.set(current.atomId, {
      atom: row,
      claim: row._claim,
      evidence: row._evidence,
      distance: current.distance,
      path: current.path,
      relationChain: current.relationChain,
    })

    if (current.distance >= maxDepth) continue

    const neighbors = outgoing.get(current.atomId) ?? []
    const filtered =
      relationTypes && relationTypes.length > 0
        ? neighbors.filter((edge) => relationTypes.includes(edge.kind as RelationType))
        : neighbors

    for (const edge of filtered) {
      if (visited.has(edge.targetID)) continue
      queue.push({
        atomId: edge.targetID,
        distance: current.distance + 1,
        path: [...current.path, edge.targetID],
        relationChain: [...current.relationChain, edge.kind as RelationType],
      })
    }
  }

  return Array.from(visited.values())
}
