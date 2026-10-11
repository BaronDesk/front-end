import type { ReactNode } from 'react';
import { HashRouter, Route, Routes } from 'react-router';

import { AuthProvider } from '../auth/AuthContext';
import { RequireAuth } from '../auth/guards';
import { RealtimeProvider } from '../realtime/RealtimeContext';
import { NotFoundPage } from '../shared/components/NotFoundPage';
import { LoginPage } from './account/LoginPage';
import { SettingsPage } from './account/SettingsPage';
import { SignupPage } from './account/SignupPage';
import { WelcomePage } from './account/WelcomePage';
import { BookPage } from './booking/BookPage';
import { EventsPage } from './events/EventsPage';
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
            {/* Screens redesigned from Figma: their own full-screen layout. Signed out, the portal opens on Welcome. */}
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route element={<RequireAuth loginPath="/welcome" />}>
              <Route index element={<PortalHome />} />
              <Route path="/events" element={<EventsPage />} />
            </Route>
            {/* The pages not redesigned yet keep the classic layout. */}
            <Route element={<PortalLayout />}>
              <Route element={<RequireAuth loginPath="/welcome" />}>
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
