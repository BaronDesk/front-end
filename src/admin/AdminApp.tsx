import type { ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';

import { AuthProvider, useAuth } from '../auth/AuthContext';
import { RequireAuth, RequireRole } from '../auth/guards';
import { RealtimeProvider } from '../realtime/RealtimeContext';
import { LoginForm } from '../shared/LoginForm';
import { AdminLayout, AdminLoginLayout } from './AdminLayout';
import { AlertsPage } from './alerts/AlertsPage';
import { BookingsPage } from './bookings/BookingsPage';
import { GamesPage } from './games/GamesPage';
import { HqPage } from './hq/HqPage';
import { ADMIN_MENU } from './menu';
import { AccessDenied } from './pages/AccessDenied';
import { AccountPage } from './pages/AccountPage';
import { PlansPage } from './plans/PlansPage';
import { SessionBillPage } from './sessions/SessionBillPage';
import { SessionsPage } from './sessions/SessionsPage';
import { NotFound } from './pages/NotFound';
import { EnrollmentPage } from './stations/EnrollmentPage';
import { StationDetailPage } from './stations/StationDetailPage';
import { StationsPage } from './stations/StationsPage';
import { UsersPage } from './users/UsersPage';
import { WalletPage } from './wallet/WalletPage';

/** The page of each menu path. */
const PAGES: Record<string, ReactNode> = {
  '/stations': <StationsPage />,
  '/enrollment': <EnrollmentPage />,
  '/alerts': <AlertsPage />,
  '/users': <UsersPage />,
  '/wallet': <WalletPage />,
  '/plans': <PlansPage />,
  '/games': <GamesPage />,
  '/sessions': <SessionsPage />,
  '/bookings': <BookingsPage />,
  '/hq': <HqPage />,
};

/** HQ starts on the all-branches overview; everyone else on their stations. */
function Home() {
  const { user } = useAuth();
  return <Navigate to={user?.branchId === null ? '/hq' : '/stations'} replace />;
}

// Hash routing (#/stations): works the same in the Vite dev server, behind
// Caddy's plain file_server, and inside the Electron window, with no
// server-side rewrite rules for deep links.
export function AdminApp() {
  return (
    <AuthProvider app="admin">
      <RealtimeProvider>
        <HashRouter>
          <Routes>
            <Route element={<AdminLoginLayout />}>
              <Route
                path="/login"
                element={
                  <>
                    <h1>Staff login</h1>
                    <LoginForm legend="Log in to BaronDesk" />
                  </>
                }
              />
            </Route>

            <Route element={<RequireAuth />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Home />} />
                {ADMIN_MENU.map((item) => {
                  const page = PAGES[item.path];
                  return (
                    <Route
                      key={item.path}
                      path={item.path}
                      element={item.minRole ? <RequireRole min={item.minRole}>{page}</RequireRole> : page}
                    />
                  );
                })}
                <Route path="/stations/:id" element={<StationDetailPage />} />
                <Route path="/sessions/:id" element={<SessionBillPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/denied" element={<AccessDenied />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
          </Routes>
        </HashRouter>
      </RealtimeProvider>
    </AuthProvider>
  );
}
