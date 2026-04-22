# @palimpsest/web

SolidJS workbench for Palimpsest.

## Common Commands

```bash
bun dev
bun run build
bun run typecheck
bun run test:unit
bun run test:e2e:local
```

## Responsibility

- project workbench tabs and object workspaces
- proposal review, commit timeline, and decision provenance UI
- plugin-owned pages from builtin plugins such as `research` and `security-audit`
- contextual tooling such as files, terminal, and session overview

## Notes

- unit tests run with `happy-dom`
- Playwright e2e tests expect a Palimpsest backend, defaulting to `localhost:4096`
- use the root `specs/` docs as the architectural source of truth
