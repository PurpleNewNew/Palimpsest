import type { DomainChange } from "@palimpsest/sdk/v2"

export type Affected = {
  nodes: { id: string; op: string; title?: string; kind?: string }[]
  edges: { id?: string; op: string; source?: string; target?: string; kind?: string }[]
  runs: { id?: string; op: string; kind?: string; title?: string }[]
  artifacts: { id?: string; op: string; kind?: string; title?: string }[]
  decisions: { id?: string; op: string; kind?: string }[]
}

export function collectAffected(changes: DomainChange[]): Affected {
  const out: Affected = { nodes: [], edges: [], runs: [], artifacts: [], decisions: [] }
  for (const change of changes) {
    if (change.op === "create_node" || change.op === "update_node" || change.op === "delete_node") {
      out.nodes.push({
        id: "id" in change && change.id ? change.id : "",
        op: change.op,
        title: "title" in change ? change.title : undefined,
        kind: "kind" in change ? change.kind : undefined,
      })
      continue
    }
    if (change.op === "create_edge" || change.op === "update_edge" || change.op === "delete_edge") {
      out.edges.push({
        id: "id" in change ? change.id : undefined,
        op: change.op,
        source: "sourceID" in change ? change.sourceID : undefined,
        target: "targetID" in change ? change.targetID : undefined,
        kind: "kind" in change ? change.kind : undefined,
      })
      continue
    }
    if (change.op === "create_run" || change.op === "update_run" || change.op === "delete_run") {
      out.runs.push({
        id: "id" in change ? change.id : undefined,
        op: change.op,
        kind: "kind" in change ? change.kind : undefined,
        title: "title" in change ? change.title : undefined,
      })
      continue
    }
    if (change.op === "create_artifact" || change.op === "update_artifact" || change.op === "delete_artifact") {
      out.artifacts.push({
        id: "id" in change ? change.id : undefined,
        op: change.op,
        kind: "kind" in change ? change.kind : undefined,
        title: "title" in change ? change.title : undefined,
      })
      continue
    }
    if (change.op === "create_decision" || change.op === "update_decision" || change.op === "delete_decision") {
      out.decisions.push({
        id: "id" in change ? change.id : undefined,
        op: change.op,
        kind: "kind" in change ? change.kind : undefined,
      })
    }
  }
  return out
}

export function touchesNode(changes: DomainChange[], id: string) {
  return changes.some((change) => {
    if ("id" in change && change.id === id) {
      return change.op === "create_node" || change.op === "update_node" || change.op === "delete_node"
    }
    if (change.op === "create_edge" || change.op === "update_edge") return change.sourceID === id || change.targetID === id
    if (change.op === "create_run" || change.op === "create_artifact" || change.op === "create_decision") {
      return "nodeID" in change && change.nodeID === id
    }
    if (change.op === "update_artifact" || change.op === "update_decision") {
      return "nodeID" in change && change.nodeID === id
    }
    return false
  })
}

export function touchesRun(changes: DomainChange[], id: string) {
  return changes.some((change) => {
    if ("id" in change && change.id === id) {
      return change.op === "create_run" || change.op === "update_run" || change.op === "delete_run"
    }
    if (change.op === "create_artifact" || change.op === "update_artifact") {
      return "runID" in change && change.runID === id
    }
    if (change.op === "create_decision" || change.op === "update_decision") {
      return "runID" in change && change.runID === id
    }
    return false
  })
}

export function touchesDecision(changes: DomainChange[], id: string) {
  return changes.some((change) => {
    if (!("id" in change) || change.id !== id) return false
    return change.op === "create_decision" || change.op === "update_decision" || change.op === "delete_decision"
  })
}
