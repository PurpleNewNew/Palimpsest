import { pluginWebHostFetchJson, usePluginWebHost, type PluginWebHost } from "@palimpsest/plugin-sdk/host-web"

/**
 * Research API client moved out of `apps/web/src/pages/session/research-legacy-sdk.ts`
 * (step 9b' file move). The plugin owns the research method surface;
 * the host shell at `apps/web/src/pages/session/research-legacy-sdk.ts`
 * remains as a thin shim that merges this with the host SDK so existing
 * `sdk.client.research.*` callsites keep working unchanged.
 *
 * Network calls go through the plugin web host bridge
 * (`pluginWebHostFetchJson`) which already handles directory + workspace
 * headers and JSON (de)serialization. The legacy `request` helper's
 * shape (`{ data: T }`) is preserved on the public surface so callers
 * do not need to refactor for unwrapping.
 */

export type ResearchProject = {
  research_project_id: string
  project_id: string
  background_path: string | null
  goal_path: string | null
  macro_table_path: string | null
  time_created: number
  time_updated: number
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

export type ResearchRelation = {
  atom_id_source: string
  atom_id_target: string
  relation_type: string
  note: string | null
  time_created: number
  time_updated: number
}

export type ResearchArticle = {
  article_id: string
  filename: string
  title: string | null
}

export type ResearchCodePath = {
  name: string
  path: string
}

export type ResearchBranch = {
  branch: string
  displayName: string
  experimentId: string | null
}

export type ResearchServerConfig =
  | {
      mode: "direct"
      address: string
      port: number
      user: string
      password?: string
      resource_root?: string
      wandb_api_key?: string
      wandb_project_name?: string
    }
  | {
      mode: "ssh_config"
      host_alias: string
      ssh_config_path?: string
      user?: string
      password?: string
      resource_root?: string
      wandb_api_key?: string
      wandb_project_name?: string
    }

export type ResearchExperiment = {
  exp_id: string
  research_project_id: string
  exp_name: string
  exp_session_id: string | null
  baseline_branch_name: string | null
  exp_branch_name: string | null
  exp_result_path: string | null
  atom_id: string | null
  exp_result_summary_path: string | null
  exp_plan_path: string | null
  remote_server_id: string | null
  remote_server_config: ResearchServerConfig | null
  code_path: string
  status: "pending" | "running" | "done" | "idle" | "failed"
  started_at: number | null
  finished_at: number | null
  time_created: number
  time_updated: number
}

export type ResearchAtomsListResponse = {
  atoms: ResearchAtom[]
  relations: ResearchRelation[]
}

function encode(path: string): string {
  return encodeURIComponent(path)
}

async function request<T>(host: PluginWebHost, path: string, init?: RequestInit): Promise<{ data: T }> {
  const route = path.startsWith("/research") ? `/api/plugin/research${path.slice("/research".length)}` : path
  const data = await pluginWebHostFetchJson<T>(host, route, init)
  return { data }
}

/**
 * Returns the research API client. This is the moved counterpart of the
 * legacy `useResearchLegacySDK().client.research`. Callers can either
 * use this directly (`research.atoms.list({ ... })`) or stay on the
 * shim at `apps/web/src/pages/session/research-legacy-sdk.ts` which
 * preserves the `sdk.client.research.*` shape.
 */
export function useResearchSDK() {
  const host = usePluginWebHost()

  return {
    project: {
      get: (input: { projectId: string }) =>
        request<ResearchProject>(host, `/research/project/by-project/${encode(input.projectId)}`),
    },
    atoms: {
      list: (input: { researchProjectId: string }) =>
        request<ResearchAtomsListResponse>(host, `/research/project/${encode(input.researchProjectId)}/atoms`),
    },
    atom: {
      create: (input: {
        researchProjectId: string
        name: string
        type: "fact" | "method" | "theorem" | "verification"
      }) =>
        request<ResearchAtom>(host, `/research/project/${encode(input.researchProjectId)}/atom`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      delete: (input: { researchProjectId: string; atomId: string }) =>
        request<{ atom_id: string; deleted: true }>(
          host,
          `/research/project/${encode(input.researchProjectId)}/atom/${encode(input.atomId)}`,
          { method: "DELETE" },
        ),
      update: (input: {
        researchProjectId: string
        atomId: string
        evidence_status?: "pending" | "in_progress" | "proven" | "disproven"
        evidence_type?: "math" | "experiment"
      }) =>
        request<ResearchAtom>(
          host,
          `/research/research/${encode(input.researchProjectId)}/atom/${encode(input.atomId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              evidence_status: input.evidence_status,
              evidence_type: input.evidence_type,
            }),
          },
        ),
      session: {
        create: (input: { atomId: string }) =>
          request<{ session_id: string; created: boolean }>(host, `/research/atom/${encode(input.atomId)}/session`, {
            method: "POST",
          }),
      },
      experiments: {
        list: (input: { atomId: string }) =>
          request<{ experiments: ResearchExperiment[] }>(
            host,
            `/research/atom/${encode(input.atomId)}/experiments`,
          ),
      },
    },
    relation: {
      create: (input: {
        researchProjectId: string
        source_atom_id: string
        target_atom_id: string
        relation_type: string
        note?: string
      }) =>
        request<ResearchRelation>(host, `/research/project/${encode(input.researchProjectId)}/relation`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      update: (input: {
        researchProjectId: string
        source_atom_id: string
        target_atom_id: string
        relation_type: string
        next_relation_type: string
      }) =>
        request<ResearchRelation>(host, `/research/project/${encode(input.researchProjectId)}/relation`, {
          method: "PATCH",
          body: JSON.stringify(input),
        }),
      delete: (input: {
        researchProjectId: string
        source_atom_id: string
        target_atom_id: string
        relation_type: string
      }) =>
        request<{
          source_atom_id: string
          target_atom_id: string
          relation_type: string
          deleted: true
        }>(host, `/research/project/${encode(input.researchProjectId)}/relation`, {
          method: "DELETE",
          body: JSON.stringify(input),
        }),
    },
    article: {
      list: (input: { researchProjectId: string }) =>
        request<ResearchArticle[]>(host, `/research/project/${encode(input.researchProjectId)}/articles`),
      create: (input: { researchProjectId: string; sourcePath: string; title?: string; sourceUrl?: string }) =>
        request<{ article_id: string; path: string; title: string | null; source_url: string | null }>(
          host,
          `/research/project/${encode(input.researchProjectId)}/article`,
          {
            method: "POST",
            body: JSON.stringify(input),
          },
        ),
    },
    codePaths: () => request<ResearchCodePath[]>(host, `/research/code-paths`),
    branches: (input: { codePath: string }) =>
      request<ResearchBranch[]>(host, `/research/branches?codePath=${encode(input.codePath)}`),
    experiment: {
      create: (input: {
        atomId: string
        expName: string
        baselineBranch?: string
        remoteServerId?: string
        codePath: string
      }) =>
        request<{
          exp_id: string
          exp_name: string
          atom_id: string
          atom_name: string
          session_id: string
          baseline_branch: string
          exp_branch: string
          exp_result_path: string
          exp_result_summary_path: string
          remote_server_config: ResearchServerConfig | null
        }>(host, `/research/experiment`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      session: {
        create: (input: { expId: string }) =>
          request<{ session_id: string; created: boolean }>(
            host,
            `/research/experiment/${encode(input.expId)}/session`,
            { method: "POST" },
          ),
      },
      delete: (input: { expId: string }) =>
        request<{ success: boolean }>(host, `/research/experiment/${encode(input.expId)}`, { method: "DELETE" }),
    },
  }
}
