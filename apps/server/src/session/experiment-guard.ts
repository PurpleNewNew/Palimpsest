/**
 * Shim re-export. The real implementation lives in
 * plugins/research/server/experiment-guard.ts
 *
 * Kept to keep callers in `@/session/prompt.ts` and `@/tool/experiment.ts`
 * working during Stage B.5.2; the shim can be retired once those callers
 * migrate into the plugin in Stage B.5.3.
 */
import "@/research/research-plugin-bind"

export {
  REQUIRED_IGNORE_RULES,
  ensureGitignore,
  ExperimentBranchError,
  GIT_ENV,
  gitErr,
  ensureRepoInitialized,
  setExperimentStatus,
  checkExperimentReadyByExpId,
  assertExperimentReady,
  type ExperimentReadyResult,
} from "@palimpsest/plugin-research/server/experiment-guard"
