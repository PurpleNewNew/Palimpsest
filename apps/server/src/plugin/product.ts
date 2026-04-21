import { readdir } from "fs/promises"
import path from "path"
import { pathToFileURL } from "url"
import {
  ActionID,
  type ActionInfo,
  type LensInfo,
  type LensRuntime,
  type PluginInfo,
  type PresetInfo,
  type PresetRuntime,
  ProjectMeta,
  ProjectShell,
  type ProductPlugin,
  RegistryInfo,
  type SessionTab,
  type WorkspaceTab,
} from "@palimpsest/plugin-sdk/product"
import z from "zod"

import CorePlugin from "@palimpsest/plugin-core"
import ResearchPlugin from "@palimpsest/plugin-research"
import SecurityAuditPlugin from "@palimpsest/plugin-security-audit"
import { Domain } from "@/domain/domain"
import { ProjectTable } from "@/project/project.sql"
import { Database, asc, eq } from "@/storage/db"
import { Filesystem } from "@/util/filesystem"

import { ProjectLensTable } from "./product.sql"

const BUILTIN = [CorePlugin, ResearchPlugin, SecurityAuditPlugin] satisfies ProductPlugin[]
const ORDER = ActionID.options

const ProjectRow = z.object({
  id: z.string(),
  worktree: z.string(),
  preset_plugin_id: z.string().nullable(),
  preset_id: z.string().nullable(),
  taxonomy_id: z.string().nullable(),
})

type ProjectRow = z.infer<typeof ProjectRow>
type LensRow = typeof ProjectLensTable.$inferSelect

function metaPath(worktree: string) {
  return path.join(worktree, ".palimpsest", "project.json")
}

function wirePlugin(input: ProductPlugin): PluginInfo {
  return input.manifest
}

function wirePreset(input: ProductPlugin, preset: PresetRuntime): PresetInfo {
  return {
    id: preset.id,
    pluginID: input.manifest.id,
    title: preset.title,
    description: preset.description,
    icon: preset.icon,
    defaultTaxonomyID: preset.defaultTaxonomyID,
    defaultLensIDs: preset.defaultLensIDs,
    fields: preset.fields,
    defaults: preset.defaults,
  }
}

function wireLens(input: ProductPlugin, lens: LensRuntime): LensInfo {
  return {
    id: lens.id,
    pluginID: input.manifest.id,
    title: lens.title,
    description: lens.description,
    priority: lens.priority,
    appliesToPresets: lens.appliesToPresets,
    appliesToTaxonomies: lens.appliesToTaxonomies,
    requiresCapabilities: lens.requiresCapabilities,
    workspaceTabs: lens.workspaceTabs,
    sessionTabs: lens.sessionTabs,
    actions: lens.actions,
    pluginVersion: input.manifest.version,
    configVersion: lens.configVersion,
  }
}

async function local(directory: string | undefined) {
  if (!directory) return [] as ProductPlugin[]
  const dir = path.join(directory, ".palimpsest", "plugins")
  if (!(await Filesystem.isDir(dir))) return [] as ProductPlugin[]
  const items = await readdir(dir, { withFileTypes: true })
  const out: ProductPlugin[] = []
  for (const item of items) {
    if (!item.isDirectory()) continue
    const base = path.join(dir, item.name)
    let file: string | undefined
    for (const name of ["plugin.ts", "plugin.js", "index.ts", "index.js"]) {
      const candidate = path.join(base, name)
      if (await Filesystem.stat(candidate)) {
        file = candidate
        break
      }
    }
    if (!file) continue
    const mod = await import(pathToFileURL(file).href)
    const plugin = [mod.default, mod.plugin].find(Boolean) as ProductPlugin | undefined
    if (!plugin) continue
    out.push(plugin)
  }
  return out
}

async function list(directory?: string) {
  return [...BUILTIN, ...(await local(directory))]
}

function presetAllowed(lens: LensInfo, input: { presetID: string; taxonomyID: string; capabilities: string[] }) {
  if (lens.appliesToPresets.length > 0 && !lens.appliesToPresets.includes(input.presetID)) return false
  if (lens.appliesToTaxonomies.length > 0 && !lens.appliesToTaxonomies.includes(input.taxonomyID)) return false
  if (lens.requiresCapabilities.some((item) => !input.capabilities.includes(item))) return false
  return true
}

function sortLenses(
  entries: Array<{
    installedAt: number
    lens: LensInfo
  }>,
) {
  return entries.toSorted((a, b) => {
    if (a.lens.priority !== b.lens.priority) return b.lens.priority - a.lens.priority
    if (a.installedAt !== b.installedAt) return a.installedAt - b.installedAt
    return `${a.lens.pluginID}:${a.lens.id}`.localeCompare(`${b.lens.pluginID}:${b.lens.id}`)
  })
}

function mergeTabs<T extends WorkspaceTab | SessionTab>(input: T[]) {
  const map = new Map<string, T>()
  for (const item of input.toSorted((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority
    return a.id.localeCompare(b.id)
  })) {
    if (!map.has(item.id)) map.set(item.id, item)
  }
  return [...map.values()]
}

