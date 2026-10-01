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

The dev server forwards every backend path (`/auth`, `/users`, `/gamers`, `/employees`, `/health`, `/api`, `/machines`, `/branches`, `/wallets`, `/membership-plans`, `/memberships`, `/subscription-plans`, `/subscriptions`, `/reservations`, `/sessions`, and the `/dashboard-io` socket) to `VITE_BACKEND_URL`. A new backend module needs a line in `BACKEND_PATHS` in `vite.config.ts`.

The backend runs on the same PC: start it in `back-end/` with `npm run docker:dev` (Nest on `http://localhost:3000`, the default `VITE_BACKEND_URL`). Restart `npm run dev` after changing `.env.local`.

The screens below need the backend's flow-fix migrations: in `back-end/`, `npm run db:deploy` then `npm run db:generate` (see `back-end/docs/FLOW_FIXES.md` §0, which also lists every endpoint and error code).

## Accounts (backend seed)

`back-end/prisma/seed.ts` (run it once: `npm run dc -- run --rm migrate npx prisma db seed` in `back-end/`).

| Username | Role | Branch | Notes |
|---|---|---|---|
| `hq-admin` / `change-me-immediately` | ADMIN (HQ) | all | |
| `manager.manar`, `manager.lac2` | MANAGER | CENTRE El Manar / CENTRE Lac 2 | password `password123` |
| `employee.manar1`, `employee.manar2`, `employee.lac2.1`, `employee.lac2.2` | EMPLOYEE | El Manar / Lac 2 | password `password123` |
| `gamer.newbie`, `gamer.regular`, `gamer.wood`, `gamer.iron`, `gamer.silver`, `gamer.gold`, `gamer.diamond`, `gamer.master`, `gamer.grandmaster`, `gamer.midswitch` | GAMER | none yet: the portal asks them to pick one at first login | password `password123`; plans and balances per the seed's header comment |

The seed also creates 5 enrolled PCs per branch (`MNR-PC-01…05`, `LAC-PC-01…05`), prices (El Manar 4.000 DT/h, Lac 2 4.500 / 5.000 DT/h), the Pro/Elite tiers, two passes and 7 games. Seeded PCs show as online in the database but are only really online when an agent with that serial is connected.

## Screens and their endpoints

Every screen reads and writes the real backend. The last column says what each screen does beyond the obvious, and where it polls because the backend sends no event.

