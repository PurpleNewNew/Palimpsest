import { Config } from "../config/config"
import z from "zod"
import { Provider } from "../provider/provider"
import { generateObject, streamObject, type ModelMessage } from "ai"
import { SystemPrompt } from "../session/system"
import { Instance } from "../project/instance"
import { Truncate } from "../tool/truncation"
import { Auth } from "../auth"
import { ProviderTransform } from "../provider/transform"

import PROMPT_GENERATE from "./generate.txt"
import PROMPT_COMPACTION from "./prompt/compaction.txt"
import PROMPT_EXPLORE from "./prompt/explore.txt"
import PROMPT_SUMMARY from "./prompt/summary.txt"
import PROMPT_TITLE from "./prompt/title.txt"
import { PermissionNext } from "@/permission/next"
import { mergeDeep, pipe, sortBy, values } from "remeda"
import { Global } from "@/global"
import path from "path"
import { Plugin } from "@/plugin"
import { Skill } from "../skill"
import { AgentRegistry } from "./registry"
import { Database, eq } from "@/storage/db"
import { ProjectLensTable } from "@/plugin/product.sql"

export namespace Agent {
  export const Info = z
    .object({
      name: z.string(),
      description: z.string().optional(),
      mode: z.enum(["subagent", "primary", "all"]),
      native: z.boolean().optional(),
      hidden: z.boolean().optional(),
      topP: z.number().optional(),
      temperature: z.number().optional(),
      color: z.string().optional(),
      permission: PermissionNext.Ruleset,
      model: z
        .object({
          modelID: z.string(),
          providerID: z.string(),
        })
        .optional(),
      variant: z.string().optional(),
      prompt: z.string().optional(),
      options: z.record(z.string(), z.any()),
      steps: z.number().int().positive().optional(),
      /**
       * Plugin ownership metadata. Set when this agent was registered
       * via `host.agents.register(...)` from a plugin server hook.
       * Used by `list()` / `get()` to gate visibility on the current
       * project's active lens set.
       */
      pluginID: z.string().optional(),
      lensID: z.string().optional(),
    })
    .meta({
      ref: "Agent",
    })
  export type Info = z.infer<typeof Info>

