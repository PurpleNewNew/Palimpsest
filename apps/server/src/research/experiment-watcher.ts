/**
 * Host-side re-export shim. Source of truth:
 * plugins/research/server/experiment-watcher.ts
 */
import "./research-plugin-bind"

export {
  ExperimentWatcher,
  forceRefreshWatch,
} from "@palimpsest/plugin-research/server/experiment-watcher"