| Screen | Backend | Notes |
|---|---|---|
| Login, access control | `/auth/*` | |
| HQ overview, branch dropdown | `GET/POST/PATCH /branches`, `/machines`, `/api/v1/stations`, `/api/v1/alerts` | Real branch names; HQ creates and edits branches (name, location) on the overview. The counts are computed |
| Stations, station detail, telemetry | `/api/v1/stations…` joined with `/machines`, `peripheral_status` | Only enrolled PCs, each with its branch. The detail page has the **booking link** for gamers, **Rename** (branch admin and HQ, `PATCH /api/v1/stations/:id`; the PC's own name no longer overrides it) and the **peripherals** the station watches (disconnected first, live). Telemetry: now, plus min / avg / max over the last 1, 6, 24 or 48 hours (`…/telemetry/history`, one sample a minute; live readings join it once a minute) |
| Remote commands | `/api/v1/stations/:id/commands`, `command_update` | **Unlock** only resumes the gamer's session on that PC: with none, or when their money ran out, the page says what to do (`NO_SESSION_TO_UNLOCK`, `INSUFFICIENT_FUNDS` → top up first). **Shut down** (branch admin and HQ) bills a running session up to now, and its confirmation says so |
| Alerts | `/api/v1/alerts…`, `alert`, `alert_resolved` | |
| Games | `/api/v1/games…`, `catalog_status` | |
| New stations (enrollment) | `/machines…` | Polled every 15 s (no event for a new request) |
| Sessions | `GET /sessions`, `GET /sessions/:id`, `POST /sessions/:id/end`, `session_runout_warning` | Gamers start their own sessions (PIN in the app). "Running now" = stations reporting a session (live). Below, the sessions played since a day, by status, with gamer and bill (HQ: the branch in the top bar); reloaded when a station's status changes |
| Session and bill | `GET /sessions/:id` | Read again every 5 s until the bill is settled |
| Bookings | `GET /api/v1/reservations`, `DELETE /api/v1/reservations/:id` | Who booked which station, for one day or 7 days, by status (HQ: the branch in the top bar). **Cancel** a booking nobody plays on yet (its PIN stops working). Polled every 30 s (no event for a new booking) |
| Wallet (desk) | `GET /gamers?q=`, `/wallets/:gamerProfileId…` | Find the gamer by **username** (an exact name opens at once, else pick from the matches; recent gamers are remembered per browser); idempotent top-up and refund (refund: branch admin and HQ) |
| Users & Staff | `GET /users`, `POST /users`, `POST /employees`, `PATCH /users/:id/role`, `PATCH /users/:id/status`, `POST /users/:id/password` | List and search by username and role (HQ: everyone, or the branch picked in the top bar; a branch admin: gamers and their own staff). A new gamer needs a home branch. Suspend / Reactivate and Reset password show only where the server allows them (`src/admin/users/permissions.ts`) |
| Plans & prices | `/branches/:id/pricing`, `/membership-plans`, `/subscription-plans` | Create, edit, delete tiers and passes |
| Portal: sign-up, settings | `GET /branches`, `POST /users`, `PATCH /users/me/branch`, `POST /auth/change-password` | Sign-up picks the **home branch**; Settings changes it and the password. A gamer with no branch (e.g. seeded) is asked to pick one after login |
| Portal: book, play now, my bookings | `GET /branches/:id/stations`, `/reservations`, `/reservations/walk-in`, `/reservations/:id/check-in` | Lists the home branch's stations, free or busy until when; the desk's booking link (QR) preselects a PC. The wallet must cover the whole booking (`INSUFFICIENT_FUNDS`). Every booking and Play now answers with its **PIN**, shown on the booking: it works on that PC from the start for 30 minutes, then the booking is *Missed* (no-show). *New PIN* replaces it. Cancel until someone logs in |
| Portal: my session | `GET /sessions/me/current`, `/reservations/:id/extend-options`, `POST /reservations/:id/extend`, `session_notice` | Time played, cost so far, balance, end time; re-read every 15 s, the station's notices (low balance, time left) arrive live. **Extend** by 30 / 60 / 90 minutes near the end, if the PC is free and the wallet covers it (walk-in rate) |
| Portal: wallet | `/wallets/me…` | No self top-up on the backend: shows the username to give the desk |
| Portal: profile & plans | `/memberships/me`, `/subscriptions/me`, `…/purchase`, `POST /memberships/me/cancel` | Paid from the wallet, idempotent. A dearer tier is an **Upgrade** (pay the difference, prorated); **Cancel** ends the tier, no refund |

**Money:** the backend stores every amount as integer **millimes** (1 DT = 1000); plan prices are the exception (decimal dinars). Screens convert with `formatMillimes` / `dinarsToMillimes` in `src/shared/format.ts` and show the server's numbers only.

### The desk and the gamer app

The desk finds a gamer by **username**:

| What | Where the gamer finds it | What the desk does with it |
|---|---|---|
| Username | App → Wallet ("give them your username") | Wallet → Find → top up, refund |

And one the other way: each station's **booking link** (Stations → a station → Copy the gamers' booking link; print it as a QR code on the PC) opens the app's booking page with that PC picked. The session PIN never goes through the desk: the gamer gets it in the app with the booking (or Play now), sees it again on the booking, and types it on the PC's lock screen once the booking has started.

### Demo walkthrough (the ten Phase 1 features)

