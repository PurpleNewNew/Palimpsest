import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { JSX } from "solid-js"
import { Portal } from "solid-js/web"

/**
 * Prop surface for the `<ObjectWorkspaceFullscreen>` primitive exported
 * from `@palimpsest/plugin-sdk/web/object-workspace-fullscreen`.
 *
 * Type shapes mirror `specs/graph-workbench-pattern.md` (Object
 * Workspace Fullscreen section, Props subsection). Any deviation is a
 * spec bug.
 *
 * The primitive owns:
 * - clip-path inset animation (open from `originRect`, close back to it)
 * - `Escape` to close
 * - `document.body.overflow` lock during visibility
 * - 3-pane layout (graph center + side panel + optional overlays)
 * - left-overlay width measurement (via `ResizeObserver`), surfaced to
 *   `fileOverlay` so it can position itself beside the left overlay
 * - `Portal` mount to `document.body`
 *
 * The lens owns:
 * - what to render in `center` (typically a `<NodeGraphWorkbench>`)
 * - what to render in `right` / `rightAlt` (the lens-owned object panel)
 * - what to render in `leftOverlay` (typically a session chat panel)
 * - what to render in `fileOverlay` (typically a file inspector); the
 *   lens is responsible for positioning the file overlay using the
 *   `leftOverlayWidth` signal supplied via the render-prop form
 */
export type ObjectWorkspaceFullscreenProps = {
  /** Whether the fullscreen workspace is currently shown. */
  visible: boolean
  /**
   * Anchor rect used to compute the clip-path inset on open/close.
   * Typically the bounding rect of the trigger button that opened the
   * workspace. When omitted, the primitive collapses toward the
   * viewport centre (fade-from-centre fallback) — useful for lenses
   * whose trigger surface (e.g. a g6 graph node) does not expose a
   * DOM rect to the host.
   */
  originRect?: { x: number; y: number; width: number; height: number }
  /** Called when the user requests to close (close button or Escape). */
  onClose: () => void

  /** Optional top-bar title text. */
  title?: string
  /** Optional top-bar icon (rendered to the left of `title`). */
  icon?: JSX.Element

  // ─── Slots ─────────────────────────────────────────────────

  /**
   * Center pane. Almost always a `<NodeGraphWorkbench>` instance.
   * Required so the workspace always has a primary surface.
   */
  center: JSX.Element

  /** Right pane. Lens-owned object panel (e.g. atom or finding detail). */
  right?: JSX.Element
  /**
   * Alternative right pane. Used when the user has drilled into a
   * sub-object (e.g. an experiment from an atom). Takes precedence
   * over `right` when present.
   */
  rightAlt?: JSX.Element

  /**
   * Left overlay (z-20). Lens-owned session chat or similar. Primitive
   * wraps it in an absolutely-positioned container along the left
   * edge and measures its width.
   */
  leftOverlay?: JSX.Element

  /**
   * File inspector overlay (z-10). Two forms accepted:
   *
   * - `JSX.Element` — rendered as-is. The lens is responsible for
   *   positioning (typically `position: absolute; left: 0; ...`).
   * - `(ctx) => JSX.Element` — render prop form. Receives the
   *   `leftOverlayWidth` signal so the lens can offset the file
   *   overlay's `left` to sit beside the left overlay rather than
   *   under it. The signal returns `0` when no left overlay is
   *   currently rendered.
   */
  fileOverlay?:
    | JSX.Element
    | ((ctx: { leftOverlayWidth: () => number }) => JSX.Element)
}

function computeInset(rect?: { x: number; y: number; width: number; height: number }) {
  if (!rect) return "inset(50% 50% 50% 50%)"
  const top = (rect.y / window.innerHeight) * 100
  const right = (1 - (rect.x + rect.width) / window.innerWidth) * 100
  const bottom = (1 - (rect.y + rect.height) / window.innerHeight) * 100
  const left = (rect.x / window.innerWidth) * 100
  return `inset(${top}% ${right}% ${bottom}% ${left}%)`
}

/**
 * Object Workspace Fullscreen primitive. Renders a clip-path-animated
 * fullscreen overlay with a graph workbench center, an optional right
 * panel, and optional left/file overlays.
 *
 * See `specs/graph-workbench-pattern.md` (Object Workspace Fullscreen
 * section) for the full contract.
 */
