import type { ReactNode } from 'react';
import { HashRouter, Link, Route, Routes } from 'react-router';

import { AuthProvider } from '../auth/AuthContext';
import { RequireAuth } from '../auth/guards';
import { RealtimeProvider } from '../realtime/RealtimeContext';
import { LoginForm } from '../shared/components/LoginForm';
import { NotFoundPage } from '../shared/components/NotFoundPage';
import { SettingsPage } from './account/SettingsPage';
import { SignupPage } from './account/SignupPage';
import { BookPage } from './booking/BookPage';
import { PortalHome } from './home/PortalHome';
import { PortalLayout } from './layout/PortalLayout';
import { PORTAL_MENU } from './menu';
import { ProfilePage } from './profile/ProfilePage';
import { SessionPage } from './session/SessionPage';
import { WalletPage } from './wallet/WalletPage';

const PAGES: Record<string, ReactNode> = {
  '/book': <BookPage />,
  '/session': <SessionPage />,
  '/wallet': <WalletPage />,
  '/profile': <ProfilePage />,
  '/settings': <SettingsPage />,
};

export function PortalApp() {
  return (
    <AuthProvider app="portal">
      {/* Only the gamer's own events: session_notice on My session. */}
      <RealtimeProvider>
        <HashRouter>
          <Routes>
            <Route element={<PortalLayout />}>
              <Route
                path="/login"
                element={
                  <>
                    <h1>Login</h1>
                    <LoginForm legend="Gamer login" />
                    <p>
                      New here? <Link to="/signup">Create an account</Link>
                    </p>
                  </>
                }
              />
              <Route path="/signup" element={<SignupPage />} />
              <Route element={<RequireAuth />}>
                <Route index element={<PortalHome />} />
                {PORTAL_MENU.map((item) => (
                  <Route key={item.path} path={item.path} element={PAGES[item.path]} />
                ))}
                <Route path="*" element={<NotFoundPage back="the menu" />} />
              </Route>
            </Route>
          </Routes>
        </HashRouter>
      </RealtimeProvider>
    </AuthProvider>
  );
}
