import { Button } from "@opencode-ai/ui/button"
import { Mark } from "@opencode-ai/ui/logo"
import { TextField } from "@opencode-ai/ui/text-field"
import { createStore } from "solid-js/store"
import { useAuth } from "@/context/auth"

export default function LoginPage() {
  const auth = useAuth()
  const [store, setStore] = createStore({
    username: "admin",
    password: "123456",
    error: "",
  })

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setStore("error", "")
    const ok = await auth.login({
      username: store.username.trim(),
      password: store.password,
    })
    if (ok) return
    setStore("error", auth.error() || "登录失败")
  }

  return (
    <div class="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(214,161,94,.32),_transparent_42%),linear-gradient(180deg,_#f6f2ea_0%,_#efe6d9_100%)] text-[#24180d]">
      <div class="mx-auto flex min-h-screen w-full max-w-[1080px] items-center gap-10 px-6 py-10 lg:px-10">
        <div class="hidden flex-1 flex-col gap-6 lg:flex">
          <div class="inline-flex size-16 items-center justify-center rounded-2xl bg-[#20150d] text-[#f5ecdf] shadow-[0_24px_80px_rgba(36,24,13,.22)]">
            <Mark class="size-9" />
          </div>
          <div class="max-w-[520px]">
            <div class="text-[13px] font-medium uppercase tracking-[0.32em] text-[#8c5c2f]">Palimpsest</div>
            <h1 class="mt-4 font-serif text-[72px] leading-[0.92] tracking-[-0.04em]">Reasoning, now with a front door.</h1>
            <p class="mt-5 max-w-[420px] text-[18px] leading-8 text-[#6e5a46]">
              This rebuild now runs as a real multi-user workspace product. Sign in to open projects, review proposals,
              and manage shared reasoning assets.
            </p>
          </div>
        </div>

        <div class="w-full max-w-[420px] rounded-[28px] border border-[#d8c5ad] bg-[rgba(255,251,245,.82)] p-7 shadow-[0_28px_100px_rgba(70,43,14,.14)] backdrop-blur-xl">
          <div class="lg:hidden">
            <div class="inline-flex size-12 items-center justify-center rounded-2xl bg-[#20150d] text-[#f5ecdf]">
              <Mark class="size-7" />
            </div>
            <h1 class="mt-4 text-[34px] font-semibold tracking-[-0.03em]">登录 Palimpsest</h1>
          </div>

          <div class="hidden lg:block">
            <div class="text-[13px] font-medium uppercase tracking-[0.28em] text-[#8c5c2f]">Account Login</div>
            <h1 class="mt-3 text-[36px] font-semibold tracking-[-0.03em]">进入工作区</h1>
          </div>

          <form class="mt-7 flex flex-col gap-4" onSubmit={submit}>
            <TextField
              autofocus
              label="账号"
              value={store.username}
              onChange={(value) => setStore("username", value)}
              placeholder="admin"
            />
            <TextField
              label="密码"
              type="password"
              value={store.password}
              onChange={(value) => setStore("password", value)}
              placeholder="123456"
            />

            <div class="rounded-2xl border border-[#dfcfba] bg-[#f8f1e7] px-4 py-3 text-[12px] leading-6 text-[#6a563f]">
              默认管理员账户已启用：
              <strong class="ml-1 font-semibold text-[#2d1d0f]">admin / 123456</strong>
            </div>

            <Button type="submit" size="large" disabled={auth.pending()}>
              {auth.pending() ? "登录中..." : "登录并进入"}
            </Button>

            <div class="min-h-[20px] text-[13px] text-[#a53b2d]">{store.error || auth.error()}</div>
          </form>
        </div>
      </div>
    </div>
  )
}
