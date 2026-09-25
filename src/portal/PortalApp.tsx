import { HashRouter, Link, Route, Routes } from 'react-router';

import { AuthProvider, useAuth } from '../auth/AuthContext';
import { RequireAuth } from '../auth/guards';
import { LoginForm } from '../shared/LoginForm';
import { Placeholder } from '../shared/Placeholder';
import { PORTAL_MENU } from './menu';
import { PortalLayout } from './PortalLayout';

function PortalHome() {
  const { user } = useAuth();
  return (
    <>
      <h1>Welcome, {user?.username}</h1>
      <ul className="portal-menu">
        {PORTAL_MENU.map((item) => (
          <li key={item.path}>
            <Link to={item.path}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function PortalApp() {
  return (
    <AuthProvider app="portal">
      <HashRouter>
        <Routes>
          <Route element={<PortalLayout />}>
            <Route
              path="/login"
              element={
                <>
                  <h1>Login</h1>
                  <LoginForm legend="Gamer login" mockHint="Try gamer1 / password123." />
                </>
              }
            />
            <Route element={<RequireAuth />}>
              <Route index element={<PortalHome />} />
              {PORTAL_MENU.map((item) => (
                <Route
                  key={item.path}
                  path={item.path}
                  element={<Placeholder title={item.label} step={item.step} />}
                />
              ))}
              <Route path="*" element={<Placeholder title="Page not found" step={9} />} />
            </Route>
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
