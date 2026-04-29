import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test"
import type { Prompt } from "@/context/prompt"

let createPromptSubmit: typeof import("./submit").createPromptSubmit

const createdClients: string[] = []
const createdSessions: string[] = []
const enabledAutoAccept: Array<{ sessionID: string; directory: string }> = []
const optimistic: Array<{
  message: {
    agent: string
    model: { providerID: string; modelID: string }
    variant?: string
  }
}> = []
const sentShell: string[] = []
const syncedDirectories: string[] = []

let params: { id?: string } = {}
let selected = "/repo/worktree-a"
let variant: string | undefined

const promptValue: Prompt = [{ type: "text", content: "ls", start: 0, end: 2 }]

const clientFor = (directory: string) => {
  createdClients.push(directory)
  return {
    session: {
      create: async () => {
        createdSessions.push(directory)
        return { data: { id: `session-${createdSessions.length}` } }
      },
      shell: async () => {
        sentShell.push(directory)
        return { data: undefined }
      },
      prompt: async () => ({ data: undefined }),
      promptAsync: async () => ({ data: undefined }),
      command: async () => ({ data: undefined }),
      abort: async () => ({ data: undefined }),
    },
    worktree: {
      create: async () => ({ data: { directory: `${directory}/new` } }),
    },
  }
}

beforeAll(async () => {
  const rootClient = clientFor("/repo/main")

  mock.module("@solidjs/router", () => ({
    useNavigate: () => () => undefined,
    useParams: () => params,
  }))

  mock.module("@palimpsest/sdk/v2/client", () => ({
    createPalimpsestClient: (input: { directory: string }) => {
      createdClients.push(input.directory)
      return clientFor(input.directory)
    },
  }))

  mock.module("@palimpsest/ui/toast", () => ({
    showToast: () => 0,
  }))

  mock.module("@palimpsest/shared/encode", () => ({
    base64Encode: (value: string) => value,
  }))

  // Stub out the moved session-id provider so submit.ts (now in
  // plugin-sdk) reads `params.id` from our local mutable `params`.
  mock.module("@palimpsest/plugin-sdk/web/chat/session-id", () => ({
    useSessionID: () => params,
    SessionIDProvider: ({ children }: { children: unknown }) => children,
  }))

  // Single mock of the chat-subsystem PluginWebHost adapter. submit.ts
  // (Phase 2.11.7) now reaches all 9 host stores through this one
  // bridge instead of importing each `@/context/*` directly. The slice
  // shapes follow `packages/plugin-sdk/src/host-web.ts`.
  const sdkSlice = {
    directory: "/repo/main",
    client: rootClient,
    url: "http://localhost:4096",
    createClient(opts: { directory: string }) {
      return clientFor(opts.directory)
    },
  }
  const localSlice = {
    model: {
      current: () => ({ id: "model", provider: { id: "provider" } }),
      variant: {
        current: () => variant,
        list: () => [],
        set: () => undefined,
      },
    },
    agent: {
      current: () => ({ name: "agent" }),
      list: () => [{ name: "agent" }],
      set: () => undefined,
    },
  }
  const permissionSlice = {
    autoResponds: () => false,
    enableAutoAccept(sessionID: string, directory: string) {
      enabledAutoAccept.push({ sessionID, directory })
    },
    isAutoAccepting: () => false,
    isAutoAcceptingDirectory: () => false,
    toggleAutoAccept: () => undefined,
    toggleAutoAcceptDirectory: () => undefined,
  }
  const promptSlice = {
    ready: () => true,
    current: () => promptValue,
    cursor: () => undefined,
    dirty: () => false,
    reset: () => undefined,
    set: () => undefined,
    context: {
      add: () => undefined,
      remove: () => undefined,
      removeComment: () => undefined,
      updateComment: () => undefined,
      replaceComments: () => undefined,
      items: () => [],
    },
  }
  const layoutSlice = {
    handoff: {
      setTabs: () => undefined,
    },
    tabs: () => ({ setActive: () => undefined, open: () => undefined }),
    view: () => ({ reviewPanel: { open: () => undefined, opened: () => false } }),
    fileTree: { setTab: () => undefined },
  }
  const syncSlice = {
    data: {
      command: [],
      session: [],
      permission: {},
      question: {},
      message: {},
      session_status: {},
      workflow: {},
      session_diff: {},
      agent: [],
    },
    project: undefined,
    set: () => undefined,
    session: {
      sync: () => undefined,
      get: () => undefined,
      history: { more: () => false, loading: () => false, loadMore: () => undefined },
      optimistic: {
        add: (value: {
          message: { agent: string; model: { providerID: string; modelID: string }; variant?: string }
        }) => {
          optimistic.push(value)
        },
        remove: () => undefined,
      },
    },
  }
  const globalSyncSlice = {
    data: { session_todo: {}, session_workflow: {} },
    todo: { set: () => undefined },
    child: (directory: string) => {
      syncedDirectories.push(directory)
      return [{}, () => undefined] as never
    },
  }
  const productSlice = {
    replaceSessionAttachments: async () => undefined,
  }
  const settingsSlice = {
    general: {
      showReasoningSummaries: () => false,
      shellToolPartsExpanded: () => false,
      editToolPartsExpanded: () => false,
    },
  }
  const languageSlice = { t: (key: string) => key }

  mock.module("@palimpsest/plugin-sdk/host-web", () => ({
    PluginWebHostContext: { id: "plugin-web-host" },
    usePluginWebHost: () => ({
      directory: () => "/repo/main",
      workspaceID: () => undefined,
      actor: () => ({ type: "system", id: "test" }),
      capabilities: () => ({
        canWrite: true,
        canReview: true,
        canShare: true,
        canExportImport: true,
        canManageMembers: true,
        canRun: true,
      }),
      baseURL: () => undefined,
      fetch: async () => new Response(),
      sdk: () => sdkSlice,
      sync: () => syncSlice,
      globalSync: () => globalSyncSlice,
      settings: () => settingsSlice,
      language: () => languageSlice,
      permission: () => permissionSlice,
      prompt: () => promptSlice,
      local: () => localSlice,
      layout: () => layoutSlice,
      product: () => productSlice,
    }),
  }))

  const mod = await import("./submit")
  createPromptSubmit = mod.createPromptSubmit
})

