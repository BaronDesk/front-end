import type { ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';

import { AuthProvider, useAuth } from '../../providers/AuthProvider';
import { RequireAuth, RequireRole } from '../../providers/guards';
import { RealtimeProvider } from '../../providers/RealtimeProvider';
import { LoginPage } from './pages/login/LoginPage';
import { NotFoundPage } from './components/NotFoundPage';
import { DeskLayout } from './layout/DeskLayout';
import { AlertsPage } from './pages/alerts/AlertsPage';
import { AuditPage } from './pages/audit/AuditPage';
import { BookingsPage } from './pages/bookings/BookingsPage';
import { GamesPage } from './pages/games/GamesPage';
import { HqPage } from './pages/hq/HqPage';
import { DESK_MENU } from './menu';
import { AccessDenied } from './layout/AccessDenied';
import { AccountPage } from './pages/account/AccountPage';
import { PlansPage } from './pages/plans/PlansPage';
import { RanksPage } from './pages/ranks/RanksPage';
import { SessionBillPage } from './pages/sessions/SessionBillPage';
import { EnrollmentPage } from './pages/stations/EnrollmentPage';
import { StationDetailPage } from './pages/stations/StationDetailPage';
import { StationsPage } from './pages/stations/StationsPage';
import { TournamentManagePage } from './pages/tournaments/TournamentManagePage';
import { TournamentsPage } from './pages/tournaments/TournamentsPage';
import { UsersPage } from './pages/users/UsersPage';
import { WalletPage } from './pages/wallet/WalletPage';

/** The page of each menu path. */
const PAGES: Record<string, ReactNode> = {
  '/stations': <StationsPage />,
  '/enrollment': <EnrollmentPage />,
  '/alerts': <AlertsPage />,
  '/users': <UsersPage />,
  '/wallet': <WalletPage />,
  '/plans': <PlansPage />,
  '/ranks': <RanksPage />,
  '/games': <GamesPage />,
  '/tournaments': <TournamentsPage />,
  '/bookings': <BookingsPage />,
  '/hq': <HqPage />,
  '/audit': <AuditPage />,
};

/** HQ starts on the all-branches overview; everyone else on their stations. */
function Home() {
  const { user } = useAuth();
  return <Navigate to={user?.branchId === null ? '/hq' : '/stations'} replace />;
}

// Hash routing (#/stations): works the same in the Vite dev server, behind
// Caddy's plain file_server, and inside the Electron window, with no
// server-side rewrite rules for deep links.
export function DeskApp() {
  return (
    <AuthProvider app="admin">
      <RealtimeProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RequireAuth />}>
              <Route element={<DeskLayout />}>
                <Route index element={<Home />} />
                {DESK_MENU.map((item) => {
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
                <Route
                  path="/tournaments/:id"
                  element={
                    <RequireRole min="MANAGER">
                      <TournamentManagePage />
                    </RequireRole>
                  }
                />
                {/* The sessions list is part of Bookings; each session's bill has its own page. */}
                <Route path="/sessions" element={<Navigate to="/bookings" replace />} />
                <Route path="/sessions/:id" element={<SessionBillPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/denied" element={<AccessDenied />} />
                <Route path="*" element={<NotFoundPage back="stations" />} />
              </Route>
            </Route>
          </Routes>
        </HashRouter>
      </RealtimeProvider>
    </AuthProvider>
  );
}
