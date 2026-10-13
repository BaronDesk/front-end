import type { FormEvent } from 'react';

import { Button } from '../primitives/Button';
import { PasswordField, TextField } from '../primitives/Field';
import { u } from '../primitives/Art';
import { AuthError, AuthFields, AuthForm, AuthLogo, AuthMascot, AuthScreen } from './AuthLayout';

/** What the login screen shows and does (the app's login hook gives it). */
export interface LoginFormState {
  username: string;
  setUsername(username: string): void;
  password: string;
  setPassword(password: string): void;
  pending: boolean;
  error: unknown;
  /** The session ran out: say so until the user logs in again. */
  expired: boolean;
  submit(e: FormEvent): void;
}

/**
 * Figma "Login": the logo, BIDI, username and password, the brown button.
 * The portal and the desk use it; `wide` fills a desktop window with the
 * design, the form staying in the middle.
 */
export function LoginScreen({ form, wide = false }: { form: LoginFormState; wide?: boolean }) {
  return (
    <AuthScreen variant="form" wide={wide}>
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
