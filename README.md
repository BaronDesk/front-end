# BaronDesk frontend

Two apps from one codebase, plain 2011-style UI (see `../Frontend Implementation Plan.md`). Both talk to the real backend only: there is no fake data.

| App | Dev URL | Built to | Delivered as |
|---|---|---|---|
| Admin dashboard | http://localhost:5173/admin/ | `dist/admin/` | Electron desktop app (step 10) |
| Gamer portal | http://localhost:5173/portal/ | `dist/portal/` | PWA / home-screen shortcut (step 11) |

## Run

```sh
npm install
cp .env.example .env.local   # then set VITE_BACKEND_URL
npm run dev                  # http://localhost:5173
```

The dev server forwards every backend path (`/auth`, `/users`, `/employees`, `/health`, `/api`, `/machines`, `/branches`, `/wallets`, `/membership-plans`, `/memberships`, `/subscription-plans`, `/subscriptions`, `/reservations`, `/sessions`, and the `/dashboard-io` socket) to `VITE_BACKEND_URL`. A new backend module needs a line in `BACKEND_PATHS` in `vite.config.ts`.

The backend runs on the same PC: start it in `back-end/` with `npm run docker:dev` (Nest on `http://localhost:3000`, the default `VITE_BACKEND_URL`). Restart `npm run dev` after changing `.env.local`.

## Accounts (backend seed)

`back-end/prisma/seed.ts` (run it once: `npm run dc -- run --rm migrate npx prisma db seed` in `back-end/`).

| Username | Role | Branch | Notes |
|---|---|---|---|
| `hq-admin` / `change-me-immediately` | ADMIN (HQ) | all | |
| `manager.manar`, `manager.lac2` | MANAGER | CENTRE El Manar / CENTRE Lac 2 | password `password123` |
| `employee.manar1`, `employee.manar2`, `employee.lac2.1`, `employee.lac2.2` | EMPLOYEE | El Manar / Lac 2 | password `password123` |
| `gamer.newbie`, `gamer.regular`, `gamer.wood`, `gamer.iron`, `gamer.silver`, `gamer.gold`, `gamer.diamond`, `gamer.master`, `gamer.grandmaster`, `gamer.midswitch` | GAMER | – | password `password123`; plans and balances per the seed's header comment |

The seed also creates 5 enrolled PCs per branch (`MNR-PC-01…05`, `LAC-PC-01…05`), prices (El Manar 4.000 DT/h, Lac 2 4.500 / 5.000 DT/h), the Pro/Elite tiers, two passes and 7 games. Seeded PCs show as online in the database but are only really online when an agent with that serial is connected.

## Screens and their endpoints

Every screen reads and writes the real backend. Where the backend has no endpoint for something, the screen works around it as described in the last column.

