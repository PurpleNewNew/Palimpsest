# Palimpsest Local Development

This repository is currently in rebuild mode.

The correct source of truth for scope and architecture is [`specs/`](./specs), not the legacy OpenResearch/OpenCode docs that existed before the rollback recovery.

## Current Runtime Shape

Until the package rename is complete, the active local runtime still uses:

- `packages/opencode` for the server
- `packages/app` for the web app

Those names are temporary implementation debt.

## Start The Server

```bash
cd packages/opencode
bun run --conditions=browser ./src/index.ts serve --port 4096
```

## Start The Web App

```bash
cd packages/app
bun dev -- --port 4444
```

## Open The App

- API: `http://localhost:4096`
- UI: `http://localhost:4444`

## Rebuild Guardrails

When making changes, follow these rules first:

1. do not reintroduce desktop, TUI, enterprise, or IDE-extension product assumptions
2. do not rebuild research as the core world model
3. do not bypass `proposal -> review -> commit` as the intended write path
4. do not treat legacy `opencode` naming as product truth

For the detailed plan, use:

- [`specs/rebuild-roadmap.md`](./specs/rebuild-roadmap.md)
- [`specs/deopencode-cleanup.md`](./specs/deopencode-cleanup.md)
- [`specs/cleanup-checklist.md`](./specs/cleanup-checklist.md)
