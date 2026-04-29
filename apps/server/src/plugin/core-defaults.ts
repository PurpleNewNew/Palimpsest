import type { ProductPlugin } from "@palimpsest/plugin-sdk/product"

/**
 * Core defaults shipped by the host.
 *
 * Originally lived as a separate plugin package
 * (`@palimpsest/plugin-core`, `plugins/core/`) but every project
 * unconditionally depends on `core.shell` and the package never had
 * any plugin-specific server routes or web components — it was 117
 * lines of declarative manifest plus an empty server hook that
 * existed only "for symmetry". Per the architecture decision
 * recorded in `specs/plugin.md`, the manifest moved into the host
 * so the registry has a single source of truth for the canonical
 * shell.
 *
 * Third-party plugins can still ship their own shell lens — they
 * just don't reference `core.shell` in their preset `defaultLensIDs`.
 */
export const CoreDefaults: ProductPlugin = {
  manifest: {
    id: "core",
    version: "0.1.0",
    title: "Core",
    description: "The core Palimpsest shell, base preset, and durable domain-first workspace surfaces.",
    capabilities: ["core-domain", "reviews", "sources"],
  },
  taxonomies: {
    "core.default": {
      nodeKinds: ["question", "claim", "finding", "source"],
      edgeKinds: ["supports", "refutes", "depends_on", "derived_from"],
      runKinds: ["analysis", "review", "import"],
      artifactKinds: ["note", "report", "dataset", "snapshot"],
      decisionKinds: ["accept", "reject", "defer"],
      decisionStates: ["accepted", "rejected", "pending"],
    },
  },
  presets: [
    {
      id: "core.blank",
      pluginID: "core",
      title: "General Project",
      description: "Start from the core domain model with neutral defaults.",
      icon: "sparkles",
      defaultTaxonomyID: "core.default",
      defaultLensIDs: ["core.shell"],
      fields: [
        {
          id: "brief",
          label: "Project Brief",
          type: "textarea",
          placeholder: "What are we trying to figure out?",
          description: "A short setup note stored in .palimpsest/core/brief.md.",
        },
      ],
      defaults: {
        brief: "",
      },
      async create(input) {
        const brief = input.values.brief?.trim()
        if (!brief) return
        await input.host.writeText(".palimpsest/core/brief.md", `# Project Brief\n\n${brief}\n`)
      },
    },
  ],
  lenses: [
    {
      id: "core.shell",
      pluginID: "core",
      title: "Core Shell",
      description: "Stable core tabs and actions for every Palimpsest project.",
      priority: 100,
      appliesToPresets: ["core.blank", "research.inquiry", "security-audit.audit"],
      appliesToTaxonomies: ["core.default", "research.core", "security-audit.core"],
      requiresCapabilities: [],
      workspaceTabs: [
        { id: "nodes", title: "Nodes", icon: "file-code", priority: 100, kind: "core" },
        { id: "runs", title: "Runs", icon: "play", priority: 90, kind: "core" },
        { id: "artifacts", title: "Artifacts", icon: "box", priority: 80, kind: "core" },
        { id: "decisions", title: "Decisions", icon: "check-circle", priority: 70, kind: "core" },
        { id: "reviews", title: "Reviews", icon: "message-circle", priority: 60, kind: "core" },
        { id: "monitors", title: "Monitors", icon: "activity", priority: 50, kind: "core" },
        { id: "sources", title: "Sources", icon: "book-open", priority: 40, kind: "core" },
      ],
      sessionTabs: [
        { id: "conversation", title: "Conversation", icon: "message-square", priority: 100, kind: "core" },
        { id: "context", title: "Context", icon: "library", priority: 90, kind: "core" },
        { id: "review", title: "Review", icon: "git-pull-request", priority: 80, kind: "core" },
      ],
      actions: [
        {
          id: "ask",
          title: "Ask",
          description: "Open an exploratory session grounded in the current project.",
          prompt: "Ask a focused question about this project and capture the answer as durable project memory.",
          icon: "message-square",
          priority: 100,
        },
        {
          id: "propose",
          title: "Propose",
          description: "Draft a change proposal instead of mutating accepted state directly.",
          prompt: "Draft a proposal for the next project change, including rationale and affected assets.",
          icon: "lightbulb",
          priority: 90,
        },
        {
          id: "review",
          title: "Review",
          description: "Review pending proposals, related evidence, and recent commits.",
          prompt:
            "Review pending proposals and recent commits for this project. Call out risks, missing evidence, and approval recommendations.",
          icon: "git-pull-request",
          priority: 80,
        },
        {
          id: "run",
          title: "Run",
          description: "Plan and execute a concrete run or operational step.",
          prompt: "Plan and execute the next concrete run for this project, then record the resulting artifacts and decisions.",
          icon: "play",
          priority: 70,
        },
        {
          id: "inspect",
          title: "Inspect",
          description: "Inspect reasoning provenance, artifacts, and accepted state.",
          prompt:
            "Inspect this project's current state, provenance, and asset graph. Summarize what is solid, what is missing, and what needs attention.",
          icon: "search",
          priority: 60,
        },
      ],
      configVersion: 1,
      pluginVersion: "0.1.0",
    },
  ],
}
