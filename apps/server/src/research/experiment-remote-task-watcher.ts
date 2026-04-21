/**
 * Host-side re-export shim. Source of truth:
 * plugins/research/server/experiment-remote-task-watcher.ts
 */
import "./research-plugin-bind"

export {
  ExperimentRemoteTaskWatcher,
  forceRefreshRemoteTask,
} from "@palimpsest/plugin-research/server/experiment-remote-task-watcher"