function mergeActions(input: ActionInfo[]) {
  const best = new Map<string, ActionInfo>()
  const sorted = input.toSorted((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority
    return `${a.pluginID}:${a.lensID}:${a.id}`.localeCompare(`${b.pluginID}:${b.lensID}:${b.id}`)
  })
  for (const item of sorted) {
    if (!best.has(item.id)) best.set(item.id, item)
  }
  return ORDER.map((id) => best.get(id)).filter(Boolean) as ActionInfo[]
}

function project(projectID: string) {
  const row = Database.use((db) =>
    db
      .select({
        id: ProjectTable.id,
        worktree: ProjectTable.worktree,
        preset_plugin_id: ProjectTable.preset_plugin_id,
        preset_id: ProjectTable.preset_id,
        taxonomy_id: ProjectTable.taxonomy_id,
      })
      .from(ProjectTable)
      .where(eq(ProjectTable.id, projectID))
      .get(),
  )
  return row ? ProjectRow.parse(row) : undefined
}

async function lensRows(projectID: string) {
  return Database.use((db) =>
    db.select().from(ProjectLensTable).where(eq(ProjectLensTable.project_id, projectID)).orderBy(asc(ProjectLensTable.time_created)).all(),
  )
}

function values(preset: PresetRuntime, input?: Record<string, string>) {
  const next = { ...preset.defaults, ...(input ?? {}) }
  if (!preset.schema) return next
  return preset.schema.parse(next) as Record<string, string>
}

function key(projectID: string, lensID: string) {
  return `${projectID}:${lensID}`
}

export namespace Product {
  export async function registry(directory?: string) {
    const plugins = await list(directory)
    return RegistryInfo.parse({
      plugins: plugins.map(wirePlugin),
      presets: plugins.flatMap((plugin) => (plugin.presets ?? []).map((preset: PresetRuntime) => wirePreset(plugin, preset))),
      lenses: plugins.flatMap((plugin) => (plugin.lenses ?? []).map((lens: LensRuntime) => wireLens(plugin, lens))),
    })
  }

  export async function preset(id: string, directory?: string) {
    const plugins = await list(directory)
    for (const plugin of plugins) {
      const preset = plugin.presets?.find((item: PresetRuntime) => item.id === id)
      if (!preset) continue
      return {
        plugin,
        preset,
      }
    }
  }

  export async function lens(id: string, directory?: string) {
    const plugins = await list(directory)
    for (const plugin of plugins) {
      const lens = plugin.lenses?.find((item: LensRuntime) => item.id === id)
      if (!lens) continue
      return {
        plugin,
        lens,
      }
    }
  }

  export async function sync(input: { projectID: string; worktree: string }) {
    const data = await Filesystem.readJson(metaPath(input.worktree))
      .then((value) => ProjectMeta.parse(value))
      .catch(() => undefined)
    if (!data) return
    await Database.use((db) =>
      db
        .update(ProjectTable)
        .set({
          preset_id: data.presetID ?? null,
          taxonomy_id: data.taxonomyID ?? null,
          time_updated: Date.now(),
        })
        .where(eq(ProjectTable.id, input.projectID))
        .run(),
    )
    Database.use((db) => db.delete(ProjectLensTable).where(eq(ProjectLensTable.project_id, input.projectID)).run())
    for (const lensID of data.lensIDs) {
      await putLens({ projectID: input.projectID, worktree: input.worktree, lensID })
    }
  }

  export async function configure(input: {
    projectID: string
    worktree: string
    presetID: string
    values?: Record<string, string>
  }) {
    const found = await preset(input.presetID, input.worktree)
    if (!found) throw new Error(`Preset not found: ${input.presetID}`)

    const next = values(found.preset, input.values)
    const taxonomyID = found.preset.defaultTaxonomyID
    const taxonomy = taxonomyID ? found.plugin.taxonomies?.[taxonomyID] : undefined
    if (!taxonomyID || !taxonomy) {
      throw new Error(`Preset taxonomy is missing: ${input.presetID}`)
    }

    await Database.use((db) =>
      db
        .update(ProjectTable)
        .set({
          preset_plugin_id: found.plugin.manifest.id,
          preset_id: found.preset.id,
          taxonomy_id: taxonomyID,
          time_updated: Date.now(),
        })
        .where(eq(ProjectTable.id, input.projectID))
        .run(),
    )

    await Domain.setTaxonomy({
      projectID: input.projectID,
      nodeKinds: taxonomy.nodeKinds,
      edgeKinds: taxonomy.edgeKinds,
      runKinds: taxonomy.runKinds,
      artifactKinds: taxonomy.artifactKinds,
      decisionKinds: taxonomy.decisionKinds,
      decisionStates: taxonomy.decisionStates,
    })

    Database.use((db) => db.delete(ProjectLensTable).where(eq(ProjectLensTable.project_id, input.projectID)).run())
    for (const lensID of found.preset.defaultLensIDs) {
      await putLens({ projectID: input.projectID, worktree: input.worktree, lensID })
    }

    await found.preset.create?.({
      directory: input.worktree,
      projectID: input.projectID,
      values: next,
      host: {
        writeText(relativePath: string, content: string) {
          return Filesystem.write(path.join(input.worktree, relativePath), content)
        },
        writeJson(relativePath: string, value: unknown) {
          return Filesystem.writeJson(path.join(input.worktree, relativePath), value)
        },
        async ensureDir(relativePath: string) {
          const dir = path.join(input.worktree, relativePath)
          await Filesystem.mkdirp(dir)
          return dir
        },
      },
    })

    await Filesystem.writeJson(
      metaPath(input.worktree),
      ProjectMeta.parse({
        presetID: found.preset.id,
        taxonomyID,
        lensIDs: found.preset.defaultLensIDs,
      }),
    )
  }

