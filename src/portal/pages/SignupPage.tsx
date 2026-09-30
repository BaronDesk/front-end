import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';

import { api } from '../../api/http';
import type { Branch, PublicUser } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { useApiQuery } from '../../shared/useApiQuery';
import { BranchSelect } from '../BranchSelect';

/**
 * Create a gamer account. Every gamer picks the branch they play at: the
 * booking page then lists that branch's stations (changeable in Settings).
 */
export function SignupPage() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const branches = useApiQuery<Branch[]>('/branches');
  const [form, setForm] = useState({ username: '', password: '', branchId: '' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (state.status === 'authenticated') return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api<PublicUser>('POST', '/users', { ...form, username: form.username.trim() });
      await login(form.username.trim(), form.password);
      navigate('/book', { replace: true });
    } catch (err) {
      setError(err);
      setPending(false);
    }
  }

  return (
    <>
      <h1>Create your account</h1>
      <ErrorBox error={error ?? branches.error} />
      <form onSubmit={submit}>
        <fieldset>
          <legend>New gamer</legend>
          <div className="form-row">
            <label htmlFor="su-username">Username</label>
            <input
              id="su-username"
              autoComplete="username"
              autoFocus
              required
              minLength={3}
              maxLength={64}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor="su-password">Password</label>
            <input
              id="su-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor="su-branch">Where you play</label>
            <BranchSelect id="su-branch" branches={branches.data} value={form.branchId} onChange={(branchId) => setForm({ ...form, branchId })} />
          </div>
          <div className="form-row">
            <label />
            <button type="submit" disabled={pending || !form.branchId}>
              {pending ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </fieldset>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </>
  );
}