| Screen | Backend | Notes |
|---|---|---|
| Login, access control | `/auth/*` | |
| HQ overview, branch dropdown | `GET/POST/PATCH /branches`, `/machines`, `/api/v1/stations`, `/api/v1/alerts` | Real branch names; HQ creates and edits branches (name, location) on the overview. The counts are computed |
| Stations, station detail, telemetry | `/api/v1/stations…` joined with `/machines`, `peripheral_status` | Only enrolled PCs, each with its branch. The detail page has the **booking link** for gamers and the **peripherals** the station watches (disconnected first, live). Telemetry: now, plus min / avg / max over the last 1, 6, 24 or 48 hours (`…/telemetry/history`, one sample a minute; live readings join it once a minute) |
| Remote commands | `/api/v1/stations/:id/commands`, `command_update` | |
| Alerts | `/api/v1/alerts…`, `alert`, `alert_resolved` | |
| Games | `/api/v1/games…`, `catalog_status` | |
| New stations (enrollment) | `/machines…` | Polled every 15 s (no event for a new request) |
| Sessions | `GET /sessions`, `GET /sessions/:id`, `POST /sessions/:id/end`, `session_runout_warning` | Gamers start their own sessions (PIN in the app). "Running now" = stations reporting a session (live). Below, the sessions played since a day, by status, with gamer and bill (HQ: the branch in the top bar); reloaded when a station's status changes |
| Session and bill | `GET /sessions/:id` | Read again every 5 s until the bill is settled |
| Bookings | `GET /api/v1/reservations`, `DELETE /api/v1/reservations/:id` | Who booked which station, for one day or 7 days, by status (HQ: the branch in the top bar). **Cancel** a booking nobody plays on yet (its PIN stops working). Polled every 30 s (no event for a new booking) |
| Wallet (desk) | `GET /gamers?q=`, `/wallets/:gamerProfileId…` | Find the gamer by **username** (an exact name opens at once, else pick from the matches; recent gamers are remembered per browser); idempotent top-up and refund (refund: branch admin and HQ) |
| Users & Staff | `GET /users`, `POST /users`, `POST /employees`, `PATCH /users/:id/role`, `PATCH /users/:id/status`, `POST /users/:id/password` | List and search by username and role (HQ: everyone, or the branch picked in the top bar; a branch admin: gamers and their own staff). A new gamer needs a home branch. Suspend / Reactivate and Reset password show only where the server allows them (`src/admin/users/permissions.ts`) |
| Plans & prices | `/branches/:id/pricing`, `/membership-plans`, `/subscription-plans` | Create, edit, delete tiers and passes |
| Portal: book, play now, my bookings | `/reservations`, `/reservations/walk-in`, `/reservations/:id/check-in` | Gamers can't list stations: the station comes from the desk's booking link or an earlier booking. Play now answers with the **PIN**; a booking gets it with *Get PIN* from 15 min before |
| Portal: my session | `/reservations`, `/wallets/me…`, `session_runout_warning` | |
| Portal: wallet | `/wallets/me…` | No self top-up on the backend: shows the username to give the desk |
| Portal: profile & plans | `/memberships/me`, `/subscriptions/me`, `…/purchase` | Paid from the wallet, idempotent |

**Money:** the backend stores every amount as integer **millimes** (1 DT = 1000); plan prices are the exception (decimal dinars). Screens convert with `formatMillimes` / `dinarsToMillimes` in `src/shared/format.ts` and show the server's numbers only.

### The desk and the gamer app

The desk finds a gamer by **username**:

| What | Where the gamer finds it | What the desk does with it |
|---|---|---|
| Username | App → Wallet ("give them your username") | Wallet → Find → top up, refund |

And one the other way: each station's **booking link** (Stations → a station → Copy the gamers' booking link; print it as a QR code on the PC) opens the app's booking page for that PC. The session PIN never goes through the desk: the gamer gets it in the app (Play now, or *Get PIN* on a booking) and types it on the PC's lock screen.

### Demo walkthrough (the ten Phase 1 features)

Seed first (`back-end/`), start at least one real agent (it must be ONLINE: the backend refuses bookings on an offline PC), and open the admin app and the portal side by side.

| # | Feature | In the apps |
|---|---|---|
| F1 | Secure Access & Roles | Log in as `employee.manar1`: staff menu only, **Plans** says Access denied. A wrong password is refused. Users & Staff: HQ creates a manager; `manager.manar` can only create employees of their own branch (the server refuses more with 403), suspends one of them (that login now fails with `ACCOUNT_DISABLED`), reactivates them and resets their password |
| F2 | Node Tracking | New stations → generate an enrollment token → the agent asks to join → Approve → it turns ONLINE on Stations. Pull the cable: OFFLINE, then back |
| F3 | Session & Financial Control | Gamer books or picks Play now (app) → the desk sees it on **Bookings** → gets the PIN in the app → types it on the lock screen → the PC unlocks. Sessions → End & bill → the bill; the wallet shows the play-time charge. Low balance: the runout warning, then the PC locks |
| F4 | Remote Administration | Station detail → Lock / Unlock / Shut down; the command log goes PENDING → SENT → ACKED |
| F5 | Telemetry & Anti-Theft | Station detail → live temperatures, load, fans; unplug a USB mouse → red alert banner → Resolve |
| F6 | Electronic Wallet | Wallet → gamer username → Find → top up (double click: one credit) → history; refund a line (branch admin) |
| F7 | Subscription & Membership | Plans → tiers and passes; the gamer buys Pro in the app → My profile shows it; the session rate includes the discount |
| F8 | Advance Reservation | App → Book for later / Play now; the same slot twice → refused (`RESERVATION_SLOT_TAKEN`); cancel before it starts |
| F9 | Multi-Agency | HQ overview: both branches; pick one in the top bar and lock a PC there; a branch admin sees only theirs |
| F10 | Game Catalog | Games → offer at a branch or a station → install status per PC → Launch game on a station in session |

