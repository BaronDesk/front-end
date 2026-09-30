import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import { ErrorBox } from './ErrorBox';

interface LoginFormProps {
  legend: string;
}

export function LoginForm({ legend }: LoginFormProps) {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (state.status === 'authenticated') return <Navigate to={from} replace />;

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

  return (
    <form onSubmit={submit}>
      {state.status === 'anonymous' && state.reason === 'expired' && (
        <div className="msg">Your session expired. Please log in again.</div>
      )}
      <ErrorBox error={error} />
      <fieldset>
        <legend>{legend}</legend>
        <div className="form-row">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label />
          <button type="submit" disabled={pending}>
            {pending ? 'Logging in…' : 'Log in'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
