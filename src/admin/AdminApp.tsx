import { HashRouter, Navigate, Route, Routes } from 'react-router';

import { AuthProvider } from '../auth/AuthContext';
import { RequireAuth, RequireRole } from '../auth/guards';
import { RealtimeProvider } from '../realtime/RealtimeContext';
import { LoginForm } from '../shared/LoginForm';
import { Placeholder } from '../shared/Placeholder';
import { AdminLayout, AdminLoginLayout } from './AdminLayout';
import { ADMIN_MENU } from './menu';
import { AccessDenied } from './pages/AccessDenied';
import { LiveEventCounter } from './pages/LiveEventCounter';
import { NotFound } from './pages/NotFound';

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
                    <LoginForm legend="Log in to BaronDesk" mockHint="Try staff.tunis / password123." />
                  </>
                }
              />
            </Route>

            <Route element={<RequireAuth />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Navigate to="/stations" replace />} />
                {ADMIN_MENU.map((item) => {
                  const page = (
                    <>
                      <Placeholder title={item.label} step={item.step} />
                      <LiveEventCounter />
                    </>
                  );
                  return (
                    <Route
                      key={item.path}
                      path={item.path}
                      element={item.minRole ? <RequireRole min={item.minRole}>{page}</RequireRole> : page}
                    />
                  );
                })}
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