beforeEach(() => {
  createdClients.length = 0
  createdSessions.length = 0
  enabledAutoAccept.length = 0
  optimistic.length = 0
  params = {}
  sentShell.length = 0
  syncedDirectories.length = 0
  selected = "/repo/worktree-a"
  variant = undefined
})

describe("prompt submit worktree selection", () => {
  test("reads the latest worktree accessor value per submit", async () => {
    const submit = createPromptSubmit({
      info: () => undefined,
      imageAttachments: () => [],
      commentCount: () => 0,
      autoAccept: () => false,
      mode: () => "shell",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      newSessionWorktree: () => selected,
      onNewSessionWorktreeReset: () => undefined,
      onSubmit: () => undefined,
    })

    const event = { preventDefault: () => undefined } as unknown as Event

    await submit.handleSubmit(event)
    selected = "/repo/worktree-b"
    await submit.handleSubmit(event)

    expect(createdClients).toEqual(["/repo/worktree-a", "/repo/worktree-b"])
    expect(createdSessions).toEqual(["/repo/worktree-a", "/repo/worktree-b"])
    expect(sentShell).toEqual(["/repo/worktree-a", "/repo/worktree-b"])
    expect(syncedDirectories).toEqual(["/repo/worktree-a", "/repo/worktree-b"])
  })

  test("applies auto-accept to newly created sessions", async () => {
    const submit = createPromptSubmit({
      info: () => undefined,
      imageAttachments: () => [],
      commentCount: () => 0,
      autoAccept: () => true,
      mode: () => "shell",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      newSessionWorktree: () => selected,
      onNewSessionWorktreeReset: () => undefined,
      onSubmit: () => undefined,
    })

    const event = { preventDefault: () => undefined } as unknown as Event

    await submit.handleSubmit(event)

    expect(enabledAutoAccept).toEqual([{ sessionID: "session-1", directory: "/repo/worktree-a" }])
  })

  test("includes the selected variant on optimistic prompts", async () => {
    params = { id: "session-1" }
    variant = "high"

    const submit = createPromptSubmit({
      info: () => ({ id: "session-1" }),
      imageAttachments: () => [],
      commentCount: () => 0,
      autoAccept: () => false,
      mode: () => "normal",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      onSubmit: () => undefined,
    })

    const event = { preventDefault: () => undefined } as unknown as Event

    await submit.handleSubmit(event)

    expect(optimistic).toHaveLength(1)
    expect(optimistic[0]).toMatchObject({
      message: {
        agent: "agent",
        model: { providerID: "provider", modelID: "model" },
        variant: "high",
      },
    })
  })
})