export function ObjectWorkspaceFullscreen(props: ObjectWorkspaceFullscreenProps) {
  // After a close transition completes, hide the overlay so it stops
  // capturing tab order / hit-testing. Initial state mirrors visible.
  const [hidden, setHidden] = createSignal(!props.visible)

  // Width of the left overlay (chat panel etc.). Surfaced to fileOverlay
  // via the render-prop form. Defaults to 0 when no left overlay is
  // mounted.
  const [leftOverlayWidth, setLeftOverlayWidth] = createSignal(0)

  // Toggle body scroll lock + un-hide on visible=true.
  const onVisibleChange = (visible: boolean) => {
    if (visible) {
      setHidden(false)
      document.body.style.overflow = "hidden"
    }
  }
  onMount(() => onVisibleChange(props.visible))

  const handleTransitionEnd = (e: TransitionEvent) => {
    if (e.propertyName === "clip-path" && !props.visible) {
      setHidden(true)
      document.body.style.overflow = ""
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && props.visible) {
      e.preventDefault()
      e.stopPropagation()
      props.onClose()
    }
  }

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown, true)
  })
  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown, true)
    document.body.style.overflow = ""
  })

  // Re-trigger body lock when visibility flips true after first mount.
  // `createEffect(on(...))` would be tidier, but onMount + a simple
  // memo-on-style is sufficient and avoids importing `on`/`createEffect`
  // for one toggle. Most consumers mount this conditionally so the
  // initial state already wins.
  const collapsedInset = createMemo(() => computeInset(props.originRect))

  // The right pane is `rightAlt` if present (drilled-in sub-object),
  // otherwise `right`. The primitive does not own the show/hide
  // decision — the lens passes whichever is currently relevant.
  const rightSlot = createMemo<JSX.Element | undefined>(() => props.rightAlt ?? props.right)

  return (
    <Portal mount={document.body}>
      <div
        onTransitionEnd={handleTransitionEnd}
        class="fixed inset-0 z-50 flex flex-col bg-background-base"
        style={{
          "clip-path": props.visible ? "inset(0)" : collapsedInset(),
          transition: "clip-path 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          visibility: hidden() ? "hidden" : "visible",
          "pointer-events": props.visible ? "auto" : "none",
        }}
        // Ensure visibility lock re-runs when visible flips true post-mount.
        ref={(el) => {
          // Re-apply on every render in case props.visible toggled.
          // This is cheap and avoids needing createEffect here.
          if (props.visible && el.style.visibility === "hidden") {
            onVisibleChange(true)
          }
        }}
      >
        {/* Top bar: optional icon + title on the left; close button on the right. */}
        <div class="flex items-center justify-between h-11 pl-4 pr-3 border-b border-border-base shrink-0">
          <div class="flex items-center gap-2.5">
            <Show when={props.icon}>{props.icon}</Show>
            <Show when={props.title}>
              {(title) => <span class="text-sm font-semibold text-text-base">{title()}</span>}
            </Show>
          </div>
          <button
            onClick={props.onClose}
            class="flex items-center justify-center w-[30px] h-[30px] border border-border-base rounded-md bg-transparent text-text-weak cursor-pointer text-base hover:bg-background-stronger hover:text-text-base transition-colors"
            title="Close (Esc)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Detail area: 3-pane (overlays + center + right). */}
        <div style={{ flex: "1", "min-height": "0", display: "flex", position: "relative" }}>
          {/* Left overlay (z-20): primitive owns the wrapper + width measurement. */}
          <Show when={props.leftOverlay}>
            <div
              ref={(el) => {
                const ro = new ResizeObserver(() => setLeftOverlayWidth(el.offsetWidth))
                ro.observe(el)
                setLeftOverlayWidth(el.offsetWidth)
                onCleanup(() => {
                  ro.disconnect()
                  setLeftOverlayWidth(0)
                })
              }}
              style={{
                position: "absolute",
                left: "0",
                top: "0",
                bottom: "0",
                "z-index": "20",
              }}
            >
              {props.leftOverlay}
            </div>
          </Show>

          {/* File overlay (z-10): lens self-positions; receives leftOverlayWidth. */}
          <Show when={props.fileOverlay}>
            {(fo) => {
              const slot = fo()
              if (typeof slot === "function") {
                return (slot as (ctx: { leftOverlayWidth: () => number }) => JSX.Element)({
                  leftOverlayWidth,
                })
              }
              return slot
            }}
          </Show>

          {/* Center: graph workbench (flex-1, never squeezed). */}
          <div style={{ flex: "1", "min-width": "0", position: "relative" }}>{props.center}</div>

          {/* Right or rightAlt: lens-owned detail panel, no flex-grow. */}
          <Show when={rightSlot()}>{(slot) => slot()}</Show>
        </div>
      </div>
    </Portal>
  )
}
