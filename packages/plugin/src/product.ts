import z from "zod"

export const ActionID = z.enum(["ask", "propose", "review", "run", "inspect"])
export type ActionID = z.infer<typeof ActionID>

export const PresetField = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["text", "textarea", "path"]).default("text"),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  defaultValue: z.string().optional(),
})
export type PresetField = z.infer<typeof PresetField>

export const PluginInfo = z.object({
  id: z.string(),
  version: z.string(),
  title: z.string(),
  description: z.string(),
  capabilities: z.array(z.string()).default([]),
})
export type PluginInfo = z.infer<typeof PluginInfo>

export const WorkspaceTab = z.object({
  id: z.string(),
  title: z.string(),
  icon: z.string().optional(),
  description: z.string().optional(),
  priority: z.number().default(0),
  kind: z.enum(["core", "lens"]).default("lens"),
  pluginID: z.string().optional(),
  lensID: z.string().optional(),
})
export type WorkspaceTab = z.infer<typeof WorkspaceTab>

export const SessionTab = WorkspaceTab
export type SessionTab = z.infer<typeof SessionTab>

export const ActionInfo = z.object({
  id: ActionID,
  title: z.string(),
  description: z.string(),
  prompt: z.string(),
  icon: z.string().optional(),
  priority: z.number().default(0),
  pluginID: z.string().optional(),
  lensID: z.string().optional(),
})
export type ActionInfo = z.infer<typeof ActionInfo>

export const PresetInfo = z.object({
  id: z.string(),
  pluginID: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  defaultTaxonomyID: z.string().optional(),
  defaultLensIDs: z.array(z.string()).default([]),
  fields: z.array(PresetField).default([]),
  defaults: z.record(z.string(), z.string()).default({}),
})
export type PresetInfo = z.infer<typeof PresetInfo>

export const LensInfo = z.object({
  id: z.string(),
  pluginID: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.number().default(0),
  appliesToPresets: z.array(z.string()).default([]),
  appliesToTaxonomies: z.array(z.string()).default([]),
  requiresCapabilities: z.array(z.string()).default([]),
  workspaceTabs: z.array(WorkspaceTab).default([]),
  sessionTabs: z.array(SessionTab).default([]),
  actions: z.array(ActionInfo).default([]),
  pluginVersion: z.string().optional(),
  configVersion: z.number().default(1),
})
export type LensInfo = z.infer<typeof LensInfo>

export const RegistryInfo = z.object({
  plugins: z.array(PluginInfo),
  presets: z.array(PresetInfo),
  lenses: z.array(LensInfo),
})
export type RegistryInfo = z.infer<typeof RegistryInfo>

export const ProjectMeta = z.object({
  presetID: z.string().optional(),
  taxonomyID: z.string().optional(),
  lensIDs: z.array(z.string()).default([]),
})
export type ProjectMeta = z.infer<typeof ProjectMeta>

export const ProjectShell = z.object({
  projectID: z.string(),
  preset: PresetInfo.optional(),
  taxonomyID: z.string().optional(),
  lenses: z.array(LensInfo),
  workspaceTabs: z.array(WorkspaceTab),
  sessionTabs: z.array(SessionTab),
  actions: z.array(ActionInfo),
})
export type ProjectShell = z.infer<typeof ProjectShell>

export type Taxonomy = {
  nodeKinds?: string[]
  edgeKinds?: string[]
  runKinds?: string[]
  artifactKinds?: string[]
  decisionKinds?: string[]
  decisionStates?: string[]
}

export type PresetRuntime = z.infer<typeof PresetInfo> & {
  schema?: z.ZodObject
  create?: (input: {
    directory: string
    projectID: string
    values: Record<string, string>
  }) => Promise<void>
}

export type LensRuntime = z.infer<typeof LensInfo>

export type ProductPlugin = {
  manifest: PluginInfo
  taxonomies?: Record<string, Taxonomy>
  presets?: PresetRuntime[]
  lenses?: LensRuntime[]
}

export function defineProductPlugin(input: ProductPlugin) {
  return input
}
