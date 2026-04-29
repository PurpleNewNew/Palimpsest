import type { FileContent } from "@palimpsest/sdk/v2/client"

/**
 * Shared types for the chat subsystem.
 *
 * Moved from `apps/web/src/context/prompt.tsx` and
 * `apps/web/src/context/file/types.ts` in Phase 2.11.2 of the host
 * context promotion. Apps/web's prompt/file contexts re-export these
 * for backward compat with the rest of apps/web; chat code in
 * plugin-sdk imports them from here directly.
 */

// ─── Prompt parts ──────────────────────────────────────────────

interface PartBase {
  content: string
  start: number
  end: number
}

export interface TextPart extends PartBase {
  type: "text"
}

export interface FileAttachmentPart extends PartBase {
  type: "file"
  path: string
  selection?: FileSelection
}

export interface AgentPart extends PartBase {
  type: "agent"
  name: string
}

export interface ImageAttachmentPart {
  type: "image"
  id: string
  filename: string
  mime: string
  dataUrl: string
}

export type ContentPart = TextPart | FileAttachmentPart | AgentPart | ImageAttachmentPart
export type Prompt = ContentPart[]

export const DEFAULT_PROMPT: Prompt = [{ type: "text", content: "", start: 0, end: 0 }]

// ─── Context items (file references attached to a prompt) ─────

export type FileContextItem = {
  type: "file"
  path: string
  selection?: FileSelection
  comment?: string
  commentID?: string
  commentOrigin?: "review" | "file"
  preview?: string
}

export type ContextItem = FileContextItem

// ─── File-related types ───────────────────────────────────────

export type FileSelection = {
  startLine: number
  startChar: number
  endLine: number
  endChar: number
}

export type SelectedLineRange = {
  start: number
  end: number
  side?: "additions" | "deletions"
  endSide?: "additions" | "deletions"
}

export type FileViewState = {
  scrollTop?: number
  scrollLeft?: number
  selectedLines?: SelectedLineRange | null
}

export type FileState = {
  path: string
  name: string
  loaded?: boolean
  loading?: boolean
  error?: string
  content?: FileContent
}

export function selectionFromLines(range: SelectedLineRange): FileSelection {
  const startLine = Math.min(range.start, range.end)
  const endLine = Math.max(range.start, range.end)
  return {
    startLine,
    endLine,
    startChar: 0,
    endChar: 0,
  }
}

// ─── Utilities ────────────────────────────────────────────────

const uuidFallback = () => Math.random().toString(16).slice(2)

export function uuid() {
  const c = globalThis.crypto
  if (!c || typeof c.randomUUID !== "function") return uuidFallback()
  if (typeof globalThis.isSecureContext === "boolean" && !globalThis.isSecureContext) return uuidFallback()
  try {
    return c.randomUUID()
  } catch {
    return uuidFallback()
  }
}

/**
 * Encode a filesystem path into a URI-encoded form suitable for
 * `file://` URLs while preserving forward slashes as path separators.
 * Windows drive letters (`C:/...`) are normalised to `/C:/...` so
 * downstream parsers can reliably detect drives.
 *
 * Moved verbatim from `apps/web/src/context/file/path.ts` in Phase
 * 2.11.2.
 */
export function encodeFilePath(filepath: string): string {
  let normalized = filepath.replace(/\\/g, "/")

  if (/^[A-Za-z]:/.test(normalized)) {
    normalized = "/" + normalized
  }

  return normalized
    .split("/")
    .map((segment, index) => {
      if (index === 1 && /^[A-Za-z]:$/.test(segment)) return segment
      return encodeURIComponent(segment)
    })
    .join("/")
}

export function isPromptEqual(promptA: Prompt, promptB: Prompt): boolean {
  if (promptA === promptB) return true
  if (promptA.length !== promptB.length) return false
  for (let i = 0; i < promptA.length; i++) {
    const a = promptA[i]!
    const b = promptB[i]!
    if (a.type !== b.type) return false
    if (a.type === "image" && b.type === "image") {
      if (a.id !== b.id) return false
      if (a.filename !== b.filename) return false
      if (a.mime !== b.mime) return false
      if (a.dataUrl !== b.dataUrl) return false
      continue
    }
    if (a.type === "image" || b.type === "image") return false
    if (a.content !== b.content) return false
    if (a.start !== b.start) return false
    if (a.end !== b.end) return false
    if (a.type === "file" && b.type === "file") {
      if (a.path !== b.path) return false
      const selA = a.selection
      const selB = b.selection
      if (!selA && !selB) continue
      if (!selA || !selB) return false
      if (selA.startLine !== selB.startLine) return false
      if (selA.startChar !== selB.startChar) return false
      if (selA.endLine !== selB.endLine) return false
      if (selA.endChar !== selB.endChar) return false
      continue
    }
    if (a.type === "agent" && b.type === "agent") {
      if (a.name !== b.name) return false
    }
  }
  return true
}
