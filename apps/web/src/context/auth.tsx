import { createSimpleContext } from "@opencode-ai/ui/context"
import { createEffect, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { serverFetch } from "@/utils/server"

type Role = "owner" | "editor" | "viewer"

type User = {
  id: string
  username: string
  displayName?: string
  isAdmin: boolean
}

type Workspace = {
  id: string
  slug: string
  name: string
  role: Role
  memberCount: number
  inviteCount: number
  shareCount: number
}

type State = {
  user: User
  workspaces: Workspace[]
  workspaceID?: string
  role?: Role
}

export const { use: useAuth, provider: AuthProvider } = createSimpleContext({
  name: "Auth",
  init: () => {
    const server = useServer()
    const platform = usePlatform()
    const [store, setStore] = createStore({
      status: "loading" as "loading" | "guest" | "ready",
      pending: false,
      error: "",
      user: undefined as User | undefined,
      workspaces: [] as Workspace[],
      workspaceID: undefined as string | undefined,
      role: undefined as Role | undefined,
    })

    const fetcher = createMemo(() => {
      const current = server.current?.http
      if (!current) return
      return serverFetch(current, platform.fetch ?? globalThis.fetch)
    })

    const request = async (path: string, init?: RequestInit) => {
      const send = fetcher()
      const base = server.current?.http.url
      if (!send || !base) throw new Error("No server available")
      const headers = new Headers(init?.headers)
      if (init?.body && !headers.has("content-type")) {
        headers.set("content-type", "application/json")
      }
      return send(new URL(path, base), {
        ...init,
        headers,
      })
    }

    const apply = (data: State) => {
      setStore({
        status: "ready",
        pending: false,
        error: "",
        user: data.user,
        workspaces: data.workspaces,
        workspaceID: data.workspaceID,
        role: data.role,
      })
    }

    const guest = (error = "") => {
      setStore({
        status: "guest",
        pending: false,
        error,
        user: undefined,
        workspaces: [],
        workspaceID: undefined,
        role: undefined,
      })
    }

    const refresh = async () => {
      setStore("status", "loading")
      const res = await request("/api/auth/session").catch(() => undefined)
      if (!res || res.status === 401) {
        guest()
        return
      }
      if (!res.ok) {
        guest("无法读取登录状态")
        return
      }
      apply((await res.json()) as State)
    }

    createEffect(() => {
      const key = server.current?.http.url
      if (!key) return
      void refresh()
    })

    return {
      status: () => store.status,
      pending: () => store.pending,
      error: () => store.error,
      user: () => store.user,
      workspaces: () => store.workspaces,
      workspaceID: () => store.workspaceID,
      role: () => store.role,
      workspace: () => store.workspaces.find((item) => item.id === store.workspaceID),
      refresh,
      async login(input: { username: string; password: string }) {
        setStore("pending", true)
        setStore("error", "")
        const res = await request("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(input),
        }).catch(() => undefined)
        if (!res) {
          guest("无法连接服务器")
          return false
        }
        if (res.status === 401) {
          guest("账号或密码错误")
          return false
        }
        if (!res.ok) {
          guest("登录失败")
          return false
        }
        apply((await res.json()) as State)
        return true
      },
      async logout() {
        setStore("pending", true)
        await request("/api/auth/logout", {
          method: "POST",
        }).catch(() => undefined)
        guest()
      },
      async selectWorkspace(workspaceID: string) {
        const res = await request("/api/workspaces/current", {
          method: "POST",
          body: JSON.stringify({ workspaceID }),
        }).catch(() => undefined)
        if (!res?.ok) return false
        await refresh()
        return true
      },
    }
  },
})
