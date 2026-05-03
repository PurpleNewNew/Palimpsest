import "../../fixture/research-plugin-bind"
import { test, expect } from "bun:test"
import { tmpdir } from "../../fixture/fixture"
import { Instance } from "../../../src/project/instance"
import { seedAtoms, seedRelations, seedResearchProject } from "../../fixture/atom-seed"
import { detectCommunities } from "@palimpsest/plugin-research/server/tools/atom-graph-prompt/community"
import { hybridSearch } from "@palimpsest/plugin-research/server/tools/atom-graph-prompt/hybrid"

interface SeedAtom {
  id: string
  name: string
  type: "question" | "hypothesis" | "claim" | "finding"
  claim: string
}

function seedGraph(
  rpId: string,
  atoms: SeedAtom[],
  relations: Array<{
    source: string
    target: string
    type: "motivates" | "formalizes" | "derives" | "analyzes" | "validates" | "contradicts" | "other"
  }>,
) {
  seedAtoms(
    atoms.map((a) => ({
      atom_id: a.id,
      research_project_id: rpId,
      atom_name: a.name,
      atom_type: a.type,
      claim: a.claim,
    })),
  )
  if (relations.length > 0) {
    seedRelations(relations)
  }
}

// -------------------------------------------------------------------
// 1. hybridSearch 按 communityIds 过滤
// -------------------------------------------------------------------
test("should filter hybrid results by community IDs", async () => {
  await using tmp = await tmpdir({ git: true })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const { research_project_id: rpId } = seedResearchProject()
      const p = crypto.randomUUID().slice(0, 8)

      // 两个独立子图
      const atoms: SeedAtom[] = [
        { id: `${p}-a1`, name: "A1", type: "hypothesis", claim: "Group A method 1" },
        { id: `${p}-a2`, name: "A2", type: "hypothesis", claim: "Group A method 2" },
        { id: `${p}-b1`, name: "B1", type: "claim", claim: "Group B theorem 1" },
        { id: `${p}-b2`, name: "B2", type: "claim", claim: "Group B theorem 2" },
      ]

      seedGraph(rpId, atoms, [
        { source: `${p}-a1`, target: `${p}-a2`, type: "derives" },
        { source: `${p}-a2`, target: `${p}-a1`, type: "analyzes" },
        { source: `${p}-b1`, target: `${p}-b2`, type: "validates" },
        { source: `${p}-b2`, target: `${p}-b1`, type: "formalizes" },
      ])

      const cache = await detectCommunities({ minCommunitySize: 2, forceRefresh: true })

      // 找到 a1 所属的社区
      const commA = cache.atomToCommunity[`${p}-a1`]
      expect(commA).toBeDefined()

      // 只搜索 a 组社区
      const result = await hybridSearch({
        seedAtomIds: [`${p}-a1`, `${p}-b1`],
        maxDepth: 2,
        maxAtoms: 10,
        includeEvidence: false,
        includeMetadata: true,
        communityFilter: { communityIds: [commA] },
      })

      // 结果应只包含 a 组
      const ids = result.atoms.map((a) => a.atom.atom_id)
      expect(ids).toContain(`${p}-a1`)
      expect(ids).toContain(`${p}-a2`)
      expect(ids).not.toContain(`${p}-b1`)
      expect(ids).not.toContain(`${p}-b2`)
    },
  })
})

