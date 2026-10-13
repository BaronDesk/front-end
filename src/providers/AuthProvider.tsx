import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError } from '../core/http/client';
import { authService } from '../services/auth.service';
import type { PublicUser, Role } from '../core/api-types';
import { clearQueryCache } from '../hooks/useApiQuery';
import { clearTokens, configureTokens, getRefreshToken, refreshTokens, saveTokens, type AppName } from '../core/auth/tokens';

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; reason?: 'expired' }
  | { status: 'authenticated'; user: PublicUser };

interface AuthApi {
  state: AuthState;
  user: PublicUser | null;
  login(username: string, password: string): Promise<PublicUser>;
  logout(): Promise<void>;
  /** The server answered with the updated account (e.g. a new home branch). */
  updateUser(user: PublicUser): void;
}

const AuthContext = createContext<AuthApi | null>(null);

/** Which roles may use each app. The server enforces scope on every call anyway. */
const APP_ROLES: Record<AppName, Role[]> = {
  admin: ['EMPLOYEE', 'MANAGER', 'ADMIN'],
  portal: ['GAMER'],
};

const WRONG_APP_MESSAGE: Record<AppName, string> = {
  admin: 'This is the staff app. Gamers: use the BaronDesk app on your phone.',
  portal: 'This app is for gamers. Staff: use the BaronDesk desktop app.',
};

export function AuthProvider({ app, children }: { app: AppName; children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    configureTokens(app, () => {
      clearQueryCache();
      setState({ status: 'anonymous', reason: 'expired' });
    });

    // A refresh token in sessionStorage means this tab was logged in before a reload.
    if (!getRefreshToken()) {
      setState({ status: 'anonymous' });
      return;
    }
    let cancelled = false;
    (async () => {
      const ok = await refreshTokens();
      const user = ok ? await authService.me().catch(() => null) : null;
      if (cancelled) return;
      if (user && APP_ROLES[app].includes(user.role)) {
        setState({ status: 'authenticated', user });
      } else {
        clearTokens();
        setState({ status: 'anonymous' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app]);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      // Best effort: the tokens are dropped locally whatever the server says.
      await authService.logout(refreshToken).catch(() => undefined);
    }
    clearTokens();
    clearQueryCache();
    setState({ status: 'anonymous' });
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      saveTokens(await authService.login(username, password));
      // A new account: nothing read before belongs to it.
      clearQueryCache();
      const user = await authService.me();
      if (!APP_ROLES[app].includes(user.role)) {
        await logout();
        throw new ApiError(403, 'WRONG_APP', WRONG_APP_MESSAGE[app]);
      }
      setState({ status: 'authenticated', user });
      return user;
    },
    [app, logout],
  );

  const updateUser = useCallback((user: PublicUser) => {
    setState((s) => (s.status === 'authenticated' ? { status: 'authenticated', user } : s));
  }, []);

  const value = useMemo<AuthApi>(
    () => ({ state, user: state.status === 'authenticated' ? state.user : null, login, logout, updateUser }),
    [state, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
