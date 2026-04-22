import { createResource, createSignal, For, Match, Show, Switch, type JSX } from "solid-js"
import { useParams } from "@solidjs/router"
import { Button } from "@palimpsest/ui/button"

import { useAuth } from "@/context/auth"
import { type Invite, type Member, type Share, usePhase7 } from "@/context/phase7"

type Tab = "members" | "invites" | "shares" | "data"

function formatTime(ms?: number) {
  if (!ms) return "—"
  return new Date(ms).toLocaleString()
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function Workspace(): JSX.Element {
  const params = useParams<{ dir: string }>()
  const auth = useAuth()
  const phase7 = usePhase7(() => params.dir)

  const [tab, setTab] = createSignal<Tab>("members")
  const [refreshKey, setRefreshKey] = createSignal(0)
  const [error, setError] = createSignal<string | undefined>()
  const [busy, setBusy] = createSignal<string | undefined>()

  const workspaceID = () => auth.workspaceID()

  const [members, { refetch: refetchMembers }] = createResource(
    () => (workspaceID() ? { id: workspaceID()!, key: refreshKey() } : undefined),
    (input) => phase7.members(input.id),
  )
  const [invites, { refetch: refetchInvites }] = createResource(
    () => (workspaceID() && auth.role() === "owner" ? { id: workspaceID()!, key: refreshKey() } : undefined),
    (input) => phase7.invites(input.id),
  )
  const [shares, { refetch: refetchShares }] = createResource(
    () => (workspaceID() ? { id: workspaceID()!, key: refreshKey() } : undefined),
    (input) => phase7.shares(input.id),
  )

  async function handle<T>(label: string, run: () => Promise<T>) {
    setBusy(label)
    setError(undefined)
    try {
      return await run()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(undefined)
    }
  }

  async function createInvite(role: "owner" | "editor" | "viewer") {
    const id = workspaceID()
    if (!id) return
    await handle(`invite:${role}`, () => phase7.createInvite(id, { role }))
    await refetchInvites()
  }

  async function revokeInvite(invite: Invite) {
    await handle(`invite-revoke:${invite.id}`, () => phase7.revokeInvite(invite.id))
    await refetchInvites()
  }

  async function revokeShare(share: Share) {
    await handle(`share-revoke:${share.id}`, () => phase7.revokeShare(share.id))
    await refetchShares()
  }

  async function exportDomain() {
    await handle("export", async () => {
      const envelope = await phase7.exportProject()
      const name = `palimpsest-export-${params.dir ?? "project"}-${new Date(envelope.exportedAt)
        .toISOString()
        .replace(/[:.]/g, "-")}.json`
      downloadBlob(name, JSON.stringify(envelope, null, 2), "application/json")
    })
  }

  async function importDomain(file: File, opts: { autoApprove: boolean; preserveIds: boolean }) {
    await handle("import", async () => {
      const text = await file.text()
      const envelope = JSON.parse(text)
      if (!envelope || typeof envelope !== "object") throw new Error("Invalid envelope: expected JSON object.")
      const proposal = await phase7.importProject(envelope, opts)
      setError(
        opts.autoApprove
          ? `Imported as commit from proposal ${proposal.id}.`
          : `Imported into pending proposal ${proposal.id}. Approve it from /reviews.`,
      )
    })
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "members", label: "Members" },
    { id: "invites", label: "Invites" },
    { id: "shares", label: "Shares" },
    { id: "data", label: "Export / Import" },
  ]

  return (
    <div class="flex h-full flex-col bg-background-base" data-component="workspace-page">
      <div class="flex items-center justify-between border-b border-border-weak-base px-6 py-4">
        <div>
          <div class="text-11-medium uppercase tracking-[0.24em] text-text-weak">Workspace</div>
          <div class="mt-1 text-20-medium text-text-strong">{auth.workspace()?.name ?? "Workspace settings"}</div>
          <div class="mt-1 text-12-regular text-text-weak">
            Members, invites, shares, and project data, all governed by the role you hold here.
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="rounded-full bg-surface-raised-base px-3 py-1 text-11-medium uppercase tracking-wide text-text-weak">
            Role: {auth.role() ?? "—"}
          </span>
          <Button variant="secondary" size="small" onClick={() => setRefreshKey((v) => v + 1)}>
            Refresh
          </Button>
        </div>
      </div>

      <div class="border-b border-border-weak-base px-6" data-component="workspace-tabs">
        <div class="flex items-center gap-1">
          <For each={tabs}>
            {(entry) => (
              <button
                type="button"
                data-component="workspace-tab"
                data-tab={entry.id}
                data-active={tab() === entry.id}
                class={`border-b-2 px-3 py-2 text-12-medium ${tab() === entry.id ? "border-border-base text-text-strong" : "border-transparent text-text-weak hover:text-text-strong"}`}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
              </button>
            )}
          </For>
        </div>
      </div>

      <Show when={error()}>
        <div
          class="mx-6 mt-4 rounded-2xl border border-border-weak-base bg-surface-raised-base px-4 py-3 text-12-regular text-text-strong"
          data-component="workspace-message"
        >
          {error()}
        </div>
      </Show>

      <div class="flex-1 overflow-y-auto px-6 py-4">
        <Switch>
          <Match when={tab() === "members"}>
            <MembersTab members={members()} />
          </Match>
          <Match when={tab() === "invites"}>
            <InvitesTab
              invites={invites()}
              canManage={auth.role() === "owner"}
              busy={busy()}
              onCreate={createInvite}
              onRevoke={revokeInvite}
            />
          </Match>
          <Match when={tab() === "shares"}>
            <SharesTab shares={shares()} busy={busy()} onRevoke={revokeShare} />
          </Match>
          <Match when={tab() === "data"}>
            <DataTab busy={busy()} onExport={exportDomain} onImport={importDomain} />
          </Match>
        </Switch>
      </div>
    </div>
  )
}

