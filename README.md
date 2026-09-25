# BaronDesk frontend

Two apps from one codebase, plain 2011-style UI (see `../Frontend Implementation Plan.md`):

| App | Dev URL | Built to | Delivered as |
|---|---|---|---|
| Admin dashboard | http://localhost:5173/admin/ | `dist/admin/` | Electron desktop app (step 10) |
| Gamer portal | http://localhost:5173/portal/ | `dist/portal/` | PWA / home-screen shortcut (step 11) |

## Run

```sh
npm install
cp .env.example .env.local   # optional: change VITE_BACKEND_URL
npm run dev                  # http://localhost:5173
```

The dev server proxies backend routes (`/auth`, `/users`, `/employees`, `/health`, `/dashboard-io`) to `VITE_BACKEND_URL` (default `http://localhost:3000`, which `back-end/docker-compose.dev.yml` exposes). Add new backend paths to `BACKEND_PATHS` in `vite.config.ts`.

## Build

```sh
npm run build      # typecheck + vite build → dist/
npm run typecheck
```

## Layout

```text
admin/index.html     admin entry
portal/index.html    portal entry
src/admin/           admin layout, menu, pages
src/portal/          portal layout, menu, pages
src/shared/          code used by both apps
src/styles/classic.css   the whole theme (black / white / gold / red)
```

Routing uses hash URLs (`/admin/#/stations`), so no server rewrite rules are needed in Caddy or Electron.
