import { Link, Navigate, useLocation } from 'react-router';

import { useAuth } from '../../auth/AuthContext';
import bidi from '../ui/assets/bidi-welcome.svg';
import { AuthLogo, AuthScreen } from '../ui/AuthScreen';

/** Figma "Sign Up / Login": the first screen of a signed-out gamer. */
export function WelcomePage() {
  const { state } = useAuth();
  // Where the gamer was going: login and sign-up bring them back there.
  const from = useLocation().state as { from?: string } | null;
  if (state.status === 'authenticated') return <Navigate to="/" replace />;

  return (
    <AuthScreen variant="welcome">
      <AuthLogo top={124} left={102} />
      <img className="bd-auth-bidi bd-auth-bidi-welcome" src={bidi} alt="" />
      <Link to="/login" state={from} className="bd-auth-choice bd-auth-choice-login">
        Login
      </Link>
      <Link to="/signup" className="bd-auth-choice bd-auth-choice-signup">
        Sign Up
      </Link>
    </AuthScreen>
  );
}
