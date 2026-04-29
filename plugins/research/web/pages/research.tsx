import { createMemo, createResource, For, Show, type JSX } from "solid-js"
import { A, useParams } from "@solidjs/router"
import { Button } from "@palimpsest/ui/button"

import { useResearch } from "../context/research"

export default function Research(): JSX.Element {
  const params = useParams()
  const research = useResearch(() => params.dir)

  const [bundle] = createResource(async () => {
    const project = await research.project()
    const researchProject = await research.researchProject().catch(() => undefined)
    if (!researchProject) return { project, researchProject: undefined, atoms: [], sources: [] }
    const [atoms, sources] = await Promise.all([
      research.atoms(researchProject.research_project_id).catch(() => ({ atoms: [], relations: [] })),
      research.sources(researchProject.research_project_id).catch(() => []),
    ])
    return { project, researchProject, atoms: atoms.atoms, sources }
  })

  const recentAtoms = createMemo(() =>
    (bundle()?.atoms ?? []).slice().sort((a, b) => b.time_updated - a.time_updated).slice(0, 8),
  )

  return (
    <div class="flex h-full flex-col gap-4 overflow-y-auto p-6" data-component="research-page">
      <header class="flex items-center justify-between">
        <div>
          <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Research</div>
          <h1 class="mt-1 text-20-medium text-text-strong">Research Workbench</h1>
          <div class="mt-1 text-12-regular text-text-weak">
            Research graph, source corpus, and evidence-focused work owned by the research plugin.
          </div>
        </div>
        <Show when={bundle()?.researchProject}>
          {(project) => (
            <A href={`/${params.dir}/literature`}>
              <Button variant="secondary" size="small">Open Literature</Button>
            </A>
          )}
        </Show>
      </header>

      <Show when={bundle()}>
        {(value) => (
          <>
            <Show
              when={value().researchProject}
              fallback={
                <div class="rounded-2xl bg-surface-raised-base px-4 py-4 text-12-regular text-text-weak">
                  This project does not have a research plugin context yet.
                </div>
              }
            >
              {(researchProject) => (
                <>
                  <div class="grid gap-4 md:grid-cols-4">
                    <div class="rounded-2xl bg-surface-raised-base px-4 py-4">
                      <div class="text-11-medium uppercase tracking-wide text-text-weak">Project</div>
                      <div class="mt-2 text-16-medium text-text-strong">{value().project.name ?? value().project.id}</div>
                    </div>
                    <div class="rounded-2xl bg-surface-raised-base px-4 py-4">
                      <div class="text-11-medium uppercase tracking-wide text-text-weak">Atoms</div>
                      <div class="mt-2 text-16-medium text-text-strong">{value().atoms.length}</div>
                    </div>
                    <div class="rounded-2xl bg-surface-raised-base px-4 py-4">
                      <div class="text-11-medium uppercase tracking-wide text-text-weak">Sources</div>
                      <div class="mt-2 text-16-medium text-text-strong">{value().sources.length}</div>
                    </div>
                    <div class="rounded-2xl bg-surface-raised-base px-4 py-4">
                      <div class="text-11-medium uppercase tracking-wide text-text-weak">Sessions</div>
                      <div class="mt-2 text-16-medium text-text-strong">
                        {value().atoms.filter((atom) => !!atom.session_id).length}
                      </div>
                    </div>
                  </div>

                  <section class="rounded-2xl bg-surface-raised-base px-4 py-4" data-component="research-project-meta">
                    <div class="text-11-medium uppercase tracking-wide text-text-weak">Research Project</div>
                    <div class="mt-3 grid gap-3 md:grid-cols-2">
                      <div class="rounded-xl bg-background-base px-3 py-3">
                        <div class="text-10-medium uppercase tracking-wide text-text-weak">Research Project ID</div>
                        <div class="mt-1 text-12-regular text-text-strong">{researchProject().research_project_id}</div>
                      </div>
                      <div class="rounded-xl bg-background-base px-3 py-3">
                        <div class="text-10-medium uppercase tracking-wide text-text-weak">Docs</div>
                        <div class="mt-1 text-12-regular text-text-strong">
                          Background: {researchProject().background_path ?? "—"} · Goal: {researchProject().goal_path ?? "—"}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section class="rounded-2xl bg-surface-raised-base px-4 py-4" data-component="research-recent-atoms">
                    <div class="flex items-center justify-between">
                      <div class="text-11-medium uppercase tracking-wide text-text-weak">Recent Atoms</div>
                      <A href={`/${params.dir}/nodes`} class="text-11-medium text-text-interactive-base hover:underline">
                        Open Nodes
                      </A>
                    </div>
                    <div class="mt-3 flex flex-col gap-2">
                      <For each={recentAtoms()}>
                        {(atom) => (
                          <div class="rounded-xl bg-background-base px-3 py-3">
                            <div class="flex items-center justify-between gap-2">
                              <div class="text-13-medium text-text-strong">{atom.atom_name}</div>
                              <span class="text-10-medium uppercase tracking-wide text-text-weak">{atom.atom_type}</span>
                            </div>
                            <div class="mt-1 text-11-regular text-text-weak">
                              evidence {atom.atom_evidence_status}
                              <Show when={atom.source_id}>
                                <span> · source {atom.source_id}</span>
                              </Show>
                            </div>
                            <Show when={atom.session_id}>
                              {(sessionID) => (
                                <A
                                  href={`/${params.dir}/session/${sessionID()}`}
                                  class="mt-2 inline-flex text-11-medium text-text-interactive-base hover:underline"
                                >
                                  Open session
                                </A>
                              )}
                            </Show>
                          </div>
                        )}
                      </For>
                      <Show when={recentAtoms().length === 0}>
                        <div class="rounded-xl bg-background-base px-3 py-3 text-12-regular text-text-weak">
                          No atoms yet.
                        </div>
                      </Show>
                    </div>
                  </section>
                </>
              )}
            </Show>
          </>
        )}
      </Show>
    </div>
  )
}
