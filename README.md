# BaronDesk frontend

Two apps from one codebase, plain 2011-style UI (see `../Frontend Implementation Plan.md`):

| App | Dev URL | Built to | Delivered as |
|---|---|---|---|
| Admin dashboard | http://localhost:5173/admin/ | `dist/admin/` | Electron desktop app (step 10) |
| Gamer portal | http://localhost:5173/portal/ | `dist/portal/` | PWA / home-screen shortcut (step 11) |

## Run

```sh
npm install
cp .env.example .env.local   # mocks on by default; edit to use the real backend
npm run dev                  # http://localhost:5173
```

The dev server proxies backend routes (`/auth`, `/users`, `/employees`, `/health`, `/dashboard-io`) to `VITE_BACKEND_URL` (default `http://localhost:3000`, which `back-end/docker-compose.dev.yml` exposes). Add new backend paths to `BACKEND_PATHS` in `vite.config.ts`.

## Fake data (mocks)

Most backend endpoints don't exist yet, so the app can answer them in the browser (`src/mocks`). Switches in `.env.local`:

| Variable | Meaning |
|---|---|
| `VITE_USE_MOCKS=true` | Every endpoint is answered with fake data. A red **FAKE DATA** tag shows in the top bar |
| `VITE_REAL_PREFIXES=/auth,/users,/employees` | With mocks on, these paths still go to the real backend (e.g. real login, fake stations) |
| `VITE_USE_MOCKS=false` | Everything goes to the real backend |

Restart `npm run dev` after changing them. Reload the page to reset the fake data.

**Seed accounts** (password `password123`):

| Username | Role | Branch | Notes |
|---|---|---|---|
| `hq.admin` | ADMIN (HQ) | all | |
| `manager.tunis` / `manager.sousse` | MANAGER | Tunis Centre / Sousse | |
| `staff.tunis` / `staff.sousse` | EMPLOYEE | Tunis Centre / Sousse | |
| `gamer1` … `gamer5` | GAMER | – | gamer1: Gold (−10 %), gamer2: in a session on TUN-02, gamer3: 10-hour pass |
| `lowbalance` | GAMER | – | 0.400 balance: low-balance warning at once, auto-lock after ~8 min of play |

**What happens on its own:** telemetry every 2 s, session updates every 10 s, SOU-03 goes online/offline every 30 s, a random alert every 45 s, a new station TUN-07 asks to enroll after 60 s. Commands are acked after ~0.5 s (TIMEOUT after 5 s if the station is offline). A shut-down station comes back after 30 s.

**Mixing real and fake:** with `VITE_REAL_PREFIXES=/auth,…`, the mock reads the real JWT's claims (`sub`, `role`, `branchId`) to know who is calling. A branch id it doesn't know is treated as the first seeded branch (Tunis Centre).

## Login

- Admin app: staff roles only (`EMPLOYEE`, `MANAGER`, `ADMIN`). Portal: `GAMER` only. The wrong app refuses the login with a message.
- The access token is kept in memory; the refresh token in `sessionStorage` (one per app). A reload keeps you logged in; closing the tab logs out.
- A `401` triggers one token refresh and a retry. If the refresh fails, the login page says the session expired.
- The menu hides what the role can't use; opening such a page by URL shows **Access denied**. The server's `403` is still the real rule.
- Real backend: its seed account is `hq-admin` / `change-me-immediately` (`back-end/prisma/seed.ts`). Run the seed first if the login is refused.

## Live updates

- After login the admin app connects to `/dashboard-io` (Socket.IO, token in `auth`). The top bar shows **LIVE**, **CONNECTING** or **OFFLINE**.
- When the connection drops, a red bar says so and Socket.IO retries on its own. If the server refuses the token, the app refreshes it once and retries (then every 10 s).
- Screens use `useRealtimeEvent('station_status', …)` to react to events and `useOnReconnect(refetch)` to reload their data after a reconnect.
- With fake data, run `barondesk.simulateDrop(5000)` in the browser console to test the red bar, `barondesk.simulateAlert()` to raise an alert now (random station, any branch), and `barondesk.startSession('lowbalance')` to start a gamer's session (portal).
- `VITE_REAL_PREFIXES=/dashboard-io` uses the real socket while the rest stays fake. It needs a real login token, so add `/auth` too.
- Git Bash rewrites a leading `/` in env values to a Windows path. Put the values in `.env.local`, or prefix the command with `MSYS_NO_PATHCONV=1`.

## HQ (multi-branch)

- HQ (`ADMIN`, `branchId = null`) gets a **Branch** dropdown in the top bar: *All branches* or one branch. Branch admins and staff see their branch name as plain text.
- With a branch picked, every list asks for `?branchId=…` and live events from other branches are ignored, so the pickers only offer that branch's stations and Lock, sessions and bookings land there. Pages reload fresh when the branch changes. The choice survives a reload (per tab).
- **HQ overview** (`#/hq`, HQ's start page): stations, online, offline, in session and open alerts per branch from `GET /branches/summary`, refreshed on live events. The buttons pick the branch and open its Stations, Alerts or Sessions.
- Code: `src/admin/branch/BranchContext.tsx` (`useBranchScope()`: `scoped(path)`, `inScope(branchId)`), `src/admin/hq/HqPage.tsx`.

## Gamer portal

- One narrow column (max 480 px, checked at 360 px with no sideways scroll). Pages: **Free stations**, **Book a station** (+ my bookings, cancel), **My wallet** (online top-up, history), **My session**, **My profile**. The home page shows the balance and a link to the running session.
- **My session** shows time played, cost so far, balance left and time left, all from the server (`GET /me/session` + `session_update`). The browser only moves the clock. A red **Low balance** box appears when the server marks the session `WARNED`. Ending it shows the bill.
- Live updates: the portal uses the same socket, but only reads `session_update` events for the logged-in gamer. The real gateway puts gamers in `branch:all` today (see the brief, §13), so the client filter is only a stopgap. The page also refreshes every 30 s in case live updates don't reach the phone.
- Free stations refresh every 20 s (gamers get no station events). Money forms send an `idempotencyKey`.
- Try it with fake data: `gamer1` (Gold member) for booking and top-up; `gamer2` is already playing on TUN-02. For the low-balance warning, log in as `lowbalance`, run `barondesk.startSession('lowbalance')` in the browser console, and open **My session** (the warning shows within 10 s; the station locks after ~8 min). Each tab has its own fake data, so a session started in the admin tab doesn't reach the portal tab.

## Build and test

```sh
npm run build      # typecheck + vite build → dist/
npm run typecheck
npm test           # mock backend rules (auth, branch scope, commands, billing…)
```

## Layout

```text
admin/index.html     admin entry
portal/index.html    portal entry
src/admin/           admin layout, menu, pages
src/portal/          portal layout, menu, pages
src/api/             types + api() (real fetch or mock)
src/mocks/           fake backend: seed db, handlers, timers, fake /dashboard-io
src/realtime/        RealtimeSource interface (Socket.IO client comes in step 4)
src/shared/          code used by both apps
src/styles/classic.css   the whole theme (black / white / gold / red)
```

Routing uses hash URLs (`/admin/#/stations`), so no server rewrite rules are needed in Caddy or Electron.
