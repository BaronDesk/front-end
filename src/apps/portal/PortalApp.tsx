import { HashRouter, Route, Routes } from 'react-router';

import { AuthProvider } from '../../providers/AuthProvider';
import { RequireAuth } from '../../providers/guards';
import { RealtimeProvider } from '../../providers/RealtimeProvider';
import { LoginPage } from './pages/auth/LoginPage';
import { AccountPage } from './pages/settings/AccountPage';
import { FaqPage, HistoryPage, TermsPage } from './pages/settings/InfoPages';
import { SettingsPage } from './pages/settings/SettingsPage';
import { SignupPage } from './pages/auth/SignupPage';
import { WelcomePage } from './pages/auth/WelcomePage';
import { BookPage } from './pages/book/BookPage';
import { EventsPage } from './pages/events/EventsPage';
import { TournamentPage } from './pages/events/TournamentPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { HomePage } from './pages/home/HomePage';
import { PortalShell } from './layout/PortalShell';
import { PlansPage } from './pages/settings/PlansPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { SessionPage } from './pages/session/SessionPage';
import { WalletPage } from './pages/wallet/WalletPage';

export function PortalApp() {
  return (
    <AuthProvider app="portal">
      {/* Only the gamer's own events: session_notice on My session. */}
      <RealtimeProvider>
        <HashRouter>
          <Routes>
            {/* The signed-out screens have their own full-screen layout; signed out, the portal opens on Welcome. */}
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route element={<RequireAuth loginPath="/welcome" />}>
              <Route element={<PortalShell />}>
                <Route index element={<HomePage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/events/:id" element={<TournamentPage />} />
                <Route path="/book" element={<BookPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/plans" element={<PlansPage />} />
                <Route path="/session" element={<SessionPage />} />
                <Route path="/wallet" element={<WalletPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </HashRouter>
      </RealtimeProvider>
    </AuthProvider>
  );
}
