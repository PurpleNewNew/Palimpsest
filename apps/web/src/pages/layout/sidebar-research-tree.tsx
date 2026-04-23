import { type Session } from "@palimpsest/sdk/v2/client"
import { Collapsible } from "@palimpsest/ui/collapsible"
import { Icon } from "@palimpsest/ui/icon"
import { IconButton } from "@palimpsest/ui/icon-button"
import { showToast } from "@palimpsest/ui/toast"
import { Tooltip } from "@palimpsest/ui/tooltip"
import { useParams } from "@solidjs/router"
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
  type Accessor,
  type JSX,
} from "solid-js"
import { useGlobalSDK } from "@/context/global-sdk"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { serverFetch } from "@/utils/server"
import { NewSessionItem, SessionItem, SessionSkeleton } from "./sidebar-items"
import type { WorkspaceSidebarContext } from "./sidebar-workspace"

type Tree = {
  atomSessionIds: string[]
  expSessionIds: string[]
  atoms: {
    atom_id: string
    atom_name: string
    atom_type: string
    atom_evidence_status: string
    session_id: string | null
    experiments: {
      exp_id: string
      exp_name: string
      exp_session_id: string | null
      status: "pending" | "running" | "done" | "idle" | "failed"
    }[]
  }[]
}

type TreeAtom = Tree["atoms"][number]

function useResearchFetch() {
  const globalSDK = useGlobalSDK()
  const platform = usePlatform()
  const server = useServer()

  return async function request<T>(directory: string, path: string, init?: RequestInit) {
    const http = server.current?.http
    if (!http) throw new Error("No server available")
    const url = new URL(path, globalSDK.url)
    url.searchParams.set("directory", directory)
    const headers = new Headers(init?.headers)
    headers.set("x-palimpsest-directory", directory)
    if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json")
    const run = serverFetch(http, platform.fetch ?? globalThis.fetch)
    const res = await run(url, { ...init, headers })
    if (!res.ok) {
      const body = await res.json().catch(() => undefined)
      const message =
        body && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? (body.message as string)
          : `Request failed: ${res.status}`
      throw new Error(message)
    }
    return (await res.json()) as T
  }
}

