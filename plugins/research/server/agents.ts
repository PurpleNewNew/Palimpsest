import type { PluginAgentDefinition } from "@palimpsest/plugin-sdk/host"

import {
  PROMPT_RESEARCH,
  PROMPT_RESEARCH_IDEA,
  PROMPT_RESEARCH_PROJECT_INIT,
  PROMPT_RESEARCH_SOURCE_TREE_BUILD,
  PROMPT_RESEARCH_TREE_LINK,
  PROMPT_RESEARCH_IDEA_TREE_BUILD,
  PROMPT_EVIDENCE_ASSESSMENT,
  PROMPT_ATOM_FORMULA_CLEANUP,
  PROMPT_EXPERIMENT,
  PROMPT_EXPERIMENT_PLAN,
  PROMPT_EXPERIMENT_DEPLOY,
  PROMPT_EXPERIMENT_REMOTE_DOWNLOAD,
  PROMPT_EXPERIMENT_SETUP_ENV,
  PROMPT_EXPERIMENT_RUN,
  PROMPT_EXPERIMENT_COMMIT,
  PROMPT_EXPERIMENT_SUMMARY,
  PROMPT_EXPERIMENT_SUCCESS,
} from "./index"

/**
 * All research-owned agents (17 total: research-core + experiment-execution).
 *
 * Previously these lived directly inside
 * `apps/server/src/agent/agent.ts` state init, so every project —
 * including security-audit — saw `@research_project_init`,
 * `@experiment_run`, etc. in the agent picker. That violated the
 * plugin decoupling principle laid out in `specs/plugin.md`.
 *
 * After the refactor each agent carries `lensID: "research.workbench"`
 * so `Agent.list()` on a non-research project (security-audit, etc.)
 * filters them out automatically.
 *
 * `permission` is shipped as a plain ruleset record (not
 * `PermissionNext.Ruleset`). The host merges it on top of the
 * agent-default ruleset and the user-config ruleset at Agent.state
 * init time, so plugin code doesn't need to import
 * `PermissionNext`.
 */
const LENS_ID = "research.workbench"

