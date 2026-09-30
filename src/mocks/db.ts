/*
 * In-memory "database" for the mock backend. Lives for one page load:
 * reload the page to reset everything to the seed below.
 */
import type {
  Alert,
  Branch,
  BranchPricing,
  Command,
  Game,
  GamerProfile,
  MachineEnrollmentStatus,
  Membership,
  MembershipPlan,
  Pricing,
  Reservation,
  Role,
  Session,
  StationGameOverrides,
  Subscription,
  SubscriptionPlan,
  TelemetrySnapshot,
  WalletTransaction,
} from '../api/types';

export const MOCK_PASSWORD = 'password123';

export interface MockUser {
  id: string;
  username: string;
  role: Role;
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  branchId: string | null;
  createdAt: string;
  password: string;
}

/**
 * A station as the mock keeps it: the MACHINE row plus live agent state.
 * Handlers turn it into the real API shapes (logic.ts toStationDto,
 * toStationDetail, toMachine, stationStatus).
 */
export interface MockStation {
  id: string;
  serialNumber: string;
  branchId: string;
  name: string;
  ip: string;
  /** Only ENROLLED stations can connect: PENDING and DEACTIVATED ones stay offline. */
  enrollmentStatus: MachineEnrollmentStatus;
  online: boolean;
  lastSeenAt: string | null;
  /** When the PC asked to join. */
  createdAt: string;
  locked: boolean;
  sessionId: string | null;
  runningGameId: string | null;
}