Seed first (`back-end/`), start at least one real agent (Play now needs the PC ONLINE; a booking for later doesn't), top up the gamer at the desk, and open the admin app and the portal side by side.

| # | Feature | In the apps |
|---|---|---|
| F1 | Secure Access & Roles | Log in as `employee.manar1`: staff menu only, **Plans** says Access denied. A wrong password is refused. Users & Staff: HQ creates a manager; `manager.manar` can only create employees of their own branch (the server refuses more with 403), suspends one of them (that login now fails with `ACCOUNT_DISABLED`), reactivates them and resets their password |
| F2 | Node Tracking | New stations → generate an enrollment token → the agent asks to join → Approve → it turns ONLINE on Stations. Pull the cable: OFFLINE, then back |
| F3 | Session & Financial Control | Gamer picks Play now (app) → the PIN shows at once → the desk sees it on **Bookings** → the gamer types it on the lock screen → the PC unlocks; My session shows the cost so far. Sessions → End & bill → the bill; the wallet shows the play-time charge. Low balance: the warning (PC corner box and app), then the PC locks; Unlock at the desk then needs a top-up first |
| F4 | Remote Administration | Station detail → Lock / Unlock / Shut down; the command log goes PENDING → SENT → ACKED. Unlock on a PC nobody plays on is refused with an explanation |
| F5 | Telemetry & Anti-Theft | Station detail → live temperatures, load, fans; unplug a USB mouse → red alert banner → Resolve |
| F6 | Electronic Wallet | Wallet → gamer username → Find → top up (double click: one credit) → history; refund a line (branch admin) |
| F7 | Subscription & Membership | Plans → tiers and passes; the gamer buys Pro in the app → My profile shows it; the session rate includes the discount. Upgrade to Elite (pays the difference), then Cancel |
| F8 | Advance Reservation | App → Book for later / Play now; the same slot twice → refused (`RESERVATION_SLOT_TAKEN`); more than the wallet covers → refused; cancel before anyone logs in. Nobody logs in within 30 minutes of the start → *Missed*, the PC is free again. Near the end of a session: Extend |
| F9 | Multi-Agency | HQ overview: both branches; pick one in the top bar and lock a PC there; a branch admin sees only theirs |
| F10 | Game Catalog | Games → offer at a branch or a station → install status per PC → Launch game on a station in session |

### Backend limits you will see

- **Play now needs the PC online** (`MACHINE_UNAVAILABLE`); a booking for later doesn't.
- No live session or booking event for staff: the Sessions list reloads on station status changes, Bookings every 30 s. The portal's My session re-reads every 15 s; only its notices are live.
- A gamer can't end their own session from the PC; the desk ends it (or it ends at the booking's end).

**Adding a real PC:** on **New stations**, pick its branch and generate an enrollment token; on the PC run `BaronDeskAgent.ServiceCore.exe --set-enrollment-token` (admin PowerShell), paste the token and start the agent; approve its request when it shows up. The backend team's manual route is in `back-end/docs/STATION_PHYSICAL_TEST.md` §0 and `back-end/docs/STATION_AGENT.md` §11.

## Login

- Admin app: staff roles only (`EMPLOYEE`, `MANAGER`, `ADMIN`). Portal: `GAMER` only. The wrong app refuses the login with a message.
- The access token is kept in memory; the refresh token in `sessionStorage` (one per app). A reload keeps you logged in; closing the tab logs out.
- A `401` triggers one token refresh and a retry. If the refresh fails, the login page says the session expired.
- The menu hides what the role can't use; opening such a page by URL shows **Access denied**. The server's `403` is still the real rule.
- **Own password:** admin top bar → **Password** (`#/account`), portal → Settings. Both use `src/shared/ChangePasswordForm.tsx` (`POST /auth/change-password`): every other login of the account ends, this tab stays logged in with the new tokens. A lost password is reset by a branch admin or HQ on Users & Staff.

## Live updates

- After login both apps connect to `/dashboard-io` (Socket.IO, token in `auth`). The admin top bar shows **LIVE**, **CONNECTING** or **OFFLINE**.
- Staff join their branch's room (HQ: every branch); a gamer only their own, so the portal never sees stations, alerts or other gamers.
- When the connection drops, a red bar says so and Socket.IO retries on its own. If the server refuses the token, the app refreshes it once and retries (then every 10 s).
- Screens use `useRealtimeEvent('station_status', …)` to react to events and `useOnReconnect(refetch)` to reload their data after a reconnect.
- Events to staff: `station_status`, `telemetry_update`, `command_update`, `alert`, `alert_resolved`, `catalog_status`, `peripheral_status`, `session_runout_warning`. To the gamer: `session_notice` (`LOW_BALANCE`, `TIME_LEFT`, `CLEAR`). There is no session, booking or wallet event: those pages re-read the server.

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
npm test           # unit tests (money, branches, bookings, plan and ledger wording, Users page permissions, wallet search, booking dates, peripherals, telemetry history, command wording)
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
