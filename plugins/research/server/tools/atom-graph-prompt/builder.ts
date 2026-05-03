import type { TraversedAtom, PromptBuilderOptions, Community } from "./types"

import { linkKinds } from "../../research-schema"
import { Domain, Instance } from "../helpers"

/**
 * 构建 GraphRAG 风格的 Prompt
 */
export async function buildPrompt(atoms: TraversedAtom[], options: PromptBuilderOptions): Promise<string> {
  if (options.template === "graphrag") {
    return buildGraphRAGPrompt(atoms, options)
  } else {
    return buildCompactPrompt(atoms, options)
  }
}

/**
 * GraphRAG 风格模板
 */
async function buildGraphRAGPrompt(atoms: TraversedAtom[], options: PromptBuilderOptions): Promise<string> {
  const sections: string[] = []

  // 标题
  sections.push("# Research Context Graph")
  sections.push("")
  sections.push("You are analyzing a research project with the following knowledge atoms:")
  sections.push("")

  // Atoms 部分
  sections.push("## Atoms (Knowledge Units)")
  sections.push("")

  atoms.forEach((atom, index) => {
    sections.push(`### Atom ${index + 1}: ${atom.atom.atom_name} [${atom.atom.atom_type}]`)
    sections.push("")
    sections.push("**Claim:**")
    sections.push(atom.claim || "(No claim available)")
    sections.push("")

    if (options.includeEvidence && atom.evidence) {
      sections.push("**Evidence:**")
      sections.push(atom.evidence)
      sections.push("")
    }

    if (options.includeMetadata) {
      sections.push("**Metadata:**")
      sections.push(`- Type: ${atom.atom.atom_type}`)
      sections.push(`- Distance from query: ${atom.distance} hops`)
      sections.push(`- Created: ${new Date(atom.atom.time_created).toISOString()}`)
      sections.push("")
    }
  })

  // 关系部分
  const relationships = await extractRelationships(atoms)
  if (relationships.length > 0) {
    sections.push("## Relationships")
    sections.push("")
    relationships.forEach((rel) => {
      sections.push(`- ${rel.sourceName} --[${rel.relationType}]--> ${rel.targetName}`)
    })
    sections.push("")
  }

  // 指令部分
  sections.push("## Instructions")
  sections.push("")
  sections.push("Based on the above research context graph, please analyze the relationships")
  sections.push("between atoms and their types (question/hypothesis/claim/finding/source).")
  sections.push("Consider how questions motivate hypotheses, hypotheses are analyzed by claims,")
  sections.push("and validated by findings backed by sources.")
  sections.push("")

  return sections.join("\n")
}

/**
 * Compact 模板（Token 高效）
 */
async function buildCompactPrompt(atoms: TraversedAtom[], options: PromptBuilderOptions): Promise<string> {
  const sections: string[] = []

  sections.push("Research Context:")
  sections.push("")

  atoms.forEach((atom, index) => {
    const claimSummary = atom.claim.substring(0, 200).replace(/\n/g, " ")
    sections.push(`${index + 1}. [${atom.atom.atom_type}] ${atom.atom.atom_name}: ${claimSummary}...`)
  })

  sections.push("")

  const relationships = await extractRelationships(atoms)
  if (relationships.length > 0) {
    const relSummary = relationships
      .slice(0, 5)
      .map((r) => `${r.sourceName}->${r.targetName}`)
      .join(", ")
    sections.push(`Relationships: ${relSummary}${relationships.length > 5 ? "..." : ""}`)
  }

  return sections.join("\n")
}

/**
 * 从 atoms 中提取关系
 */
async function extractRelationships(atoms: TraversedAtom[]): Promise<
  Array<{
    sourceName: string
    targetName: string
    relationType: string
  }>
> {
  const atomMap = new Map(atoms.map((a) => [a.atom.atom_id, a.atom.atom_name]))
  if (atomMap.size === 0) return []

  const projectID = Instance.project.id
  const allowed = new Set<string>(linkKinds)
  const edges = await Domain.listEdges({ projectID })
  const filtered = edges.filter(
    (edge) => allowed.has(edge.kind) && atomMap.has(edge.sourceID) && atomMap.has(edge.targetID),
  )

  return filtered.map((edge) => ({
    sourceName: atomMap.get(edge.sourceID) || edge.sourceID,
    targetName: atomMap.get(edge.targetID) || edge.targetID,
    relationType: edge.kind,
  }))
}

