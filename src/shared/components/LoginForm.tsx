import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { useAuth } from '../../auth/AuthContext';
import { ErrorBox } from './ErrorBox';

/**
 * The login form's state and submit, shared by the staff login and the
 * portal's: after login, back to the page that sent the user here.
 */
export function useLoginForm() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err);
      setPending(false);
    }
  }

  return {
    /** Already logged in: where to go instead of showing the form. */
    redirect: state.status === 'authenticated' ? from : null,
    expired: state.status === 'anonymous' && state.reason === 'expired',
    username,
    setUsername,
    password,
    setPassword,
    pending,
    error,
    submit,
  };
}

interface LoginFormProps {
  legend: string;
}

export function LoginForm({ legend }: LoginFormProps) {
  const form = useLoginForm();
  if (form.redirect) return <Navigate to={form.redirect} replace />;

  return (
    <form onSubmit={form.submit}>
      {form.expired && <div className="msg">Your session expired. Please log in again.</div>}
      <ErrorBox error={form.error} />
      <fieldset>
        <legend>{legend}</legend>
        <div className="form-row">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            autoComplete="username"
            autoFocus
            required
            value={form.username}
            onChange={(e) => form.setUsername(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => form.setPassword(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label />
          <button type="submit" disabled={form.pending}>
            {form.pending ? 'Logging in…' : 'Log in'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
