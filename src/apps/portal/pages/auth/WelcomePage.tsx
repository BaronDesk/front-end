import { Navigate, useLocation } from 'react-router';

import { useAuth } from '../../../../providers/AuthProvider';
import { AuthLogo, AuthMascot, AuthScreen } from '../../../../components/layout/AuthLayout';
import { ButtonLink } from '../../../../components/primitives/Button';
import { cx } from '../../../../lib/cx';
import styles from './WelcomePage.module.css';

/** Welcome: the first screen of a signed-out gamer (log in or sign up). */
export function WelcomePage() {
  const { state } = useAuth();
  // Where the gamer was going: login and sign-up bring them back there.
  const from = useLocation().state as { from?: string } | null;
  // Already logged in (e.g. the login came back after a reload): on to where they were going.
  if (state.status === 'authenticated') return <Navigate to={from?.from ?? '/'} replace />;

  return (
    <AuthScreen variant="welcome">
      <AuthLogo top={124} left={102} />
      <AuthMascot variant="welcome" />
      <ButtonLink to="/login" state={from} size="xl" className={cx(styles.choice, styles.choiceLogin)}>
        Login
      </ButtonLink>
      <ButtonLink to="/signup" size="xl" variant="secondary" className={cx(styles.choice, styles.choiceSignup)}>
        Sign Up
      </ButtonLink>
    </AuthScreen>
  );
}
