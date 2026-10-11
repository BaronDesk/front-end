import { Navigate } from 'react-router';

import { useLoginForm } from '../../shared/components/LoginForm';
import bidi from '../ui/assets/bidi-form.svg';
import { AuthError, AuthLogo, AuthScreen } from '../ui/AuthScreen';
import { PasswordField, TextField } from '../ui/Fields';
import { ART, Art, u } from '../ui/units';

/** Figma "Login". */
export function LoginPage() {
  const form = useLoginForm();
  if (form.redirect) return <Navigate to={form.redirect} replace />;

  return (
    <AuthScreen variant="form">
      <AuthLogo top={81} />
      <Art className="bd-auth-bidi bd-auth-bidi-form" src={bidi} w={ART.bidiForm[0]} h={ART.bidiForm[1]} style={{ top: u(135) }} />
      <form className="bd-auth-form" style={{ top: u(392) }} onSubmit={form.submit}>
        <div className="bd-auth-fields" style={{ gap: u(11) }}>
          <TextField
            placeholder="Username"
            autoComplete="username"
            autoFocus
            required
            value={form.username}
            onChange={(e) => form.setUsername(e.target.value)}
          />
          <PasswordField
            placeholder="Password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => form.setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="bd-auth-submit" style={{ width: u(96), marginTop: u(21) }} disabled={form.pending}>
          Login
        </button>
        <AuthError error={form.error} text={!form.error && form.expired ? 'Your session expired. Please log in again.' : undefined} />
      </form>
    </AuthScreen>
  );
}
