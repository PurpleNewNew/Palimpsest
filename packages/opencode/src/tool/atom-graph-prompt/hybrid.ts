import type { TraversedAtom, RelationType, AtomType } from "./types"
import { traverseAtomGraph } from "./traversal"
import { loadEmbeddingCache, getAtomEmbedding, cosineSimilarity, saveEmbeddingCache } from "./embedding"
import { scoreAndRankAtoms, selectDiverseAtoms, type ScoringWeights, DEFAULT_WEIGHTS } from "./scoring"
import { selectAtomsWithinBudget, adaptiveBudgetSelection, type TokenBudgetOptions } from "./token-budget"
import { Database, eq } from "../../storage/db"
import { AtomTable } from "../../research/research.sql"
import { Filesystem } from "../../util/filesystem"

/**
 * 混合检索选项
 */
export interface HybridSearchOptions {
  // 查询
  query?: string // 自然语言查询（用于语义搜索）
  seedAtomIds?: string[] // 起始 atom IDs（用于图遍历）

  // 图遍历参数
  maxDepth: number
  relationTypes?: RelationType[]
  atomTypes?: AtomType[]

  // 语义搜索参数
  semanticTopK?: number // 语义搜索返回的 top K atoms
  semanticThreshold?: number // 语义相似度阈值

  // 选择策略
  maxAtoms: number
  diversityWeight?: number // 多样性权重 (0-1)
  scoringWeights?: ScoringWeights

  // Token 预算
  maxTokens?: number
  includeEvidence: boolean
  includeMetadata: boolean
}

/**
 * 混合检索结果
 */
export interface HybridSearchResult {
  atoms: Array<TraversedAtom & { score: number }>
  metadata: {
    totalFound: number
    selected: number
    fromSemanticSearch: number
    fromGraphTraversal: number
    tokensUsed?: number
    budgetUsed?: number
  }
}

/**
 * 执行混合检索
 *
 * 策略：
 * 1. 如果提供了 query，先进行语义搜索找到相关 atoms
 * 2. 从 seedAtomIds 或语义搜索结果开始图遍历
 * 3. 合并结果并去重
 * 4. 智能评分和排序
 * 5. 应用 token 预算管理
 */
export async function hybridSearch(options: HybridSearchOptions): Promise<HybridSearchResult> {
  const {
    query,
    seedAtomIds,
    maxDepth,
    relationTypes,
    atomTypes,
    semanticTopK = 5,
    semanticThreshold = 0.5,
    maxAtoms,
    diversityWeight = 0.3,
    scoringWeights = DEFAULT_WEIGHTS,
    maxTokens,
    includeEvidence,
    includeMetadata,
  } = options

  let queryEmbedding: number[] | null = null
  let semanticAtomIds: string[] = []
  let fromSemanticSearch = 0

  // Step 1: 语义搜索（如果提供了 query）
  if (query) {
    const semanticResults = await semanticSearch(query, {
      topK: semanticTopK,
      threshold: semanticThreshold,
      atomTypes,
    })

    queryEmbedding = semanticResults.queryEmbedding
    semanticAtomIds = semanticResults.results.map((r) => r.atomId)
    fromSemanticSearch = semanticAtomIds.length
  }

  // Step 2: 确定图遍历的起始点
  let startAtomIds = seedAtomIds || []
  if (semanticAtomIds.length > 0) {
    // 合并语义搜索结果和用户指定的起始点
    startAtomIds = [...new Set([...startAtomIds, ...semanticAtomIds])]
  }

  if (startAtomIds.length === 0) {
    return {
      atoms: [],
      metadata: {
        totalFound: 0,
        selected: 0,
        fromSemanticSearch: 0,
        fromGraphTraversal: 0,
      },
    }
  }

  // Step 3: 图遍历
  const traversedAtoms = await traverseAtomGraph({
    seedAtomIds: startAtomIds,
    maxDepth,
    maxAtoms: maxAtoms * 2, // 遍历更多，后续再筛选
    relationTypes,
    atomTypes,
  })

  // Step 4: 为 atoms 添加 embeddings（用于评分）
  if (queryEmbedding) {
    const cache = await loadEmbeddingCache()

    for (const atom of traversedAtoms) {
      if (atom.claim) {
        const embedding = await getAtomEmbedding(atom.atom.atom_id, atom.claim, cache)
        atom.claimEmbedding = embedding
      }
    }

    await saveEmbeddingCache(cache)
  }

  // Step 5: 智能评分和排序
  const scoredAtoms = scoreAndRankAtoms(traversedAtoms, queryEmbedding, scoringWeights)

  // Step 6: 选择多样化的 atoms
  let selectedAtoms = selectDiverseAtoms(scoredAtoms, maxAtoms, diversityWeight)

  // Step 7: Token 预算管理（如果指定了）
  let tokensUsed: number | undefined
  let budgetUsed: number | undefined

  if (maxTokens) {
    const budgetResult = selectAtomsWithinBudget(selectedAtoms, {
      maxTokens,
      includeEvidence,
      includeMetadata,
      reserveTokens: 200,
    })

    selectedAtoms = budgetResult.selected
    tokensUsed = budgetResult.totalTokens
    budgetUsed = budgetResult.budgetUsed
  }

  return {
    atoms: selectedAtoms,
    metadata: {
      totalFound: traversedAtoms.length,
      selected: selectedAtoms.length,
      fromSemanticSearch,
      fromGraphTraversal: traversedAtoms.length - fromSemanticSearch,
      tokensUsed,
      budgetUsed,
    },
  }
}

