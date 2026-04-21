import { Domain as CoreDomain, configureDomain } from "@palimpsest/domain"
import { fn } from "@palimpsest/shared/fn"
import z from "zod"

import { BusEvent } from "@/bus/bus-event"
import { WorkspaceTable } from "@/control-plane/workspace.sql"
import { ProjectTable } from "@/project/project.sql"
import { Database, asc, eq } from "@/storage/db"

const DomainRuntime = configureDomain({
  db: {
    use: Database.use,
    transaction: (callback) => Database.transaction(() => callback()),
  },
  ensureProject(projectID) {
    const row = Database.use((db) => db.select().from(ProjectTable).where(eq(ProjectTable.id, projectID)).get())
    if (!row) throw new CoreDomain.ProjectNotFoundError({ projectID })
  },
  countWorkspaces(projectID) {
    return Database.use((db) =>
      db
        .select()
        .from(WorkspaceTable)
        .where(eq(WorkspaceTable.project_id, projectID))
        .all().length,
    )
  },
})

function fromProject(row: typeof ProjectTable.$inferSelect) {
  return CoreDomain.Project.parse({
    id: row.id,
    worktree: row.worktree,
    vcs: row.vcs ?? undefined,
    name: row.name ?? undefined,
    sandboxes: row.sandboxes,
    time: {
      created: row.time_created,
      updated: row.time_updated,
      initialized: row.time_initialized ?? undefined,
    },
  })
}

function fromWorkspace(row: typeof WorkspaceTable.$inferSelect) {
  return CoreDomain.Workspace.parse({
    id: row.id,
    projectID: row.project_id,
    type: row.type,
    branch: row.branch ?? null,
    name: row.name ?? null,
    directory: row.directory ?? null,
    extra: row.extra ?? null,
  })
}

const getProject = fn(z.string(), async (projectID) => {
  const row = Database.use((db) => db.select().from(ProjectTable).where(eq(ProjectTable.id, projectID)).get())
  if (!row) throw new CoreDomain.ProjectNotFoundError({ projectID })
  return fromProject(row)
})

const listWorkspaces = fn(z.string(), async (projectID) => {
  const rows = Database.use((db) =>
    db
      .select()
      .from(WorkspaceTable)
      .where(eq(WorkspaceTable.project_id, projectID))
      .orderBy(asc(WorkspaceTable.id))
      .all(),
  )
  return rows.map(fromWorkspace)
})

const context = fn(z.string(), async (projectID) => {
  return CoreDomain.Context.parse({
    project: await getProject.force(projectID),
    workspaces: await listWorkspaces.force(projectID),
    taxonomy: await DomainRuntime.taxonomy.force(projectID),
    summary: await DomainRuntime.summary.force(projectID),
  })
})

const Event = {
  ProposalCreated: BusEvent.define("domain.proposal.created", CoreDomain.Proposal),
  ProposalRevised: BusEvent.define("domain.proposal.revised", CoreDomain.Proposal),
  ProposalReviewed: BusEvent.define("domain.proposal.reviewed", CoreDomain.ReviewResult),
  ProposalCommitted: BusEvent.define("domain.proposal.committed", CoreDomain.Commit),
  ProposalWithdrawn: BusEvent.define("domain.proposal.withdrawn", CoreDomain.Proposal),
}

export const Domain = Object.assign(DomainRuntime, {
  getProject,
  listWorkspaces,
  context,
  Event,
})
