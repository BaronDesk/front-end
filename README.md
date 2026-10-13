# BaronDesk Frontend

The BaronDesk frontend holds the two web applications of the BaronDesk gaming-centre platform, built from one codebase:

- the **admin dashboard**, used by staff, branch admins and headquarters (HQ) to run the venue: stations, sessions, bookings, wallets, users, plans, games and alerts;
- the **gamer portal**, used by gamers on their phone to book a station, get the PIN that unlocks it, follow their session and manage their wallet and membership.

Both applications talk only to the real BaronDesk backend; there is no fake or demo data in the code. The interface is deliberately classic and dense (a black, white, gold and red desktop-style theme), so that desk staff see a lot at once.

| App | Dev URL | Built to | Used on |
|---|---|---|---|
| Admin dashboard | http://localhost:5173/admin/ | `dist/admin/` | The venue's desk PC (browser or a desktop shell such as Electron) |
| Gamer portal | http://localhost:5173/portal/ | `dist/portal/` | The gamer's phone browser |

---

## Features

| Area | Admin dashboard | Gamer portal |
|---|---|---|
| Access | Role-based menus for staff, branch admins and HQ | Sign-up with a home branch, login, settings |
| Stations | Live status, telemetry, peripherals, remote commands (lock, unlock, launch game, shut down), enrollment of new PCs | Free/busy view of the home branch's stations |
| Sessions and bookings | Running sessions, session history with bills, bookings with cancellation | Book ahead or play now, PIN for the station, live session view with extension |
| Money | Desk top-up and refund by username | Wallet balance and history |
| Plans | Membership tiers, passes and the play prices (one price list for every branch), each tier and pass with its badge; gamer ranks (XP thresholds, badges) | Buy, upgrade or cancel a membership; buy a pass; profile picture |
| Games and alerts | Game catalog per branch and station, with game images; hardware and anti-theft alerts | — |
| Multi-branch | HQ overview of every branch, branch switcher, branch creation, audit log of sensitive actions | — |

---

## Technology

| Area | Choice |
|---|---|
| UI | React 19, TypeScript 5.8 (strict) |
| Build and dev server | Vite 6 (multi-page build: `admin/` and `portal/`) |
| Routing | React Router 7 with hash URLs |
| Live updates | Socket.IO client (`/dashboard-io`) |
| Tests | Vitest |

---

## Security Model

- **The server decides.** Menus and buttons follow the user's role, but every rule is enforced by the backend; a refused action shows the server's message.
- **Tokens:** the access token is kept in memory only; the refresh token is kept in `sessionStorage`, one per app, so closing the tab logs out.
- **One app per audience:** the admin dashboard refuses gamer accounts, and the portal refuses staff accounts.
- **Branch isolation:** staff only ever receive their own branch's live events; a gamer receives only their own.

## Run

```sh
npm install
cp .env.example .env.local   # then set VITE_BACKEND_URL
npm run dev                  # http://localhost:5173
```

The dev server forwards every backend path (`/auth`, `/users`, `/gamers`, `/employees`, `/health`, `/api`, `/machines`, `/branches`, `/wallets`, `/membership-plans`, `/memberships`, `/subscription-plans`, `/subscriptions`, `/reservations`, `/sessions`, `/audit-logs`, and the `/dashboard-io` socket) to `VITE_BACKEND_URL`. A new backend module needs a line in `BACKEND_PATHS` in `vite.config.ts`.

The backend runs on the same PC: start it in `back-end/` with `npm run docker:dev` (Nest on `http://localhost:3000`, the default `VITE_BACKEND_URL`). Restart `npm run dev` after changing `.env.local`.

The backend's database must be up to date: in `back-end/`, run `npm run db:deploy`, then `npm run db:generate`. The backend's `docs/FLOW_FIXES.md` lists every endpoint and error code these screens use.

## Accounts (backend seed)