/** Stable ids, so URLs like #/stations/<id> survive a reload. */
function sid(prefix: number, n: number): string {
  return `00000000-0000-4000-8${prefix.toString().padStart(3, '0')}-${n.toString().padStart(12, '0')}`;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

function todayAt(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ---------------------------------------------------------------------------

const B1 = sid(1, 1);
const B2 = sid(1, 2);

const branches: Branch[] = [
  { id: B1, name: 'Tunis Centre' },
  { id: B2, name: 'Sousse' },
];

function user(n: number, username: string, role: Role, branchId: string | null): MockUser {
  return {
    id: sid(2, n),
    username,
    role,
    accountStatus: 'ACTIVE',
    branchId,
    createdAt: minutesAgo(60 * 24 * (30 - n)),
    password: MOCK_PASSWORD,
  };
}

const users: MockUser[] = [
  user(1, 'hq.admin', 'ADMIN', null),
  user(2, 'manager.tunis', 'MANAGER', B1),
  user(3, 'staff.tunis', 'EMPLOYEE', B1),
  user(4, 'manager.sousse', 'MANAGER', B2),
  user(5, 'staff.sousse', 'EMPLOYEE', B2),
  user(11, 'gamer1', 'GAMER', null),
  user(12, 'gamer2', 'GAMER', null),
  user(13, 'gamer3', 'GAMER', null),
  user(14, 'gamer4', 'GAMER', null),
  user(15, 'gamer5', 'GAMER', null),
  user(16, 'lowbalance', 'GAMER', null),
];

const gamerIds = users.filter((u) => u.role === 'GAMER').map((u) => u.id);
const [G1, G2, G3] = gamerIds;
const LOW = users.find((u) => u.username === 'lowbalance')!.id;

function station(n: number, branchId: string, name: string, extra: Partial<MockStation> = {}): MockStation {
  return {
    id: sid(3, n),
    serialNumber: `SN-${name}`,
    branchId,
    name,
    ip: `192.168.${branchId === B1 ? 10 : 20}.${100 + n}`,
    enrollmentStatus: 'ENROLLED',
    online: true,
    createdAt: minutesAgo(60 * 24 * 30),
    locked: true,
    sessionId: null,
    runningGameId: null,
    lastSeenAt: nowIso(),
    ...extra,
  };
}

const ACTIVE_SESSION = sid(9, 1);

const stations: MockStation[] = [
  station(1, B1, 'TUN-01'),
  station(2, B1, 'TUN-02', { locked: false, sessionId: ACTIVE_SESSION }),
  station(3, B1, 'TUN-03'),
  station(4, B1, 'TUN-04', { online: false, lastSeenAt: minutesAgo(42) }),
  station(5, B1, 'TUN-05'),
  // Asked to join a few minutes ago: waits on New stations.
  station(6, B1, 'TUN-06', { enrollmentStatus: 'PENDING', online: false, lastSeenAt: null, createdAt: minutesAgo(5) }),
  station(11, B2, 'SOU-01'),
  station(12, B2, 'SOU-02'),
  // Flips online/offline every 30 s so Node Tracking has something to show.
  station(13, B2, 'SOU-03'),
];

export const FLAKY_STATION_ID = sid(3, 13);

function game(
  n: number,
  gameId: string,
  name: string,
  launchType: Game['launchType'],
  target: string,
  processName: string | null,
  args: string | null = null,
): Game {
  const at = minutesAgo(60 * 24 * 10);
  return {
    id: sid(4, n),
    gameId,
    name,
    launchType,
    target,
    arguments: args,
    workingDirectory: null,
    processName,
    iconUrl: null,
    enabled: true,
    sortOrder: 0,
    createdAt: at,
    updatedAt: at,
  };
}

const games: Game[] = [
  game(1, 'cs2', 'Counter-Strike 2', 'steam', '730', 'cs2.exe'),
  game(
    2,
    'valorant',
    'Valorant',
    'exe',
    'C:\\Riot Games\\Riot Client\\RiotClientServices.exe',
    'VALORANT-Win64-Shipping.exe',
    '--launch-product=valorant --launch-patchline=live',
  ),
  game(3, 'lol', 'League of Legends', 'exe', 'C:\\Riot Games\\League of Legends\\LeagueClient.exe', 'LeagueClient.exe'),
  game(4, 'fortnite', 'Fortnite', 'epic', 'Fortnite', 'FortniteClient-Win64-Shipping.exe'),
  game(5, 'rocket-league', 'Rocket League', 'epic', 'Sugar', 'RocketLeague.exe'),
];

/** Game row id → branches that offer it at every station (GameBranch). */
const gameBranches = new Map<string, Set<string>>([
  [sid(4, 1), new Set([B1, B2])],
  [sid(4, 2), new Set([B1, B2])],
  [sid(4, 3), new Set([B1])],
]);

/** machineId → (game row id → per-station overrides) (MachineGame). */
const machineGames = new Map<string, Map<string, StationGameOverrides>>([
  [sid(3, 1), new Map([[sid(4, 4), {}]])],
  [sid(3, 2), new Map([[sid(4, 4), {}]])],
  [sid(3, 3), new Map([[sid(4, 5), {}]])],
  [sid(3, 11), new Map([[sid(4, 4), {}]])],
]);

export interface GameStatus {
  installed: boolean;
  reason: string | null;
  reportedAt: string;
}

/**
 * machineId → (wire gameId → what the agent last reported) (StationGameStatus).
 * Filled by logic.ts reportCatalog, like the agent's catalog_status after a sync.
 */
const gameStatuses = new Map<string, Map<string, GameStatus>>();

/** machineId → (wire gameId → why the fake agent can't launch it). Seeded so one game shows "No". */
const notInstalled = new Map<string, Map<string, string>>([
  [sid(3, 3), new Map([['valorant', 'Executable not found: C:\\Riot Games\\Riot Client\\RiotClientServices.exe']])],
]);

const membershipPlans: MembershipPlan[] = [
  { id: sid(5, 1), name: 'Silver', price: 15, discountPercent: 5, durationDays: 30 },
  { id: sid(5, 2), name: 'Gold', price: 30, discountPercent: 10, durationDays: 30 },
];

const subscriptionPlans: SubscriptionPlan[] = [
  { id: sid(6, 1), name: '10-hour pass', price: 25, hoursIncluded: 10, durationDays: 30 },
  { id: sid(6, 2), name: 'Weekend pass', price: 12, hoursIncluded: 6, durationDays: 3 },
];

const memberships: Membership[] = [
  {
    id: sid(7, 1),
    userId: G1,
    planId: membershipPlans[1].id,
    planName: 'Gold',
    discountPercent: 10,
    startsAt: minutesAgo(60 * 24 * 5),
    endsAt: new Date(Date.now() + 25 * 24 * 3_600_000).toISOString(),
  },
];

const subscriptions: Subscription[] = [
  {
    id: sid(8, 1),
    userId: G3,
    planId: subscriptionPlans[0].id,
    planName: '10-hour pass',
    hoursLeft: 7.5,
    startsAt: minutesAgo(60 * 24 * 2),
    endsAt: new Date(Date.now() + 28 * 24 * 3_600_000).toISOString(),
  },
];

const profiles = new Map<string, GamerProfile>(
  gamerIds.map((id, i) => [id, { userId: id, xp: 120 * (i + 1), level: 1 + i }]),
);

const balances = new Map<string, number>(gamerIds.map((id) => [id, 20]));
balances.set(G1, 45.5);
balances.set(G2, 12);
balances.set(LOW, 0.4);

const transactions: WalletTransaction[] = gamerIds.map((id, i) => ({
  id: sid(10, i + 1),
  userId: id,
  type: 'TOPUP',
  amount: balances.get(id)!,
  balanceAfter: balances.get(id)!,
  method: 'CASH',
  note: 'Opening balance',
  reversedById: null,
  createdAt: minutesAgo(60 * 24),
}));

const sessions: Session[] = [
  {
    id: ACTIVE_SESSION,
    userId: G2,
    machineId: sid(3, 2),
    branchId: B1,
    status: 'ACTIVE',
    startedAt: minutesAgo(25),
    endedAt: null,
    endReason: null,
    billing: null,
  },
];

const reservations: Reservation[] = [
  {
    id: sid(11, 1),
    userId: G1,
    machineId: sid(3, 3),
    branchId: B1,
    start: todayAt(18),
    end: todayAt(20),
    status: 'BOOKED',
    createdAt: minutesAgo(120),
  },
  {
    id: sid(11, 2),
    userId: G3,
    machineId: sid(3, 11),
    branchId: B2,
    start: todayAt(21),
    end: todayAt(23),
    status: 'BOOKED',
    createdAt: minutesAgo(60),
  },
];

function alert(n: number, station: number, branchId: string, fields: Pick<Alert, 'category' | 'type' | 'severity'>, message: string, at: string): Alert {
  return {
    id: sid(12, n),
    machineId: sid(3, station),
    serialNumber: stations.find((s) => s.id === sid(3, station))?.serialNumber ?? null,
    branchId,
    ...fields,
    value: { message, occurredAt: at },
    acknowledged: false,
    acknowledgedByUserId: null,
    acknowledgedAt: null,
    createdAt: at,
  };
}

// Newest first, like GET /api/v1/alerts.
const alerts: Alert[] = [
  alert(2, 12, B2, { category: 'anti_theft', type: 'DEVICE_REMOVED', severity: 'HIGH' }, 'USB mouse "Logitech G502" disconnected', minutesAgo(3)),
  alert(1, 5, B1, { category: 'hardware', type: 'TEMPERATURE_WARNING', severity: 'MEDIUM' }, 'GPU temperature 84 °C (threshold 80 °C)', minutesAgo(8)),
];

/** Fake-only settings: the portal's booking fee and the low-balance warning (the backend has neither). */
const pricing: Pricing = { ratePerHour: 3, bookingFee: 1, lowBalanceMinutes: 10 };

/** branchId → its play prices in millimes per hour (the backend's Pricing). Sousse has none yet: PRICING_NOT_SET. */
const branchPricing = new Map<string, BranchPricing>([
  [B1, { id: sid(13, 1), branchId: B1, paygRate: 3000, bookingRate: 2500, updatedAt: minutesAgo(60 * 24 * 7) }],
]);

/** machineId → latest snapshot (the backend keeps these in Redis, 30 s TTL). */
const telemetry = new Map<string, TelemetrySnapshot>();

const commands: Command[] = [];

/** idempotencyKey → transaction id, for money endpoints. */
const idempotency = new Map<string, string>();

export const db = {
  branches,
  users,
  stations,
  games,
  gameBranches,
  machineGames,
  gameStatuses,
  notInstalled,
  membershipPlans,
  subscriptionPlans,
  memberships,
  subscriptions,
  profiles,
  balances,
  transactions,
  sessions,
  reservations,
  alerts,
  pricing,
  branchPricing,
  telemetry,
  commands,
  idempotency,
};
