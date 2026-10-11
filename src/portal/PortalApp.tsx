import type { ReactNode } from 'react';
import { HashRouter, Route, Routes } from 'react-router';

import { AuthProvider } from '../auth/AuthContext';
import { RequireAuth } from '../auth/guards';
import { RealtimeProvider } from '../realtime/RealtimeContext';
import { NotFoundPage } from '../shared/components/NotFoundPage';
import { LoginPage } from './account/LoginPage';
import { AccountPage } from './account/AccountPage';
import { FaqPage, HistoryPage, TermsPage } from './account/InfoPages';
import { SettingsScreen } from './account/SettingsScreen';
import { SignupPage } from './account/SignupPage';
import { WelcomePage } from './account/WelcomePage';
import { BookPage } from './booking/BookPage';
import { EventsPage } from './events/EventsPage';
import { PortalHome } from './home/PortalHome';
import { PortalLayout } from './layout/PortalLayout';
import { PlansPage } from './profile/PlansPage';
import { ProfileScreen } from './profile/ProfileScreen';
import { SessionPage } from './session/SessionPage';
import { WalletPage } from './wallet/WalletPage';

/** Pages not in the Figma design yet: the classic layout. */
const PAGES: Record<string, ReactNode> = {
  '/session': <SessionPage />,
  '/wallet': <WalletPage />,
  '/account': <AccountPage />,
  '/plans': <PlansPage />,
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
              <Route path="/book" element={<BookPage />} />
              <Route path="/profile" element={<ProfileScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/faq" element={<FaqPage />} />
            </Route>
            {/* The pages not redesigned yet keep the classic layout. */}
            <Route element={<PortalLayout />}>
              <Route element={<RequireAuth loginPath="/welcome" />}>
                {Object.entries(PAGES).map(([path, page]) => (
                  <Route key={path} path={path} element={page} />
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
