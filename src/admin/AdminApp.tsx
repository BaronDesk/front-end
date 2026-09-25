import { HashRouter, Navigate, Route, Routes } from 'react-router';

import { Placeholder } from '../shared/Placeholder';
import { AdminLayout } from './AdminLayout';
import { ADMIN_MENU } from './menu';
import { AccessDenied } from './pages/AccessDenied';
import { NotFound } from './pages/NotFound';

// Hash routing (#/stations): works the same in the Vite dev server, behind
// Caddy's plain file_server, and inside the Electron window, with no
// server-side rewrite rules for deep links.
export function AdminApp() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/stations" replace />} />
          {ADMIN_MENU.map((item) => (
            <Route
              key={item.path}
              path={item.path}
              element={<Placeholder title={item.label} step={item.step} />}
            />
          ))}
          <Route path="/login" element={<Placeholder title="Login" step={3} />} />
          <Route path="/denied" element={<AccessDenied />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
