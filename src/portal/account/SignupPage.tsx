import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { api } from '../../api/http';
import type { Branch, PublicUser } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import bidi from '../ui/assets/bidi-form.svg';
import { AuthError, AuthLogo, AuthScreen } from '../ui/AuthScreen';
import { PasswordField, SelectField, TextField } from '../ui/Fields';
import { ART, Art, u } from '../ui/units';

/**
 * Figma "Sign Up": create a gamer account. Every gamer picks the branch they
 * play at: the booking page then lists that branch's stations (changeable in Settings).
 */
export function SignupPage() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const branches = useApiQuery<Branch[]>('/branches');
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
      await api<PublicUser>('POST', '/users', { username, password: form.password, branchId: form.branchId });
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
      <Art className="bd-auth-bidi bd-auth-bidi-form" src={bidi} w={ART.bidiForm[0]} h={ART.bidiForm[1]} style={{ top: u(98) }} />
      <form className="bd-auth-form" style={{ top: u(367) }} onSubmit={submit}>
        <div className="bd-auth-fields bd-auth-fields-signup">
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
        </div>
        <button type="submit" className="bd-auth-submit" style={{ width: u(112), marginTop: u(37) }} disabled={pending}>
          Sign Up
        </button>
        <AuthError error={error ?? branches.error} text={mismatch ? 'The two passwords are not the same.' : undefined} />
      </form>
    </AuthScreen>
  );
}
