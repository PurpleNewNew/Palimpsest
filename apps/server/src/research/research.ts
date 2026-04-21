/**
 * Host-side re-export shim. Source of truth:
 * plugins/research/server/research.ts
 *
 * See the accompanying apps/server/src/research/research-plugin-bind.ts
 * for the bind-on-first-import fallback that keeps tests that go
 * straight to `@/research/research` working without booting a full
 * instance.
 */
import "./research-plugin-bind"

export { Research } from "@palimpsest/plugin-research/server/research"
