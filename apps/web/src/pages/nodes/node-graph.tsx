import { createMemo, createSignal, For, onCleanup, onMount, Show, type JSX } from "solid-js"
import type { DomainEdge, DomainNode } from "@palimpsest/sdk/v2"

type Pos = { x: number; y: number; vx: number; vy: number }

const kindColors: Record<string, string> = {
  finding: "#ef4444",
  risk: "#f59e0b",
  surface: "#3b82f6",
  control: "#22c55e",
  assumption: "#a855f7",
  target: "#64748b",
  claim: "#06b6d4",
  source: "#14b8a6",
  hypothesis: "#f97316",
  question: "#eab308",
}

function colorFor(kind: string): string {
  return kindColors[kind] ?? "#94a3b8"
}

function circleLayout(nodes: DomainNode[], w: number, h: number): Record<string, Pos> {
  const N = nodes.length
  if (N === 0) return {}
  const cx = w / 2
  const cy = h / 2
  const radius = Math.min(w, h) * 0.38
  const pos: Record<string, Pos> = {}
  nodes.forEach((node, i) => {
    const theta = (i / N) * Math.PI * 2
    pos[node.id] = {
      x: cx + Math.cos(theta) * radius,
      y: cy + Math.sin(theta) * radius,
      vx: 0,
      vy: 0,
    }
  })
  return pos
}

function simulate(
  pos: Record<string, Pos>,
  nodes: DomainNode[],
  edges: DomainEdge[],
  w: number,
  h: number,
  steps = 200,
): Record<string, Pos> {
  const REPEL = 6000
  const SPRING = 0.02
  const DAMPING = 0.85
  const CENTER = 0.008
  const LINK_LENGTH = 120
  const cx = w / 2
  const cy = h / 2
  const ids = nodes.map((n) => n.id)

  for (let step = 0; step < steps; step++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos[ids[i]]
        const b = pos[ids[j]]
        if (!a || !b) continue
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d2 = dx * dx + dy * dy + 1
        const d = Math.sqrt(d2)
        const f = REPEL / d2
        a.vx += (dx / d) * f
        a.vy += (dy / d) * f
        b.vx -= (dx / d) * f
        b.vy -= (dy / d) * f
      }
    }
    for (const edge of edges) {
      const a = pos[edge.sourceID]
      const b = pos[edge.targetID]
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.sqrt(dx * dx + dy * dy) + 0.01
      const f = (d - LINK_LENGTH) * SPRING
      a.vx += (dx / d) * f
      a.vy += (dy / d) * f
      b.vx -= (dx / d) * f
      b.vy -= (dy / d) * f
    }
    for (const id of ids) {
      const p = pos[id]
      if (!p) continue
      p.vx += (cx - p.x) * CENTER
      p.vy += (cy - p.y) * CENTER
      p.vx *= DAMPING
      p.vy *= DAMPING
      p.x += p.vx
      p.y += p.vy
    }
  }
  return pos
}

function truncate(title: string, max: number): string {
  if (title.length <= max) return title
  return `${title.slice(0, max - 1)}…`
}

export function NodeGraph(props: {
  nodes: DomainNode[]
  edges: DomainEdge[]
  selectedID?: string
  onSelect?: (id: string) => void
}): JSX.Element {
  const [size, setSize] = createSignal({ w: 800, h: 600 })
  let container: HTMLDivElement | undefined

  let observer: ResizeObserver | undefined
  onMount(() => {
    if (!container) return
    const rect = container.getBoundingClientRect()
    setSize({ w: Math.max(rect.width, 400), h: Math.max(rect.height, 400) })
    observer = new ResizeObserver(() => {
      if (!container) return
      const r = container.getBoundingClientRect()
      setSize({ w: Math.max(r.width, 400), h: Math.max(r.height, 400) })
    })
    observer.observe(container)
  })

  onCleanup(() => {
    observer?.disconnect()
  })

  const positions = createMemo(() => {
    const { w, h } = size()
    const initial = circleLayout(props.nodes, w, h)
    return simulate(initial, props.nodes, props.edges, w, h)
  })

  const kinds = createMemo(() => {
    const set = new Set<string>()
    for (const node of props.nodes) set.add(node.kind)
    return Array.from(set).sort()
  })

  const [hovered, setHovered] = createSignal<string | undefined>()

  return (
    <div
      ref={(el) => (container = el)}
      class="relative h-full w-full overflow-hidden bg-background-base"
      data-component="node-graph"
    >
      <svg
        width={size().w}
        height={size().h}
        class="block"
        data-component="node-graph-svg"
      >
        <g data-component="node-graph-edges">
          <For each={props.edges}>
            {(edge) => {
              const src = positions()[edge.sourceID]
              const dst = positions()[edge.targetID]
              return (
                <Show when={src && dst}>
                  <line
                    x1={src.x}
                    y1={src.y}
                    x2={dst.x}
                    y2={dst.y}
                    stroke="currentColor"
                    class="text-border-weak-base"
                    stroke-width="1"
                    data-edge-id={edge.id}
                  >
                    <title>{edge.kind}</title>
                  </line>
                </Show>
              )
            }}
          </For>
        </g>
        <g data-component="node-graph-nodes">
          <For each={props.nodes}>
            {(node) => {
              const pos = createMemo(() => positions()[node.id])
              const isSelected = () => props.selectedID === node.id
              const isHovered = () => hovered() === node.id
              return (
                <Show when={pos()}>
                  <g
                    transform={`translate(${pos().x}, ${pos().y})`}
                    class="cursor-pointer"
                    data-component="node-graph-node"
                    data-node-id={node.id}
                    data-node-kind={node.kind}
                    onClick={() => props.onSelect?.(node.id)}
                    onMouseEnter={() => setHovered(node.id)}
                    onMouseLeave={() => setHovered(undefined)}
                  >
                    <circle
                      r={isSelected() ? 11 : 8}
                      fill={colorFor(node.kind)}
                      stroke={isSelected() || isHovered() ? "#0f172a" : "#1e293b"}
                      stroke-width={isSelected() ? 2 : 1}
                      opacity={isHovered() ? 1 : 0.9}
                    />
                    <text
                      y="22"
                      text-anchor="middle"
                      class="fill-text-strong"
                      style="font-size: 10px; pointer-events: none;"
                    >
                      {truncate(node.title, 18)}
                    </text>
                  </g>
                </Show>
              )
            }}
          </For>
        </g>
      </svg>

      <div
        class="absolute left-4 top-4 flex flex-col gap-1 rounded-xl bg-surface-raised-base px-3 py-2 text-11-regular text-text-weak"
        data-component="node-graph-legend"
      >
        <div class="text-10-medium uppercase tracking-wide">Legend</div>
        <For each={kinds()}>
          {(kind) => (
            <div class="flex items-center gap-2">
              <span
                class="inline-block size-2 rounded-full"
                style={`background-color: ${colorFor(kind)};`}
              />
              <span class="text-text-strong">{kind}</span>
            </div>
          )}
        </For>
        <Show when={kinds().length === 0}>
          <span>No nodes in the graph yet.</span>
        </Show>
      </div>

      <div
        class="absolute right-4 top-4 rounded-xl bg-surface-raised-base px-3 py-2 text-11-regular text-text-weak"
        data-component="node-graph-stats"
      >
        {props.nodes.length} nodes · {props.edges.length} edges
      </div>
    </div>
  )
}

export default NodeGraph
