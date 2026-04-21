# Palimpsest Dev Launch

Server:

```bash
cd /home/cheyanne/Palimpsest/apps/server
bun run --conditions=browser ./src/index.ts serve --port 4096
```

Web app:

```bash
cd /home/cheyanne/Palimpsest/apps/web
bun dev -- --port 4444
```

After launch:

- API: `http://localhost:4096`
- UI: `http://localhost:4444`
