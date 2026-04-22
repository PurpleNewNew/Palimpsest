# @palimpsest/server

Linux-server-first runtime for Palimpsest.

## Common Commands

```bash
bun run test
bun run typecheck
bun run build
bun run --conditions=browser ./src/index.ts serve --port 4096
```

## Responsibility

- domain routes and proposal-first write paths
- control plane, workspace collaboration, and public share routes
- plugin host registration and builtin plugin server hooks
- auth, provider, tool, and session orchestration

Use the root `specs/` docs as the architectural source of truth.
