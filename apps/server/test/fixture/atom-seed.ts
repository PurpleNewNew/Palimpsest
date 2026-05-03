import { Database } from "../../src/storage/db"
import { Instance } from "../../src/project/instance"
import { EdgeTable, NodeTable, ProjectTaxonomyTable } from "@palimpsest/domain/domain.sql"
import {
  ResearchProjectTable,
  atomKinds,
  evidenceStatuses,
  linkKinds,
} from "@palimpsest/plugin-research/server/research-schema"
import { eq } from "drizzle-orm"

/**
 * Helpers for seeding research-plugin algorithm tests.
 *
 * After the schema collapse the plugin no longer owns AtomTable /
 * AtomRelationTable / SourceTable; atoms are canonical Node rows and
 * relations are canonical Edge rows. These helpers mint NodeTable and
 * EdgeTable rows directly (skipping Domain.propose because tests are
 * seeding state, not exercising the proposal pipeline) and ensure the
 * project taxonomy permits the atom node and link kinds. The shape of
 * the returned row mirrors the legacy AtomRow / AtomRelationRow so
 * existing test code keeps reading natural-looking field names.
 */

export type SeededAtom = {
  atom_id: string
  research_project_id: string
  atom_name: string
  atom_type: (typeof atomKinds)[number]
  atom_claim_path: string | null
  atom_evidence_status: (typeof evidenceStatuses)[number]
  atom_evidence_path: string | null
  atom_evidence_assessment_path: string | null
  source_id: string | null
  session_id: string | null
  time_created: number
  time_updated: number
}

export type SeededRelation = {
  atom_id_source: string
  atom_id_target: string
  relation_type: (typeof linkKinds)[number]
  note: string | null
  time_created: number
  time_updated: number
}

export function seedResearchProject(projectId?: string): { research_project_id: string; project_id: string } {
  const project_id = projectId ?? Instance.project.id
  const research_project_id = crypto.randomUUID()
  const now = Date.now()
  Database.use((db) => {
    db.insert(ResearchProjectTable)
      .values({
        research_project_id,
        project_id,
        time_created: now,
        time_updated: now,
      })
      .run()
  })
  ensureTaxonomy(project_id)
  return { research_project_id, project_id }
}

function ensureTaxonomy(projectID: string) {
  const now = Date.now()
  const data = {
    nodeKinds: [...atomKinds],
    edgeKinds: [...linkKinds],
    runKinds: [],
    artifactKinds: [],
    decisionKinds: [],
    decisionStates: [],
  }
  Database.use((db) => {
    db.insert(ProjectTaxonomyTable)
      .values({ project_id: projectID, time_created: now, time_updated: now, data })
      .onConflictDoUpdate({
        target: ProjectTaxonomyTable.project_id,
        set: { data, time_updated: now },
      })
      .run()
  })
}

export type AtomSeed = {
  atom_id: string
  research_project_id?: string
  atom_name?: string
  atom_type?: (typeof atomKinds)[number]
  evidence_status?: (typeof evidenceStatuses)[number]
  claim?: string
  evidence?: string
  evidence_assessment?: string
  session_id?: string | null
  time_created?: number
  time_updated?: number
}

export function seedAtom(input: AtomSeed): SeededAtom {
  const now = Date.now()
  const projectID = Instance.project.id
  const id = input.atom_id
  const data: Record<string, unknown> = {
    research_project_id: input.research_project_id,
    evidence_status: input.evidence_status ?? "pending",
    evidence: input.evidence,
    evidence_assessment: input.evidence_assessment,
    session_id: input.session_id ?? undefined,
  }
  Database.use((db) => {
    db.insert(NodeTable)
      .values({
        id,
        project_id: projectID,
        kind: input.atom_type ?? "hypothesis",
        title: input.atom_name ?? "Test Atom",
        body: input.claim ?? "",
        data,
        time_created: input.time_created ?? now,
        time_updated: input.time_updated ?? now,
      })
      .run()
  })
  return {
    atom_id: id,
    research_project_id: input.research_project_id ?? "",
    atom_name: input.atom_name ?? "Test Atom",
    atom_type: input.atom_type ?? "hypothesis",
    atom_claim_path: null,
    atom_evidence_status: input.evidence_status ?? "pending",
    atom_evidence_path: null,
    atom_evidence_assessment_path: null,
    source_id: null,
    session_id: input.session_id ?? null,
    time_created: input.time_created ?? now,
    time_updated: input.time_updated ?? now,
  }
}

export function seedAtoms(atoms: AtomSeed[]): SeededAtom[] {
  return atoms.map((atom) => seedAtom(atom))
}

export type RelationSeed = {
  source: string
  target: string
  type: (typeof linkKinds)[number]
  note?: string
  time_created?: number
  time_updated?: number
}

export function seedRelation(input: RelationSeed): SeededRelation {
  const now = Date.now()
  const id = `edge_${crypto.randomUUID()}`
  const projectID = Instance.project.id
  Database.use((db) => {
    db.insert(EdgeTable)
      .values({
        id,
        project_id: projectID,
        kind: input.type,
        source_id: input.source,
        target_id: input.target,
        note: input.note,
        time_created: input.time_created ?? now,
        time_updated: input.time_updated ?? now,
      })
      .run()
  })
  return {
    atom_id_source: input.source,
    atom_id_target: input.target,
    relation_type: input.type,
    note: input.note ?? null,
    time_created: input.time_created ?? now,
    time_updated: input.time_updated ?? now,
  }
}

export function seedRelations(rels: RelationSeed[]): SeededRelation[] {
  return rels.map((r) => seedRelation(r))
}

/**
 * Fetch the canonical Node row for an atom seed. Useful when a test
 * needs to assert the post-propose state matches what was seeded.
 */
export function getAtomNode(atomId: string) {
  return Database.use((db) => db.select().from(NodeTable).where(eq(NodeTable.id, atomId)).get())
}