// -------------------------------------------------------------------
// 2. hybridSearch 按 minCommunitySize 过滤
// -------------------------------------------------------------------
test("should filter by minimum community size", async () => {
  await using tmp = await tmpdir({ git: true })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const { research_project_id: rpId } = seedResearchProject()
      const p = crypto.randomUUID().slice(0, 8)

      // 大组 4 节点 + 小组 2 节点
      const atoms: SeedAtom[] = [
        { id: `${p}-lg1`, name: "LG1", type: "hypothesis", claim: "Large group 1" },
        { id: `${p}-lg2`, name: "LG2", type: "hypothesis", claim: "Large group 2" },
        { id: `${p}-lg3`, name: "LG3", type: "hypothesis", claim: "Large group 3" },
        { id: `${p}-lg4`, name: "LG4", type: "hypothesis", claim: "Large group 4" },
        { id: `${p}-sm1`, name: "SM1", type: "question", claim: "Small group 1" },
        { id: `${p}-sm2`, name: "SM2", type: "question", claim: "Small group 2" },
      ]

      seedGraph(rpId, atoms, [
        { source: `${p}-lg1`, target: `${p}-lg2`, type: "derives" },
        { source: `${p}-lg2`, target: `${p}-lg3`, type: "derives" },
        { source: `${p}-lg3`, target: `${p}-lg4`, type: "derives" },
        { source: `${p}-lg4`, target: `${p}-lg1`, type: "analyzes" },
        { source: `${p}-sm1`, target: `${p}-sm2`, type: "validates" },
        { source: `${p}-sm2`, target: `${p}-sm1`, type: "formalizes" },
      ])

      await detectCommunities({ minCommunitySize: 1, forceRefresh: true })

      // 只要大社区（>= 3）
      const result = await hybridSearch({
        seedAtomIds: [`${p}-lg1`, `${p}-sm1`],
        maxDepth: 3,
        maxAtoms: 20,
        includeEvidence: false,
        includeMetadata: true,
        communityFilter: { minCommunitySize: 3 },
      })

      const ids = result.atoms.map((a) => a.atom.atom_id)
      // 大组应被包含
      expect(ids).toContain(`${p}-lg1`)
      // 小组应被过滤
      expect(ids).not.toContain(`${p}-sm1`)
      expect(ids).not.toContain(`${p}-sm2`)
    },
  })
})

// -------------------------------------------------------------------
// 3. hybridSearch 按 dominantTypes 过滤
// -------------------------------------------------------------------
test("should filter by community dominant types", async () => {
  await using tmp = await tmpdir({ git: true })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const { research_project_id: rpId } = seedResearchProject()
      const p = crypto.randomUUID().slice(0, 8)

      // Method 社区
      const atoms: SeedAtom[] = [
        { id: `${p}-m1`, name: "Method M1", type: "hypothesis", claim: "M1" },
        { id: `${p}-m2`, name: "Method M2", type: "hypothesis", claim: "M2" },
        // Theorem 社区
        { id: `${p}-t1`, name: "Theorem T1", type: "claim", claim: "T1" },
        { id: `${p}-t2`, name: "Theorem T2", type: "claim", claim: "T2" },
      ]

      seedGraph(rpId, atoms, [
        { source: `${p}-m1`, target: `${p}-m2`, type: "derives" },
        { source: `${p}-m2`, target: `${p}-m1`, type: "analyzes" },
        { source: `${p}-t1`, target: `${p}-t2`, type: "validates" },
        { source: `${p}-t2`, target: `${p}-t1`, type: "formalizes" },
      ])

      await detectCommunities({ minCommunitySize: 2, forceRefresh: true })

      // 只要 theorem 主导的社区
      const result = await hybridSearch({
        seedAtomIds: [`${p}-m1`, `${p}-t1`],
        maxDepth: 2,
        maxAtoms: 10,
        includeEvidence: false,
        includeMetadata: true,
        communityFilter: { dominantTypes: ["claim"] },
      })

      const types = result.atoms.map((a) => a.atom.atom_type)
      // 应全是 theorem 社区的成员
      types.forEach((t) => expect(t).toBe("claim"))
    },
  })
})

// -------------------------------------------------------------------
// 4. hybridSearch 无社区缓存时社区过滤优雅降级
// -------------------------------------------------------------------
test("should degrade gracefully when community cache does not exist", async () => {
  await using tmp = await tmpdir({ git: true })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const { research_project_id: rpId } = seedResearchProject()
      const p = crypto.randomUUID().slice(0, 8)

      const atoms: SeedAtom[] = [
        { id: `${p}-x1`, name: "X1", type: "hypothesis", claim: "X1" },
        { id: `${p}-x2`, name: "X2", type: "hypothesis", claim: "X2" },
      ]
      seedGraph(rpId, atoms, [{ source: `${p}-x1`, target: `${p}-x2`, type: "derives" }])

      // 不调用 detectCommunities，直接带社区过滤搜索
      // 当没有社区缓存时，applyCommunityFilter 返回空数组
      // hybridSearch 将跳过社区过滤（优雅降级），返回正常遍历结果
      const result = await hybridSearch({
        seedAtomIds: [`${p}-x1`],
        maxDepth: 2,
        maxAtoms: 10,
        includeEvidence: false,
        includeMetadata: true,
        communityFilter: { communityIds: ["nonexistent"] },
      })

      // 无缓存时过滤被跳过，正常遍历结果通过
      expect(result.atoms.length).toBeGreaterThan(0)
    },
  })
})