/**
 * 构建社区级别的 Prompt（Phase 3）
 *
 * 为多个社区生成结构化的 prompt，突出社区结构
 */
export async function buildCommunityPrompt(
  communities: Community[],
  atomsByCommunity: Map<string, TraversedAtom[]>,
  options: PromptBuilderOptions,
): Promise<string> {
  if (options.template === "graphrag") {
    return buildCommunityGraphRAGPrompt(communities, atomsByCommunity, options)
  } else {
    return buildCommunityCompactPrompt(communities, atomsByCommunity, options)
  }
}

/**
 * 社区级别的 GraphRAG 模板
 */
async function buildCommunityGraphRAGPrompt(
  communities: Community[],
  atomsByCommunity: Map<string, TraversedAtom[]>,
  options: PromptBuilderOptions,
): Promise<string> {
  const sections: string[] = []

  // 标题
  sections.push("# Research Context Graph (Community View)")
  sections.push("")
  sections.push(`You are analyzing a research project organized into ${communities.length} communities:`)
  sections.push("")

  // 社区概览
  sections.push("## Communities Overview")
  sections.push("")
  communities.forEach((community, index) => {
    sections.push(`### Community ${index + 1}: ${community.dominantType.toUpperCase()} (${community.size} atoms)`)
    sections.push("")
    sections.push(`**Summary:** ${community.summary}`)
    sections.push("")
    sections.push(`**Keywords:** ${community.keywords.join(", ")}`)
    sections.push("")
    sections.push(`**Density:** ${(community.density * 100).toFixed(1)}%`)
    sections.push("")
  })

  // 每个社区的详细内容
  sections.push("## Detailed Community Content")
  sections.push("")

  communities.forEach((community, commIndex) => {
    const atoms = atomsByCommunity.get(community.id) || []
    if (atoms.length === 0) return

    sections.push(`### Community ${commIndex + 1} Atoms`)
    sections.push("")

    atoms.forEach((atom, atomIndex) => {
      sections.push(`#### Atom ${commIndex + 1}.${atomIndex + 1}: ${atom.atom.atom_name} [${atom.atom.atom_type}]`)
      sections.push("")
      sections.push("**Claim:**")
      sections.push(atom.claim || "(No claim available)")
      sections.push("")

      if (options.includeEvidence && atom.evidence) {
        sections.push("**Evidence:**")
        sections.push(atom.evidence)
        sections.push("")
      }

      if (options.includeMetadata) {
        sections.push("**Metadata:**")
        sections.push(`- Type: ${atom.atom.atom_type}`)
        sections.push(`- Community: ${commIndex + 1}`)
        sections.push(`- Created: ${new Date(atom.atom.time_created).toISOString()}`)
        sections.push("")
      }
    })
  })

  // 关系部分
  const allAtoms = Array.from(atomsByCommunity.values()).flat()
  const relationships = await extractRelationships(allAtoms)
  if (relationships.length > 0) {
    sections.push("## Relationships")
    sections.push("")
    relationships.forEach((rel) => {
      sections.push(`- ${rel.sourceName} --[${rel.relationType}]--> ${rel.targetName}`)
    })
    sections.push("")
  }

  // 指令部分
  sections.push("## Instructions")
  sections.push("")
  sections.push("Based on the above community-structured research context, please:")
  sections.push("1. Analyze the relationships within and between communities")
  sections.push("2. Identify key themes in each community")
  sections.push("3. Consider how different communities relate to each other")
  sections.push("")

  return sections.join("\n")
}

/**
 * 社区级别的 Compact 模板
 */
function buildCommunityCompactPrompt(
  communities: Community[],
  atomsByCommunity: Map<string, TraversedAtom[]>,
  options: PromptBuilderOptions,
): string {
  const sections: string[] = []

  sections.push(`Research Context (${communities.length} communities):`)
  sections.push("")

  communities.forEach((community, commIndex) => {
    const atoms = atomsByCommunity.get(community.id) || []
    sections.push(`Community ${commIndex + 1} [${community.dominantType}, ${community.size} atoms]:`)
    sections.push(`  ${community.summary}`)
    sections.push("")

    atoms.forEach((atom, atomIndex) => {
      const claimSummary = atom.claim.substring(0, 150).replace(/\n/g, " ")
      sections.push(
        `  ${commIndex + 1}.${atomIndex + 1}. [${atom.atom.atom_type}] ${atom.atom.atom_name}: ${claimSummary}...`,
      )
    })
    sections.push("")
  })

  return sections.join("\n")
}
