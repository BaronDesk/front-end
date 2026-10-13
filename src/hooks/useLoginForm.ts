import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useAuth } from '../providers/AuthProvider';

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