function MembersTab(props: { members: Member[] | undefined }): JSX.Element {
  return (
    <section class="flex flex-col gap-2" data-component="workspace-members">
      <Show when={props.members}>
        {(list) => (
          <>
            <div class="text-11-medium uppercase tracking-wide text-text-weak">{list().length} members</div>
            <For each={list()}>
              {(member) => (
                <div
                  class="flex items-center justify-between rounded-xl bg-surface-raised-base px-4 py-3"
                  data-component="member-item"
                  data-user-id={member.user.id}
                >
                  <div>
                    <div class="text-13-medium text-text-strong">
                      {member.user.displayName ?? member.user.username}
                    </div>
                    <div class="text-11-regular text-text-weak">
                      {member.user.username} · {member.user.id}
                      <Show when={member.user.isAdmin}>
                        <span class="ml-2 rounded bg-background-base px-1.5 py-0.5 text-10-medium text-text-strong">
                          admin
                        </span>
                      </Show>
                    </div>
                  </div>
                  <span class="rounded-full bg-background-base px-3 py-1 text-10-medium uppercase tracking-wide text-text-weak">
                    {member.role}
                  </span>
                </div>
              )}
            </For>
          </>
        )}
      </Show>
      <Show when={!props.members}>
        <div class="text-12-regular text-text-weak">Loading members…</div>
      </Show>
    </section>
  )
}

function InvitesTab(props: {
  invites: Invite[] | undefined
  canManage: boolean
  busy: string | undefined
  onCreate: (role: "owner" | "editor" | "viewer") => void | Promise<void>
  onRevoke: (invite: Invite) => void | Promise<void>
}): JSX.Element {
  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => undefined)
  }

  return (
    <section class="flex flex-col gap-3" data-component="workspace-invites">
      <Show
        when={props.canManage}
        fallback={
          <div class="rounded-xl bg-surface-raised-base px-4 py-3 text-12-regular text-text-weak">
            Only workspace owners can manage invites.
          </div>
        }
      >
        <div class="flex flex-wrap items-center gap-2 rounded-xl bg-surface-raised-base px-4 py-3">
          <span class="text-12-regular text-text-weak">Invite a new member as</span>
          <Button
            variant="secondary"
            size="small"
            data-action="invite-viewer"
            disabled={props.busy === "invite:viewer"}
            onClick={() => props.onCreate("viewer")}
          >
            Viewer
          </Button>
          <Button
            variant="secondary"
            size="small"
            data-action="invite-editor"
            disabled={props.busy === "invite:editor"}
            onClick={() => props.onCreate("editor")}
          >
            Editor
          </Button>
          <Button
            variant="secondary"
            size="small"
            data-action="invite-owner"
            disabled={props.busy === "invite:owner"}
            onClick={() => props.onCreate("owner")}
          >
            Owner
          </Button>
        </div>
      </Show>

      <Show when={props.invites}>
        {(list) => (
          <For each={list()}>
            {(invite) => (
              <div
                class="flex flex-col gap-2 rounded-xl bg-surface-raised-base px-4 py-3"
                data-component="invite-item"
                data-invite-id={invite.id}
              >
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <div class="text-13-medium text-text-strong">Code: {invite.code}</div>
                    <div class="text-11-regular text-text-weak">
                      Role: {invite.role} · created {formatTime(invite.time.created)}
                      <Show when={invite.expiresAt}> · expires {formatTime(invite.expiresAt)}</Show>
                      <Show when={invite.acceptedAt}>
                        {" "}· accepted by {invite.acceptedByUserID} {formatTime(invite.acceptedAt)}
                      </Show>
                    </div>
                  </div>
                  <div class="flex items-center gap-1">
                    <Button variant="secondary" size="small" data-action="invite-copy" onClick={() => copy(invite.code)}>
                      Copy code
                    </Button>
                    <Show when={props.canManage && !invite.acceptedAt && !invite.revokedAt}>
                      <Button
                        variant="secondary"
                        size="small"
                        data-action="invite-revoke"
                        disabled={props.busy === `invite-revoke:${invite.id}`}
                        onClick={() => props.onRevoke(invite)}
                      >
                        Revoke
                      </Button>
                    </Show>
                  </div>
                </div>
              </div>
            )}
          </For>
        )}
      </Show>
      <Show when={props.canManage && (props.invites?.length ?? 0) === 0}>
        <div class="rounded-xl bg-surface-raised-base px-4 py-3 text-12-regular text-text-weak">
          No active invites. Create one above to onboard a teammate.
        </div>
      </Show>
    </section>
  )
}

