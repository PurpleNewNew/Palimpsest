/**
 * Host-side re-export shim. Source of truth:
 * plugins/research/server/experiment-execution-watch.ts
 *
 * Migrated in Stage B2b-c. The shim keeps every `@/research/...` and
 * relative import inside the host compiling while host-side callers
 * get moved to the plugin in B2d-e. The shim (and the surrounding
 * apps/server/src/research directory) is removed when the last caller
 * leaves.
 */
import "./research-plugin-bind"

export { ExperimentExecutionWatch } from "@palimpsest/plugin-research/server/experiment-execution-watch"