`back-end/prisma/seed.ts` (run it once: `npm run dc -- run --rm migrate npx prisma db seed` in `back-end/`).

| Username | Role | Branch | Notes |
|---|---|---|---|
| `hq-admin` / `change-me-immediately` | ADMIN (HQ) | all | |
| `manager.manar`, `manager.lac2` | MANAGER | CENTRE El Manar / CENTRE Lac 2 | password `password123` |
| `employee.manar1`, `employee.manar2`, `employee.lac2.1`, `employee.lac2.2` | EMPLOYEE | El Manar / Lac 2 | password `password123` |
| `gamer.newbie`, `gamer.regular`, `gamer.wood`, `gamer.iron`, `gamer.silver`, `gamer.gold`, `gamer.diamond`, `gamer.master`, `gamer.grandmaster`, `gamer.midswitch` | GAMER | none yet: the portal asks them to pick one at first login | password `password123`; plans and balances per the seed's header comment |

The seed also creates 5 enrolled PCs per branch (`MNR-PC-01…05`, `LAC-PC-01…05`), the price list (4,000 coins/h walk-in and booked, i.e. 1 DT per 15 min), the Pro/Elite tiers, two passes and 7 games. Seeded PCs show as online in the database but are only really online when an agent with that serial is connected.

## Screens and their endpoints

Every screen reads and writes the real backend. The last column says what each screen does beyond the obvious, and where it polls because the backend sends no event.

