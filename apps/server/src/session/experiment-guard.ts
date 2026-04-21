/**
 * Shim re-export. The real implementation lives in
 * plugins/research/server/experiment-guard.ts
 *
 * Kept to keep the sole remaining host-side caller `@/session/prompt.ts`
 * working without a hard plugin import. The shim calls ensureResearchPluginBound
 * once so `bridge()` is guaranteed to have a host bound by the time any
 * re-exported function runs (important for tests that call into prompt.ts
 * without booting a full Instance).
 */
import { ensureResearchPluginBound } from "./research-plugin-bind"
ensureResearchPluginBound()

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
