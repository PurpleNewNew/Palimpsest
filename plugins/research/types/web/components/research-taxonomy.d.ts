import type { Taxonomy } from "@palimpsest/plugin-sdk/web/graph-workbench";
/**
 * Research lens taxonomy. The shape and colour vocabulary derive from
 * the OpenResearch V1.2 baseline (worktree `Palimpsest-baseline-053a2d39`,
 * tag V1.2, commit 053a2d3) graph view, but the node kinds and status
 * states have been de-ML'd into a generic research vocabulary in
 * Step 11 (B2). Edge kinds are unchanged.
 *
 * Node kinds: question / hypothesis / claim / finding / source.
 * Status states are generic: pending / in_progress / supported / refuted.
 * Both stroke (`color`) and chip background (`bg`) colors are kept so
 * the default tooltip renders status as a coloured chip like baseline.
 */
export declare const RESEARCH_TAXONOMY: Taxonomy;
