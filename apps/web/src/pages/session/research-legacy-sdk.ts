import { useSDK } from "@/context/sdk"
import { useResearchSDK } from "@palimpsest/plugin-research/web/research-sdk"

export type {
  ResearchProject,
  ResearchAtom,
  ResearchRelation,
  ResearchArticle,
  ResearchCodePath,
  ResearchBranch,
  ResearchServerConfig,
  ResearchExperiment,
  ResearchAtomsListResponse,
} from "@palimpsest/plugin-research/web/research-sdk"

/**
 * Host-shell shim. The actual research API client lives at
 * `plugins/research/web/research-sdk.ts` (moved in step 9b'). This shim
 * preserves the legacy `sdk.client.research.*` callsite shape by
 * merging the plugin's `useResearchSDK()` into the host SDK return.
 *
 * Once all `*.tsx` callers in this directory migrate to either
 * `useResearchSDK()` directly or move into the plugin themselves, this
 * shim can be deleted. Until then it is the single host bridge between
 * the legacy callsites and the plugin-owned research methods.
 */
export function useResearchLegacySDK() {
  const sdk = useSDK()
  const research = useResearchSDK()
  return {
    ...sdk,
    client: {
      ...sdk.client,
      research,
    },
  } as typeof sdk & {
    client: typeof sdk.client & {
      research: ReturnType<typeof useResearchSDK>
    }
  }
}