### Backend limits you will see

- **Plan purchases debit 10× too little** (`plan.price × 100` instead of `× 1000` millimes): buying Pro (15 DT) takes 1.500 DT. Backend fix needed.
- **Booking needs the PC online now**, even for a slot tomorrow (`MACHINE_UNAVAILABLE`).
- No live session event: the Sessions list reloads on station status changes instead. Details: `../Frontend Implementation Plan.md` §6.

**Adding a real PC:** on **New stations**, pick its branch and generate an enrollment token; on the PC run `BaronDeskAgent.ServiceCore.exe --set-enrollment-token` (admin PowerShell), paste the token and start the agent; approve its request when it shows up. The backend team's manual route is in `back-end/docs/STATION_PHYSICAL_TEST.md` §0 and `back-end/docs/STATION_AGENT.md` §11.

## Login

- Admin app: staff roles only (`EMPLOYEE`, `MANAGER`, `ADMIN`). Portal: `GAMER` only. The wrong app refuses the login with a message.
- The access token is kept in memory; the refresh token in `sessionStorage` (one per app). A reload keeps you logged in; closing the tab logs out.
- A `401` triggers one token refresh and a retry. If the refresh fails, the login page says the session expired.
- The menu hides what the role can't use; opening such a page by URL shows **Access denied**. The server's `403` is still the real rule.

## Live updates

- After login the admin app connects to `/dashboard-io` (Socket.IO, token in `auth`). The top bar shows **LIVE**, **CONNECTING** or **OFFLINE**.
- When the connection drops, a red bar says so and Socket.IO retries on its own. If the server refuses the token, the app refreshes it once and retries (then every 10 s).
- Screens use `useRealtimeEvent('station_status', …)` to react to events and `useOnReconnect(refetch)` to reload their data after a reconnect.
- Events the backend sends: `station_status`, `telemetry_update`, `command_update`, `alert`, `alert_resolved`, `catalog_status`, `session_runout_warning`, `peripheral_status`. There is no session or wallet event: those pages re-read the server every few seconds.

## HQ (multi-branch)

- HQ (`ADMIN`, `branchId = null`) gets a **Branch** dropdown in the top bar: *All branches* or one branch. Branch admins and staff see their branch name as plain text.
- With a branch picked, lists ask for `?branchId=…` and live events from other branches are ignored, so actions run on the selected branch. The choice survives a reload (per tab).
- **HQ overview** (`#/hq`, HQ's start page): stations, online, in session and open alerts per branch, computed from the machines, the stations and the open alerts.
- **Branches:** below the table, HQ creates a branch (name, location) with `POST /branches`; **Edit** on a row renames or moves it with `PATCH /branches/:id`. A new branch then needs its PCs (New stations) and its prices (Plans & prices).
- Code: `src/admin/branch/BranchContext.tsx` (`useBranchScope()`: `scoped(path)`, `inScope(branchId)`), `src/admin/hq/HqPage.tsx`.

## Build and test

```sh
npm run build      # typecheck + vite build → dist/
npm run typecheck
npm test           # unit tests (money, branches, bookings, plan and ledger wording, Users page permissions, wallet search, booking dates, peripherals, telemetry history)
```

## Layout

```text
admin/index.html     admin entry
portal/index.html    portal entry
src/admin/           admin layout, menu, pages
src/portal/          portal layout, menu, pages
src/api/             backend types + api() (fetch with token refresh)
src/realtime/        live updates: Socket.IO client for /dashboard-io
src/shared/          code used by both apps
src/styles/classic.css   the whole theme (black / white / gold / red)
```

Routing uses hash URLs (`/admin/#/stations`), so no server rewrite rules are needed in Caddy or Electron.
