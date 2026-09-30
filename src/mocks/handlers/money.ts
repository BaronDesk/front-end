/*
 * wallet/ and membership/ endpoints, plus pricing. Every money-moving POST
 * honours idempotencyKey: the same key returns the first result again.
 */
import type { BranchPricing, MembershipPlan, SubscriptionPlan, WalletTransaction } from '../../api/types';
import { db, newId, nowIso, round3 } from '../db';
import {
  assertBranch,
  assertSelfOrStaff,
  badRequest,
  findUser,
  isStaff,
  notFound,
  requireManager,
  requireStaff,
  requireUser,
} from '../guards';
import { balanceOf, postTransaction } from '../logic';
import { MockHttpError, route } from '../router';

const MAX_TOPUP = 500;

function once<T extends { id: string }>(key: unknown, list: T[], create: () => T): T {
  if (typeof key === 'string' && key) {
    const seen = db.idempotency.get(key);
    const previous = seen ? list.find((x) => x.id === seen) : undefined;
    if (previous) return previous;
  }
  const result = create();
  if (typeof key === 'string' && key) db.idempotency.set(key, result.id);
  return result;
}

function gamer(userId: string) {
  const user = findUser(userId);
  if (user.role !== 'GAMER') badRequest('only gamers have a wallet', 'NOT_A_GAMER');
  return user;
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 3_600_000).toISOString();
}

// ---------- wallet ----------

route('GET', '/wallet/:id', (ctx) => {
  const caller = requireUser(ctx);
  assertSelfOrStaff(caller, ctx.params.id);
  gamer(ctx.params.id);
  return { userId: ctx.params.id, balance: balanceOf(ctx.params.id) };
});

route('GET', '/wallet/:id/transactions', (ctx) => {
  const caller = requireUser(ctx);
  assertSelfOrStaff(caller, ctx.params.id);
  return db.transactions.filter((t) => t.userId === ctx.params.id);
});

route('POST', '/wallet/:id/topup', (ctx) => {
  const caller = requireUser(ctx);
  assertSelfOrStaff(caller, ctx.params.id);
  gamer(ctx.params.id);
  const amount = round3(Number(ctx.body.amount));
  if (!(amount > 0)) badRequest('amount must be greater than 0');
  if (amount > MAX_TOPUP) badRequest(`amount cannot exceed ${MAX_TOPUP}`);
  // Staff take cash at the desk; a gamer paying themselves is an online top-up.
  const method = isStaff(caller) ? String(ctx.body.method ?? 'CASH') : 'ONLINE';
  return once(ctx.body.idempotencyKey, db.transactions, () =>
    postTransaction(ctx.params.id, 'TOPUP', amount, { method, note: isStaff(caller) ? 'Desk top-up' : 'Self top-up' }),
  );
});

route('POST', '/transactions/:id/reverse', (ctx) => {
  requireManager(ctx);
  const tx = db.transactions.find((t) => t.id === ctx.params.id) ?? notFound('transaction');
  if (tx.type === 'REVERSAL') badRequest('a reversal cannot be reversed');
  if (tx.reversedById) throw new MockHttpError(409, 'ALREADY_REVERSED', 'transaction was already reversed');
  const reason = String(ctx.body.reason ?? '').trim();
  if (!reason) badRequest('reason is required');
  const reversal: WalletTransaction = postTransaction(tx.userId, 'REVERSAL', -tx.amount, {
    note: `Reversal of ${tx.type}: ${reason}`,
  });
  tx.reversedById = reversal.id;
  return reversal;
});

// ---------- plans (public read, manager write) ----------

function readPlanBase(body: Record<string, unknown>) {
  const name = String(body.name ?? '').trim();
  const price = round3(Number(body.price));
  const durationDays = Number(body.durationDays);
  if (!name) badRequest('name is required');
  if (!(price >= 0)) badRequest('price must be 0 or more');
  if (!(durationDays > 0)) badRequest('durationDays must be greater than 0');
  return { name, price, durationDays };
}

route('GET', '/membership-plans', () => db.membershipPlans);

route('POST', '/membership-plans', (ctx) => {
  requireManager(ctx);
  const discountPercent = Number(ctx.body.discountPercent);
  if (!(discountPercent >= 0 && discountPercent <= 100)) badRequest('discountPercent must be 0–100');
  const plan: MembershipPlan = { id: newId(), ...readPlanBase(ctx.body), discountPercent };
  db.membershipPlans.push(plan);
  return plan;
});

route('PATCH', '/membership-plans/:id', (ctx) => {
  requireManager(ctx);
  const plan = db.membershipPlans.find((p) => p.id === ctx.params.id) ?? notFound('plan');
  const next = { ...plan, ...ctx.body, id: plan.id };
  Object.assign(plan, { ...readPlanBase(next), discountPercent: Number(next.discountPercent) });
  return plan;
});

