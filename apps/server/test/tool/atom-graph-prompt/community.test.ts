import "../../fixture/research-plugin-bind"
import { test, expect } from "bun:test"
import { tmpdir } from "../../fixture/fixture"
import { Instance } from "../../../src/project/instance"
import { seedAtoms, seedRelations, seedResearchProject } from "../../fixture/atom-seed"
import {
  detectCommunities,
  queryCommunities,
  getCommunityStats,
  getAtomCommunity,
  getCommunityAtoms,
  refreshCommunities,
} from "@palimpsest/plugin-research/server/tools/atom-graph-prompt/community"

test("detectCommunities - basic detection", async () => {
  await using tmp = await tmpdir({ git: true })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const { research_project_id: rpId } = seedResearchProject()

      // Create test atoms
      const atom1Id = "atom-1"
      const atom2Id = "atom-2"
      const atom3Id = "atom-3"

      seedAtoms([
        {
          atom_id: atom1Id,
          research_project_id: rpId,
          atom_name: "Test Atom 1",
          atom_type: "hypothesis",
          claim: "This is a test method claim",
        },
        {
          atom_id: atom2Id,
          research_project_id: rpId,
          atom_name: "Test Atom 2",
          atom_type: "claim",
          claim: "This is a test theorem claim",
        },
        {
          atom_id: atom3Id,
          research_project_id: rpId,
          atom_name: "Test Atom 3",
          atom_type: "question",
          claim: "This is a test fact claim",
        },
      ])

      seedRelations([
        { source: atom1Id, target: atom2Id, type: "analyzes" },
        { source: atom2Id, target: atom3Id, type: "validates" },
      ])

      // Detect communities
      const cache = await detectCommunities({ minCommunitySize: 1 })

      expect(cache).toBeDefined()
      expect(cache.version).toBe("1.0")
      expect(Object.keys(cache.communities).length).toBeGreaterThan(0)
      expect(Object.keys(cache.atomToCommunity).length).toBeGreaterThanOrEqual(3)
    },
  })
})

test("queryCommunities - filter by size", async () => {
  await using tmp = await tmpdir({ git: true })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const { research_project_id: rpId } = seedResearchProject()

      // Create multiple atoms with unique IDs
      const prefix = crypto.randomUUID().slice(0, 8)
      const atomIds = [`${prefix}-1`, `${prefix}-2`, `${prefix}-3`, `${prefix}-4`]

      seedAtoms(
        atomIds.map((id, index) => ({
          atom_id: id,
          research_project_id: rpId,
          atom_name: `Test Atom ${index + 1}`,
          atom_type: "hypothesis" as const,
          claim: `Claim for ${id}`,
        })),
      )

      // Create relations to form communities
      seedRelations([
        { source: atomIds[0], target: atomIds[1], type: "derives" },
        { source: atomIds[2], target: atomIds[3], type: "validates" },
      ])

      // Detect communities first
      await detectCommunities({ minCommunitySize: 1 })

      // Query with size filter
      const communities = await queryCommunities({ minSize: 2, topK: 10 })

      expect(communities).toBeDefined()
      expect(Array.isArray(communities)).toBe(true)
      communities.forEach((comm) => {
        expect(comm.size).toBeGreaterThanOrEqual(2)
      })
    },
  })
})

test("getCommunityStats - returns correct statistics", async () => {
  await using tmp = await tmpdir({ git: true })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const { research_project_id: rpId } = seedResearchProject()

      // Create test atoms with unique IDs
      const prefix = crypto.randomUUID().slice(0, 8)
      const atomIds = [`${prefix}-1`, `${prefix}-2`, `${prefix}-3`]

      seedAtoms(
        atomIds.map((id, index) => ({
          atom_id: id,
          research_project_id: rpId,
          atom_name: `Test Atom ${index + 1}`,
          atom_type: "hypothesis" as const,
          claim: `Claim for ${id}`,
        })),
      )

      seedRelations([
        { source: atomIds[0], target: atomIds[1], type: "derives" },
        { source: atomIds[1], target: atomIds[2], type: "validates" },
      ])

      // Detect communities
      await detectCommunities({ minCommunitySize: 1 })

      // Get stats
      const stats = await getCommunityStats()

      expect(stats).toBeDefined()
      expect(stats.totalCommunities).toBeGreaterThan(0)
      expect(stats.totalAtoms).toBeGreaterThanOrEqual(3)
      expect(stats.avgCommunitySize).toBeGreaterThan(0)
      expect(stats.largestCommunity).toBeGreaterThan(0)
      expect(stats.avgDensity).toBeGreaterThanOrEqual(0)
    },
  })
})

test("getAtomCommunity - returns correct community", async () => {
  await using tmp = await tmpdir({ git: true })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const { research_project_id: rpId } = seedResearchProject()
      const atomId = crypto.randomUUID()

      seedAtoms([
        {
          atom_id: atomId,
          research_project_id: rpId,
          atom_name: "Test Atom",
          atom_type: "hypothesis",
          claim: "Test claim",
        },
      ])

      // Detect communities
      await detectCommunities({ minCommunitySize: 1 })

      // Get atom's community
      const community = await getAtomCommunity(atomId)

      expect(community).toBeDefined()
      if (community) {
        expect(community.atomIds).toContain(atomId)
        expect(community.size).toBeGreaterThan(0)
      }
    },
  })
})

test("refreshCommunities - forces cache refresh", async () => {
  await using tmp = await tmpdir({ git: true })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const { research_project_id: rpId } = seedResearchProject()

      const refreshAtomId = crypto.randomUUID()

      seedAtoms([
        {
          atom_id: refreshAtomId,
          research_project_id: rpId,
          atom_name: "Test Atom",
          atom_type: "hypothesis",
          claim: "Test claim",
        },
      ])

      // First detection
      const cache1 = await detectCommunities({ minCommunitySize: 1 })
      const timestamp1 = cache1.lastUpdated

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Refresh
      const cache2 = await refreshCommunities({ minCommunitySize: 1 })
      const timestamp2 = cache2.lastUpdated

      expect(timestamp2).toBeGreaterThan(timestamp1)
    },
  })
})