| Screen | Backend | Notes |
|---|---|---|
| Login, access control | `/auth/*` | |
| HQ overview, branch dropdown | `GET/POST/PATCH /branches`, `/machines`, `/api/v1/stations`, `/api/v1/alerts` | Real branch names; HQ creates and edits branches (name, location) on the overview. The counts are computed |
| Stations, station detail, telemetry | `/api/v1/stations…` joined with `/machines`, `peripheral_status` | Only enrolled PCs, each with its branch. The detail page has the **booking link** for gamers, **Rename** (branch admin and HQ, `PATCH /api/v1/stations/:id`; a rename sticks, the PC's own name never overrides it) and the **peripherals** the station watches (disconnected first, live). Telemetry: now, plus min / avg / max over the last 1, 6, 24 or 48 hours (`…/telemetry/history`, one sample a minute; live readings join it once a minute) |
| Remote commands | `/api/v1/stations/:id/commands`, `command_update` | **Unlock** only resumes the gamer's session on that PC: with none, or when their money ran out, the page says what to do (`NO_SESSION_TO_UNLOCK`, `INSUFFICIENT_FUNDS` → top up first). **Shut down** (branch admin and HQ) bills a running session up to now, and its confirmation says so |
| Alerts | `/api/v1/alerts…`, `alert`, `alert_resolved` | |
| Games | `/api/v1/games…`, `catalog_status`, `POST /uploads/images` | The form's **Image** uploads a picture (`iconUrl`); the catalog shows it |
| New stations (enrollment) | `/machines…` | Polled every 15 s (no event for a new request) |
| Sessions | `GET /sessions`, `GET /sessions/:id`, `POST /sessions/:id/end`, `session_runout_warning` | Gamers start their own sessions (PIN in the app). "Running now" = stations reporting a session (live). Below, the sessions played since a day, by status, with gamer and bill (HQ: the branch in the top bar); reloaded when a station's status changes |
| Session and bill | `GET /sessions/:id` | Read again every 5 s until the bill is settled |
| Bookings | `GET /api/v1/reservations`, `DELETE /api/v1/reservations/:id` | Who booked which station, for one day or 7 days, by status (HQ: the branch in the top bar). **Cancel** a booking nobody plays on yet (its PIN stops working). Polled every 30 s (no event for a new booking) |
| Wallet (desk) | `GET /gamers?q=`, `/wallets/:gamerProfileId…` | Find the gamer by **username** (an exact name opens at once, else pick from the matches; recent gamers are remembered per browser); idempotent top-up and refund (refund: branch admin and HQ) |
| Users & Staff (gamers with their profile picture) | `GET /users`, `POST /users`, `POST /employees`, `PATCH /users/:id/role`, `PATCH /users/:id/status` | List and search by username and role (HQ: everyone, or the branch picked in the header; a branch admin: gamers and their own staff). A new gamer needs a home branch, a new staff account its branch. Suspend / Reactivate shows only where the server allows it (`src/domain/permissions.ts`). Nobody sets another person's password |
| Plans & prices | `/pricing`, `/membership-plans`, `/subscription-plans` | The play prices in coins per hour, the same in every branch: HQ edits them, managers see them. Create, edit, delete tiers and passes (prices in coins). A pass has one or more time windows (days, from–to, discount), added, changed and removed in its form; gamers who already bought it keep the windows they paid for. **Badge** on each tier and pass: the picture is uploaded when picked (`POST /uploads/images`) and saved with the form |
| Ranks | `GET/POST/PATCH/DELETE /ranks`, `POST /uploads/images` | The gamer ranks (Wood → GrandMaster): name, the XP each starts at, badge. Shared by every branch; warns when no rank starts at 0 XP |
| Images (how pages use them) | `POST /uploads/images`, `PUT/DELETE /users/me/avatar`, `GET /uploads/…` | Desk forms use `src/apps/desk/components/ImageField.tsx` (picker, preview, Remove; checks type and size before sending) and lists `Thumb.tsx`. The portal profile sets the gamer's picture with it. `src/services/images.service.ts`: `uploadImage(file)` answers a link to save as the `badgeUrl` of a tier, pass or rank, or the `iconUrl` of a game (any other link is refused); `setMyAvatar(file)` for the gamer; show any of them with `<img src={imageSrc(url)}>`. PNG, JPEG or WebP, at most 2 MB (`IMAGE_MAX_BYTES`, `IMAGE_ACCEPT`). Rank shapes in `src/core/api-types/ranks.ts` |
| Audit log (HQ) | `GET /audit-logs?branchId&from&action&q&limit` | Who did which sensitive action, on what, when: role changes, suspensions, refunds, shutdowns, revoked stations, branch / plan / price changes (HQ: the branch in the top bar). Filter by day, action, name. **Not on the backend yet**: until it is, the page says so (404). Expected answer: `AuditLogEntry[]` in `src/core/api-types/audit.ts`; action wording in `src/domain/audit.ts` |
| Portal: home (Figma design) | `/auth/me` (`xp`, `rank`, `nextRank`), `/memberships/me`, `/subscriptions/me`, `GET /api/v1/games` | The gamer's picture (BIDI until they upload one), XP bar towards the next rank, badges (rank, tier, pass), the game collection: an endless ring (drag it, or the arrow keys; after the last game comes the first), games with a poster first, Bookings and Events (tournaments: *coming soon*). Every portal screen uses the design system in `src/components/` |
| Portal: welcome, login, sign-up (Figma design) | `POST /auth/login`, `GET /branches`, `POST /users` | Signed out, the portal opens on **Welcome** (Login / Sign Up). Sign-up asks the username, the **home branch**, the password twice (they must match), then logs in and opens Bookings. The eye shows or hides a password (two Figma icons: crossed out while hidden, open once shown). Login is the same form as the staff app's (`useLoginForm` in `shared/components/LoginForm.tsx`) |
| Portal: bookings (Figma design) | `GET /branches/:id/stations`, `/reservations`, `/reservations/walk-in`, `/reservations/:id/check-in`, `DELETE /reservations/:id` | **My Bookings**: a card per booking (PC, branch, length, start) with its **PIN**; a tap shows New PIN and Cancel. **Reserve**: day (a picker of the 7 bookable days, `booking/DayPicker.tsx`), time ("Now" = Play now) and length, then the room's seat map (`booking/seats.ts`: rows of 2 + 3 seats, numbered; red = taken for that slot, from each PC's bookings of the next 7 days). The wallet must cover the booking (`INSUFFICIENT_FUNDS`) |
| Portal: profile (Figma design) | `/auth/me`, `/wallets/me`, `/ranks`, `/membership-plans`, `/memberships/me` | Picture, rank, XP bar, the wallet card ("30.000"), the ranks reached (the others faded), the membership tiers and the passes (Plans, not in Figma: the gamer's in full, a tap opens Memberships & passes) |
| Portal: settings (Figma design) | `/branches`, `/memberships/me`, `/membership-plans`, `/subscriptions/me`, `/pricing` | The profile card (opens My account), the gamer's tier (its discount and rate per hour) and pass, or "None: buy a plan", Sessions History, Terms Of Service, FAQ, Log Out |
| Portal: sessions history, terms, FAQ | `GET /sessions/me/history` | The gamer's settled sessions (time played, coins, XP); the rules of play; short answers. In the design's style, not in Figma |
| Portal: my account, memberships & passes (same style, not in Figma) | `PATCH /users/me/branch`, `POST /auth/change-password`, `PUT/DELETE /users/me/avatar`, `…/purchase`, `POST /memberships/me/cancel` | My account: picture, home branch, password (twice). Memberships & passes: every tier and pass as a plan card with its price and **Buy** / **Upgrade** (pay the difference, prorated) / **Cancel** (no refund) |
| Portal: my session, wallet (same style, not in Figma) | `GET /sessions/me/current`, `/reservations/:id/extend-options`, `POST /reservations/:id/extend`, `session_notice`, `/wallets/me…` | My session: a dark card (PC, time played, end, cost so far, balance after), **Extend** by 30 / 60 / 90 minutes near the end, the PIN before the start. Wallet: the Profile wallet card, how to top up (the username to give the desk), the history. Every portal page is in this design: the portal no longer loads classic.css |

**Money:** the platform counts in **coins**, whole numbers, everywhere (wallets, prices, bills); screens show them with `formatCoins` in `src/lib/format.ts` and never compute money. What a coin is worth is set there too (`COINS_PER_CURRENCY = 1000`, `CURRENCY = 'DT'`): only the desk top-up uses it, taking cash in DT and crediting the coins. Rates are coins per hour, billed by the second.

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

**Adding a real PC:** on **New stations**, pick its branch and generate an enrollment token; on the PC run `BaronDeskAgent.ServiceCore.exe --set-enrollment-token` (admin PowerShell), paste the token and start the agent; approve its request when it shows up. The full procedure is in the backend's `docs/STATION_PHYSICAL_TEST.md` and `docs/STATION_AGENT.md`.

## Login

- Admin app: staff roles only (`EMPLOYEE`, `MANAGER`, `ADMIN`). Portal: `GAMER` only. The wrong app refuses the login with a message.
- The access token is kept in memory; the refresh token in `sessionStorage` (one per app). A reload keeps you logged in; closing the tab logs out.
- A `401` triggers one token refresh and a retry. If the refresh fails, the login page says the session expired.
- The menu hides what the role can't use; opening such a page by URL shows **Access denied**. The server's `403` is still the real rule.
- **Own password, and only one's own:** desk sidebar → **Password** (`#/account`), portal → Settings. Both use `useChangePassword` (`src/hooks/`, `POST /auth/change-password`): the desk through `apps/desk/components/ChangePasswordForm.tsx`, the portal on My account: every other login of the account ends, this tab stays logged in with the new tokens. The desk has no way to set someone else's password.

## Live updates

- After login both apps connect to `/dashboard-io` (Socket.IO, token in `auth`). The admin top bar shows **LIVE**, **CONNECTING** or **OFFLINE**.
- Staff join their branch's room (HQ: every branch); a gamer only their own, so the portal never sees stations, alerts or other gamers.
- When the connection drops, a red bar says so and Socket.IO retries on its own. If the server refuses the token, the app refreshes it once and retries (then every 10 s).
- Screens use `useRealtimeEvent('station_status', …)` to react to events and `useOnReconnect(refetch)` to reload their data after a reconnect.
- Events to staff: `station_status`, `telemetry_update`, `command_update`, `alert`, `alert_resolved`, `catalog_status`, `peripheral_status`, `session_runout_warning`. To the gamer: `session_notice` (`LOW_BALANCE`, `TIME_LEFT`, `CLEAR`). There is no session, booking or wallet event: those pages re-read the server.

## HQ (multi-branch)

- HQ (`ADMIN`, `branchId = null`) gets a **Branch** dropdown in the top bar: *All branches* or one branch. Branch admins and staff see their branch name as plain text.
- With a branch picked, lists ask for `?branchId=…` and live events from other branches are ignored, so actions run on the selected branch. The choice survives a reload (per tab).
- **Audit log** (`#/audit`, HQ only): see the screens table; it needs `GET /audit-logs` on the backend.
- **HQ overview** (`#/hq`, HQ's start page): stations, online, in session and open alerts per branch, computed from the machines, the stations and the open alerts.
- **Branches:** below the table, HQ creates a branch (name, location) with `POST /branches`; **Edit** on a row renames or moves it with `PATCH /branches/:id`. A new branch then needs its PCs (New stations); the prices are the same in every branch.
- Code: `src/apps/desk/providers/BranchContext.tsx` (`useBranchScope()`: `scoped(path)`, `inScope(branchId)`), `src/apps/desk/pages/hq/HqPage.tsx`.

## Build and test

```sh
npm run build          # typecheck + vite build → dist/admin, dist/portal
npm run typecheck
npm run check:layers   # the dependency rule below: lists any import that breaks it
npm test               # 48 unit tests: money, dates, branches, bookings, seats, plans and ledger wording, pass windows, XP,
                       # audit wording, Users page permissions, wallet search, peripherals, telemetry, images
```

## Source layout

Two apps share one code base: **the desk** (staff, branch admins and HQ; one app, the menu follows the role)
and **the portal** (gamers). Everything below `apps/` is shared, in layers.

```text
admin/index.html, portal/index.html   the two entry pages (multi-page build → dist/admin, dist/portal)
scripts/check-layers.mjs              checks the dependency rule
src/
  core/          the platform: http/client.ts (api(): fetch with token refresh, ApiError), auth/ (tokens, roles),
                 realtime/ (Socket.IO client for /dashboard-io), config.ts, api-types/ (the backend's shapes, one
                 file per domain; import from 'core/api-types')
  lib/           pure helpers, no React: format (coins, durations), dates, errors (describeError, explainRefusal),
                 images (file checks, imageSrc), cx (class names)
  domain/        the business rules, pure and tested: bookings, seats, plans, wallet, xp, images, and the desk's
                 stations, telemetry, alerts, sessions, games, audit, permissions, branches, gamerSearch
  services/      the only code that knows the backend's URLs: one object per resource (stations, sessions,
                 reservations, wallet, users, plans, games, ranks, branches, machines, alerts, audit, catalog,
                 auth, images). Each has `paths` for reads and a method per action; server refusals come back
                 as sentences (an adapter over the error codes)
  hooks/         useApiQuery (GET + reload; a tab-wide cache: a page seen before shows its last data at once and
                 refreshes it in the background, one request per path at a time, cleared on logout/login), useAction (busy / message / error of a button), useNow,
                 useLoginForm, useChangePassword, queries.ts (named reads: useMyWallet(), useBranches()…)
  providers/     AuthProvider (who is logged in), guards (RequireAuth…), RealtimeProvider
  components/    the design system (CSS Modules, every size in --u, 1/360 of the phone column)
    tokens/      tokens.css (colors, weights, the unit (--u: 1/360 of the phone column, 1px on the desk), base rules;
                 layers: desk < base < components), fonts/
    primitives/  Button (+ ButtonLink, ButtonRow), Field (+ SelectField), Select (every dropdown: keyboard,
                 screen readers, required), Notice (+ ActionNote), Card, SectionTitle, PageTitle,
                 Pill, Avatar, BadgeImage, Art (+ u())
    composites/  XpBar, PlayerBadges, PlanCard, WalletCard, CoinBalance, ChipPicker (a pill opening chips),
                 DayPicker (ChipPicker of days), CalendarPicker / CalendarPanel (any day, a month), DateField,
                 TimeField, SlotPicker (day, time,
                 length: the app's booking slot; anyDay for the desk), usePopover, GameCarousel, EmptyScreen
    layout/      MobileShell, AuthLayout (AuthScreen (`wide` for a desktop window), AuthLogo, AuthMascot, AuthForm,
                 AuthFields, AuthError), LoginScreen (the login of both apps),
                 Page, PageErrorBoundary
    assets/      icons, doodles, mascot, logo, background shapes exported from Figma
  apps/
    portal/      main.tsx, PortalApp.tsx (routes), portal.css (the few global rules)
      layout/    PortalShell (the route → nav item map), BottomNav
      pages/     auth/ (welcome, login, sign-up), home/ (home, events), book/, profile/, settings/ (settings,
                 my account, memberships & passes, history / terms / FAQ), session/, wallet/, NotFoundPage;
                 each page XxxPage.tsx with its own XxxPage.module.css
    desk/        main.tsx, DeskApp.tsx (routes), menu.ts, desk-theme.css (the portal's design for the desk pages' plain
                 markup: tables .grid/.kv, fieldsets, .toolbar, .msg, buttons (.secondary, .danger); loaded by desk.css
                 into the lowest cascade layer, so a design component always wins over it)
      layout/    DeskLayout (sidebar card: logo, menu, who is logged in; header: live status, HQ's branch), AccessDenied
      providers/ BranchContext (HQ's branch scope), AlertFeedContext
      hooks/     useCommands, useStationList, useStationNames, useRecentGamers
      components/  the desk's pieces: RoomMap (a branch's room as in the app), BranchSection, ErrorBox, ActionMessages, EmptyRow,
                 ChangePasswordForm, ConnectionBanner, CopyButton, ImageField, Thumb, CommandError…
      pages/     login, and one folder per menu entry, in the portal's design:
                 stations, bookings (with the sessions; sessions/ keeps a session's bill), wallet, alerts, users,
                 plans, ranks, games, hq, audit, account
```

**The dependency rule** (`npm run check:layers`): `apps → providers / hooks → services → domain → lib → core`;
`components` only use `lib`, `domain` and `core` (they get their data through props). An app never imports the other app.

**Where new code goes**
- A screen: `src/apps/<app>/pages/<feature>/XxxPage.tsx` with its `XxxPage.module.css`. Page styles are not
  layered, so they always win over a component's: a page places and sizes components with a `className`,
  it does not restyle them.
- A piece of UI used twice: a component in `src/components/` (primitive, composite or layout), with its
  `.module.css` in `@layer components` and a `className` prop for placement. Pick a variant/size of
  Button, Notice, Card… instead of writing button CSS in a page.
- A backend route: a method or path in its `src/services/<resource>.service.ts`; a page never writes a URL.
  A refusal shown in words: a `Record<code, sentence>` in the service and `explainRefusal(err, map)`.
- A business rule: `src/domain/<topic>.ts`, pure, with its test beside it (`stations.ts` → `stations.test.ts`).
- A read used by several pages: a named hook in `src/hooks/queries.ts`.
- A new backend shape: the matching `src/core/api-types/<domain>.ts` (a new domain also gets a line in its `index.ts`).

Routing uses hash URLs (`/admin/#/stations`) and the build uses relative asset paths, so the apps work behind a plain file server (Caddy) or inside a desktop shell, with no server rewrite rules.
