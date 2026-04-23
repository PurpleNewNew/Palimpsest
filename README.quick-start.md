# Palimpsest Local Development

The source of truth for scope and architecture is [`specs/`](./specs):

- [`specs/product.md`](./specs/product.md)
- [`specs/domain.md`](./specs/domain.md)
- [`specs/plugin.md`](./specs/plugin.md)
- [`specs/ui.md`](./specs/ui.md)
- [`specs/graph-workbench-pattern.md`](./specs/graph-workbench-pattern.md)

## Current Runtime Shape

- `apps/server` for the server
- `apps/web` for the web app
- `packages/domain` for the domain spine
- `plugins/{core,research,security-audit}` for builtin plugins

## Start The Server

```bash
cd apps/server
bun run --conditions=browser ./src/index.ts serve --port 4096
```

## Start The Web App

```bash
cd apps/web
bun dev -- --port 4444
```

## Open The App

- API: `http://localhost:4096`
- UI: `http://localhost:4444`

## Validation

Do not run tests from repo root. Use package directories instead.

```bash
bun run typecheck
cd apps/web && bun run test:unit
cd apps/server && bun run test
```

## Guardrails

When making changes, keep these rules in front:

1. do not reintroduce desktop, TUI, enterprise, or IDE-extension product assumptions
2. do not rebuild research as the core world model
3. do not bypass `proposal -> review -> commit` as the intended write path
4. do not treat legacy `opencode` naming as product truth

For rationale and archive material, use the historical docs in `specs/` only
after the current architecture guides above.
