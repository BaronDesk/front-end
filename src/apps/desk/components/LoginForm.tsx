import { Navigate } from 'react-router';

import { useLoginForm } from '../../../hooks/useLoginForm';
import { ErrorBox } from './ErrorBox';

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
