import { pluginWebHostFetchJson, usePluginWebHost } from "@palimpsest/plugin-sdk/host-web"

export type ResearchProject = {
  research_project_id: string
  project_id: string
  background_path?: string | null
  goal_path?: string | null
  macro_table_path?: string | null
  time_created?: number
  time_updated?: number
}

export type ResearchAtom = {
  atom_id: string
  research_project_id: string
  atom_name: string
  atom_type: string
  atom_claim_path: string | null
  atom_evidence_type: string
  atom_evidence_status: string
  atom_evidence_path: string | null
  atom_evidence_assessment_path: string | null
  article_id: string | null
  session_id: string | null
  time_created: number
  time_updated: number
}

export type ResearchArticle = {
  article_id: string
  filename: string
  title: string | null
}

export type ResearchRelation = {
  atom_id_source: string
  atom_id_target: string
  relation_type: string
  note: string | null
  time_created: number
  time_updated: number
}

type DomainProject = {
  id: string
  name?: string
  worktree: string
}

export function useResearch(getDirectory?: () => string | undefined) {
  const host = usePluginWebHost()

  function resolvedHost() {
    if (!getDirectory) return host
    return {
      ...host,
      directory: () => getDirectory() ?? host.directory(),
    }
  }

  async function json<T>(path: string, init?: RequestInit): Promise<T> {
    return pluginWebHostFetchJson<T>(resolvedHost(), path, init)
  }

  async function project() {
    return json<DomainProject>("/domain/project")
  }

  return {
    project,
    async researchProject() {
      const current = await project()
      return json<ResearchProject>(`/api/plugin/research/project/by-project/${encodeURIComponent(current.id)}`)
    },
    atoms(researchProjectID: string) {
      return json<{ atoms: ResearchAtom[]; relations: ResearchRelation[] }>(
        `/api/plugin/research/project/${encodeURIComponent(researchProjectID)}/atoms`,
      )
    },
    articles(researchProjectID: string) {
      return json<ResearchArticle[]>(
        `/api/plugin/research/project/${encodeURIComponent(researchProjectID)}/articles`,
      )
    },
  }
}
