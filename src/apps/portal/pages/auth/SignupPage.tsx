import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { authService } from '../../../../services/auth.service';
import { useAuth } from '../../../../providers/AuthProvider';
import { useBranches } from '../../../../hooks/queries';
import { AuthError, AuthFields, AuthForm, AuthLogo, AuthMascot, AuthScreen } from '../../../../components/layout/AuthLayout';
import { PasswordField, SelectField, TextField } from '../../../../components/primitives/Field';
import { u } from '../../../../components/primitives/Art';
import { Button } from '../../../../components/primitives/Button';
import styles from './SignupPage.module.css';

/**
 * Sign-up: create a gamer account. Every gamer picks the branch they
 * play at: the booking page then lists that branch's stations (changeable in Settings).
 */
export function SignupPage() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const branches = useBranches();
  const [form, setForm] = useState({ username: '', password: '', confirm: '', branchId: '' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [mismatch, setMismatch] = useState(false);

  if (state.status === 'authenticated') return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    setPending(true);
    try {
      const username = form.username.trim();
      await authService.signUp({ username, password: form.password, branchId: form.branchId });
      await login(username, form.password);
      navigate('/book', { replace: true });
    } catch (err) {
      setError(err);
      setPending(false);
    }
  }

  return (
    <AuthScreen variant="form">
      <AuthLogo top={44} />
      <AuthMascot variant="form" top={98} />
      <AuthForm top={367} onSubmit={submit}>
        <AuthFields className={styles.fieldsSignup}>
          <TextField
            placeholder="Username"
            autoComplete="username"
            autoFocus
            required
            minLength={3}
            maxLength={64}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <SelectField label="Branch" required value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            <option value="" disabled>
              {branches.data ? 'Branch' : 'Loading…'}
            </option>
            {(branches.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectField>
          <PasswordField
            placeholder="Password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <PasswordField
            placeholder="Confirm Password"
            autoComplete="new-password"
            required
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </AuthFields>
        <Button type="submit" size="lg" style={{ width: u(112), marginTop: u(37) }} disabled={pending}>
          Sign Up
        </Button>
        <AuthError error={error ?? branches.error} text={mismatch ? 'The two passwords are not the same.' : undefined} />
      </AuthForm>
    </AuthScreen>
  );
}