export const ResearchAgents: PluginAgentDefinition[] = [
  // ─── research primary agents ─────────────────────────────────────
  {
    lensID: LENS_ID,
    info: {
      name: "research",
      description:
        "The primary research agent. Maintains research state as an evolving graph of claim-evidence atoms, relations, plans, and research documents.",
      options: {},
      permission: {
        question: "allow",
        plan_enter: "allow",
        bash: "ask",
        edit: {
          "*": "deny",
          "*.md": "allow",
          "**/*.md": "allow",
        },
      },
      prompt: PROMPT_RESEARCH,
      mode: "primary",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "research_idea",
      description: "Research idea agent. Turns a user idea into a validation-oriented atom tree through a workflow.",
      options: {},
      hidden: true,
      permission: {
        question: "allow",
        plan_enter: "allow",
      },
      prompt: PROMPT_RESEARCH_IDEA,
      mode: "primary",
    },
  },

  // ─── research subagents ─────────────────────────────────────────
  {
    lensID: LENS_ID,
    info: {
      name: "research_project_init",
      description:
        "Initialize a research project by auto-generating background/goal documents and building an atom network from sources.",
      prompt: PROMPT_RESEARCH_PROJECT_INIT,
      permission: {
        "*": "deny",
        research_info: "allow",
        source_query: "allow",
        source_status_update: "allow",
        research_background_edit: "allow",
        research_goal_edit: "allow",
        research_macro_edit: "allow",
        atom_create: "allow",
        atom_query: "allow",
        atom_batch_create: "allow",
        atom_delete: "allow",
        atom_relation_query: "allow",
        atom_relation_create: "allow",
        atom_relation_delete: "allow",
        question: "allow",
        task: {
          research_source_tree_build: "allow",
          research_tree_link: "allow",
          atom_formula_cleanup: "allow",
        },
        read: "allow",
        convert: "allow",
        glob: "allow",
        grep: "allow",
        edit: "allow",
        write: "allow",
        apply_patch: "allow",
        research_doc_edit: "ask",
      },
      options: {},
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "research_source_tree_build",
      description:
        "Build one source-local atom tree only: create atoms and intra-source relations for exactly one target source.",
      prompt: PROMPT_RESEARCH_SOURCE_TREE_BUILD,
      permission: {
        "*": "deny",
        research_info: "allow",
        source_query: "allow",
        source_status_update: "allow",
        research_macro_edit: "allow",
        atom_query: "allow",
        atom_batch_create: "allow",
        read: "allow",
        convert: "allow",
        glob: "allow",
        grep: "allow",
        research_doc_edit: "ask",
      },
      options: {},
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "research_tree_link",
      description:
        "Link already-built trees by creating only high-confidence cross-tree atom relations between the provided source and target groups.",
      prompt: PROMPT_RESEARCH_TREE_LINK,
      permission: {
        "*": "deny",
        source_query: "allow",
        atom_query: "allow",
        atom_relation_query: "allow",
        atom_relation_create: "allow",
        read: "allow",
      },
      options: {},
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "research_idea_tree_build",
      description:
        "Build one idea-local validation tree only: create atoms and intra-tree relations for exactly one target idea.",
      prompt: PROMPT_RESEARCH_IDEA_TREE_BUILD,
      permission: {
        "*": "deny",
        atom_query: "allow",
        atom_batch_create: "allow",
        read: "allow",
      },
      options: {},
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "evidence_assessment",
      description:
        "Assess whether an atom's evidence is sufficient to support its claim. Reads claim.md and evidence.md, writes assessment to evidence_assessment.md.",
      prompt: PROMPT_EVIDENCE_ASSESSMENT,
      permission: {
        "*": "deny",
        atom_query: "allow",
        atom_status_update: "allow",
        read: "allow",
        write: "allow",
        edit: "allow",
        apply_patch: "allow",
        question: "allow",
      },
      options: {},
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "atom_formula_cleanup",
      description:
        "Inspect one atom's claim.md and evidence.md, identify garbled or unresolved formulas, and repair only those atom-local markdown files.",
      prompt: PROMPT_ATOM_FORMULA_CLEANUP,
      permission: {
        "*": "deny",
        read: "allow",
        write: "allow",
        edit: "allow",
        apply_patch: "allow",
        question: "allow",
      },
      options: {},
      mode: "subagent",
    },
  },

  // ─── experiment primary agent ───────────────────────────────────
  {
    lensID: LENS_ID,
    info: {
      name: "experiment",
      description:
        "Experiment execution agent. Reads the experiment plan and implements code changes strictly within the experiment's code_path.",
      options: {},
      permission: {
        question: "allow",
        plan_enter: "allow",
        experiment_remote_task_start: "allow",
        experiment_remote_task_get: "allow",
      },
      prompt: PROMPT_EXPERIMENT,
      mode: "primary",
    },
  },

  // ─── experiment subagents ───────────────────────────────────────
  {
    lensID: LENS_ID,
    info: {
      name: "experiment_plan",
      description:
        "Experiment plan generation agent. Analyzes the atom's claim, evidence, related atoms, and codebase to design a detailed experiment plan.",
      options: {},
      permission: {
        question: "allow",
        experiment_remote_task_get: "allow",
      },
      prompt: PROMPT_EXPERIMENT_PLAN,
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "experiment_deploy",
      description: "Experiment deploy agent. Syncs code to a remote server.",
      options: {},
      permission: { experiment_remote_task_get: "allow" },
      prompt: PROMPT_EXPERIMENT_DEPLOY,
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "experiment_remote_download",
      description:
        "Experiment remote download agent. Downloads resources directly on the remote server and verifies the final remote paths.",
      options: {},
      permission: {
        "*": "deny",
        ssh: "allow",
        read: "allow",
        question: "allow",
        huggingface_search: "allow",
        modelscope_search: "allow",
        experiment_remote_task_start: "allow",
        experiment_remote_task_get: "allow",
      },
      prompt: PROMPT_EXPERIMENT_REMOTE_DOWNLOAD,
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "experiment_setup_env",
      description:
        "Experiment setup environment agent. Checks existing conda environments on the remote server, reuses or creates one as needed, and installs dependencies.",
      options: {},
      permission: { experiment_remote_task_get: "allow" },
      prompt: PROMPT_EXPERIMENT_SETUP_ENV,
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "experiment_run",
      description:
        "Experiment run agent. Launches the experiment on a remote server via remote task tooling and monitors its startup.",
      options: {},
      permission: {
        experiment_remote_task_start: "allow",
        experiment_remote_task_get: "allow",
      },
      prompt: PROMPT_EXPERIMENT_RUN,
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "experiment_commit",
      description:
        "Summarize code changes in the experiment's code_path and create a structured git commit with change details and stats.",
      prompt: PROMPT_EXPERIMENT_COMMIT,
      permission: {
        "*": "deny",
        bash: "allow",
        read: "allow",
        glob: "allow",
        grep: "allow",
      },
      options: {},
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "experiment_summary",
      description:
        "Summarize completed experiment results for an atom and write the evidence to evidence.md. Reads experiment watchers, W&B metrics, and synthesizes findings.",
      prompt: PROMPT_EXPERIMENT_SUMMARY,
      permission: {
        "*": "deny",
        atom_query: "allow",
        experiment_query: "allow",
        read: "allow",
        write: "allow",
        edit: "allow",
        apply_patch: "allow",
        glob: "allow",
      },
      options: {},
      mode: "subagent",
    },
  },
  {
    lensID: LENS_ID,
    info: {
      name: "experiment_success",
      description:
        "Summarize the actual runtime setup of a successful experiment run and write reusable success notes under .palimpsest/successful.",
      prompt: PROMPT_EXPERIMENT_SUCCESS,
      permission: {
        "*": "deny",
        atom_query: "allow",
        experiment_query: "allow",
        read: "allow",
        write: "allow",
        edit: "allow",
        apply_patch: "allow",
        glob: "allow",
      },
      options: {},
      mode: "subagent",
    },
  },
]