// -------------------------------------------------------------------
// 5. hybridSearch 社区过滤 + 语义搜索组合
// -------------------------------------------------------------------
test("should combine community filter with semantic search", async () => {
  await using tmp = await tmpdir({ git: true })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const { research_project_id: rpId } = seedResearchProject()
      const p = crypto.randomUUID().slice(0, 8)

      const atoms: SeedAtom[] = [
        {
          id: `${p}-opt1`,
          name: "SGD Method",
          type: "hypothesis",
          claim: "Stochastic gradient descent optimization for neural network training",
        },
        {
          id: `${p}-opt2`,
          name: "Adam Method",
          type: "hypothesis",
          claim: "Adaptive moment estimation for deep learning optimization",
        },
        { id: `${p}-bio1`, name: "Gene Seq", type: "question", claim: "DNA gene sequencing using next generation methods" },
        { id: `${p}-bio2`, name: "Protein", type: "question", claim: "Protein structure prediction and folding analysis" },
      ]

      seedGraph(rpId, atoms, [
        { source: `${p}-opt1`, target: `${p}-opt2`, type: "derives" },
        { source: `${p}-opt2`, target: `${p}-opt1`, type: "analyzes" },
        { source: `${p}-bio1`, target: `${p}-bio2`, type: "analyzes" },
        { source: `${p}-bio2`, target: `${p}-bio1`, type: "validates" },
      ])

      const cache = await detectCommunities({ minCommunitySize: 2, forceRefresh: true })
      const optComm = cache.atomToCommunity[`${p}-opt1`]

      // 语义搜索 "gradient optimization" + 限制到 opt 社区
      const result = await hybridSearch({
        query: "gradient optimization training",
        maxDepth: 2,
        maxAtoms: 10,
        includeEvidence: false,
        includeMetadata: true,
        semanticTopK: 5,
        semanticThreshold: 0.0,
        communityFilter: { communityIds: [optComm] },
      })

      // 结果应只包含 opt 社区
      const ids = result.atoms.map((a) => a.atom.atom_id)
      ids.forEach((id) => {
        expect(id.startsWith(`${p}-opt`)).toBe(true)
      })
    },
  })
})

// -------------------------------------------------------------------
// 6. hybridSearch maxCommunitySize 过滤
// -------------------------------------------------------------------
test("should filter by maximum community size", async () => {
  await using tmp = await tmpdir({ git: true })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const { research_project_id: rpId } = seedResearchProject()
      const p = crypto.randomUUID().slice(0, 8)

      // 小组 2 节点 + 大组 4 节点
      const atoms: SeedAtom[] = [
        { id: `${p}-s1`, name: "S1", type: "question", claim: "Small 1" },
        { id: `${p}-s2`, name: "S2", type: "question", claim: "Small 2" },
        { id: `${p}-l1`, name: "L1", type: "hypothesis", claim: "Large 1" },
        { id: `${p}-l2`, name: "L2", type: "hypothesis", claim: "Large 2" },
        { id: `${p}-l3`, name: "L3", type: "hypothesis", claim: "Large 3" },
        { id: `${p}-l4`, name: "L4", type: "hypothesis", claim: "Large 4" },
      ]

      seedGraph(rpId, atoms, [
        { source: `${p}-s1`, target: `${p}-s2`, type: "validates" },
        { source: `${p}-s2`, target: `${p}-s1`, type: "formalizes" },
        { source: `${p}-l1`, target: `${p}-l2`, type: "derives" },
        { source: `${p}-l2`, target: `${p}-l3`, type: "derives" },
        { source: `${p}-l3`, target: `${p}-l4`, type: "derives" },
        { source: `${p}-l4`, target: `${p}-l1`, type: "analyzes" },
      ])

      await detectCommunities({ minCommunitySize: 2, forceRefresh: true })

      // 只要小社区（<= 2）
      const result = await hybridSearch({
        seedAtomIds: [`${p}-s1`, `${p}-l1`],
        maxDepth: 3,
        maxAtoms: 20,
        includeEvidence: false,
        includeMetadata: true,
        communityFilter: { maxCommunitySize: 2 },
      })

      const ids = result.atoms.map((a) => a.atom.atom_id)
      // 小组在
      expect(ids).toContain(`${p}-s1`)
      // 大组被过滤
      expect(ids).not.toContain(`${p}-l1`)
    },
  })
})