function SharesTab(props: {
  shares: Share[] | undefined
  busy: string | undefined
  onRevoke: (share: Share) => void | Promise<void>
}): JSX.Element {
  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => undefined)
  }
  return (
    <section class="flex flex-col gap-2" data-component="workspace-shares">
      <Show when={props.shares}>
        {(list) => (
          <>
            <Show when={list().length === 0}>
              <div class="rounded-xl bg-surface-raised-base px-4 py-3 text-12-regular text-text-weak">
                No active shares. Publish a session from the session page.
              </div>
            </Show>
            <For each={list()}>
              {(share) => (
                <div
                  class="flex flex-col gap-2 rounded-xl bg-surface-raised-base px-4 py-3"
                  data-component="share-item"
                  data-share-id={share.id}
                >
                  <div class="flex items-center justify-between gap-2">
                    <div>
                      <div class="text-13-medium text-text-strong">{share.title ?? share.slug}</div>
                      <div class="text-11-regular text-text-weak">
                        {share.kind} · created {formatTime(share.time.created)}
                        <Show when={share.sessionID}> · session {share.sessionID}</Show>
                      </div>
                    </div>
                    <div class="flex items-center gap-1">
                      <Button variant="secondary" size="small" data-action="share-copy" onClick={() => copy(share.url)}>
                        Copy link
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        data-action="share-revoke"
                        disabled={props.busy === `share-revoke:${share.id}`}
                        onClick={() => props.onRevoke(share)}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                  <a
                    class="break-all text-11-regular text-text-interactive-base hover:underline"
                    href={share.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {share.url}
                  </a>
                </div>
              )}
            </For>
          </>
        )}
      </Show>
      <Show when={!props.shares}>
        <div class="text-12-regular text-text-weak">Loading shares…</div>
      </Show>
    </section>
  )
}

function DataTab(props: {
  busy: string | undefined
  onExport: () => void | Promise<void>
  onImport: (file: File, opts: { autoApprove: boolean; preserveIds: boolean }) => void | Promise<void>
}): JSX.Element {
  const [autoApprove, setAutoApprove] = createSignal(false)
  const [preserveIds, setPreserveIds] = createSignal(false)
  let fileInput: HTMLInputElement | undefined

  function handleImport(event: Event) {
    const target = event.currentTarget as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return
    void props.onImport(file, { autoApprove: autoApprove(), preserveIds: preserveIds() })
    target.value = ""
  }

  return (
    <section class="flex flex-col gap-4" data-component="workspace-data">
      <div class="rounded-xl bg-surface-raised-base px-4 py-4" data-component="export-panel">
        <div class="text-13-medium text-text-strong">Export project</div>
        <div class="mt-1 text-12-regular text-text-weak">
          Downloads a JSON envelope with every accepted entity and pending proposal in this project.
        </div>
        <div class="mt-3">
          <Button
            variant="primary"
            size="small"
            data-action="export-project"
            disabled={props.busy === "export"}
            onClick={() => props.onExport()}
          >
            {props.busy === "export" ? "Exporting…" : "Download export"}
          </Button>
        </div>
      </div>

      <div class="rounded-xl bg-surface-raised-base px-4 py-4" data-component="import-panel">
        <div class="text-13-medium text-text-strong">Import envelope</div>
        <div class="mt-1 text-12-regular text-text-weak">
          Load a previously exported envelope. By default the import lands as a pending proposal under new ids so it can
          coexist with the current project.
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-4 text-12-regular text-text-weak">
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              data-field="auto-approve"
              checked={autoApprove()}
              onChange={(e) => setAutoApprove(e.currentTarget.checked)}
            />
            Auto-approve (ship mode)
          </label>
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              data-field="preserve-ids"
              checked={preserveIds()}
              onChange={(e) => setPreserveIds(e.currentTarget.checked)}
            />
            Preserve original ids (only safe on empty projects)
          </label>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <Button
            variant="primary"
            size="small"
            data-action="import-project"
            disabled={props.busy === "import"}
            onClick={() => fileInput?.click()}
          >
            {props.busy === "import" ? "Importing…" : "Choose envelope…"}
          </Button>
          <input
            ref={(el) => (fileInput = el)}
            type="file"
            accept="application/json"
            class="hidden"
            onChange={handleImport}
          />
        </div>
      </div>
    </section>
  )
}
