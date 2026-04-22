import { createMemo, createResource, For, Show, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import type {
  DomainArtifact,
  DomainDecision,
  DomainEdge,
  DomainNode,
  DomainProposal,
  DomainRun,
} from "@palimpsest/sdk/v2"
import { Button } from "@palimpsest/ui/button"
import { Spinner } from "@palimpsest/ui/spinner"

import { useSDK } from "@/context/sdk"
import { ObjectWorkspace, RailLink, RailSection } from "./object-workspace"

type NodeData = {
  node: DomainNode
  edges: DomainEdge[]
  proposals: DomainProposal[]
  runs: DomainRun[]
  artifacts: DomainArtifact[]
  decisions: DomainDecision[]
}

function changeReferencesNode(proposal: DomainProposal, nodeID: string): boolean {
  return proposal.changes.some((change) => {
    if ("id" in change && change.id === nodeID) {
      return (
        change.op === "create_node" ||
        change.op === "update_node" ||
        change.op === "delete_node"
      )
    }
    if (change.op === "create_edge" || change.op === "update_edge") {
      return (
        ("sourceID" in change && change.sourceID === nodeID) ||
        ("targetID" in change && change.targetID === nodeID)
      )
    }
    if (change.op === "create_run" && "nodeID" in change && change.nodeID === nodeID) return true
    if (change.op === "create_artifact" && "nodeID" in change && change.nodeID === nodeID) return true
    if (change.op === "create_decision" && "nodeID" in change && change.nodeID === nodeID) return true
    return false
  })
}

export default function NodeWorkspace(): JSX.Element {
  const sdk = useSDK()
  const navigate = useNavigate()
  const params = useParams()

  const [data] = createResource(
    () => params.nodeID!,
    async (id) => {
      const [nodeRes, edgeRes, proposalRes, runRes, artifactRes, decisionRes] = await Promise.all([
        sdk.client.domain.node.list(),
        sdk.client.domain.edge.list(),
        sdk.client.domain.proposal.list(),
        sdk.client.domain.run.list(),
        sdk.client.domain.artifact.list(),
        sdk.client.domain.decision.list(),
      ])
      const node = (nodeRes.data ?? []).find((item) => item.id === id)
      if (!node) return undefined
      const edges = edgeRes.data ?? []
      const proposals = (proposalRes.data ?? []).filter((item) => changeReferencesNode(item, id))
      const runs = (runRes.data ?? []).filter((item) => item.nodeID === id)
      const artifacts = (artifactRes.data ?? []).filter((item) => item.nodeID === id)
      const decisions = (decisionRes.data ?? []).filter((item) => item.nodeID === id)
      return { node, edges, proposals, runs, artifacts, decisions } satisfies NodeData
    },
  )

  const incoming = createMemo(() =>
    (data()?.edges ?? []).filter((edge) => edge.targetID === params.nodeID),
  )
  const outgoing = createMemo(() =>
    (data()?.edges ?? []).filter((edge) => edge.sourceID === params.nodeID),
  )

  return (
    <Show
      when={!data.loading}
      fallback={
        <div class="flex h-full items-center justify-center">
          <Spinner class="size-5" />
        </div>
      }
    >
      <Show
        when={data()}
        fallback={
          <div class="flex h-full items-center justify-center text-12-regular text-text-weak">Node not found.</div>
        }
      >
        {(value) => {
          const node = () => value().node
          return (
            <ObjectWorkspace
              kind="node"
              id={node().id}
              backHref={`/${params.dir}/nodes`}
              backLabel="Nodes"
              title={node().title}
              meta={
                <span>
                  {node().kind} · {node().id} · updated {new Date(node().time.updated).toLocaleString()}
                </span>
              }
              actions={
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => navigate(`/${params.dir}/reviews`)}
                  data-action="propose-change"
                >
                  Propose change
                </Button>
              }
              main={
                <div data-component="node-body">
                  <Show when={node().body}>
                    <div
                      class="rounded-lg bg-surface-raised-base px-4 py-3 text-13-regular text-text-strong whitespace-pre-wrap"
                      data-component="node-body-text"
                    >
                      {node().body}
                    </div>
                  </Show>

                  <Show when={node().data}>
                    <section class="mt-6" data-component="node-data">
                      <div class="text-11-medium uppercase tracking-wide text-text-weak">Data</div>
                      <pre class="mt-2 overflow-x-auto rounded-lg bg-surface-raised-base px-3 py-2 text-11-regular text-text-weak">
                        {JSON.stringify(node().data, null, 2)}
                      </pre>
                    </section>
                  </Show>

                  <Show when={outgoing().length > 0}>
                    <section class="mt-6" data-component="node-outgoing">
                      <div class="text-11-medium uppercase tracking-wide text-text-weak">Outgoing edges</div>
                      <ul class="mt-2 flex flex-col gap-1">
                        <For each={outgoing()}>
                          {(edge) => (
                            <li class="flex items-center gap-2 rounded-lg bg-surface-raised-base px-3 py-2 text-12-regular text-text-strong">
                              <span class="text-10-medium uppercase tracking-wide text-text-weak">{edge.kind}</span>
                              <span>→</span>
                              <button
                                type="button"
                                class="text-text-interactive-base hover:underline"
                                onClick={() => navigate(`/${params.dir}/nodes/${edge.targetID}`)}
                              >
                                {edge.targetID}
                              </button>
                              <Show when={edge.note}>
                                <span class="text-11-regular text-text-weak">· {edge.note}</span>
                              </Show>
                            </li>
                          )}
                        </For>
                      </ul>
                    </section>
                  </Show>

                  <Show when={incoming().length > 0}>
                    <section class="mt-6" data-component="node-incoming">
                      <div class="text-11-medium uppercase tracking-wide text-text-weak">Incoming edges</div>
                      <ul class="mt-2 flex flex-col gap-1">
                        <For each={incoming()}>
                          {(edge) => (
                            <li class="flex items-center gap-2 rounded-lg bg-surface-raised-base px-3 py-2 text-12-regular text-text-strong">
                              <button
                                type="button"
                                class="text-text-interactive-base hover:underline"
                                onClick={() => navigate(`/${params.dir}/nodes/${edge.sourceID}`)}
                              >
                                {edge.sourceID}
                              </button>
                              <span>→</span>
                              <span class="text-10-medium uppercase tracking-wide text-text-weak">{edge.kind}</span>
                              <Show when={edge.note}>
                                <span class="text-11-regular text-text-weak">· {edge.note}</span>
                              </Show>
                            </li>
                          )}
                        </For>
                      </ul>
                    </section>
                  </Show>
                </div>
              }
              rail={
                <>
                  <Show when={value().proposals.length > 0}>
                    <RailSection title="Proposals" count={value().proposals.length}>
                      <For each={value().proposals}>
                        {(item) => (
                          <RailLink
                            href={`/${params.dir}/reviews/${item.id}`}
                            label={item.title ?? item.id}
                            hint={`${item.status} · ${item.actor.type}:${item.actor.id}`}
                            badge={item.status}
                          />
                        )}
                      </For>
                    </RailSection>
                  </Show>

                  <Show when={value().runs.length > 0}>
                    <RailSection title="Runs" count={value().runs.length}>
                      <For each={value().runs}>
                        {(item) => (
                          <RailLink
                            href={`/${params.dir}/runs/${item.id}`}
                            label={item.title ?? item.id}
                            hint={`${item.status} · ${item.kind}`}
                            badge={item.status}
                          />
                        )}
                      </For>
                    </RailSection>
                  </Show>

                  <Show when={value().artifacts.length > 0}>
                    <RailSection title="Artifacts" count={value().artifacts.length}>
                      <For each={value().artifacts}>
                        {(item) => (
                          <RailLink
                            href={`/${params.dir}/artifacts/${item.id}`}
                            label={item.title ?? item.id}
                            hint={item.kind}
                            badge={item.kind}
                          />
                        )}
                      </For>
                    </RailSection>
                  </Show>

                  <Show when={value().decisions.length > 0}>
                    <RailSection title="Decisions" count={value().decisions.length}>
                      <For each={value().decisions}>
                        {(item) => (
                          <RailLink
                            href={`/${params.dir}/decisions/${item.id}`}
                            label={item.kind}
                            hint={item.state ?? "—"}
                            badge={item.state}
                          />
                        )}
                      </For>
                    </RailSection>
                  </Show>
                </>
              }
            />
          )
        }}
      </Show>
    </Show>
  )
}