export function ResearchSessionTree(props: {
  slug: Accessor<string>
  mobile?: boolean
  ctx: WorkspaceSidebarContext
  showNew: Accessor<boolean>
  loading: Accessor<boolean>
  sessions: Accessor<Session[]>
  children: Accessor<Map<string, string[]>>
  hasMore: Accessor<boolean>
  loadMore: () => Promise<void>
  researchProjectId: string
  directory: string
}): JSX.Element {
  const language = useLanguage()
  const globalSDK = useGlobalSDK()
  const params = useParams()
  const request = useResearchFetch()

  const [version, setVersion] = createSignal(0)
  const [tree] = createResource(
    () => ({ id: props.researchProjectId, version: version() }),
    async ({ id }) => {
      try {
        return await request<Tree>(
          props.directory,
          `/api/plugin/research/project/${encodeURIComponent(id)}/session-tree`,
        )
      } catch {
        return undefined
      }
    },
  )

  createEffect(
    on(
      () => props.sessions().length,
      () => setVersion((v) => v + 1),
      { defer: true },
    ),
  )

  createEffect(() => {
    const off = globalSDK.event.on(props.directory, (event) => {
      if ((event as { type?: string }).type !== "research.atoms.updated") return
      setVersion((v) => v + 1)
    })
    onCleanup(off)
  })

  const atomSessionIds = createMemo(() => new Set(tree()?.atomSessionIds ?? []))
  const expSessionIds = createMemo(() => new Set(tree()?.expSessionIds ?? []))
  const normalSessions = createMemo(() =>
    props.sessions().filter((item) => !atomSessionIds().has(item.id) && !expSessionIds().has(item.id)),
  )
  const sessionMap = createMemo(() => {
    const map = new Map<string, Session>()
    for (const item of props.sessions()) map.set(item.id, item)
    return map
  })
  const sessionToAtom = createMemo(() => {
    const map = new Map<string, string>()
    for (const atom of tree()?.atoms ?? []) {
      if (atom.session_id) map.set(atom.session_id, atom.atom_id)
      for (const exp of atom.experiments) {
        if (exp.exp_session_id) map.set(exp.exp_session_id, atom.atom_id)
      }
    }
    return map
  })
  const activeAtom = createMemo(() => {
    const id = params.id
    if (!id) return
    return sessionToAtom().get(id)
  })
  const [atomsOpen, setAtomsOpen] = createSignal<boolean | undefined>(undefined)
  const atomsVisible = createMemo(() => atomsOpen() ?? !!activeAtom())

  createEffect(
    on(
      activeAtom,
      () => setAtomsOpen(undefined),
      { defer: true },
    ),
  )

  const [exporting, setExporting] = createSignal(false)

  const exportProject = async () => {
    if (exporting()) return
    setExporting(true)
    try {
      const data = await request<{ zip_path: string; zip_name: string; size: number }>(
        props.directory,
        `/api/plugin/research/project/${encodeURIComponent(props.researchProjectId)}/export`,
        { method: "POST" },
      )
      if (data) {
        showToast({
          title: language.t("research.export.success"),
          description: `${data.zip_name} (${(data.size / 1024 / 1024).toFixed(2)} MB)`,
          variant: "success",
        })
      }
    } catch (err) {
      showToast({
        title: language.t("research.export.failed"),
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <nav class="flex flex-col gap-1 px-3">
      <div class="flex items-center justify-between px-2 pt-2 pb-1">
        <div class="text-11-regular text-text-weak uppercase tracking-wider">
          {language.t("sidebar.research.project")}
        </div>
        <Tooltip value={language.t("research.export.tooltip")} placement="top">
          <IconButton
            icon="download"
            variant="ghost"
            size="small"
            class="size-5"
            onClick={exportProject}
            disabled={exporting()}
            aria-label={language.t("research.export.button")}
          />
        </Tooltip>
      </div>

      <Show when={props.showNew()}>
        <NewSessionItem
          slug={props.slug()}
          mobile={props.mobile}
          sidebarExpanded={props.ctx.sidebarExpanded}
          clearHoverProjectSoon={props.ctx.clearHoverProjectSoon}
          setHoverSession={props.ctx.setHoverSession}
        />
      </Show>
      <Show when={props.loading()}>
        <SessionSkeleton />
      </Show>

      <Show when={normalSessions().length > 0}>
        <div class="flex items-center justify-between px-2 pt-2 pb-1">
          <div class="text-11-regular text-text-weak uppercase tracking-wider">
            {language.t("sidebar.research.conversations")}
          </div>
          <Tooltip value={language.t("command.session.viewArchived")} placement="top">
            <IconButton
              icon="archive"
              variant="ghost"
              size="small"
              class="size-5"
              onClick={() => props.ctx.showArchivedSessionsDialog(props.directory)}
              aria-label={language.t("command.session.viewArchived")}
            />
          </Tooltip>
        </div>
        <For each={normalSessions()}>
          {(session) => (
            <SessionItem
              session={session}
              slug={props.slug()}
              mobile={props.mobile}
              children={props.children()}
              sidebarExpanded={props.ctx.sidebarExpanded}
              sidebarHovering={props.ctx.sidebarHovering}
              nav={props.ctx.nav}
              hoverSession={props.ctx.hoverSession}
              setHoverSession={props.ctx.setHoverSession}
              clearHoverProjectSoon={props.ctx.clearHoverProjectSoon}
              prefetchSession={props.ctx.prefetchSession}
              archiveSession={props.ctx.archiveSession}
            />
          )}
        </For>
      </Show>

      <Show when={tree()?.atoms && tree()!.atoms.length > 0}>
        <Collapsible variant="ghost" class="shrink-0" open={atomsVisible()} onOpenChange={setAtomsOpen}>
          <div class="px-0 py-1">
            <Collapsible.Trigger class="flex items-center justify-between w-full px-2 py-1 rounded-md hover:bg-surface-raised-base-hover">
              <div class="flex items-center gap-1 min-w-0 flex-1">
                <span class="text-11-regular text-text-weak uppercase tracking-wider">
                  {language.t("sidebar.research.atoms")} ({tree()!.atoms.length})
                </span>
              </div>
            </Collapsible.Trigger>
          </div>
          <Collapsible.Content>
            <div class="flex flex-col gap-0.5">
              <For each={tree()!.atoms}>
                {(atom) => (
                  <AtomGroup
                    atom={atom}
                    slug={props.slug}
                    mobile={props.mobile}
                    ctx={props.ctx}
                    sessionMap={sessionMap}
                    childrenMap={props.children}
                    activeAtom={activeAtom}
                    activeSession={() => params.id}
                  />
                )}
              </For>
            </div>
          </Collapsible.Content>
        </Collapsible>
      </Show>
    </nav>
  )
}

function AtomGroup(props: {
  atom: TreeAtom
  slug: Accessor<string>
  mobile?: boolean
  ctx: WorkspaceSidebarContext
  sessionMap: Accessor<Map<string, Session>>
  childrenMap: Accessor<Map<string, string[]>>
  activeAtom: Accessor<string | undefined>
  activeSession: Accessor<string | undefined>
}): JSX.Element {
  const atomSession = createMemo(() =>
    props.atom.session_id ? props.sessionMap().get(props.atom.session_id) : undefined,
  )
  const expSessions = createMemo(
    () =>
      props.atom.experiments
        .filter((exp) => exp.exp_session_id)
        .map((exp) => ({
          exp,
          session: props.sessionMap().get(exp.exp_session_id!),
        }))
        .filter((item) => item.session !== undefined) as Array<{
        exp: TreeAtom["experiments"][number]
        session: Session
      }>,
  )
  const hasContent = createMemo(() => !!atomSession() || expSessions().length > 0)
  const active = createMemo(() => props.activeAtom() === props.atom.atom_id)
  const [open, setOpen] = createSignal<boolean | undefined>(undefined)
  const visible = createMemo(() => open() ?? active())

  createEffect(
    on(
      active,
      () => setOpen(undefined),
      { defer: true },
    ),
  )

  return (
    <Collapsible variant="ghost" class="shrink-0 pl-2" open={visible()} onOpenChange={setOpen}>
      <div class="py-0.5">
        <Collapsible.Trigger class="flex items-center justify-between w-full px-2 py-1 rounded-md hover:bg-surface-raised-base-hover">
          <div class="flex items-center gap-1.5 min-w-0 flex-1">
            <Icon name="atom" size="small" class="text-icon-base shrink-0" />
            <span class="text-13-medium text-text-base min-w-0 truncate">{props.atom.atom_name}</span>
          </div>
        </Collapsible.Trigger>
      </div>
      <Collapsible.Content>
        <div class="flex flex-col gap-0.5 pl-2">
          <Show when={!hasContent()}>
            <div class="px-2 py-1 text-12-regular text-text-weak">No sessions</div>
          </Show>
          <Show when={atomSession()} keyed>
            {(session) => (
              <AtomSessionItem
                session={session}
                slug={props.slug()}
                mobile={props.mobile}
                icon="atom"
                ctx={props.ctx}
                childrenMap={props.childrenMap}
                active={() => props.activeSession() === session.id}
              />
            )}
          </Show>
          <For each={expSessions()}>
            {(item) => (
              <AtomSessionItem
                session={item.session}
                slug={props.slug()}
                mobile={props.mobile}
                icon="experiment"
                ctx={props.ctx}
                childrenMap={props.childrenMap}
                active={() => props.activeSession() === item.session.id}
              />
            )}
          </For>
        </div>
      </Collapsible.Content>
    </Collapsible>
  )
}

function AtomSessionItem(props: {
  session: Session
  slug: string
  mobile?: boolean
  icon: "atom" | "experiment"
  ctx: WorkspaceSidebarContext
  childrenMap: Accessor<Map<string, string[]>>
  active: Accessor<boolean>
}): JSX.Element {
  let el: HTMLDivElement | undefined

  createEffect(() => {
    if (!props.active() || !el) return
    requestAnimationFrame(() => el?.scrollIntoView({ block: "nearest", behavior: "smooth" }))
  })

  return (
    <div ref={el} class="flex items-center gap-0">
      <div class="shrink-0 size-5 flex items-center justify-center">
        <Icon name={props.icon} size="small" class="text-icon-weak" />
      </div>
      <div class="flex-1 min-w-0">
        <SessionItem
          session={props.session}
          slug={props.slug}
          mobile={props.mobile}
          dense
          children={props.childrenMap()}
          sidebarExpanded={props.ctx.sidebarExpanded}
          sidebarHovering={props.ctx.sidebarHovering}
          nav={props.ctx.nav}
          hoverSession={props.ctx.hoverSession}
          setHoverSession={props.ctx.setHoverSession}
          clearHoverProjectSoon={props.ctx.clearHoverProjectSoon}
          prefetchSession={props.ctx.prefetchSession}
          archiveSession={props.ctx.archiveSession}
        />
      </div>
    </div>
  )
}
