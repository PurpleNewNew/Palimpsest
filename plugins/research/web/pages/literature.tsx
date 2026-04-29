import { A, useParams } from "@solidjs/router"
import { Button } from "@palimpsest/ui/button"
import { createMemo, createResource, For, Show, type JSX } from "solid-js"

import { useResearch } from "../context/research"

export default function Literature(): JSX.Element {
  const params = useParams()
  const research = useResearch(() => params.dir)

  const [bundle] = createResource(async () => {
    const project = await research.project()
    const researchProject = await research.researchProject().catch(() => undefined)
    if (!researchProject) return { project, researchProject: undefined, sources: [] }
    const sources = await research.sources(researchProject.research_project_id).catch(() => [])
    return { project, researchProject, sources }
  })

  const sortedSources = createMemo(() =>
    (bundle()?.sources ?? []).slice().sort((a, b) => (a.title ?? a.filename).localeCompare(b.title ?? b.filename)),
  )

  return (
    <div class="flex h-full flex-col gap-4 overflow-y-auto p-6" data-component="research-literature-page">
      <header class="flex items-center justify-between">
        <div>
          <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Research</div>
          <h1 class="mt-1 text-20-medium text-text-strong">Literature</h1>
          <div class="mt-1 text-12-regular text-text-weak">
            Sources, papers, and reference material owned by the research plugin.
          </div>
        </div>
        <A href={`/${params.dir}/research`}>
          <Button variant="secondary" size="small">
            Back to Research
          </Button>
        </A>
      </header>

      <Show
        when={bundle()?.researchProject}
        fallback={
          <div class="rounded-2xl bg-surface-raised-base px-4 py-4 text-12-regular text-text-weak">
            This project does not have a research plugin context yet.
          </div>
        }
      >
        {(researchProject) => (
          <>
            <div class="grid gap-4 md:grid-cols-3">
              <div class="rounded-2xl bg-surface-raised-base px-4 py-4">
                <div class="text-11-medium uppercase tracking-wide text-text-weak">Project</div>
                <div class="mt-2 text-16-medium text-text-strong">{bundle()?.project.name ?? bundle()?.project.id}</div>
              </div>
              <div class="rounded-2xl bg-surface-raised-base px-4 py-4">
                <div class="text-11-medium uppercase tracking-wide text-text-weak">Research Project ID</div>
                <div class="mt-2 text-13-medium text-text-strong">{researchProject().research_project_id}</div>
              </div>
              <div class="rounded-2xl bg-surface-raised-base px-4 py-4">
                <div class="text-11-medium uppercase tracking-wide text-text-weak">Sources</div>
                <div class="mt-2 text-16-medium text-text-strong">{sortedSources().length}</div>
              </div>
            </div>

            <section class="rounded-2xl bg-surface-raised-base px-4 py-4" data-component="research-literature-list">
              <div class="flex items-center justify-between">
                <div class="text-11-medium uppercase tracking-wide text-text-weak">Source Corpus</div>
                <span class="text-11-regular text-text-weak">{sortedSources().length} items</span>
              </div>
              <div class="mt-3 flex flex-col gap-2">
                <For each={sortedSources()}>
                  {(source) => (
                    <div class="rounded-xl bg-background-base px-3 py-3">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="text-13-medium text-text-strong">{source.title?.trim() || source.filename}</div>
                          <div class="mt-1 break-all text-11-regular text-text-weak">{source.filename}</div>
                        </div>
                        <span class="rounded-full bg-surface-raised-base px-2 py-1 text-10-medium uppercase tracking-wide text-text-weak">
                          {source.source_id}
                        </span>
                      </div>
                    </div>
                  )}
                </For>
                <Show when={sortedSources().length === 0}>
                  <div class="rounded-xl bg-background-base px-3 py-3 text-12-regular text-text-weak">
                    No literature has been imported yet.
                  </div>
                </Show>
              </div>
            </section>
          </>
        )}
      </Show>
    </div>
  )
}
