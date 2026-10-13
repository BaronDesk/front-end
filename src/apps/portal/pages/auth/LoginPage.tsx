import { Navigate } from 'react-router';

import { useLoginForm } from '../../../../hooks/useLoginForm';
import { AuthError, AuthFields, AuthForm, AuthLogo, AuthMascot, AuthScreen } from '../../../../components/layout/AuthLayout';
import { PasswordField, TextField } from '../../../../components/primitives/Field';
import { u } from '../../../../components/primitives/Art';
import { Button } from '../../../../components/primitives/Button';

/** Figma "Login". */
export function LoginPage() {
  const form = useLoginForm();
  if (form.redirect) return <Navigate to={form.redirect} replace />;

  return (
    <AuthScreen variant="form">
      <AuthLogo top={81} />
      <AuthMascot variant="form" top={135} />
      <AuthForm top={392} onSubmit={form.submit}>
        <AuthFields gap={11}>
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
        </AuthFields>
        <Button type="submit" size="lg" style={{ width: u(96), marginTop: u(21) }} disabled={form.pending}>
          Login
        </Button>
        <AuthError error={form.error} text={!form.error && form.expired ? 'Your session expired. Please log in again.' : undefined} />
      </AuthForm>
    </AuthScreen>
  );
}
