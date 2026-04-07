import path from "path"
import { Instance } from "../../project/instance"
import { Filesystem } from "../../util/filesystem"

/**
 * Embedding 缓存管理（使用文件系统，不改动数据库）
 */

export interface AtomEmbedding {
  atomId: string
  claimEmbedding: number[]
  timestamp: number
}

export interface EmbeddingCache {
  version: string
  embeddings: Record<string, AtomEmbedding>
}

const CACHE_FILE = ".atom-embeddings-cache.json"
const CACHE_VERSION = "1.0"

/**
 * 获取缓存文件路径
 */
function getCachePath(): string {
  return path.join(Instance.directory, "atom_list", CACHE_FILE)
}

/**
 * 读取缓存
 */
export async function loadEmbeddingCache(): Promise<EmbeddingCache> {
  const cachePath = getCachePath()

  try {
    if (await Filesystem.exists(cachePath)) {
      const content = await Filesystem.readText(cachePath)
      const cache = JSON.parse(content) as EmbeddingCache

      // 版本检查
      if (cache.version === CACHE_VERSION) {
        return cache
      }
    }
  } catch (error) {
    console.warn("Failed to load embedding cache:", error)
  }

  // 返回空缓存
  return {
    version: CACHE_VERSION,
    embeddings: {},
  }
}

/**
 * 保存缓存
 */
export async function saveEmbeddingCache(cache: EmbeddingCache): Promise<void> {
  const cachePath = getCachePath()

  try {
    await Filesystem.write(cachePath, JSON.stringify(cache, null, 2))
  } catch (error) {
    console.warn("Failed to save embedding cache:", error)
  }
}

/**
 * 获取 atom 的 embedding（从缓存或生成新的）
 */
export async function getAtomEmbedding(atomId: string, claimText: string, cache: EmbeddingCache): Promise<number[]> {
  // 检查缓存
  const cached = cache.embeddings[atomId]
  if (cached) {
    return cached.claimEmbedding
  }

  // 生成新的 embedding
  const embedding = await generateEmbedding(claimText)

  // 更新缓存
  cache.embeddings[atomId] = {
    atomId,
    claimEmbedding: embedding,
    timestamp: Date.now(),
  }

  return embedding
}

/**
 * 生成文本的 embedding
 *
 * 简化版实现：使用 TF-IDF 风格的向量化
 * 生产环境应该使用真实的 embedding API（如 OpenAI）
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // 简单的文本向量化（用于演示）
  // 实际应该调用 OpenAI embedding API 或其他服务

  // 1. 文本预处理
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  // 2. 分词
  const words = normalized.split(" ")

  // 3. 生成固定维度的向量（384维，模拟 sentence-transformers）
  const dimension = 384
  const vector = new Array(dimension).fill(0)

  // 4. 简单的哈希映射到向量空间
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const hash = simpleHash(word)

    // 将单词映射到多个维度
    for (let j = 0; j < 3; j++) {
      const idx = (hash + j * 127) % dimension
      vector[idx] += 1.0 / Math.sqrt(words.length)
    }
  }

  // 5. L2 归一化
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm
    }
  }

  return vector
}

/**
 * 简单的字符串哈希函数
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * 计算两个向量的余弦相似度
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must have the same dimension")
  }

  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i]
    norm1 += vec1[i] * vec1[i]
    norm2 += vec2[i] * vec2[i]
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
  if (denominator === 0) return 0

  return dotProduct / denominator
}

/**
 * 批量生成 embeddings
 */
export async function batchGenerateEmbeddings(
  items: Array<{ atomId: string; claimText: string }>,
  cache: EmbeddingCache,
): Promise<void> {
  for (const item of items) {
    await getAtomEmbedding(item.atomId, item.claimText, cache)
  }

  // 保存缓存
  await saveEmbeddingCache(cache)
}
