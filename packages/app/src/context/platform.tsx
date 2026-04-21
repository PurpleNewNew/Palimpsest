import { createSimpleContext } from "@opencode-ai/ui/context"
import type { AsyncStorage, SyncStorage } from "@solid-primitives/storage"
import type { Accessor } from "solid-js"

type PickerPaths = string | string[] | null
type OpenDirectoryPickerOptions = { title?: string; multiple?: boolean }
type OpenFilePickerOptions = { title?: string; multiple?: boolean }
type SaveFilePickerOptions = { title?: string; defaultPath?: string }
type UpdateInfo = { updateAvailable: boolean; version?: string }

export type Platform = {
  /** Runtime shell discriminator */
  platform: "web" | "desktop"

  /** Host OS when a native shell exposes it */
  os?: "macos" | "windows" | "linux"

  /** App version */
  version?: string

  /** Open a URL in the default browser */
  openLink(url: string): void

  /** Open a local path in a local app when supported */
  openPath?(path: string, app?: string): Promise<void>

  /** Restart the app  */
  restart(): Promise<void>

  /** Navigate back in history */
  back(): void

  /** Navigate forward in history */
  forward(): void

  /** Send a system notification (optional deep link) */
  notify(title: string, description?: string, href?: string): Promise<void>

  /** Open a directory picker dialog */
  openDirectoryPickerDialog?(opts?: OpenDirectoryPickerOptions): Promise<PickerPaths>

  /** Open a file picker dialog when supported */
  openFilePickerDialog?(opts?: OpenFilePickerOptions): Promise<PickerPaths>

  /** Open a save dialog when supported */
  saveFilePickerDialog?(opts?: SaveFilePickerOptions): Promise<string | null>

  /** Storage mechanism, defaults to localStorage */
  storage?: (name?: string) => SyncStorage | AsyncStorage

  /** Check for updates when the shell owns release distribution */
  checkUpdate?(): Promise<UpdateInfo>

  /** Install updates when the shell owns release distribution */
  update?(): Promise<void>

  /** Fetch override */
  fetch?: typeof fetch

  /** Get the configured default server URL (platform-specific) */
  getDefaultServerUrl?(): Promise<string | null>

  /** Set the default server URL to use on app startup (platform-specific) */
  setDefaultServerUrl?(url: string | null): Promise<void> | void

  /** Get shell-specific WSL integration settings */
  getWslEnabled?(): Promise<boolean>

  /** Set shell-specific WSL integration settings */
  setWslEnabled?(config: boolean): Promise<void> | void

  /** Get the preferred display backend */
  getDisplayBackend?(): Promise<DisplayBackend | null> | DisplayBackend | null

  /** Set the preferred display backend */
  setDisplayBackend?(backend: DisplayBackend): Promise<void>

  /** Parse markdown to HTML using a shell-specific parser */
  parseMarkdown?(markdown: string): Promise<string>

  /** Shell zoom level when available */
  webviewZoom?: Accessor<number>

  /** Check if an editor app exists when supported */
  checkAppExists?(appName: string): Promise<boolean>

  /** Read an image from the clipboard when supported */
  readClipboardImage?(): Promise<File | null>
}

export type DisplayBackend = "auto" | "wayland"

export const { use: usePlatform, provider: PlatformProvider } = createSimpleContext({
  name: "Platform",
  init: (props: { value: Platform }) => {
    return props.value
  },
})