/**
 * 语义搜索选项
 */
interface SemanticSearchOptions {
  topK: number
  threshold?: number
  atomTypes?: AtomType[]
}

/**
 * 语义搜索结果
 */
interface SemanticSearchResult {
  queryEmbedding: number[]
  results: Array<{
    atomId: string
    atomName: string
    similarity: number
  }>
}

/**
 * 执行语义搜索
 *
 * 在所有 atoms 中搜索与查询语义相似的内容
 */
async function semanticSearch(query: string, options: SemanticSearchOptions): Promise<SemanticSearchResult> {
  const { topK, threshold = 0.0, atomTypes } = options

  // 1. 生成查询的 embedding
  const cache = await loadEmbeddingCache()
  const queryEmbedding = await getAtomEmbedding("query", query, cache)

  // 2. 获取所有 atoms
  let atoms = Database.use((db) => db.select().from(AtomTable).all())

  // 3. 应用类型过滤
  if (atomTypes && atomTypes.length > 0) {
    atoms = atoms.filter((atom) => atomTypes.includes(atom.atom_type as AtomType))
  }

  // 4. 为每个 atom 计算相似度
  const similarities: Array<{
    atomId: string
    atomName: string
    similarity: number
  }> = []

  for (const atom of atoms) {
    // 读取 claim 文本
    let claimText = ""
    try {
      if (atom.atom_claim_path) {
        claimText = await Filesystem.readText(atom.atom_claim_path)
      }
    } catch (error) {
      continue // 跳过无法读取的 atom
    }

    if (!claimText) continue

    // 获取或生成 embedding
    const atomEmbedding = await getAtomEmbedding(atom.atom_id, claimText, cache)

    // 计算相似度
    const similarity = cosineSimilarity(queryEmbedding, atomEmbedding)

    if (similarity >= threshold) {
      similarities.push({
        atomId: atom.atom_id,
        atomName: atom.atom_name,
        similarity,
      })
    }
  }

  // 5. 保存缓存
  await saveEmbeddingCache(cache)

  // 6. 排序并返回 top K
  similarities.sort((a, b) => b.similarity - a.similarity)

  return {
    queryEmbedding,
    results: similarities.slice(0, topK),
  }
}

/**
 * 纯图遍历模式（Phase 1 兼容）
 */
export async function graphOnlySearch(options: {
  seedAtomIds: string[]
  maxDepth: number
  maxAtoms: number
  relationTypes?: RelationType[]
  atomTypes?: AtomType[]
  includeEvidence: boolean
  includeMetadata: boolean
}): Promise<HybridSearchResult> {
  const traversedAtoms = await traverseAtomGraph({
    seedAtomIds: options.seedAtomIds,
    maxDepth: options.maxDepth,
    maxAtoms: options.maxAtoms,
    relationTypes: options.relationTypes,
    atomTypes: options.atomTypes,
  })

  // 简单评分（只基于距离和类型）
  const scoredAtoms = scoreAndRankAtoms(traversedAtoms, null, {
    distance: 0.5,
    type: 0.3,
    semantic: 0.0,
    temporal: 0.1,
    relationChain: 0.1,
  })

  return {
    atoms: scoredAtoms.slice(0, options.maxAtoms),
    metadata: {
      totalFound: traversedAtoms.length,
      selected: Math.min(traversedAtoms.length, options.maxAtoms),
      fromSemanticSearch: 0,
      fromGraphTraversal: traversedAtoms.length,
    },
  }
}