  const state = Instance.state(async () => {
    const cfg = await Config.get()

    const skillDirs = await Skill.dirs()
    const whitelistedDirs = [Truncate.GLOB, ...skillDirs.map((dir) => path.join(dir, "*"))]
    const defaults = PermissionNext.fromConfig({
      "*": "allow",
      doom_loop: "ask",
      external_directory: {
        "*": "ask",
        ...Object.fromEntries(whitelistedDirs.map((dir) => [dir, "allow"])),
      },
      research_doc_edit: "ask",
      question: "deny",
      plan_enter: "deny",
      plan_exit: "deny",
      // mirrors github.com/github/gitignore Node.gitignore pattern for .env files
      read: {
        "*": "allow",
        "*.env": "ask",
        "*.env.*": "ask",
        "*.env.example": "allow",
      },
    })
    const user = PermissionNext.fromConfig(cfg.permission ?? {})

    // Host-default agents. Two classes live here side-by-side; the
    // `hidden` flag is the structural discriminator:
    //
    //   1. Engine-internal agents (`hidden: true`) — compaction,
    //      title, summary. These are runtime dependencies of the
    //      session engine itself (Session.compact calls
    //      `Agent.get("compaction")` directly). They are NEVER
    //      surfaced in the UI and MUST remain in the host — moving
    //      them to a plugin server hook would introduce a lifecycle
    //      race between "session first init" and "plugin server hook
    //      finished registering".
    //
    //   2. Cross-lens user-facing defaults (`hidden: false`) — build,
    //      plan, general, explore. Visible in every project, regardless
    //      of active lens. These are not "core" in the sense of the
    //      old `plugins/core/` package (dissolved in Phase 2.14, see
    //      `apps/server/src/plugin/core-defaults.ts` header comment);
    //      they are the host's default toolbox. Migrating them through
    //      `host.agents.register(..., { lensID: undefined })` would
    //      be functionally identical but would add a layer of
    //      indirection without changing any behaviour.
    //
    // Lens-specific agents (research / experiment / security-audit /
    // ...) register themselves through their plugin's `server(host)`
    // hook via `host.agents.register(...)` — see
    // `plugins/research/server/agents.ts` and
    // `plugins/security-audit/server/agents.ts` for the canonical
    // examples.
    const result: Record<string, Info> = {
      build: {
        name: "build",
        description: "General-purpose coding agent. Executes tools based on configured permissions.",
        options: {},
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            question: "allow",
            plan_enter: "allow",
          }),
          user,
        ),
        mode: "primary",
        native: true,
      },
      plan: {
        name: "plan",
        description: "Plan mode. Disallows all edit tools.",
        options: {},
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            question: "allow",
            plan_exit: "allow",
            external_directory: {
              [path.join(Global.Path.data, "plans", "*")]: "allow",
            },
            edit: {
              "*": "deny",
              [path.join(".palimpsest", "plans", "*.md")]: "allow",
              [path.relative(Instance.worktree, path.join(Global.Path.data, path.join("plans", "*.md")))]: "allow",
            },
          }),
          user,
        ),
        mode: "primary",
        native: true,
      },
      general: {
        name: "general",
        description: `General-purpose agent for researching complex questions and executing multi-step tasks. Use this agent to execute multiple units of work in parallel.`,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            todoread: "deny",
            todowrite: "deny",
          }),
          user,
        ),
        options: {},
        mode: "subagent",
        native: true,
      },
      explore: {
        name: "explore",
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
            grep: "allow",
            glob: "allow",
            list: "allow",
            bash: "allow",
            webfetch: "allow",
            websearch: "allow",
            codesearch: "allow",
            read: "allow",
            external_directory: {
              "*": "ask",
              ...Object.fromEntries(whitelistedDirs.map((dir) => [dir, "allow"])),
            },
          }),
          user,
        ),
        description: `Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns (eg. "src/components/**/*.tsx"), search code for keywords (eg. "API endpoints"), or answer questions about the codebase (eg. "how do API endpoints work?"). When calling this agent, specify the desired thoroughness level: "quick" for basic searches, "medium" for moderate exploration, or "very thorough" for comprehensive analysis across multiple locations and naming conventions.`,
        prompt: PROMPT_EXPLORE,
        options: {},
        mode: "subagent",
        native: true,
      },
      compaction: {
        name: "compaction",
        mode: "primary",
        native: true,
        hidden: true,
        prompt: PROMPT_COMPACTION,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
          }),
          user,
        ),
        options: {},
      },
      title: {
        name: "title",
        mode: "primary",
        options: {},
        native: true,
        hidden: true,
        temperature: 0.5,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
          }),
          user,
        ),
        prompt: PROMPT_TITLE,
      },
      summary: {
        name: "summary",
        mode: "primary",
        options: {},
        native: true,
        hidden: true,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
          }),
          user,
        ),
        prompt: PROMPT_SUMMARY,
      },
    }

    // Plugin-contributed agents: merged AFTER host defaults but BEFORE
    // user config, so user config still has final say via
    // `cfg.agent[<name>]`. Plugin agents carry `pluginID` / `lensID`
    // metadata that `list()` / `get()` use to gate visibility on the
    // current project's active lens set.
    for (const entry of AgentRegistry.all()) {
      const info = entry.info
      const merged: Info = {
        name: info.name,
        description: info.description,
        mode: info.mode,
        native: true,
        hidden: info.hidden,
        topP: info.topP,
        temperature: info.temperature,
        color: info.color,
        variant: info.variant,
        prompt: info.prompt,
        options: info.options ?? {},
        steps: info.steps,
        pluginID: entry.pluginID,
        lensID: entry.lensID,
        permission: PermissionNext.merge(
          defaults,
          // Plugin permission is SDK-declared as a loose Record<string,
          // unknown>. Parse it through Config.Permission so the host
          // validates shape at registration time instead of crashing
          // deep inside PermissionNext.fromConfig.
          PermissionNext.fromConfig(Config.Permission.parse(info.permission ?? {})),
          user,
        ),
        model: info.model
          ? typeof info.model === "string"
            ? Provider.parseModel(info.model)
            : info.model
          : undefined,
      }
      result[info.name] = merged
    }

    for (const [key, value] of Object.entries(cfg.agent ?? {})) {
      if (value.disable) {
        delete result[key]
        continue
      }
      let item = result[key]
      if (!item)
        item = result[key] = {
          name: key,
          mode: "all",
          permission: PermissionNext.merge(defaults, user),
          options: {},
          native: false,
        }
      if (value.model) item.model = Provider.parseModel(value.model)
      item.variant = value.variant ?? item.variant
      item.prompt = value.prompt ?? item.prompt
      item.description = value.description ?? item.description
      item.temperature = value.temperature ?? item.temperature
      item.topP = value.top_p ?? item.topP
      item.mode = value.mode ?? item.mode
      item.color = value.color ?? item.color
      item.hidden = value.hidden ?? item.hidden
      item.name = value.name ?? item.name
      item.steps = value.steps ?? item.steps
      item.options = mergeDeep(item.options, value.options ?? {})
      item.permission = PermissionNext.merge(item.permission, PermissionNext.fromConfig(value.permission ?? {}))
    }

    // Ensure Truncate.GLOB is allowed unless explicitly configured
    for (const name in result) {
      const agent = result[name]
      const explicit = agent.permission.some((r) => {
        if (r.permission !== "external_directory") return false
        if (r.action !== "deny") return false
        return r.pattern === Truncate.GLOB
      })
      if (explicit) continue

      result[name].permission = PermissionNext.merge(
        result[name].permission,
        PermissionNext.fromConfig({ external_directory: { [Truncate.GLOB]: "allow" } }),
      )
    }

    return result
  })

  /**
   * Lens-based visibility filter used by `list()`. Plugin-contributed
   * agents (those with a `lensID`) are only surfaced in the `@` mention
   * / agent picker list when their lens is installed for the current
   * project. Host-default agents (no `lensID`) are always surfaced.
   *
   * `get()` intentionally does NOT apply this filter: once an agent is
   * registered at the Instance, `Agent.get(name)` is a dictionary
   * lookup used by the internal chat pipeline (session.prompt,
   * task tool, CLI `/agent`). Gating `get()` would require every
   * caller to carry lens awareness and conflicts with the simple
   * dictionary-access intent of these internal lookups.
   */
  async function activeLensIDs(): Promise<Set<string>> {
    const rows = await Database.use((db) =>
      db
        .select({ lens_id: ProjectLensTable.lens_id })
        .from(ProjectLensTable)
        .where(eq(ProjectLensTable.project_id, Instance.project.id))
        .all(),
    )
    return new Set(rows.map((row) => row.lens_id))
  }

  export async function get(agent: string) {
    return state().then((x) => x[agent])
  }

  export async function list() {
    const cfg = await Config.get()
    const all = await state()
    const active = await activeLensIDs()
    const filtered = Object.values(all).filter((info) => !info.lensID || active.has(info.lensID))
    // Sort so that `cfg.default_agent` (when set) is first. Otherwise
    // preserve insertion order (host-default agents first, then plugin
    // agents in registration order). Previously this special-cased
    // "research" as the default, which is a host/research coupling
    // we explicitly removed during the plugin decoupling refactor.
    return pipe(
      filtered,
      sortBy([(x) => (cfg.default_agent ? x.name === cfg.default_agent : false), "desc"]),
    )
  }

  export async function defaultAgent() {
    const cfg = await Config.get()
    const agents = await state()
    const active = await activeLensIDs()

    if (cfg.default_agent) {
      const agent = agents[cfg.default_agent]
      if (!agent) throw new Error(`default agent "${cfg.default_agent}" not found`)
      if (agent.mode === "subagent") throw new Error(`default agent "${cfg.default_agent}" is a subagent`)
      if (agent.hidden === true) throw new Error(`default agent "${cfg.default_agent}" is hidden`)
      return agent.name
    }

    // Fallback: pick the first primary, non-hidden agent that is
    // visible for this project (lens-gated same as `list()`).
    // Host-default primaries (build, plan) come first in insertion
    // order and have no lens constraint, so any project (including
    // projects with no active lens, or with a non-research lens like
    // security-audit) will fall back to build → plan rather than to
    // a plugin primary from an inactive lens.
    const primaryVisible = Object.values(agents).find((a) => {
      if (a.mode === "subagent") return false
      if (a.hidden === true) return false
      if (a.lensID && !active.has(a.lensID)) return false
      return true
    })
    if (!primaryVisible) throw new Error("no primary visible agent found")
    return primaryVisible.name
  }

  export async function generate(input: { description: string; model?: { providerID: string; modelID: string } }) {
    const cfg = await Config.get()
    const defaultModel = input.model ?? (await Provider.defaultModel())
    const model = await Provider.getModel(defaultModel.providerID, defaultModel.modelID)
    const language = await Provider.getLanguage(model)

    const system = [PROMPT_GENERATE]
    await Plugin.trigger("experimental.chat.system.transform", { model }, { system })
    const existing = await list()

    const params = {
      experimental_telemetry: {
        isEnabled: cfg.experimental?.openTelemetry,
        metadata: {
          userId: cfg.username ?? "unknown",
        },
      },
      temperature: 0.3,
      messages: [
        ...system.map(
          (item): ModelMessage => ({
            role: "system",
            content: item,
          }),
        ),
        {
          role: "user",
          content: `Create an agent configuration based on this request: \"${input.description}\".\n\nIMPORTANT: The following identifiers already exist and must NOT be used: ${existing.map((i) => i.name).join(", ")}\n  Return ONLY the JSON object, no other text, do not wrap in backticks`,
        },
      ],
      model: language,
      schema: z.object({
        identifier: z.string(),
        whenToUse: z.string(),
        systemPrompt: z.string(),
      }),
    } satisfies Parameters<typeof generateObject>[0]

    if (defaultModel.providerID === "openai" && (await Auth.get(defaultModel.providerID))?.type === "oauth") {
      const result = streamObject({
        ...params,
        providerOptions: ProviderTransform.providerOptions(model, {
          instructions: SystemPrompt.instructions(),
          store: false,
        }),
        onError: () => {},
      })
      for await (const part of result.fullStream) {
        if (part.type === "error") throw part.error
      }
      return result.object
    }

    const result = await generateObject(params)
    return result.object
  }
}
