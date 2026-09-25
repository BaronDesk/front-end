/*
 * Mirrors back-end identity/auth.controller.ts: login → token pair only,
 * then GET /auth/me for the user. Tokens are opaque "mock-…" strings.
 */
import type { Role } from '../../api/types';
import { db, newId, nowIso, type MockUser } from '../db';
import { requireUser } from '../guards';
import { publicUser } from '../logic';
import { MockHttpError, route } from '../router';

const revokedRefresh = new Set<string>();

function issuePair(user: MockUser) {
  return {
    accessToken: `mock-access.${user.id}.${newId()}`,
    refreshToken: `mock-refresh.${user.id}.${newId()}`,
  };
}

interface JwtClaims {
  sub: string;
  role: Role;
  branchId: string | null;
}

/**
 * Who is calling. Accepts mock tokens, and also real backend JWTs, so
 * identity can be live while the other modules are still mocked. The JWT
 * is decoded, not verified: the real backend already verified it at login.
 */
export function userFromToken(token: string | null): MockUser | null {
  if (!token) return null;

  if (token.startsWith('mock-access.')) {
    const id = token.split('.')[1];
    return db.users.find((u) => u.id === id) ?? null;
  }

  let claims: JwtClaims;
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    claims = JSON.parse(atob(part)) as JwtClaims;
  } catch {
    return null;
  }
  const known = db.users.find((u) => u.id === claims.sub);
  if (known) return known;

  // First time we see this real user: add them to the mock world. A branch
  // the mock doesn't know maps to the first seeded branch.
  const branchKnown = db.branches.some((b) => b.id === claims.branchId);
  const user: MockUser = {
    id: claims.sub,
    username: `user-${claims.sub.slice(0, 8)}`,
    role: claims.role,
    accountStatus: 'ACTIVE',
    branchId: claims.branchId === null ? null : branchKnown ? claims.branchId : db.branches[0].id,
    createdAt: nowIso(),
    password: '',
  };
  db.users.push(user);
  if (user.role === 'GAMER') {
    db.balances.set(user.id, 0);
    db.profiles.set(user.id, { userId: user.id, xp: 0, level: 1 });
  }
  return user;
}

route('POST', '/auth/login', ({ body }) => {
  const user = db.users.find((u) => u.username === body.username);
  if (!user || user.password !== body.password) {
    throw new MockHttpError(401, 'INVALID_CREDENTIALS', 'invalid username or password');
  }
  if (user.accountStatus !== 'ACTIVE') {
    throw new MockHttpError(403, 'ACCOUNT_INACTIVE', 'account is not active');
  }
  return issuePair(user);
});

route('POST', '/auth/refresh', ({ body }) => {
  const token = String(body.refreshToken ?? '');
  const id = token.startsWith('mock-refresh.') ? token.split('.')[1] : null;
  const user = id ? db.users.find((u) => u.id === id) : undefined;
  if (!user || revokedRefresh.has(token)) {
    throw new MockHttpError(401, 'INVALID_REFRESH_TOKEN', 'refresh token is not usable');
  }
  revokedRefresh.add(token); // rotation: each refresh token works once
  return issuePair(user);
});

route('POST', '/auth/logout', (ctx) => {
  requireUser(ctx);
  revokedRefresh.add(String(ctx.body.refreshToken ?? ''));
  return { success: true };
});

route('GET', '/auth/me', (ctx) => publicUser(requireUser(ctx)));
