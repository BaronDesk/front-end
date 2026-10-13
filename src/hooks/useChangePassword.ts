import { useState, type FormEvent } from 'react';

import { saveTokens } from '../core/auth/tokens';
import { authService } from '../services/auth.service';
import { useAction } from './useAction';

/**
 * Changing your own password (POST /auth/change-password). The server ends
 * every other login of the account and answers with a new token pair, so this
 * tab stays logged in. Shared by the desk's and the portal's My account pages.
 */
export function useChangePassword() {
  const action = useAction();
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    const tokens = await action.run(
      'password',
      () => authService.changePassword(passwords),
      'Password changed. You were logged out everywhere else.',
    );
    if (tokens) {
      saveTokens(tokens);
      setPasswords({ currentPassword: '', newPassword: '' });
    }
  }

  return { action, passwords, setPasswords, changePassword };
}
