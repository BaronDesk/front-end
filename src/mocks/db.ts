/*
 * In-memory "database" for the mock backend. Lives for one page load:
 * reload the page to reset everything to the seed below.
 */
import type {
  Alert,
  Branch,
  CommandLog,
  Game,
  GamerProfile,
  Membership,
  MembershipPlan,
  Pricing,
  Reservation,
  Role,
  Session,
  EnrollmentStation,
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
 * A station as the mock keeps it: the enrollment record plus live agent
 * state. Handlers turn it into the real API shapes (logic.ts toStationDto,
 * stationStatus).
 */
export interface MockStation extends EnrollmentStation {
  serialNumber: string;
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
    mac: `00:1A:2B:3C:4D:${n.toString(16).padStart(2, '0').toUpperCase()}`,
    ip: `192.168.${branchId === B1 ? 10 : 20}.${100 + n}`,
    enrollmentStatus: 'APPROVED',
    online: true,
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
  station(6, B1, 'TUN-06', { enrollmentStatus: 'PENDING', online: true, lastSeenAt: nowIso() }),
  station(11, B2, 'SOU-01'),
  station(12, B2, 'SOU-02'),
  // Flips online/offline every 30 s so Node Tracking has something to show.
  station(13, B2, 'SOU-03'),
];

export const FLAKY_STATION_ID = sid(3, 13);

const games: Game[] = [
  { id: sid(4, 1), title: 'Counter-Strike 2', executablePath: 'C:\\Games\\CS2\\cs2.exe', genre: 'FPS', cover: null },
  { id: sid(4, 2), title: 'Valorant', executablePath: 'C:\\Riot Games\\VALORANT\\VALORANT.exe', genre: 'FPS', cover: null },
  { id: sid(4, 3), title: 'League of Legends', executablePath: 'C:\\Riot Games\\League of Legends\\LeagueClient.exe', genre: 'MOBA', cover: null },
  { id: sid(4, 4), title: 'Fortnite', executablePath: 'C:\\Epic Games\\Fortnite\\FortniteLauncher.exe', genre: 'Battle royale', cover: null },
  { id: sid(4, 5), title: 'Rocket League', executablePath: 'C:\\Epic Games\\rocketleague\\RocketLeague.exe', genre: 'Sports', cover: null },
];

/** machineId → gameIds installed on it. */
const stationGames = new Map<string, string[]>(
  stations.map((s, i) => [s.id, games.filter((_, g) => (g + i) % 2 === 0 || g === 0).map((g) => g.id)]),
);

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

const alerts: Alert[] = [
  {
    id: sid(12, 1),
    machineId: sid(3, 5),
    branchId: B1,
    category: 'hardware',
    type: 'TEMPERATURE_WARNING',
    severity: 'MEDIUM',
    detail: 'GPU temperature 84 °C (threshold 80 °C)',
    status: 'OPEN',
    occurredAt: minutesAgo(8),
  },
  {
    id: sid(12, 2),
    machineId: sid(3, 12),
    branchId: B2,
    category: 'anti_theft',
    type: 'DEVICE_REMOVED',
    severity: 'HIGH',
    detail: 'USB mouse "Logitech G502" disconnected',
    status: 'OPEN',
    occurredAt: minutesAgo(3),
  },
];

const pricing: Pricing = { ratePerHour: 3, bookingFee: 1, lowBalanceMinutes: 10 };

/** machineId → latest snapshot (the backend keeps these in Redis, 30 s TTL). */
const telemetry = new Map<string, TelemetrySnapshot>();

const commands: CommandLog[] = [];

/** idempotencyKey → transaction id, for money endpoints. */
const idempotency = new Map<string, string>();

export const db = {
  branches,
  users,
  stations,
  stationGames,
  games,
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
  telemetry,
  commands,
  idempotency,
};
