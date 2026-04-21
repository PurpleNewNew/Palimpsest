import { defineProductPlugin } from "@palimpsest/plugin-sdk/product"

import { manifest } from "./manifest"

export default defineProductPlugin({
  manifest,
  taxonomies: {
    "research.core": {
      nodeKinds: ["question", "hypothesis", "claim", "finding", "source"],
      edgeKinds: ["supports", "refutes", "relates_to", "raises"],
      runKinds: ["literature_review", "experiment", "analysis"],
      artifactKinds: ["note", "paper", "report", "dataset"],
      decisionKinds: ["advance_claim", "defer_claim", "reject_claim"],
      decisionStates: ["accepted", "rejected", "pending"],
    },
  },
  presets: [
    {
      id: "research.inquiry",
      pluginID: manifest.id,
      title: "Research Project",
      description: "Create a research workspace with inquiry-focused defaults and workbench tabs.",
      icon: "flask",
      defaultTaxonomyID: "research.core",
      defaultLensIDs: ["core.shell", "research.workbench"],
      fields: [
        {
          id: "question",
          label: "Research Question",
          type: "textarea",
          placeholder: "What are we trying to validate?",
        },
        {
          id: "background",
          label: "Background",
          type: "textarea",
          placeholder: "Known context, constraints, and why this matters.",
        },
      ],
      defaults: {
        question: "",
        background: "",
      },
      async create(input) {
        const { Filesystem } = await import("../../apps/server/src/util/filesystem")
        const lines = [
          "# Research Brief",
          "",
          "## Question",
          "",
          input.values.question?.trim() || "TBD",
          "",
          "## Background",
          "",
          input.values.background?.trim() || "TBD",
          "",
        ]
        await Filesystem.write(`${input.directory}/.palimpsest/research/brief.md`, lines.join("\n"))
      },
    },
  ],
  lenses: [
    {
      id: "research.workbench",
      pluginID: manifest.id,
      title: "Research Workbench",
      description: "Research-oriented tabs, actions, and prompts layered on top of the core shell.",
      priority: 60,
      appliesToPresets: ["research.inquiry"],
      appliesToTaxonomies: ["research.core"],
      requiresCapabilities: ["research"],
      workspaceTabs: [
        { id: "research", title: "Research", icon: "flask", priority: 65, kind: "lens" },
        { id: "literature", title: "Literature", icon: "book-open", priority: 55, kind: "lens" },
      ],
      sessionTabs: [{ id: "research-notes", title: "Research Notes", icon: "scroll", priority: 55, kind: "lens" }],
      actions: [
        {
          id: "ask",
          title: "Ask",
          description: "Ask a research question and tie the answer to sources and claims.",
          prompt: "Investigate the current research question, pull together evidence, and tie the answer back to nodes, sources, and decisions.",
          icon: "message-square",
          priority: 110,
        },
        {
          id: "propose",
          title: "Propose",
          description: "Propose a new claim, relation, or research direction.",
          prompt: "Propose the next research change for this project, including claims, evidence expectations, and why it matters.",
          icon: "lightbulb",
          priority: 100,
        },
        {
          id: "run",
          title: "Run",
          description: "Plan a research run or experiment and capture the resulting artifacts.",
          prompt: "Plan the next research run or experiment, then outline the artifacts, evidence, and decision points it should produce.",
          icon: "play",
          priority: 95,
        },
      ],
      configVersion: 1,
      pluginVersion: manifest.version,
    },
  ],
})