  export async function installLens(input: { projectID: string; worktree: string; lensID: string }) {
    await putLens(input)
    const shell = await resolve(input.projectID)
    await Filesystem.writeJson(
      metaPath(input.worktree),
      ProjectMeta.parse({
        presetID: shell.preset?.id,
        taxonomyID: shell.taxonomyID,
        lensIDs: shell.lenses.map((item) => item.id),
      }),
    )
    return shell
  }

  export async function removeLens(input: { projectID: string; worktree: string; lensID: string }) {
    Database.use((db) =>
      db
        .delete(ProjectLensTable)
        .where(eq(ProjectLensTable.id, key(input.projectID, input.lensID)))
        .run(),
    )
    const shell = await resolve(input.projectID)
    await Filesystem.writeJson(
      metaPath(input.worktree),
      ProjectMeta.parse({
        presetID: shell.preset?.id,
        taxonomyID: shell.taxonomyID,
        lensIDs: shell.lenses.map((item) => item.id),
      }),
    )
    return shell
  }

  export async function resolve(projectID: string) {
    const row = project(projectID)
    if (!row) throw new Error(`Project not found: ${projectID}`)
    if (!row.preset_id || !row.taxonomy_id) {
      throw new Error(`Project ${projectID} is not configured with a preset`)
    }
    const taxonomyID = row.taxonomy_id

    const all = await registry(row.worktree)
    const preset = all.presets.find((item) => item.id === row.preset_id)
    if (!preset) throw new Error(`Preset not found for project: ${row.preset_id}`)

    const rows = await lensRows(projectID)
    const capabilities = all.plugins.find((item) => item.id === preset.pluginID)?.capabilities ?? []
    const lenses = sortLenses(
      rows.flatMap((item) => {
        const lens = all.lenses.find((entry) => entry.id === item.lens_id)
        if (!lens) return []
        if (!presetAllowed(lens, { presetID: preset.id, taxonomyID, capabilities })) return []
        return [{ installedAt: item.time_created, lens }]
      }),
    )

    const workspaceTabs = mergeTabs(
      lenses.flatMap((item) =>
        item.lens.workspaceTabs.map((tab) => ({
          ...tab,
          pluginID: item.lens.pluginID,
          lensID: item.lens.id,
        })),
      ),
    )

    const sessionTabs = mergeTabs(
      lenses.flatMap((item) =>
        item.lens.sessionTabs.map((tab) => ({
          ...tab,
          pluginID: item.lens.pluginID,
          lensID: item.lens.id,
        })),
      ),
    )

    const actions = mergeActions(
      lenses.flatMap((item) =>
        item.lens.actions.map((action) => ({
          ...action,
          pluginID: item.lens.pluginID,
          lensID: item.lens.id,
        })),
      ),
    )

    return ProjectShell.parse({
      projectID,
      preset,
      taxonomyID,
      lenses: lenses.map((item) => item.lens),
      workspaceTabs,
      sessionTabs,
      actions,
    })
  }
}

async function putLens(input: { projectID: string; worktree: string; lensID: string }) {
  const row = project(input.projectID)
  if (!row) throw new Error(`Project not found: ${input.projectID}`)
  if (!row.preset_id || !row.taxonomy_id) {
    throw new Error(`Project ${input.projectID} is not configured with a preset`)
  }

  const found = await Product.lens(input.lensID, input.worktree)
  if (!found) throw new Error(`Lens not found: ${input.lensID}`)

  const allowed = presetAllowed(wireLens(found.plugin, found.lens), {
    presetID: row.preset_id,
    taxonomyID: row.taxonomy_id,
    capabilities: found.plugin.manifest.capabilities,
  })
  if (!allowed) throw new Error(`Lens does not apply to this project: ${input.lensID}`)

  const now = Date.now()
  Database.use((db) =>
    db
      .insert(ProjectLensTable)
      .values({
        id: key(input.projectID, input.lensID),
        project_id: input.projectID,
        plugin_id: found.plugin.manifest.id,
        lens_id: input.lensID,
        plugin_version: found.plugin.manifest.version,
        config_version: found.lens.configVersion ?? 1,
        config: {},
        time_created: now,
        time_updated: now,
      })
      .onConflictDoUpdate({
        target: ProjectLensTable.id,
        set: {
          plugin_id: found.plugin.manifest.id,
          plugin_version: found.plugin.manifest.version,
          config_version: found.lens.configVersion ?? 1,
          time_updated: now,
        },
      })
      .run(),
  )
}
