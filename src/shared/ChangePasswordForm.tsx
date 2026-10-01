import { useState, type FormEvent } from 'react';

import { api } from '../api/http';
import type { LoginResponse } from '../api/types';
import { saveTokens } from '../auth/tokens';
import { ActionMessages, useAction } from './useAction';

/**
 * Change your own password (POST /auth/change-password). The server ends
 * every other login of the account and answers with a new token pair, so this
 * tab stays logged in. Used by the portal's Settings and the admin's My account.
 */
export function ChangePasswordForm() {
  const action = useAction();
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    const tokens = await action.run(
      'password',
      () => api<LoginResponse>('POST', '/auth/change-password', passwords),
      'Password changed. You were logged out everywhere else.',
    );
    if (tokens) {
      saveTokens(tokens);
      setPasswords({ currentPassword: '', newPassword: '' });
    }
  }

  return (
    <form onSubmit={changePassword}>
      <fieldset>
        <legend>Password</legend>
        <ActionMessages action={action} />
        <div className="form-row">
          <label htmlFor="pw-current">Current password</label>
          <input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            required
            value={passwords.currentPassword}
            onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
          />
        </div>
        <div className="form-row">
          <label htmlFor="pw-new">New password</label>
          <input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={passwords.newPassword}
            onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
          />
        </div>
        <div className="form-row">
          <label />
          <button type="submit" disabled={action.busy === 'password'}>
            Change password
          </button>
        </div>
      </fieldset>
    </form>
  );
}
