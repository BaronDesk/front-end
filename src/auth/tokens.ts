/*
 * Token storage (brief §5): the access token lives in memory only; the
 * refresh token in sessionStorage, so a reload survives and closing the
 * tab/window logs out. Admin and portal keep separate refresh tokens.
 */
import { ApiError, api, setRefreshHandler, setTokenProvider } from '../api/http';
import type { LoginResponse } from '../api/types';

export type AppName = 'admin' | 'portal';

let storageKey = 'barondesk.admin.refreshToken';
let accessToken: string | null = null;
let onExpired: () => void = () => {};

export function configureTokens(app: AppName, handleExpired: () => void): void {
  storageKey = `barondesk.${app}.refreshToken`;
  onExpired = handleExpired;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function saveTokens(pair: LoginResponse): void {
  accessToken = pair.accessToken;
  try {
    sessionStorage.setItem(storageKey, pair.refreshToken);
  } catch {
    // Storage blocked: the session just won't survive a reload.
  }
}

export function clearTokens(): void {
  accessToken = null;
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // nothing to clear
  }
}

let inflight: Promise<boolean> | null = null;

/**
 * Swap the refresh token for a new pair. Single-flight: refresh tokens
 * rotate (each works once), so parallel 401s must share one refresh.
 */
export function refreshTokens(): Promise<boolean> {
  inflight ??= (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      saveTokens(await api<LoginResponse>('POST', '/auth/refresh', { refreshToken }));
      return true;
    } catch (err) {
      // Server unreachable: keep the tokens, the next call can retry.
      if (err instanceof ApiError && err.status === 0) return false;
      clearTokens();
      onExpired();
      return false;
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

setTokenProvider(getAccessToken);
setRefreshHandler(refreshTokens);