route('GET', '/subscription-plans', () => db.subscriptionPlans);

route('POST', '/subscription-plans', (ctx) => {
  requireManager(ctx);
  const hoursIncluded = Number(ctx.body.hoursIncluded);
  if (!(hoursIncluded > 0)) badRequest('hoursIncluded must be greater than 0');
  const plan: SubscriptionPlan = { id: newId(), ...readPlanBase(ctx.body), hoursIncluded };
  db.subscriptionPlans.push(plan);
  return plan;
});

route('PATCH', '/subscription-plans/:id', (ctx) => {
  requireManager(ctx);
  const plan = db.subscriptionPlans.find((p) => p.id === ctx.params.id) ?? notFound('plan');
  const next = { ...plan, ...ctx.body, id: plan.id };
  Object.assign(plan, { ...readPlanBase(next), hoursIncluded: Number(next.hoursIncluded) });
  return plan;
});

// ---------- memberships & passes (debit the wallet) ----------

route('POST', '/memberships', (ctx) => {
  const caller = requireUser(ctx);
  const userId = String(ctx.body.userId ?? '');
  assertSelfOrStaff(caller, userId);
  gamer(userId);
  const plan = db.membershipPlans.find((p) => p.id === ctx.body.planId) ?? notFound('plan');
  if (db.memberships.some((m) => m.userId === userId && Date.parse(m.endsAt) > Date.now())) {
    throw new MockHttpError(409, 'ALREADY_MEMBER', 'gamer already has an active membership');
  }
  return once(ctx.body.idempotencyKey, db.memberships, () => {
    postTransaction(userId, 'MEMBERSHIP', -plan.price, { note: `Membership ${plan.name}` });
    const m = {
      id: newId(),
      userId,
      planId: plan.id,
      planName: plan.name,
      discountPercent: plan.discountPercent,
      startsAt: nowIso(),
      endsAt: daysFromNow(plan.durationDays),
    };
    db.memberships.push(m);
    return m;
  });
});

route('DELETE', '/memberships/:id', (ctx) => {
  const caller = requireUser(ctx);
  const m = db.memberships.find((x) => x.id === ctx.params.id) ?? notFound('membership');
  assertSelfOrStaff(caller, m.userId);
  m.endsAt = nowIso();
  return undefined;
});

route('POST', '/subscriptions', (ctx) => {
  const caller = requireUser(ctx);
  const userId = String(ctx.body.userId ?? '');
  assertSelfOrStaff(caller, userId);
  gamer(userId);
  const plan = db.subscriptionPlans.find((p) => p.id === ctx.body.planId) ?? notFound('plan');
  return once(ctx.body.idempotencyKey, db.subscriptions, () => {
    postTransaction(userId, 'SUBSCRIPTION', -plan.price, { note: `Pass ${plan.name}` });
    const s = {
      id: newId(),
      userId,
      planId: plan.id,
      planName: plan.name,
      hoursLeft: plan.hoursIncluded,
      startsAt: nowIso(),
      endsAt: daysFromNow(plan.durationDays),
    };
    db.subscriptions.push(s);
    return s;
  });
});

route('DELETE', '/subscriptions/:id', (ctx) => {
  const caller = requireUser(ctx);
  const s = db.subscriptions.find((x) => x.id === ctx.params.id) ?? notFound('subscription');
  assertSelfOrStaff(caller, s.userId);
  s.endsAt = nowIso();
  return undefined;
});

// ---------- pricing ----------

route('GET', '/pricing', (ctx) => {
  requireUser(ctx);
  return db.pricing;
});

// Like pricing.controller.ts: staff read their branch's prices, managers set them.
route('GET', '/branches/:branchId/pricing', (ctx) => {
  const caller = requireStaff(ctx);
  assertBranch(caller, ctx.params.branchId);
  const row = db.branchPricing.get(ctx.params.branchId);
  if (!row) throw new MockHttpError(404, 'PRICING_NOT_SET', 'no pricing configured for this branch');
  return row;
});

const MAX_RATE = 100_000_000;
const isRate = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= MAX_RATE;

route('PUT', '/branches/:branchId/pricing', (ctx) => {
  const caller = requireManager(ctx);
  const { branchId } = ctx.params;
  assertBranch(caller, branchId);
  const { paygRate, bookingRate } = ctx.body;
  if (!isRate(paygRate) || !isRate(bookingRate)) badRequest('paygRate and bookingRate must be positive whole millimes');
  if (!db.branches.some((b) => b.id === branchId)) throw new MockHttpError(404, 'BRANCH_NOT_FOUND', 'branch not found');
  const row: BranchPricing = {
    id: db.branchPricing.get(branchId)?.id ?? newId(),
    branchId,
    paygRate,
    bookingRate,
    updatedAt: nowIso(),
  };
  db.branchPricing.set(branchId, row);
  return row;
});
