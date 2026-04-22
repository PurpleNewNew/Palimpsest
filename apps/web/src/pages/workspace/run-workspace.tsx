import { createResource, For, Show, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import type {
  DomainArtifact,
  DomainCommit,
  DomainDecision,
  DomainNode,
  DomainProposal,
  DomainRun,
} from "@palimpsest/sdk/v2"
import { Button } from "@palimpsest/ui/button"
import { Spinner } from "@palimpsest/ui/spinner"

import { useCanWrite, useWorkspaceCapabilities } from "@/context/permissions"
import { useSDK } from "@/context/sdk"
import { touchesRun } from "./change-links"
import { ObjectWorkspace, RailLink, RailSection } from "./object-workspace"
import { PublishButton } from "./publish-button"

type RunData = {
  run: DomainRun
  node?: DomainNode
  proposals: DomainProposal[]
  commits: DomainCommit[]
  artifacts: DomainArtifact[]
  decisions: DomainDecision[]
}

function statusTone(status: string) {
  if (status === "completed") return "text-icon-success-base"
  if (status === "failed" || status === "error") return "text-icon-critical-base"
  if (status === "running" || status === "pending") return "text-text-interactive-base"
  return "text-text-weak"
}

export default function RunWorkspace(): JSX.Element {
  const sdk = useSDK()
  const navigate = useNavigate()
  const params = useParams()
  const canWrite = useCanWrite()
  const capabilities = useWorkspaceCapabilities()

  const [data] = createResource(
    () => params.runID!,
    async (id) => {
      const [runRes, proposalRes, commitRes, artifactRes, decisionRes] = await Promise.all([
        sdk.client.domain.run.list(),
        sdk.client.domain.proposal.list(),
        sdk.client.domain.commit.list(),
        sdk.client.domain.artifact.list(),
        sdk.client.domain.decision.list(),
      ])
      const run = (runRes.data ?? []).find((item) => item.id === id)
      if (!run) return undefined
      let node: DomainNode | undefined
      if (run.nodeID) {
        const nodeRes = await sdk.client.domain.node.list()
        node = (nodeRes.data ?? []).find((item) => item.id === run.nodeID)
      }
      const proposals = (proposalRes.data ?? []).filter((item) => touchesRun(item.changes, id))
      const commits = (commitRes.data ?? []).filter((item) => touchesRun(item.changes, id))
      const artifacts = (artifactRes.data ?? []).filter((item) => item.runID === id)
      const decisions = (decisionRes.data ?? []).filter((item) => item.runID === id)
      return { run, node, proposals, commits, artifacts, decisions } satisfies RunData
    },
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
          <div class="flex h-full items-center justify-center text-12-regular text-text-weak">Run not found.</div>
        }
      >
        {(value) => {
          const run = () => value().run
          return (
            <ObjectWorkspace
              kind="run"
              id={run().id}
              readonly={!canWrite()}
              accessLabel={capabilities().roleLabel}
              backHref={`/${params.dir}/runs`}
              backLabel="Runs"
              publishSlot={<PublishButton entityKind="run" entityID={run().id} directory={params.dir} />}
              title={run().title ?? run().id}
              status={
                <span class={`text-11-medium uppercase tracking-wide ${statusTone(run().status)}`}>
                  {run().status}
                </span>
              }
              meta={
                <span>
                  {run().kind} · {run().id}
                  <Show when={run().actor}>
                    {(actor) => (
                      <span class="ml-2">
                        · triggered by {actor().type}:{actor().id}
                        <Show when={actor().version}>
                          <span class="ml-1">v{actor().version}</span>
                        </Show>
                      </span>
                    )}
                  </Show>
                </span>
              }
              actions={
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => navigate(`/${params.dir}/reviews`)}
                  data-action="propose-run"
                  disabled={!canWrite()}
                >
                  Propose change
                </Button>
              }
              main={
                <div data-component="run-body">
                  <div class="grid grid-cols-2 gap-3 text-12-regular text-text-strong">
                    <Show when={run().startedAt}>
                      <div class="rounded-lg bg-surface-raised-base px-3 py-2">
                        <div class="text-11-regular text-text-weak">Started</div>
                        <div>{new Date(run().startedAt!).toLocaleString()}</div>
                      </div>
                    </Show>
                    <Show when={run().finishedAt}>
                      <div class="rounded-lg bg-surface-raised-base px-3 py-2">
                        <div class="text-11-regular text-text-weak">Finished</div>
                        <div>{new Date(run().finishedAt!).toLocaleString()}</div>
                      </div>
                    </Show>
                  </div>

                  <Show when={run().manifest}>
                    <section class="mt-6" data-component="run-manifest">
                      <div class="text-11-medium uppercase tracking-wide text-text-weak">Manifest</div>
                      <pre class="mt-2 overflow-x-auto rounded-lg bg-surface-raised-base px-3 py-2 text-11-regular text-text-weak">
                        {JSON.stringify(run().manifest, null, 2)}
                      </pre>
                    </section>
                  </Show>

                  <div class="mt-6 text-11-regular text-text-weak">
                    Created {new Date(run().time.created).toLocaleString()} · Updated{" "}
                    {new Date(run().time.updated).toLocaleString()}
                  </div>
                </div>
              }
              rail={
                <>
                  <Show when={value().node}>
                    {(node) => (
                      <RailSection title="Linked node">
                        <RailLink
                          href={`/${params.dir}/nodes/${node().id}`}
                          label={node().title}
                          hint={node().kind}
                          badge={node().kind}
                        />
                      </RailSection>
                    )}
                  </Show>

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

                  <Show when={value().commits.length > 0}>
                    <RailSection title="Commits" count={value().commits.length}>
                      <For each={value().commits}>
                        {(item) => (
                          <RailLink
                            href={`/${params.dir}/commits/${item.id}`}
                            label={item.id}
                            hint={
                              item.proposalID
                                ? `from ${item.proposalID} · ${new Date(item.time.created).toLocaleString()}`
                                : `${item.actor.type}:${item.actor.id} · ${new Date(item.time.created).toLocaleString()}`
                            }
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
